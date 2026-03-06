#!/usr/bin/env node

/**
 * Data Alignment Validation Script
 *
 * Checks that the canonical data source schema (config/report-data-sources.js)
 * and the MCP tool registry (mcp-server/config/tool-registry.js) are in sync.
 *
 * Validates:
 *   1. Every canonical entry with an mcpToolName has a corresponding MCP tool
 *   2. MCP tool names match the canonical mcpToolName
 *   3. MCP tools import from the canonical schema (not inline inputSchema)
 *   4. Canonical entries without MCP tools are flagged as warnings
 *
 * Usage: node scripts/validate-data-alignment.js
 * Exit code: 0 = pass, 1 = fail
 */

const path = require('path');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '..');

let exitCode = 0;
let warnings = 0;
let passes = 0;

function pass(msg) {
    passes++;
    console.log(`  ✓ ${msg}`);
}

function fail(msg) {
    exitCode = 1;
    console.error(`  ✗ FAIL: ${msg}`);
}

function warn(msg) {
    warnings++;
    console.warn(`  ⚠ WARN: ${msg}`);
}

console.log('Data Alignment Validation');
console.log('='.repeat(60));
console.log();

// ── Load canonical schema ──────────────────────────────────

console.log('1. Loading canonical data sources...');

let dataSources;
try {
    const canonical = require(path.join(PROJECT_ROOT, 'config', 'report-data-sources'));
    dataSources = canonical.DATA_SOURCES;
    if (!Array.isArray(dataSources) || dataSources.length === 0) {
        fail('DATA_SOURCES is empty or not an array');
        process.exit(1);
    }
    pass(`Loaded ${dataSources.length} canonical data sources`);
} catch (err) {
    fail(`Cannot load config/report-data-sources.js: ${err.message}`);
    process.exit(1);
}

// ── Load MCP tool registry ─────────────────────────────────

console.log('\n2. Loading MCP tool registry...');

let mcpTools;
try {
    const registry = require(path.join(PROJECT_ROOT, 'mcp-server', 'config', 'tool-registry'));
    mcpTools = registry.getTools();
    if (!Array.isArray(mcpTools) || mcpTools.length === 0) {
        fail('MCP tool registry returned empty array');
        process.exit(1);
    }
    pass(`Loaded ${mcpTools.length} MCP tools`);
} catch (err) {
    fail(`Cannot load mcp-server/config/tool-registry.js: ${err.message}`);
    process.exit(1);
}

// ── Check canonical → MCP mapping ──────────────────────────

console.log('\n3. Checking canonical → MCP tool mapping...');

const mcpToolNames = new Set(mcpTools.map(t => t.name));
const canonicalWithMcp = dataSources.filter(s => s.mcpToolName);
const canonicalWithoutMcp = dataSources.filter(s => !s.mcpToolName);

for (const source of canonicalWithMcp) {
    if (mcpToolNames.has(source.mcpToolName)) {
        pass(`${source.id} → ${source.mcpToolName}`);
    } else {
        fail(`${source.id} maps to MCP tool "${source.mcpToolName}" but that tool does not exist in the registry`);
    }
}

for (const source of canonicalWithoutMcp) {
    if (source.reportEligible) {
        warn(`${source.id} has no MCP tool mapping (mcpToolName is null)`);
    }
}

// ── Check MCP → canonical reverse mapping ──────────────────

console.log('\n4. Checking MCP tools → canonical mapping...');

const canonicalMcpNames = new Set(canonicalWithMcp.map(s => s.mcpToolName));
const writeToolPrefixes = ['create_', 'update_', 'delete_', 'review_', 'refresh_', 'capture_'];

for (const tool of mcpTools) {
    const isWriteTool = writeToolPrefixes.some(p => tool.name.startsWith(p));
    if (canonicalMcpNames.has(tool.name)) {
        pass(`${tool.name} ← canonical`);
    } else if (isWriteTool) {
        // Write tools aren't expected to have canonical entries (reports are read-only)
    } else {
        warn(`MCP tool "${tool.name}" has no canonical data source entry`);
    }
}

// ── Check that MCP tools import from canonical schema ──────

console.log('\n5. Checking MCP tool files import from canonical schema...');

const toolDirs = ['analytics', 'provisioning', 'expiration', 'accounts', 'packages', 'audit-trail', 'customer-products'];

for (const source of canonicalWithMcp) {
    let found = false;

    for (const dir of toolDirs) {
        const toolDir = path.join(PROJECT_ROOT, 'mcp-server', 'tools', dir);
        if (!fs.existsSync(toolDir)) continue;

        const files = fs.readdirSync(toolDir).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const filePath = path.join(toolDir, file);
            const content = fs.readFileSync(filePath, 'utf8');

            if (content.includes(`getToolSchema('${source.id}')`)) {
                pass(`${source.id}: ${dir}/${file} imports from canonical schema`);
                found = true;
                break;
            }
        }
        if (found) break;
    }

    if (!found) {
        fail(`${source.id}: No MCP tool file imports getToolSchema('${source.id}')`);
    }
}

// ── Summary ────────────────────────────────────────────────

console.log('\n' + '='.repeat(60));
console.log(`Results: ${passes} passed, ${exitCode ? 'FAILURES DETECTED' : '0 failed'}, ${warnings} warnings`);

if (canonicalWithoutMcp.length > 0) {
    console.log(`\nCanonical entries without MCP tools (${canonicalWithoutMcp.length}):`);
    for (const s of canonicalWithoutMcp) {
        console.log(`  - ${s.id} (${s.endpoint})`);
    }
}

console.log();
process.exit(exitCode);
