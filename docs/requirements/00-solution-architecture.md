# Solution Architecture — Deployment Assistant

## 1. Executive Summary

The Deployment Assistant (DeployAssist) is an internal operations application that provides visibility, analytics, and management capabilities for Professional Services (PS) provisioning workflows. It aggregates data from Salesforce, SML (a proprietary tenant management system), Jira, and Microsoft Graph into a unified interface, offering real-time monitoring, historical analytics, custom AI-generated reports, and administrative tools.

Before this application existed, PS Operations staff relied on manually querying Salesforce, cross-referencing tenant data in SML, and assembling Excel-based reports — a fragmented process prone to delays, data staleness, and human error. DeployAssist consolidates these workflows into a single, role-controlled interface that surfaces actionable insights in seconds rather than hours.

The application is built as a monorepo with a React single-page application (SPA) frontend, an Express.js backend API, a PostgreSQL database, and an MCP (Model Context Protocol) server that exposes application capabilities to AI agents.

---

## 2. High-Level Architecture

The system is organized into four principal tiers: a browser-based frontend, a backend API server, persistent storage, and external service integrations. A supplementary MCP server layer enables AI agents to interact with the same data and operations that the UI exposes.

```
┌─────────────────────────────────────────────────────────────────────┐
│                         End Users (Browser)                         │
│                     React SPA (Vite + Tailwind)                     │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTPS (port 8080 dev / served by Express in prod)
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       Express.js API Server                         │
│                          (Node.js, port 5000)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │   Auth   │ │  Routes  │ │ Services │ │      Middleware         │ │
│  │Middleware │ │(30+ files│ │(25+ files│ │(CORS, Rate Limit, etc.)│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────────┘ │
└────────┬──────────┬──────────┬──────────┬──────────┬───────────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
   ┌──────────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌─────────┐
   │PostgreSQL│ │Salesfce│ │  SML │ │  Jira  │ │MS Graph │
   │   (DB)   │ │  API   │ │  API │ │  API   │ │  API    │
   └──────────┘ └────────┘ └──────┘ └────────┘ └─────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                        MCP Server (stdio)                           │
│              42 tools │ Canonical Data Schema │ API Client           │
│                    Consumed by AI Agents (e.g., Claude)             │
└─────────────────────────────────────────────────────────────────────┘
```

**Why this architecture was chosen:**

- **SPA frontend** — The application is used throughout the workday by operations staff who navigate frequently between pages. A single-page application eliminates full page reloads, delivers instant navigation, and keeps global state (auth, theme, toast notifications) consistent without re-initialization. React was selected for its mature ecosystem, component reusability, and large talent pool.
- **Dedicated backend API** — Express.js provides a thin, flexible HTTP layer. All business logic lives in service modules, making it straightforward to swap data sources or add new integrations without restructuring the API surface. The layered pattern (routes → services → data access) keeps concerns separated and testable.
- **PostgreSQL for persistent storage** — The application needs both transactional integrity (user management, RBAC) and analytical queries (package change trends, expiration analysis). PostgreSQL handles both well, avoids the complexity of a separate analytics database, and supports JSON columns for flexible report configurations.
- **MCP server** — By exposing the same API capabilities through the Model Context Protocol, AI agents (e.g., Claude in Cursor) can query provisioning data, run analytics, and generate reports without custom integration work. The MCP server delegates to the Express API internally, so it adds no duplicated business logic.

---

## 3. Component Architecture

### 3.1 Frontend (React SPA)

The frontend is a React 19 single-page application built with Vite and styled with Tailwind CSS. It communicates exclusively with the Express backend through REST API calls — there is no server-side rendering.

**Key design decisions and rationale:**

