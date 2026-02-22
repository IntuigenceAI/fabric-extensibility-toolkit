import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { FabricAuthenticationService } from "./FabricAuthenticationService";
import { SCOPES } from "./FabricPlatformScopes";

const INTUIGENCE_API_URL =
  process.env.INTUIGENCE_API_URL || "http://localhost:3001";

/**
 * Bridges Fabric SDK authentication to IntuigenceAI backend.
 *
 * Flow:
 *   1. Acquire Azure AD token via Fabric SDK
 *   2. POST to /v1/auth/fabric-provision (one-time per session)
 *      → Backend validates token via Microsoft JWKS, creates tenant/user mappings
 *   3. Subsequent API calls send the Azure AD token directly
 *      → Both NestJS and Python backends validate via dual-JWKS (Microsoft + Keycloak)
 *
 * No token exchange. No self-signed tokens. Azure AD token is used directly.
 */
export class IntuigenceAuthBridge {
  private fabricAuth: FabricAuthenticationService;
  private provisioned = false;
  private cachedToken: string | null = null;
  private tokenExpiry = 0;

  constructor(workloadClient: WorkloadClientAPI) {
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

  /** Clear cached token (e.g. on 401 retry). */
  clearCache(): void {
    this.cachedToken = null;
    this.tokenExpiry = 0;
  }
}
