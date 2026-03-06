const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, ImageRun, convertInchesToTwip,
} = require('docx');

// ─── Color palette ──────────────────────────────────────────────────────────
const C = {
  primary: '1B4F72', secondary: '2E86C1', accent: '2980B9',
  lightBg: 'EBF5FB', mediumBg: 'D4E6F1', darkText: '1C2833',
  bodyText: '2C3E50', codeBg: 'F4F6F7', codeBorder: 'BDC3C7',
  white: 'FFFFFF', tableBorder: '85929E', headerBg: '1B4F72', altRow: 'F8F9FA',
};

// ─── Mermaid configuration (professional theme) ─────────────────────────────
const MERMAID_CONFIG = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#2E86C1',
    primaryTextColor: '#FFFFFF',
    primaryBorderColor: '#1B4F72',
    secondaryColor: '#EBF5FB',
    secondaryTextColor: '#1C2833',
    secondaryBorderColor: '#AED6F1',
    tertiaryColor: '#D4E6F1',
    tertiaryTextColor: '#1C2833',
    tertiaryBorderColor: '#85C1E9',
    lineColor: '#5D6D7E',
    textColor: '#1C2833',
    mainBkg: '#2E86C1',
    nodeBorder: '#1B4F72',
    clusterBkg: '#EBF5FB',
    clusterBorder: '#2E86C1',
    titleColor: '#1B4F72',
    edgeLabelBackground: '#FFFFFF',
    noteBkgColor: '#FCF3CF',
    noteBorderColor: '#F39C12',
    actorBkg: '#2E86C1',
    actorBorder: '#1B4F72',
    actorTextColor: '#FFFFFF',
    actorLineColor: '#5D6D7E',
    signalColor: '#1C2833',
    signalTextColor: '#1C2833',
    labelBoxBkgColor: '#EBF5FB',
    labelBoxBorderColor: '#2E86C1',
    labelTextColor: '#1B4F72',
    loopTextColor: '#1B4F72',
    activationBorderColor: '#1B4F72',
    activationBkgColor: '#D4E6F1',
    sequenceNumberColor: '#FFFFFF',
    fontFamily: 'Segoe UI, Calibri, Arial, sans-serif',
    fontSize: '20px',
  },
  flowchart: { curve: 'basis', padding: 16, htmlLabels: true, nodeSpacing: 30, rankSpacing: 40 },
  sequence: { mirrorActors: false, actorMargin: 60, messageFontSize: 18, noteFontSize: 16, actorFontSize: 18, wrap: true, width: 220, noteMargin: 12, messageMargin: 30 },
};

