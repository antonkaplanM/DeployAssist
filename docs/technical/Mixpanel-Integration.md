# Mixpanel Integration — Technical Documentation

## Overview

The Mixpanel integration enables Deployment Assistant to pull product-usage analytics data from Mixpanel into custom reports and the Cursor AI agent. It uses Mixpanel's service account authentication (HTTP Basic Auth) to access the Raw Event Export API, Query API (Insights, Funnels, Retention), and Engage (Profiles) API.

## Architecture

```
┌─────────────────────┐     HTTPS/Basic Auth      ┌─────────────────────┐
│  Settings UI        │ ──────────────────────── → │  Mixpanel APIs      │
│  (configure creds)  │                            │  - data.mixpanel.com│
├─────────────────────┤                            │  - mixpanel.com     │
│  Express Routes     │                            └─────────────────────┘
│  /api/mixpanel/*    │ ← credentials resolved
├─────────────────────┤   from user_settings
│  MixpanelService    │   or MIXPANEL_* env vars
├─────────────────────┤
│  MCP Tools (8)      │ ← Cursor agent access
│  via tool-registry  │
├─────────────────────┤
│  Canonical Schema   │ ← report-data-sources.js
│  (8 entries)        │   report builder access
├─────────────────────┤
│  Usage Limits Page  │ ← /experimental/usage-limits
│  (aggregated view)  │   with SML entitlement drill-down
├─────────────────────┤
│  Daily Exceedances  │ ← /experimental/daily-exceedances
│  (per-day view)     │   quota limit breaches by day
└─────────────────────┘
```

## Authentication

Mixpanel uses **HTTP Basic Auth** with service account credentials.

- **Service accounts** are non-human entities created by Mixpanel Org Owners/Admins
- Credentials consist of a `username` and `secret`
- Only Org Owner or Admin roles can create/manage service accounts
- Service accounts can have project-scoped roles and optional expiration dates

### Credential Resolution Order

1. **Per-user settings** — stored encrypted (AES-256-GCM) in the `user_settings` table
2. **Environment variables** — `MIXPANEL_SERVICE_ACCOUNT_USERNAME`, `MIXPANEL_SERVICE_ACCOUNT_SECRET`, `MIXPANEL_PROJECT_ID`

## API Endpoints

### Data Routes (`/api/mixpanel/*`)

All routes require authentication. Credentials are resolved per-user.

| Method | Path | Description | Query Params |
|--------|------|-------------|--------------|
| GET | `/api/mixpanel/events` | Export raw events | `fromDate`, `toDate`, `event`, `limit` |
| GET | `/api/mixpanel/insights` | Query Insights report | `bookmarkId` |
| GET | `/api/mixpanel/funnels` | Query Funnels report | `funnelId` |
| GET | `/api/mixpanel/retention` | Query Retention report | `bookmarkId` |
| GET | `/api/mixpanel/profiles` | Query user profiles | `where`, `outputProperties` |
| GET | `/api/mixpanel/event-names` | List event names | (none) |
| GET | `/api/mixpanel/usage-limits` | Read aggregated quota utilization from DB (instant) | `days` (default 7, max 365) |
| POST | `/api/mixpanel/usage-limits/refresh` | Start async Mixpanel data refresh job | `days` (default 7, max 365) |
| GET | `/api/mixpanel/usage-limits/refresh/status` | Poll refresh job progress | `jobId` (required) |
| GET | `/api/mixpanel/daily-exceedances` | Read per-day quota exceedances from DB (instant) | `days` (default 14, max 365) |
| POST | `/api/mixpanel/daily-exceedances/refresh` | Start async daily exceedances refresh job | `days` (default 14, max 365) |
| GET | `/api/mixpanel/daily-exceedances/refresh/status` | Poll daily exceedances job progress | `jobId` (required) |
| POST | `/api/mixpanel/test-connection` | Test credentials | Body: `{ username, secret, projectId }` (optional) |

