import { useState, useEffect, useCallback, useRef } from "react";
import { WorkloadClientAPI } from "@ms-fabric/workload-client";
import { FabricPlatformAPIClient } from "../../clients/FabricPlatformAPIClient";
import { OneLakeStorageClient } from "../../clients/OneLakeStorageClient";

// ---------------------------------------------------------------------------
// Error helpers
// ---------------------------------------------------------------------------

const WORKLOAD_AUTH_ERROR_MESSAGES: Record<number, string> = {
    0: "Authentication is not supported in this environment. Open this workload through the Fabric portal (https://app.fabric.microsoft.com) instead of localhost.",
    1: "User interaction failed during authentication. Please try again.",
    2: "Workload authentication configuration error. Verify that your Entra App registration (FRONTEND_APPID) and redirect URIs are configured correctly.",
};

function getErrorMessage(err: unknown): string {
    if (!err) return "Unknown error";
    if (err instanceof Error && err.message) return err.message;
    if (typeof err === "object" && err !== null) {
        const obj = err as Record<string, unknown>;
        if (typeof obj.error === "number" && obj.error in WORKLOAD_AUTH_ERROR_MESSAGES) {
            return WORKLOAD_AUTH_ERROR_MESSAGES[obj.error];
        }
        if (typeof obj.error === "string") return obj.error;
        if (typeof obj.message === "string") return obj.message;
        if (typeof obj.statusCode === "number") {
            return `HTTP ${obj.statusCode}: ${obj.statusText || "Request failed"}`;
        }
    }
    if (typeof err === "string") return err;
    return JSON.stringify(err);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single file from OneLake, flattened for display */
export interface OneLakeFile {
    /** Full OneLake path relative to workspace (e.g. "{lakehouseId}/Files/doc.pdf") */
    fullPath: string;
    /** Display file name (e.g. "doc.pdf") */
    name: string;
    /** Relative path within the Files folder (e.g. "subfolder/doc.pdf") */
    relativePath: string;
    /** File size in bytes */
    size: number;
    /** Last modified date string */
    lastModified: string;
    /** Name of the Lakehouse this file belongs to */
    lakehouseName: string;
    /** ID of the Lakehouse */
    lakehouseId: string;
}

/** Preview state for a selected file */
export interface FilePreview {
    file: OneLakeFile;
    blobUrl: string | null;
    loading: boolean;
    error: string | null;
}

export interface OneLakeFileBrowserState {
    files: OneLakeFile[];
    selectedFile: FilePreview | null;
    loading: boolean;
    error: string | null;
    workspaceId: string | null;
    searchQuery: string;
}

const PREVIEWABLE_EXTENSIONS = new Set([
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg",
]);

const IMAGE_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "webp", "svg",
]);

export function getFileExtension(name: string): string {
    return (name.split(".").pop() || "").toLowerCase();
}

export function isPreviewable(name: string): boolean {
    return PREVIEWABLE_EXTENSIONS.has(getFileExtension(name));
}

