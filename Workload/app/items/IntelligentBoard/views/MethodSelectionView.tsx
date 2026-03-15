import React, { useState, useCallback } from 'react';
import {
  Text,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  DatabaseSearch24Regular,
  Play24Regular,
} from '@fluentui/react-icons';
import { ExtendedItemTypeV2 } from '@ms-fabric/workload-client';
import { useViewNavigation } from '../../../components/ItemEditor';
import { useIntelligentBoardContext } from '../IntelligentBoardContext';
import { callDatahubOpen } from '../../../controller/DataHubController';
import { getConfiguredWorkloadItem } from '../../../controller/ConfigurationController';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.padding('48px', '24px'),
    ...shorthands.gap('32px'),
    maxWidth: '720px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  title: {
    textAlign: 'center' as const,
  },
  subtitle: {
    textAlign: 'center' as const,
    color: tokens.colorNeutralForeground2,
  },
  cardsContainer: {
    display: 'flex',
    ...shorthands.gap('20px'),
    flexWrap: 'wrap',
    justifyContent: 'center',
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.padding('24px'),
    ...shorthands.gap('16px'),
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke1),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
    width: '200px',
    cursor: 'pointer',
    textAlign: 'center' as const,
    transitionDuration: '0.15s',
    transitionProperty: 'box-shadow',
    ':hover': {
      boxShadow: tokens.shadow16,
    },
  },
  cardIcon: {
    width: '48px',
    height: '48px',
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorBrandForeground1,
  },
  cardTitle: {
    color: tokens.colorNeutralForeground1,
  },
  cardDescription: {
    color: tokens.colorNeutralForeground3,
  },
});

export function MethodSelectionView() {
  const styles = useStyles();
  const { setCurrentView } = useViewNavigation();
  const { workloadClient, addCatalogRef } = useIntelligentBoardContext();
  const [loading, setLoading] = useState(false);

  const handleSelectCatalog = useCallback(async () => {
    setLoading(true);
    try {
      // Open Fabric's built-in DataHub selector dialog for DataCatalog items
      const catalogType = getConfiguredWorkloadItem('DataCatalog')?.fullType || 'DataCatalog';
      const result = await callDatahubOpen(
        workloadClient,
        [catalogType as ExtendedItemTypeV2],
        'Choose a Knowledge Graph to connect',
        false,
      );

      if (result) {
        addCatalogRef({
          catalogItemId: result.id,
          catalogWorkspaceId: result.workspaceId,
          catalogDisplayName: result.displayName || 'Knowledge Graph',
        });
        setCurrentView('board');
      }
    } catch (err) {
      console.error('[MethodSelectionView] Catalog selection cancelled or failed:', err);
    } finally {
      setLoading(false);
    }
  }, [workloadClient, addCatalogRef, setCurrentView]);

  const handleStartFresh = useCallback(() => {
    setCurrentView('board');
  }, [setCurrentView]);

  if (loading) {
    return (
      <div className={styles.container}>
        <Spinner label="Finding Knowledge Graphs..." />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Text as="h2" size={600} weight="semibold" className={styles.title}>
        Connect Your Data
      </Text>
      <Text as="p" size={400} className={styles.subtitle}>
        Choose how to get started with your Intelligent Board
      </Text>

      <div className={styles.cardsContainer}>
        <div
          className={styles.card}
          role="button"
          tabIndex={0}
          onClick={handleSelectCatalog}
          onKeyDown={(e) => e.key === 'Enter' && handleSelectCatalog()}
        >
          <div className={styles.cardIcon}>
            <DatabaseSearch24Regular fontSize={24} />
          </div>
          <Text size={300} weight="semibold" className={styles.cardTitle}>
            Select Knowledge Graph
          </Text>
          <Text size={200} className={styles.cardDescription}>
            Browse existing Knowledge Graphs in this workspace
          </Text>
        </div>

        <div
          className={styles.card}
          role="button"
          tabIndex={0}
          onClick={handleStartFresh}
          onKeyDown={(e) => e.key === 'Enter' && handleStartFresh()}
        >
          <div className={styles.cardIcon}>
            <Play24Regular fontSize={24} />
          </div>
          <Text size={300} weight="semibold" className={styles.cardTitle}>
            Start Fresh
          </Text>
          <Text size={200} className={styles.cardDescription}>
            Open the board and start chatting with Synthetic Engineers.
          </Text>
        </div>
      </div>
    </div>
  );
}
