import React from "react";
import {
    Spinner,
    Badge,
    tokens,
    makeStyles,
    shorthands,
    Body1,
    Caption1,
    Subtitle1,
} from "@fluentui/react-components";
import {
    DocumentRegular,
    DocumentPdfRegular,
    ImageRegular,
    FolderRegular,
} from "@fluentui/react-icons";
import type { OneLakeFile, FilePreview } from "../../shared/OneLakeTypes";
import { getFileExtension, isImage } from "../../shared/OneLakeTypes";
import { formatFileSize } from "../../shared/formatters";
import type { ProcessingJob } from "../hooks/useDataCatalog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OneLakePanelProps {
    files: OneLakeFile[];
    selectedFile: FilePreview | null;
    loading: boolean;
    onSelectFile: (file: OneLakeFile) => void;
    onProcessFile: (file: OneLakeFile, docType: string) => void;
    getFileStatus: (filePath: string) => ProcessingJob | undefined;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    root: {
        display: "flex",
        flexDirection: "column",
        ...shorthands.flex(1),
        overflowY: "auto",
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

export function OneLakePanel({
    files,
    selectedFile,
    loading,
    onSelectFile,
    onProcessFile,
    getFileStatus,
}: OneLakePanelProps) {
    const styles = useStyles();

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
    // Loading state
    // -----------------------------------------------------------------------
    if (loading) {
        return (
            <div className={styles.root}>
                <div className={styles.spinnerContainer}>
                    <Spinner size="large" label="Discovering files in OneLake..." />
                </div>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // Empty state
    // -----------------------------------------------------------------------
    if (files.length === 0) {
        return (
            <div className={styles.root}>
                <div className={styles.emptyState}>
                    <FolderRegular fontSize={48} />
                    <Subtitle1>No files found</Subtitle1>
                    <Body1>
                        Upload files to a Lakehouse in this workspace to see them here.
                    </Body1>
                </div>
            </div>
        );
    }

    // -----------------------------------------------------------------------
    // File list
    // -----------------------------------------------------------------------
    return (
        <div className={styles.root}>
            {files.map(file => {
                const isSelected = selectedFile?.file.fullPath === file.fullPath;

                return (
                    <div
                        key={file.fullPath}
                        className={isSelected ? styles.fileRowSelected : styles.fileRow}
                        onClick={() => onSelectFile(file)}
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
                                    .join(" \u00b7 ")}
                            </Caption1>
                        </div>
                        <Badge appearance="outline" size="small">
                            {getFileExtension(file.name).toUpperCase() || "FILE"}
                        </Badge>
                    </div>
                );
            })}
        </div>
    );
}
