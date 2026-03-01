import React, { useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { ItemEditor, RegisteredView } from "../../components/ItemEditor";
import { IntelligentBoardContext } from "./IntelligentBoardContext";
import { IntelligentBoardRibbon } from "./IntelligentBoardRibbon";
import { useIntelligentBoard } from "./hooks/useIntelligentBoard";
import { WelcomeView } from "./views/WelcomeView";
import { MethodSelectionView } from "./views/MethodSelectionView";
import { BoardView } from "./views/BoardView";

interface IntelligentBoardEditorProps {
  workloadClient: WorkloadClientAPI;
}

export function IntelligentBoardEditor({
  workloadClient,
}: IntelligentBoardEditorProps) {
  const { itemObjectId } = useParams<{ itemObjectId?: string }>();
  const board = useIntelligentBoard(workloadClient, itemObjectId);

  const handleSave = useCallback(async () => {
    // Trigger iframe save via PostMessage (if BoardView is mounted)
    board.boardSaveRef.current?.();
    // Persist definition to OneLake
    await board.save();
  }, [board.boardSaveRef, board.save]);

  const views: RegisteredView[] = useMemo(
    () => [
      {
        name: "welcome",
        component: <WelcomeView />,
      },
      {
        name: "method-select",
        component: <MethodSelectionView />,
      },
      {
        name: "board",
        component: <BoardView />,
      },
    ],
    []
  );

  const getInitialView = useCallback(() => {
    if (!board.definition) return null;
    const hideWelcome =
      localStorage.getItem("board-hide-welcome") === "true";
    if (board.definition.dataCatalogRefs.length === 0) {
      return hideWelcome ? "method-select" : "welcome";
    }
    return "board";
  }, [board.definition]);

  return (
    <IntelligentBoardContext.Provider value={board}>
      <ItemEditor
        key={itemObjectId}
        ribbon={(ctx) => (
          <IntelligentBoardRibbon
            viewContext={ctx}
            onSave={handleSave}
            saving={board.saving}
          />
        )}
        views={views}
        getInitialView={getInitialView}
        isLoading={board.loading || !board.authReady}
        loadingMessage="Loading Intelligent Board..."
      />
    </IntelligentBoardContext.Provider>
  );
}
