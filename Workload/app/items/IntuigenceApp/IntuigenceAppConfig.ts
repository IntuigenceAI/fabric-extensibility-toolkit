/**
 * Configuration for the IntuigenceAI embedded application
 */
export const IntuigenceAppConfig = {
    // Base URL for the IntuigenceAI application
    // Development: local or staging instance
    // Production: production deployment
    baseUrl: process.env.INTUIGENCE_APP_URL || 'https://app.dev.intuigence.ai',

    // Loading timeout in milliseconds
    loadingTimeout: 30000,

    // Feature flags
    features: {
        enablePostMessage: true,
        enableAuthBridge: false,  // Phase 3
        enableFileDownloads: false,  // Requires EnableSandboxRelaxation
    }
} as const;

/**
 * Message types for postMessage communication
 */
export enum IntuigenceMessageType {
    // From Fabric to IntuigenceAI
    FABRIC_CONTEXT = 'FABRIC_CONTEXT',
    FABRIC_AUTH_TOKEN = 'FABRIC_AUTH_TOKEN',
    FABRIC_THEME = 'FABRIC_THEME',

    // From IntuigenceAI to Fabric
    APP_READY = 'APP_READY',
    APP_ERROR = 'APP_ERROR',
    NAVIGATION_REQUEST = 'NAVIGATION_REQUEST',
    NOTIFICATION_REQUEST = 'NOTIFICATION_REQUEST',
}

/**
 * Fabric context passed to IntuigenceAI
 */
export interface FabricContext {
    workspaceId: string;
    workspaceName?: string;
    itemId: string;
    itemName?: string;
    userId?: string;
    userEmail?: string;
    tenantId?: string;
    theme?: 'light' | 'dark';
}
