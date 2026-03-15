import React, { useState, useCallback } from 'react';
import {
  Card,
  Text,
  Spinner,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  DocumentAdd24Regular,
  DocumentCopy24Regular,
} from '@fluentui/react-icons';
import { useDataCatalogContext } from '../DataCatalogContext';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '400px',
    ...shorthands.padding('48px', '24px'),
    ...shorthands.gap('24px'),
  },
  header: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('8px'),
    maxWidth: '480px',
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
    lineHeight: '20px',
  },
  cards: {
    display: 'flex',
    ...shorthands.gap('24px'),
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  card: {
    width: '240px',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('16px'),
    ...shorthands.padding('32px', '24px'),
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  iconContainer: {
    width: '56px',
    height: '56px',
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    textAlign: 'center',
  },
  cardDescription: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
});

interface MethodSelectionViewProps {
  onAddData: () => void;
  onSampleSeeded?: (fileCount: number) => void;
}

export function MethodSelectionView({ onAddData, onSampleSeeded }: MethodSelectionViewProps) {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const [seeding, setSeeding] = useState(false);

  const [seedError, setSeedError] = useState<string | null>(null);

  const handleSeedSample = useCallback(async () => {
    if (seeding) return;
    setSeeding(true);
    setSeedError(null);
    try {
      const count = await catalog.seedSampleData();
      onSampleSeeded?.(count);
    } catch (err: any) {
      const message = err?.message || 'Failed to load sample data';
      console.error('[MethodSelectionView] Seed sample failed:', message);
      setSeedError(message);
    } finally {
      setSeeding(false);
    }
  }, [catalog, seeding, onSampleSeeded]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Text size={700} weight="semibold" as="h1">
          Choose how you'd like to start
        </Text>
        <Text className={styles.subtitle} as="p">
          Set up a Knowledge Graph to prepare information for AI engineer reasoning and exploration.
        </Text>
      </div>

      <div className={styles.cards}>
        <Card className={styles.card} onClick={onAddData}>
          <div className={styles.iconContainer}>
            <DocumentAdd24Regular fontSize={28} />
          </div>
          <Text weight="semibold" className={styles.cardLabel}>
            Add Data
          </Text>
          <Text className={styles.cardDescription}>
            Browse OneLake and select files from your Lakehouses.
          </Text>
        </Card>

        <Card className={styles.card} onClick={handleSeedSample}>
          <div className={styles.iconContainer}>
            {seeding ? <Spinner size="tiny" /> : <DocumentCopy24Regular fontSize={28} />}
          </div>
          <Text weight="semibold" className={styles.cardLabel}>
            {seeding ? 'Loading sample data...' : 'Start with example data'}
          </Text>
          <Text className={styles.cardDescription}>
            {seedError
              ? seedError
              : seeding
              ? 'Setting up a P&ID, equipment manual, and sensor data for you.'
              : 'Try a pre-loaded sample to explore the experience.'}
          </Text>
        </Card>
      </div>
    </div>
  );
}
