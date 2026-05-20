import { useState, useCallback, useRef, useEffect } from 'react';
import { IntuigenceAPIClient, DocumentDetails } from '../../../clients/IntuigenceAPIClient';
import type { OneLakeIngestRequest } from '../../../clients/IntuigenceAPIClient';
import { DataSourceType, CatalogDocumentEntry, CatalogDocumentType, DocumentProcessingStatus } from '../DataCatalogDefinition';
import { OneLakeFileSelection } from '../DataCatalogContext';

export interface ProcessingFile {
  localId: string;
  fileName: string;
  mimeType: string;
  fileType: string;
  sourceType: DataSourceType;
  onelakePath?: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  fileId?: string;
  documentId?: string;
  error?: string;
}

export interface UseDocumentProcessingResult {
  ingestFromOneLake: (files: OneLakeFileSelection[], docType?: string) => void;
  trackSeedFile: (fileId: string, fileName: string, mimeType: string, docType: string) => void;
  activeFiles: ProcessingFile[];
  removeFile: (localId: string) => void;
  clearCompleted: () => void;
  resumePolling: (fileId: string, localId: string, fileName: string, mimeType?: string, documentType?: CatalogDocumentType) => void;
}

const POLL_INTERVAL_MS = 3000;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

/** Build a CatalogDocumentEntry from client-side data and document check result. */
function buildDocumentEntry(
  localId: string,
  fileName: string,
  mimeType: string,
  fileId: string,
  documentType: CatalogDocumentType,
  result: {
    processingStatus: DocumentProcessingStatus;
    graphId: string | null;
    fileSize: number;
    error: string | null;
    createdAt: string;
  },
): CatalogDocumentEntry {
  return {
    id: localId,
    fileName,
    mimeType,
    sizeBytes: result.fileSize,
    sourceType: 'onelake',
    documentType,
    processingStatus: result.processingStatus,
    intuigenceDocumentId: fileId,
    intuigenceFileId: fileId,
    intuigenceGraphId: result.graphId,
    errorMessage: result.error,
    lastUpdated: new Date().toISOString(),
    createdAt: result.createdAt,
    addedBy: 'Fabric User',
  };
}

