import React, { useState, useMemo } from 'react';
import {
  Button,
  Input,
  Combobox,
  Option,
  Text,
  Badge,
  Checkbox,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Search20Regular,
  Add20Regular,
  DocumentRegular,
  DocumentPdfRegular,
  ImageRegular,
  TableRegular,
  Eye20Regular,
  MoreHorizontal20Regular,
} from '@fluentui/react-icons';
import { useViewNavigation } from '../../../components/ItemEditor';
import { useDataCatalogContext } from '../DataCatalogContext';
import { CatalogDocumentEntry } from '../DataCatalogDefinition';

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    ...shorthands.padding('0'),
  },
  header: {
    ...shorthands.padding('20px', '24px', '8px'),
  },
  subtitle: {
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
  filterCombo: {
    minWidth: '120px',
  },
  spacer: {
    flexGrow: 1,
  },
  tableWrapper: {
    ...shorthands.padding('0', '24px'),
    flexGrow: 1,
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    ...shorthands.padding('10px', '12px'),
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
    userSelect: 'none',
  },
  td: {
    ...shorthands.padding('10px', '12px'),
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke3),
    fontSize: tokens.fontSizeBase200,
    verticalAlign: 'middle',
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
  actionsCell: {
    display: 'flex',
    ...shorthands.gap('4px'),
    alignItems: 'center',
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
});

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

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

interface MainViewProps {
  onAddData: () => void;
}

export function MainView({ onAddData }: MainViewProps) {
  const styles = useStyles();
  const catalog = useDataCatalogContext();
  const { setCurrentView } = useViewNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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
        documentType: f.fileType === 'pnid' ? 'pnid' : 'document',
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

  const filteredDocs = useMemo(() => {
    let docs = [...allDocs];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      docs = docs.filter(d => d.fileName.toLowerCase().includes(q));
    }
    if (typeFilter !== 'all') {
      docs = docs.filter(d => d.mimeType.includes(typeFilter));
    }
    return docs;
  }, [allDocs, searchQuery, typeFilter]);

  const handleViewDetails = (doc: CatalogDocumentEntry) => {
    catalog.setSelectedDocumentId(doc.id);
    setCurrentView('document-detail');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDocs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocs.map(d => d.id)));
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <Text className={styles.subtitle}>Knowledge Graph</Text>
        <Text size={500} weight="semibold" as="h1">
          {catalog.definition?.name || 'Untitled'}
        </Text>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <Input
          className={styles.searchInput}
          contentBefore={<Search20Regular />}
          placeholder="Filter by keyword"
          value={searchQuery}
          onChange={(_, data) => setSearchQuery(data.value)}
        />
        <Combobox
          className={styles.filterCombo}
          value={typeFilter === 'all' ? 'All types' : typeFilter}
          onOptionSelect={(_, data) => setTypeFilter(data.optionValue || 'all')}
          selectedOptions={[typeFilter]}
        >
          <Option value="all">All types</Option>
          <Option value="pdf">PDF</Option>
          <Option value="document">Document</Option>
          <Option value="image">Image</Option>
        </Combobox>
        <div className={styles.spacer} />
        <Button
          appearance="primary"
          icon={<Add20Regular />}
          onClick={onAddData}
        >
          Add Data
        </Button>
      </div>

      {/* Table */}
      <div className={styles.tableWrapper}>
        {filteredDocs.length === 0 && !catalog.loading ? (
          <div className={styles.emptyState}>
            <DocumentRegular fontSize={48} />
            <Text size={400} weight="semibold">No documents yet</Text>
            <Text>Add data to get started with your Knowledge Graph.</Text>
            <Button appearance="primary" icon={<Add20Regular />} onClick={onAddData}>
              Add Data
            </Button>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: '40px' }}>
                  <Checkbox
                    checked={selectedIds.size === filteredDocs.length && filteredDocs.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th className={styles.th}>File name</th>
                <th className={styles.th}>Type</th>
                <th className={styles.th}>File size</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Uploaded by</th>
                <th className={styles.th}>Date Created</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map(doc => {
                const fileIconInfo = getFileIcon(doc.mimeType, doc.fileName);
                return (
                  <tr key={doc.id}>
                    <td className={styles.td}>
                      <Checkbox
                        checked={selectedIds.has(doc.id)}
                        onChange={() => toggleSelect(doc.id)}
                      />
                    </td>
                    <td className={styles.td}>
                      <div className={styles.fileNameCell}>
                        <div
                          className={styles.fileIcon}
                          style={{ backgroundColor: fileIconInfo.bg, color: fileIconInfo.fg }}
                        >
                          {fileIconInfo.icon}
                        </div>
                        <Text size={200}>{doc.fileName}</Text>
                      </div>
                    </td>
                    <td className={styles.td}>
                      <Badge appearance="outline" size="small">
                        {doc.documentType === 'pnid' ? 'P&ID' : (doc.mimeType.split('/').pop()?.toUpperCase() || 'FILE')}
                      </Badge>
                    </td>
                    <td className={styles.td}>{formatFileSize(doc.sizeBytes)}</td>
                    <td className={styles.td}>{getStatusBadge(doc.processingStatus)}</td>
                    <td className={styles.td}>{doc.addedBy}</td>
                    <td className={styles.td}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className={styles.td}>
                      <div className={styles.actionsCell}>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<Eye20Regular />}
                          onClick={() => handleViewDetails(doc)}
                          disabled={doc.processingStatus !== 'success'}
                        >
                          View
                        </Button>
                        <Button
                          appearance="subtle"
                          size="small"
                          icon={<MoreHorizontal20Regular />}
                          aria-label="More actions"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
