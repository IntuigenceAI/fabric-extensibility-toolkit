# IntuigenceAI for Microsoft Fabric — Terms of Use

**Effective Date:** [TODO: Set effective date]
**Last Updated:** [TODO: Set last updated date]

---

## 1. Agreement

These Terms of Use ("Terms") govern your use of the IntuigenceAI workload ("Service") within Microsoft Fabric. By accessing or using the Service, you agree to be bound by these Terms.

[TODO: Legal review — confirm agreement structure and governing law]

## 2. Service Description

IntuigenceAI for Microsoft Fabric provides two workload items:

- **DataCatalog** — Document ingestion, processing, and knowledge extraction within your Fabric workspace.
- **IntelligentBoard** — AI-powered collaborative canvas for document analysis and reasoning.

The Service operates as a Microsoft Fabric workload extension and requires an active Microsoft Fabric subscription.

## 3. Authentication and Access

- The Service uses Microsoft Entra ID exclusively for authentication.
- Access is governed by your organization's Entra tenant policies, including Conditional Access.
- No separate account registration is required — your Fabric identity is used.

[TODO: Legal review — confirm Entra-only auth language]

## 4. Acceptable Use

You agree not to:

- Use the Service to process data in violation of applicable laws or regulations.
- Attempt to circumvent authentication, authorization, or security controls.
- Upload malicious content or attempt to exploit the document processing pipeline.
- Use the Service in a manner that degrades performance for other users.

[TODO: Legal review — expand acceptable use policy]

## 5. Data Processing

- Documents uploaded through DataCatalog are processed and stored by IntuigenceAI within the Azure region corresponding to your Fabric tenant's home region.
- For supported regions, see the [Data Residency](#7-data-residency) section.
- Item definitions (metadata) are stored in Microsoft OneLake. Document content and processing outputs are stored in IntuigenceAI's managed infrastructure.

[TODO: Legal review — confirm data processing language aligns with DPA]

## 6. Intellectual Property

- You retain all rights to content you upload to the Service.
- IntuigenceAI retains all rights to the Service, its technology, and any derived processing outputs (embeddings, knowledge graphs) that are not your original content.

[TODO: Legal review — IP ownership language]

## 7. Data Residency

For Public Preview, the Service supports the following Azure regions:

- East US
- West Europe

Data from Fabric tenants in unsupported regions will not be processed. The Service will display a notification if your region is not supported.

[TODO: Update region list as deployment expands]

## 8. Limitation of Liability

[TODO: Legal review — draft limitation of liability clause]

## 9. Termination

- You may stop using the Service at any time by removing IntuigenceAI items from your Fabric workspace.
- IntuigenceAI reserves the right to suspend or terminate access for violations of these Terms.
- Upon termination, your data will be retained for [TODO: specify retention period] before deletion.

## 10. Changes to Terms

IntuigenceAI may update these Terms from time to time. Material changes will be communicated through the Fabric workload interface. Continued use after changes constitutes acceptance.

## 11. Contact

For questions about these Terms:

- **Email:** [TODO: legal@intuigence.ai]
- **Support:** https://docs.intuigence.ai/fabric/support
