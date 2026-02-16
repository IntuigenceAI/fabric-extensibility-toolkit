# IntuigenceAI for Microsoft Fabric — Icon Asset Requirements

This document specifies every icon and image asset required for Fabric publishing validation.

---

## File Naming Convention

```
{ItemName}_Icon_{Size}.png          — Default state
{ItemName}_Icon_Active_{Size}.png   — Active/selected state
IntuigenceAI_{AssetType}_{Size}.png — Product-level assets
```

All files go in: `Workload/assets/images/`

---

## 1. Product-Level Assets

| File Name | Dimensions | Usage | Manifest Field |
|-----------|-----------|-------|----------------|
| `IntuigenceAI_Product_240.png` | 240x240 px | Product icon in Workload Hub | `product.icon` |
| `IntuigenceAI_Favicon.png` | 32x32 px | Browser tab favicon | `product.favicon` |
| `IntuigenceAI_Banner_1920x240.png` | 1920x240 px | Workload Hub banner | `product.productDetail.image` |

**Total: 3 files**

---

## 2. DataCatalog Item Icons

Each size requires both a **default** and **active** (selected) variant.

| File Name | Dimensions | Interior Icon | Usage |
|-----------|-----------|---------------|-------|
| `DataCatalog_Icon_20.png` | 20x20 px | 12px | Workspace list, L2 page |
| `DataCatalog_Icon_24.png` | 24x24 px | 14px | Cards, workspace, workload L2 |
| `DataCatalog_Icon_32.png` | 32x32 px | 20px | Create menu |
| `DataCatalog_Icon_40.png` | 40x40 px | 24px | Item detail |
| `DataCatalog_Icon_48.png` | 48x48 px | 28px | Large display |
| `DataCatalog_Icon_64.png` | 64x64 px | 36px | Featured display |
| `DataCatalog_Icon_Active_20.png` | 20x20 px | 12px | Active state — workspace list |
| `DataCatalog_Icon_Active_24.png` | 24x24 px | 14px | Active state — cards |
| `DataCatalog_Icon_Active_32.png` | 32x32 px | 20px | Active state — create menu |
| `DataCatalog_Icon_Active_40.png` | 40x40 px | 24px | Active state — item detail |
| `DataCatalog_Icon_Active_48.png` | 48x48 px | 28px | Active state — large display |
| `DataCatalog_Icon_Active_64.png` | 64x64 px | 36px | Active state — featured display |

**Total: 12 files**

---

## 3. IntelligentBoard Item Icons

Same size/variant matrix as DataCatalog.

| File Name | Dimensions | Interior Icon | Usage |
|-----------|-----------|---------------|-------|
| `IntelligentBoard_Icon_20.png` | 20x20 px | 12px | Workspace list, L2 page |
| `IntelligentBoard_Icon_24.png` | 24x24 px | 14px | Cards, workspace, workload L2 |
| `IntelligentBoard_Icon_32.png` | 32x32 px | 20px | Create menu |
| `IntelligentBoard_Icon_40.png` | 40x40 px | 24px | Item detail |
| `IntelligentBoard_Icon_48.png` | 48x48 px | 28px | Large display |
| `IntelligentBoard_Icon_64.png` | 64x64 px | 36px | Featured display |
| `IntelligentBoard_Icon_Active_20.png` | 20x20 px | 12px | Active state — workspace list |
| `IntelligentBoard_Icon_Active_24.png` | 24x24 px | 14px | Active state — cards |
| `IntelligentBoard_Icon_Active_32.png` | 32x32 px | 20px | Active state — create menu |
| `IntelligentBoard_Icon_Active_40.png` | 40x40 px | 24px | Active state — item detail |
| `IntelligentBoard_Icon_Active_48.png` | 48x48 px | 28px | Active state — large display |
| `IntelligentBoard_Icon_Active_64.png` | 64x64 px | 36px | Active state — featured display |

**Total: 12 files**

---

## 4. Design Guidelines

### Container Shape
- Icons use a **container shape** (rounded square or circle per Fabric UX system) with an **interior Fluent system icon**.
- The interior icon size is specified per dimension above.

### Color Palette
- **Default state**: Use IntuigenceAI brand colors on a neutral background.
- **Active state**: Must be visually distinct from default — typically uses a filled/highlighted variant of the same icon.
- Ensure sufficient contrast for accessibility (WCAG AA minimum).

### Format
- All icons must be **PNG** format with transparent backgrounds.
- Export at 1x resolution (no @2x required — Fabric handles scaling).

### Banner
- The banner (1920x240) should showcase the IntuigenceAI brand and product.
- No text smaller than 14px — banner is displayed at various widths.

### Favicon
- 32x32 px, PNG format.
- Should be recognizable at small size — use a simplified version of the product icon.

---

## Summary

| Category | Files |
|----------|-------|
| Product-level (icon, favicon, banner) | 3 |
| DataCatalog (6 sizes x 2 states) | 12 |
| IntelligentBoard (6 sizes x 2 states) | 12 |
| **Total** | **27** |
