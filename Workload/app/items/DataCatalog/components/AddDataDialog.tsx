import React, { useState, useMemo } from "react";
import {
    Dialog,
    DialogSurface,
    DialogBody,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Spinner,
    Body1,
    Caption1,
    Subtitle2,
    DataGrid,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridBody,
    DataGridRow,
    DataGridCell,
    createTableColumn,
    tokens,
    makeStyles,
    shorthands,
} from "@fluentui/react-components";
import type {
    TableColumnDefinition,
    OnSelectionChangeData,
} from "@fluentui/react-components";
import {
    DocumentRegular,
    DocumentPdfRegular,
    ImageRegular,
    FolderRegular,
} from "@fluentui/react-icons";
import { DocumentTypeSelector } from "./DocumentTypeSelector";
import { getFileExtension, isImage } from "../../shared/OneLakeTypes";
import { formatFileSize } from "../../shared/formatters";
import type { LakehouseSelection, LakehouseFile } from "../hooks/useDataCatalog";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
    content: {
        display: "flex",
        flexDirection: "column",
        rowGap: "20px",
    },
    step: {
        display: "flex",
        flexDirection: "column",
        rowGap: "8px",
    },
    stepLabel: {
        display: "flex",
        alignItems: "center",
        columnGap: "8px",
    },
    stepNumber: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        ...shorthands.borderRadius("12px"),
        backgroundColor: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        fontSize: "12px",
        fontWeight: 600,
        flexShrink: 0,
    },
    lakehouseLabel: {
        color: tokens.colorNeutralForeground3,
    },
    gridContainer: {
        maxHeight: "280px",
        overflowY: "auto",
        ...shorthands.borderRadius("6px"),
        ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    },
    emptyFiles: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        ...shorthands.padding("24px"),
        color: tokens.colorNeutralForeground3,
        rowGap: "4px",
    },
    fileNameCell: {
        display: "flex",
        alignItems: "center",
        columnGap: "8px",
    },
    fileIcon: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "24px",
        height: "24px",
        ...shorthands.borderRadius("4px"),
        flexShrink: 0,
    },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileIcon(fileName: string) {
    const ext = getFileExtension(fileName);
    if (ext === "pdf") return { icon: <DocumentPdfRegular fontSize={14} />, bg: tokens.colorPaletteRedBackground2, fg: tokens.colorPaletteRedForeground2 };
    if (isImage(fileName)) return { icon: <ImageRegular fontSize={14} />, bg: tokens.colorPalettePurpleBackground2, fg: tokens.colorPalettePurpleForeground2 };
    return { icon: <DocumentRegular fontSize={14} />, bg: tokens.colorNeutralBackground3, fg: tokens.colorNeutralForeground3 };
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function useFileColumns(styles: ReturnType<typeof useStyles>): TableColumnDefinition<LakehouseFile>[] {
    return useMemo(() => [
        createTableColumn<LakehouseFile>({
            columnId: "name",
            compare: (a, b) => a.name.localeCompare(b.name),
            renderHeaderCell: () => "Name",
            renderCell: (item) => {
                const { icon, bg, fg } = getFileIcon(item.name);
                return (
                    <div className={styles.fileNameCell}>
                        <div className={styles.fileIcon} style={{ backgroundColor: bg, color: fg }}>
                            {icon}
                        </div>
                        {item.name}
                    </div>
                );
            },
        }),
        createTableColumn<LakehouseFile>({
            columnId: "size",
            compare: (a, b) => a.size - b.size,
            renderHeaderCell: () => "Size",
            renderCell: (item) => formatFileSize(item.size),
        }),
        createTableColumn<LakehouseFile>({
            columnId: "lastModified",
            compare: (a, b) => a.lastModified.localeCompare(b.lastModified),
            renderHeaderCell: () => "Last Modified",
            renderCell: (item) =>
                item.lastModified
                    ? new Date(item.lastModified).toLocaleDateString()
                    : "",
        }),
    ], [styles]);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AddDataDialogProps {
    open: boolean;
    onClose: () => void;
    /** Pre-loaded Lakehouse selection (from DataHub wizard opened before this dialog) */
    lakehouse: LakehouseSelection | null;
    /** Pre-loaded file list from the selected Lakehouse */
    files: LakehouseFile[];
    onProcess: (file: LakehouseFile, docType: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AddDataDialog({
    open,
    onClose,
    lakehouse,
    files,
    onProcess,
}: AddDataDialogProps) {
    const styles = useStyles();
    const fileColumns = useFileColumns(styles);

    const [docType, setDocType] = useState("document");
    const [selectedFile, setSelectedFile] = useState<LakehouseFile | null>(null);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [processing, setProcessing] = useState(false);

    const handleSelectionChange = (
        _: React.MouseEvent | React.KeyboardEvent,
        data: OnSelectionChangeData,
    ) => {
        setSelectedItems(data.selectedItems as Set<string>);
        const selectedPath = Array.from(data.selectedItems)[0] as string;
        const file = files.find(f => f.fullPath === selectedPath) || null;
        setSelectedFile(file);
    };

    const handleProcess = async () => {
        if (!selectedFile) return;
        setProcessing(true);
        try {
            await onProcess(selectedFile, docType);
            resetState();
            onClose();
        } catch {
            // Error shown via hook's error state
        } finally {
            setProcessing(false);
        }
    };

    const resetState = () => {
        setDocType("document");
        setSelectedFile(null);
        setSelectedItems(new Set());
    };

    const handleClose = () => {
        if (processing) return;
        resetState();
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={(_, data) => { if (!data.open) handleClose(); }}>
            <DialogSurface>
                <DialogBody>
                    <DialogTitle>Add Data</DialogTitle>
                    <DialogContent className={styles.content}>
                        {/* Source info */}
                        {lakehouse && (
                            <Caption1 className={styles.lakehouseLabel}>
                                Source: {lakehouse.displayName} / {lakehouse.folderPath}
                            </Caption1>
                        )}

                        {/* Step 1: Document type */}
                        <div className={styles.step}>
                            <div className={styles.stepLabel}>
                                <div className={styles.stepNumber}>1</div>
                                <Subtitle2>Select document type</Subtitle2>
                            </div>
                            <DocumentTypeSelector
                                value={docType}
                                onChange={setDocType}
                            />
                        </div>

                        {/* Step 2: Select file from pre-loaded list */}
                        <div className={styles.step}>
                            <div className={styles.stepLabel}>
                                <div className={styles.stepNumber}>2</div>
                                <Subtitle2>Choose a file</Subtitle2>
                            </div>

                            {/* Empty state */}
                            {files.length === 0 && (
                                <div className={styles.emptyFiles}>
                                    <FolderRegular fontSize={32} />
                                    <Body1>No files found in this location.</Body1>
                                </div>
                            )}

                            {/* File selection DataGrid */}
                            {files.length > 0 && (
                                <div className={styles.gridContainer}>
                                    <DataGrid
                                        items={files}
                                        columns={fileColumns}
                                        getRowId={(item) => item.fullPath}
                                        selectionMode="single"
                                        selectedItems={selectedItems}
                                        onSelectionChange={handleSelectionChange}
                                        subtleSelection
                                        focusMode="composite"
                                        sortable
                                        size="small"
                                    >
                                        <DataGridHeader>
                                            <DataGridRow
                                                selectionCell={{
                                                    "aria-label": "Select all rows",
                                                }}
                                            >
                                                {({ renderHeaderCell }) => (
                                                    <DataGridHeaderCell>
                                                        {renderHeaderCell()}
                                                    </DataGridHeaderCell>
                                                )}
                                            </DataGridRow>
                                        </DataGridHeader>
                                        <DataGridBody<LakehouseFile>>
                                            {({ item, rowId }) => (
                                                <DataGridRow<LakehouseFile>
                                                    key={rowId}
                                                    selectionCell={{
                                                        "aria-label": "Select row",
                                                    }}
                                                >
                                                    {({ renderCell }) => (
                                                        <DataGridCell>
                                                            {renderCell(item)}
                                                        </DataGridCell>
                                                    )}
                                                </DataGridRow>
                                            )}
                                        </DataGridBody>
                                    </DataGrid>
                                </div>
                            )}
                        </div>
                    </DialogContent>

                    <DialogActions>
                        <Button
                            appearance="secondary"
                            onClick={handleClose}
                            disabled={processing}
                        >
                            Cancel
                        </Button>
                        <Button
                            appearance="primary"
                            onClick={handleProcess}
                            disabled={!selectedFile || processing}
                        >
                            {processing ? (
                                <>
                                    <Spinner size="tiny" />
                                    {" Processing..."}
                                </>
                            ) : (
                                "Start Processing"
                            )}
                        </Button>
                    </DialogActions>
                </DialogBody>
            </DialogSurface>
        </Dialog>
    );
}
