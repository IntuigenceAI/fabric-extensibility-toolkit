import React, { useRef, useMemo, useEffect } from 'react';
import {
  Text,
  Button,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import { ArrowClockwise24Regular, DocumentAdd24Regular } from '@fluentui/react-icons';
import { useIntelligentBoardContext } from '../IntelligentBoardContext';
import { useBoardMessaging } from '../hooks/useBoardMessaging';

const INTUIGENCE_APP_URL = process.env.INTUIGENCE_APP_URL || 'http://localhost:3000';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  subToolbar: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    ...shorthands.padding('6px', '16px'),
    ...shorthands.borderBottom('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground1,
    height: '40px',
    flexShrink: 0,
  },
  toolbarIcon: {
    width: '20px',
    height: '20px',
    ...shorthands.borderRadius('4px'),
    backgroundColor: tokens.colorBrandBackground,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbarIconText: {
    color: tokens.colorNeutralForegroundOnBrand,
    fontSize: '10px',
    fontWeight: 700 as unknown as string,
  },
  catalogLabel: {
    color: tokens.colorNeutralForeground2,
  },
  catalogName: {
    color: tokens.colorNeutralForeground1,
  },
  iframeContainer: {
    flex: 1,
    minHeight: 0,
    position: 'relative' as const,
  },
  iframe: {
    width: '100%',
    height: '100%',
    ...shorthands.border('0'),
    display: 'block',
  },
  loadingOverlay: {
    position: 'absolute' as const,
    inset: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground2,
  },
  noBoardMessage: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    ...shorthands.gap('12px'),
    color: tokens.colorNeutralForeground3,
  },
});

export function BoardView() {
  const styles = useStyles();
  const {
    boardId,
    apiClient,
    workspaceId,
    definition,
    boardSaveRef,
    resetBoardId,
    authError,
    isSampleMode,
  } = useIntelligentBoardContext();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const catalogRefs = definition?.dataCatalogRefs ?? [];
  const primaryCatalog = catalogRefs.length > 0 ? catalogRefs[0] : null;

  const { iframeReady, boardNotFound, requestSave, requestOpenDocuments } = useBoardMessaging({
    iframeRef,
    apiClient,
    boardId,
    catalogRefs,
    workspaceId,
    theme: 'light',
  });

  // Register requestSave so the ribbon can trigger an iframe save
  useEffect(() => {
    boardSaveRef.current = requestSave;
    return () => { boardSaveRef.current = null; };
  }, [requestSave, boardSaveRef]);

  const iframeSrc = useMemo(() => {
    if (!boardId) return '';
    const url = new URL(`/embed/board/${boardId}`, INTUIGENCE_APP_URL);
    url.searchParams.set('embed', 'fabric');
    url.searchParams.set('theme', 'light');
    return url.toString();
  }, [boardId]);

  if (authError) {
    return (
      <div className={styles.noBoardMessage}>
        <Text size={400} weight="semibold">Authentication Failed</Text>
        <Text size={300}>Unable to connect to the board service. Please close and reopen this item.</Text>
      </div>
    );
  }

  if (!boardId) {
    return (
      <div className={styles.noBoardMessage}>
        <Spinner size="medium" label="Setting up your board..." />
      </div>
    );
  }

  if (boardNotFound) {
    return (
      <div className={styles.noBoardMessage}>
        <Text size={400} weight="semibold">Board not available</Text>
        <Text size={300}>The linked board no longer exists. Click below to create a new one.</Text>
        <Button
          appearance="primary"
          icon={<ArrowClockwise24Regular />}
          onClick={() => resetBoardId()}
        >
          Recreate Board
        </Button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Sub-toolbar above iframe */}
      <div className={styles.subToolbar}>
        <div className={styles.toolbarIcon}>
          <span className={styles.toolbarIconText}>iA</span>
        </div>

        {primaryCatalog ? (
          <>
            <Text size={200} className={styles.catalogLabel}>Data:</Text>
            <Text size={200} weight="semibold" className={styles.catalogName}>
              {primaryCatalog.catalogDisplayName}
            </Text>
          </>
        ) : (
          <Text size={200} className={styles.catalogLabel}>No data connected</Text>
        )}

        {!isSampleMode && (
          <div style={{ marginLeft: 'auto' }}>
            <Button
              appearance="subtle"
              size="small"
              icon={<DocumentAdd24Regular />}
              onClick={requestOpenDocuments}
            >
              Add / Remove Files
            </Button>
          </div>
        )}
      </div>

      {/* Board iframe */}
      <div className={styles.iframeContainer}>
        {!iframeReady && (
          <div className={styles.loadingOverlay}>
            <Spinner size="medium" label="Loading board..." />
          </div>
        )}
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className={styles.iframe}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
          allow="clipboard-write; microphone"
          title="Intelligent Board"
        />
      </div>
    </div>
  );
}
