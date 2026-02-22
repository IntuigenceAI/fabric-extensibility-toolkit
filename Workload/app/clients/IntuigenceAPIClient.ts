import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { IntuigenceAuthBridge } from "./IntuigenceAuthBridge";

const INTUIGENCE_API_URL =
  process.env.INTUIGENCE_API_URL || "http://localhost:3001";

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

export interface JobStatus {
  id: string;
  status: "processing" | "success" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

export interface DocumentDetails {
  id: string;
  fileName: string;
  status: string;
  mimeType?: string;
  createdAt: string;
  [key: string]: unknown;
}

export interface DocumentList {
  items: DocumentDetails[];
  total: number;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

/**
 * Typed HTTP client for the IntuigenceAI backend.
 *
 * All requests are authenticated with an Azure AD token obtained via
 * {@link IntuigenceAuthBridge}. On a 401, the client clears the token cache
 * and retries once.
 */
export class IntuigenceAPIClient {
  private authBridge: IntuigenceAuthBridge;
  private baseUrl: string;
  private workspaceId: string;

  constructor(workloadClient: WorkloadClientAPI, workspaceId: string) {
    this.authBridge = new IntuigenceAuthBridge(workloadClient);
    this.baseUrl = INTUIGENCE_API_URL;
    this.workspaceId = workspaceId;
  }

  // -------------------------------------------------------------------------
  // Generic request helper
  // -------------------------------------------------------------------------

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const doFetch = async (): Promise<Response> => {
      const token = await this.authBridge.getToken();
      return fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Fabric-Workspace-Id": this.workspaceId,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    };

    let res = await doFetch();

    // Auto-retry on 401: clear cache, re-auth, try once more
    if (res.status === 401) {
      this.authBridge.clearCache();
      res = await doFetch();
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`IntuigenceAI API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  // -------------------------------------------------------------------------
  // Typed endpoint methods
  // -------------------------------------------------------------------------

  /** Check async job status. */
  getJobStatus(jobId: string): Promise<JobStatus> {
    return this.request("GET", `/api/v1/async-jobs/${jobId}`);
  }

  /** Get document details. */
  getDocument(documentId: string): Promise<DocumentDetails> {
    return this.request("GET", `/api/v1/documents/${documentId}`);
  }

  /** List documents for the current tenant. */
  listDocuments(params?: {
    page?: number;
    pageSize?: number;
  }): Promise<DocumentList> {
    const qs = new URLSearchParams();
    if (params?.page !== undefined) qs.set("page", String(params.page));
    if (params?.pageSize !== undefined)
      qs.set("pageSize", String(params.pageSize));
    const query = qs.toString() ? `?${qs}` : "";
    return this.request("GET", `/api/v1/documents${query}`);
  }
}
