import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Button,
  Input,
  Text,
  Badge,
  Spinner,
  Select,
  Toaster,
  Toast,
  ToastTitle,
  ToastBody,
  Dialog,
  DialogSurface,
  DialogBody,
  DialogTitle,
  DialogContent,
  DialogActions,
  useToastController,
  useId,
  makeStyles,
  tokens,
  shorthands,
  DataGrid,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridBody,
  DataGridRow,
  DataGridCell,
  createTableColumn,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItemRadio,
  Tooltip,
} from '@fluentui/react-components';
import type { TableColumnDefinition } from '@fluentui/react-components';
import {
  Search20Regular,
  Add20Regular,
  Delete20Regular,
  DocumentRegular,
  DocumentPdfRegular,
  ImageRegular,
  TableRegular,
  Warning20Regular,
  ArrowSortDown20Regular,
  ArrowSortUp20Regular,
  Filter20Regular,
  ChevronLeft20Regular,
  ChevronRight20Regular,
  Info16Regular,
  Warning16Regular,
  ArrowSync20Regular,
  Database20Regular,
} from '@fluentui/react-icons';
import { useViewNavigation } from '../../../components/ItemEditor';
import { useDataCatalogContext } from '../DataCatalogContext';
import { CatalogDocumentEntry } from '../DataCatalogDefinition';
import { formatFileSize } from '../../shared/formatters';
import '../DataCatalog.scss';

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...shorthands.padding('0'),
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    ...shorthands.padding('20px', '24px', '8px'),
    ...shorthands.gap('2px'),
  },
  nameRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...shorthands.gap('16px'),
  },
  quotaIndicator: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap' as const,
  },
  quotaIndicatorFull: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteRedForeground1,
    whiteSpace: 'nowrap' as const,
  },
  subtitle: {
    display: 'block',
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    letterSpacing: '0.5px',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
    ...shorthands.padding('8px', '24px'),
    flexWrap: 'wrap',
  },
  searchInput: {
    minWidth: '200px',
    flexGrow: 1,
    maxWidth: '320px',
  },
  spacer: {
    flexGrow: 1,
  },
  gridWrapper: {
    ...shorthands.margin('0', '24px'),
    flexGrow: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    ...shorthands.border(tokens.strokeWidthThick, 'solid', tokens.colorNeutralStroke1),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  dataGrid: {
    width: '100%',
  },
  fileNameCell: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  fileIcon: {
    width: '28px',
    height: '28px',
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sortableHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('4px'),
    cursor: 'pointer',
    userSelect: 'none',
  },
  sortIconDimmed: {
    color: tokens.colorNeutralForeground4,
    opacity: 0.5,
  },
  sortIconActive: {
    color: tokens.colorBrandForeground1,
    opacity: 1,
  },
  filterHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('2px'),
  },
  filterButtonActive: {
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorBrandForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding('64px', '24px'),
    ...shorthands.gap('12px'),
    color: tokens.colorNeutralForeground3,
  },
  paginationControls: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  deleteDialogHeader: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('8px'),
  },
  eventhouseBar: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('12px'),
    ...shorthands.padding('8px', '24px'),
    ...shorthands.margin('0', '24px', '8px'),
    backgroundColor: tokens.colorNeutralBackground3,
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
  },
  eventhouseInfo: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('6px'),
    flexGrow: 1,
  },
  eventhouseMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function guessMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    csv: 'text/csv',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeMap[ext] || 'application/octet-stream';
}

