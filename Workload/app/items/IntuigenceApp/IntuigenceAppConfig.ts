/**
 * Configuration for the IntuigenceAI embedded application
 */
export const IntuigenceAppConfig = {
    // Base URL for the IntuigenceAI application
    // Development: local or staging instance
    // Production: production deployment
    // For local testing: http://localhost:3000
    // For dev/prod: https://app.dev.intuigence.ai
    baseUrl: process.env.INTUIGENCE_APP_URL || 'http://localhost:3000',

    // Loading timeout in milliseconds
    loadingTimeout: 30000,

    // Embed mode identifier for IntuigenceAI to detect Fabric embedding
    embedMode: 'fabric' as const,

    // Feature flags
    features: {
        enablePostMessage: true,
        enableFileDownloads: false,  // Requires EnableSandboxRelaxation
    }
} as const;

/**
 * Decode a JWT token to extract claims (without verification)
 * Used to get user email from Fabric access token
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        // Decode the payload (second part)
        const payload = parts[1];
        const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
        return JSON.parse(decoded);
    } catch (error) {
        console.warn('Failed to decode JWT:', error);
        return null;
    }
}

/**
 * Extract user email from JWT token claims
 * Tries multiple claim names as different IdPs use different claim names
 */
export function extractEmailFromToken(token: string): string | undefined {
    const claims = decodeJwtClaims(token);
    if (!claims) {
        return undefined;
    }

    // Try different claim names (Azure AD uses different ones in different contexts)
    const email = claims.email ||
                  claims.upn ||
                  claims.unique_name ||
                  claims.preferred_username;

    return typeof email === 'string' ? email : undefined;
}

/**
 * Message types for postMessage communication
 */
export enum IntuigenceMessageType {
    // From Fabric to IntuigenceAI
    FABRIC_CONTEXT = 'FABRIC_CONTEXT',
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
