/**
 * PostMessage protocol between the Fabric workload and the embedded
 * IntuigenceAI board iframe.
 *
 * Auth is passed exclusively via PostMessage — no cookies allowed
 * (Fabric Requirement 4.1.3).
 */

export enum FabricMessageType {
  // Handshake
  APP_READY = "APP_READY",
  FABRIC_CONTEXT = "FABRIC_CONTEXT",

  // Auth
  AUTH_TOKEN = "AUTH_TOKEN",
  AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED",
  AUTH_TOKEN_REFRESH = "AUTH_TOKEN_REFRESH",

  // Board
  BOARD_CONTEXT = "BOARD_CONTEXT",
  BOARD_STATE_CHANGED = "BOARD_STATE_CHANGED",
  BOARD_SAVE_REQUEST = "BOARD_SAVE_REQUEST",
  BOARD_SAVED = "BOARD_SAVED",

  // Theme
  FABRIC_THEME = "FABRIC_THEME",

  // Error
  APP_ERROR = "APP_ERROR",

  // Navigation
  OPEN_DOCUMENT = "OPEN_DOCUMENT",
  OPEN_DOCUMENTS_MODAL = "OPEN_DOCUMENTS_MODAL",
}

export interface FabricMessage<T = unknown> {
  type: FabricMessageType;
  payload: T;
}

export interface AuthTokenPayload {
  token: string;
  workspaceId?: string;
}

export interface BoardContextPayload {
  workspaceId: string;
  catalogRefs: Array<{
    catalogItemId: string;
    catalogWorkspaceId: string;
    catalogDisplayName: string;
  }>;
  allowedDocumentIds?: string[];
  /** Fabric item IDs for server-side document scoping */
  fabricItemIds?: string[];
}

export interface FabricThemePayload {
  theme: "light" | "dark";
}
