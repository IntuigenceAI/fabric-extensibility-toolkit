import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { FabricAuthenticationService } from "./FabricAuthenticationService";
import { SCOPES } from "./FabricPlatformScopes";

const INTUIGENCE_API_URL =
  process.env.INTUIGENCE_API_URL || "http://localhost:3001";

/**
 * Bridges Fabric SDK authentication to IntuigenceAI backend.
 *
 * Flow:
 *   1. Acquire Azure AD token via Fabric SDK (acquireAccessToken)
 *      → Token audience = workload Entra app ID
 *   2. POST to /v1/auth/fabric-provision (one-time per session)
 *      → Backend validates token via Microsoft JWKS, creates tenant/user mappings
 *   3. Subsequent API calls send the Azure AD token in Authorization header
 *      → Backend validates via dual-JWKS (Microsoft + Keycloak)
 *      → For OneLake access, backend exchanges via OBO for storage-scoped token
 */
export class IntuigenceAuthBridge {
  private workloadClient: WorkloadClientAPI;
  private fabricAuth: FabricAuthenticationService;
  private provisioned = false;
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(workloadClient: WorkloadClientAPI) {
    this.workloadClient = workloadClient;
    this.fabricAuth = new FabricAuthenticationService(workloadClient);
  }

  /** Provision user (once per session) and cache initial token. */
  async initialize(workspaceId: string): Promise<void> {
    const tokenResult = await this.fabricAuth.acquireAccessToken(
      SCOPES.ITEM_READ
    );
    this.cachedToken = tokenResult.token;
    this.tokenExpiry = Date.now() + 3600_000;

    if (!this.provisioned) {
      const res = await fetch(
        `${INTUIGENCE_API_URL}/api/v1/auth/fabric-provision`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenResult.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workspaceId }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Provisioning failed (${res.status}): ${text}`);
      }
      this.provisioned = true;
    }
  }

  /** Get Azure AD token for API calls, refreshing if near expiry. */
  async getToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiry - 120_000) {
      return this.cachedToken;
    }
    const tokenResult = await this.fabricAuth.acquireAccessToken(
      SCOPES.ITEM_READ
    );
    this.cachedToken = tokenResult.token;
    this.tokenExpiry = Date.now() + 3600_000;
    return this.cachedToken;
  }

  /**
   * Get a token whose audience is the workload app itself.
   * Required for OBO: the backend exchanges this token for downstream scopes
   * (e.g., Azure Storage for OneLake access).
   *
   * Uses acquireFrontendAccessToken with the workload app's own scope so the
   * resulting token's audience = the workload app ID, which OBO requires.
   * This works when clientSideAuth=1 is enabled (the default in dev mode).
   */
  async getWorkloadToken(): Promise<string> {
    const appId = process.env.DEV_AAD_CONFIG_FE_APPID;
    if (!appId) {
      throw new Error('DEV_AAD_CONFIG_FE_APPID is not configured');
    }

    // Request a token for our own app using {clientId}/.default format.
    // This produces a token with audience = our workload app, which OBO requires.
    const result = await this.workloadClient.auth.acquireFrontendAccessToken({
      scopes: [`${appId}/.default`],
    });
    return result.token;
  }

  /** Clear cached token (e.g. on 401 retry). */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }
}
