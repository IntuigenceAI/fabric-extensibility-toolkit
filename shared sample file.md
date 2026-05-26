## Handoff: Fabric “shared sample” file processing (two repos)

### Repos and roles

| Repo | Role |
|------|------|
| **`svc-data-catalog`** (`backend/web`) | NestJS **data-catalog API**: seeds shared sample files under a fixed tenant, exposes HTTP APIs, owns DB rows for `FileUpload` / `Document` / org. |
| **`fabric-extensibility-toolkit`** (`Workload/app`) | Fabric workload UI + **`IntuigenceAPIClient`**: calls the APIs, stores sample mode on the Data Catalog definition, drives board/chat integration. |
| **`svc-data-catalog`** (`backend/core` Python) | Chat / assistant paths: when the workspace belongs to the sample tenant, **document resolution** uses that tenant so sample docs resolve. |

---

### Canonical tenant and constants (must stay aligned)

- **Shared sample tenant UUID** (Nest + comments in TS):  
  `backend/web/src/common/constants/sample-tenant.ts` → `SAMPLE_TENANT_ID = '00000000-0000-4000-a000-000000fab001'`
- **Python chat** must use the **same** value:  
  `backend/core/src/intai/routes/chat.py` → `SAMPLE_TENANT_ID = UUID("00000000-0000-4000-a000-000000fab001")`  
  If these diverge, sample boards will not get `effective_tenant_id` overrides and document lookups can fail silently or 404.

---

### NestJS routing (`svc-data-catalog`)

- **Global prefix**: `main.ts` → `app.setGlobalPrefix('api')` → all controllers are under **`/api/...`**.
- **Two controllers share the same path prefix** `@Controller('v2/files')`:
  - **`OneLakeController`** (`onelake/onelake.controller.ts`) — OneLake ingest, quotas, **shared sample** endpoints, legacy per-tenant `seed-sample`.
  - **`FilesController`** (`files/files.controller.ts`) — includes **`@Get(':id/status')`** and **`@Get(':id')`**.

**Critical collision rules**

1. **`GET /api/v2/files/<anything>/status`** is always **`FilesController` `getStatus`** with `id = <first segment>`.  
   Example: `…/sample/status` → `id = "sample"` → UUID cast error → **500**.
2. **`GET /api/v2/files/<single-segment>`** is **`FilesController` `getFile`** with `id =` that segment.  
   Example: `…/sample-status` → `id = "sample-status"` → **not** a UUID → **500**.
3. **Safe pattern**: put sample-specific GETs under a **static multi-segment path** that does not end in a lone `…/status` after one variable segment. Current choice: **`GET fabric/sample-status`** on `OneLakeController` (same family as **`GET fabric/upload-quota`**).

**Module order** (`app.module.ts`): `OneLakeModule` is imported **before** `FilesModule`; `GatewayModule` is **last**. The gateway catch-all must not shadow these routes if module order stays as-is.

---

### HTTP API surface (latest intended behavior)

All paths are relative to **`INTUIGENCE_API_URL`** (toolkit) and hit **`/api`** + route below.

| Method | Path | Controller | Purpose |
|--------|------|--------------|---------|
| POST | `/api/v2/files/seed-sample-shared` | OneLake | Idempotent **shared** seed: if sample uploads already exist for `SAMPLE_TENANT_ID`, returns built status; else runs `processSampleFiles`. |
| GET | `/api/v2/files/fabric/sample-status` | OneLake | Poll shared sample processing; if **no** uploads yet, returns `{ status: 'processing', results: [] }`; else `buildSampleStatusResponse`. |
| POST | `/api/v2/files/seed-sample` | OneLake | **Per-tenant** sample seed (user’s tenant), still in API for older flows; **not** what `useDataCatalog.seedSampleData` uses by default. |
| GET | `/api/v2/files/fabric/upload-quota` | OneLake | Trial upload quota (excludes `source: 'sample'`). |
| POST | `/api/v2/files/ingest-onelake` | OneLake | Normal OneLake ingestion. |

**Auth**: shared sample calls use **`getWorkloadToken()`** (same pattern as OneLake ingest), not the bridge’s default graph token, unless you change it.

---

### Backend processing details (`onelake.controller.ts`)

- **Sample file list** (`SAMPLE_FILES`): e.g. `Sample_PnID.jpg`, `Sample_Equipment_Manual_Pump_P101A.pdf`, `Sample_Temperature_Sensor_Readings.csv` (types: pnid, document, timeseries).
- **Shared seed** creates uploads with **`tenantId: SAMPLE_TENANT_ID`**, **`properties: { source: 'sample' }`**, then `startUpload` → `saveFileBuffer` → `completeUpload`.
- **Status query** (`getSampleFileUploads`): `tenantId = SAMPLE_TENANT_ID`, `properties->>'source' = 'sample'`, `deletedAt IS NULL`.
- **`buildSampleStatusResponse`**: joins **`Document`** by upload id for `isIndexed`; **`status: 'ready'`** when every upload is `completed` or `failed`; includes **`workspaceId`** from **`upload.properties.workspace_id`** (first truthy). If nothing in the pipeline sets `workspace_id` on those properties, **`workspaceId` may be missing** in API responses even when files are ready — worth checking if the board iframe mis-resolves context.
- **Assets**: `resolveSamplesDir()` checks paths under `assets/fabric-samples` (dev vs Docker `cwd`). Missing dir → seed failures / “file not found” in logs.

