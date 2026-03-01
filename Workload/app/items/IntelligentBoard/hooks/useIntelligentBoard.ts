import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { IntuigenceAPIClient } from '../../../clients/IntuigenceAPIClient';
import { OneLakeStorageClient } from '../../../clients/OneLakeStorageClient';
import { useOneLakeSync } from '../../shared/useOneLakeSync';
import {
  IntelligentBoardDefinition,
  CatalogRef,
  createEmptyBoardDefinition,
} from '../IntelligentBoardDefinition';
import { DataCatalogDefinition } from '../../DataCatalog/DataCatalogDefinition';
import { IntelligentBoardContextValue } from '../IntelligentBoardContext';

export function useIntelligentBoard(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined,
): IntelligentBoardContextValue {
  const sync = useOneLakeSync<IntelligentBoardDefinition>(
    workloadClient,
    itemObjectId,
    createEmptyBoardDefinition,
    'Intelligent Board',
  );

  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const apiClientRef = useRef<IntuigenceAPIClient | null>(null);
  // Track which item we're creating a workspace for (prevents duplicates, survives HMR)
  const creatingForItemRef = useRef<string | null>(null);
  const boardSaveRef = useRef<(() => void) | null>(null);

  // Keep a ref to the latest definition so async operations always read current state
  const definitionRef = useRef(sync.definition);
  definitionRef.current = sync.definition;

  // Destructure stable references from sync to avoid [sync] dependency (new object every render)
  const { definition, saveDefinition, workspaceId: syncWorkspaceId } = sync;

  // Create API client once workspace is resolved
  const apiClient = useMemo(() => {
    if (!syncWorkspaceId) {
      console.log('[useIntelligentBoard] Waiting for workspaceId...');
      return null;
    }
    console.log(`[useIntelligentBoard] Creating API client for workspace: ${syncWorkspaceId}`);
    const client = new IntuigenceAPIClient(workloadClient, syncWorkspaceId);
    apiClientRef.current = client;
    return client;
  }, [workloadClient, syncWorkspaceId]);

  // Initialize auth when API client is ready
  useEffect(() => {
    if (!apiClient || !syncWorkspaceId) return undefined;
    let cancelled = false;

    console.log('[useIntelligentBoard] Initializing auth...');
    apiClient.initialize(syncWorkspaceId)
      .then(() => {
        console.log('[useIntelligentBoard] Auth initialized successfully');
        if (!cancelled) setAuthReady(true);
      })
      .catch((err) => {
        console.error('[useIntelligentBoard] Auth initialization failed:', err);
        if (!cancelled) setAuthError(err?.message || 'Auth initialization failed');
      });

    return () => { cancelled = true; };
  }, [apiClient, syncWorkspaceId]);

  // Auto-create IntuigenceAI workspace (board) when definition loads without one
  const resolvedItemId = sync.itemObjectId;
  useEffect(() => {
    const def = definition;
    const alreadyCreating = creatingForItemRef.current === resolvedItemId;
    console.log('[useIntelligentBoard] Workspace creation check:', {
      hasDef: !!def,
      hasApiClient: !!apiClient,
      authReady,
      existingWsId: def?.intuigenceMapping?.workspaceId,
      alreadyCreating,
      itemId: resolvedItemId,
    });

    if (
      !def ||
      !apiClient ||
      !authReady ||
      !resolvedItemId ||
      def.intuigenceMapping.workspaceId ||
      alreadyCreating
    ) {
      return;
    }

    creatingForItemRef.current = resolvedItemId;
    console.log('[useIntelligentBoard] Creating IntuigenceAI workspace...');

    (async () => {
      try {
        const ws = await apiClient.createWorkspace(def.name || 'Intelligent Board');
        console.log(`[useIntelligentBoard] Workspace created: ${ws.id}`);
        // Use the ref to get the latest definition (may have been updated by addCatalogRef)
        const latestDef = definitionRef.current;
        if (!latestDef) return;
        const updatedDef: IntelligentBoardDefinition = {
          ...latestDef,
          intuigenceMapping: {
            ...latestDef.intuigenceMapping,
            workspaceId: ws.id,
          },
        };
        await saveDefinition(updatedDef);
        console.log(`[useIntelligentBoard] Definition saved with workspace ID: ${ws.id}`);
      } catch (err) {
        console.error('[useIntelligentBoard] Workspace creation failed:', err);
        creatingForItemRef.current = null; // Allow retry
      }
    })();
  }, [definition, apiClient, authReady, resolvedItemId, saveDefinition]);

  const boardId = definition?.intuigenceMapping.workspaceId ?? null;

  // Read connected DataCatalog definitions to extract allowed document IDs.
  // Use a serialized key to avoid re-fetching when definition saves but catalogRefs haven't changed.
  const [catalogDocumentIds, setCatalogDocumentIds] = useState<string[]>([]);
  const catalogRefsKey = useMemo(
    () => JSON.stringify(definition?.dataCatalogRefs ?? []),
    [definition?.dataCatalogRefs],
  );
  const catalogRefs = definition?.dataCatalogRefs;

  useEffect(() => {
    if (!catalogRefs?.length) {
      setCatalogDocumentIds([]);
      return undefined;
    }

    let cancelled = false;
    (async () => {
      const storageClient = new OneLakeStorageClient(workloadClient);
      const allDocIds: string[] = [];

      for (const ref of catalogRefs) {
        try {
          const filePath = OneLakeStorageClient.getPath(
            ref.catalogWorkspaceId,
            ref.catalogItemId,
            'Files/.metadata/definition.json',
          );
          const content = await storageClient.readFileAsText(filePath);
          if (!content) continue; // Empty/missing file — skip
          const catalogDef = JSON.parse(content) as DataCatalogDefinition;

          for (const doc of catalogDef.documents) {
            if (doc.processingStatus === 'success' && doc.intuigenceDocumentId) {
              allDocIds.push(doc.intuigenceDocumentId);
            }
          }
        } catch (err) {
          console.error(`[useIntelligentBoard] Failed to read catalog ${ref.catalogDisplayName}:`, err);
        }
      }

      if (!cancelled) {
        setCatalogDocumentIds(allDocIds);
        console.log(`[useIntelligentBoard] Loaded ${allDocIds.length} document IDs from ${catalogRefs.length} catalog(s)`);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogRefsKey, workloadClient]);

  const addCatalogRef = useCallback((ref: CatalogRef) => {
    const def = definitionRef.current;
    if (!def) return;

    // Avoid duplicates
    const existing = def.dataCatalogRefs;
    if (existing.some(r => r.catalogItemId === ref.catalogItemId)) return;

    const updatedDef: IntelligentBoardDefinition = {
      ...def,
      dataCatalogRefs: [...existing, ref],
    };

    saveDefinition(updatedDef).catch((err) => {
      console.error('[useIntelligentBoard] Failed to save catalog ref:', err);
    });
  }, [saveDefinition]);

  const removeCatalogRef = useCallback((catalogItemId: string) => {
    const def = definitionRef.current;
    if (!def) return;

    const updatedDef: IntelligentBoardDefinition = {
      ...def,
      dataCatalogRefs: def.dataCatalogRefs.filter(
        r => r.catalogItemId !== catalogItemId
      ),
    };

    saveDefinition(updatedDef).catch((err) => {
      console.error('[useIntelligentBoard] Failed to remove catalog ref:', err);
    });
  }, [saveDefinition]);

  const save = useCallback(async () => {
    const def = definitionRef.current;
    if (!def) return;
    await saveDefinition(def);
  }, [saveDefinition]);

  // Clear stale workspace ID when the backend board no longer exists,
  // allowing the auto-creation effect to re-run.
  const resetBoardId = useCallback(async () => {
    const def = definitionRef.current;
    if (!def) return;
    console.log('[useIntelligentBoard] Resetting stale boardId, will re-create workspace...');
    creatingForItemRef.current = null;
    const updatedDef: IntelligentBoardDefinition = {
      ...def,
      intuigenceMapping: {
        ...def.intuigenceMapping,
        workspaceId: null,
      },
    };
    await saveDefinition(updatedDef);
  }, [saveDefinition]);

  return {
    definition,
    loading: sync.loading,
    error: sync.error,
    saving: sync.saving,
    authReady,
    authError,
    addCatalogRef,
    removeCatalogRef,
    save,
    resetBoardId,
    boardSaveRef,
    catalogDocumentIds,
    workspaceId: syncWorkspaceId,
    boardId,
    apiClient,
    workloadClient,
  };
}
