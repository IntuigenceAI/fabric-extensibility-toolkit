import React from 'react';
import {
  Spinner,
  Text,
  Button,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import { ShieldKeyhole24Regular } from '@fluentui/react-icons';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { useConsentGate } from './useConsentGate';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    ...shorthands.gap('16px'),
    ...shorthands.padding('24px'),
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    maxWidth: '420px',
    textAlign: 'center' as const,
  },
  icon: {
    color: tokens.colorBrandForeground1,
  },
  subtitle: {
    color: tokens.colorNeutralForeground2,
  },
});

interface ConsentGateProps {
  workloadClient: WorkloadClientAPI;
  children: React.ReactNode;
}

/**
 * Wrapper component that ensures all required API permissions are consented
 * before rendering item editors. Shows a spinner while acquiring consent,
 * or an error with retry button if consent fails.
 */
export function ConsentGate({ workloadClient, children }: ConsentGateProps) {
  const styles = useStyles();
  const { ready, error, retry } = useConsentGate(workloadClient);

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <ShieldKeyhole24Regular className={styles.icon} fontSize={48} />
          <Text size={500} weight="semibold">
            Permissions Required
          </Text>
          <Text size={300} className={styles.subtitle}>
            This workload needs your permission to access Fabric resources and storage.
            Please click the button below and accept the consent prompt.
          </Text>
          <Button appearance="primary" onClick={retry}>
            Grant Permissions
          </Button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={styles.container}>
        <Spinner label="Checking permissions..." />
      </div>
    );
  }

  return <>{children}</>;
}
