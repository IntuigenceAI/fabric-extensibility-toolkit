import React, { useState, useCallback } from 'react';
import {
  Button,
  Combobox,
  Option,
  Text,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  RadioGroup,
  Radio,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import { ExtendedItemTypeV2 } from '@ms-fabric/workload-client';
import { callDatahubOpen } from '../../../controller/DataHubController';
import { useDataCatalogContext, OneLakeFileSelection } from '../DataCatalogContext';
import { OneLakeFilePicker } from './OneLakeFilePicker';
import { EventHousePickerDialog } from './EventHousePickerDialog';
import type { EventHouseSourceConfig } from '../DataCatalogDefinition';

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('20px'),
  },
  description: {
    color: tokens.colorNeutralForeground2,
    lineHeight: '20px',
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
  chooseDataRow: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'center',
  },
});

type DataSource = 'onelake' | 'eventhouse';

const DOC_TYPE_OPTIONS = [
  { key: 'document', label: 'Document (pdf, docx, txt)', disabled: false },
  { key: 'pid', label: 'P&ID (pdf, png, jpg)', disabled: false },
  { key: 'timeseries', label: 'Timeseries (csv, xlsx)', disabled: false },
];

const DOC_TYPE_EXTENSIONS: Record<string, string[]> = {
  document: ['pdf', 'docx', 'doc', 'txt'],
  pid: ['pdf', 'png', 'jpg', 'jpeg'],
  timeseries: ['csv', 'xlsx'],
};

interface AddDataDialogProps {
  onClose: () => void;
  onFilesSubmitted: (fileCount: number) => void;
}

export function AddDataDialog({ onClose, onFilesSubmitted }: AddDataDialogProps) {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const [dataSource, setDataSource] = useState<DataSource>('onelake');
  const [selectedDocType, setSelectedDocType] = useState('document');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [lakehouse, setLakehouse] = useState<{ id: string; workspaceId: string; displayName: string } | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showEventHousePicker, setShowEventHousePicker] = useState(false);

  const handleChooseData = useCallback(async () => {
    if (isPickerOpen) return;
    setIsPickerOpen(true);

    try {
      const result = await callDatahubOpen(
        catalog.workloadClient,
        ["Lakehouse" as ExtendedItemTypeV2],
        'Choose a Lakehouse to browse files',
        false,
      );

      if (result) {
        setLakehouse({
          id: result.id,
          workspaceId: result.workspaceId,
          displayName: result.displayName,
        });
        setShowFilePicker(true);
      }
    } catch (err) {
      console.error('[AddDataDialog] DataHub selector error:', err);
    } finally {
      setIsPickerOpen(false);
    }
  }, [catalog, isPickerOpen]);

  const handleFilePickerSelect = useCallback((files: OneLakeFileSelection[]) => {
    setShowFilePicker(false);
    catalog.ingestFromOneLake(files, selectedDocType);
    onFilesSubmitted(files.length);
    onClose();
  }, [catalog, selectedDocType, onFilesSubmitted, onClose]);

  const handleFilePickerCancel = useCallback(() => {
    setShowFilePicker(false);
  }, []);

  const handleEventHouseConnect = useCallback(async (
    config: Omit<EventHouseSourceConfig, 'lakehouseWorkspaceId' | 'lakehouseItemId' | 'lastFullRefreshAt'>
  ) => {
    setShowEventHousePicker(false);

    // User needs to pick a Lakehouse to stage the CSV
    let lh = lakehouse;
    if (!lh) {
      try {
        const result = await callDatahubOpen(
          catalog.workloadClient,
          ["Lakehouse" as ExtendedItemTypeV2],
          'Choose a Lakehouse to store the data',
          false,
        );
        if (!result) return;
        lh = { id: result.id, workspaceId: result.workspaceId, displayName: result.displayName };
        setLakehouse(lh);
      } catch (err) {
        console.error('[AddDataDialog] Lakehouse selector error:', err);
        return;
      }
    }

    const fullConfig: EventHouseSourceConfig = {
      ...config,
      lakehouseWorkspaceId: lh.workspaceId,
      lakehouseItemId: lh.id,
      lastFullRefreshAt: null,
    };

    catalog.ingestFromEventHouse(fullConfig);
    onFilesSubmitted(1);
    onClose();
  }, [catalog, lakehouse, onFilesSubmitted, onClose]);

  const handleEventHouseCancel = useCallback(() => {
    setShowEventHousePicker(false);
  }, []);

  return (
    <>
    <Dialog open={!showFilePicker && !showEventHousePicker} onOpenChange={(_, data) => { if (!data.open) onClose(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Add data</DialogTitle>
          <DialogContent className={styles.content}>
            <Text className={styles.description}>
              Select the type of data you want to prepare for contextualization.
            </Text>

            {/* Data source selector */}
            <div className={styles.fieldGroup}>
              <Text className={styles.label}>Data source</Text>
              <RadioGroup
                value={dataSource}
                onChange={(_, data) => setDataSource(data.value as DataSource)}
              >
                <Radio value="onelake" label="OneLake Files" />
                <Radio value="eventhouse" label="EventHouse (Timeseries)" />
              </RadioGroup>
            </div>

            {/* OneLake flow */}
            {dataSource === 'onelake' && (
              <>
                {/* Document type selector */}
                <div className={styles.fieldGroup}>
                  <Text className={styles.label}>Document type</Text>
                  <Combobox
                    className={styles.combobox}
                    value={DOC_TYPE_OPTIONS.find(o => o.key === selectedDocType)?.label || ''}
                    onOptionSelect={(_, data) => {
                      if (data.optionValue) setSelectedDocType(data.optionValue);
                    }}
                    selectedOptions={[selectedDocType]}
                  >
                    {DOC_TYPE_OPTIONS.map(opt => (
                      <Option key={opt.key} value={opt.key} text={opt.label} disabled={opt.disabled}>
                        {opt.label}
                        {opt.disabled ? ' (Coming soon)' : ''}
                      </Option>
                    ))}
                  </Combobox>
                </div>

                {/* Choose data button */}
                <div className={styles.chooseDataRow}>
                  <Button
                    appearance="primary"
                    onClick={handleChooseData}
                    disabled={isPickerOpen}
                  >
                    {isPickerOpen ? 'Selecting...' : 'Choose data'}
                  </Button>
                  <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                    Browse OneLake to select files
                  </Text>
                </div>
              </>
            )}

            {/* EventHouse flow */}
            {dataSource === 'eventhouse' && (
              <div className={styles.chooseDataRow}>
                <Button
                  appearance="primary"
                  onClick={() => setShowEventHousePicker(true)}
                >
                  Connect to EventHouse
                </Button>
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  Select an EventHouse table to ingest timeseries data
                </Text>
              </div>
            )}
          </DialogContent>

          <DialogActions>
            <Button appearance="secondary" onClick={onClose}>
              Close
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>

    {showFilePicker && lakehouse && (
      <OneLakeFilePicker
        workloadClient={catalog.workloadClient}
        lakehouseId={lakehouse.id}
        lakehouseWorkspaceId={lakehouse.workspaceId}
        lakehouseName={lakehouse.displayName}
        onSelect={handleFilePickerSelect}
        onCancel={handleFilePickerCancel}
        allowedExtensions={DOC_TYPE_EXTENSIONS[selectedDocType]}
        maxFiles={catalog.quota?.remaining ?? undefined}
      />
    )}

    {showEventHousePicker && (
      <EventHousePickerDialog
        workloadClient={catalog.workloadClient}
        onConnect={handleEventHouseConnect}
        onCancel={handleEventHouseCancel}
      />
    )}
    </>
  );
}
