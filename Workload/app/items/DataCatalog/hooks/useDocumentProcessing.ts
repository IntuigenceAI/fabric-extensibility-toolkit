import { useState, useCallback, useRef, useEffect } from 'react';
import { IntuigenceAPIClient, FileStatusResponse, DocumentDetails } from '../../../clients/IntuigenceAPIClient';
import type { OneLakeIngestRequest } from '../../../clients/IntuigenceAPIClient';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { DataSourceType, CatalogDocumentEntry, CatalogDocumentType } from '../DataCatalogDefinition';
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

export function useDocumentProcessing(
  apiClient: IntuigenceAPIClient | null,
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined,
  onDocumentReady: (entry: CatalogDocumentEntry) => void,
): UseDocumentProcessingResult {
  const [activeFiles, setActiveFiles] = useState<ProcessingFile[]>([]);
  const pollTimers = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Reset all state when switching items
  useEffect(() => {
    // Clear all poll timers
    for (const timer of pollTimers.current.values()) {
      clearInterval(timer);
    }
    pollTimers.current.clear();
    setActiveFiles([]);
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
      // No linked document yet — keep polling
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
      // Still waiting for processing to complete
      return { ready: false, failed: false, documentId, graphId: null, fileSize: docFileSize };
    } catch (err) {
      console.warn('[useDocumentProcessing] Document check failed, continuing poll:', err);
      return { ready: false, failed: false, documentId, graphId: null, fileSize: null };
    }
  }, [apiClient]);

  const startPolling = useCallback((localId: string, fileId: string, documentType: CatalogDocumentType = 'document') => {
    if (!apiClient) return;
    // Don't start duplicate pollers
    if (pollTimers.current.has(localId)) return;

    const interval = setInterval(async () => {
      try {
        const status: FileStatusResponse = await apiClient.getFileStatus(fileId);

        if (status.processingStatus === 'failed') {
          clearInterval(interval);
          pollTimers.current.delete(localId);
          updateFile(localId, {
            status: 'failed',
            error: status.processingErrorMessage || 'Processing failed',
          });
          // Notify parent so it can update the saved entry
          onDocumentReady({
            id: localId,
            fileName: status.originalFilename,
            mimeType: status.mimeType || 'application/octet-stream',
            sizeBytes: Number(status.fileSize) || 0,
            sourceType: 'onelake',
            documentType,
            processingStatus: 'failed',
            intuigenceDocumentId: null,
            intuigenceFileId: fileId,
            intuigenceGraphId: null,
            errorMessage: status.processingErrorMessage || 'Processing failed',
            lastUpdated: new Date().toISOString(),
            createdAt: status.createdAt,
            addedBy: 'Fabric User',
          });
          return;
        }

        if (status.processingStatus === 'completed') {
          // File extraction is done, but embeddings may still be running.
          // Verify the linked document is fully indexed before marking success.
          const docCheck = await verifyDocumentIndexed(status, fileId);

          if (docCheck.failed) {
            clearInterval(interval);
            pollTimers.current.delete(localId);
            updateFile(localId, {
              status: 'failed',
              error: docCheck.error || 'Document processing failed',
            });
            onDocumentReady({
              id: localId,
              fileName: status.originalFilename,
              mimeType: status.mimeType || 'application/octet-stream',
              sizeBytes: Number(status.fileSize) || 0,
              sourceType: 'onelake',
              documentType,
              processingStatus: 'failed',
              intuigenceDocumentId: docCheck.documentId,
              intuigenceFileId: fileId,
              intuigenceGraphId: null,
              errorMessage: docCheck.error || 'Document processing failed',
              lastUpdated: new Date().toISOString(),
              createdAt: status.createdAt,
              addedBy: 'Fabric User',
            });
            return;
          }

          if (!docCheck.ready) {
            // Embeddings still in progress — keep polling
            updateFile(localId, { status: 'processing', progress: 75, documentId: docCheck.documentId || undefined });
            return;
          }

          // Fully indexed — mark success
          clearInterval(interval);
          pollTimers.current.delete(localId);
          updateFile(localId, { status: 'completed', progress: 100, documentId: docCheck.documentId || undefined });

          onDocumentReady({
            id: localId,
            fileName: status.originalFilename,
            mimeType: status.mimeType || 'application/octet-stream',
            sizeBytes: Number(status.fileSize) || docCheck.fileSize || 0,
            sourceType: 'onelake',
            documentType,
            processingStatus: 'success',
            intuigenceDocumentId: docCheck.documentId,
            intuigenceFileId: fileId,
            intuigenceGraphId: docCheck.graphId,
            errorMessage: null,
            lastUpdated: new Date().toISOString(),
            createdAt: status.createdAt,
            addedBy: 'Fabric User',
          });
          return;
        }

        // Still in earlier stages (pending / queued / processing)
        const progressMap: Record<string, number> = {
          pending: 10,
          queued: 20,
          processing: 50,
        };
        updateFile(localId, {
          status: 'processing',
          progress: progressMap[status.processingStatus] || 30,
        });
      } catch (err) {
        console.error('[useDocumentProcessing] Poll error:', err);
        clearInterval(interval);
        pollTimers.current.delete(localId);
        updateFile(localId, { status: 'failed', error: 'Failed to check status' });
      }
    }, POLL_INTERVAL_MS);

    pollTimers.current.set(localId, interval);
  }, [apiClient, updateFile, onDocumentReady, verifyDocumentIndexed]);

  const resumePolling = useCallback((fileId: string, localId: string, fileName: string) => {
    // Don't resume if already polling this file
    if (pollTimers.current.has(localId)) return;

    // Add to activeFiles so the UI shows it
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

    // Map UI doc type key to backend fileType enum and storage documentType
    const backendFileType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : undefined;
    const documentType: CatalogDocumentType = docType === 'pid' ? 'pnid' : docType === 'timeseries' ? 'timeseries' : 'document';

    // Build local tracking entries for UI
    const localEntries = files.map(file => {
      const fileName = file.selectedPath.split('/').pop() || file.fileName;
      const localId = generateId();
      return { localId, fileName, file };
    });

    // Add all files to active list with 'uploading' status
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

    // Build the server-side ingestion request
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

    // Single server-side call — backend fetches from OneLake via OBO
    (async () => {
      try {
        const response = await apiClient.ingestFromOneLake(request);

        for (let i = 0; i < response.results.length; i++) {
          const result = response.results[i];
          const { localId, fileName } = localEntries[i];

          if (result.status === 'accepted' && result.fileId) {
            updateFile(localId, {
              status: 'processing',
              progress: 30,
              fileId: result.fileId,
            });

            // Persist a processing entry to definition.json immediately
            onDocumentReady({
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
            updateFile(localId, {
              status: 'failed',
              error: result.error || 'Server rejected file',
            });
          }
        }
      } catch (err: any) {
        console.error('[useDocumentProcessing] OneLake ingest error:', err);
        for (const { localId } of localEntries) {
          updateFile(localId, {
            status: 'failed',
            error: err.message || 'Ingestion failed',
          });
        }
      }
    })();
  }, [apiClient, updateFile, startPolling, onDocumentReady]);

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
