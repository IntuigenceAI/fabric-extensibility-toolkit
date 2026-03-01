import { useEffect, useRef, useState, useCallback, RefObject } from 'react';
import { IntuigenceAPIClient } from '../../../clients/IntuigenceAPIClient';
import {
  FabricMessageType,
  FabricMessage,
  AuthTokenPayload,
  BoardContextPayload,
  FabricThemePayload,
} from '../../shared/FabricPostMessageProtocol';
import { CatalogRef } from '../IntelligentBoardDefinition';

const INTUIGENCE_APP_URL = process.env.INTUIGENCE_APP_URL || 'http://localhost:3000';

const ALLOWED_ORIGINS: string[] = [
  new URL(INTUIGENCE_APP_URL).origin,
];
if (process.env.NODE_ENV === 'development') {
  ALLOWED_ORIGINS.push('http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173');
}

export interface UseBoardMessagingOptions {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  apiClient: IntuigenceAPIClient | null;
  boardId: string | null;
  catalogRefs: CatalogRef[];
  catalogDocumentIds: string[];
  workspaceId: string;
  theme?: 'light' | 'dark';
}

export interface UseBoardMessagingResult {
  iframeReady: boolean;
  boardDirty: boolean;
  boardNotFound: boolean;
  requestSave: () => void;
  requestOpenDocuments: () => void;
}

/**
 * Manages the PostMessage lifecycle between the Fabric workload and the
 * embedded IntuigenceAI board iframe.
 *
 * Sequence: iframe sends APP_READY → we send AUTH_TOKEN + BOARD_CONTEXT +
 * FABRIC_THEME → board operates → on save request we send BOARD_SAVE_REQUEST →
 * iframe responds with BOARD_SAVED.
 */
export function useBoardMessaging({
  iframeRef,
  apiClient,
  boardId,
  catalogRefs,
  catalogDocumentIds,
  workspaceId,
  theme = 'light',
}: UseBoardMessagingOptions): UseBoardMessagingResult {
  const [iframeReady, setIframeReady] = useState(false);
  const [boardDirty, setBoardDirty] = useState(false);
  const [boardNotFound, setBoardNotFound] = useState(false);
  const iframeOriginRef = useRef<string | null>(null);

  // Reset state when boardId changes (e.g. after resetBoardId + re-creation)
  useEffect(() => {
    setIframeReady(false);
    setBoardDirty(false);
    setBoardNotFound(false);
  }, [boardId]);

  // Post a message to the iframe using the verified origin
  const postToIframe = useCallback((message: FabricMessage) => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const targetOrigin = iframeOriginRef.current || ALLOWED_ORIGINS[0]!;
    iframe.contentWindow.postMessage(message, targetOrigin);
  }, [iframeRef]);

  // Send the initial context burst after iframe signals ready
  const sendInitialContext = useCallback(async () => {
    if (!apiClient) return;

    try {
      const token = await apiClient.getToken();

      // 1. Auth token
      postToIframe({
        type: FabricMessageType.AUTH_TOKEN,
        payload: { token, workspaceId } satisfies AuthTokenPayload,
      });

      // 2. Board context with catalog references and allowed document IDs.
      // Send the array even if empty — empty means "catalogs connected, no docs yet".
      // Only omit when no catalogs are connected (null = no restriction).
      postToIframe({
        type: FabricMessageType.BOARD_CONTEXT,
        payload: {
          workspaceId,
          catalogRefs,
          allowedDocumentIds: catalogRefs.length > 0 ? catalogDocumentIds : undefined,
        } satisfies BoardContextPayload,
      });

      // 3. Theme
      postToIframe({
        type: FabricMessageType.FABRIC_THEME,
        payload: { theme } satisfies FabricThemePayload,
      });
    } catch (err) {
      console.error('[useBoardMessaging] Failed to send initial context:', err);
    }
  }, [apiClient, workspaceId, catalogRefs, catalogDocumentIds, theme, postToIframe]);

  // Handle incoming messages from the iframe
  useEffect(() => {
    if (!boardId) return undefined;

    function handleMessage(event: MessageEvent) {
      if (!ALLOWED_ORIGINS.includes(event.origin)) return;

      const message = event.data as FabricMessage;
      if (!message?.type) return;

      switch (message.type) {
        case FabricMessageType.APP_READY:
          iframeOriginRef.current = event.origin;
          setIframeReady(true);
          sendInitialContext();
          break;

        case FabricMessageType.AUTH_TOKEN_EXPIRED:
          // Refresh the token and send it back
          if (apiClient) {
            apiClient.getToken().then((token) => {
              postToIframe({
                type: FabricMessageType.AUTH_TOKEN_REFRESH,
                payload: { token, workspaceId } satisfies AuthTokenPayload,
              });
            }).catch((err) => {
              console.error('[useBoardMessaging] Token refresh failed:', err);
            });
          }
          break;

        case FabricMessageType.BOARD_STATE_CHANGED:
          setBoardDirty(true);
          break;

        case FabricMessageType.BOARD_SAVED:
          setBoardDirty(false);
          break;

        case FabricMessageType.APP_ERROR: {
          const errorPayload = message.payload as { code?: string };
          console.error('[useBoardMessaging] App error from iframe:', message.payload);
          if (errorPayload?.code === 'BOARD_NOT_FOUND') {
            setBoardNotFound(true);
          }
          break;
        }
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [boardId, apiClient, workspaceId, sendInitialContext, postToIframe]);

  // Re-send theme when it changes
  useEffect(() => {
    if (!iframeReady) return;
    postToIframe({
      type: FabricMessageType.FABRIC_THEME,
      payload: { theme } satisfies FabricThemePayload,
    });
  }, [theme, iframeReady, postToIframe]);

  // Re-send BOARD_CONTEXT when catalog data changes (e.g. catalogs added/removed).
  // Without this, allowedDocumentIds in the iframe becomes stale after the initial handshake.
  useEffect(() => {
    if (!iframeReady) return;
    postToIframe({
      type: FabricMessageType.BOARD_CONTEXT,
      payload: {
        workspaceId,
        catalogRefs,
        allowedDocumentIds: catalogRefs.length > 0 ? catalogDocumentIds : undefined,
      } satisfies BoardContextPayload,
    });
  }, [catalogRefs, catalogDocumentIds, iframeReady, workspaceId, postToIframe]);

  // Request the iframe to save immediately
  const requestSave = useCallback(() => {
    postToIframe({
      type: FabricMessageType.BOARD_SAVE_REQUEST,
      payload: {},
    });
  }, [postToIframe]);

  // Request the iframe to open the Add/Remove Files modal
  const requestOpenDocuments = useCallback(() => {
    postToIframe({
      type: FabricMessageType.OPEN_DOCUMENTS_MODAL,
      payload: {},
    });
  }, [postToIframe]);

  return { iframeReady, boardDirty, boardNotFound, requestSave, requestOpenDocuments };
}
