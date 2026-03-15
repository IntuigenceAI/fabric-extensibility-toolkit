import React from 'react';
import { DataCatalogDefinition } from './DataCatalogDefinition';
import { ProcessingFile } from './hooks/useDocumentProcessing';
import { IntuigenceAPIClient } from '../../clients/IntuigenceAPIClient';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';

export interface OneLakeFileSelection {
  itemId: string;
  workspaceId: string;
  selectedPath: string;
  fileName: string;
}

export interface DataCatalogContextValue {
  definition: DataCatalogDefinition | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  authReady: boolean;

  // Document management
  ingestFromOneLake: (files: OneLakeFileSelection[], docType?: string) => void;
  seedSampleData: () => Promise<number>;
  removeDocument: (ids: string[]) => Promise<void>;
  activeFiles: ProcessingFile[];
  removeActiveFile: (localId: string) => void;
  clearCompletedFiles: () => void;

  // Navigation
  selectedDocumentId: string | null;
  setSelectedDocumentId: (id: string | null) => void;

  // Persistence
  save: () => Promise<void>;

  // Context
  workspaceId: string;
  apiClient: IntuigenceAPIClient | null;
  workloadClient: WorkloadClientAPI;
}

export const DataCatalogContext = React.createContext<DataCatalogContextValue | null>(null);

export function useDataCatalogContext(): DataCatalogContextValue {
  const context = React.useContext(DataCatalogContext);
  if (!context) {
    throw new Error('useDataCatalogContext must be used within a DataCatalogContext.Provider');
  }
  return context;
}
