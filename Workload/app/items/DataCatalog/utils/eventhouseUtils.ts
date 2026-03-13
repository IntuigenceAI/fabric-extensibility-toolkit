import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { getEventhouseItem, executeQuery } from '../../../samples/views/SampleEventhouseExplorer/SampleEventhouseController';

// Re-export for convenience
export { getEventhouseItem };

export interface TableInfo {
  tableName: string;
  folder: string;
}

export interface KqlPreviewResult {
  columns: string[];
  rows: string[][];
}

// -------------------------------------------------------------------------
// KQL query helpers
// -------------------------------------------------------------------------

/**
 * List all tables in a KQL database.
 */
export async function getTableList(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
): Promise<TableInfo[]> {
  const result = await executeQuery(
    workloadClient,
    queryServiceUri,
    databaseName,
    '.show tables',
    () => {}, // no-op setClientRequestId
  );
  if (!result) return [];

  const dataTable = findDataTable(result);
  if (!dataTable) return [];

  const cols = getColumnNames(dataTable);
  const nameIdx = cols.indexOf('TableName');
  const folderIdx = cols.indexOf('Folder');
  const rows = getRows(dataTable);

  return rows.map(row => ({
    tableName: String(row[nameIdx >= 0 ? nameIdx : 0] ?? ''),
    folder: folderIdx >= 0 ? String(row[folderIdx] ?? '') : '',
  }));
}

/**
 * Get the row count for a table.
 */
export async function getTableRowCount(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
  tableName: string,
): Promise<number> {
  const result = await executeQuery(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}'] | count`,
    () => {},
  );
  if (!result) return 0;

  const dataTable = findDataTable(result);
  if (!dataTable) return 0;

  const rows = getRows(dataTable);
  return rows.length > 0 ? Number(rows[0][0]) || 0 : 0;
}

/**
 * Query all data from a table.
 */
export async function queryTableData(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
  tableName: string,
): Promise<object[]> {
  return executeQuery(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}']`,
    () => {},
  );
}

/**
 * Query a limited preview of table data.
 */
export async function queryTablePreview(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
  tableName: string,
  limit = 10,
): Promise<object[]> {
  return executeQuery(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}'] | take ${limit}`,
    () => {},
  );
}

// -------------------------------------------------------------------------
// Result parsing helpers
// -------------------------------------------------------------------------

/**
 * Extract preview rows from a KQL result for display.
 */
export function kqlResultToPreviewRows(kqlResult: object[], limit = 10): KqlPreviewResult {
  if (!kqlResult) return { columns: [], rows: [] };

  const dataTable = findDataTable(kqlResult);
  if (!dataTable) return { columns: [], rows: [] };

  const columns = getColumnNames(dataTable);
  const allRows = getRows(dataTable);
  const rows = allRows.slice(0, limit).map(row =>
    row.map(cell => cell == null ? '' : String(cell))
  );

  return { columns, rows };
}

/**
 * Convert a KQL query result to a CSV string.
 */
export function kqlResultToCsvString(kqlResult: object[]): string {
  if (!kqlResult) return '';

  const dataTable = findDataTable(kqlResult);
  if (!dataTable) return '';

  const columns = getColumnNames(dataTable);
  const rows = getRows(dataTable);

  if (columns.length === 0) return '';

  const lines: string[] = [];

  // Header row
  lines.push(columns.map(escapeCsvField).join(','));

  // Data rows
  for (const row of rows) {
    const fields = row.map(cell => {
      if (cell == null) return '';
      return escapeCsvField(String(cell));
    });
    lines.push(fields.join(','));
  }

  return lines.join('\n');
}

// -------------------------------------------------------------------------
// Internal helpers
// -------------------------------------------------------------------------

interface KqlDataTable {
  Columns?: Array<{ ColumnName: string; ColumnType?: string }>;
  Rows?: unknown[][];
}

function findDataTable(result: object[]): KqlDataTable | null {
  if (!Array.isArray(result)) return null;

  // KQL management endpoint returns frames; find the first DataTable with data
  for (const frame of result) {
    const f = frame as Record<string, unknown>;
    if (f.FrameType === 'DataTable' || f.FrameType === 'dataTable') {
      const cols = f.Columns as KqlDataTable['Columns'];
      const rows = f.Rows as KqlDataTable['Rows'];
      if (cols && rows && rows.length > 0) {
        return { Columns: cols, Rows: rows };
      }
    }
  }

  // Fallback: result might be a single table object
  if (result.length > 0) {
    const first = result[0] as Record<string, unknown>;
    if (first.Columns && first.Rows) {
      return first as unknown as KqlDataTable;
    }
  }

  return null;
}

function getColumnNames(table: KqlDataTable): string[] {
  return (table.Columns || []).map(c => c.ColumnName);
}

function getRows(table: KqlDataTable): unknown[][] {
  return table.Rows || [];
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function escapeKqlIdentifier(name: string): string {
  return name.replace(/'/g, "\\'");
}