- **Permission-based navigation:** The sidebar dynamically renders only the pages that the authenticated user's role grants access to. This means different team members see different navigation options depending on their role (e.g., an administrator sees User Management; a standard operator does not). This approach reduces confusion, prevents unauthorized access attempts, and simplifies the user experience.
- **Context providers for global state:** Four React contexts wrap the entire application — Auth (user identity and permissions), Theme (dark/light mode preference), Toast (notification messages), and Auto-Refresh (configurable polling intervals). This avoids prop-drilling and ensures that cross-cutting concerns like "is the user logged in?" or "should data refresh every 5 minutes?" are available everywhere without coupling components to each other.
- **Dynamic report rendering:** The ReportRenderer component takes a JSON configuration (generated by the AI report agent) and composes it into a live dashboard of KPI cards, ECharts visualizations, and AG Grid data tables. This means new report layouts can be created through conversation with the LLM, without writing any frontend code.
- **Vite for development experience:** Vite provides near-instant hot module replacement during development, and its production build produces optimized static assets. The dev server proxies API calls to the Express backend, so the frontend and backend can be developed and tested independently.

### 3.2 Backend (Express.js)

The backend follows a layered architecture: route handlers (controllers) accept HTTP requests and delegate to service modules, which contain business logic and interact with the database or external APIs. This separation means the same business logic can be invoked from a REST endpoint, an MCP tool, or a background job without duplication.

**Key design decisions and rationale:**

- **One route file per domain:** Each functional area (provisioning, analytics, user management, etc.) has its own route file, making it easy to locate and modify API endpoints without navigating a monolithic router. There are 30+ route files and 25+ corresponding service files.
- **Centralized error handling:** A global error middleware catches unhandled exceptions and returns structured error responses. An `ApiError` class hierarchy allows services to throw typed errors (NotFoundError, ValidationError, AuthorizationError) that automatically map to the correct HTTP status codes.
- **Canonical data source registry:** A central configuration file defines every data source the application exposes — including its API endpoint, parameters, response shape, and origin classification. This registry is the single source of truth used by the MCP tools, the report agent, and the data catalog UI. When a new data source is added, updating this registry automatically makes it available across all three consumers.

### 3.3 Database (PostgreSQL)

The PostgreSQL database serves as both the application's transactional store and its analytical cache. The schema is organized into five logical domains:

```
deployment_assistant (database)
│
├── Auth & RBAC
│   ├── users, roles, user_roles
│   ├── permissions, role_permissions
│   ├── pages, role_pages
│   ├── refresh_tokens, session_activity, auth_audit_log
│   └── user_settings
│
├── Provisioning & Analytics
│   ├── expiration_monitor, expiration_analysis_log
│   ├── all_accounts, ghost_accounts
│   ├── packages
│   ├── package_change_analysis, package_change_analysis_log
│   ├── sml_tenant_data, sml_ghost_accounts
│   ├── ps_audit_trail, ps_audit_log
│   └── async_validation_results, async_validation_processing_log
│
├── Product Management
│   ├── products, product_sync_log
│   ├── package_product_mapping
│   ├── product_bundles, bundle_products
│   ├── product_update_options, product_update_requests, product_update_request_history
│   └── current_accounts, current_accounts_sync_log
│
├── Reporting
│   └── custom_reports
│
└── Observability
    └── mcp_tool_invocations
```

**Why PostgreSQL caches external data:** Salesforce and SML queries can be slow (2–10 seconds per query) and are subject to API rate limits. By caching provisioning data, expiration analysis, and package change history in PostgreSQL, the application provides sub-second response times for dashboard widgets and analytics pages. Cached data is refreshed on-demand or via scheduled refresh operations, with analysis logs recording when each refresh occurred and what changed.

### 3.4 MCP Server

The MCP (Model Context Protocol) server exposes 42 tools that AI agents can invoke. It runs as a stdio-based server within the same Node.js process as the Express API. Each tool delegates to the Express API internally, so the MCP layer acts as a protocol adapter rather than duplicating business logic.

**What this enables for users:** An operations team member working in Cursor (or any MCP-compatible AI client) can ask questions like "Show me provisioning requests that failed validation this week" or "What accounts have expiring entitlements in the next 30 days?" and the AI agent can fetch live data from the application without the user needing to navigate the UI. This is particularly valuable for ad-hoc investigations and for combining data across multiple pages in a single conversation.

