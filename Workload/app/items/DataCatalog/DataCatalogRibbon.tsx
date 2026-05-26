import React from 'react';
import { Add24Regular, DocumentCopy24Regular, SignOut24Regular } from '@fluentui/react-icons';
import { Ribbon, ViewContext, createSaveAction, RibbonAction } from '../../components/ItemEditor';

interface DataCatalogRibbonProps {
  viewContext: ViewContext;
  onSave: () => void;
  saving: boolean;
  onAddData: () => void;
  onLoadSample: () => void;
  onExitSample: () => void;
  quota?: { used: number; limit: number; remaining: number } | null;
  isSampleMode?: boolean;
  sampleLoading?: boolean;
}

export function DataCatalogRibbon({
  viewContext,
  onSave,
  saving,
  onAddData,
  onLoadSample,
  onExitSample,
  quota,
  isSampleMode,
  sampleLoading,
}: DataCatalogRibbonProps) {
  const saveAction = createSaveAction(onSave, saving, saving ? 'Saving...' : undefined);
  const isQuotaFull = quota ? quota.remaining === 0 : false;

  const addDataAction: RibbonAction = {
    key: 'add-data',
    icon: Add24Regular,
    label: 'Add Data',
    onClick: onAddData,
    disabled: isQuotaFull,
    tooltip: isQuotaFull
      ? `You have reached the trial limit of ${quota!.limit} documents. Upgrade to upload more.`
      : 'Upload documents',
    testId: 'ribbon-add-data-btn',
  };

  const sampleToggleAction: RibbonAction = isSampleMode
    ? {
        key: 'exit-sample',
        icon: SignOut24Regular,
        label: 'Exit sample mode',
        onClick: onExitSample,
        tooltip: 'Hide sample files and return to your own data',
        testId: 'ribbon-exit-sample-btn',
      }
    : {
        key: 'load-sample',
        icon: DocumentCopy24Regular,
        label: sampleLoading ? 'Loading sample...' : 'Load example data',
        onClick: onLoadSample,
        disabled: sampleLoading,
        tooltip: 'View pre-loaded example P&ID, equipment manual, and sensor data',
        testId: 'ribbon-load-sample-btn',
      };

  return (
    <Ribbon
      homeToolbarActions={[saveAction, addDataAction, sampleToggleAction]}
      viewContext={viewContext}
    />
  );
}
