import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { IntuigenceAuthBridge } from "../../clients/IntuigenceAuthBridge";

interface IntelligentBoardEditorProps {
  workloadClient: WorkloadClientAPI;
}

export function IntelligentBoardEditor({
  workloadClient,
}: IntelligentBoardEditorProps) {
  const { itemObjectId } = useParams<{ itemObjectId?: string }>();
  const [authStatus, setAuthStatus] = useState<
    "pending" | "connected" | "error"
  >("pending");
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      // Get workspace ID from the Fabric item
      let workspaceId = "";
      if (itemObjectId) {
        try {
          const result = await workloadClient.itemCrud.getItem({ itemId: itemObjectId });
          workspaceId = result?.item?.workspaceId || "";
        } catch (e) {
          console.warn("[IntelligentBoard] Could not load item info:", e);
        }
      }

      const bridge = new IntuigenceAuthBridge(workloadClient);
      await bridge.initialize(workspaceId);
      setAuthStatus("connected");
    }

    init().catch((err: Error) => {
      setAuthStatus("error");
      setAuthError(err.message);
      console.error("[IntelligentBoard] Auth bridge error:", err);
    });
  }, [workloadClient, itemObjectId]);

  return (
    <div style={{ padding: "24px", fontFamily: "Segoe UI, sans-serif" }}>
      <h2>Intelligent Board</h2>
      <p>Item: {itemObjectId ?? "new"}</p>
      <p>
        Auth:{" "}
        {authStatus === "pending" && "Connecting..."}
        {authStatus === "connected" && (
          <span style={{ color: "green" }}>Connected to IntuigenceAI</span>
        )}
        {authStatus === "error" && (
          <span style={{ color: "red" }}>
            Failed — {authError}
          </span>
        )}
      </p>
      <p style={{ color: "#666" }}>
        Skeleton editor — full UI will be added in Phase 3.
      </p>
    </div>
  );
}