---

### Toolkit / UI (`fabric-extensibility-toolkit`)

- **`IntuigenceAPIClient`** (`Workload/app/clients/IntuigenceAPIClient.ts`):  
  - `seedSampleDataShared()` → `POST …/seed-sample-shared`  
  - `getSampleStatus()` → **`GET …/fabric/sample-status`** (aligned with Nest after the fix above)  
  - `getUploadQuota()` → `GET …/fabric/upload-quota`  
  - Legacy `seedSampleData()` → `POST …/seed-sample` (still present).
- **`useDataCatalog`** (`hooks/useDataCatalog.ts`): “Start with example data” uses **`seedSampleDataShared()`**; on `ready` calls **`populateSampleDocs`**, which sets **`isSampleMode: true`**, **`sampleWorkspaceId`**, and builds **`documents`** with **`sourceType: 'sample'`** from `fileId` / metadata. While processing, it polls **`getSampleStatus()`** every 3s.
- **`DataCatalogDefinition`**: optional **`isSampleMode`**, **`sampleWorkspaceId`**.
- **`useIntelligentBoard`**: if definition has sample mode + `sampleWorkspaceId`, **`boardId`** prefers **`sampleWorkspaceId`** over `intuigenceMapping.workspaceId`; skips some per-board provisioning when in sample mode.
- **`useBoardMessaging`**: passes **`allowedDocumentIds`** from catalog doc IDs when catalogs are connected — sample docs must be in the catalog definition for the iframe to allow them.
- **UI**: `MainView`, `DataCatalogRibbon`, `DataCatalogEditor`, `BoardView` branch on **`isSampleMode`** (hide add/remove, show copy, etc.).

---

### Python chat cross-tenant behavior (`chat.py`)

For **`conversation.context_type == "workspace"`**, after loading workspace:

- If **`workspace.tenant_id == SAMPLE_TENANT_ID`**, set **`effective_tenant_id = SAMPLE_TENANT_ID`** for **`generate_system_prompt(..., tenant_id=effective_tenant_id)`** so documents on the shared tenant resolve.

If the workspace row is still on the user’s org tenant while documents live on `SAMPLE_TENANT_ID`, this branch will **not** fire and RAG/context can break.

---

## Debugging instructions (for the other agent)

1. **Confirm URL path at the pod** (not only the browser bar). Kong may expose `…/v2/api/…`; the Nest app serves **`/api/v2/files/...`**. Trace one request to the service and log **`req.method` + `req.path`** (or enable access logs).

2. **If you see 500 with Postgres “invalid input syntax for type uuid”**  
   - Almost always **`FilesController`** treating a string as file id.  
   - Grep the path: does it match **`/v2/files/:id`** or **`/v2/files/:id/status`**?  
   - Fix: use **`/api/v2/files/fabric/sample-status`** (or another path that cannot match those patterns).

3. **If you see 404 on sample status**  
   - Confirm **`OneLakeModule`** is loaded and **`@Get('fabric/sample-status')`** is deployed.  
   - Grep both repos for old paths: `sample-status`, `sample/status`, `fabric/sample-status`.

4. **If seed returns `accepted` but never becomes `ready`**  
   - Check BullMQ / processing workers, `FileUpload.processingStatus`, and **`Document.isIndexed`**.  
   - Check **`assets/fabric-samples`** exists in the running image.

5. **If UI is “sample mode” but chat cannot see documents**  
   - DB: workspace **`tenant_id`** vs **`SAMPLE_TENANT_ID`**.  
   - Python **`SAMPLE_TENANT_ID`** equals TS constant.  
   - **`workspaceId` / `sampleWorkspaceId`** in the definition vs actual workspace UUID used by the board iframe.

6. **If `workspaceId` is always undefined in seed/status JSON**  
   - Inspect whether **`file_upload.properties.workspace_id`** is ever set post-`completeUpload` / processing. **`buildSampleStatusResponse`** only reads that field.

7. **Env**  
   - Toolkit: **`INTUIGENCE_API_URL`**, **`INTUIGENCE_APP_URL`**, Fabric token bridge.  
   - Nest: **`TRIAL_FABRIC_MAX_DOCUMENTS_PER_USER`**, DB schema, auth guard (401 vs 500).
