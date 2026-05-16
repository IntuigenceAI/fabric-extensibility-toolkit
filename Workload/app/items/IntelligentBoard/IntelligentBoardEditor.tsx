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
    // If a workspace was already created, the board is configured — skip onboarding
    if (board.definition.intuigenceMapping?.workspaceId) {
      return "board";
    }
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
            workloadClient={workloadClient}
            itemObjectId={itemObjectId}
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
