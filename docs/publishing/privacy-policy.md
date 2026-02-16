# IntuigenceAI for Microsoft Fabric — Privacy Policy

**Effective Date:** [TODO: Set effective date]
**Last Updated:** [TODO: Set last updated date]

---

## 1. Data Collection

IntuigenceAI for Microsoft Fabric collects and processes the following data:

### 1.1 Data You Provide

- **Documents** — Files uploaded through the DataCatalog item for processing and knowledge extraction.
- **Board content** — Interactions and configurations within IntelligentBoard items.

### 1.2 Data Collected Automatically

- **Authentication tokens** — Microsoft Entra ID tokens obtained exclusively via the Fabric SDK. No passwords are collected or stored.
- **Usage telemetry** — Anonymized usage patterns for service improvement (item creation, feature usage).
- **Error logs** — Technical error information for troubleshooting and reliability.

### 1.3 Data Not Collected

- No data is collected from users who do not actively use IntuigenceAI workload items.
- No personal data beyond what is provided by Microsoft Entra ID (display name, email, tenant ID).

## 2. Data Usage

Data collected is used for:

- Processing and extracting knowledge from uploaded documents (text extraction, embeddings, knowledge graph construction).
- Providing the IntelligentBoard collaborative canvas experience.
- Service monitoring, reliability, and performance optimization.
- Compliance with legal obligations.

Data is **not** used for:

- Advertising or marketing to third parties.
- Training AI models on customer data without explicit consent.
- Profiling individual users.

[TODO: Legal review — confirm data usage scope]

## 3. Data Storage and Residency

### 3.1 Storage Locations

| Data Type | Storage | Location |
|-----------|---------|----------|
| Fabric item definitions | Microsoft OneLake | Your Fabric tenant region |
| Raw documents | IntuigenceAI managed storage | Matched to Fabric tenant region |
| Processing outputs (text, embeddings, knowledge graph) | IntuigenceAI databases | Matched to Fabric tenant region |
| Board state | IntuigenceAI databases | Matched to Fabric tenant region |

### 3.2 Supported Regions (Public Preview)

- East US
- West Europe

Data from Fabric tenants in unsupported regions is not accepted or processed.

[TODO: Update region list as deployment expands]

### 3.3 Cross-Region Transfers

IntuigenceAI does not transfer customer data across regional boundaries. All processing occurs within the region corresponding to your Fabric tenant's home region.

## 4. Data Sharing

IntuigenceAI does not sell, rent, or share your data with third parties except:

- **Microsoft Fabric** — Item definitions are stored in OneLake as required by the Fabric platform.
- **Infrastructure providers** — Azure services used to host IntuigenceAI infrastructure (subject to Microsoft's data processing agreements).
- **Legal requirements** — When required by law, subpoena, or court order.

[TODO: Legal review — confirm third-party sharing language]

## 5. Security

IntuigenceAI implements the following security measures:

- Microsoft Entra ID authentication exclusively (no separate credentials).
- Token exchange via Fabric SDK — no direct token handling by the frontend.
- Encrypted data at rest and in transit.
- Role-based access control aligned with Fabric workspace permissions.

[TODO: Security review — expand security measures list]

## 6. User Rights

You have the right to:

- **Access** — View what data IntuigenceAI holds about you and your organization.
- **Delete** — Request deletion of your documents and associated processing outputs by removing items from your Fabric workspace.
- **Portability** — Export your original documents at any time.

To exercise these rights, contact us at [TODO: privacy@intuigence.ai].

[TODO: Legal review — confirm GDPR/privacy rights language]

## 7. Cookies

- The IntuigenceAI workload **does not use third-party cookies**.
- Authentication is handled entirely through Microsoft Entra ID tokens via the Fabric SDK and PostMessage API.
- No tracking cookies are placed by the IntuigenceAI workload.

## 8. Changes to This Policy

IntuigenceAI may update this Privacy Policy from time to time. Material changes will be communicated through the Fabric workload interface. The "Last Updated" date will be revised accordingly.

## 9. Contact

For privacy-related questions or requests:

- **Email:** [TODO: privacy@intuigence.ai]
- **Support:** https://docs.intuigence.ai/fabric/support