### Settings Routes (`/api/user-settings/mixpanel/*`)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user-settings/mixpanel` | Get credential status (masked) |
| PUT | `/api/user-settings/mixpanel` | Save credentials (encrypted) |
| DELETE | `/api/user-settings/mixpanel` | Remove credentials |
| POST | `/api/user-settings/mixpanel/test` | Test stored credentials |

## Canonical Data Sources

Eight entries registered in `config/report-data-sources.js`:

| ID | Endpoint | MCP Tool Name | Description |
|----|----------|---------------|-------------|
| `primary.mixpanel.events` | `/api/mixpanel/events` | `export_mixpanel_events` | Raw event export |
| `primary.mixpanel.insights` | `/api/mixpanel/insights` | `query_mixpanel_insights` | Insights query |
| `primary.mixpanel.funnels` | `/api/mixpanel/funnels` | `query_mixpanel_funnels` | Funnels query |
| `primary.mixpanel.retention` | `/api/mixpanel/retention` | `query_mixpanel_retention` | Retention query |
| `primary.mixpanel.profiles` | `/api/mixpanel/profiles` | `query_mixpanel_profiles` | User profiles |
| `primary.mixpanel.event-names` | `/api/mixpanel/event-names` | `list_mixpanel_event_names` | Event name list |
| `derived.mixpanel.usage-limits` | `/api/mixpanel/usage-limits` | `get_usage_limits` | Aggregated quota utilization per tenant |
| `derived.mixpanel.daily-exceedances` | `/api/mixpanel/daily-exceedances` | `get_daily_exceedances` | Per-day quota limit exceedances by tenant |

## MCP Tools

Eight tools registered in `mcp-server/config/tool-registry.js`:

