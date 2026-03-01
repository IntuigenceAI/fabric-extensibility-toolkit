import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { OneLakeStorageClient } from '../../clients/OneLakeStorageClient';

const DEFINITION_PATH = 'Files/.metadata/definition.json';

export interface UseOneLakeSyncResult<T> {
  definition: T | null;
  loading: boolean;
  error: string | null;
  workspaceId: string;
  itemObjectId: string;
  saveDefinition: (def: T) => Promise<void>;
  saving: boolean;
}

/**
 * Generic hook for syncing an item definition to OneLake.
 *
 * Reads/writes a JSON definition at `Files/.metadata/definition.json` within
 * the item's OneLake folder. Used by both DataCatalog and IntelligentBoard.
 *
 * @param workloadClient  Fabric workload client
 * @param itemObjectId    Current item ID from route params
 * @param createEmpty     Factory to create an empty definition when none exists
 * @param defaultName     Fallback display name when item metadata is unavailable
 */
export function useOneLakeSync<T>(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined,
  createEmpty: (name: string) => T,
  defaultName = 'Untitled',
): UseOneLakeSyncResult<T> {
  const [definition, setDefinition] = useState<T | null>(null);
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
            const parsed = JSON.parse(content) as T;
            setDefinition(parsed);
          } else {
            const itemName = result?.item?.displayName || defaultName;
            setDefinition(createEmpty(itemName));
          }
        } else {
          const itemName = result?.item?.displayName || defaultName;
          setDefinition(createEmpty(itemName));
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('[useOneLakeSync] Failed to load definition:', err);
          setError(err.message || 'Failed to load definition');
          // Create empty definition as fallback
          setDefinition(createEmpty(defaultName));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [workloadClient, itemObjectId, createEmpty, defaultName]);

  // Serialize saves to prevent concurrent OneLake writes (HTTP 400)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const saveDefinition = useCallback(async (def: T) => {
    if (!workspaceId || !resolvedItemId) return;

    // Optimistic update: reflect changes in UI immediately
    setDefinition(def);

    const doSave = async () => {
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
    };

    // Chain onto previous save to avoid concurrent writes
    const queued = saveQueueRef.current.then(doSave, doSave);
    saveQueueRef.current = queued.catch(() => {});
    return queued;
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
