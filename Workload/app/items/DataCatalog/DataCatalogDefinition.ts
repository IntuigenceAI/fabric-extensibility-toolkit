export type DataSourceType = 'onelake' | 'upload' | 'sample';
export type DocumentProcessingStatus = 'processing' | 'success' | 'failed';
export type CatalogDocumentType = 'document' | 'pnid';

export interface CatalogDocumentEntry {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sourceType: DataSourceType;
  onelakeSourcePath?: string;
  sourceLakehouseId?: string;
  processingStatus: DocumentProcessingStatus;
  documentType?: CatalogDocumentType;
  intuigenceDocumentId: string | null;
  intuigenceFileId: string | null;
  intuigenceGraphId?: string | null;
  errorMessage: string | null;
  lastUpdated: string;
  createdAt: string;
  addedBy: string;
}

export interface DataCatalogDefinition {
  schemaVersion: '1.0';
  name: string;
  description: string;
  config: {
    autoProcess: boolean;
    defaultDocumentType: string;
  };
  documents: CatalogDocumentEntry[];
  stats: {
    totalDocuments: number;
    successDocuments: number;
    failedDocuments: number;
    totalSizeBytes: number;
  };
  intuigenceMapping: {
    tenantId: string | null;
    workspaceId: string | null;
  };
}

export function createEmptyDefinition(name: string): DataCatalogDefinition {
  return {
    schemaVersion: '1.0',
    name,
    description: '',
    config: {
      autoProcess: true,
      defaultDocumentType: 'document',
    },
    documents: [],
    stats: {
      totalDocuments: 0,
      successDocuments: 0,
      failedDocuments: 0,
      totalSizeBytes: 0,
    },
    intuigenceMapping: {
      tenantId: null,
      workspaceId: null,
    },
  };
}

export function recomputeStats(def: DataCatalogDefinition): DataCatalogDefinition {
  const docs = def.documents;
  return {
    ...def,
    stats: {
      totalDocuments: docs.length,
      successDocuments: docs.filter(d => d.processingStatus === 'success').length,
      failedDocuments: docs.filter(d => d.processingStatus === 'failed').length,
      totalSizeBytes: docs.reduce((sum, d) => sum + d.sizeBytes, 0),
    },
  };
}
