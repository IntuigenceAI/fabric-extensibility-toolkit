import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { IntuigenceAPIClient, SeedSampleSharedResponse } from '../../../clients/IntuigenceAPIClient';
import { CatalogDocumentEntry, CatalogDocumentType, EventHouseSourceConfig, recomputeStats } from '../DataCatalogDefinition';
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
  const [quota, setQuota] = useState<{ used: number; limit: number; remaining: number } | null>(null);
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

  // Fetch quota
  const refreshQuota = useCallback(async () => {
    if (!apiClient) return;
    try {
      const q = await apiClient.getUploadQuota();
      setQuota(q);
    } catch (err) {
      console.error('[useDataCatalog] Failed to fetch quota:', err);
      // Fail-closed: treat unknown quota as full to prevent uploads when quota status is unknown
      setQuota({ used: 0, limit: 0, remaining: 0 });
    }
  }, [apiClient]);

  useEffect(() => {
    if (apiClient && authReady) {
      refreshQuota();
    }
  }, [apiClient, authReady, refreshQuota]);

  // Keep refs to the latest definition and saveDefinition so that
  // handleDocumentReady (called from setInterval callbacks) always reads
  // the current state instead of a stale closure snapshot.
  const definitionRef = useRef(sync.definition);
  useEffect(() => { definitionRef.current = sync.definition; }, [sync.definition]);

  const saveDefinitionRef = useRef(sync.saveDefinition);
  useEffect(() => { saveDefinitionRef.current = sync.saveDefinition; }, [sync.saveDefinition]);

  // Handle document ready callback from processing hook.
  // Uses upsert logic: if an entry with the same intuigenceFileId already exists,
  // update it in place; otherwise append a new entry.
  // Stable callback — uses refs to avoid stale closures in polling intervals.
  const handleDocumentReady = useCallback((entry: CatalogDocumentEntry) => {
    const currentDef = definitionRef.current;
    if (!currentDef) return;

    const existing = currentDef.documents;
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
      ...currentDef,
      documents: updatedDocs,
    });

    // Update the ref synchronously so that concurrent calls (e.g., two
    // polling intervals firing before React re-renders) see each other's
    // changes instead of reading the same stale snapshot.
    definitionRef.current = updatedDef;

    saveDefinitionRef.current(updatedDef).catch((err) => {
      console.error('[useDataCatalog] Auto-save failed:', err);
    });
  }, []);

  const processing = useDocumentProcessing(apiClient, sync.itemObjectId, handleDocumentReady, refreshQuota);

  // One-time status refresh: when the definition loads, check all non-terminal entries
  // against the backend API and update their status. This handles the case where
  // the definition was saved with 'processing' but the backend has since finished.
  const statusRefreshDone = useRef(false);
  const prevItemIdForRefresh = useRef(itemObjectId);
  if (itemObjectId !== prevItemIdForRefresh.current) {
    prevItemIdForRefresh.current = itemObjectId;
    statusRefreshDone.current = false;
  }
  // Cancellation flag for sample-mode polling — flipped on unmount / item change
  // so any in-flight setTimeout chain stops scheduling further calls.
  const sampleStatusCancelled = useRef(false);
  useEffect(() => {
    sampleStatusCancelled.current = false;
    return () => {
      sampleStatusCancelled.current = true;
    };
  }, [itemObjectId]);

  useEffect(() => {
    if (!sync.definition || !apiClient || !authReady || statusRefreshDone.current) return;
    statusRefreshDone.current = true;

    // Docs not yet successful — need status check
    const pendingDocs = sync.definition.documents.filter(
      d => d.processingStatus !== 'success' && d.intuigenceFileId
    );
    // Docs already success but missing file size — need backfill
    const zeroSizeDocs = sync.definition.documents.filter(
      d => d.processingStatus === 'success' && d.sizeBytes === 0 && d.intuigenceFileId
    );

    if (pendingDocs.length === 0 && zeroSizeDocs.length === 0) return;

    // Sample-mode catalogs live under SAMPLE_TENANT_ID, but /api/v1/documents/:id
    // is scoped to the caller's tenant — so getDocument 404s for every sample
    // file. Reconcile via the dedicated sample-status endpoint instead, and
    // skip per-doc polling (which would loop on those same 404s).
    if (sync.definition.isSampleMode) {
      (async () => {
        const applyStatus = (response: SeedSampleSharedResponse) => {
          const currentDef = definitionRef.current;
          if (!currentDef) return;
          const byFileId = new Map(
            response.results.filter((r) => r.fileId).map((r) => [r.fileId!, r] as const),
          );
          const mergedDocs = currentDef.documents.map((d) => {
            if (!d.intuigenceFileId) return d;
            const r = byFileId.get(d.intuigenceFileId);
            if (!r) return d;
            const isReady = r.isIndexed === true || r.status === 'completed' || r.status === 'accepted';
            const isFailed = r.status === 'failed';
            if (isReady) {
              const newSize = Number(r.fileSize);
              return {
                ...d,
                processingStatus: 'success' as const,
                errorMessage: null,
                ...(r.graphId && { intuigenceGraphId: r.graphId }),
                ...(newSize > 0 && { sizeBytes: newSize }),
              };
            }
            if (isFailed) {
              return { ...d, processingStatus: 'failed' as const, errorMessage: 'Processing failed' };
            }
            return d;
          });
          const updatedDef = recomputeStats({ ...currentDef, documents: mergedDocs });
          definitionRef.current = updatedDef;
          saveDefinitionRef.current(updatedDef).catch((err) => {
            console.error('[useDataCatalog] Sample-mode status refresh save failed:', err);
          });
        };

        const poll = async (): Promise<void> => {
          if (sampleStatusCancelled.current) return;
          let response: SeedSampleSharedResponse;
          try {
            response = await apiClient.getSampleStatus();
          } catch (err) {
            console.error('[useDataCatalog] getSampleStatus failed:', err);
            return;
          }
          applyStatus(response);
          if (response.status === 'ready' || sampleStatusCancelled.current) return;
          await new Promise((resolve) => setTimeout(resolve, 3000));
          return poll();
        };

        await poll();
      })();
      return;
    }

    (async () => {
      // Collect changes by doc ID so we can merge into the latest definition
      // at save time, avoiding stale-closure overwrites from concurrent polling.
      const changes = new Map<string, Partial<CatalogDocumentEntry>>();
      const stillProcessingIds: { fileId: string; localId: string; fileName: string; mimeType: string; documentType: CatalogDocumentType }[] = [];

      // --- Backfill file size for completed entries with 0B ---
      // fileId === documentId, so use intuigenceFileId directly.
      for (const doc of zeroSizeDocs) {
        try {
          const docDetails = await apiClient.getDocument(doc.intuigenceFileId!);
          const docFileSize = Number(docDetails.file_size) || 0;
          if (docFileSize > 0) {
            changes.set(doc.id, { sizeBytes: docFileSize });
          }
        } catch {
          // Document not accessible — skip
        }
      }

      // --- Check status for non-success entries ---
      // fileId === documentId, so query the documents table directly.
      for (const doc of pendingDocs) {
        const docId = doc.intuigenceDocumentId || doc.intuigenceFileId!;

        try {
          const docDetails = await apiClient.getDocument(docId);
          if (docDetails.is_indexed === true || docDetails.status === 'success') {
            const props = docDetails.properties as Record<string, unknown> | undefined;
            const graphId = (props?.graph_id as string) || null;
            const docFileSize = Number(docDetails.file_size) || 0;
            changes.set(doc.id, {
              processingStatus: 'success',
              intuigenceDocumentId: docId,
              errorMessage: null,
              ...(graphId && { intuigenceGraphId: graphId }),
              ...(docFileSize > 0 && { sizeBytes: docFileSize }),
            });
          } else if (docDetails.status === 'failed') {
            changes.set(doc.id, {
              processingStatus: 'failed',
              errorMessage: (docDetails.error_message as string) || 'Processing failed',
            });
          } else {
            // Still processing — resume polling
            stillProcessingIds.push({
              fileId: doc.intuigenceFileId!,
              localId: doc.id,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              documentType: doc.documentType,
            });
          }
        } catch {
          // Document not accessible (404 or error) — only resume polling if
          // the entry was still processing. Already-failed entries with no
          // backend record should stay as-is, not poll forever.
          if (doc.processingStatus === 'processing') {
            stillProcessingIds.push({
              fileId: doc.intuigenceFileId!,
              localId: doc.id,
              fileName: doc.fileName,
              mimeType: doc.mimeType,
              documentType: doc.documentType,
            });
          }
        }
      }

      // Merge changes into the latest definition via ref (not the stale closure).
      if (changes.size > 0) {
        const currentDef = definitionRef.current;
        if (currentDef) {
          const mergedDocs = currentDef.documents.map(d => {
            const patch = changes.get(d.id);
            return patch ? { ...d, ...patch } : d;
          });
          const updatedDef = recomputeStats({ ...currentDef, documents: mergedDocs });
          definitionRef.current = updatedDef;
          saveDefinitionRef.current(updatedDef).catch((err) => {
            console.error('[useDataCatalog] Status refresh save failed:', err);
          });
        }
      }

      // Resume polling for docs still processing after refresh
      for (const doc of stillProcessingIds) {
        processing.resumePolling(doc.fileId, doc.localId, doc.fileName, doc.mimeType, doc.documentType);
      }
    })();
  }, [sync.definition, apiClient, authReady, processing]);

  const ingestFromOneLake = useCallback((files: OneLakeFileSelection[], docType?: string) => {
    processing.ingestFromOneLake(files, docType);
  }, [processing]);

  const ingestFromEventHouse = useCallback((config: EventHouseSourceConfig) => {
    // Persist the EventHouse source config + lastFullRefreshAt only after the OneLake
    // ingest endpoint accepts the staged CSV — a failure earlier in the pipeline
    // (KQL query, CSV write, ingest rejection) leaves the timestamp untouched.
    processing.ingestFromEventHouse(config, workloadClient, () => {
      const currentDef = definitionRef.current;
      if (!currentDef) return;
      const updatedDef = {
        ...currentDef,
        eventhouseSource: { ...config, lastFullRefreshAt: new Date().toISOString() },
      };
      definitionRef.current = updatedDef;
      saveDefinitionRef.current(updatedDef).catch((err) => {
        console.error('[useDataCatalog] Failed to save EventHouse config:', err);
      });
    });
  }, [processing, workloadClient]);

  const syncEventHouse = useCallback(async () => {
    const currentDef = definitionRef.current;
    if (!currentDef?.eventhouseSource) return;

    // Guard against firing a sync while a prior EventHouse ingest (initial
    // connect or another sync) is still uploading/processing. Both flows write
    // the same `.eventhouse-staging/<table>.csv` staging path, so a race here
    // would mean two pipelines competing for the same file.
    const inFlight = processing.activeFiles.some(
      f => f.sourceType === 'eventhouse' && (f.status === 'uploading' || f.status === 'processing'),
    );
    if (inFlight) {
      throw new Error('An EventHouse sync is already in progress.');
    }

    const config = currentDef.eventhouseSource;
    // Same pattern as ingestFromEventHouse: only bump lastFullRefreshAt once the
    // OneLake ingest is accepted.
    processing.ingestFromEventHouse(config, workloadClient, () => {
      const latestDef = definitionRef.current;
      if (!latestDef) return;
      const updatedDef = {
        ...latestDef,
        eventhouseSource: { ...config, lastFullRefreshAt: new Date().toISOString() },
      };
      definitionRef.current = updatedDef;
      saveDefinitionRef.current(updatedDef).catch((err) => {
        console.error('[useDataCatalog] Failed to update sync timestamp:', err);
      });
    });
  }, [processing, workloadClient]);

  // Populate definition.documents from a shared sample response whose files are all ready
  const populateSampleDocs = useCallback((response: SeedSampleSharedResponse) => {
    const currentDef = definitionRef.current;
    if (!currentDef) return;

    const now = new Date().toISOString();
    const sampleDocs: CatalogDocumentEntry[] = response.results
      .filter((r) => r.fileId)
      .map((r): CatalogDocumentEntry => ({
        id: r.fileId!,
        fileName: r.fileName,
        mimeType: r.mimeType || 'application/octet-stream',
        sizeBytes: Number(r.fileSize) > 0 ? Number(r.fileSize) : 0,
        sourceType: 'sample',
        processingStatus: r.isIndexed ? 'success' : 'processing',
        documentType: (r.fileType === 'pnid' ? 'pnid' : r.fileType === 'timeseries' ? 'timeseries' : 'document') as CatalogDocumentType,
        intuigenceDocumentId: r.fileId!,
        intuigenceFileId: r.fileId!,
        intuigenceGraphId: r.graphId ?? null,
        errorMessage: null,
        lastUpdated: now,
        createdAt: now,
        addedBy: 'Sample Data',
      }));

    // Preserve any non-sample docs the user has already added so a later
    // "Load example data" call doesn't wipe their real uploads.
    const nonSampleDocs = currentDef.documents.filter((d) => d.sourceType !== 'sample');

    const updatedDef = recomputeStats({
      ...currentDef,
      documents: [...nonSampleDocs, ...sampleDocs],
      isSampleMode: true,
      sampleWorkspaceId: response.workspaceId,
    });
    definitionRef.current = updatedDef;
    saveDefinitionRef.current(updatedDef).catch((err) => {
      console.error('[useDataCatalog] Sample mode save failed:', err);
    });
  }, []);

  const seedSampleData = useCallback(async () => {
    if (!apiClient) throw new Error('API client not ready');
    const response = await apiClient.seedSampleDataShared();

    // Write the sample doc rows + isSampleMode into the definition immediately,
    // regardless of whether processing has finished. The list view should
    // render with per-file status right away; the reconcile effect will poll
    // getSampleStatus and flip rows to 'success' as files complete.
    populateSampleDocs(response);
    // Re-arm the reconcile effect so the freshly-seeded sample docs get a
    // sample-status poll. The effect latches statusRefreshDone=true on first
    // run for the mounted item, so without this reset a seed in an already-
    // open empty item leaves any not-yet-indexed row stuck on 'processing'
    // until the item is reloaded.
    statusRefreshDone.current = false;
    return response.results.length;
  }, [apiClient, populateSampleDocs]);

  // Local-only exit. Drops sample doc entries + clears sample-mode markers
  // from this item's saved definition. Shared backend rows under SAMPLE_TENANT_ID
  // are untouched (they belong to every user). The reconcile poll is cancelled
  // so a stale fetch can't write sample rows back after exit.
  const exitSampleMode = useCallback(async () => {
    const currentDef = definitionRef.current;
    if (!currentDef) return;

    sampleStatusCancelled.current = true;
    statusRefreshDone.current = false; // let the effect rerun for non-sample docs

    const nonSampleDocs = currentDef.documents.filter((d) => d.sourceType !== 'sample');
    const updatedDef = recomputeStats({
      ...currentDef,
      documents: nonSampleDocs,
      isSampleMode: false,
      sampleWorkspaceId: undefined,
    });
    definitionRef.current = updatedDef;
    await saveDefinitionRef.current(updatedDef).catch((err) => {
      console.error('[useDataCatalog] Exit sample mode save failed:', err);
    });
  }, []);

  const removeDocument = useCallback(async (ids: string[]) => {
    const currentDef = definitionRef.current;
    if (!currentDef || ids.length === 0) return;

    const idSet = new Set(ids);
    const docs = currentDef.documents.filter(d => idSet.has(d.id));

    // Collect backend IDs for deletion
    const backendIds = docs
      .map(d => d.intuigenceDocumentId || d.intuigenceFileId)
      .filter(Boolean) as string[];

    const hasPnid = docs.some(d => d.documentType === 'pnid');

    // 1. Delete from backend (404 is OK — document may not exist if processing failed)
    if (backendIds.length > 0 && apiClient) {
      try {
        await apiClient.deleteDocuments(backendIds);
      } catch (err: any) {
        const is404 = err?.message?.includes('404');
        if (!is404) throw err;
      }
      if (hasPnid) {
        await apiClient.cleanupOrphanedGraphs().catch((err) => {
          console.error('[useDataCatalog] Orphan graph cleanup failed:', err);
        });
      }
    }

    // 2. Stop polling timers (after backend succeeded, so they stay active on failure)
    for (const id of ids) {
      processing.removeFile(id);
    }

    // 3. Remove from definition.json (re-read ref for latest state after await)
    const latestDef = definitionRef.current;
    if (!latestDef) return;
    const updatedDef = recomputeStats({
      ...latestDef,
      documents: latestDef.documents.filter(d => !idSet.has(d.id)),
    });
    definitionRef.current = updatedDef;
    await saveDefinitionRef.current(updatedDef);

    // Refresh quota after deletion
    refreshQuota();
  }, [apiClient, processing, refreshQuota]);

  const save = useCallback(async () => {
    if (!sync.definition) return;
    const updated = recomputeStats(sync.definition);
    await sync.saveDefinition(updated);
  }, [sync]);

  const isSampleMode = sync.definition?.isSampleMode ?? false;
  const sampleWorkspaceId = sync.definition?.sampleWorkspaceId ?? null;

  return {
    definition: sync.definition,
    loading: sync.loading,
    error: sync.error,
    saving: sync.saving,
    authReady,
    ingestFromOneLake,
    ingestFromEventHouse,
    syncEventHouse,
    seedSampleData,
    exitSampleMode,
    removeDocument,
    activeFiles: processing.activeFiles,
    removeActiveFile: processing.removeFile,
    clearCompletedFiles: processing.clearCompleted,
    isSampleMode,
    sampleWorkspaceId,
    quota,
    refreshQuota,
    selectedDocumentId,
    setSelectedDocumentId,
    save,
    workspaceId: sync.workspaceId,
    apiClient,
    workloadClient,
  };
}