// ─── Mermaid diagram definitions ─────────────────────────────────────────────
const DIAGRAMS = {
  'high-level-arch': `flowchart TD
    SPA["Browser — React SPA"]

    SPA -->|"HTTPS"| AUTH

    subgraph SERVER ["Express.js API Server"]
        AUTH["Auth Middleware"]
        ROUTES["Routes"]
        SVCS["Services"]
        MW["Middleware"]
        AUTH --> ROUTES --> SVCS
    end

    SVCS --> DB[("PostgreSQL")]
    SVCS --> SF["Salesforce"]
    SVCS --> SMLAPI["SML"]
    SVCS --> JIRAAPI["Jira"]
    SVCS --> MSAPI["MS Graph"]

    subgraph MCPBOX ["MCP Server (stdio)"]
        TOOLS["42 Tools"]
        SCHEMA["Data Schema"]
        APICLIENT["API Client"]
    end

    APICLIENT -.->|"Internal"| AUTH

    style SPA fill:#3498DB,stroke:#21618C,color:#fff,stroke-width:2px
    style SERVER fill:#EBF5FB,stroke:#1B4F72,color:#1B4F72,stroke-width:2px
    style DB fill:#27AE60,stroke:#1E8449,color:#fff,stroke-width:2px
    style SF fill:#E67E22,stroke:#CA6F1E,color:#fff
    style SMLAPI fill:#E67E22,stroke:#CA6F1E,color:#fff
    style JIRAAPI fill:#E67E22,stroke:#CA6F1E,color:#fff
    style MSAPI fill:#E67E22,stroke:#CA6F1E,color:#fff
    style MCPBOX fill:#F5EEF8,stroke:#8E44AD,color:#6C3483,stroke-width:2px
    style TOOLS fill:#AF7AC5,stroke:#7D3C98,color:#fff
    style SCHEMA fill:#AF7AC5,stroke:#7D3C98,color:#fff
    style APICLIENT fill:#AF7AC5,stroke:#7D3C98,color:#fff`,

  'data-flow': `flowchart LR
    SF["Salesforce\\nPS Records"]
    SML["SML\\nTenant Data"]

    SF -->|"jsforce + OAuth"| BE
    SML -->|"REST API"| BE

    subgraph CORE ["Express Backend"]
        BE["Service Layer"]
    end

    BE <-->|"SQL"| DB[("PostgreSQL\\nCache + Derived")]
    BE --> JIRA["Jira"]
    BE --> MSG["MS Graph"]
    BE --> OAI["OpenAI"]

    style SF fill:#3498DB,stroke:#21618C,color:#fff,stroke-width:2px
    style SML fill:#3498DB,stroke:#21618C,color:#fff,stroke-width:2px
    style CORE fill:#EBF5FB,stroke:#1B4F72,color:#1B4F72,stroke-width:2px
    style BE fill:#1B4F72,stroke:#154360,color:#fff
    style DB fill:#27AE60,stroke:#1E8449,color:#fff,stroke-width:2px
    style JIRA fill:#E67E22,stroke:#CA6F1E,color:#fff
    style MSG fill:#E67E22,stroke:#CA6F1E,color:#fff
    style OAI fill:#8E44AD,stroke:#6C3483,color:#fff`,

  'auth-flow': `sequenceDiagram
    actor User as Browser
    participant Auth as Auth Service
    participant DB as PostgreSQL

    User->>+Auth: POST /api/auth/login
    Auth->>DB: Lookup user
    DB-->>Auth: User record
    Auth->>Auth: Verify password (bcrypt)
    Auth->>Auth: Sign JWT tokens
    Auth->>DB: Record session
    Auth-->>-User: Set HTTP-only cookies

    Note right of User: Cookies auto-sent on requests

    rect rgb(235, 245, 251)
    Note over User,DB: Authenticated Requests
    User->>+Auth: GET /api/resource
    Auth->>Auth: Verify JWT
    Auth->>DB: Load permissions
    DB-->>Auth: Roles + pages
    Auth-->>-User: Protected resource
    end`,

  'report-flow': `sequenceDiagram
    actor User as User
    participant Page as Create Report
    participant Agent as Report Agent
    participant AI as OpenAI (GPT-4)
    participant DB as PostgreSQL

    User->>Page: Describe report in chat
    Page->>+Agent: Send request
    Agent->>Agent: Build prompt + data catalog
    Agent->>+AI: Chat Completions
    AI-->>-Agent: JSON report config
    Agent->>Agent: Validate (Zod)
    Agent-->>-Page: Config + preview

    User->>Page: Refine or Save
    Page->>DB: Store report config
    DB-->>Page: Report ID + slug

    rect rgb(235, 245, 251)
    Note over User,DB: Viewing a Saved Report
    User->>Page: Open /reports/:slug
    Page->>DB: Fetch data per widget
    DB-->>Page: Response data
    Page-->>User: KPIs, Charts, Tables
    end`,

  'provisioning-flow': `flowchart TD
    SF["Salesforce"]

    SF -->|"jsforce"| SFAPI["API Service"]

    SFAPI --> VS["Validation\\n6 rules"]
    SFAPI --> PRL["Request List\\nFilter + Search"]

    VS --> UI
    PRL --> UI

    subgraph UI ["Provisioning Monitor"]
        direction LR
        subgraph MAIN ["Main View"]
            RT["Data Table"]
            FI["Filters"]
            SE["Search"]
        end
        subgraph DETAILS ["Detail Views"]
            PM["Products"]
            SC["SML Compare"]
            RD["Raw Data"]
        end
    end

    style SF fill:#3498DB,stroke:#21618C,color:#fff,stroke-width:2px
    style SFAPI fill:#1B4F72,stroke:#154360,color:#fff
    style VS fill:#E74C3C,stroke:#C0392B,color:#fff
    style PRL fill:#27AE60,stroke:#1E8449,color:#fff
    style UI fill:#EBF5FB,stroke:#2E86C1,color:#1B4F72,stroke-width:2px
    style MAIN fill:#D4E6F1,stroke:#85C1E9,color:#1B4F72
    style DETAILS fill:#D4E6F1,stroke:#85C1E9,color:#1B4F72`,

  'security-arch': `flowchart LR
    subgraph SEC ["Defense in Depth"]
        direction LR
        subgraph LEFT [" "]
            direction TB
            L1["Transport\\nHTTPS + HTTP-only Cookies"]
            L2["Authentication\\nJWT + bcrypt"]
            L3["Authorization\\nRBAC"]
            L4["Rate Limiting\\n100 req / 15 min"]
            L1 --> L2 --> L3 --> L4
        end
        subgraph RIGHT [" "]
            direction TB
            L5["Input Validation\\nZod + Parameterized SQL"]
            L6["Secrets\\nAES-256-GCM"]
            L7["Sessions\\nExpiry + Lockout"]
            L8["CORS\\nOrigin Whitelist"]
            L5 --> L6 --> L7 --> L8
        end
        L4 --> L5
    end

    style SEC fill:#EBF5FB,stroke:#1B4F72,color:#1B4F72,stroke-width:2px
    style LEFT fill:#E8F0FE,stroke:#AED6F1,color:#1B4F72,stroke-width:1px
    style RIGHT fill:#E8F0FE,stroke:#AED6F1,color:#1B4F72,stroke-width:1px
    style L1 fill:#1B4F72,stroke:#154360,color:#fff,stroke-width:2px
    style L2 fill:#21618C,stroke:#1B4F72,color:#fff,stroke-width:2px
    style L3 fill:#2874A6,stroke:#21618C,color:#fff,stroke-width:2px
    style L4 fill:#2E86C1,stroke:#2874A6,color:#fff,stroke-width:2px
    style L5 fill:#3498DB,stroke:#2E86C1,color:#fff,stroke-width:2px
    style L6 fill:#5DADE2,stroke:#3498DB,color:#1B4F72,stroke-width:2px
    style L7 fill:#85C1E9,stroke:#5DADE2,color:#1B4F72,stroke-width:2px
    style L8 fill:#AED6F1,stroke:#85C1E9,color:#1B4F72,stroke-width:2px`,

  'deployment-arch': `flowchart TD
    subgraph PROD ["Production"]
        subgraph NODEPROC ["Node.js — port 5000"]
            EX["Express Server"]
            API["/api routes"]
            AUTHRT["/auth routes"]
            HEALTH["/health"]
            STATIC["Static Files"]
            MCPSTDIO["MCP Server"]
            EX --> API
            EX --> AUTHRT
            EX --> HEALTH
            EX --> STATIC
        end
        NODEPROC --> PG[("PostgreSQL 16")]
    end

    subgraph DEV ["Development"]
        VITE["Vite :8080"]
        EXPRESS["Express :5000"]
        LOCALDB[("Local PG")]
        VITE -->|"proxy /api"| EXPRESS --> LOCALDB
    end

    style PROD fill:#EBF5FB,stroke:#1B4F72,color:#1B4F72,stroke-width:2px
    style NODEPROC fill:#D4E6F1,stroke:#2E86C1,color:#1B4F72,stroke-width:2px
    style DEV fill:#FEF9E7,stroke:#F39C12,color:#7D6608,stroke-width:2px
    style PG fill:#27AE60,stroke:#1E8449,color:#fff,stroke-width:2px
    style LOCALDB fill:#27AE60,stroke:#1E8449,color:#fff,stroke-width:2px
    style EX fill:#1B4F72,stroke:#154360,color:#fff
    style VITE fill:#E67E22,stroke:#CA6F1E,color:#fff
    style EXPRESS fill:#1B4F72,stroke:#154360,color:#fff`,

  'mcp-integration': `flowchart LR
    AI["AI Agent"]

    AI <-->|"stdio"| MCPS

    subgraph MCPS ["MCP Server (42 tools)"]
        TR["Registry"]
        subgraph CATS ["Tool Categories"]
            direction TB
            AN["Analytics (8)"]
            PR["Provisioning (7)"]
            AT["Audit Trail (5)"]
            CP["Products (7)"]
            EXP["Expiration (4)"]
            AC["Accounts (5)"]
            PK["Packages (3)"]
            INTG["Integrations (3)"]
        end
        APIC["API Client"]
    end

    APIC -->|"HTTP"| EXPRESSAPI["Express API"]

    style AI fill:#8E44AD,stroke:#6C3483,color:#fff,stroke-width:2px
    style MCPS fill:#F5EEF8,stroke:#8E44AD,color:#6C3483,stroke-width:2px
    style CATS fill:#E8DAEF,stroke:#AF7AC5,color:#6C3483
    style EXPRESSAPI fill:#1B4F72,stroke:#154360,color:#fff,stroke-width:2px
    style TR fill:#AF7AC5,stroke:#7D3C98,color:#fff
    style APIC fill:#AF7AC5,stroke:#7D3C98,color:#fff`,

  'db-schema': `flowchart TD
    subgraph DB ["Database Schema"]
        direction TB
        subgraph AUTH ["Auth & RBAC (9 tables)"]
            direction LR
            A1["Users + Roles"]
            A2["Permissions + Pages"]
            A3["Sessions + Audit"]
            A4["Settings"]
        end

        subgraph PROV ["Provisioning & Analytics (14 tables)"]
            direction LR
            P1["Expiration Monitor"]
            P2["Accounts + Ghosts"]
            P3["Package Analysis"]
            P4["SML + Audit Trail"]
            P5["Validation Results"]
        end

        subgraph PRODM ["Product Management (10 tables)"]
            direction LR
            M1["Products + Bundles"]
            M2["Package Mapping"]
            M3["Update Requests"]
            M4["Current Accounts"]
        end

        subgraph RPT ["Reporting (1 table)"]
            CR["custom_reports"]
        end

        subgraph OBS ["Observability (1 table)"]
            MTI["mcp_tool_invocations"]
        end
    end

    style DB fill:#EBF5FB,stroke:#1B4F72,color:#1B4F72,stroke-width:2px
    style AUTH fill:#D4E6F1,stroke:#2E86C1,color:#1B4F72,stroke-width:2px
    style PROV fill:#D5F5E3,stroke:#27AE60,color:#1E8449,stroke-width:2px
    style PRODM fill:#FCF3CF,stroke:#F39C12,color:#7D6608,stroke-width:2px
    style RPT fill:#FADBD8,stroke:#E74C3C,color:#922B21,stroke-width:2px
    style OBS fill:#F5EEF8,stroke:#8E44AD,color:#6C3483,stroke-width:2px`,
};

