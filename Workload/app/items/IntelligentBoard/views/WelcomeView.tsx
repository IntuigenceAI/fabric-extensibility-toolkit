import React, { useState } from 'react';
import {
  Button,
  Text,
  Checkbox,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  DataArea24Regular,
  Eye24Regular,
  Lightbulb24Regular,
} from '@fluentui/react-icons';
import { useViewNavigation } from '../../../components/ItemEditor';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding('64px', '24px'),
    ...shorthands.gap('32px'),
    maxWidth: '640px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  title: {
    textAlign: 'center' as const,
  },
  subtitle: {
    textAlign: 'center' as const,
    color: tokens.colorNeutralForeground2,
    maxWidth: '480px',
  },
  stepsContainer: {
    display: 'flex',
    ...shorthands.gap('32px'),
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    width: '140px',
    textAlign: 'center' as const,
  },
  stepIcon: {
    width: '56px',
    height: '56px',
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    backgroundColor: tokens.colorBrandBackground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: tokens.colorBrandForeground1,
  },
  stepLabel: {
    color: tokens.colorNeutralForeground1,
  },
  stepDescription: {
    color: tokens.colorNeutralForeground3,
  },
  actions: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'center',
  },
  footer: {
    display: 'flex',
    ...shorthands.gap('8px'),
    alignItems: 'center',
  },
});

export function WelcomeView() {
  const styles = useStyles();
  const { setCurrentView } = useViewNavigation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleGetStarted = () => {
    if (dontShowAgain) {
      localStorage.setItem('board-hide-welcome', 'true');
    }
    setCurrentView('method-select');
  };

  return (
    <div className={styles.container}>
      <Text as="h2" size={700} weight="semibold" className={styles.title}>
        Intelligent Board
      </Text>
      <Text as="p" size={400} className={styles.subtitle}>
        Your AI-powered reasoning canvas. Connect data from a Knowledge Graph,
        explore documents visually, and discover insights with AI assistance.
      </Text>

      <div className={styles.stepsContainer}>
        <div className={styles.step}>
          <div className={styles.stepIcon}>
            <DataArea24Regular fontSize={28} />
          </div>
          <Text size={300} weight="semibold" className={styles.stepLabel}>
            Connect data
          </Text>
          <Text size={200} className={styles.stepDescription}>
            Link a Knowledge Graph to bring in your documents
          </Text>
        </div>

        <div className={styles.step}>
          <div className={styles.stepIcon}>
            <Eye24Regular fontSize={28} />
          </div>
          <Text size={300} weight="semibold" className={styles.stepLabel}>
            Explore visually
          </Text>
          <Text size={200} className={styles.stepDescription}>
            Arrange documents on a canvas and see connections
          </Text>
        </div>

        <div className={styles.step}>
          <div className={styles.stepIcon}>
            <Lightbulb24Regular fontSize={28} />
          </div>
          <Text size={300} weight="semibold" className={styles.stepLabel}>
            AI insights
          </Text>
          <Text size={200} className={styles.stepDescription}>
            Chat with AI to analyze and reason over your data
          </Text>
        </div>
      </div>

      <div className={styles.actions}>
        <Button appearance="primary" onClick={handleGetStarted}>
          Get Started
        </Button>
      </div>

      <div className={styles.footer}>
        <Checkbox
          label="Don't show this again"
          checked={dontShowAgain}
          onChange={(_, data) => setDontShowAgain(!!data.checked)}
        />
      </div>
    </div>
  );
}
