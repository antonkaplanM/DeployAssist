# EPIC-07: Help Page

## Epic Description

Build the Help page that provides users with comprehensive guidance on application features, workflows, and troubleshooting. The Help page serves as the in-application reference manual, reducing the need for external documentation and support requests.

**Business Value:** The Help page reduces onboarding time for new team members and serves as a quick reference for existing users, decreasing support burden and improving self-service capability.

**Dependencies:** EPIC-01 (Infrastructure — frontend scaffold, routing, layout)

---

## Tasks

### T-07.01 — Build Help Page Component

**Description:** Create the `Help.jsx` page component with structured help content organized by feature area.

**Acceptance Criteria:**
- Page title: "Help"
- Layout: table of contents sidebar (left) with scrollable content area (right)
- Content organized into sections:
  1. **Getting Started** — application overview, login, first-time setup
  2. **Dashboard** — widget descriptions, timeframe controls, navigation
  3. **Provisioning Monitor** — searching, filtering, product modal, SML comparison, raw data viewer
  4. **Analytics** — overview, account history, package changes
  5. **Current Accounts** — syncing, comments, Excel updates, Confluence publishing
  6. **Expiration Monitor** — expiration windows, extension detection, refresh
  7. **Ghost Accounts** — Salesforce vs SML sources, review workflow
  8. **Audit Trail** — searching PS records, status timeline, manual capture
  9. **Customer Products** — tenant entitlements, product updates
  10. **Custom Reports** — AI chat, data catalog, saving, import/export, sample reports
  11. **User Management** — users, roles, permissions, page entitlements (admin only)
  12. **Settings** — Salesforce connection, SML config, validation rules, LLM settings, theme
  13. **Troubleshooting** — common issues and solutions
- Table of contents entries are clickable and scroll to the corresponding section
- Content uses clear headings, descriptions, and bullet points
- Page registered with permission name `help`

**Key Detail:**
- Actual implemented sections in the Help page:
  1. **Getting Started** — first-time setup guide
  2. **Common Workflows** — 7 step-by-step workflow guides (see T-07.02)
  3. **Features Reference** — reference content for: Dashboard, Validation Rules, Authentication & Users, Settings
  4. **Quick Tips** — keyboard shortcuts, data refresh tips, search tips, performance tips
  5. **Troubleshooting** — connection issues, search issues, data refresh issues, session expired
- Additional help content served from static HTML files: `public/auth-help-section.html`, `public/auth-help-section-updated.html`

---

### T-07.02 — Implement Help Content: Workflow Guides

**Description:** Write workflow guide content that walks users through common operational procedures.

**Acceptance Criteria:**
- Workflow guides for:
  - Investigating a provisioning error (Dashboard → Provisioning Monitor → Product Modal)
  - Comparing Salesforce and SML entitlements
  - Creating a custom report from scratch
  - Syncing and publishing current accounts
  - Reviewing ghost accounts
  - Setting up Salesforce connection
  - Configuring validation rules
- Each workflow guide includes: purpose, step-by-step instructions, expected outcomes
- Guides reference specific UI elements and navigation paths

**Key Detail:**
- Exact 7 workflow guides implemented under "Common Workflows" section:
  1. Monitor Provisioning Requests
  2. Refresh SML Data for Deprovision Requests
  3. Track Product Expirations
  4. View Account History
  5. View Customer Products
  6. Manage Product Bundles
  7. Review PS Audit Trail
- Note: the implemented workflows differ slightly from the acceptance criteria list above — the actual implementation focuses on monitoring and data operations rather than setup procedures

---

### T-07.03 — Implement Help Content: Feature Reference

**Description:** Write reference content that describes each feature's capabilities, controls, and data sources.

**Acceptance Criteria:**
- Feature reference entries for each section listed in T-07.01
- Each entry includes: description, available controls/actions, data sources used, permissions required
- Keyboard shortcuts documented if applicable
- Data refresh behavior documented per feature
- Known limitations or caveats noted

**Key Detail:**
- Actual feature reference sections implemented: Dashboard, Validation Rules, Authentication & Users, Settings
- Authentication & Users content is loaded from a separate static HTML file (`public/auth-help-section-updated.html`) for richer formatting

---

### T-07.04 — Implement Help Page Navigation and Search

**Description:** Add smooth scrolling navigation and optional search functionality within the Help page.

**Acceptance Criteria:**
- Table of contents highlights the currently visible section as user scrolls
- Clicking a TOC entry smooth-scrolls to the section
- URL hash updates on scroll for deep-linking (e.g., `/help#custom-reports`)
- Optional: search input that filters and highlights matching content

---

## User Stories

### US-07.01 — User Can Find Help for Any Feature

**As a** deployment team member, **I want to** browse or search the Help page to find information about a specific feature **so that** I can understand how to use it without asking a colleague.

**Acceptance Criteria:**
- Help page is accessible from the sidebar navigation
- Content covers all application features
- I can navigate to a specific section via the table of contents
- Content is written in plain language without excessive jargon
- I can deep-link to a specific section (e.g., `/help#custom-reports`)

**Dependencies:** T-07.01, T-07.03, T-07.04

---

### US-07.02 — User Can Follow Step-by-Step Workflow Guides

**As a** new team member, **I want to** follow step-by-step guides for common workflows **so that** I can perform operational tasks correctly without prior training.

**Acceptance Criteria:**
- Workflow guides are clearly separated from reference content
- Steps are numbered and specific ("Click the 'Quick Sync' button in the toolbar")
- Expected outcomes are described at each step
- Guides link to the relevant pages when possible

**Key Detail:**
- 7 workflow guides available: Monitor Provisioning Requests, Refresh SML Data for Deprovision Requests, Track Product Expirations, View Account History, View Customer Products, Manage Product Bundles, Review PS Audit Trail
- Located under the "Common Workflows" section in the Help page

**Dependencies:** T-07.02

---

### US-07.03 — User Can Troubleshoot Common Issues

**As a** deployment team member, **I want to** consult a troubleshooting section when something isn't working **so that** I can resolve issues without escalating to support.

**Acceptance Criteria:**
- Troubleshooting section covers common issues:
  - Salesforce connection failures
  - SML token expiration
  - Data not refreshing
  - Report rendering errors
  - Permission denied errors
  - Login issues (lockout, forgotten password)
- Each issue includes: symptom, possible cause, resolution steps
- Contact information for further support if self-service fails

**Key Detail:**
- Implemented troubleshooting categories: connection issues (Salesforce, SML), search issues (type-ahead, filters), data refresh issues (stale data, sync failures), session expired (re-login)

**Dependencies:** T-07.03