// Map code blocks to diagram images based on unique content
const DIAGRAM_MATCHERS = [
  { required: ['End Users (Browser)', 'MCP Server (stdio)'], diagram: 'high-level-arch', caption: 'Figure 1 — High-Level Architecture' },
  { required: ['deployment_assistant (database)'], diagram: 'db-schema', caption: 'Figure 2 — Database Schema' },
  { required: ['Express Backend', 'Cache &'], diagram: 'data-flow', caption: 'Figure 3 — Primary Data Flow' },
  { required: ['POST /api/auth/login', 'JWT Verify'], diagram: 'auth-flow', caption: 'Figure 4 — Authentication & Authorization Flow' },
  { required: ['Report Agent', 'Data Catalog'], diagram: 'report-flow', caption: 'Figure 5 — Custom Report Generation Flow' },
  { required: ['Provisioning Monitor UI'], diagram: 'provisioning-flow', caption: 'Figure 6 — Provisioning Monitor Data Flow' },
  { required: ['Security Layers'], diagram: 'security-arch', caption: 'Figure 7 — Security Architecture' },
  { required: ['Production Deployment'], diagram: 'deployment-arch', caption: 'Figure 8 — Deployment Architecture' },
  { required: ['AI Agent', 'Tool Registry (42)'], diagram: 'mcp-integration', caption: 'Figure 9 — MCP Integration Architecture' },
];

