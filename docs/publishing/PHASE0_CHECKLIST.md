# Phase 0 — Publishing Prerequisites Checklist

Manual tasks required before publishing the workload to Fabric marketplace.

> **Note:** The codebase is the same for dev and production. The difference is config
> values only (Entra app ID, frontend URL, API URLs). For local development and testing,
> the existing dev app registration (`bb17c7ba-...` in `.env.dev`) works fine.
> Items 1-3 (production Entra app) can be deferred until you're ready to publish —
> they don't block feature development.

---

## 1. Register Production Multitenant Entra Application

- [ ] Go to Azure Portal > Microsoft Entra ID > App registrations > New registration
- [ ] Set name: `IntuigenceAI for Fabric` (must align with workload publisher name)
- [ ] Set supported account types: **Accounts in any organizational directory (Multitenant)**
- [ ] Set redirect URI: `https://fabric.intuigence.ai/close` (Web platform)
- [ ] Record the **Application (client) ID** — this goes into `.env.prod` as `FRONTEND_APPID`
- [ ] Record the **Directory (tenant) ID**

> Can be deferred until publishing time. Dev uses existing single-tenant app.

**Owner:** [TODO]
**Status:** Not started

---

## 2. Verify Custom Domain

- [ ] In the production Entra App registration, go to Branding & properties
- [ ] Add `intuigence.ai` as a verified publisher domain
- [ ] Add DNS TXT record to `intuigence.ai` as instructed by Entra
- [ ] Wait for DNS propagation and verify

> Depends on item 1. Can be deferred until publishing time.

**Owner:** [TODO]
**Status:** Not started

---

## 3. Configure Fabric.Extend Scope

- [ ] In the production Entra App registration, go to API permissions
- [ ] Add permission: Microsoft APIs > Power BI Service (or Fabric) > `Fabric.Extend`
- [ ] This is a static dependency required for all Fabric workloads
- [ ] Grant admin consent for the tenant

> Depends on item 1. Can be deferred until publishing time.

**Owner:** [TODO]
**Status:** Not started

---

## 4. Create Azure Marketplace SaaS Offer

- [ ] Go to Partner Center (https://partner.microsoft.com/dashboard)
- [ ] Create a new SaaS offer for IntuigenceAI
- [ ] Set offer name: `IntuigenceAI Industrial Workers`
- [ ] Configure pricing plan (free tier for Preview recommended)
- [ ] Add offer description, screenshots, and support contacts
- [ ] Submit for review
- [ ] Record the Marketplace offer URL — this goes into Product.json `supportLink.license`

**Owner:** [TODO]
**Status:** Not started

---

## 5. Deploy `docs.intuigence.ai` Static Site

- [ ] Set up static site hosting (Azure Static Web Apps or equivalent)
- [ ] Configure custom domain: `docs.intuigence.ai`
- [ ] Deploy initial content from `docs/publishing/`:
  - Terms of Use → `https://docs.intuigence.ai/terms`
  - Privacy Policy → `https://docs.intuigence.ai/privacy`
  - Documentation → `https://docs.intuigence.ai/fabric`
  - Vendor Attestation (Section III) → `https://docs.intuigence.ai/fabric/attestation`
  - Support page → `https://docs.intuigence.ai/fabric/support`
- [ ] Verify all URLs are reachable via HTTPS
- [ ] Verify URLs match what's configured in `Product.json`

**Owner:** [TODO]
**Status:** Not started

---

## 6. Commission Icon Design

- [ ] Share `docs/publishing/ICON_REQUIREMENTS.md` with design team
- [ ] Design 27 icon/image assets total:
  - 3 product-level (product icon 240x240, favicon 32x32, banner 1920x240)
  - 12 DataCatalog (6 sizes x 2 states)
  - 12 IntelligentBoard (6 sizes x 2 states)
- [ ] Place completed assets in `Workload/assets/images/`
- [ ] Update manifest files to reference new asset filenames

**Owner:** [TODO]
**Status:** Not started

---

## 7. Deploy IntuigenceAI Clusters

- [ ] Deploy IntuigenceAI backend cluster in **East US** Azure region
  - NestJS Gateway, FastAPI Backend, PostgreSQL, Neo4j, PgVector, Redis, Blob Storage
- [ ] Deploy IntuigenceAI backend cluster in **West Europe** Azure region
  - Same components as East US
- [ ] Configure region routing so Fabric tenants are directed to the correct regional cluster
- [ ] Verify data isolation — confirm no cross-region data transfer
- [ ] Record cluster endpoints for `.env.prod`:
  - `INTUIGENCE_APP_URL` (frontend app URL)
  - `INTUIGENCE_API_URL` (backend API URL)

**Owner:** [TODO]
**Status:** Not started

---

## Completion Criteria

All items must be completed before publishing submission. Items 1-3 can be deferred during feature development — the existing dev app registration is sufficient for Phases 1-4.

The following automated checks are already in place:

- [x] `/close` standalone page created and configured in build pipeline
- [x] Environment files updated with IntuigenceAI variables
- [x] Product.json support URLs point to `docs.intuigence.ai`
- [x] Publishing documentation templates created
- [x] Icon requirements specified
- [x] Vendor attestation template created