**Tool categories:** Analytics (8 tools), Provisioning (7), Audit Trail (5), Customer Products (7), Expiration (4), Accounts (5), Packages (3), and Integrations (3).

---

## 4. Data Flow & Key Workflows

### 4.1 Primary Data Flow

The application aggregates data from multiple external systems, classifying each source by how the data is managed:

```
                    ┌─────────────┐
                    │  Salesforce  │
                    │  (PS Records,│
                    │  Provisioning│
                    │  Validation) │
                    └──────┬──────┘
                           │ REST API (jsforce, OAuth 2.0)
                           ▼
┌──────────┐      ┌──────────────────┐      ┌────────────┐
│   SML    │─────▶│  Express Backend │◀────▶│ PostgreSQL │
│ (Tenant  │ REST │   (Services)     │  SQL │  (Cache &  │
│  Data)   │ API  │                  │      │  Derived)  │
└──────────┘      └────────┬─────────┘      └────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │   Jira   │ │MS Graph  │ │  OpenAI  │
        │(Initiatv)│ │(Excel)   │ │ (LLM)    │
        └──────────┘ └──────────┘ └──────────┘
```

**Data classification:**

- **Primary sources:** Salesforce is the system of record for PS provisioning requests, account data, and product entitlements. SML provides the ground-truth view of what is actually deployed on tenant environments. Together, these two systems represent what was requested (Salesforce) versus what exists (SML).
- **Derived data:** The application computes analytics that neither source provides natively — expiration trend analysis, package change summaries over time, ghost account detection (tenants that exist in SML but have no corresponding Salesforce record), and validation results that cross-reference both systems.
- **Preserved data:** PS audit trail snapshots and product update request histories are stored persistently in PostgreSQL. These provide a historical record that survives data changes in the upstream systems.
- **Enrichment:** Jira initiatives provide strategic context (linking provisioning work to project plans), Excel files via Microsoft Graph supply account metadata, and OpenAI generates report configurations from natural language descriptions.

### 4.2 Authentication & Authorization

**What the user experiences:** A team member opens the application and signs in with a username and password. Once authenticated, they see only the pages and features that their assigned role permits. An administrator can manage users, assign roles, and control who sees what. Sessions expire automatically, and accounts lock after repeated failed login attempts.

```
┌────────┐     POST /api/auth/login      ┌──────────────┐
│ Browser │ ─────────────────────────────▶│ Auth Service  │
│         │     {username, password}      │              │
│         │                               │ 1. Lookup user│
│         │     Set-Cookie:               │ 2. bcrypt     │
│         │◀─────────────────────────────│ 3. JWT sign   │
│         │  accessToken (HTTP-only)      │ 4. Session    │
│         │  refreshToken (HTTP-only)     └──────────────┘
└────┬────┘
     │
     │  GET /api/[any] (cookie auto-sent)
     ▼
┌──────────────────┐    ┌───────────────┐    ┌──────────────┐
│  Auth Middleware  │───▶│  JWT Verify   │───▶│ Load User    │
│                  │    │  (JWT_SECRET) │    │ Roles, Pages │
│                  │    └───────────────┘    │ Permissions  │
│  Checks:         │                         └──────┬───────┘
│  - Valid token   │                                │
│  - Active session│         ┌──────────────────────┘
│  - Role/page     │         ▼
│    entitlement   │    req.user = { id, username, roles, pages, permissions }
└──────────────────┘
```

**RBAC model and rationale:** Role-Based Access Control was chosen because the team has clearly defined personas (administrators, operators, viewers) with distinct needs. Rather than assigning permissions to individual users — which becomes unmanageable as the team grows — permissions are grouped into roles, and roles are assigned to users. The model has two dimensions:

- **Pages** control navigation: which sections of the application a user can see and access. This is enforced both in the frontend sidebar and on every backend route.
- **Permissions** control feature access within pages: for example, whether a user can trigger a data refresh, export CSV files, or manage other users' accounts. This granularity means a user might be able to view provisioning data but not modify settings.

### 4.3 Custom Report Generation

