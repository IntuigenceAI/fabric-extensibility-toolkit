import { useState, useCallback, useRef, useEffect } from 'react';
import { IntuigenceAPIClient, FileStatusResponse, DocumentDetails } from '../../../clients/IntuigenceAPIClient';
import type { OneLakeIngestRequest } from '../../../clients/IntuigenceAPIClient';
import { DataSourceType, CatalogDocumentEntry, CatalogDocumentType, DocumentProcessingStatus } from '../DataCatalogDefinition';
import { OneLakeFileSelection } from '../DataCatalogContext';

export interface ProcessingFile {
  localId: string;
  fileName: string;
  fileType: string;
  sourceType: DataSourceType;
  onelakePath?: string;
  status: 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  fileId?: string;
  documentId?: string;
  error?: string;
}

export interface UseDocumentProcessingResult {
  ingestFromOneLake: (files: OneLakeFileSelection[], docType?: string) => void;
  activeFiles: ProcessingFile[];
  removeFile: (localId: string) => void;
  clearCompleted: () => void;
  resumePolling: (fileId: string, localId: string, fileName: string) => void;
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

/** Build a CatalogDocumentEntry from file status and processing result. */
function buildDocumentEntry(
  localId: string,
  fileStatus: FileStatusResponse,
  fileId: string,
  documentType: CatalogDocumentType,
  result: {
    processingStatus: DocumentProcessingStatus;
    documentId: string | null;
    graphId: string | null;
    fileSize: number;
    error: string | null;
  },
): CatalogDocumentEntry {
  return {
    id: localId,
    fileName: fileStatus.originalFilename,
    mimeType: fileStatus.mimeType || 'application/octet-stream',
    sizeBytes: result.fileSize,
    sourceType: 'onelake',
    documentType,
    processingStatus: result.processingStatus,
    intuigenceDocumentId: result.documentId,
    intuigenceFileId: fileId,
    intuigenceGraphId: result.graphId,
    errorMessage: result.error,
    lastUpdated: new Date().toISOString(),
    createdAt: fileStatus.createdAt,
    addedBy: 'Fabric User',
  };
}

export function useDocumentProcessing(
  apiClient: IntuigenceAPIClient | null,
  itemObjectId: string | undefined,
  onDocumentReady: (entry: CatalogDocumentEntry) => void,
): UseDocumentProcessingResult {
  const [activeFiles, setActiveFiles] = useState<ProcessingFile[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Use a ref for onDocumentReady so setInterval callbacks always call the
  // latest version, avoiding stale closures that read outdated definitions.
  const onDocumentReadyRef = useRef(onDocumentReady);
  useEffect(() => { onDocumentReadyRef.current = onDocumentReady; }, [onDocumentReady]);

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

  const verifyDocumentIndexed = useCallback(async (
    fileStatus: FileStatusResponse,
    fileId: string,
  ): Promise<{ ready: boolean; failed: boolean; documentId: string | null; graphId: string | null; fileSize: number | null; error?: string }> => {
    if (!apiClient) return { ready: false, failed: false, documentId: null, graphId: null, fileSize: null };

    const documentId = fileStatus.properties?.documentId as string | undefined;
    if (!documentId) {
      return { ready: false, failed: false, documentId: null, graphId: null, fileSize: null };
    }

    try {
      const doc: DocumentDetails = await apiClient.getDocument(documentId);
      const docFileSize = Number(doc.file_size) || null;

      if (doc.is_indexed === true || doc.status === 'success') {
        const props = doc.properties as Record<string, unknown> | undefined;
        const graphId = (props?.graph_id as string) || null;
        return { ready: true, failed: false, documentId, graphId, fileSize: docFileSize };
      }
      if (doc.status === 'failed') {
        return { ready: false, failed: true, documentId, graphId: null, fileSize: docFileSize, error: (doc.error_message as string) || 'Document processing failed' };
      }
      return { ready: false, failed: false, documentId, graphId: null, fileSize: docFileSize };
    } catch (err) {
      console.warn('[useDocumentProcessing] Document check failed, continuing poll:', err);
      return { ready: false, failed: false, documentId, graphId: null, fileSize: null };
    }
  }, [apiClient]);

  const startPolling = useCallback((localId: string, fileId: string, documentType: CatalogDocumentType = 'document') => {
    if (!apiClient || pollTimers.current.has(localId)) return;

    const interval = setInterval(async () => {
      const stopPolling = () => {
        clearInterval(interval);
        pollTimers.current.delete(localId);
      };

      try {
        const fileStatus: FileStatusResponse = await apiClient.getFileStatus(fileId);

        // File-level failure
        if (fileStatus.processingStatus === 'failed') {
          stopPolling();
          updateFile(localId, { status: 'failed', error: fileStatus.processingErrorMessage || 'Processing failed' });
          onDocumentReadyRef.current(buildDocumentEntry(localId, fileStatus, fileId, documentType, {
            processingStatus: 'failed',
            documentId: null,
            graphId: null,
            fileSize: Number(fileStatus.fileSize) || 0,
            error: fileStatus.processingErrorMessage || 'Processing failed',
          }));
          return;
        }

        // Check document indexing status when:
        // - File processing is 'completed' (normal docs), OR
        // - A documentId is already linked (P&IDs — the Python worker updates
        //   the documents table but not file_uploads, so processingStatus may
        //   stay at 'processing' even though the document is fully indexed).
        const shouldCheckDocument = fileStatus.processingStatus === 'completed' || !!fileStatus.properties?.documentId;

        if (shouldCheckDocument) {
          const docCheck = await verifyDocumentIndexed(fileStatus, fileId);

          if (docCheck.ready) {
            stopPolling();
            updateFile(localId, { status: 'completed', progress: 100, documentId: docCheck.documentId || undefined });
            onDocumentReadyRef.current(buildDocumentEntry(localId, fileStatus, fileId, documentType, {
              processingStatus: 'success',
              documentId: docCheck.documentId,
              graphId: docCheck.graphId,
              fileSize: Number(fileStatus.fileSize) || docCheck.fileSize || 0,
              error: null,
            }));
            return;
          }

          if (docCheck.failed) {
            stopPolling();
            updateFile(localId, { status: 'failed', error: docCheck.error || 'Document processing failed' });
            onDocumentReadyRef.current(buildDocumentEntry(localId, fileStatus, fileId, documentType, {
              processingStatus: 'failed',
              documentId: docCheck.documentId,
              graphId: null,
              fileSize: Number(fileStatus.fileSize) || 0,
              error: docCheck.error || 'Document processing failed',
            }));
            return;
          }

          // File extraction done but embeddings still running
          if (fileStatus.processingStatus === 'completed') {
            updateFile(localId, { status: 'processing', progress: 75, documentId: docCheck.documentId || undefined });
            return;
          }
        }

        // Still in earlier stages (pending / queued / processing)
        const progressMap: Record<string, number> = { pending: 10, queued: 20, processing: 50 };
        updateFile(localId, {
          status: 'processing',
          progress: progressMap[fileStatus.processingStatus] || 30,
        });
      } catch (err) {
        console.error('[useDocumentProcessing] Poll error:', err);
        stopPolling();
        updateFile(localId, { status: 'failed', error: 'Failed to check status' });
      }
    }, POLL_INTERVAL_MS);

    pollTimers.current.set(localId, interval);
  }, [apiClient, updateFile, verifyDocumentIndexed]);

  const resumePolling = useCallback((fileId: string, localId: string, fileName: string) => {
    if (pollTimers.current.has(localId)) return;

    setActiveFiles(prev => {
      if (prev.some(f => f.fileId === fileId)) return prev;
      return [...prev, {
        localId,
        fileName,
        fileType: 'document',
        sourceType: 'onelake' as DataSourceType,
        status: 'processing' as const,
        progress: 50,
        fileId,
      }];
    });

    startPolling(localId, fileId);
  }, [startPolling]);

  const ingestFromOneLake = useCallback((files: OneLakeFileSelection[], docType?: string) => {
    if (!apiClient) return;

    const backendFileType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : undefined;
    const documentType: CatalogDocumentType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : 'document';

    const localEntries = files.map(file => {
      const fileName = file.selectedPath.split('/').pop() || file.fileName;
      const localId = generateId();
      return { localId, fileName, file };
    });

    setActiveFiles(prev => [
      ...prev,
      ...localEntries.map(({ localId, fileName, file }) => ({
        localId,
        fileName,
        fileType: documentType,
        sourceType: 'onelake' as DataSourceType,
        onelakePath: file.selectedPath,
        status: 'uploading' as const,
        progress: 10,
      })),
    ]);

    const request: OneLakeIngestRequest = {
      files: localEntries.map(({ fileName, file }) => ({
        workspaceId: file.workspaceId,
        itemId: file.itemId,
        selectedPath: file.selectedPath,
        fileName,
        mimeType: guessMimeType(fileName),
        fileType: backendFileType,
      })),
    };

    (async () => {
      try {
        const response = await apiClient.ingestFromOneLake(request);

        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          const { localId, fileName } = localEntries[i];

          if (result.status === 'accepted' && result.fileId) {
            updateFile(localId, { status: 'processing', progress: 30, fileId: result.fileId });

            onDocumentReadyRef.current({
              id: localId,
              fileName,
              mimeType: guessMimeType(fileName),
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

            startPolling(localId, result.fileId, documentType);
          } else {
            updateFile(localId, { status: 'failed', error: result.error || 'Server rejected file' });
          }
        }
      } catch (err: any) {
        console.error('[useDocumentProcessing] OneLake ingest error:', err);
        for (const { localId } of localEntries) {
          updateFile(localId, { status: 'failed', error: err.message || 'Ingestion failed' });
        }
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

  return {
    ingestFromOneLake,
    activeFiles,
    removeFile,
    clearCompleted,
    resumePolling,
  };
}