| Tool File | Tool Name | Source |
|-----------|-----------|--------|
| `mixpanel/export-events.js` | `export_mixpanel_events` | Raw Event Export API |
| `mixpanel/query-insights.js` | `query_mixpanel_insights` | Query API |
| `mixpanel/query-funnels.js` | `query_mixpanel_funnels` | Query API |
| `mixpanel/query-retention.js` | `query_mixpanel_retention` | Query API |
| `mixpanel/query-profiles.js` | `query_mixpanel_profiles` | Engage API |
| `mixpanel/list-event-names.js` | `list_mixpanel_event_names` | Event Names API |
| `mixpanel/usage-limits.js` | `get_usage_limits` | Derived from Raw Export |
| `mixpanel/daily-exceedances.js` | `get_daily_exceedances` | Derived from Raw Export |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MIXPANEL_SERVICE_ACCOUNT_USERNAME` | No | Server-wide fallback username |
| `MIXPANEL_SERVICE_ACCOUNT_SECRET` | No | Server-wide fallback secret |
| `MIXPANEL_PROJECT_ID` | No | Default Mixpanel project ID |
| `ENABLE_MIXPANEL` | No | Feature flag (default: `true`) |

## Mixpanel API Rate Limits

- **Raw Event Export**: No documented rate limit, but large exports may time out
- **Query API** (Insights/Funnels/Retention): 60 queries/hour, max 5 concurrent
- **Engage API**: Standard API rate limits apply

## Mixpanel Plan Requirements

| Feature | Free | Growth | Enterprise |
|---------|------|--------|------------|
| Raw Event Export | Yes | Yes | Yes |
| Insights Query API | No | Yes | Yes |
| Funnels Query API | No | Yes | Yes |
| Retention Query API | No | Yes | Yes |
| Engage (Profiles) API | Yes | Yes | Yes |
| Data Pipelines | No | Add-on | Add-on |

## Files Modified/Created

### New Files
- `services/mixpanel.service.js` — Mixpanel API client
- `routes/mixpanel.routes.js` — Express route handlers for raw data access
- `routes/mixpanel-usage.routes.js` — DB-backed usage-limits endpoints (GET + async refresh)
- `routes/daily-exceedances.routes.js` — DB-backed daily exceedance endpoints (GET + async refresh)
- `database/add-mixpanel-usage-tables.sql` — Schema for `mixpanel_usage_snapshots` and `mixpanel_refresh_jobs`
- `database/add-daily-exceedances-tables.sql` — Schema for `mixpanel_daily_exceedances` table + `job_type` column
- `mcp-server/tools/mixpanel/export-events.js` — MCP tool
- `mcp-server/tools/mixpanel/query-insights.js` — MCP tool
- `mcp-server/tools/mixpanel/query-funnels.js` — MCP tool
- `mcp-server/tools/mixpanel/query-retention.js` — MCP tool
- `mcp-server/tools/mixpanel/query-profiles.js` — MCP tool
- `mcp-server/tools/mixpanel/list-event-names.js` — MCP tool
- `mcp-server/tools/mixpanel/usage-limits.js` — MCP tool (derived aggregate)
- `mcp-server/tools/mixpanel/daily-exceedances.js` — MCP tool (per-day exceedances)
- `frontend/src/pages/UsageLimits.jsx` — Usage Limits Monitor page
- `frontend/src/pages/DailyExceedances.jsx` — Daily Exceedances report page

### Modified Files
- `app.js` — mounted `/api/mixpanel`, `/api/mixpanel/usage-limits`, and `/api/mixpanel/daily-exceedances` routes
- `config/environment.js` — added `mixpanel` config section + `enableMixpanel` feature flag
- `config/report-data-sources.js` — added 8 canonical Mixpanel entries (6 primary + 2 derived)
- `mcp-server/config/tool-registry.js` — registered 8 Mixpanel tools (total 50)
- `routes/user-settings.routes.js` — added Mixpanel credential CRUD + test endpoints
- `frontend/src/services/settingsService.js` — added Mixpanel API methods
- `frontend/src/pages/Settings.jsx` — added Mixpanel configuration section under Data Sources
- `frontend/src/App.jsx` — added `/experimental/usage-limits` and `/experimental/daily-exceedances` routes
- `frontend/src/components/layout/Sidebar.jsx` — added Usage Limits and Daily Exceedances nav entries under Experimental
- `.env` — added commented-out `MIXPANEL_*` variables

## Usage Limits Monitor

The **Usage Limits Monitor** page (`/experimental/usage-limits`) provides a consolidated view of customer quota utilization from Mixpanel, cross-referenced with SML entitlements.

### Architecture: DB-Backed with Async Refresh

Aggregated data is persisted in PostgreSQL (`mixpanel_usage_snapshots` table) so that page loads are instant. A separate async refresh job streams fresh data from Mixpanel and writes to the DB without blocking the UI.

**Flow:**
1. User opens page → `GET /api/mixpanel/usage-limits` reads from DB → instant response
2. User clicks "Refresh Data" → `POST /api/mixpanel/usage-limits/refresh` returns 202 immediately, starts background job
3. Frontend polls `GET /api/mixpanel/usage-limits/refresh/status?jobId=...` every 5 seconds for progress
4. Background job streams ~6M events via `exportEventsStreaming()`, aggregates in memory, writes to DB in a transaction
5. On completion, frontend reloads data from DB

**Database Tables:**
- `mixpanel_usage_snapshots` — Aggregated per-tenant, per-metric data (~2,300 rows per time window). UNIQUE on `(project_id, days, tenant_id, metric_type)`.
- `mixpanel_refresh_jobs` — Tracks job status (`running`/`completed`/`failed`), events processed, tenants found, and error messages.

### How It Works

1. **Async Data Collection**: The `POST /refresh` endpoint creates a job row and kicks off an in-process async function that streams all Mixpanel raw export events for quota-related event types over a configurable time window. Events are parsed line-by-line via `exportEventsStreaming()` without buffering in memory. Progress updates (every 500k events) are written to the job row for frontend polling.
2. **Aggregation**: Events are grouped by `TenantId` and the latest values for each metric type are extracted. Utilization is calculated as `currentValue / limit × 100%`.
3. **Transactional Write**: Aggregated results are written to `mixpanel_usage_snapshots` in a single transaction (DELETE old + INSERT new) so the UI never sees partial data.
4. **Status Classification**: Each tenant is classified as:
   - **Exceeded** (≥100% utilization on any metric)
   - **Warning** (≥80% utilization)
   - **OK** (below 80%)
5. **Entitlements Cross-Reference**: Each tenant row has a "View" button that opens a modal with the full SML entitlements, showing the package name (which defines the limit tier), product details, and license status.
6. **Job Deduplication**: Only one refresh per project+days can run at a time; duplicate requests return the existing job's ID.

### Performance

- **Page load (from DB)**: ~50ms
- **Refresh job**: ~2 minutes (streams ~6M events from Mixpanel, writes ~2,300 rows)
- **Data survives server restart** (persisted in PostgreSQL, not in-memory)

### Tracked Event Types

**Quota Events**: `DailyJobsRun`, `DailyUnderwriterJobsRun`, `DailyTreatyJobsRun`, `DailyTreatiesAnalyzed`, `DailyExposureJobsRun`, `JobCoreMinutes`, `JobCoreCount`, `LocationsModeled`, `EntitlementUsage`

**Storage Events**: `StorageStatus`, `Storage`, `TotalDiskSpaceInMb`, `UsedDiskSpaceInMb`, `AvailableDiskSpaceInMb`, `EDMDatabases`, `TotalNumberOfRecycleBinItems`

## Daily Exceedances Report

The **Daily Exceedances** page (`/experimental/daily-exceedances`) shows which customers exceeded at least one daily quota limit and on how many days they did so within a configurable period (default: 14 days).

### Architecture: DB-Backed with Async Refresh

Follows the same pattern as the Usage Limits Monitor. Per-day quota data is persisted in PostgreSQL (`mixpanel_daily_exceedances` table) so page loads are instant. A separate async refresh job streams quota events from Mixpanel, aggregates them by tenant + date, and writes results to the DB.

**Flow:**
1. User opens page → `GET /api/mixpanel/daily-exceedances` reads from DB → instant response
2. User clicks "Refresh Data" → `POST /api/mixpanel/daily-exceedances/refresh` returns 202 immediately, starts background job
3. Frontend polls `GET /api/mixpanel/daily-exceedances/refresh/status?jobId=...` every 5 seconds
4. Background job streams quota events via `exportEventsStreaming()`, tracks MAX value per (tenant, date, metric)
5. After streaming, calculates utilization and marks exceeded=true where utilization >= 100%
6. Writes to DB in a transaction; frontend reloads from DB

**Database Table:**
- `mixpanel_daily_exceedances` — Per-day, per-tenant, per-metric quota data. UNIQUE on `(project_id, days, tenant_id, event_date, metric_type)`. Only stores quota events (not storage). The `exceeded` boolean flag enables efficient filtering.

### How It Works

1. **Event Streaming**: Only quota events (same 9 types as Usage Limits) are streamed. Storage events are excluded since this report focuses on daily quota limits.
2. **Daily Aggregation**: For each `(tenant, date, metric)` combination, the MAX `MetricValue` across all events that day is tracked. The `limit` value is taken from the most recent event.
3. **Exceedance Detection**: Utilization = `maxValue / limit × 100%`. If utilization >= 100%, the record is marked as exceeded.
4. **Filtered Response**: The GET endpoint returns only tenants with at least one `exceeded=true` record, sorted by total exceedance days descending.
5. **Account Name Resolution**: Tenant IDs are cross-referenced against `sml_tenant_data` to show display names and account names.

### Report Features

- **Summary cards**: Total customers exceeding limits, total exceedance days, and period length
- **Frequency bar**: Visual indicator showing what percentage of the period had exceedances
- **Expandable rows**: Click a tenant to see per-day breakdown with exceeded metrics, values, limits, and utilization percentages
- **Search**: Filter by tenant name or account name
- **Period selector**: 7, 14, 30, 60, or 90 days (default: 14)

### Tracked Event Types (Quota Only)

`DailyJobsRun`, `DailyUnderwriterJobsRun`, `DailyTreatyJobsRun`, `DailyTreatiesAnalyzed`, `DailyExposureJobsRun`, `JobCoreMinutes`, `JobCoreCount`, `LocationsModeled`, `EntitlementUsage`
