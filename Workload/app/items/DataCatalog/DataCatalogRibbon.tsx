import React from 'react';
import { Ribbon, ViewContext, createSaveAction } from '../../components/ItemEditor';

interface DataCatalogRibbonProps {
  viewContext: ViewContext;
  onSave: () => void;
  saving: boolean;
}

export function DataCatalogRibbon({ viewContext, onSave, saving }: DataCatalogRibbonProps) {
  const saveAction = createSaveAction(onSave, saving, saving ? 'Saving...' : undefined);

  return (
    <Ribbon
      homeToolbarActions={[saveAction]}
      viewContext={viewContext}
    />
  );
}
