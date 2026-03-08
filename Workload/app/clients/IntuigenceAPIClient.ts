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
  name: string;
  status: string | null;
  is_indexed: boolean;
  created_at: string;
  file_size: number | null;
  error_message: string | null;
  properties: Record<string, unknown>;
  type: string;
  [key: string]: unknown;
}

export interface DocumentList {
  items: DocumentDetails[];
  total: number;
}

// ---------------------------------------------------------------------------
// OneLake server-side ingestion types
// ---------------------------------------------------------------------------

export interface OneLakeIngestRequest {
  files: Array<{
    workspaceId: string;
    itemId: string;
    selectedPath: string;
    fileName: string;
    mimeType?: string;
    fileType?: string;
  }>;
}

export interface OneLakeIngestResultItem {
  fileName: string;
  fileId: string | null;
  status: 'accepted' | 'failed';
  error?: string;
}

export interface OneLakeIngestResponse {
  results: OneLakeIngestResultItem[];
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
  async getDocument(documentId: string): Promise<DocumentDetails> {
    const res = await this.request<{ document: DocumentDetails }>("GET", `/api/v1/documents/${documentId}`);
    return res.document;
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

  /** Provision the user/tenant (delegates to auth bridge). */
  async initialize(workspaceId: string): Promise<void> {
    await this.authBridge.initialize(workspaceId);
  }

  /** Get a fresh auth token (for iframe PostMessage). */
  async getToken(): Promise<string> {
    return this.authBridge.getToken();
  }

  /**
   * Ingest files from OneLake server-side.
   * Uses a workload-audience token (from acquireAccessToken) so the backend
   * can exchange it via OBO for a OneLake-scoped storage token.
   */
  async ingestFromOneLake(request: OneLakeIngestRequest): Promise<OneLakeIngestResponse> {
    const token = await this.authBridge.getWorkloadToken();

    const res = await fetch(`${this.baseUrl}/api/v2/files/ingest-onelake`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Fabric-Workspace-Id': this.workspaceId,
      },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`IntuigenceAI API error ${res.status}: ${text}`);
    }

    return res.json();
  }

  /** Batch delete documents. */
  deleteDocuments(docIds: string[]): Promise<{ success: boolean }> {
    return this.request("DELETE", "/api/v1/documents", { doc_ids: docIds });
  }

  /** Cleanup orphaned graph documents after P&ID deletion. */
  cleanupOrphanedGraphs(): Promise<{ deleted_count: number }> {
    return this.request("POST", "/api/v1/documents/cleanup-orphaned-graphs");
  }

  // -------------------------------------------------------------------------
  // Workspace (board) methods (Phase 3)
  // -------------------------------------------------------------------------

  /** Create a new workspace (board) in IntuigenceAI. */
  createWorkspace(name: string): Promise<{ id: string; name: string }> {
    return this.request("POST", "/api/v1/workspaces", { name, documents: [] });
  }
}
