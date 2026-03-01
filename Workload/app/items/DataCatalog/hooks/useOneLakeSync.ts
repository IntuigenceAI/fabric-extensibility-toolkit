import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { useOneLakeSync as useOneLakeSyncGeneric, UseOneLakeSyncResult } from '../../shared/useOneLakeSync';
import { DataCatalogDefinition, createEmptyDefinition } from '../DataCatalogDefinition';

export type { UseOneLakeSyncResult };

export function useOneLakeSync(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined
): UseOneLakeSyncResult<DataCatalogDefinition> {
  return useOneLakeSyncGeneric<DataCatalogDefinition>(
    workloadClient,
    itemObjectId,
    createEmptyDefinition,
    'Knowledge Graph',
  );
}
