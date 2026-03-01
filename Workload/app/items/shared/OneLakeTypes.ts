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

export const PREVIEWABLE_EXTENSIONS = new Set([
    "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg",
]);

export const IMAGE_EXTENSIONS = new Set([
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

export function getMimeType(name: string): string {
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
