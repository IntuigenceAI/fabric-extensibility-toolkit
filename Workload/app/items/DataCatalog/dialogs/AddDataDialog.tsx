import React, { useState, useCallback } from 'react';
import {
  Button,
  Combobox,
  Option,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
} from '@fluentui/react-icons';
import { ExtendedItemTypeV2 } from '@ms-fabric/workload-client';
import { callDatahubOpen } from '../../../controller/DataHubController';
import { useDataCatalogContext, OneLakeFileSelection } from '../DataCatalogContext';
import { OneLakeFilePicker } from './OneLakeFilePicker';

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
    width: '520px',
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
    ...shorthands.gap('20px'),
    overflowY: 'auto',
    flexGrow: 1,
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
  footer: {
    ...shorthands.padding('16px', '24px'),
    ...shorthands.borderTop(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    display: 'flex',
    justifyContent: 'flex-end',
  },
});

const DOC_TYPE_OPTIONS = [
  { key: 'document', label: 'Document (pdf, docx, txt)', disabled: false },
  { key: 'pid', label: 'P&ID (pdf, png, jpg)', disabled: false },
  { key: 'table', label: 'Table (xlsx, csv)', disabled: true },
  { key: 'timeseries', label: 'Timeseries (csv, xlsx)', disabled: true },
];

interface AddDataDialogProps {
  onClose: () => void;
  onFilesSubmitted: (fileCount: number) => void;
}

export function AddDataDialog({ onClose, onFilesSubmitted }: AddDataDialogProps) {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const [selectedDocType, setSelectedDocType] = useState('document');
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [lakehouse, setLakehouse] = useState<{ id: string; workspaceId: string; displayName: string } | null>(null);
  const [showFilePicker, setShowFilePicker] = useState(false);

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

  return (
    <>
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <Text size={500} weight="semibold">Add data</Text>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={onClose}
            aria-label="Close"
          />
        </div>

        {/* Body */}
        <div className={styles.body}>
          <Text className={styles.description}>
            Select the type of data you want to prepare for contextualization.
          </Text>

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
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button appearance="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>

    {showFilePicker && lakehouse && (
      <OneLakeFilePicker
        workloadClient={catalog.workloadClient}
        lakehouseId={lakehouse.id}
        lakehouseWorkspaceId={lakehouse.workspaceId}
        lakehouseName={lakehouse.displayName}
        onSelect={handleFilePickerSelect}
        onCancel={handleFilePickerCancel}
      />
    )}
    </>
  );
}