**What the user achieves:** A team lead needs a report showing provisioning request volume by account over the last 30 days, with a summary of validation failure rates. Instead of building this manually in Excel, they open the Create Report page, type a natural language description of what they want, and the system generates a fully interactive report — complete with KPI summary cards, charts, and filterable data tables. They can refine the report through follow-up messages, save it, and share it via the sidebar where it becomes a permanent, auto-updating view.

```
┌─────────┐  1. Chat message   ┌────────────────┐  2. LLM call    ┌──────────┐
│ Create   │──────────────────▶│ Report Agent   │───────────────▶│  OpenAI  │
│ Report   │                   │ Service        │                │  API     │
│ Page     │  6. Proposed      │                │  3. Report     │          │
│          │◀──config + preview│ Data Catalog   │◀──config JSON  │          │
│          │                   │ (24 sources)   │                └──────────┘
└─────┬────┘                   └────────────────┘
      │
      │ 4. User saves report
      ▼
┌──────────────┐   5. Store config    ┌────────────┐
│ Custom Report │──────────────────▶  │ PostgreSQL │
│ Service       │                     │ custom_    │
│ (CRUD, slug,  │                     │ reports    │
│  validation)  │                     └────────────┘
      │
      │ 7. View saved report
      ▼
┌──────────────┐  8. Fetch data per   ┌────────────┐
│ Report       │──── component ──────▶│ Data APIs  │
│ Renderer     │  9. Render widgets   │ (24 endpts)│
│ (KPI, Chart, │◀─────────────────── │            │
│  Table)      │                      └────────────┘
└──────────────┘
```

**How it works technically:** The report agent service receives the user's natural language request along with a catalog of 24 available data sources (each described with its endpoint, parameters, and response structure). It sends this context to OpenAI's Chat Completions API, which returns a JSON report configuration specifying which data sources to query, what KPIs to compute, how to configure charts, and what columns to display in tables. This configuration is validated against a Zod schema to ensure structural correctness before being rendered. The iterative chat interface means the user can say "add a filter for request type" or "change the chart to show weekly trends instead of daily" and the LLM adjusts the configuration accordingly.

**Why this approach:** Building a traditional drag-and-drop report builder would require months of development and a complex UI. The LLM-based approach delivers equivalent flexibility in a fraction of the development time, while producing reports that users can describe in their own words rather than learning a visual tool.

### 4.4 Provisioning Monitoring

**What the user achieves:** An operations team member opens the Provisioning Monitor to see all active provisioning requests — who requested what, for which account, what products are included, whether the request passed validation, and what its current status is. They can filter by request type, search by account name, drill into the product details of any request, compare the expected configuration against what SML actually reports, and view the raw JSON payload. When something looks wrong (e.g., a validation failure or a mismatch between Salesforce and SML), they can investigate immediately rather than waiting for a report or manually querying both systems.

```
┌────────────┐  Salesforce query   ┌──────────────────┐
│ Salesforce  │◀──────────────────│ Salesforce API    │
│ PS Records  │   (jsforce)       │ Service           │
└────────────┘                    └────────┬──────────┘
                                           │
                    ┌──────────────────────┤
                    ▼                      ▼
          ┌──────────────┐      ┌──────────────────┐
          │  Validation  │      │  Provisioning    │
          │  Service     │      │  Requests List   │
          │  (rule check)│      │  (filter, search │
          └──────┬───────┘      │   paginate)      │
                 │              └────────┬─────────┘
                 ▼                       ▼
          ┌──────────────────────────────────────┐
          │         Provisioning Monitor UI       │
          │  ┌──────────┐ ┌──────────┐ ┌───────┐ │
          │  │ Request  │ │ Filters  │ │Search │ │
          │  │ Table    │ │ & Types  │ │       │ │
          │  └──────────┘ └──────────┘ └───────┘ │
          │  ┌──────────┐ ┌──────────┐ ┌───────┐ │
          │  │ Product  │ │ SML      │ │ Raw   │ │
          │  │ Modal    │ │ Compare  │ │ Data  │ │
          │  └──────────┘ └──────────┘ └───────┘ │
          └──────────────────────────────────────┘
```