// ─── Rendering via Playwright + Mermaid.js ──────────────────────────────────
const { chromium } = require('@playwright/test');

const RENDER_SCALE = 3;

function getPngDimensions(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function buildHtmlPage(mermaidCode) {
  const initConfig = JSON.stringify({
    startOnLoad: true,
    theme: MERMAID_CONFIG.theme,
    themeVariables: MERMAID_CONFIG.themeVariables,
    flowchart: MERMAID_CONFIG.flowchart,
    sequence: MERMAID_CONFIG.sequence,
    securityLevel: 'loose',
  });

  return `<!DOCTYPE html>
<html><head>
<style>
  body { margin: 0; padding: 24px; background: white; display: flex; justify-content: center; }
  #diagram { display: inline-block; }
</style>
</head><body>
<div id="diagram">
  <pre class="mermaid">${mermaidCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js"></script>
<script>
  mermaid.initialize(${initConfig});
  mermaid.run().then(() => { document.body.dataset.rendered = 'true'; });
</script>
</body></html>`;
}

async function renderDiagrams() {
  console.log('  Launching Playwright Chromium...');
  const browser = await chromium.launch({
    headless: true,
    args: ['--ignore-certificate-errors', '--disable-gpu', '--font-render-hinting=none'],
  });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1600, height: 1200 },
    deviceScaleFactor: RENDER_SCALE,
  });
  console.log(`  Browser ready (${RENDER_SCALE}x DPI).\n`);

  const images = {};

  for (const [name, mmd] of Object.entries(DIAGRAMS)) {
    console.log(`  Rendering: ${name}...`);
    const page = await context.newPage();
    try {
      const html = buildHtmlPage(mmd);
      await page.setContent(html, { waitUntil: 'networkidle' });
      await page.waitForFunction(() => document.body.dataset.rendered === 'true', { timeout: 30000 });
      await page.waitForTimeout(500);

      const diagram = page.locator('#diagram');
      images[name] = await diagram.screenshot({ type: 'png' });
      const dim = getPngDimensions(images[name]);
      console.log(`    done (${images[name].length} bytes, ${dim.width}x${dim.height}px @ ${RENDER_SCALE}x)`);
    } catch (err) {
      console.warn(`    FAILED: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  console.log('\n  Browser closed.');
  return images;
}

// ─── Match a code block to a diagram ────────────────────────────────────────
function matchDiagram(codeText) {
  for (const m of DIAGRAM_MATCHERS) {
    if (m.required.every((kw) => codeText.includes(kw))) return m;
  }
  return null;
}

// ─── Word document helpers ──────────────────────────────────────────────────
function parseInline(text) {
  const runs = [];
  const re = /(\*\*(.+?)\*\*)|(`(.+?)`)|([^*`]+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) runs.push(new TextRun({ text: m[2], bold: true, font: 'Calibri', size: 22 }));
    else if (m[4]) runs.push(new TextRun({ text: m[4], font: 'Consolas', size: 19, color: C.secondary }));
    else if (m[5]) runs.push(new TextRun({ text: m[5], font: 'Calibri', size: 22 }));
  }
  return runs;
}

