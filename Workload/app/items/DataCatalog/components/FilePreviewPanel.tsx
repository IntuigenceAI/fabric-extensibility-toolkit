import React, { useState } from "react";
import {
    Button,
    Spinner,
    tokens,
    makeStyles,
    shorthands,
    Body1,
    Caption1,
    Subtitle1,
    Subtitle2,
} from "@fluentui/react-components";
import {
    DocumentPdfRegular,
    ImageRegular,
    DocumentRegular,
    ArrowDownloadRegular,
    OpenRegular,
    DismissRegular,
} from "@fluentui/react-icons";
import type { OneLakeFile, FilePreview } from "../../shared/OneLakeTypes";
import {
    isImage,
    isPdf,
    getFileExtension,
} from "../../shared/OneLakeTypes";
import { formatFileSize } from "../../shared/formatters";
import { DocumentTypeSelector } from "./DocumentTypeSelector";
import type { ProcessingJob } from "../hooks/useDataCatalog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FilePreviewPanelProps {
    preview: FilePreview;
    onClose: () => void;
    onDownload: () => void;
    onProcess: (file: OneLakeFile, docType: string) => void;
    processingStatus?: ProcessingJob;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        width: "55%",
        minWidth: "300px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.padding("10px", "16px"),
        ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
        columnGap: "12px",
    },
    headerLeft: {
        display: "flex",
        alignItems: "center",
        columnGap: "8px",
        minWidth: 0,
        ...shorthands.flex(1),
    },
    headerActions: {
        display: "flex",
        alignItems: "center",
        columnGap: "4px",
        flexShrink: 0,
    },
    fileIcon: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "36px",
        height: "36px",
        ...shorthands.borderRadius("6px"),
        flexShrink: 0,
    },
    fileMeta: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.flex(1),
        minWidth: 0,
    },
    fileName: {
        ...shorthands.overflow("hidden"),
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    fileDetail: {
        color: tokens.colorNeutralForeground3,
    },
    content: {
        ...shorthands.flex(1),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflowY: "auto",
    },
    previewImage: {
        maxWidth: "100%",
        maxHeight: "100%",
        objectFit: "contain",
    },
    fallback: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        rowGap: "16px",
        ...shorthands.padding("32px"),
        color: tokens.colorNeutralForeground3,
    },
    processGroup: {
        display: "flex",
        alignItems: "center",
        columnGap: "4px",
    },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getProcessButtonText(status?: ProcessingJob): string {
    if (!status) return "Process";
    switch (status.status) {
        case "submitting":
        case "processing":
            return "Processing...";
        case "success":
            return "Processed";
        case "failed":
            return "Failed - Retry";
        default:
            return "Process";
    }
}

function isProcessBusy(status?: ProcessingJob): boolean {
    if (!status) return false;
    return status.status === "submitting" || status.status === "processing";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FilePreviewPanel({
    preview,
    onClose,
    onDownload,
    onProcess,
    processingStatus,
}: FilePreviewPanelProps) {
    const styles = useStyles();
    const [docType, setDocType] = useState("document");

    // -----------------------------------------------------------------------
    // File icon helper
    // -----------------------------------------------------------------------
    const renderFileIcon = () => {
        const ext = getFileExtension(preview.file.name);
        let icon = <DocumentRegular fontSize={20} />;
        let bg = tokens.colorNeutralBackground3;
        let fg = tokens.colorNeutralForeground3;

        if (ext === "pdf") {
            icon = <DocumentPdfRegular fontSize={20} />;
            bg = tokens.colorPaletteRedBackground2;
            fg = tokens.colorPaletteRedForeground2;
        } else if (isImage(preview.file.name)) {
            icon = <ImageRegular fontSize={20} />;
            bg = tokens.colorPalettePurpleBackground2;
            fg = tokens.colorPalettePurpleForeground2;
        }

        return (
            <div className={styles.fileIcon} style={{ backgroundColor: bg, color: fg }}>
                {icon}
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Content renderer
    // -----------------------------------------------------------------------
    const renderContent = () => {
        if (preview.loading) {
            return <Spinner size="large" label="Loading file..." />;
        }

        if (preview.error) {
            return (
                <div className={styles.fallback}>
                    <Body1>{preview.error}</Body1>
                </div>
            );
        }

        if (!preview.blobUrl) {
            return null;
        }

        // Image preview
        if (isImage(preview.file.name)) {
            return (
                <img
                    className={styles.previewImage}
                    src={preview.blobUrl}
                    alt={preview.file.name}
                />
            );
        }

        // PDF preview
        if (isPdf(preview.file.name)) {
            return (
                <div className={styles.fallback}>
                    <DocumentPdfRegular fontSize={64} />
                    <Subtitle1>{preview.file.name}</Subtitle1>
                    <Caption1>
                        PDF &middot; {formatFileSize(preview.file.size)}
                    </Caption1>
                    <Button
                        appearance="primary"
                        icon={<OpenRegular />}
                        onClick={() => window.open(preview.blobUrl!, "_blank")}
                    >
                        Open in New Tab
                    </Button>
                    <Button
                        appearance="secondary"
                        icon={<ArrowDownloadRegular />}
                        onClick={onDownload}
                    >
                        Download
                    </Button>
                </div>
            );
        }

        // Generic fallback
        return (
            <div className={styles.fallback}>
                <DocumentRegular fontSize={64} />
                <Subtitle1>{preview.file.name}</Subtitle1>
                <Caption1>
                    {getFileExtension(preview.file.name).toUpperCase()} file &middot;{" "}
                    {formatFileSize(preview.file.size)}
                </Caption1>
                <Button
                    appearance="primary"
                    icon={<ArrowDownloadRegular />}
                    onClick={onDownload}
                >
                    Download File
                </Button>
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------
    return (
        <div className={styles.root}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {renderFileIcon()}
                    <div className={styles.fileMeta}>
                        <Subtitle2 className={styles.fileName}>
                            {preview.file.name}
                        </Subtitle2>
                        <Caption1 className={styles.fileDetail}>
                            {formatFileSize(preview.file.size)} &middot; {preview.file.lakehouseName}
                        </Caption1>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <div className={styles.processGroup}>
                        <DocumentTypeSelector value={docType} onChange={setDocType} />
                        <Button
                            appearance="primary"
                            onClick={() => onProcess(preview.file, docType)}
                            disabled={isProcessBusy(processingStatus)}
                        >
                            {getProcessButtonText(processingStatus)}
                        </Button>
                    </div>
                    <Button
                        icon={<ArrowDownloadRegular />}
                        appearance="subtle"
                        onClick={onDownload}
                        disabled={!preview.blobUrl}
                    >
                        Download
                    </Button>
                    <Button
                        icon={<DismissRegular />}
                        appearance="subtle"
                        onClick={onClose}
                    />
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                {renderContent()}
            </div>
        </div>
    );
}
