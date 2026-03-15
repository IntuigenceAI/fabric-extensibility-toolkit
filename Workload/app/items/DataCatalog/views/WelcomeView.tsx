import React, { useState } from 'react';
import {
  Button,
  Checkbox,
  Text,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  BrainCircuit24Regular,
  Database24Regular,
  DocumentSearch24Regular,
} from '@fluentui/react-icons';
import { useViewNavigation } from '../../../components/ItemEditor';

const useStyles = makeStyles({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
  },
  dialog: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: tokens.shadow28,
    width: '560px',
    maxWidth: '90vw',
    ...shorthands.padding('32px'),
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('24px'),
  },
  illustration: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '120px',
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusLarge),
  },
  illustrationInner: {
    display: 'flex',
    ...shorthands.gap('8px'),
    alignItems: 'center',
    color: tokens.colorBrandForeground1,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    color: tokens.colorNeutralForeground2,
    textAlign: 'center',
    lineHeight: '20px',
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('16px'),
    ...shorthands.padding('0', '16px'),
  },
  step: {
    display: 'flex',
    ...shorthands.gap('12px'),
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: '36px',
    height: '36px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.gap('2px'),
  },
  stepDescription: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.borderTop(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    paddingTop: '16px',
  },
  footerRight: {
    display: 'flex',
    ...shorthands.gap('8px'),
  },
});

export function WelcomeView() {
  const styles = useStyles();
  const { setCurrentView } = useViewNavigation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleNext = () => {
    if (dontShowAgain) {
      localStorage.setItem('datacatalog-hide-welcome', 'true');
    }
    setCurrentView('method-select');
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.dialog}>
        {/* Illustration */}
        <div className={styles.illustration}>
          <div className={styles.illustrationInner}>
            <svg width="140" height="80" viewBox="0 0 140 80" fill="none">
              <circle cx="30" cy="40" r="12" fill="currentColor" opacity="0.2" />
              <circle cx="70" cy="20" r="12" fill="currentColor" opacity="0.3" />
              <circle cx="110" cy="40" r="12" fill="currentColor" opacity="0.2" />
              <circle cx="70" cy="60" r="12" fill="currentColor" opacity="0.3" />
              <line x1="42" y1="35" x2="58" y2="25" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <line x1="82" y1="25" x2="98" y2="35" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <line x1="42" y1="45" x2="58" y2="55" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <line x1="82" y1="55" x2="98" y2="45" stroke="currentColor" strokeWidth="2" opacity="0.4" />
              <circle cx="30" cy="40" r="6" fill="currentColor" opacity="0.6" />
              <circle cx="70" cy="20" r="6" fill="currentColor" opacity="0.6" />
              <circle cx="110" cy="40" r="6" fill="currentColor" opacity="0.6" />
              <circle cx="70" cy="60" r="6" fill="currentColor" opacity="0.6" />
            </svg>
          </div>
        </div>

        {/* Title */}
        <Text size={600} weight="semibold" className={styles.title} as="h2">
          Welcome to IntuigenceAI Knowledge Graph
        </Text>

        {/* Description */}
        <Text className={styles.description} as="p">
          Transform your documents into structured knowledge that AI agents can reason over.
          Connect your Fabric data sources and let IntuigenceAI prepare them for intelligent exploration.
        </Text>

        {/* Steps */}
        <div className={styles.steps}>
          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <Database24Regular />
            </div>
            <div className={styles.stepText}>
              <Text weight="semibold">Step 1: Define your catalog</Text>
              <Text className={styles.stepDescription}>
                Create a knowledge graph to organize your documents and data.
              </Text>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <DocumentSearch24Regular />
            </div>
            <div className={styles.stepText}>
              <Text weight="semibold">Step 2: Add data from Fabric</Text>
              <Text className={styles.stepDescription}>
                Browse OneLake and select files from your Lakehouses.
              </Text>
            </div>
          </div>

          <div className={styles.step}>
            <div className={styles.stepIcon}>
              <BrainCircuit24Regular />
            </div>
            <div className={styles.stepText}>
              <Text weight="semibold">Step 3: Prepare data for AI reasoning</Text>
              <Text className={styles.stepDescription}>
                Documents are automatically processed, extracted, and indexed for AI consumption.
              </Text>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Checkbox
            label="Don't show again"
            checked={dontShowAgain}
            onChange={(_, data) => setDontShowAgain(!!data.checked)}
          />
          <div className={styles.footerRight}>
            <Button appearance="primary" onClick={handleNext}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
