import React from 'react';
import { Ribbon, ViewContext, createSaveAction } from '../../components/ItemEditor';

interface IntelligentBoardRibbonProps {
  viewContext: ViewContext;
  onSave: () => void;
  saving: boolean;
}

export function IntelligentBoardRibbon({
  viewContext,
  onSave,
  saving,
}: IntelligentBoardRibbonProps) {
  const saveAction = createSaveAction(onSave, saving, saving ? 'Saving...' : undefined);

  return (
    <Ribbon
      homeToolbarActions={[saveAction]}
      viewContext={viewContext}
    />
  );
}
