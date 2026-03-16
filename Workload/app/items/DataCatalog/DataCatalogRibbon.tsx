import React from 'react';
import { Add24Regular } from '@fluentui/react-icons';
import { Ribbon, ViewContext, createSaveAction, RibbonAction } from '../../components/ItemEditor';

interface DataCatalogRibbonProps {
  viewContext: ViewContext;
  onSave: () => void;
  saving: boolean;
  onAddData: () => void;
  quota?: { used: number; limit: number; remaining: number } | null;
}

export function DataCatalogRibbon({ viewContext, onSave, saving, onAddData, quota }: DataCatalogRibbonProps) {
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

  return (
    <Ribbon
      homeToolbarActions={[saveAction, addDataAction]}
      viewContext={viewContext}
    />
  );
}
