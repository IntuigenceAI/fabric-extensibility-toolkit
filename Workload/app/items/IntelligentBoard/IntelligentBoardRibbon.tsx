import React from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { Ribbon, ViewContext, createItemSettingsAction, createHelpAction } from '../../components/ItemEditor';

interface IntelligentBoardRibbonProps {
  viewContext: ViewContext;
  workloadClient: WorkloadClientAPI;
  itemObjectId?: string;
}

export function IntelligentBoardRibbon({
  viewContext,
  workloadClient,
  itemObjectId,
}: IntelligentBoardRibbonProps) {
  const settingsAction = createItemSettingsAction(workloadClient, itemObjectId);
  const helpAction = createHelpAction(undefined, false);

  return (
    <Ribbon
      homeToolbarActions={[settingsAction, helpAction]}
      viewContext={viewContext}
    />
  );
}
