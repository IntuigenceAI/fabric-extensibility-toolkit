import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Spinner, MessageBar, MessageBarBody } from "@fluentui/react-components";
import { PageProps, ContextProps } from "../../App";
import {
    IntuigenceAppConfig,
    IntuigenceMessageType,
    FabricContext
} from "./IntuigenceAppConfig";
import "./IntuigenceApp.scss";

/**
 * IntuigenceAppEditor - Embeds the full IntuigenceAI application
 *
 * This is a thin wrapper that:
 * 1. Extracts Fabric context (item ID from URL)
 * 2. Renders an iframe pointing to the IntuigenceAI app
 * 3. Passes context via URL params and/or postMessage
 */
export function IntuigenceAppEditor({ workloadClient }: PageProps) {
    const { itemObjectId } = useParams<ContextProps>();
    const { t } = useTranslation();
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // State
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [fabricContext, setFabricContext] = useState<FabricContext | null>(null);
    const [appReady, setAppReady] = useState(false);

    /**
     * Load Fabric context on mount
     */
    useEffect(() => {
        async function loadFabricContext() {
            try {
                // Initialize context with basic info
                const context: FabricContext = {
                    workspaceId: '',
                    itemId: itemObjectId || '',
                };

                // Note: Not extracting user email from Fabric token
                // IntuigenceAI will handle its own authentication via Keycloak
                console.log("Skipping token acquisition - app will handle its own auth");

                // Try to get item info if we have an itemObjectId
                if (itemObjectId) {
                    try {
                        const itemResult = await workloadClient.itemCrud.getItem({ itemId: itemObjectId });
                        if (itemResult?.item) {
                            context.workspaceId = itemResult.item.workspaceId || '';
                            context.itemName = itemResult.item.displayName;
                        }
                    } catch (e) {
                        console.warn("Could not load item info:", e);
                    }
                }

                console.log("Fabric context loaded:", context);
                setFabricContext(context);
                setIsLoading(false);

            } catch (err) {
                console.error("Failed to load Fabric context:", err);
                setError(t("IntuigenceApp_Error_Context", "Failed to load workspace context"));
                setIsLoading(false);
            }
        }

        loadFabricContext();
    }, [workloadClient, itemObjectId, t]);

    /**
     * Handle messages from embedded IntuigenceAI app
     */
    const handleMessage = useCallback((event: MessageEvent) => {
        // Validate origin - allow intuigence.ai and localhost for dev
        const allowedOrigins = ['intuigence.ai', 'localhost', '127.0.0.1'];
        const isAllowedOrigin = allowedOrigins.some(origin => event.origin.includes(origin));

        if (!isAllowedOrigin) {
            return;
        }

        const { type, payload } = event.data || {};

        switch (type) {
            case IntuigenceMessageType.APP_READY:
                console.log("IntuigenceAI app is ready");
                setAppReady(true);
                // Send context once app is ready
                if (fabricContext && iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.postMessage({
                        type: IntuigenceMessageType.FABRIC_CONTEXT,
                        payload: fabricContext
                    }, IntuigenceAppConfig.baseUrl);
                }
                break;

            case IntuigenceMessageType.APP_ERROR:
                console.error("IntuigenceAI app error:", payload);
                setError(payload?.message || "Application error");
                break;

            case IntuigenceMessageType.NAVIGATION_REQUEST:
                console.log("Navigation request:", payload);
                // Future: Handle navigation requests
                break;

            case IntuigenceMessageType.NOTIFICATION_REQUEST:
                console.log("Notification request:", payload);
                // Future: Forward to Fabric notifications
                break;
        }
    }, [fabricContext]);

    /**
     * Set up message listener
     */
    useEffect(() => {
        if (IntuigenceAppConfig.features.enablePostMessage) {
            window.addEventListener('message', handleMessage);
            return () => window.removeEventListener('message', handleMessage);
        }
        return undefined;
    }, [handleMessage]);

    /**
     * Build iframe URL with context parameters
     */
    const buildIframeUrl = (): string => {
        const url = new URL(IntuigenceAppConfig.baseUrl);

        // Add Fabric embed mode indicator
        // This tells IntuigenceAI to use Azure AD authentication via Keycloak
        url.searchParams.set('embed', IntuigenceAppConfig.embedMode);

        // Add loginHint for SSO - IntuigenceAI will pass this to Keycloak
        // which will then pass it to Azure AD for seamless sign-in
        if (fabricContext?.userEmail) {
            url.searchParams.set('loginHint', fabricContext.userEmail);
        }

        // Add Fabric context
        if (fabricContext?.workspaceId) {
            url.searchParams.set('workspaceId', fabricContext.workspaceId);
        }
        if (fabricContext?.itemId) {
            url.searchParams.set('itemId', fabricContext.itemId);
        }
        if (fabricContext?.itemName) {
            url.searchParams.set('itemName', fabricContext.itemName);
        }

        return url.toString();
    };

    /**
     * Handle iframe load event
     */
    const handleIframeLoad = () => {
        console.log("IntuigenceAI iframe loaded");
        // Mark as ready when iframe loads - postMessage APP_READY is optional enhancement
        setAppReady(true);
    };

    /**
     * Handle iframe error
     */
    const handleIframeError = () => {
        setError(t("IntuigenceApp_Error_Load", "Failed to load IntuigenceAI application"));
    };

    // Loading state
    if (isLoading) {
        return (
            <div className="intuigence-app-loading">
                <Spinner size="large" label={t("IntuigenceApp_Loading", "Loading IntuigenceAI...")} />
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="intuigence-app-error">
                <MessageBar intent="error">
                    <MessageBarBody>{error}</MessageBarBody>
                </MessageBar>
            </div>
        );
    }

    // Render embedded app
    return (
        <div className="intuigence-app-container">
            {/* Loading overlay while app initializes */}
            {!appReady && (
                <div className="intuigence-app-loading-overlay">
                    <Spinner size="medium" label="Initializing IntuigenceAI..." />
                </div>
            )}

            {/* Main iframe */}
            <iframe
                ref={iframeRef}
                src={buildIframeUrl()}
                className="intuigence-app-iframe"
                title="IntuigenceAI"
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                allow="clipboard-write"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
            />
        </div>
    );
}
