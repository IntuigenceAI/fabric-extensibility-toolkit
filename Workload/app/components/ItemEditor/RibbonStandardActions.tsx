import {
  Save24Regular,
  Settings24Regular,
  Info24Regular,
  Share24Regular,
  QuestionCircle24Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import { WorkloadClientAPI } from '@ms-fabric/workload-client';
import { callGetItem } from '../../controller/ItemCRUDController';
import { callOpenSettings } from '../../controller/SettingsController';
import { RibbonAction, RibbonDropdownAction, DropdownMenuItem } from './RibbonToolbar';

// Re-export types for convenience
export type { RibbonAction, RibbonDropdownAction, DropdownMenuItem, RibbonActionType } from './RibbonToolbar';

/**
 * Standard ribbon action configurations following Fabric guidelines
 * 
 * These factory functions provide consistent action configurations that can be
 * reused across different item editors while maintaining the same look and feel.
 * 
 * Core Standard Actions:
 * - Save: Universal save action for persisting changes
 * - Settings: Common configuration/settings panel access
 * - About: Information and help action
 * - Export (Dropdown): Common export options with dropdown menu
 * 
 * Note: Other actions (Undo, Redo, Delete, Share, Print, Download, Upload, Add, Edit, Close)
 * should be implemented as custom actions specific to each item editor's needs.
 * See HelloWorldItemRibbon.tsx for examples of creating custom actions.
 * 
 * Translation: All actions use default translation keys with fallbacks for internationalization.
 * 
 * @example Basic Usage with Dropdown
 * ```tsx
 * import { createSaveAction, createExportDropdownAction, RibbonActionType } from './RibbonStandardActions';
 * 
 * const homeToolbarActions: RibbonActionType[] = [
 *   createSaveAction(handleSave, !hasChanges),
 *   createExportDropdownAction([
 *     { key: 'pdf', label: 'Export as PDF', onClick: () => exportToPdf() },
 *     { key: 'excel', label: 'Export to Excel', onClick: () => exportToExcel() },
 *     { key: 'csv', label: 'Export as CSV', onClick: () => exportToCsv() }
 *   ])
 * ];
 * ```
 */

/**
 * Creates a standard Save action with automatic translation
 * @param onClick - Save handler
 * @param disabled - Whether the save button should be disabled
 * @param label - Custom label (if not provided, will use translation key "ItemEditor_Ribbon_Save_Label")
 */
export const createSaveAction = (
  onClick: () => void | Promise<void>,
  disabled: boolean = false,
  label?: string
): RibbonAction => {
  const { t } = useTranslation();
  
  return {
    key: 'save',
    icon: Save24Regular,
    label: label || t("ItemEditor_Ribbon_Save_Label", "Save"),
    onClick,
    disabled,
    testId: 'ribbon-save-btn',
  };
};

/**
 * Creates a standard Settings action with automatic translation
 * @param onClick - Settings handler
 * @param label - Custom label (if not provided, will use translation key "ItemEditor_Ribbon_Settings_Label")
 * @param disabled - Whether the settings button should be disabled
 * @param showDividerAfter - Whether to show a divider after this action (defaults to true)
 */
export const createSettingsAction = (
  onClick: () => void | Promise<void>,
  label?: string,
  disabled: boolean = false,
  showDividerAfter: boolean = true
): RibbonAction => {
  const { t } = useTranslation();
  
  return {
    key: 'settings',
    icon: Settings24Regular,
    label: label || t("ItemEditor_Ribbon_Settings_Label", "Settings"),
    onClick,
    disabled,
    testId: 'ribbon-settings-btn',
    showDividerAfter
  };
};

/**
 * Creates a standard About/Info action with automatic translation
 * @param onClick - About handler
 * @param label - Custom label (if not provided, will use translation key "ItemEditor_Ribbon_About_Label")
 * @param disabled - Whether the about button should be disabled
 */
export const createAboutAction = (
  onClick: () => void | Promise<void>,
  label?: string,
  disabled: boolean = false
): RibbonAction => {
  const { t } = useTranslation();
  
  return {
    key: 'about',
    icon: Info24Regular,
    label: label || t("ItemEditor_Ribbon_About_Label", "About"),
    onClick,
    disabled,
    testId: 'ribbon-about-btn'
  };
};

/**
 * Creates a standard Export dropdown action with automatic translation
 * @param exportItems - Array of export options for the dropdown menu
 * @param label - Custom label (if not provided, will use translation key "ItemEditor_Ribbon_Export_Label")
 * @param disabled - Whether the export button should be disabled
 * @param showDividerAfter - Whether to show a divider after this action
 */
export const createExportDropdownAction = (
  exportItems: DropdownMenuItem[],
  label?: string,
  disabled: boolean = false,
  showDividerAfter: boolean = false
): RibbonDropdownAction => {
  const { t } = useTranslation();

  return {
    key: 'export',
    icon: Share24Regular,
    label: label || t("ItemEditor_Ribbon_Export_Label", "Export"),
    onClick: () => {}, // Not used for dropdown actions
    disabled,
    testId: 'ribbon-export-btn',
    showDividerAfter,
    dropdownItems: exportItems
  };
};

/**
 * Creates a Settings action that opens Fabric's built-in item settings pane.
 * Icon-only (no label) per Fabric UX guidelines for the settings gear.
 *
 * Fetches full item metadata via callGetItem and passes it to callOpenSettings
 * so the settings pane lifecycle is managed correctly by Fabric.
 *
 * @param workloadClient - Fabric workload client instance
 * @param itemObjectId - The current item's object ID
 * @param showDividerAfter - Whether to show a divider after this action (defaults to false)
 */
/**
 * Opens Fabric's item settings pane for the given item.
 * Fetches full item metadata before opening so the pane lifecycle is managed correctly.
 */
export async function openItemSettings(
  workloadClient: WorkloadClientAPI,
  itemObjectId: string,
): Promise<void> {
  const result = await callGetItem(workloadClient, itemObjectId);
  if (result?.item) {
    await callOpenSettings(workloadClient, result.item);
  }
}

export const createItemSettingsAction = (
  workloadClient: WorkloadClientAPI,
  itemObjectId: string | undefined,
  showDividerAfter: boolean = false,
): RibbonAction => {
  return {
    key: 'settings',
    icon: Settings24Regular,
    tooltip: 'Settings',
    onClick: () => {
      if (!itemObjectId) return;
      openItemSettings(workloadClient, itemObjectId).catch((err) =>
        console.error('[Ribbon] Failed to open settings:', err),
      );
    },
    disabled: !itemObjectId,
    testId: 'ribbon-settings-btn',
    showDividerAfter,
  };
};

/**
 * Documentation URL from the workload manifest (Product.json supportLink.documentation)
 */
const DOCUMENTATION_URL = 'https://www.intuigence.ai/fabric-workload/intuigence-ai-documentation';

/**
 * Creates a Help action that opens the workload documentation in a new tab.
 * @param url - Documentation URL (defaults to manifest documentation link)
 */
export const createHelpAction = (
  url: string = DOCUMENTATION_URL,
  showDividerAfter: boolean = true,
): RibbonAction => {
  const { t } = useTranslation();

  return {
    key: 'help',
    icon: QuestionCircle24Regular,
    label: t("ItemEditor_Ribbon_Help_Label", "Help"),
    onClick: () => { window.open(url, '_blank'); },
    tooltip: t("ItemEditor_Ribbon_Help_Tooltip", "Open documentation"),
    testId: 'ribbon-help-btn',
    showDividerAfter,
  };
};