**Why Salesforce data is queried in real-time:** Unlike the analytics pages (which use cached data for performance), the Provisioning Monitor queries Salesforce directly to ensure the user always sees the latest request status. Provisioning is time-sensitive — a request that was "Pending" five minutes ago may now be "Complete" or "Failed" — and stale data could lead to unnecessary escalations or missed issues.

### 4.5 Data Refresh Cycle

**What the user achieves:** Analytics pages (expiration trends, package change summaries, ghost accounts) show derived data that is computed from Salesforce and SML and cached in PostgreSQL. Users can trigger a refresh on-demand when they need current numbers, or configure auto-refresh intervals (1, 5, 10, 15, or 30 minutes) so their dashboard stays current without manual intervention.

**How it works:** When a refresh is triggered, the backend fetches fresh data from the primary source (Salesforce or SML), computes the derived analytics (e.g., which entitlements expire within 30/60/90 days, which packages changed since the last analysis), stores the results in PostgreSQL, and records the refresh in an analysis log. The frontend polls a status endpoint to track progress and automatically reloads when the refresh completes.

**Why caching is necessary:** Salesforce and SML API queries take 2–10 seconds each and are subject to rate limits. Dashboard widgets that aggregate data across hundreds of accounts would require dozens of API calls per page load if they queried live data. By caching derived results in PostgreSQL, dashboard pages load in under a second, and the cost of the expensive external queries is amortized across refresh cycles rather than incurred on every page view.

---

## 5. Integration Architecture

The application integrates with five external systems, each serving a distinct purpose in the provisioning workflow.

### 5.1 Salesforce

| Aspect | Detail |
|--------|--------|
| **Protocol** | REST API via `jsforce` library |
| **Auth (primary)** | Per-user OAuth 2.0 Authorization Code Flow |
| **Auth (fallback)** | Service account with Client Credentials (requires `salesforce.service_account` permission) |
| **Data accessed** | PS records, provisioning requests, validation data, analytics |
| **Token storage** | User-specific encrypted credentials in `user_settings` table |

**Rationale:** Salesforce is the system of record for all PS provisioning activity. The per-user OAuth approach was chosen so that Salesforce audit trails correctly attribute data access to the individual user, which is important for compliance. The service account fallback exists for background refresh operations that run without a user session.

### 5.2 SML (RMS Tenant Management)

| Aspect | Detail |
|--------|--------|
| **Protocol** | REST API with cookie-based auth |
| **Auth** | SSO via Okta/Cognito; token refresh automated by Playwright headless browser |
| **Data accessed** | Tenant entitlements, ghost accounts, product data |
| **Token storage** | Configuration and auth state files on disk |
| **Regions** | Multi-region support (EUW1, USE1, etc.) |

**Rationale:** SML does not provide a standard OAuth or API key mechanism — its API is designed for browser-based SSO access. To automate token acquisition, the application uses Playwright (a headless browser) to navigate the SSO flow and capture the resulting session cookies. This is an unconventional approach, but it was chosen because building a dedicated service-to-service auth integration with SML would require changes to SML itself, which is outside the team's control.

### 5.3 Atlassian (Jira & Confluence)

| Aspect | Detail |
|--------|--------|
| **Protocol** | REST API v3 |
| **Auth** | Basic Auth (email + API token) |
| **Data accessed** | Jira initiatives and issues |
| **Publishing** | Confluence pages (analytics, current accounts) |

**Rationale:** Jira integration provides strategic context by linking provisioning work to project initiatives. Confluence publishing allows the team to share current accounts data and analytics summaries with stakeholders who don't use the application directly.

### 5.4 Microsoft Graph

| Aspect | Detail |
|--------|--------|
| **Protocol** | Microsoft Graph REST API |
| **Auth** | MSAL (Azure AD OAuth 2.0) |
| **Data accessed** | OneDrive/Excel files for current accounts data |
| **Features** | Excel lookup, polling for updates |

