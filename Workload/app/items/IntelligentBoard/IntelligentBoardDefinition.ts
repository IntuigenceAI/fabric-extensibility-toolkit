export interface CatalogRef {
  catalogItemId: string;
  catalogWorkspaceId: string;
  catalogDisplayName: string;
}

export interface IntelligentBoardDefinition {
  schemaVersion: '1.0';
  name: string;
  description: string;
  dataCatalogRefs: CatalogRef[];
  intuigenceMapping: {
    tenantId: string | null;
    workspaceId: string | null; // IntuigenceAI workspace (= board) ID
  };
}

export function createEmptyBoardDefinition(name: string): IntelligentBoardDefinition {
  return {
    schemaVersion: '1.0',
    name,
    description: '',
    dataCatalogRefs: [],
    intuigenceMapping: {
      tenantId: null,
      workspaceId: null,
    },
  };
}
