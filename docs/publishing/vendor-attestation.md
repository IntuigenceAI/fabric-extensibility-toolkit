# IntuigenceAI for Microsoft Fabric — Vendor Attestation

---

## Section I: ISV Information

| Field | Value |
|-------|-------|
| Company Name | IntuigenceAI |
| Primary Contact | [TODO: Name and email] |
| Company Website | https://intuigence.ai |
| Workload Name | IntuigenceAI Industrial Workers |
| Entra App ID | [TODO: Production multitenant Entra App ID] |
| Marketplace Offer | [TODO: Azure Marketplace SaaS offer link] |

---

## Section II: Attestation Statement

> IntuigenceAI ("the ISV") attests that the IntuigenceAI workload for Microsoft Fabric ("the Workload") has been developed in compliance with Microsoft Fabric's workload publishing requirements as detailed in the Requirements Checklist (Section III). The Workload meets the required standards for business, technical, design/UX, security, support, and Fabric feature integration as outlined below.
>
> [TODO: Legal review — finalize attestation language]
>
> **Signed:** [TODO: Authorized signatory name and title]
> **Date:** [TODO: Date of attestation]

---

## Section III: Requirements Checklist

This section is publicly hosted at: https://docs.intuigence.ai/fabric/attestation

### 1. Business Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 1.1 | Value proposition clearly articulated | [TODO] | IntuigenceAI brings intelligent document processing and AI-powered collaboration to Microsoft Fabric, providing DataCatalog for document ingestion/knowledge extraction and IntelligentBoard for visual AI-powered analysis. |
| 1.2.1 | Terms of Use URL (HTTPS, reachable) | [TODO] | https://docs.intuigence.ai/terms |
| 1.2.2 | Privacy Policy URL (HTTPS, reachable) | [TODO] | https://docs.intuigence.ai/privacy |
| 1.3.1 | Azure Marketplace SaaS offer published | [TODO] | [TODO: Marketplace offer link] |
| 1.3.2 | Marketplace offer link in manifest | [TODO] | Configured in Product.json `supportLink.license` |
| 1.3.3 | Publisher name is clear | Yes | "IntuigenceAI" |
| 1.3.4 | Publisher name aligned with Marketplace | [TODO] | Ensure consistency between manifest and Marketplace listing |
| 1.4.1 | Attestation URL (HTTPS, reachable) | [TODO] | https://docs.intuigence.ai/fabric/attestation |
| 1.4.2 | Getting started materials | [TODO] | https://docs.intuigence.ai/fabric |
| 1.4.3 | At-a-glance section has image/video | [TODO] | Product demo video planned |
| 1.4.4 | Learning material on static pages | [TODO] | https://docs.intuigence.ai/fabric |
| 1.4.5 | Documentation URL (HTTPS, reachable) | [TODO] | https://docs.intuigence.ai/fabric |

### 2. Technical Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 2.1.1 | Verified Entra App ID | [TODO] | [TODO: Multitenant Entra app registered and verified] |
| 2.1.2 | Fabric.Extend scope dependency | [TODO] | Static dependency configured in Entra app registration |
| 2.1.3 | Redirect URI = `{frontend}/close` | [TODO] | Standalone `/close` page serves `window.close()` only |
| 2.1.4 | Minimal Entra scopes | Yes | Only essential scopes requested |
| 2.2 | OneLake integration | Yes | Item definitions stored in OneLake. Document content stored in IntuigenceAI managed infrastructure (justified: knowledge processing outputs are not raw files). |
| 2.3 | Entra Conditional Access | [TODO] | Token exchange flow handles CA claims challenges |
| 2.4 | Monitoring & diagnostics (30-day retention) | [TODO] | IntuigenceAI maintains application logging with minimum 30-day retention |
| 2.5 | B2B cross-tenant collaboration | N/A (MVP) | Workload item access within tenant only |
| 2.6 | BCDR plan | [TODO] | [TODO: Document BCDR plan] |
| 2.7 | Performance (< 3s load, 99.9% uptime) | [TODO] | Performance testing to be completed |
| 2.8 | Presence (regional availability) | [TODO] | Supported regions: East US, West Europe |
| 2.9 | Accessibility | [TODO] | Fluent UI v9 provides baseline accessibility; audit planned |
| 2.10 | World readiness (English default) | Yes | English is the only supported language |

### 3. Design/UX Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 3.1.1 | Clear workload name (no generic "AI") | Yes | "IntuigenceAI" — includes company name, not generic |
| 3.1.2 | Custom icons and images | [TODO] | All icon assets to be designed per ICON_REQUIREMENTS.md |
| 3.1.3 | Clear subtitle/slogan | [TODO] | [TODO: Write subtitle] |
| 3.1.4 | Clear workload description | [TODO] | [TODO: Write description] |
| 3.1.5 | Banner 1920x240 | [TODO] | [TODO: Design banner] |
| 3.1.6 | Gallery: no non-product ads | Yes | Product-only demo content |

### 4. Security & Compliance Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 4.1 | Security review completed | [TODO] | [TODO: Conduct security assessment] |
| 4.1.1 | Entra token from Fabric host before JS calls | Yes | Implemented in authentication bridge |
| 4.1.2 | Entra tokens ONLY via Fabric SDK JS APIs | Yes | No MSAL or custom auth mechanisms used |
| 4.1.3 | No third-party cookies | Yes | PostMessage-based auth for iframe communication |
| 4.1.4 | Entra app name/publisher aligned | [TODO] | Ensure consistency at registration |
| 4.2 | Privacy review completed | [TODO] | [TODO: Conduct privacy assessment] |
| 4.2.1 | Only essential HTTP-only cookies after auth | Yes | No cookies in workload; iframe uses PostMessage |
| 4.2.2 | No third-party cookies | Yes | Covered by PostMessage approach |
| 4.2.3 | Entra tokens via SDK only | Yes | Covered by authentication bridge design |
| 4.3 | Data Residency | Yes | Supported-regions model: East US, West Europe. Data from unsupported regions not accepted. No cross-region transfers. |
| 4.4 | Compliance attestation | [TODO] | This document |

### 5. Support Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 5.1 | Live site contact details | [TODO] | [TODO: Provide contact info to Microsoft] |
| 5.2 | Supportability (SLA, contact methods) | [TODO] | [TODO: Document support parameters] |
| 5.2.1 | Help URL in manifest | [TODO] | https://docs.intuigence.ai/fabric/support |
| 5.2.2 | Support contact in product details | [TODO] | [TODO: Add support contact] |
| 5.3 | Service health dashboard | N/A (Preview) | Planned for GA |

### 6. Fabric Feature Requirements

| ID | Requirement | Status | Details |
|----|-------------|--------|---------|
| 6.1 | ALM (lifecycle management) | [TODO] | [TODO: Implement or declare limitations] |
| 6.2 | Private Links | [TODO] | [TODO: Evaluate backend compatibility] |
| 6.3 | Data Hub integration | Yes | DataCatalog supports DataHub (`supportedInDatahubL1: true`) |
| 6.4 | Data Lineage | [TODO] | [TODO: Declare approach] |
| 6.5 | Sensitivity Labels | [TODO] | [TODO: Evaluate Purview label propagation] |
| 6.5.1 | Sensitivity Labels on exports | N/A | No export functionality in MVP |