**Rationale:** The current accounts dataset is maintained collaboratively in Excel files on OneDrive. Rather than requiring the team to change their existing workflow, the application integrates with Microsoft Graph to pull data directly from these files, keeping the source of truth where the team already works.

### 5.5 OpenAI

| Aspect | Detail |
|--------|--------|
| **Protocol** | OpenAI Chat Completions API |
| **Auth** | Per-user API key stored encrypted in `user_settings` |
| **Usage** | Report agent: natural language → JSON report configuration |
| **Model** | Configurable (default GPT-4) |

**Rationale:** Per-user API keys ensure that LLM costs are attributable and that each user controls their own usage. Keys are stored using AES-256-GCM encryption so they are never exposed in plaintext, even to database administrators.

---

## 6. Security Architecture

The application implements defense-in-depth with eight distinct security layers, each addressing a different threat vector:

```
┌───────────────────────────────────────────────────┐
│                  Security Layers                   │
├───────────────────────────────────────────────────┤
│ Transport     │ HTTPS, HTTP-only cookies           │
│ Authentication│ JWT (bcrypt passwords, sessions)   │
│ Authorization │ RBAC (roles → pages + permissions) │
│ Rate Limiting │ express-rate-limit (100 req/15 min) │
│ Input Valid.  │ Zod schemas, parameterized SQL      │
│ Secrets Mgmt  │ AES-256-GCM encryption for stored  │
│               │ credentials (SF, LLM API keys)     │
│ Session Mgmt  │ Token expiry, session cleanup,     │
│               │ account lockout after failed logins │
│ CORS          │ Whitelist of allowed origins        │
└───────────────────────────────────────────────────┘
```

**Key security rationale:**

- **HTTP-only cookies for JWT tokens:** Access and refresh tokens are stored in HTTP-only cookies rather than localStorage. This prevents JavaScript code (including potential XSS payloads) from accessing the tokens, which is the most common attack vector for token theft in SPAs.
- **Bcrypt password hashing:** Passwords are hashed with bcrypt (adaptive cost factor) so that even if the database is compromised, passwords cannot be reversed in practical time.
- **AES-256-GCM for stored credentials:** External API keys (Salesforce OAuth tokens, OpenAI API keys) are encrypted at rest using AES-256-GCM with a server-side encryption key. This ensures that a database breach does not expose credentials to external systems.
- **Account lockout:** After a configurable number of failed login attempts, the account is temporarily locked. This mitigates brute-force attacks without requiring CAPTCHAs or other user-hostile mechanisms.
- **Parameterized SQL:** All database queries use parameterized statements (via the `pg` library), preventing SQL injection regardless of input content.

---

## 7. Deployment Architecture

```
┌─────────────────────────────────────────┐
│            Production Deployment         │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │   Node.js Process (port 5000)   │    │
│  │                                 │    │
│  │  Express Server                 │    │
│  │  ├── /api/* routes              │    │
│  │  ├── /auth/* routes             │    │
│  │  ├── /health check             │    │
│  │  └── Static files (frontend/)  │    │
│  │                                 │    │
│  │  MCP Server (stdio, in-process)│    │
│  └─────────────┬───────────────────┘    │
│                │                        │
│  ┌─────────────▼───────────────────┐    │
│  │   PostgreSQL 16 (port 5432)     │    │
│  │   Database: deployment_assistant │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

**Production:** A single Node.js process serves both the backend API and the pre-built frontend static files. The MCP server runs in-process using stdio transport. This single-process model simplifies deployment and monitoring — there is one process to start, one to monitor, and one to restart if needed. PostgreSQL runs alongside on the same server or as a managed service.

**Development:** During development, the frontend runs on a Vite dev server (port 8080) that proxies API calls to the Express backend (port 5000). This provides instant hot module replacement for UI changes while keeping the full backend running locally. A local PostgreSQL instance mirrors the production schema.

**Build process:** The frontend build produces optimized static assets (JavaScript bundles, CSS, images) that Express serves directly. This means production deployment requires no separate web server (like nginx) — the single Node.js process handles everything.

---

## 8. MCP Integration Architecture

```
┌─────────────────┐     stdio      ┌──────────────────────┐
│   AI Agent      │◀──────────────▶│   MCP Server          │
│ (Claude, etc.)  │  MCP Protocol  │   (deployassist-mcp)  │
└─────────────────┘                │                        │
                                   │  Tool Registry (42)    │
                                   │  ├── Analytics (8)     │
                                   │  ├── Provisioning (7)  │
                                   │  ├── Audit Trail (5)   │
                                   │  ├── Customer Prod (7) │
                                   │  ├── Expiration (4)    │
                                   │  ├── Accounts (5)      │
                                   │  ├── Packages (3)      │
                                   │  └── Integrations (3)  │
                                   │                        │
                                   │  API Client ──────────▶│ Express API
                                   │  (INTERNAL_API_URL)    │ (localhost:5000)
                                   └────────────────────────┘
