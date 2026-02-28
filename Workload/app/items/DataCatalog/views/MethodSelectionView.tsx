import React from 'react';
import {
  Button,
  Card,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  DocumentAdd24Regular,
  DocumentCopy24Regular,
} from '@fluentui/react-icons';

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
  cardDisabled: {
    width: '240px',
    minHeight: '200px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.gap('16px'),
    ...shorthands.padding('32px', '24px'),
    opacity: 0.5,
    cursor: 'not-allowed',
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
}

export function MethodSelectionView({ onAddData }: MethodSelectionViewProps) {
  const styles = useStyles();

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

        <Card className={styles.cardDisabled}>
          <div className={styles.iconContainer}>
            <DocumentCopy24Regular fontSize={28} />
          </div>
          <Text weight="semibold" className={styles.cardLabel}>
            Start with example data
          </Text>
          <Text className={styles.cardDescription}>
            Try a pre-loaded sample to explore the experience.
          </Text>
          <Button appearance="secondary" size="small" disabled>
            Coming soon
          </Button>
        </Card>
      </div>
    </div>
  );
}
