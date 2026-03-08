import React from 'react';
import { Add24Regular } from '@fluentui/react-icons';
import { Ribbon, ViewContext, createSaveAction, RibbonAction } from '../../components/ItemEditor';

interface DataCatalogRibbonProps {
  viewContext: ViewContext;
  onSave: () => void;
  saving: boolean;
  onAddData: () => void;
}

export function DataCatalogRibbon({ viewContext, onSave, saving, onAddData }: DataCatalogRibbonProps) {
  const saveAction = createSaveAction(onSave, saving, saving ? 'Saving...' : undefined);

  const addDataAction: RibbonAction = {
    key: 'add-data',
    icon: Add24Regular,
    label: 'Add Data',
    onClick: onAddData,
    testId: 'ribbon-add-data-btn',
  };

  return (
    <Ribbon
      homeToolbarActions={[saveAction, addDataAction]}
      viewContext={viewContext}
    />
  );
}
