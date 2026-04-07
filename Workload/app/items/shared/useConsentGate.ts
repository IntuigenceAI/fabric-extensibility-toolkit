import { useState, useEffect, useCallback, useRef } from 'react';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { FABRIC_BASE_SCOPES } from '../../clients/FabricPlatformScopes';

/**
 * All scopes that the workload may request during a user session.
 * By requesting them all upfront in a single acquireAccessToken call,
 * we ensure the user sees ONE consent prompt (if needed) rather than
 * multiple flaky popups triggered by individual API clients.
 *
 * This list should be kept in sync with scopes used by:
 * - OneLakeStorageClient  → ONELAKE_STORAGE (storage.azure.com/user_impersonation)
 * - ItemClient            → ITEM_READ, ITEM_READWRITE, WORKSPACE_READ
 * - IntuigenceAuthBridge  → ITEM_READ, WORKSPACE_READ
 */
const ALL_REQUIRED_SCOPES = [
  FABRIC_BASE_SCOPES.ONELAKE_STORAGE,    // Azure Storage — OneLake DFS access
  FABRIC_BASE_SCOPES.ITEM_READ,          // Fabric item read
  FABRIC_BASE_SCOPES.ITEM_READWRITE,     // Fabric item write
  FABRIC_BASE_SCOPES.WORKSPACE_READ,     // Fabric workspace read
].join(' ');

export interface ConsentGateResult {
  /** True once all scopes have been consented and a token was acquired */
  ready: boolean;
  /** Non-null if the consent/token acquisition failed */
  error: string | null;
  /** Retry the consent flow (e.g., after user dismisses the prompt) */
  retry: () => void;
}

/**
 * Hook that gates item rendering behind a single upfront consent call.
 *
 * On mount it calls `acquireAccessToken` with ALL required scopes via
 * `additionalScopesToConsent`. If the user hasn't consented yet, Fabric
 * shows one consent dialog covering everything. Once consent is granted,
 * `ready` flips to true and downstream hooks (useOneLakeSync, etc.) can
 * acquire tokens without triggering additional consent popups.
 *
 * Must be called BEFORE any hooks that create OneLakeStorageClient or
 * other scope-bearing clients.
 */
export function useConsentGate(workloadClient: WorkloadClientAPI): ConsentGateResult {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptRef = useRef(0);

  const requestConsent = useCallback(async () => {
    setError(null);
    setReady(false);

    try {
      // acquireAccessToken with additionalScopesToConsent triggers a single
      // consent dialog for all listed scopes if not yet consented.
      // The token itself is for the workload audience — we don't use it,
      // we just need the side effect of consent being granted.
      await workloadClient.auth.acquireAccessToken({
        additionalScopesToConsent: ALL_REQUIRED_SCOPES.split(' '),
      });
      setReady(true);
    } catch (err: any) {
      console.error('[useConsentGate] Consent acquisition failed:', err);
      setError(err?.message || 'Failed to acquire permissions. Please try again.');
    }
  }, [workloadClient]);

  useEffect(() => {
    requestConsent();
  }, [requestConsent]);

  const retry = useCallback(() => {
    attemptRef.current += 1;
    requestConsent();
  }, [requestConsent]);

  return { ready, error, retry };
}