function cellBorders() {
  const b = { style: BorderStyle.SINGLE, size: 1, color: C.tableBorder };
  return { top: b, bottom: b, left: b, right: b };
}

function makeTable(headers, dataRows) {
  const w = Math.floor(9600 / headers.length);
  const hdr = new TableRow({
    tableHeader: true,
    children: headers.map((h) => new TableCell({
      width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: C.headerBg }, borders: cellBorders(),
      children: [new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun({ text: h.trim(), bold: true, color: C.white, font: 'Calibri', size: 20 })] })],
    })),
  });
  const rows = dataRows.map((row, idx) => new TableRow({
    children: row.map((cell) => new TableCell({
      width: { size: w, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: idx % 2 === 0 ? C.white : C.altRow }, borders: cellBorders(),
      children: [new Paragraph({ spacing: { before: 40, after: 40 }, children: parseInline(cell.trim()) })],
    })),
  }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [hdr, ...rows] });
}

function makeCodeBlock(text) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const borders = {
      left: { color: C.accent, size: 6, space: 8, style: BorderStyle.SINGLE },
      right: { color: C.codeBorder, size: 1, space: 4, style: BorderStyle.SINGLE },
    };
    if (i === 0) borders.top = { color: C.codeBorder, size: 1, space: 4, style: BorderStyle.SINGLE };
    if (i === lines.length - 1) borders.bottom = { color: C.codeBorder, size: 1, space: 4, style: BorderStyle.SINGLE };
    return new Paragraph({
      spacing: { before: i === 0 ? 160 : 0, after: i === lines.length - 1 ? 160 : 0, line: 228 },
      shading: { type: ShadingType.CLEAR, fill: C.codeBg }, border: borders,
      children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 16, color: C.darkText })],
    });
  });
}

