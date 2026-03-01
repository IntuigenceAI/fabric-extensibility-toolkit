import React from "react";
import {
    DataGrid,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridBody,
    DataGridRow,
    DataGridCell,
    createTableColumn,
    Spinner,
    Badge,
    tokens,
    makeStyles,
    shorthands,
    Body1,
    Subtitle1,
} from "@fluentui/react-components";
import type { TableColumnDefinition } from "@fluentui/react-components";
import {
    DocumentRegular,
    CheckmarkCircleRegular,
    ErrorCircleRegular,
} from "@fluentui/react-icons";
import type { CatalogDocumentEntry } from "../DataCatalogDefinition";
import { formatFileSize } from "../../shared/formatters";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DocumentPanelProps {
    documents: CatalogDocumentEntry[];
    loading: boolean;
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
    statusCell: {
        display: "flex",
        alignItems: "center",
        columnGap: "6px",
    },
    statusSuccess: {
        color: tokens.colorPaletteGreenForeground1,
    },
    statusFailed: {
        color: tokens.colorPaletteRedForeground1,
    },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDocumentType(mimeType: string): string {
    if (mimeType.includes("pdf")) return "PDF";
    if (mimeType.includes("image")) return "Image";
    if (mimeType.includes("json")) return "JSON";
    if (mimeType.includes("csv")) return "CSV";
    if (mimeType.includes("text")) return "Text";
    return "File";
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function useColumns(styles: ReturnType<typeof useStyles>): TableColumnDefinition<CatalogDocumentEntry>[] {
    return [
        createTableColumn<CatalogDocumentEntry>({
            columnId: "fileName",
            compare: (a, b) => a.fileName.localeCompare(b.fileName),
            renderHeaderCell: () => "Name",
            renderCell: (item) => item.fileName,
        }),
        createTableColumn<CatalogDocumentEntry>({
            columnId: "type",
            compare: (a, b) => a.mimeType.localeCompare(b.mimeType),
            renderHeaderCell: () => "Type",
            renderCell: (item) => (
                <Badge appearance="outline" size="small" color="informative">
                    {formatDocumentType(item.mimeType)}
                </Badge>
            ),
        }),
        createTableColumn<CatalogDocumentEntry>({
            columnId: "status",
            compare: (a, b) => a.processingStatus.localeCompare(b.processingStatus),
            renderHeaderCell: () => "Status",
            renderCell: (item) => {
                switch (item.processingStatus) {
                    case "processing":
                        return (
                            <div className={styles.statusCell}>
                                <Spinner size="tiny" />
                                Processing
                            </div>
                        );
                    case "success":
                        return (
                            <div className={styles.statusCell}>
                                <CheckmarkCircleRegular
                                    fontSize={16}
                                    className={styles.statusSuccess}
                                />
                                Success
                            </div>
                        );
                    case "failed":
                        return (
                            <div className={styles.statusCell}>
                                <ErrorCircleRegular
                                    fontSize={16}
                                    className={styles.statusFailed}
                                />
                                Failed
                            </div>
                        );
                    default:
                        return item.processingStatus;
                }
            },
        }),
        createTableColumn<CatalogDocumentEntry>({
            columnId: "size",
            compare: (a, b) => a.sizeBytes - b.sizeBytes,
            renderHeaderCell: () => "Size",
            renderCell: (item) => formatFileSize(item.sizeBytes),
        }),
        createTableColumn<CatalogDocumentEntry>({
            columnId: "dateCreated",
            compare: (a, b) => a.createdAt.localeCompare(b.createdAt),
            renderHeaderCell: () => "Date Created",
            renderCell: (item) => new Date(item.createdAt).toLocaleDateString(),
        }),
    ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DocumentPanel({ documents, loading }: DocumentPanelProps) {
    const styles = useStyles();
    const columns = useColumns(styles);

    if (loading) {
        return (
            <div className={styles.root}>
                <div className={styles.spinnerContainer}>
                    <Spinner size="large" label="Loading documents..." />
                </div>
            </div>
        );
    }

    if (documents.length === 0) {
        return (
            <div className={styles.root}>
                <div className={styles.emptyState}>
                    <DocumentRegular fontSize={48} />
                    <Subtitle1>No processed documents yet</Subtitle1>
                    <Body1>
                        Add data from OneLake and process documents to populate
                        this catalog.
                    </Body1>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.root}>
            <DataGrid
                items={documents}
                columns={columns}
                getRowId={(item) => item.id}
                sortable
                focusMode="cell"
            >
                <DataGridHeader>
                    <DataGridRow>
                        {({ renderHeaderCell }) => (
                            <DataGridHeaderCell>
                                {renderHeaderCell()}
                            </DataGridHeaderCell>
                        )}
                    </DataGridRow>
                </DataGridHeader>
                <DataGridBody<CatalogDocumentEntry>>
                    {({ item, rowId }) => (
                        <DataGridRow<CatalogDocumentEntry> key={rowId}>
                            {({ renderCell }) => (
                                <DataGridCell>{renderCell(item)}</DataGridCell>
                            )}
                        </DataGridRow>
                    )}
                </DataGridBody>
            </DataGrid>
        </div>
    );
}
