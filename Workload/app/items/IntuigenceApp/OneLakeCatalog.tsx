import React from "react";
import { useParams } from "react-router-dom";
import {
    Spinner,
    MessageBar,
    MessageBarBody,
    MessageBarActions,
    Button,
    Input,
    Badge,
    tokens,
    makeStyles,
    shorthands,
    Subtitle1,
    Subtitle2,
    Body1,
    Caption1,
} from "@fluentui/react-components";
import {
    DocumentRegular,
    DocumentPdfRegular,
    ImageRegular,
    ArrowClockwiseRegular,
    ArrowDownloadRegular,
    OpenRegular,
    DismissRegular,
    SearchRegular,
    FolderRegular,
    DatabaseRegular,
} from "@fluentui/react-icons";
import { PageProps, ContextProps } from "../../App";
import {
    useOneLakeCatalog,
    OneLakeFile,
    isImage,
    isPdf,
    isPreviewable,
    getFileExtension,
} from "./useOneLakeCatalog";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: tokens.colorNeutralBackground2,
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.padding("12px", "24px"),
        backgroundColor: tokens.colorNeutralBackground1,
        ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
        columnGap: "16px",
    },
    headerTitle: {
        display: "flex",
        alignItems: "center",
        columnGap: "8px",
        flexShrink: 0,
    },
    searchBox: {
        ...shorthands.flex(1),
        maxWidth: "400px",
    },
    body: {
        display: "flex",
        ...shorthands.flex(1),
        overflowY: "hidden",
    },
    fileListPanel: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.flex(1),
        overflowY: "auto",
        ...shorthands.borderRight("1px", "solid", tokens.colorNeutralStroke2),
    },
    previewPanel: {
        display: "flex",
        flexDirection: "column",
        width: "55%",
        minWidth: "300px",
        backgroundColor: tokens.colorNeutralBackground1,
    },
    previewHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        ...shorthands.padding("10px", "16px"),
        ...shorthands.borderBottom("1px", "solid", tokens.colorNeutralStroke2),
        columnGap: "12px",
    },
    previewHeaderLeft: {
        display: "flex",
        alignItems: "center",
        columnGap: "8px",
        minWidth: 0,
        ...shorthands.flex(1),
    },
    previewHeaderActions: {
        display: "flex",
        alignItems: "center",
        columnGap: "4px",
        flexShrink: 0,
    },
    previewContent: {
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
    previewFallback: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        rowGap: "16px",
        ...shorthands.padding("32px"),
        color: tokens.colorNeutralForeground3,
    },
    errorBar: {
        ...shorthands.margin("12px", "24px", "0"),
    },
    fileRow: {
        display: "flex",
        alignItems: "center",
        columnGap: "12px",
        ...shorthands.padding("10px", "20px"),
        cursor: "pointer",
        ":hover": {
            backgroundColor: tokens.colorNeutralBackground1Hover,
        },
    },
    fileRowSelected: {
        display: "flex",
        alignItems: "center",
        columnGap: "12px",
        ...shorthands.padding("10px", "20px"),
        cursor: "pointer",
        backgroundColor: tokens.colorNeutralBackground1Selected,
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
    emptyState: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...shorthands.padding("64px", "24px"),
        color: tokens.colorNeutralForeground3,
        rowGap: "8px",
    },
    spinnerContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...shorthands.padding("64px"),
    },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OneLakeCatalog({ workloadClient }: PageProps) {
    const styles = useStyles();
    const { itemObjectId } = useParams<ContextProps>();
    const catalog = useOneLakeCatalog(workloadClient, itemObjectId);

    // -----------------------------------------------------------------------
    // File icon helper
    // -----------------------------------------------------------------------
    const renderFileIcon = (file: OneLakeFile) => {
        const ext = getFileExtension(file.name);
        let icon = <DocumentRegular fontSize={20} />;
        let bg = tokens.colorNeutralBackground3;
        let fg = tokens.colorNeutralForeground3;

        if (ext === "pdf") {
            icon = <DocumentPdfRegular fontSize={20} />;
            bg = tokens.colorPaletteRedBackground2;
            fg = tokens.colorPaletteRedForeground2;
        } else if (isImage(file.name)) {
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
    // File list
    // -----------------------------------------------------------------------
    const renderFileList = () => {
        if (catalog.loading) {
            return (
                <div className={styles.spinnerContainer}>
                    <Spinner size="large" label="Discovering files in OneLake..." />
                </div>
            );
        }

        if (catalog.files.length === 0 && !catalog.error) {
            return (
                <div className={styles.emptyState}>
                    <FolderRegular fontSize={48} />
                    <Subtitle1>No files found</Subtitle1>
                    <Body1>
                        Upload files to a Lakehouse in this workspace to see them here.
                    </Body1>
                </div>
            );
        }

        return catalog.files.map(file => {
            const isSelected = catalog.selectedFile?.file.fullPath === file.fullPath;

            return (
                <div
                    key={file.fullPath}
                    className={isSelected ? styles.fileRowSelected : styles.fileRow}
                    onClick={() => catalog.selectFile(file)}
                >
                    {renderFileIcon(file)}
                    <div className={styles.fileMeta}>
                        <Body1 className={styles.fileName}>{file.name}</Body1>
                        <Caption1 className={styles.fileDetail}>
                            {[
                                formatFileSize(file.size),
                                file.lastModified
                                    ? new Date(file.lastModified).toLocaleDateString()
                                    : null,
                                file.lakehouseName,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </Caption1>
                    </div>
                    <Badge appearance="outline" size="small">
                        {getFileExtension(file.name).toUpperCase() || "FILE"}
                    </Badge>
                </div>
            );
        });
    };

    // -----------------------------------------------------------------------
    // Preview panel
    // -----------------------------------------------------------------------
    const renderPreview = () => {
        const preview = catalog.selectedFile;
        if (!preview) return null;

        return (
            <div className={styles.previewPanel}>
                {/* Preview header */}
                <div className={styles.previewHeader}>
                    <div className={styles.previewHeaderLeft}>
                        {renderFileIcon(preview.file)}
                        <div className={styles.fileMeta}>
                            <Subtitle2 className={styles.fileName}>
                                {preview.file.name}
                            </Subtitle2>
                            <Caption1 className={styles.fileDetail}>
                                {formatFileSize(preview.file.size)} · {preview.file.lakehouseName}
                            </Caption1>
                        </div>
                    </div>
                    <div className={styles.previewHeaderActions}>
                        <Button
                            icon={<ArrowDownloadRegular />}
                            appearance="subtle"
                            onClick={catalog.downloadFile}
                            disabled={!preview.blobUrl}
                        >
                            Download
                        </Button>
                        <Button
                            icon={<DismissRegular />}
                            appearance="subtle"
                            onClick={catalog.closePreview}
                        />
                    </div>
                </div>

                {/* Preview content */}
                <div className={styles.previewContent}>
                    {preview.loading && (
                        <Spinner size="large" label="Loading file..." />
                    )}

                    {preview.error && (
                        <div className={styles.previewFallback}>
                            <Body1>{preview.error}</Body1>
                        </div>
                    )}

                    {!preview.loading && !preview.error && preview.blobUrl && (
                        <>
                            {isImage(preview.file.name) && (
                                <img
                                    className={styles.previewImage}
                                    src={preview.blobUrl}
                                    alt={preview.file.name}
                                />
                            )}

                            {isPdf(preview.file.name) && (
                                <div className={styles.previewFallback}>
                                    <DocumentPdfRegular fontSize={64} />
                                    <Subtitle1>{preview.file.name}</Subtitle1>
                                    <Caption1>
                                        PDF · {formatFileSize(preview.file.size)}
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
                                        onClick={catalog.downloadFile}
                                    >
                                        Download
                                    </Button>
                                </div>
                            )}

                            {!isPreviewable(preview.file.name) && (
                                <div className={styles.previewFallback}>
                                    <DocumentRegular fontSize={64} />
                                    <Subtitle1>{preview.file.name}</Subtitle1>
                                    <Caption1>
                                        {getFileExtension(preview.file.name).toUpperCase()} file
                                        · {formatFileSize(preview.file.size)}
                                    </Caption1>
                                    <Button
                                        appearance="primary"
                                        icon={<ArrowDownloadRegular />}
                                        onClick={catalog.downloadFile}
                                    >
                                        Download File
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        );
    };

    // -----------------------------------------------------------------------
    // Main render
    // -----------------------------------------------------------------------
    return (
        <div className={styles.root}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTitle}>
                    <DatabaseRegular fontSize={24} />
                    <Subtitle2>OneLake Files</Subtitle2>
                    {catalog.allFiles.length > 0 && (
                        <Badge appearance="filled" size="small" color="informative">
                            {catalog.allFiles.length}
                        </Badge>
                    )}
                </div>

                <Input
                    className={styles.searchBox}
                    contentBefore={<SearchRegular />}
                    placeholder="Search files..."
                    value={catalog.searchQuery}
                    onChange={(_, data) => catalog.setSearchQuery(data.value)}
                />

                <Button
                    icon={<ArrowClockwiseRegular />}
                    appearance="subtle"
                    onClick={catalog.loadFiles}
                >
                    Refresh
                </Button>
            </div>

            {/* Error bar */}
            {catalog.error && (
                <MessageBar intent="error" className={styles.errorBar}>
                    <MessageBarBody>{catalog.error}</MessageBarBody>
                    <MessageBarActions>
                        <Button
                            appearance="transparent"
                            size="small"
                            onClick={catalog.clearError}
                        >
                            Dismiss
                        </Button>
                    </MessageBarActions>
                </MessageBar>
            )}

            {/* Body: file list + optional preview */}
            <div className={styles.body}>
                <div className={styles.fileListPanel}>{renderFileList()}</div>
                {renderPreview()}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
