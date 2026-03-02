import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { IntuigenceAPIClient } from '../../../clients/IntuigenceAPIClient';
import { CatalogDocumentEntry, recomputeStats } from '../DataCatalogDefinition';
import { useOneLakeSync } from './useOneLakeSync';
import { useDocumentProcessing } from './useDocumentProcessing';
import { DataCatalogContextValue, OneLakeFileSelection } from '../DataCatalogContext';
import type { OneLakeFile } from '../../shared/OneLakeTypes';

/** Alias for OneLakeFile used in the Add Data dialog */
export type LakehouseFile = OneLakeFile;

/** Lakehouse selection returned by the DataHub picker */
export interface LakehouseSelection {
  displayName: string;
  folderPath: string;
  lakehouseId: string;
  workspaceId: string;
}

/** Tracks the processing status of an individual file */
export interface ProcessingJob {
  status: 'submitting' | 'processing' | 'success' | 'failed';
  error?: string;
}

export function useDataCatalog(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined,
): DataCatalogContextValue {
  const sync = useOneLakeSync(workloadClient, itemObjectId);
  const [authReady, setAuthReady] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const apiClientRef = useRef<IntuigenceAPIClient | null>(null);

  // Create API client once workspace is resolved
  const apiClient = useMemo(() => {
    if (!sync.workspaceId) return null;
    const client = new IntuigenceAPIClient(workloadClient, sync.workspaceId);
    apiClientRef.current = client;
    return client;
  }, [workloadClient, sync.workspaceId]);

  // Initialize auth when API client is ready
  useEffect(() => {
    if (!apiClient || !sync.workspaceId) return undefined;
    let cancelled = false;

    apiClient.initialize(sync.workspaceId)
      .then(() => {
        if (!cancelled) setAuthReady(true);
      })
      .catch((err) => {
        console.error('[useDataCatalog] Auth initialization failed:', err);
        if (!cancelled) setAuthReady(true);
      });

    return () => { cancelled = true; };
  }, [apiClient, sync.workspaceId]);

  // Handle document ready callback from processing hook.
  // Uses upsert logic: if an entry with the same intuigenceFileId already exists,
  // update it in place; otherwise append a new entry.
  const handleDocumentReady = useCallback((entry: CatalogDocumentEntry) => {
    if (!sync.definition) return;

    const existing = sync.definition.documents;
    let updatedDocs: CatalogDocumentEntry[];

    const matchIdx = entry.intuigenceFileId
      ? existing.findIndex(d => d.intuigenceFileId === entry.intuigenceFileId)
      : -1;

    if (matchIdx >= 0) {
      // Update the existing entry in place
      updatedDocs = existing.map((d, i) => (i === matchIdx ? { ...d, ...entry } : d));
    } else {
      updatedDocs = [...existing, entry];
    }

    const updatedDef = recomputeStats({
      ...sync.definition,
      documents: updatedDocs,
    });

    sync.saveDefinition(updatedDef).catch((err) => {
      console.error('[useDataCatalog] Auto-save failed:', err);
    });
  }, [sync]);

  const processing = useDocumentProcessing(apiClient, workloadClient, sync.itemObjectId, handleDocumentReady);

  // One-time status refresh: when the definition loads, check all non-terminal entries
  // against the backend API and update their status. This handles the case where
  // the definition was saved with 'processing' but the backend has since finished.
  const statusRefreshDone = useRef(false);
  const prevItemIdForRefresh = useRef(itemObjectId);
  if (itemObjectId !== prevItemIdForRefresh.current) {
    prevItemIdForRefresh.current = itemObjectId;
    statusRefreshDone.current = false;
  }
  useEffect(() => {
    if (!sync.definition || !apiClient || !authReady || statusRefreshDone.current) return;
    statusRefreshDone.current = true;

    const pendingDocs = sync.definition.documents.filter(
      d => d.processingStatus !== 'success' && d.processingStatus !== 'failed' && d.intuigenceFileId
    );
    if (pendingDocs.length === 0) return;

    (async () => {
      let anyUpdated = false;
      const updatedDocuments = [...sync.definition!.documents];

      for (const doc of pendingDocs) {
        try {
          const fileStatus = await apiClient.getFileStatus(doc.intuigenceFileId!);

          if (fileStatus.processingStatus === 'completed') {
            const documentId = fileStatus.properties?.documentId as string | undefined;
            if (documentId) {
              try {
                const docDetails = await apiClient.getDocument(documentId);
                if (docDetails.is_indexed === true || docDetails.status === 'success') {
                  const idx = updatedDocuments.findIndex(d => d.id === doc.id);
                  if (idx >= 0) {
                    const props = docDetails.properties as Record<string, unknown> | undefined;
                    const graphId = (props?.graph_id as string) || null;
                    updatedDocuments[idx] = {
                      ...updatedDocuments[idx],
                      processingStatus: 'success',
                      intuigenceDocumentId: documentId,
                      ...(graphId && { intuigenceGraphId: graphId }),
                    };
                    anyUpdated = true;
                  }
                } else if (docDetails.status === 'failed') {
                  const idx = updatedDocuments.findIndex(d => d.id === doc.id);
                  if (idx >= 0) {
                    updatedDocuments[idx] = {
                      ...updatedDocuments[idx],
                      processingStatus: 'failed',
                      errorMessage: (docDetails.error_message as string) || 'Processing failed',
                    };
                    anyUpdated = true;
                  }
                }
              } catch {
                // Document not found or not accessible — skip
              }
            }
          } else if (fileStatus.processingStatus === 'failed') {
            const idx = updatedDocuments.findIndex(d => d.id === doc.id);
            if (idx >= 0) {
              updatedDocuments[idx] = {
                ...updatedDocuments[idx],
                processingStatus: 'failed',
                errorMessage: fileStatus.processingErrorMessage || 'Processing failed',
              };
              anyUpdated = true;
            }
          }
        } catch {
          // File not found or API error — skip, let polling handle it
        }
      }

      if (anyUpdated) {
        const updatedDef = recomputeStats({
          ...sync.definition!,
          documents: updatedDocuments,
        });
        sync.saveDefinition(updatedDef).catch((err) => {
          console.error('[useDataCatalog] Status refresh save failed:', err);
        });
      }

      // Resume polling for docs still processing after refresh
      const stillProcessing = updatedDocuments.filter(
        d => d.processingStatus !== 'success' && d.processingStatus !== 'failed' && d.intuigenceFileId
      );
      for (const doc of stillProcessing) {
        processing.resumePolling(doc.intuigenceFileId!, doc.id, doc.fileName);
      }
    })();
  }, [sync.definition, apiClient, authReady, sync, processing]);

  const ingestFromOneLake = useCallback((files: OneLakeFileSelection[], docType?: string) => {
    processing.ingestFromOneLake(files, docType);
  }, [processing]);

  const removeDocument = useCallback(async (id: string) => {
    if (!sync.definition) return;

    const doc = sync.definition.documents.find(d => d.id === id);
    const updatedDef = recomputeStats({
      ...sync.definition,
      documents: sync.definition.documents.filter(d => d.id !== id),
    });

    await sync.saveDefinition(updatedDef);

    // Optionally delete from backend
    if (doc?.intuigenceDocumentId && apiClient) {
      apiClient.deleteDocument(doc.intuigenceDocumentId).catch((err) => {
        console.error('[useDataCatalog] Backend delete failed:', err);
      });
    }
  }, [sync, apiClient]);

  const save = useCallback(async () => {
    if (!sync.definition) return;
    const updated = recomputeStats(sync.definition);
    await sync.saveDefinition(updated);
  }, [sync]);

  return {
    definition: sync.definition,
    loading: sync.loading,
    error: sync.error,
    saving: sync.saving,
    authReady,
    ingestFromOneLake,
    removeDocument,
    activeFiles: processing.activeFiles,
    removeActiveFile: processing.removeFile,
    clearCompletedFiles: processing.clearCompleted,
    selectedDocumentId,
    setSelectedDocumentId,
    save,
    workspaceId: sync.workspaceId,
    apiClient,
    workloadClient,
  };
}