function makeDiagramImage(imageBuffer, caption) {
  const dim = getPngDimensions(imageBuffer);
  const logicalW = dim.width / RENDER_SCALE;
  const logicalH = dim.height / RENDER_SCALE;
  const targetWidth = 560;
  const maxHeight = 540;
  let fitScale = targetWidth / logicalW;
  if (logicalH * fitScale > maxHeight) fitScale = maxHeight / logicalH;
  const displayW = Math.round(logicalW * fitScale);
  const displayH = Math.round(logicalH * fitScale);

  return [
    new Paragraph({
      spacing: { before: 120, after: 60 },
      alignment: AlignmentType.CENTER,
      keepNext: true,
      children: [new ImageRun({ data: imageBuffer, transformation: { width: displayW, height: displayH }, type: 'png' })],
    }),
    new Paragraph({
      spacing: { before: 20, after: 160 },
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: caption, font: 'Calibri', size: 18, italics: true, color: C.secondary })],
    }),
  ];
}

function makeBullet(text, level = 0) {
  const marker = level === 0 ? '\u2022  ' : '\u25E6  ';
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.4 + level * 0.3), hanging: convertInchesToTwip(0.2) },
    children: [new TextRun({ text: marker, font: 'Calibri', size: 20, color: C.accent }), ...parseInline(text)],
  });
}

function makeNumbered(num, text) {
  return new Paragraph({
    spacing: { before: 40, after: 40 },
    indent: { left: convertInchesToTwip(0.4), hanging: convertInchesToTwip(0.25) },
    children: [new TextRun({ text: `${num}.  `, bold: true, font: 'Calibri', size: 20, color: C.accent }), ...parseInline(text)],
  });
}

function divider() {
  return new Paragraph({
    spacing: { before: 200, after: 200 },
    border: { bottom: { color: C.mediumBg, size: 2, space: 10, style: BorderStyle.SINGLE } },
    children: [],
  });
}

