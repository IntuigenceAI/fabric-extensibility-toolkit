export function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

const WORKLOAD_AUTH_ERROR_MESSAGES: Record<number, string> = {
    0: "Authentication is not supported in this environment. Open this workload through the Fabric portal (https://app.fabric.microsoft.com) instead of localhost.",
    1: "User interaction failed during authentication. Please try again.",
    2: "Workload authentication configuration error. Verify that your Entra App registration (FRONTEND_APPID) and redirect URIs are configured correctly.",
};

export function getErrorMessage(err: unknown): string {
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