export function isImage(name: string): boolean {
    return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

export function isPdf(name: string): boolean {
    return getFileExtension(name) === "pdf";
}

function getMimeType(name: string): string {
    const ext = getFileExtension(name);
    const map: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        svg: "image/svg+xml",
        txt: "text/plain",
        json: "application/json",
        csv: "text/csv",
    };
    return map[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Simplified OneLake file browser hook.
 *
 * On mount it:
 * 1. Resolves the current workspace from the item context
 * 2. Finds all Lakehouses in that workspace
 * 3. Lists all files in each Lakehouse's Files/ folder recursively
 * 4. Presents a flat file list
 *
 * Supports selecting a file to preview (PDF/image) or download.
 */
export function useOneLakeCatalog(
    workloadClient: WorkloadClientAPI,
    itemObjectId?: string
) {
    const [state, setState] = useState<OneLakeFileBrowserState>({
        files: [],
        selectedFile: null,
        loading: false,
        error: null,
        workspaceId: null,
        searchQuery: "",
    });

    const clientRef = useRef<FabricPlatformAPIClient | null>(null);

    // Initialize client
    useEffect(() => {
        clientRef.current = FabricPlatformAPIClient.create(workloadClient);
    }, [workloadClient]);

    // -----------------------------------------------------------------------
    // Load all files on mount
    // -----------------------------------------------------------------------
    const loadFiles = useCallback(async () => {
        const client = clientRef.current;
        if (!client) return;

        setState(prev => ({ ...prev, loading: true, error: null }));

        try {
            // Step 1: Resolve workspace ID from the current item
            let workspaceId: string | null = null;

            if (itemObjectId) {
                try {
                    const itemResult = await workloadClient.itemCrud.getItem({
                        itemId: itemObjectId,
                    });
                    workspaceId = itemResult?.item?.workspaceId || null;
                } catch (e) {
                    console.warn("Could not resolve workspace from item:", e);
                }
            }

            // Fallback: get the first workspace the user has access to
            if (!workspaceId) {
                const workspaces = await client.workspaces.getAllWorkspaces();
                if (workspaces.length > 0) {
                    workspaceId = workspaces[0].id;
                }
            }

            if (!workspaceId) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    error: "No workspace found. Please ensure you have access to a Fabric workspace.",
                }));
                return;
            }

            // Step 2: Find all Lakehouses in the workspace
            const allItems = await client.items.getAllItems(workspaceId);
            const lakehouses = allItems.filter(item => item.type === "Lakehouse");

            if (lakehouses.length === 0) {
                setState(prev => ({
                    ...prev,
                    loading: false,
                    workspaceId,
                    files: [],
                    error: "No Lakehouses found in this workspace. Create a Lakehouse and upload files to see them here.",
                }));
                return;
            }

            // Step 3: For each Lakehouse, list Files/ recursively
            const allFiles: OneLakeFile[] = [];

            for (const lakehouse of lakehouses) {
                try {
                    const filesPath = `${lakehouse.id}/Files`;
                    const metadata = await client.oneLakeStorage.getPathMetadata(
                        workspaceId,
                        filesPath,
                        true, // recursive
                        false
                    );

                    for (const p of metadata.paths || []) {
                        // Skip directories -- only want files
                        if (String(p.isDirectory) === "true") continue;

                        const fullPath = OneLakeStorageClient.getPath(
                            workspaceId,
                            lakehouse.id,
                            // p.name is relative to the filesystem (workspace), 
                            // and already includes "{lakehouseId}/Files/..."
                            // We need just the part after {lakehouseId}/
                            p.name.startsWith(`${lakehouse.id}/`)
                                ? p.name.substring(lakehouse.id.length + 1)
                                : p.name
                        );

                        // Relative path within Files/
                        const filesPrefix = `${lakehouse.id}/Files/`;
                        const relativePath = p.name.startsWith(filesPrefix)
                            ? p.name.substring(filesPrefix.length)
                            : p.name;

                        const fileName = relativePath.split("/").pop() || relativePath;

                        allFiles.push({
                            fullPath,
                            name: fileName,
                            relativePath,
                            size: Number(p.contentLength) || 0,
                            lastModified: p.lastModified || "",
                            lakehouseName: lakehouse.displayName,
                            lakehouseId: lakehouse.id,
                        });
                    }
                } catch (e) {
                    console.warn(`Failed to list files in Lakehouse "${lakehouse.displayName}":`, e);
                    // Continue with other lakehouses
                }
            }

            setState(prev => ({
                ...prev,
                files: allFiles,
                workspaceId,
                loading: false,
            }));
        } catch (err: unknown) {
            console.error("Failed to load files:", err);
            setState(prev => ({
                ...prev,
                loading: false,
                error: getErrorMessage(err),
            }));
        }
    }, [workloadClient, itemObjectId]);

    // Auto-load on mount
    useEffect(() => {
        // Small delay to ensure clientRef is set
        const timer = setTimeout(loadFiles, 100);
        return () => clearTimeout(timer);
    }, [loadFiles]);

    // -----------------------------------------------------------------------
    // File selection & preview
    // -----------------------------------------------------------------------
    const selectFile = useCallback(async (file: OneLakeFile) => {
        const client = clientRef.current;
        if (!client) return;

        // Revoke previous blob URL
        setState(prev => {
            if (prev.selectedFile?.blobUrl) {
                URL.revokeObjectURL(prev.selectedFile.blobUrl);
            }
            return {
                ...prev,
                selectedFile: { file, blobUrl: null, loading: true, error: null },
            };
        });

        try {
            const base64 = await client.oneLakeStorage.readFileAsBase64(file.fullPath);

            // Convert base64 to blob URL
            const binaryStr = atob(base64);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: getMimeType(file.name) });
            const blobUrl = URL.createObjectURL(blob);

            setState(prev => ({
                ...prev,
                selectedFile: { file, blobUrl, loading: false, error: null },
            }));
        } catch (err: unknown) {
            console.error("Failed to load file:", err);
            setState(prev => ({
                ...prev,
                selectedFile: {
                    file,
                    blobUrl: null,
                    loading: false,
                    error: `Failed to load file: ${getErrorMessage(err)}`,
                },
            }));
        }
    }, []);

    const closePreview = useCallback(() => {
        setState(prev => {
            if (prev.selectedFile?.blobUrl) {
                URL.revokeObjectURL(prev.selectedFile.blobUrl);
            }
            return { ...prev, selectedFile: null };
        });
    }, []);

    const downloadFile = useCallback(() => {
        const preview = state.selectedFile;
        if (!preview?.blobUrl) return;

        const a = document.createElement("a");
        a.href = preview.blobUrl;
        a.download = preview.file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }, [state.selectedFile]);

    const setSearchQuery = useCallback((query: string) => {
        setState(prev => ({ ...prev, searchQuery: query }));
    }, []);

    const clearError = useCallback(() => {
        setState(prev => ({ ...prev, error: null }));
    }, []);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            if (state.selectedFile?.blobUrl) {
                URL.revokeObjectURL(state.selectedFile.blobUrl);
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // -----------------------------------------------------------------------
    // Filtered files
    // -----------------------------------------------------------------------
    const filteredFiles = state.searchQuery
        ? state.files.filter(f =>
            f.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
            f.lakehouseName.toLowerCase().includes(state.searchQuery.toLowerCase())
        )
        : state.files;

    return {
        files: filteredFiles,
        allFiles: state.files,
        selectedFile: state.selectedFile,
        loading: state.loading,
        error: state.error,
        searchQuery: state.searchQuery,
        loadFiles,
        selectFile,
        closePreview,
        downloadFile,
        setSearchQuery,
        clearError,
    };
}