function getFileIcon(mimeType: string, fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf' || mimeType === 'application/pdf') {
    return { icon: <DocumentPdfRegular fontSize={18} />, bg: tokens.colorPaletteRedBackground2, fg: tokens.colorPaletteRedForeground2 };
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) {
    return { icon: <ImageRegular fontSize={18} />, bg: tokens.colorPalettePurpleBackground2, fg: tokens.colorPalettePurpleForeground2 };
  }
  if (['xlsx', 'csv', 'xls'].includes(ext)) {
    return { icon: <TableRegular fontSize={18} />, bg: tokens.colorPaletteGreenBackground2, fg: tokens.colorPaletteGreenForeground2 };
  }
  return { icon: <DocumentRegular fontSize={18} />, bg: tokens.colorNeutralBackground3, fg: tokens.colorNeutralForeground3 };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge appearance="filled" color="success">Success</Badge>;
    case 'processing':
      return <Badge appearance="filled" color="informative">In progress</Badge>;
    case 'failed':
      return <Badge appearance="filled" color="danger">Failed</Badge>;
    default:
      return <Badge appearance="outline">{status}</Badge>;
  }
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function getDocTypeLabel(docType: string | undefined): string {
  switch (docType) {
    case 'pnid': return 'P&ID';
    case 'timeseries': return 'Timeseries';
    default: return 'Document';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MainViewProps {
  onAddData: () => void;
}

type SortColumn = 'fileName' | 'documentType' | 'sizeBytes' | 'processingStatus' | 'createdAt';

export function MainView({ onAddData }: MainViewProps) {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const { setCurrentView } = useViewNavigation();
  const [syncing, setSyncing] = useState(false);

  const eventhouseSource = catalog.definition?.eventhouseSource;
  const ehInFlight = catalog.activeFiles.some(
    f => f.sourceType === 'eventhouse' && (f.status === 'uploading' || f.status === 'processing'),
  );

  const toasterId = useId('mainview-toaster');
  const { dispatchToast } = useToastController(toasterId);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await catalog.syncEventHouse();
      dispatchToast(
        <Toast>
          <ToastTitle>Sync started</ToastTitle>
        </Toast>,
        { intent: 'success', timeout: 3000 },
      );
    } catch (err: any) {
      console.error('[MainView] Sync failed:', err);
      dispatchToast(
        <Toast>
          <ToastTitle>Sync failed</ToastTitle>
          <ToastBody>{err.message || 'Something went wrong'}</ToastBody>
        </Toast>,
        { intent: 'error', timeout: 6000 },
      );
    } finally {
      setSyncing(false);
    }
  }, [catalog, dispatchToast]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Sort
  const [sortColumn, setSortColumn] = useState<SortColumn>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Selection & delete
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isQuotaFull = catalog.quota !== null && catalog.quota.remaining <= 0;
  const documents = catalog.definition?.documents || [];

  // Merge active processing files as placeholder rows
  const allDocs = useMemo(() => {
    const realDocs = [...documents];
    const realFileIds = new Set(realDocs.map(d => d.intuigenceFileId).filter(Boolean));

    const placeholders: CatalogDocumentEntry[] = catalog.activeFiles
      .filter(f => !f.fileId || !realFileIds.has(f.fileId))
      .map((f): CatalogDocumentEntry => ({
        id: f.localId,
        fileName: f.fileName,
        mimeType: guessMimeType(f.fileName),
        sizeBytes: 0,
        sourceType: 'onelake',
        documentType: f.fileType === 'pnid' ? 'pnid' : f.fileType === 'timeseries' ? 'timeseries' : 'document',
        processingStatus: f.status === 'failed' ? 'failed' : 'processing',
        intuigenceDocumentId: null,
        intuigenceFileId: f.fileId || null,
        intuigenceGraphId: null,
        errorMessage: f.error || null,
        lastUpdated: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        addedBy: 'Fabric User',
      }));

    return [...placeholders, ...realDocs];
  }, [documents, catalog.activeFiles]);

  // Reset page when filters or sort change
  useEffect(() => { setPage(1); }, [searchQuery, typeFilter, statusFilter, sortColumn, sortDirection]);

  // Data pipeline: filter → sort → paginate
  const { paginatedDocs, totalFiltered, totalPages, start } = useMemo(() => {
    let docs = [...allDocs];

    // 1. Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.fileName.toLowerCase().includes(q));
    }

    // 2. Type filter
    if (typeFilter !== 'all') {
      docs = docs.filter(d => (d.documentType || 'document') === typeFilter);
    }

    // 3. Status filter
    if (statusFilter !== 'all') {
      docs = docs.filter(d => d.processingStatus === statusFilter);
    }

    // 4. Sort
    docs.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'fileName': cmp = a.fileName.localeCompare(b.fileName); break;
        case 'documentType': cmp = (a.documentType || 'document').localeCompare(b.documentType || 'document'); break;
        case 'sizeBytes': cmp = a.sizeBytes - b.sizeBytes; break;
        case 'processingStatus': cmp = a.processingStatus.localeCompare(b.processingStatus); break;
        case 'createdAt': cmp = a.createdAt.localeCompare(b.createdAt); break;
        default: cmp = 0;
      }
      return sortDirection === 'desc' ? -cmp : cmp;
    });

    const totalFiltered = docs.length;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const s = (page - 1) * pageSize;
    const paginatedDocs = docs.slice(s, s + pageSize);

    return { paginatedDocs, totalFiltered, totalPages, start: s };
  }, [allDocs, searchQuery, typeFilter, statusFilter, sortColumn, sortDirection, page, pageSize]);

  // Sort handler
  const handleSort = useCallback((col: SortColumn) => {
    setSortColumn(prev => {
      if (prev === col) {
        setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
      } else {
        setSortDirection('asc');
      }
      return col;
    });
  }, []);

  // Sort indicator — always visible on sortable columns, highlighted when active
  const SortIcon = ({ col }: { col: SortColumn }) => {
    const isActive = sortColumn === col;
    const iconClass = isActive ? styles.sortIconActive : styles.sortIconDimmed;

    if (isActive) {
      return sortDirection === 'asc'
        ? <ArrowSortUp20Regular fontSize={14} className={iconClass} />
        : <ArrowSortDown20Regular fontSize={14} className={iconClass} />;
    }

    // Non-active: show a dimmed down arrow to indicate sortable
    return <ArrowSortDown20Regular fontSize={14} className={iconClass} />;
  };

  const handleViewDetails = (doc: CatalogDocumentEntry) => {
    catalog.setSelectedDocumentId(doc.id);
    setCurrentView('document-detail');
  };

  const handleDeleteSelected = useCallback(() => {
    setDeleteConfirmOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    const count = selectedIds.size;
    setDeleting(true);
    try {
      await catalog.removeDocument(Array.from(selectedIds));
      setSelectedIds(new Set());
      setDeleteConfirmOpen(false);
      dispatchToast(
        <Toast>
          <ToastTitle>Deleted {count} document{count > 1 ? 's' : ''}</ToastTitle>
        </Toast>,
        { intent: 'success', timeout: 4000 }
      );
    } catch (err: any) {
      dispatchToast(
        <Toast>
          <ToastTitle>Delete failed</ToastTitle>
          <ToastBody>{err.message || 'Something went wrong'}</ToastBody>
        </Toast>,
        { intent: 'error', timeout: 6000 }
      );
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, catalog, dispatchToast]);

  // Column definitions
  const columns: TableColumnDefinition<CatalogDocumentEntry>[] = useMemo(() => [
    createTableColumn<CatalogDocumentEntry>({
      columnId: 'fileName',
      compare: (a, b) => a.fileName.localeCompare(b.fileName),
      renderHeaderCell: () => (
        <div className={styles.sortableHeader} onClick={() => handleSort('fileName')}>
          <span>File name</span>
          <SortIcon col="fileName" />
        </div>
      ),
      renderCell: (item) => {
        const fi = getFileIcon(item.mimeType, item.fileName);
        return (
          <div className={styles.fileNameCell}>
            <div className={styles.fileIcon} style={{ backgroundColor: fi.bg, color: fi.fg }}>
              {fi.icon}
            </div>
            <Text size={200}>{item.fileName}</Text>
          </div>
        );
      },
    }),
    createTableColumn<CatalogDocumentEntry>({
      columnId: 'documentType',
      compare: (a, b) => (a.documentType || 'document').localeCompare(b.documentType || 'document'),
      renderHeaderCell: () => (
        <div className={styles.filterHeader}>
          <Menu checkedValues={{ type: [typeFilter] }}
            onCheckedValueChange={(_, data) => setTypeFilter(data.checkedItems[0] || 'all')}>
            <MenuTrigger disableButtonEnhancement>
              <Button
                appearance="subtle"
                size="small"
                icon={<Filter20Regular />}
                iconPosition="after"
                className={typeFilter !== 'all' ? styles.filterButtonActive : undefined}
              >
                Type{typeFilter !== 'all' ? `: ${getDocTypeLabel(typeFilter)}` : ''}
              </Button>
            </MenuTrigger>
            <MenuPopover>
              <MenuList>
                <MenuItemRadio name="type" value="all">All</MenuItemRadio>
                <MenuItemRadio name="type" value="document">Document</MenuItemRadio>
                <MenuItemRadio name="type" value="pnid">P&amp;ID</MenuItemRadio>
                <MenuItemRadio name="type" value="timeseries">Timeseries</MenuItemRadio>
              </MenuList>
            </MenuPopover>
          </Menu>
        </div>
      ),
      renderCell: (item) => (
        <Badge appearance="outline" size="small">
          {getDocTypeLabel(item.documentType)}
        </Badge>
      ),
    }),
    createTableColumn<CatalogDocumentEntry>({
      columnId: 'sizeBytes',
      compare: (a, b) => a.sizeBytes - b.sizeBytes,
      renderHeaderCell: () => (
        <div className={styles.sortableHeader} onClick={() => handleSort('sizeBytes')}>
          <span>File size</span>
          <SortIcon col="sizeBytes" />
        </div>
      ),
      renderCell: (item) => formatFileSize(item.sizeBytes),
    }),
    createTableColumn<CatalogDocumentEntry>({
      columnId: 'processingStatus',
      compare: (a, b) => a.processingStatus.localeCompare(b.processingStatus),
      renderHeaderCell: () => {
        const statusLabels: Record<string, string> = { success: 'Success', processing: 'In progress', failed: 'Failed' };
        return (
          <div className={styles.filterHeader}>
            <Menu checkedValues={{ status: [statusFilter] }}
              onCheckedValueChange={(_, data) => setStatusFilter(data.checkedItems[0] || 'all')}>
              <MenuTrigger disableButtonEnhancement>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<Filter20Regular />}
                  iconPosition="after"
                  className={statusFilter !== 'all' ? styles.filterButtonActive : undefined}
                >
                  Status{statusFilter !== 'all' ? `: ${statusLabels[statusFilter] || statusFilter}` : ''}
                </Button>
              </MenuTrigger>
              <MenuPopover>
                <MenuList>
                  <MenuItemRadio name="status" value="all">All</MenuItemRadio>
                  <MenuItemRadio name="status" value="success">Success</MenuItemRadio>
                  <MenuItemRadio name="status" value="processing">In progress</MenuItemRadio>
                  <MenuItemRadio name="status" value="failed">Failed</MenuItemRadio>
                </MenuList>
              </MenuPopover>
            </Menu>
          </div>
        );
      },
      renderCell: (item) => getStatusBadge(item.processingStatus),
    }),
    createTableColumn<CatalogDocumentEntry>({
      columnId: 'createdAt',
      compare: (a, b) => a.createdAt.localeCompare(b.createdAt),
      renderHeaderCell: () => (
        <div className={styles.sortableHeader} onClick={() => handleSort('createdAt')}>
          <span>Uploaded</span>
          <SortIcon col="createdAt" />
        </div>
      ),
      renderCell: (item) => formatDateTime(item.createdAt),
    }),
  ], [styles, typeFilter, statusFilter, sortColumn, sortDirection, handleSort]);

  // True empty state: no documents at all (not just filtered)
  const isTrulyEmpty = allDocs.length === 0 && !catalog.loading;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Text className={styles.subtitle}>Knowledge Graph</Text>
        <div className={styles.nameRow}>
          <Text size={500} weight="semibold" as="h1">
            {catalog.definition?.name || 'Untitled'}
          </Text>
          {catalog.isSampleMode ? (
            <div className={styles.quotaIndicator}>
              <Info16Regular />
              <span>Sample Mode &mdash; Viewing pre-loaded example data</span>
            </div>
          ) : catalog.quota && (
            <div className={isQuotaFull ? styles.quotaIndicatorFull : styles.quotaIndicator}>
              {isQuotaFull ? <Warning16Regular /> : <Info16Regular />}
              <span>
                {isQuotaFull
                  ? `Trial limit reached (${catalog.quota.used}/${catalog.quota.limit}). Upgrade to upload more.`
                  : `${catalog.quota.used} of ${catalog.quota.limit} document uploads used (Trial)`
                }
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar: search + delete (left) | pagination (right) */}
      <div className={styles.toolbar}>
        <Input
          className={styles.searchInput}
          contentBefore={<Search20Regular />}
          placeholder="Filter by keyword"
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
        />
        {selectedIds.size > 0 && !catalog.isSampleMode && (
          <Button
            appearance="subtle"
            icon={<Delete20Regular />}
            onClick={handleDeleteSelected}
          >
            Delete ({selectedIds.size})
          </Button>
        )}
        <div className={styles.spacer} />
        {!isTrulyEmpty && (
          <div className={styles.paginationControls}>
            <Select
              size="small"
              value={String(pageSize)}
              onChange={(_, data) => { setPageSize(Number(data.value)); setPage(1); }}
            >
              <option value="10">10 per page</option>
              <option value="50">50 per page</option>
              <option value="100">100 per page</option>
            </Select>
            <Text size={200} style={{ color: tokens.colorNeutralForeground3, whiteSpace: 'nowrap' }}>
              {totalFiltered > 0
                ? <>{start + 1}&ndash;{Math.min(start + pageSize, totalFiltered)} of {totalFiltered}</>
                : <>0 of {allDocs.length}</>
              }
            </Text>
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronLeft20Regular />}
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
            />
            <Text size={200} style={{ whiteSpace: 'nowrap' }}>
              {page} / {totalPages}
            </Text>
            <Button
              appearance="subtle"
              size="small"
              icon={<ChevronRight20Regular />}
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
            />
          </div>
        )}
      </div>

      {/* EventHouse connection info */}
      {eventhouseSource && (
        <div className={styles.eventhouseBar}>
          <Database20Regular />
          <div className={styles.eventhouseInfo}>
            <Text size={200} weight="semibold">
              {eventhouseSource.eventhouseName}
            </Text>
            <Text size={200} className={styles.eventhouseMeta}>
              {eventhouseSource.databaseName} / {eventhouseSource.tableName}
            </Text>
            {eventhouseSource.lastFullRefreshAt && (
              <Text size={200} className={styles.eventhouseMeta}>
                Last full refresh: {formatDateTime(eventhouseSource.lastFullRefreshAt)}
              </Text>
            )}
          </div>
          <Button
            appearance="subtle"
            size="small"
            icon={syncing ? <Spinner size="tiny" /> : <ArrowSync20Regular />}
            onClick={handleSyncNow}
            disabled={syncing || ehInFlight}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      )}

      {/* DataGrid */}
      <div className={`${styles.gridWrapper} datacatalog-grid`}>
        {isTrulyEmpty ? (
          <div className={styles.emptyState}>
            <DocumentRegular fontSize={48} />
            <Text size={400} weight="semibold">No documents yet</Text>
            <Text>{catalog.isSampleMode ? 'Sample files are being processed.' : 'Add data to get started with your Knowledge Graph.'}</Text>
            {!catalog.isSampleMode && (
              <Tooltip
                content="Document upload limit reached (Trial). Upgrade to upload more."
                relationship="label"
                visible={isQuotaFull ? undefined : false}
              >
                <span>
                  <Button appearance="primary" icon={<Add20Regular />} onClick={onAddData} disabled={isQuotaFull}>
                    Add Data
                  </Button>
                </span>
              </Tooltip>
            )}
          </div>
        ) : (
          <DataGrid
            items={paginatedDocs}
            columns={columns}
            getRowId={(item) => item.id}
            selectionMode={catalog.isSampleMode ? 'single' : 'multiselect'}
            selectedItems={selectedIds}
            onSelectionChange={catalog.isSampleMode ? undefined : (_, data) => setSelectedIds(data.selectedItems as Set<string>)}
            focusMode="composite"
            size="medium"
            className={styles.dataGrid}
          >
            <DataGridHeader>
              <DataGridRow selectionCell={{ 'aria-label': 'Select all rows' }}>
                {({ renderHeaderCell, columnId }) => (
                  <DataGridHeaderCell style={columnId === 'fileName' ? { flex: '2 1 0' } : undefined}>
                    {renderHeaderCell()}
                  </DataGridHeaderCell>
                )}
              </DataGridRow>
            </DataGridHeader>
            <DataGridBody<CatalogDocumentEntry>>
              {({ item, rowId }) => (
                <DataGridRow<CatalogDocumentEntry>
                  key={rowId}
                  selectionCell={{ 'aria-label': 'Select row' }}
                  style={item.processingStatus === 'success' ? { cursor: 'pointer' } : undefined}
                >
                  {({ renderCell, columnId }) => (
                    <DataGridCell
                      style={columnId === 'fileName' ? { flex: '2 1 0' } : undefined}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        if (item.processingStatus === 'success') {
                          handleViewDetails(item);
                        }
                      }}
                    >
                      {renderCell(item)}
                    </DataGridCell>
                  )}
                </DataGridRow>
              )}
            </DataGridBody>
          </DataGrid>
        )}
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={(_, data) => { if (!data.open && !deleting) setDeleteConfirmOpen(false); }}>
        <DialogSurface>
          <DialogBody>
            <DialogTitle>
              <div className={styles.deleteDialogHeader}>
                <Warning20Regular color={tokens.colorPaletteRedForeground1} />
                Delete documents
              </div>
            </DialogTitle>
            <DialogContent>
              Are you sure you want to delete {selectedIds.size} document{selectedIds.size > 1 ? 's' : ''}?
              This will permanently remove them and any associated data (graphs, embeddings, timeseries).
            </DialogContent>
            <DialogActions>
              <Button
                appearance="secondary"
                onClick={() => setDeleteConfirmOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                appearance="primary"
                style={{ backgroundColor: tokens.colorPaletteRedBackground3, color: tokens.colorNeutralForegroundOnBrand }}
                onClick={handleConfirmDelete}
                disabled={deleting}
                icon={deleting ? <Spinner size="tiny" /> : undefined}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      <Toaster toasterId={toasterId} position="bottom-end" />
    </div>
  );
}