// ─── Parse markdown and build document elements ─────────────────────────────
function parseMd(md, diagramImages) {
  const lines = md.split('\n');
  const els = [];
  let i = 0, inCode = false, codeLines = [];

  while (i < lines.length) {
    const line = lines[i];

    // Code fence open
    if (line.startsWith('```') && !inCode) {
      inCode = true; codeLines = []; i++; continue;
    }
    // Code fence close
    if (line.startsWith('```') && inCode) {
      inCode = false;
      const codeText = codeLines.join('\n');
      const dm = matchDiagram(codeText);
      if (dm && diagramImages[dm.diagram]) {
        els.push(...makeDiagramImage(diagramImages[dm.diagram], dm.caption));
      } else {
        els.push(...makeCodeBlock(codeText));
      }
      i++; continue;
    }
    if (inCode) { codeLines.push(line); i++; continue; }

    // Headings
    if (line.startsWith('# ')) {
      els.push(
        new Paragraph({ heading: HeadingLevel.TITLE, spacing: { before: 0, after: 100 }, keepNext: true,
          children: [new TextRun({ text: line.slice(2), font: 'Calibri', size: 56, bold: true, color: C.primary })] }),
        new Paragraph({ spacing: { before: 0, after: 300 }, keepNext: true,
          children: [new TextRun({ text: 'Solution Architecture Document', font: 'Calibri', size: 26, italics: true, color: C.secondary })] }),
        divider(),
      );
      i++; continue;
    }
    if (line.startsWith('## ')) {
      els.push(new Paragraph({ heading: HeadingLevel.HEADING_1, keepNext: true, keepLines: true,
        children: [new TextRun({ text: line.slice(3), font: 'Calibri', size: 36, bold: true, color: C.primary })] }));
      i++; continue;
    }
    if (line.startsWith('### ')) {
      els.push(new Paragraph({ heading: HeadingLevel.HEADING_2, keepNext: true, keepLines: true,
        children: [new TextRun({ text: line.slice(4), font: 'Calibri', size: 28, bold: true, color: C.secondary })] }));
      i++; continue;
    }

    // Horizontal rule
    if (line.startsWith('---')) { els.push(divider()); i++; continue; }

    // Tables
    if (line.startsWith('|') && lines[i + 1] && /^\|[\s\-:|]+\|/.test(lines[i + 1])) {
      const hCells = line.split('|').filter((c) => c.trim());
      i += 2;
      const dRows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        dRows.push(lines[i].split('|').filter((c) => c.trim()));
        i++;
      }
      els.push(makeTable(hCells, dRows), new Paragraph({ spacing: { after: 120 }, children: [] }));
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const m = line.match(/^(\d+)\.\s+(.*)/);
      els.push(makeNumbered(m[1], m[2])); i++; continue;
    }

    // Bullet list (sub-bullet: indented with spaces)
    if (/^\s{2,}-\s+/.test(line)) {
      els.push(makeBullet(line.replace(/^\s+-\s+/, ''), 1)); i++; continue;
    }
    if (/^-\s+/.test(line)) {
      els.push(makeBullet(line.replace(/^-\s+/, ''), 0)); i++; continue;
    }

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Regular paragraph
    els.push(new Paragraph({ spacing: { before: 60, after: 100 }, children: parseInline(line) }));
    i++;
  }
  return els;
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== Rendering Mermaid diagrams via Playwright ===');
  const images = await renderDiagrams();
  const renderedCount = Object.keys(images).length;
  console.log(`\nRendered ${renderedCount}/${Object.keys(DIAGRAMS).length} diagrams.\n`);

  console.log('=== Building Word document ===');
  const mdPath = path.join(__dirname, '..', 'docs', 'requirements', '00-solution-architecture.md');
  const md = fs.readFileSync(mdPath, 'utf-8');
  const children = parseMd(md, images);

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: C.bodyText }, paragraph: { spacing: { after: 120, line: 276 } } },
        heading1: {
          run: { font: 'Calibri', size: 36, bold: true, color: C.primary },
          paragraph: { keepNext: true, keepLines: true, spacing: { before: 360, after: 200 }, border: { bottom: { color: C.secondary, size: 6, space: 8, style: BorderStyle.SINGLE } } },
        },
        heading2: {
          run: { font: 'Calibri', size: 28, bold: true, color: C.secondary },
          paragraph: { keepNext: true, keepLines: true, spacing: { before: 280, after: 120 } },
        },
      },
    },
    sections: [{
      properties: {
        page: { margin: { top: convertInchesToTwip(1), bottom: convertInchesToTwip(0.8), left: convertInchesToTwip(1), right: convertInchesToTwip(1) } },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: 'Deployment Assistant \u2014 Solution Architecture', font: 'Calibri', size: 16, color: C.secondary, italics: true })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [
          new TextRun({ text: 'Page ', font: 'Calibri', size: 16, color: C.tableBorder }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 16, color: C.tableBorder }),
          new TextRun({ text: ' of ', font: 'Calibri', size: 16, color: C.tableBorder }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 16, color: C.tableBorder }),
        ] })] }),
      },
      children,
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  const outPath = path.join(__dirname, '..', 'docs', 'requirements', 'Solution-Architecture.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`\nWord document created: ${outPath}`);
}

main().catch((err) => { console.error('Error:', err); process.exit(1); });
