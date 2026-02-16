# IntuigenceAI for Microsoft Fabric — Documentation

## Overview

IntuigenceAI brings intelligent document processing and AI-powered collaboration to Microsoft Fabric. It provides two workload items that integrate natively with your Fabric workspace:

- **DataCatalog** — Upload, process, and organize documents with automated knowledge extraction including text parsing, embeddings, and knowledge graph construction.
- **IntelligentBoard** — An AI-powered collaborative canvas (TLDraw-based) for visual document analysis, chat-based reasoning, and team collaboration.

## Getting Started

### Prerequisites

- An active Microsoft Fabric subscription
- A Fabric workspace with contributor or higher permissions
- A Fabric tenant in a [supported region](#supported-regions)

### Creating Your First DataCatalog

1. Navigate to your Fabric workspace.
2. Click **+ New** and select **DataCatalog** under the IntuigenceAI section.
3. Name your catalog and click **Create**.
4. Upload documents using the upload panel — supported formats include PDF, DOCX, XLSX, and more.
5. Monitor processing status in the document table. Processing includes text extraction, embedding generation, and knowledge graph construction.

[TODO: Add screenshots and detailed walkthrough]

### Creating Your First IntelligentBoard

1. Navigate to your Fabric workspace.
2. Click **+ New** and select **IntelligentBoard** under the IntuigenceAI section.
3. Name your board and click **Create**.
4. The board opens as an interactive canvas where you can:
   - Add documents from your DataCatalogs
   - Chat with AI agents about your documents
   - Create visual layouts and annotations

[TODO: Add screenshots and detailed walkthrough]

## DataCatalog Documentation

### Document Upload

[TODO: Document the upload flow — OneLake picker, local file upload, drag-and-drop]

### Document Processing

[TODO: Document the processing pipeline — text extraction, embeddings, knowledge graph]

### Document Management

[TODO: Document the document table — status, metadata, actions]

## IntelligentBoard Documentation

### Canvas Interface

[TODO: Document the TLDraw canvas — tools, navigation, collaboration]

### AI Chat and Agents

[TODO: Document the chat interface — agent types, capabilities, document context]

## Authentication and Single Sign-On (SSO)

IntuigenceAI uses Microsoft Entra ID exclusively for authentication. There is no separate login — your Fabric identity is used automatically.

### How It Works

1. When you open an IntuigenceAI item, the workload obtains an Entra token via the Fabric SDK.
2. This token is exchanged with the IntuigenceAI backend using a secure token exchange flow (OBO — On Behalf Of).
3. Your session is established without any manual login steps.

### Conditional Access

IntuigenceAI fully supports Microsoft Entra Conditional Access policies. If your organization enforces MFA, device compliance, or location-based access, these policies are respected automatically.

## Data Residency

### Supported Regions

IntuigenceAI for Microsoft Fabric is available in the following Azure regions:

| Region | Status |
|--------|--------|
| East US | Available |
| West Europe | Available |

### How Region Selection Works

- Your data is automatically processed and stored in the Azure region that matches your Fabric tenant's home region.
- If your Fabric tenant is in an unsupported region, the workload will display a notification and will not process data.
- No customer data is transferred across regional boundaries.

[TODO: Update region table as deployment expands]

## Support

For help with IntuigenceAI for Microsoft Fabric:

- **Documentation:** https://docs.intuigence.ai/fabric
- **Support:** https://docs.intuigence.ai/fabric/support
- **Email:** [TODO: support@intuigence.ai]
