import React from 'react';
import { Add24Regular } from '@fluentui/react-icons';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { Ribbon, ViewContext, createItemSettingsAction, createHelpAction, RibbonAction } from '../../components/ItemEditor';

interface DataCatalogRibbonProps {
  viewContext: ViewContext;
  onAddData: () => void;
  quota?: { used: number; limit: number; remaining: number } | null;
  isSampleMode?: boolean;
  workloadClient: WorkloadClientAPI;
  itemObjectId?: string;
}

export function DataCatalogRibbon({ viewContext, onAddData, quota, isSampleMode, workloadClient, itemObjectId }: DataCatalogRibbonProps) {
  const settingsAction = createItemSettingsAction(workloadClient, itemObjectId);
  const helpAction = createHelpAction();

  if (isSampleMode) {
    return (
      <Ribbon
        homeToolbarActions={[settingsAction, helpAction]}
        viewContext={viewContext}
      />
    );
  }

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
      homeToolbarActions={[settingsAction, helpAction, addDataAction]}
      viewContext={viewContext}
    />
  );
}
