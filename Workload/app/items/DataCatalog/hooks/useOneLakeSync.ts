import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { OneLakeStorageClient } from '../../../clients/OneLakeStorageClient';
import { DataCatalogDefinition, createEmptyDefinition } from '../DataCatalogDefinition';

const DEFINITION_PATH = 'Files/.metadata/definition.json';

export interface UseOneLakeSyncResult {
  definition: DataCatalogDefinition | null;
  loading: boolean;
  error: string | null;
  workspaceId: string;
  itemObjectId: string;
  saveDefinition: (def: DataCatalogDefinition) => Promise<void>;
  saving: boolean;
}

export function useOneLakeSync(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined
): UseOneLakeSyncResult {
  const [definition, setDefinition] = useState<DataCatalogDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState('');
  const storageClientRef = useRef<OneLakeStorageClient | null>(null);
  const resolvedItemId = itemObjectId || '';

  // Synchronous state reset when itemObjectId changes (runs during render, before effects).
  // This prevents child components (ItemEditor) from seeing stale definition data
  // from the previous item when their effects fire before this hook's effects.
  const prevItemIdRef = useRef(itemObjectId);
  if (itemObjectId !== prevItemIdRef.current) {
    prevItemIdRef.current = itemObjectId;
    setDefinition(null);
    setLoading(true);
    setError(null);
    setWorkspaceId('');
  }

  useEffect(() => {

    if (!itemObjectId) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;

    async function load() {
      try {
        // Resolve workspace ID from the item
        const result = await workloadClient.itemCrud.getItem({ itemId: itemObjectId! });
        const wsId = result?.item?.workspaceId || '';
        if (cancelled) return;
        setWorkspaceId(wsId);

        const storageClient = new OneLakeStorageClient(workloadClient);
        storageClientRef.current = storageClient;

        const filePath = OneLakeStorageClient.getPath(wsId, itemObjectId!, DEFINITION_PATH);
        const exists = await storageClient.checkIfFileExists(filePath);

        if (cancelled) return;

        if (exists) {
          const content = await storageClient.readFileAsText(filePath);
          if (cancelled) return;
          if (content) {
            const parsed = JSON.parse(content) as DataCatalogDefinition;
            setDefinition(parsed);
          } else {
            const itemName = result?.item?.displayName || 'Knowledge Graph';
            setDefinition(createEmptyDefinition(itemName));
          }
        } else {
          const itemName = result?.item?.displayName || 'Knowledge Graph';
          setDefinition(createEmptyDefinition(itemName));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[useOneLakeSync] Failed to load definition:', err);
          setError(err.message || 'Failed to load definition');
          // Create empty definition as fallback
          setDefinition(createEmptyDefinition('Knowledge Graph'));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workloadClient, itemObjectId]);

  const saveDefinition = useCallback(async (def: DataCatalogDefinition) => {
    if (!workspaceId || !resolvedItemId) return;

    // Optimistic update: reflect changes in UI immediately
    setDefinition(def);

    setSaving(true);
    try {
      const storageClient = storageClientRef.current || new OneLakeStorageClient(workloadClient);
      const filePath = OneLakeStorageClient.getPath(workspaceId, resolvedItemId, DEFINITION_PATH);
      const content = JSON.stringify(def, null, 2);
      await storageClient.writeFileAsText(filePath, content);
    } catch (err: any) {
      console.error('[useOneLakeSync] Failed to save definition:', err);
      setError(err.message || 'Failed to save definition');
      throw err;
    } finally {
      setSaving(false);
    }
  }, [workloadClient, workspaceId, resolvedItemId]);

  return {
    definition,
    loading,
    error,
    workspaceId,
    itemObjectId: resolvedItemId,
    saveDefinition,
    saving,
  };
}