export function useDocumentProcessing(
  apiClient: IntuigenceAPIClient | null,
  itemObjectId: string | undefined,
  onDocumentReady: (entry: CatalogDocumentEntry) => void,
  onIngestComplete?: () => void,
): UseDocumentProcessingResult {
  const [activeFiles, setActiveFiles] = useState<ProcessingFile[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Use refs for callbacks so setInterval/async callbacks always call the
  // latest version, avoiding stale closures that read outdated definitions.
  const onDocumentReadyRef = useRef(onDocumentReady);
  useEffect(() => { onDocumentReadyRef.current = onDocumentReady; }, [onDocumentReady]);

  const onIngestCompleteRef = useRef(onIngestComplete);
  useEffect(() => { onIngestCompleteRef.current = onIngestComplete; }, [onIngestComplete]);

  // Clear all poll timers and reset state when switching items or on unmount.
  useEffect(() => {
    return () => {
      for (const timer of pollTimers.current.values()) {
        clearInterval(timer);
      }
      pollTimers.current.clear();
      setActiveFiles([]);
    };
  }, [itemObjectId]);

  const updateFile = useCallback((localId: string, updates: Partial<ProcessingFile>) => {
    setActiveFiles(prev => prev.map(f => f.localId === localId ? { ...f, ...updates } : f));
  }, []);

  // Poll the documents table directly (fileId === documentId).
  const startPolling = useCallback((
    localId: string,
    fileId: string,
    fileName: string,
    mimeType: string,
    documentType: CatalogDocumentType = 'document',
  ) => {
    if (!apiClient || pollTimers.current.has(localId)) return;

    const interval = setInterval(async () => {
      const stopPolling = () => {
        clearInterval(interval);
        pollTimers.current.delete(localId);
      };

      try {
        const doc: DocumentDetails = await apiClient.getDocument(fileId);
        const fileSize = Number(doc.file_size) || 0;
        const props = doc.properties as Record<string, unknown> | undefined;
        const graphId = (props?.graph_id as string) || null;
        const createdAt = doc.created_at || new Date().toISOString();

        if (doc.is_indexed === true || doc.status === 'success') {
          stopPolling();
          updateFile(localId, { status: 'completed', documentId: fileId });
          onDocumentReadyRef.current(buildDocumentEntry(
            localId, fileName, mimeType, fileId, documentType,
            { processingStatus: 'success', graphId, fileSize, error: null, createdAt },
          ));
          return;
        }

        if (doc.status === 'failed') {
          stopPolling();
          const errorMsg = (doc.error_message as string) || 'Processing failed';
          updateFile(localId, { status: 'failed', error: errorMsg });
          onDocumentReadyRef.current(buildDocumentEntry(
            localId, fileName, mimeType, fileId, documentType,
            { processingStatus: 'failed', graphId: null, fileSize, error: errorMsg, createdAt },
          ));
          return;
        }

        // Still processing — keep polling
        updateFile(localId, { status: 'processing', documentId: fileId });
      } catch (err: any) {
        // 404 means document not yet created — keep polling (grace period)
        if (err?.status === 404 || err?.message?.includes('404') || err?.message?.includes('Not Found')) {
          updateFile(localId, { status: 'processing' });
          return;
        }
        console.error('[useDocumentProcessing] Poll error:', err);
        stopPolling();
        updateFile(localId, { status: 'failed', error: 'Failed to check status' });
      }
    }, POLL_INTERVAL_MS);

    pollTimers.current.set(localId, interval);
  }, [apiClient, updateFile]);

  const resumePolling = useCallback((fileId: string, localId: string, fileName: string, mimeType?: string, documentType?: CatalogDocumentType) => {
    if (pollTimers.current.has(localId)) return;

    const mime = mimeType || guessMimeType(fileName);
    const docType = documentType || 'document';

    setActiveFiles(prev => {
      if (prev.some(f => f.fileId === fileId)) return prev;
      return [...prev, {
        localId,
        fileName,
        mimeType: mime,
        fileType: docType,
        sourceType: 'onelake' as DataSourceType,
        status: 'processing' as const,
        fileId,
      }];
    });

    startPolling(localId, fileId, fileName, mime, docType);
  }, [startPolling]);

  const ingestFromOneLake = useCallback((files: OneLakeFileSelection[], docType?: string) => {
    if (!apiClient) return;

    const backendFileType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : undefined;
    const documentType: CatalogDocumentType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : 'document';

    const localEntries = files.map(file => {
      const fileName = file.selectedPath.split('/').pop() || file.fileName;
      const localId = generateId();
      const mimeType = guessMimeType(fileName);
      return { localId, fileName, mimeType, file };
    });

    setActiveFiles(prev => [
      ...prev,
      ...localEntries.map(({ localId, fileName, mimeType, file }) => ({
        localId,
        fileName,
        mimeType,
        fileType: documentType,
        sourceType: 'onelake' as DataSourceType,
        onelakePath: file.selectedPath,
        status: 'uploading' as const,
      })),
    ]);

    const request: OneLakeIngestRequest = {
      files: localEntries.map(({ fileName, mimeType, file }) => ({
        workspaceId: file.workspaceId,
        itemId: file.itemId,
        selectedPath: file.selectedPath,
        fileName,
        mimeType,
        fileType: backendFileType,
      })),
      fabricCatalogItemId: itemObjectId,
    };

    (async () => {
      try {
        const response = await apiClient.ingestFromOneLake(request);

        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          const { localId, fileName, mimeType } = localEntries[i];

          if (result.status === 'accepted' && result.fileId) {
            updateFile(localId, { status: 'processing', fileId: result.fileId });

            onDocumentReadyRef.current({
              id: localId,
              fileName,
              mimeType,
              sizeBytes: 0,
              sourceType: 'onelake',
              documentType,
              processingStatus: 'processing',
              intuigenceDocumentId: null,
              intuigenceFileId: result.fileId,
              intuigenceGraphId: null,
              errorMessage: null,
              lastUpdated: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              addedBy: 'Fabric User',
            });

            startPolling(localId, result.fileId, fileName, mimeType, documentType);
          } else {
            updateFile(localId, { status: 'failed', error: result.error || 'Server rejected file' });
          }
        }
        // Refresh quota after successful ingest (records now exist in DB)
        onIngestCompleteRef.current?.();
      } catch (err: any) {
        console.error('[useDocumentProcessing] OneLake ingest error:', err);
        const errMsg = err.message || 'Ingestion failed';
        // Parse QUOTA_EXCEEDED from backend 403 response
        const isQuotaExceeded = errMsg.includes('403') && errMsg.includes('QUOTA_EXCEEDED');
        const displayError = isQuotaExceeded
          ? 'Document upload limit reached (Trial). Upgrade to upload more.'
          : errMsg;
        for (const { localId } of localEntries) {
          updateFile(localId, { status: 'failed', error: displayError });
        }
        // Refresh quota even on error (quota may have changed)
        onIngestCompleteRef.current?.();
      }
    })();
  }, [apiClient, updateFile, startPolling]);

  const removeFile = useCallback((localId: string) => {
    const timer = pollTimers.current.get(localId);
    if (timer) {
      clearInterval(timer);
      pollTimers.current.delete(localId);
    }
    setActiveFiles(prev => prev.filter(f => f.localId !== localId));
  }, []);

  const clearCompleted = useCallback(() => {
    setActiveFiles(prev => prev.filter(f => f.status !== 'completed' && f.status !== 'failed'));
  }, []);

  const trackSeedFile = useCallback((fileId: string, fileName: string, mimeType: string, docType: string) => {
    const localId = generateId();
    const documentType = docType as CatalogDocumentType;

    setActiveFiles(prev => [
      ...prev,
      {
        localId,
        fileName,
        mimeType,
        fileType: documentType,
        sourceType: 'sample' as DataSourceType,
        status: 'processing' as const,
        fileId,
      },
    ]);

    onDocumentReadyRef.current({
      id: localId,
      fileName,
      mimeType,
      sizeBytes: 0,
      sourceType: 'sample',
      documentType,
      processingStatus: 'processing',
      intuigenceDocumentId: null,
      intuigenceFileId: fileId,
      intuigenceGraphId: null,
      errorMessage: null,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      addedBy: 'Sample Data',
    });

    startPolling(localId, fileId, fileName, mimeType, documentType);
  }, [startPolling]);

  return {
    ingestFromOneLake,
    trackSeedFile,
    activeFiles,
    removeFile,
    clearCompleted,
    resumePolling,
  };
}
