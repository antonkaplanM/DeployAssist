# Deployment Assistant — Requirements Documentation

This folder contains the complete set of epics, user stories, and tasks required to recreate the Deployment Assistant (DeployAssist) application.

## Document Index

| # | Document | Description |
|---|----------|-------------|
| 00 | [Solution Architecture](./00-solution-architecture.md) | System architecture, data flows, workflows, and component diagrams |
| 01 | [Infrastructure & Foundation](./01-epic-infrastructure.md) | Core platform: Express server, PostgreSQL, auth, middleware, frontend scaffold |
| 02 | [Data Sources, Connections & Integrations](./02-epic-data-sources.md) | Salesforce, SML, Jira, Microsoft Graph, OpenAI, canonical data catalog |
| 03 | [Dashboard](./03-epic-dashboard.md) | Dashboard page with validation, removals, and expiration widgets |
| 04 | [Provisioning Monitor](./04-epic-provisioning-monitor.md) | Provisioning Monitor sub-page for PS request tracking |
| 05 | [Custom Reports](./05-epic-custom-reports.md) | Full custom reports feature: AI chat builder, renderer, data catalog |
| 06 | [Current Accounts](./06-epic-current-accounts.md) | Current Accounts sub-page with sync, search, and publishing |
| 07 | [Help](./07-epic-help.md) | Help page with workflows and feature reference |
| 08 | [User Management](./08-epic-user-management.md) | User, role, permission, and page entitlement management |
| 09 | [Settings](./09-epic-settings.md) | Settings page for integrations, validation rules, LLM, and preferences |

## Item Hierarchy

```
Epic (Parent)
├── User Story (Child) — focused on a user-facing outcome
└── Task (Child)       — focused on a technical outcome without direct user impact
```

- **User Stories** describe outcomes from the perspective of a user or persona and follow the format: _"As a [persona], I want [goal] so that [benefit]."_
- **Tasks** describe technical work (database migrations, middleware setup, API plumbing) that enables user stories but does not itself produce a user-visible result.

## Identifier Conventions

| Prefix | Meaning |
|--------|---------|
| `EPIC-XX` | Epic |
| `US-XX.YY` | User Story (XX = epic, YY = sequence) |
| `T-XX.YY` | Task (XX = epic, YY = sequence) |

## Release Phases

| Phase | Epics | Rationale |
|-------|-------|-----------|
| **Phase 1 — MVP** | EPIC-01 (Infrastructure), EPIC-02 (Data Sources), EPIC-08 (User Management), EPIC-04 (Provisioning Monitor) | Foundation, data layer, authentication, and the core operational page required for the app to function and deliver immediate value |
| **Phase 2 — Enhanced Features** | EPIC-03 (Dashboard), EPIC-05 (Custom Reports), EPIC-06 (Current Accounts) | Dashboard overview, AI-powered reporting, and account roster management add significant value beyond core monitoring |
| **Phase 3 — Complete Platform** | EPIC-07 (Help Page), EPIC-09 (Settings) | Self-service documentation and configuration that polish the platform experience |

## Jira Tracking

| Artifact | Jira Key | Link |
|----------|----------|------|
| Initiative | PLAN-922 | [Deployment Assistant](https://rmsrisk.atlassian.net/browse/PLAN-922) |
| EPIC-01 | SVCML-3234 | [Infrastructure & Foundation](https://rmsrisk.atlassian.net/browse/SVCML-3234) |
| EPIC-02 | SVCML-3260 | [Data Sources & Integrations](https://rmsrisk.atlassian.net/browse/SVCML-3260) |
| EPIC-03 | SVCML-3290 | [Dashboard](https://rmsrisk.atlassian.net/browse/SVCML-3290) |
| EPIC-04 | SVCML-3300 | [Provisioning Monitor](https://rmsrisk.atlassian.net/browse/SVCML-3300) |
| EPIC-05 | SVCML-3320 | [Custom Reports](https://rmsrisk.atlassian.net/browse/SVCML-3320) |
| EPIC-06 | SVCML-3350 | [Current Accounts](https://rmsrisk.atlassian.net/browse/SVCML-3350) |
| EPIC-07 | SVCML-3365 | [Help Page](https://rmsrisk.atlassian.net/browse/SVCML-3365) |
| EPIC-08 | SVCML-3373 | [User Management](https://rmsrisk.atlassian.net/browse/SVCML-3373) |
| EPIC-09 | SVCML-3386 | [Settings](https://rmsrisk.atlassian.net/browse/SVCML-3386) |

## Generated Artifacts

| File | Description |
|------|-------------|
| [Solution-Architecture.docx](./Solution-Architecture.docx) | Word document with formatted architecture diagrams |
| [plan922-architecture.png](./plan922-architecture.png) | Architecture diagram used in PLAN-922 Jira ticket |
| [plan922-roadmap.png](./plan922-roadmap.png) | Release roadmap diagram used in PLAN-922 Jira ticket (regenerate with `node scripts/generate-roadmap.js`) |

## Status Definitions

| Status | Meaning |
|--------|---------|
| `Draft` | Initial definition, not yet reviewed |
| `Ready` | Reviewed and ready for implementation |
| `In Progress` | Currently being implemented |
| `Done` | Implemented and verified |