```

**Canonical Data Source Schema:** A central registry defines every data source the application exposes, including its API endpoint, parameters, response shape, origin classification, and dependencies. This schema serves as the single source of truth for three consumers:

- **MCP tools** derive their input schemas and descriptions from the registry, ensuring AI agents always see accurate parameter definitions.
- **The report agent** uses the registry as the "data catalog" that it provides to the LLM, so the AI knows exactly what data is available and how to query it.
- **The data catalog UI** in the Create Report page displays available sources for user reference.

This alignment is enforced by a validation script that checks the registry against the MCP tool definitions at build time, preventing drift between what the API actually offers and what the AI layer describes.

---

## 9. Technology Stack Summary

| Layer | Technology | Version |
|-------|-----------|---------|
| **Runtime** | Node.js | 18+ |
| **Backend Framework** | Express.js | 4.x |
| **Frontend Framework** | React | 19.x |
| **Build Tool** | Vite | 7.x |
| **Styling** | Tailwind CSS | 3.4 |
| **Database** | PostgreSQL | 16.x |
| **DB Client** | pg (node-postgres) | Latest |
| **Auth** | jsonwebtoken, bcryptjs | Latest |
| **Salesforce** | jsforce | 3.10 |
| **Charts** | Chart.js, ECharts | 4.5, 6.0 |
| **Tables** | AG Grid Community | 35.x |
| **Icons** | Heroicons (React) | 2.x |
| **LLM** | OpenAI SDK | Latest |
| **MCP** | @modelcontextprotocol/sdk | Latest |
| **Logging** | Winston | Latest |
| **Validation** | Zod | Latest |
| **Microsoft** | @azure/msal-node, @microsoft/microsoft-graph-client | Latest |
| **Browser Automation** | Playwright | Latest |
| **Testing** | Jest, Playwright, Vitest | Latest |

---

## 10. Non-Functional Characteristics

| Aspect | Approach | Rationale |
|--------|----------|-----------|
| **Performance** | PostgreSQL connection pooling, rate limiting, configurable auto-refresh intervals | External API calls are expensive; caching and pooling ensure sub-second page loads for common operations |
| **Scalability** | Single-server deployment; stateless JWT auth; PostgreSQL handles concurrent queries | The application serves a small internal team (< 50 users); single-server simplicity is preferred over distributed complexity |
| **Reliability** | Error boundaries in React, async error handlers in Express, health check endpoint | Users should never see a white screen; errors are caught, logged, and presented gracefully |
| **Observability** | Winston structured logging, MCP tool invocation audit table, auth audit log, analysis logs | Every significant operation is logged with structured context for debugging and compliance |
| **Maintainability** | Canonical data source schema ensures MCP/API/Report alignment; Zod schema validation | New data sources can be added by updating the registry; schema validation catches misconfiguration at startup |
| **Security** | Defense-in-depth (see Section 6) | Internal applications still need strong security — especially those handling customer data and external system credentials |
| **Accessibility** | Tailwind-based responsive design, dark/light mode support | Accommodates different screen sizes and user preferences for reduced eye strain during extended use |
