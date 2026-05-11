import { AccessToken, WorkloadClientAPI } from '@ms-fabric/workload-client';
import { getEventhouseItem } from '../../../samples/views/SampleEventhouseExplorer/SampleEventhouseController';

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
// Token acquisition — consent-aware, single-resource scope
// -------------------------------------------------------------------------

/**
 * Detect whether an error is an Azure AD consent-required error.
 * AADSTS65001: The user or administrator has not consented to use the application.
 */
function isConsentError(error: unknown): boolean {
  if (!error) return false;
  const msg = String((error as Record<string, unknown>)?.message ?? error);
  return msg.includes('AADSTS65001') || msg.includes('consent_required');
}

/**
 * Acquire a frontend access token for a Kusto cluster scope.
 *
 * If `acquireFrontendAccessToken` fails with a consent error
 * (AADSTS65001), we first trigger consent via `acquireAccessToken` with
 * `additionalScopesToConsent`, then retry the original call.  This lets
 * the Fabric host pop its consent UI so the user can grant the workload
 * access to the Kusto resource.
 */
async function acquireKustoToken(
  workloadClient: WorkloadClientAPI,
  scope: string,
): Promise<AccessToken> {
  const scopes = [scope];

  try {
    return await workloadClient.auth.acquireFrontendAccessToken({ scopes });
  } catch (firstErr: unknown) {
    if (!isConsentError(firstErr)) {
      throw firstErr;
    }

    console.log('[eventhouseUtils] Consent required for Kusto scope — triggering consent flow');

    // Trigger consent via acquireAccessToken. The returned token targets the
    // workload's own audience, not Kusto, but the consent prompt covers the
    // additionalScopesToConsent resources as well.
    await workloadClient.auth.acquireAccessToken({
      additionalScopesToConsent: scopes,
    });

    // Retry — consent should now be granted.
    return await workloadClient.auth.acquireFrontendAccessToken({ scopes });
  }
}

// -------------------------------------------------------------------------
// KQL execution — single-resource scope to avoid AADSTS28000
// -------------------------------------------------------------------------

/**
 * Execute a KQL query against an EventHouse cluster.
 *
 * Unlike the sample `executeQuery` which requests tokens for both
 * `api.fabric.microsoft.com` AND the Kusto cluster (two resources in one
 * token request — rejected by Azure AD with AADSTS28000), this function
 * only requests a token scoped to the Kusto cluster.
 *
 * If consent has not been granted for the Kusto resource, it triggers the
 * Fabric consent flow automatically (handles AADSTS65001).
 */
/**
 * Send a request to a Kusto REST endpoint.
 *
 * @param endpoint  'mgmt' for management commands (.show …) or 'query' for data queries
 */
async function executeKql(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
  kql: string,
  endpoint: 'mgmt' | 'query',
): Promise<unknown> {
  const scope = `${queryServiceUri}/.default`;
  const accessToken: AccessToken = await acquireKustoToken(workloadClient, scope);

  const response = await fetch(`${queryServiceUri}/v1/rest/${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ db: databaseName, csl: kql }),
  });

  if (!response.ok) {
    const errorMessage = await response.text();
    console.error(`[eventhouseUtils] KQL ${endpoint} failed: ${errorMessage}`);
    throw new Error(`Kusto ${endpoint} failed (${response.status}): ${errorMessage}`);
  }

  return await response.json();
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
  const result = await executeKql(
    workloadClient,
    queryServiceUri,
    databaseName,
    '.show tables',
    'mgmt',
  );

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
  const result = await executeKql(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}'] | count`,
    'query',
  );

  const dataTable = findDataTable(result);
  if (!dataTable) return 0;

  const rows = getRows(dataTable);
  return rows.length > 0 ? Number(rows[0][0]) || 0 : 0;
}

/**
 * Query data from a table with an optional row limit.
 *
 * Defaults to 500,000 rows — Kusto's `truncationmaxrecords` default. For very
 * wide rows the 64 MB byte cap may still truncate below this. Rows are sorted
 * by `ingestion_time()` desc so that when truncation happens, the most-recent
 * data is preserved. This makes each refresh deterministic and biased toward
 * fresh data, which is the right semantics for timeseries.
 */
export async function queryTableData(
  workloadClient: WorkloadClientAPI,
  queryServiceUri: string,
  databaseName: string,
  tableName: string,
  limit = 500_000,
): Promise<unknown> {
  return executeKql(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}'] | sort by ingestion_time() desc | take ${limit}`,
    'query',
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
): Promise<unknown> {
  return executeKql(
    workloadClient,
    queryServiceUri,
    databaseName,
    `['${escapeKqlIdentifier(tableName)}'] | take ${limit}`,
    'query',
  );
}

// -------------------------------------------------------------------------
// Result parsing helpers
// -------------------------------------------------------------------------

/**
 * Extract preview rows from a KQL result for display.
 */
export function kqlResultToPreviewRows(kqlResult: unknown, limit = 10): KqlPreviewResult {
  if (!kqlResult) return { columns: [], rows: [] };

  const dataTable = findDataTable(kqlResult);
  if (!dataTable) return { columns: [], rows: [] };

  const columns = getColumnNames(dataTable);
  const allRows = getRows(dataTable);
  const rows = allRows.slice(0, limit)
    .filter(row => Array.isArray(row))
    .map(row =>
      row.map(cell => {
        if (cell == null) return '';
        if (typeof cell === 'object') return JSON.stringify(cell);
        return String(cell);
      })
    );

  return { columns, rows };
}

/**
 * Convert a KQL query result to a CSV string.
 */
export function kqlResultToCsvString(kqlResult: unknown): string {
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
    if (!Array.isArray(row)) continue;
    const fields = row.map(cell => {
      if (cell == null) return '';
      if (typeof cell === 'object') return escapeCsvField(JSON.stringify(cell));
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

function findDataTable(result: unknown): KqlDataTable | null {
  if (!result) return null;

  // Format 1: { Tables: [{ Columns, Rows }, ...] }  (v1/rest/mgmt response)
  const asObj = result as Record<string, unknown>;
  if (Array.isArray(asObj.Tables)) {
    for (const table of asObj.Tables) {
      const t = table as Record<string, unknown>;
      const cols = t.Columns as KqlDataTable['Columns'];
      const rows = t.Rows as KqlDataTable['Rows'];
      if (cols && rows) {
        return { Columns: cols, Rows: rows };
      }
    }
  }

  // Format 2: Array of frames with FrameType (v2 response)
  if (Array.isArray(result)) {
    for (const frame of result) {
      const f = frame as Record<string, unknown>;
      if (f.FrameType === 'DataTable' || f.FrameType === 'dataTable') {
        const cols = f.Columns as KqlDataTable['Columns'];
        const rows = f.Rows as KqlDataTable['Rows'];
        if (cols && rows) {
          return { Columns: cols, Rows: rows };
        }
      }
    }

    // Fallback: first element with Columns + Rows
    if (result.length > 0) {
      const first = result[0] as Record<string, unknown>;
      if (first.Columns && first.Rows) {
        return first as unknown as KqlDataTable;
      }
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
