import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Spinner, Text, makeStyles, tokens, shorthands } from '@fluentui/react-components';
import { ItemEditorDetailView } from '../../../components/ItemEditor';
import { useDataCatalogContext } from '../DataCatalogContext';
import { FabricMessageType, FabricMessage, AuthTokenPayload } from '../../shared/FabricPostMessageProtocol';

const INTUIGENCE_APP_URL = process.env.INTUIGENCE_APP_URL || 'http://localhost:3000';

const useStyles = makeStyles({
  iframeContainer: {
    width: '100%',
    height: 'calc(100vh - 120px)',
    position: 'relative',
  },
  iframe: {
    width: '100%',
    height: '100%',
    ...shorthands.border('none'),
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '300px',
    ...shorthands.gap('12px'),
  },
});

export function DocumentDetailView() {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [loading, setLoading] = useState(true);

  const selectedDoc = catalog.definition?.documents.find(
    d => d.id === catalog.selectedDocumentId
  );

  const documentId = selectedDoc?.intuigenceDocumentId || selectedDoc?.intuigenceFileId;

  // Send auth token to iframe
  const sendAuthToken = useCallback(async () => {
    if (!iframeRef.current?.contentWindow || !catalog.apiClient) return;

    try {
      const token = await catalog.apiClient.getToken();
      const message: FabricMessage<AuthTokenPayload> = {
        type: FabricMessageType.AUTH_TOKEN,
        payload: { token, workspaceId: catalog.workspaceId || undefined },
      };
      iframeRef.current.contentWindow.postMessage(message, INTUIGENCE_APP_URL);
    } catch (err) {
      console.error('[DocumentDetailView] Failed to send auth token:', err);
    }
  }, [catalog.apiClient, catalog.workspaceId]);

  // Listen for PostMessage from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin
      const expectedOrigin = new URL(INTUIGENCE_APP_URL).origin;
      if (event.origin !== expectedOrigin) return;

      const message = event.data as FabricMessage;
      if (!message?.type) return;

      switch (message.type) {
        case FabricMessageType.APP_READY:
          setIframeReady(true);
          setLoading(false);
          sendAuthToken();
          break;

        case FabricMessageType.AUTH_TOKEN_EXPIRED:
          sendAuthToken();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [sendAuthToken]);

  // Auto-send token when iframe signals ready
  useEffect(() => {
    if (iframeReady) {
      sendAuthToken();
    }
  }, [iframeReady, sendAuthToken]);

  // Fallback: if iframe doesn't send APP_READY in 5s, hide loading
  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading) setLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading]);

  if (!selectedDoc || !documentId) {
    return (
      <ItemEditorDetailView
        center={{
          content: (
            <div className={styles.errorContainer}>
              <Text size={400} weight="semibold">Document not found</Text>
              <Text>The selected document could not be loaded.</Text>
            </div>
          ),
        }}
      />
    );
  }

  const iframeSrc = `${INTUIGENCE_APP_URL}/embed/document/${documentId}?embed=fabric`;

  return (
    <ItemEditorDetailView
      center={{
        content: (
          <div className={styles.iframeContainer}>
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className={styles.iframe}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              title={`Document: ${selectedDoc.fileName}`}
            />
            {loading && (
              <div className={styles.loadingOverlay}>
                <Spinner size="large" label="Loading document..." />
              </div>
            )}
          </div>
        ),
      }}
    />
  );
}
