import React from 'react';
import { Add24Regular } from '@fluentui/react-icons';
import { Ribbon, ViewContext, createSaveAction } from '../../components/ItemEditor';
import { RibbonAction } from '../../components/ItemEditor/RibbonToolbar';

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
    disabled: false,
    testId: 'ribbon-add-data-btn',
  };

  const homeActions: RibbonAction[] = [saveAction];

  // Only show Add Data on main view
  if (viewContext.currentView === 'main') {
    homeActions.push(addDataAction);
  }

  return (
    <Ribbon
      homeToolbarActions={homeActions}
      viewContext={viewContext}
    />
  );
}
