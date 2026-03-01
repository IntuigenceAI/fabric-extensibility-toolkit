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
  is_indexed?: boolean;
  createdAt: string;
  [key: string]: unknown;
}

export interface DocumentList {
  items: DocumentDetails[];
  total: number;
}

export interface FileUploadResult {
  id: string;
  file: FileStatusResponse;
}

export interface FileStatusResponse {
  id: string;
  originalFilename: string;
  fileSize: number | null;
  mimeType: string | null;
  fileType: string;
  uploadStatus: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'cancelled';
  processingStatus: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'skipped';
  processingErrorMessage: string | null;
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

  // -------------------------------------------------------------------------
  // File upload + processing methods (Phase 2)
  // -------------------------------------------------------------------------

  /** Provision the user/tenant (delegates to auth bridge). */
  async initialize(workspaceId: string): Promise<void> {
    await this.authBridge.initialize(workspaceId);
  }

  /** Get a fresh auth token (for iframe PostMessage). */
  async getToken(): Promise<string> {
    return this.authBridge.getToken();
  }

  /** Upload a file via multipart form data. */
  async uploadFile(file: File, fileType: string): Promise<FileUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileType', fileType);

    const doFetch = async (): Promise<Response> => {
      const token = await this.authBridge.getToken();
      return fetch(`${this.baseUrl}/api/v2/files/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Fabric-Workspace-Id': this.workspaceId,
          // Do NOT set Content-Type — browser sets multipart boundary
        },
        body: formData,
      });
    };

    let res = await doFetch();
    if (res.status === 401) {
      this.authBridge.clearCache();
      res = await doFetch();
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Upload failed (${res.status}): ${text}`);
    }

    return res.json();
  }

  /** Upload a file from base64 content (for OneLake-sourced files). */
  async uploadFileFromBase64(
    base64: string,
    fileName: string,
    mimeType: string,
    fileType: string
  ): Promise<FileUploadResult> {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], fileName, { type: mimeType });
    return this.uploadFile(file, fileType);
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

  /** Get file processing status. */
  getFileStatus(fileId: string): Promise<FileStatusResponse> {
    return this.request("GET", `/api/v2/files/${fileId}`);
  }

  /** Delete a document. */
  deleteDocument(docId: string): Promise<{ success: boolean }> {
    return this.request("DELETE", `/api/v1/documents/${docId}`);
  }

  // -------------------------------------------------------------------------
  // Workspace (board) methods (Phase 3)
  // -------------------------------------------------------------------------

  /** Create a new workspace (board) in IntuigenceAI. */
  createWorkspace(name: string): Promise<{ id: string; name: string }> {
    return this.request("POST", "/api/v1/workspaces", { name, documents: [] });
  }
}
