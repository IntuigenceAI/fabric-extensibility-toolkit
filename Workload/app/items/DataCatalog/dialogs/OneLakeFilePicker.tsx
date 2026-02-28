import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Button,
  Text,
  Checkbox,
  Spinner,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
  shorthands,
} from '@fluentui/react-components';
import {
  Dismiss24Regular,
  FolderRegular,
  DocumentRegular,
  DocumentPdfRegular,
  ImageRegular,
  TableRegular,
  ChevronRight20Regular,
} from '@fluentui/react-icons';
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { OneLakeStorageClient } from '../../../clients/OneLakeStorageClient';
import { OneLakeStoragePathMetadata } from '../../../clients/FabricPlatformTypes';
import { OneLakeFileSelection } from '../DataCatalogContext';

export interface OneLakeFilePickerProps {
  workloadClient: WorkloadClientAPI;
  lakehouseId: string;
  lakehouseWorkspaceId: string;
  lakehouseName: string;
  onSelect: (files: OneLakeFileSelection[]) => void;
  onCancel: () => void;
}

interface FileEntry {
  name: string;
  relativePath: string;
  isDirectory: boolean;
  size: number;
  lastModified: string;
}

function formatFileSize(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') {
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

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 1001,
  },
  dialog: {
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderRadius(tokens.borderRadiusXLarge),
    boxShadow: tokens.shadow28,
    width: '680px',
    maxWidth: '90vw',
    height: '70vh',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shorthands.padding('20px', '24px', '12px'),
    flexShrink: 0,
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    ...shorthands.gap('2px'),
    ...shorthands.padding('0', '24px', '8px'),
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  breadcrumbItem: {
    cursor: 'pointer',
    color: tokens.colorBrandForeground1,
    ':hover': {
      textDecorationLine: 'underline',
    },
  },
  breadcrumbCurrent: {
    color: tokens.colorNeutralForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  breadcrumbSeparator: {
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
  },
  body: {
    flexGrow: 1,
    overflowY: 'auto',
    ...shorthands.padding('0', '24px'),
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
    ...shorthands.padding('8px', '12px'),
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
  folderRow: {
    cursor: 'pointer',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  fileRow: {
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  footer: {
    ...shorthands.padding('16px', '24px'),
    ...shorthands.borderTop(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  footerActions: {
    display: 'flex',
    ...shorthands.gap('8px'),
  },
  centerContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    ...shorthands.padding('48px', '24px'),
    ...shorthands.gap('12px'),
    color: tokens.colorNeutralForeground3,
  },
});

export function OneLakeFilePicker({
  workloadClient,
  lakehouseId,
  lakehouseWorkspaceId,
  lakehouseName,
  onSelect,
  onCancel,
}: OneLakeFilePickerProps) {
  const styles = useStyles();

  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<Map<string, FileEntry>>(new Map());

  const storageClient = useMemo(
    () => new OneLakeStorageClient(workloadClient),
    [workloadClient],
  );

  const loadDirectory = useCallback(async (pathSegments: string[]) => {
    setLoading(true);
    setError(null);

    const directoryPath = [lakehouseId, 'Files', ...pathSegments].join('/');

    try {
      const metadata = await storageClient.getPathMetadata(
        lakehouseWorkspaceId,
        directoryPath,
        false,
      );

      const basePath = directoryPath;
      const fileEntries: FileEntry[] = (metadata.paths || [])
        .filter(p => {
          // Filter out the directory itself — only show its children
          const fullName = p.name;
          return fullName !== basePath;
        })
        .map((p: OneLakeStoragePathMetadata) => {
          // p.name is the full path from the item root, e.g. "lakehouseId/Files/subfolder/file.pdf"
          // We need just the file/folder name
          const parts = p.name.split('/');
          const name = parts[parts.length - 1];
          // relativePath is relative to Files/, e.g. "subfolder/file.pdf"
          const filesIndex = p.name.indexOf('/Files/');
          const relativePath = filesIndex >= 0
            ? p.name.substring(filesIndex + '/Files/'.length)
            : name;

          return {
            name,
            relativePath,
            isDirectory: p.isDirectory === true,
            size: p.contentLength || 0,
            lastModified: p.lastModified || '',
          };
        });

      // Sort: directories first, then files, alphabetically
      fileEntries.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

      setEntries(fileEntries);
    } catch (err: any) {
      console.error('[OneLakeFilePicker] Failed to load directory:', err);
      setError(err.message || 'Failed to load directory contents');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [storageClient, lakehouseId, lakehouseWorkspaceId]);

  useEffect(() => {
    loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const navigateToFolder = (folderName: string) => {
    setCurrentPath(prev => [...prev, folderName]);
  };

  const navigateToBreadcrumb = (index: number) => {
    // index -1 = root (Files), 0 = first subfolder, etc.
    if (index < 0) {
      setCurrentPath([]);
    } else {
      setCurrentPath(prev => prev.slice(0, index + 1));
    }
  };

  const currentDirFiles = useMemo(
    () => entries.filter(e => !e.isDirectory),
    [entries],
  );

  const allCurrentFilesSelected = currentDirFiles.length > 0 &&
    currentDirFiles.every(f => selectedFiles.has(f.relativePath));

  const toggleFileSelection = (entry: FileEntry) => {
    setSelectedFiles(prev => {
      const next = new Map(prev);
      if (next.has(entry.relativePath)) {
        next.delete(entry.relativePath);
      } else {
        next.set(entry.relativePath, entry);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedFiles(prev => {
      const next = new Map(prev);
      if (allCurrentFilesSelected) {
        // Deselect all files in current directory
        for (const f of currentDirFiles) {
          next.delete(f.relativePath);
        }
      } else {
        // Select all files in current directory
        for (const f of currentDirFiles) {
          next.set(f.relativePath, f);
        }
      }
      return next;
    });
  };

  const handleSubmit = () => {
    const selections: OneLakeFileSelection[] = Array.from(selectedFiles.values()).map(f => ({
      itemId: lakehouseId,
      workspaceId: lakehouseWorkspaceId,
      selectedPath: f.relativePath,
      fileName: f.name,
    }));
    onSelect(selections);
  };

  const selectedCount = selectedFiles.size;

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className={styles.dialog}>
        {/* Header */}
        <div className={styles.header}>
          <Text size={500} weight="semibold">Select files from {lakehouseName}</Text>
          <Button
            appearance="subtle"
            icon={<Dismiss24Regular />}
            onClick={onCancel}
            aria-label="Close"
          />
        </div>

        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <Text
            size={200}
            className={currentPath.length === 0 ? styles.breadcrumbCurrent : styles.breadcrumbItem}
            onClick={() => navigateToBreadcrumb(-1)}
          >
            Files
          </Text>
          {currentPath.map((segment, i) => (
            <React.Fragment key={i}>
              <span className={styles.breadcrumbSeparator}>
                <ChevronRight20Regular fontSize={12} />
              </span>
              <Text
                size={200}
                className={i === currentPath.length - 1 ? styles.breadcrumbCurrent : styles.breadcrumbItem}
                onClick={() => navigateToBreadcrumb(i)}
              >
                {segment}
              </Text>
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className={styles.body}>
          {loading ? (
            <div className={styles.centerContent}>
              <Spinner size="medium" />
              <Text>Loading files...</Text>
            </div>
          ) : error ? (
            <MessageBar intent="error">
              <MessageBarBody>{error}</MessageBarBody>
            </MessageBar>
          ) : entries.length === 0 ? (
            <div className={styles.centerContent}>
              <FolderRegular fontSize={48} />
              <Text size={300}>This folder is empty</Text>
            </div>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th} style={{ width: '40px' }}>
                    <Checkbox
                      checked={allCurrentFilesSelected && currentDirFiles.length > 0}
                      disabled={currentDirFiles.length === 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Type</th>
                  <th className={styles.th}>Size</th>
                  <th className={styles.th}>Last modified</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(entry => {
                  if (entry.isDirectory) {
                    return (
                      <tr
                        key={entry.relativePath}
                        className={styles.folderRow}
                        onClick={() => navigateToFolder(entry.name)}
                      >
                        <td className={styles.td} />
                        <td className={styles.td}>
                          <div className={styles.fileNameCell}>
                            <div
                              className={styles.fileIcon}
                              style={{
                                backgroundColor: tokens.colorPaletteYellowBackground2,
                                color: tokens.colorPaletteYellowForeground2,
                              }}
                            >
                              <FolderRegular fontSize={18} />
                            </div>
                            <Text size={200}>{entry.name}</Text>
                          </div>
                        </td>
                        <td className={styles.td}>
                          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Folder</Text>
                        </td>
                        <td className={styles.td}>{'\u2014'}</td>
                        <td className={styles.td}>
                          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                            {entry.lastModified ? new Date(entry.lastModified).toLocaleDateString() : '\u2014'}
                          </Text>
                        </td>
                      </tr>
                    );
                  }

                  const iconInfo = getFileIcon(entry.name);
                  const isSelected = selectedFiles.has(entry.relativePath);
                  return (
                    <tr key={entry.relativePath} className={styles.fileRow}>
                      <td className={styles.td}>
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleFileSelection(entry)}
                        />
                      </td>
                      <td className={styles.td}>
                        <div className={styles.fileNameCell}>
                          <div
                            className={styles.fileIcon}
                            style={{ backgroundColor: iconInfo.bg, color: iconInfo.fg }}
                          >
                            {iconInfo.icon}
                          </div>
                          <Text size={200}>{entry.name}</Text>
                        </div>
                      </td>
                      <td className={styles.td}>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          {entry.name.split('.').pop()?.toUpperCase() || 'FILE'}
                        </Text>
                      </td>
                      <td className={styles.td}>
                        <Text size={200}>{formatFileSize(entry.size)}</Text>
                      </td>
                      <td className={styles.td}>
                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          {entry.lastModified ? new Date(entry.lastModified).toLocaleDateString() : '\u2014'}
                        </Text>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {selectedCount > 0 ? `${selectedCount} file(s) selected` : 'No files selected'}
          </Text>
          <div className={styles.footerActions}>
            <Button appearance="secondary" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              disabled={selectedCount === 0}
              onClick={handleSubmit}
            >
              {selectedCount > 0 ? `Select (${selectedCount})` : 'Select'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
