import React, { useState, useCallback } from 'react';
import {
  Button,
  Combobox,
  Option,
  Text,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  Database24Regular,
  Table24Regular,
  ArrowSync20Regular,
} from '@fluentui/react-icons';
import { ExtendedItemTypeV2, WorkloadClientAPI } from '@ms-fabric/workload-client';
import { callDatahubOpen } from '../../../controller/DataHubController';
import {
  getEventhouseItem,
  getTableList,
  getTableRowCount,
  queryTablePreview,
  kqlResultToPreviewRows,
  type TableInfo,
  type KqlPreviewResult,
} from '../utils/eventhouseUtils';
import type { EventHouseSourceConfig } from '../DataCatalogDefinition';

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: tokens.shadow28,
    width: '640px',
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('20px', '24px', '0'),
  },
  body: {
    ...shorthands.padding('16px', '24px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    overflowY: 'auto',
    flexGrow: 1,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('6px'),
  },
  label: {
    fontWeight: tokens.fontWeightSemibold,
  },
  combobox: {
    width: '100%',
  },
  previewTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: tokens.fontSizeBase200,
  },
  previewWrapper: {
    maxHeight: '200px',
    overflowY: 'auto',
    overflowX: 'auto',
    ...shorthands.border(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  th: {
    ...shorthands.padding('6px', '8px'),
    textAlign: 'left',
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  td: {
    ...shorthands.padding('4px', '8px'),
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke3),
    whiteSpace: 'nowrap',
    maxWidth: '200px',
    overflowX: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    ...shorthands.padding('16px', '24px'),
    ...shorthands.borderTop(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    display: 'flex',
    justifyContent: 'flex-end',
    ...shorthands.gap('8px'),
  },
  selectedInfo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('8px', '12px'),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
});

type PartialConfig = Omit<EventHouseSourceConfig, 'lakehouseWorkspaceId' | 'lakehouseItemId' | 'lastSyncedAt'>;

interface EventHousePickerDialogProps {
  workloadClient: WorkloadClientAPI;
  onConnect: (config: PartialConfig) => void;
  onCancel: () => void;
}

export function EventHousePickerDialog({
  workloadClient,
  onConnect,
  onCancel,
}: EventHousePickerDialogProps) {
  const styles = useStyles();

  // EventHouse selection state
  const [eventhouse, setEventhouse] = useState<{ id: string; name: string; workspaceId: string } | null>(null);
  const [queryServiceUri, setQueryServiceUri] = useState('');
  const [databaseIds, setDatabaseIds] = useState<string[]>([]);

  // Database selection
  const [selectedDbId, setSelectedDbId] = useState('');
  const [selectedDbName, setSelectedDbName] = useState('');

  // Table selection
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [tablesLoading, setTablesLoading] = useState(false);

  // Preview
  const [preview, setPreview] = useState<KqlPreviewResult | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // General
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePickEventhouse = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callDatahubOpen(
        workloadClient,
        ['KustoEventHouse' as ExtendedItemTypeV2],
        'Select an EventHouse',
        false,
      );
      if (!result) {
        setLoading(false);
        return;
      }

      setEventhouse({ id: result.id, name: result.displayName, workspaceId: result.workspaceId });

      // Fetch metadata
      const metadata = await getEventhouseItem(workloadClient, result.workspaceId, result.id);
      if (!metadata?.properties) {
        setError('Failed to get EventHouse metadata');
        setLoading(false);
        return;
      }

      setQueryServiceUri(metadata.properties.queryServiceUri);
      setDatabaseIds(metadata.properties.databasesItemIds || []);

      // Auto-select if only one database
      if (metadata.properties.databasesItemIds?.length === 1) {
        const dbId = metadata.properties.databasesItemIds[0];
        setSelectedDbId(dbId);
        setSelectedDbName(dbId);
        // Auto-load tables
        await loadTables(metadata.properties.queryServiceUri, dbId);
      }

      // Reset downstream selections
      setSelectedTable('');
      setPreview(null);
      setRowCount(null);
    } catch (err: any) {
      setError(err.message || 'Failed to select EventHouse');
    } finally {
      setLoading(false);
    }
  }, [workloadClient]);

  const loadTables = useCallback(async (uri: string, dbName: string) => {
    setTablesLoading(true);
    setError(null);
    try {
      const tableList = await getTableList(workloadClient, uri, dbName);
      setTables(tableList);
      if (tableList.length === 1) {
        setSelectedTable(tableList[0].tableName);
        await loadPreview(uri, dbName, tableList[0].tableName);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load tables');
    } finally {
      setTablesLoading(false);
    }
  }, [workloadClient]);

  const loadPreview = useCallback(async (uri: string, dbName: string, tableName: string) => {
    setPreviewLoading(true);
    setError(null);
    try {
      const [previewResult, count] = await Promise.all([
        queryTablePreview(workloadClient, uri, dbName, tableName, 10),
        getTableRowCount(workloadClient, uri, dbName, tableName),
      ]);
      setPreview(kqlResultToPreviewRows(previewResult));
      setRowCount(count);
    } catch (err: any) {
      setError(err.message || 'Failed to load preview');
    } finally {
      setPreviewLoading(false);
    }
  }, [workloadClient]);

  const handleDatabaseSelect = useCallback(async (_: unknown, data: { optionValue?: string }) => {
    const dbId = data.optionValue || '';
    setSelectedDbId(dbId);
    setSelectedDbName(dbId);
    setSelectedTable('');
    setPreview(null);
    setRowCount(null);
    if (dbId && queryServiceUri) {
      await loadTables(queryServiceUri, dbId);
    }
  }, [queryServiceUri, loadTables]);

  const handleTableSelect = useCallback(async (_: unknown, data: { optionValue?: string }) => {
    const table = data.optionValue || '';
    setSelectedTable(table);
    setPreview(null);
    setRowCount(null);
    if (table && queryServiceUri && selectedDbName) {
      await loadPreview(queryServiceUri, selectedDbName, table);
    }
  }, [queryServiceUri, selectedDbName, loadPreview]);

  const handleConnect = useCallback(() => {
    if (!eventhouse || !selectedDbId || !selectedTable || !queryServiceUri) return;
    onConnect({
      eventhouseId: eventhouse.id,
      eventhouseName: eventhouse.name,
      workspaceId: eventhouse.workspaceId,
      databaseId: selectedDbId,
      databaseName: selectedDbName,
      tableName: selectedTable,
      queryServiceUri,
    });
  }, [eventhouse, selectedDbId, selectedDbName, selectedTable, queryServiceUri, onConnect]);

  const canConnect = eventhouse && selectedDbId && selectedTable && !loading && !previewLoading;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <Text size={500} weight="semibold">Connect to EventHouse</Text>
          <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onCancel} aria-label="Close" />
        </div>

        {/* Body */}
        <div className={styles.body}>
          <Text style={{ color: tokens.colorNeutralForeground2 }}>
            Select an EventHouse, database, and table to ingest timeseries data.
          </Text>

          {error && (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          )}

          {/* Step 1: EventHouse */}
          <div className={styles.fieldGroup}>
            <Text className={styles.label}>EventHouse</Text>
            {eventhouse ? (
              <div className={styles.selectedInfo}>
                <Database24Regular />
                <Text>{eventhouse.name}</Text>
                <Button appearance="subtle" size="small" icon={<ArrowSync20Regular />} onClick={handlePickEventhouse}>
                  Change
                </Button>
              </div>
            ) : (
              <Button appearance="primary" onClick={handlePickEventhouse} disabled={loading}>
                {loading ? <><Spinner size="tiny" /> Selecting...</> : 'Select EventHouse'}
              </Button>
            )}
          </div>

          {/* Step 2: Database */}
          {databaseIds.length > 0 && (
            <div className={styles.fieldGroup}>
              <Text className={styles.label}>Database</Text>
              <Combobox
                className={styles.combobox}
                value={selectedDbId}
                onOptionSelect={handleDatabaseSelect}
                selectedOptions={selectedDbId ? [selectedDbId] : []}
                placeholder="Select a database..."
              >
                {databaseIds.map(dbId => (
                  <Option key={dbId} value={dbId} text={dbId}>{dbId}</Option>
                ))}
              </Combobox>
            </div>
          )}

          {/* Step 3: Table */}
          {selectedDbId && (
            <div className={styles.fieldGroup}>
              <Text className={styles.label}>Table</Text>
              {tablesLoading ? (
                <Spinner size="small" label="Loading tables..." />
              ) : (
                <Combobox
                  className={styles.combobox}
                  value={selectedTable}
                  onOptionSelect={handleTableSelect}
                  selectedOptions={selectedTable ? [selectedTable] : []}
                  placeholder="Select a table..."
                >
                  {tables.map(t => (
                    <Option key={t.tableName} value={t.tableName} text={t.tableName}>
                      <Table24Regular style={{ marginRight: 4, verticalAlign: 'middle' }} />
                      {t.tableName}
                    </Option>
                  ))}
                </Combobox>
              )}
            </div>
          )}

          {/* Step 4: Preview */}
          {previewLoading && <Spinner size="small" label="Loading preview..." />}

          {preview && !previewLoading && (
            <div className={styles.fieldGroup}>
              <Text className={styles.label}>
                Preview {rowCount != null && `(${rowCount.toLocaleString()} rows)`}
              </Text>
              {rowCount != null && rowCount > 5_000_000 && (
                <MessageBar intent="warning">
                  <MessageBarBody>
                    This table has over 5 million rows. Ingestion may take significant time and memory.
                  </MessageBarBody>
                </MessageBar>
              )}
              <div className={styles.previewWrapper}>
                <table className={styles.previewTable}>
                  <thead>
                    <tr>
                      {preview.columns.map((col, i) => (
                        <th key={i} className={styles.th}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className={styles.td}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button appearance="secondary" onClick={onCancel}>Cancel</Button>
          <Button appearance="primary" onClick={handleConnect} disabled={!canConnect}>
            Connect
          </Button>
        </div>
      </div>
    </div>
  );
}
