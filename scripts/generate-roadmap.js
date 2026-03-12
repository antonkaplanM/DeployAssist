const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: #fff;
    padding: 0;
  }
  .container {
    width: 1100px;
    padding: 36px 40px 28px 40px;
  }
  h1 {
    text-align: center;
    font-size: 22px;
    font-weight: 700;
    color: #1a2a3a;
    margin-bottom: 28px;
    letter-spacing: 0.3px;
  }
  .chart {
    position: relative;
  }
  .phase-group {
    margin-bottom: 6px;
    border-radius: 8px;
    overflow: hidden;
  }
  .phase-header {
    display: flex;
    align-items: center;
    padding: 7px 16px;
    font-size: 13px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 0.4px;
  }
  .phase1-bg { background: #1b5e91; }
  .phase2-bg { background: #2980b9; }
  .phase3-bg { background: #5ba3d9; }
  .phase1-row { background: #eaf2f8; }
  .phase2-row { background: #ebf5fb; }
  .phase3-row { background: #f0f8ff; }
  .epic-row {
    display: grid;
    grid-template-columns: 300px 1fr;
    align-items: center;
    height: 44px;
    border-bottom: 1px solid rgba(0,0,0,0.06);
  }
  .epic-row:last-child { border-bottom: none; }
  .epic-label {
    padding: 0 16px;
    font-size: 13px;
    font-weight: 500;
    color: #2c3e50;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .epic-label .epic-id {
    font-weight: 700;
    color: #1a5276;
    margin-right: 6px;
  }
  .bar-area {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
  }
  .bar {
    position: absolute;
    height: 24px;
    border-radius: 4px;
    background: linear-gradient(135deg, #2980b9, #3498db);
    box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    min-width: 8px;
  }
  .phase1-bar { background: linear-gradient(135deg, #1b5e91, #2980b9); }
  .phase2-bar { background: linear-gradient(135deg, #2980b9, #3498db); }
  .phase3-bar { background: linear-gradient(135deg, #5ba3d9, #7ec8e3); }

  /* Footer */
  .legend {
    display: flex;
    justify-content: center;
    gap: 28px;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #ecf0f1;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #5d6d7e;
    font-weight: 500;
  }
  .legend-swatch {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }
</style>
</head>
<body>
<div class="container">
  <h1>Deployment Assistant &mdash; Release Roadmap</h1>

  <div class="chart" id="chart">
    <!-- Chart body -->
    <div style="position:relative;">

      <!-- Phase 1 -->
      <div class="phase-group">
        <div class="phase-header phase1-bg">PHASE 1 &mdash; MVP</div>
        <div class="epic-row phase1-row">
          <div class="epic-label"><span class="epic-id">EPIC-01</span>Infrastructure &amp; Foundation</div>
          <div class="bar-area"><div class="bar phase1-bar" data-start="0" data-end="22"></div></div>
        </div>
        <div class="epic-row phase1-row">
          <div class="epic-label"><span class="epic-id">EPIC-02</span>Data Sources &amp; Integrations</div>
          <div class="bar-area"><div class="bar phase1-bar" data-start="14" data-end="38"></div></div>
        </div>
        <div class="epic-row phase1-row">
          <div class="epic-label"><span class="epic-id">EPIC-08</span>User Management</div>
          <div class="bar-area"><div class="bar phase1-bar" data-start="28" data-end="44"></div></div>
        </div>
        <div class="epic-row phase1-row">
          <div class="epic-label"><span class="epic-id">EPIC-04</span>Provisioning Monitor</div>
          <div class="bar-area"><div class="bar phase1-bar" data-start="34" data-end="50"></div></div>
        </div>
      </div>

      <!-- Phase 2 -->
      <div class="phase-group">
        <div class="phase-header phase2-bg">PHASE 2 &mdash; ENHANCED FEATURES</div>
        <div class="epic-row phase2-row">
          <div class="epic-label"><span class="epic-id">EPIC-03</span>Dashboard</div>
          <div class="bar-area"><div class="bar phase2-bar" data-start="46" data-end="62"></div></div>
        </div>
        <div class="epic-row phase2-row">
          <div class="epic-label"><span class="epic-id">EPIC-05</span>Custom Reports</div>
          <div class="bar-area"><div class="bar phase2-bar" data-start="52" data-end="76"></div></div>
        </div>
        <div class="epic-row phase2-row">
          <div class="epic-label"><span class="epic-id">EPIC-06</span>Current Accounts</div>
          <div class="bar-area"><div class="bar phase2-bar" data-start="60" data-end="78"></div></div>
        </div>
      </div>

      <!-- Phase 3 -->
      <div class="phase-group">
        <div class="phase-header phase3-bg">PHASE 3 &mdash; COMPLETE PLATFORM</div>
        <div class="epic-row phase3-row">
          <div class="epic-label"><span class="epic-id">EPIC-07</span>Help Page</div>
          <div class="bar-area"><div class="bar phase3-bar" data-start="78" data-end="88"></div></div>
        </div>
        <div class="epic-row phase3-row">
          <div class="epic-label"><span class="epic-id">EPIC-09</span>Settings</div>
          <div class="bar-area"><div class="bar phase3-bar" data-start="82" data-end="96"></div></div>
        </div>
      </div>
    </div>
  </div>

  <div class="legend">
    <div class="legend-item"><div class="legend-swatch" style="background:linear-gradient(135deg,#1b5e91,#2980b9)"></div>Phase 1 — MVP</div>
    <div class="legend-item"><div class="legend-swatch" style="background:linear-gradient(135deg,#2980b9,#3498db)"></div>Phase 2 — Enhanced Features</div>
    <div class="legend-item"><div class="legend-swatch" style="background:linear-gradient(135deg,#5ba3d9,#7ec8e3)"></div>Phase 3 — Complete Platform</div>
  </div>
</div>

<script>
  document.querySelectorAll('.bar').forEach(bar => {
    const start = parseFloat(bar.dataset.start);
    const end   = parseFloat(bar.dataset.end);
    bar.style.left  = start + '%';
    bar.style.width = (end - start) + '%';
  });
</script>
</body>
</html>`;

(async () => {
  const outputPath = path.join(__dirname, '..', 'docs', 'requirements', 'plan922-roadmap.png');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(html, { waitUntil: 'networkidle' });

  const chart = await page.$('.container');
  await chart.screenshot({ path: outputPath, type: 'png', omitBackground: false });

  await browser.close();
  console.log('Roadmap image saved to:', outputPath);
})();
