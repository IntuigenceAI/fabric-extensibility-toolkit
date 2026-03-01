import React from 'react';
import { IntelligentBoardDefinition, CatalogRef } from './IntelligentBoardDefinition';
import { IntuigenceAPIClient } from '../../clients/IntuigenceAPIClient';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';

export interface IntelligentBoardContextValue {
  definition: IntelligentBoardDefinition | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
  authReady: boolean;
  authError: string | null;

  // Catalog management
  addCatalogRef: (ref: CatalogRef) => void;
  removeCatalogRef: (catalogItemId: string) => void;

  // Persistence
  save: () => Promise<void>;
  resetBoardId: () => Promise<void>;

  // Board iframe save coordination (set by BoardView via ref)
  boardSaveRef: React.MutableRefObject<(() => void) | null>;

  // Document scoping — IntuigenceAI document IDs from connected DataCatalog(s)
  catalogDocumentIds: string[];

  // Context
  workspaceId: string;         // Fabric workspace ID
  boardId: string | null;      // IntuigenceAI workspace (board) ID
  apiClient: IntuigenceAPIClient | null;
  workloadClient: WorkloadClientAPI;
}

export const IntelligentBoardContext = React.createContext<IntelligentBoardContextValue | null>(null);

export function useIntelligentBoardContext(): IntelligentBoardContextValue {
  const context = React.useContext(IntelligentBoardContext);
  if (!context) {
    throw new Error('useIntelligentBoardContext must be used within an IntelligentBoardContext.Provider');
  }
  return context;
}
