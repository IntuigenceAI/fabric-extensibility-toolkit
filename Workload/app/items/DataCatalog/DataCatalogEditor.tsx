import React, { useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import {
  Toaster,
  useToastController,
  useId,
  Toast,
  ToastTitle,
  ToastBody,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@fluentui/react-components";
import { ItemEditor, RegisteredView } from "../../components/ItemEditor";
import { DataCatalogContext } from "./DataCatalogContext";
import { DataCatalogRibbon } from "./DataCatalogRibbon";
import { useDataCatalog } from "./hooks/useDataCatalog";
import { WelcomeView } from "./views/WelcomeView";
import { MethodSelectionView } from "./views/MethodSelectionView";
import { MainView } from "./views/MainView";
import { DocumentDetailView } from "./views/DocumentDetailView";
import { AddDataDialog } from "./dialogs/AddDataDialog";

interface DataCatalogEditorProps {
  workloadClient: WorkloadClientAPI;
}

export function DataCatalogEditor({ workloadClient }: DataCatalogEditorProps) {
  const { itemObjectId } = useParams<{ itemObjectId?: string }>();
  const catalog = useDataCatalog(workloadClient, itemObjectId);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showExitSampleConfirm, setShowExitSampleConfirm] = useState(false);

  const toasterId = useId('datacatalog-toaster');
  const { dispatchToast } = useToastController(toasterId);
  const viewSetterRef = useRef<((view: string) => void) | null>(null);

  const handleAddData = useCallback(() => setShowAddDialog(true), []);
  const handleCloseDialog = useCallback(() => setShowAddDialog(false), []);

  const handleExitSample = useCallback(() => setShowExitSampleConfirm(true), []);
  const handleConfirmExitSample = useCallback(async () => {
    setShowExitSampleConfirm(false);
    try {
      await catalog.exitSampleMode();
      dispatchToast(
        <Toast>
          <ToastTitle>Exited sample mode</ToastTitle>
        </Toast>,
        { intent: 'success', timeout: 3000 },
      );
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>Failed to exit sample mode</ToastTitle>
          <ToastBody>{err?.message || 'Something went wrong'}</ToastBody>
        </Toast>,
        { intent: 'error', timeout: 6000 },
      );
    }
  }, [catalog, dispatchToast]);

  const handleViewSetter = useCallback((setter: (view: string) => void) => {
    viewSetterRef.current = setter;
  }, []);

  const handleFilesSubmitted = useCallback((fileCount: number) => {
    setShowAddDialog(false);
    // Navigate to main view to show the file listing
    if (viewSetterRef.current) {
      viewSetterRef.current('main');
    }
    // Show brief toast notification
    dispatchToast(
      <Toast>
        <ToastTitle>Processing started</ToastTitle>
        <ToastBody>{fileCount} file{fileCount > 1 ? 's are' : ' is'} being processed</ToastBody>
      </Toast>,
      { intent: 'info', timeout: 4000 }
    );
  }, [dispatchToast]);

  const handleSampleSeeded = useCallback((fileCount: number) => {
    if (viewSetterRef.current) {
      viewSetterRef.current('main');
    }
    dispatchToast(
      <Toast>
        <ToastTitle>Sample data loaded</ToastTitle>
        <ToastBody>{fileCount} sample file{fileCount !== 1 ? 's are' : ' is'} being processed</ToastBody>
      </Toast>,
      { intent: 'info', timeout: 4000 }
    );
  }, [dispatchToast]);

  const views: RegisteredView[] = useMemo(() => [
    {
      name: 'welcome',
      component: <WelcomeView />,
    },
    {
      name: 'method-select',
      component: <MethodSelectionView onAddData={handleAddData} onSampleSeeded={handleSampleSeeded} />,
    },
    {
      name: 'main',
      component: <MainView onAddData={handleAddData} onExitSample={handleExitSample} />,
    },
    {
      name: 'document-detail',
      component: <DocumentDetailView />,
      isDetailView: true,
    },
  ], [handleAddData, handleExitSample, handleSampleSeeded]);

  const getInitialView = useCallback(() => {
    if (!catalog.definition) return null;
    // Skip welcome if user previously chose "Don't show again"
    const hideWelcome = localStorage.getItem('datacatalog-hide-welcome') === 'true';
    if (catalog.definition.documents.length === 0) {
      return hideWelcome ? 'method-select' : 'welcome';
    }
    return 'main';
  }, [catalog.definition]);

  return (
    <DataCatalogContext.Provider value={catalog}>
      <ItemEditor
        key={itemObjectId}
        viewSetter={handleViewSetter}
        ribbon={(ctx) => (
          <DataCatalogRibbon
            viewContext={ctx}
            onAddData={handleAddData}
            quota={catalog.quota}
            isSampleMode={catalog.isSampleMode}
            workloadClient={workloadClient}
            itemObjectId={itemObjectId}
          />
        )}
        views={views}
        getInitialView={getInitialView}
        isLoading={catalog.loading || !catalog.authReady}
        loadingMessage="Loading Knowledge Graph..."
      />
      {showAddDialog && (
        <AddDataDialog onClose={handleCloseDialog} onFilesSubmitted={handleFilesSubmitted} />
      )}
      <Dialog
        open={showExitSampleConfirm}
        onOpenChange={(_, data) => { if (!data.open) setShowExitSampleConfirm(false); }}
      >
        <DialogSurface>
          <DialogBody>
            <DialogTitle>Exit sample mode?</DialogTitle>
            <DialogContent>
              The pre-loaded sample files will be hidden from this item. Your own
              uploaded files remain.
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setShowExitSampleConfirm(false)}>
                Cancel
              </Button>
              <Button appearance="primary" onClick={handleConfirmExitSample}>
                Exit sample mode
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
      <Toaster toasterId={toasterId} position="bottom-end" />
    </DataCatalogContext.Provider>
  );
}
