/**
 * Report Config Schema
 * 
 * Zod validation schema for report configuration JSON.
 * Ensures AI-generated report definitions conform to the expected structure
 * before they are saved to the database.
 */

const { z } = require('zod');

// Lazy require to break circular dependency with report-data-sources.js
let _isEndpointAllowed;
function isEndpointAllowed(endpoint) {
    if (!_isEndpointAllowed) {
        _isEndpointAllowed = require('./report-data-sources').isEndpointAllowed;
    }
    return _isEndpointAllowed(endpoint);
}

let _validateEndpointParams;
function validateEndpointParams(endpoint, params, linkedParams) {
    if (!_validateEndpointParams) {
        _validateEndpointParams = require('./report-data-sources').validateEndpointParams;
    }
    return _validateEndpointParams(endpoint, params, linkedParams);
}

const VALID_COMPONENT_TYPES = ['kpi-card', 'bar-chart', 'line-chart', 'pie-chart', 'data-table', 'echarts', 'ag-grid'];
const VALID_FORMATS = ['number', 'currency', 'percentage', 'date', 'text'];
const VALID_LAYOUTS = ['grid', 'stack', 'two-column'];
const MAX_COMPONENTS = 12;

/**
 * Strip HTML/script tags and control characters from strings.
 * Applied as a Zod transform on user-facing text fields.
 */
function sanitizeString(val) {
    if (typeof val !== 'string') return val;
    return val
        .replace(/<[^>]*>/g, '')
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
        .trim();
}

const safeId = z.string().min(1).max(50).regex(
    /^[a-zA-Z0-9_-]+$/,
    'IDs may only contain letters, numbers, hyphens, and underscores'
);

const safeFieldPath = z.string().min(1).max(200).regex(
    /^[a-zA-Z0-9_.]+$/,
    'Field paths may only contain letters, numbers, dots, and underscores'
);

const enrichSchema = z.object({
    endpoint: z.string().refine(
        (val) => isEndpointAllowed(val),
        { message: 'Enrichment endpoint is not in the allowlisted data catalog' }
    ),
    params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
    arrayKey: z.string().max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
    sourceField: safeFieldPath,
    matchField: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.]+$/),
    fields: z.array(z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.]+$/)).min(1).max(20)
}).optional();

const dataSourceSchema = z.object({
    endpoint: z.string().refine(
        (val) => isEndpointAllowed(val),
        { message: 'Endpoint is not in the allowlisted data catalog' }
    ),
    params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
    transform: z.enum(['count', 'sum', 'average', 'first', 'last', 'raw']).optional(),
    linkedParams: z.record(safeId).optional(),
    arrayKey: z.string().max(50).regex(/^[a-zA-Z0-9_]+$/).optional(),
    enrich: enrichSchema
}).superRefine((data, ctx) => {
    const errors = validateEndpointParams(data.endpoint, data.params, data.linkedParams || {});
    for (const msg of errors) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: msg, path: ['params'] });
    }
});

const filterOptionSchema = z.object({
    value: z.string(),
    label: z.string()
});

const filterSchema = z.object({
    id: safeId,
    type: z.enum(['select', 'date-range', 'text', 'typeahead']),
    label: z.string().min(1).max(100).transform(sanitizeString),
    options: z.array(filterOptionSchema).optional(),
    default: z.string().optional(),
    mapsToParam: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/),
    suggestEndpoint: z.string().max(200).optional(),
    suggestParam: z.string().max(50).optional(),
    suggestResultKey: z.string().max(100).optional(),
    suggestDisplayField: z.string().max(100).optional(),
    suggestSecondaryField: z.string().max(100).optional()
});

const columnSchema = z.object({
    field: safeFieldPath.optional(),
    header: z.string().min(1).max(100).transform(sanitizeString),
    format: z.enum(VALID_FORMATS).optional(),
    sortable: z.boolean().optional().default(true),
    width: z.string().max(20).optional(),
    valueFields: z.array(z.string().max(200).regex(/^[a-zA-Z0-9_.]+$/)).max(10).optional(),
    separator: z.string().max(10).optional(),
    displayField: z.string().max(100).regex(/^[a-zA-Z0-9_]+$/).optional()
}).refine(
    (col) => col.field || (col.valueFields && col.valueFields.length > 0),
    { message: 'Column must have a "field" or "valueFields"' }
);

const baseComponentSchema = z.object({
    id: safeId,
    type: z.enum(VALID_COMPONENT_TYPES),
    title: z.string().min(1).max(200).transform(sanitizeString),
    gridSpan: z.number().int().min(1).max(3).optional().default(1),
    dataSource: dataSourceSchema
});

const kpiCardSchema = baseComponentSchema.extend({
    type: z.literal('kpi-card'),
    valueField: safeFieldPath,
    format: z.enum(VALID_FORMATS).optional().default('number'),
    prefix: z.string().max(10).optional(),
    suffix: z.string().max(10).optional(),
    comparisonField: z.string().optional(),
    comparisonLabel: z.string().optional()
});

const safeColor = z.string().max(30).regex(
    /^(#[0-9a-fA-F]{3,8}|rgba?\([0-9, .]+\)|[a-zA-Z]+)$/,
    'Invalid color value'
);

const barChartSchema = baseComponentSchema.extend({
    type: z.literal('bar-chart'),
    xField: safeFieldPath,
    yField: safeFieldPath,
    colors: z.array(safeColor).max(20).optional(),
    stacked: z.boolean().optional().default(false),
    horizontal: z.boolean().optional().default(false)
});

const lineChartSchema = baseComponentSchema.extend({
    type: z.literal('line-chart'),
    xField: safeFieldPath,
    yField: safeFieldPath,
    colors: z.array(safeColor).max(20).optional(),
    fill: z.boolean().optional().default(false),
    multiSeries: z.boolean().optional().default(false),
    seriesField: z.string().optional()
});

const pieChartSchema = baseComponentSchema.extend({
    type: z.literal('pie-chart'),
    labelField: safeFieldPath,
    valueField: safeFieldPath,
    colors: z.array(safeColor).max(20).optional(),
    doughnut: z.boolean().optional().default(false)
});

const onRowClickSchema = z.object({
    paramId: safeId,
    valueField: safeFieldPath
});

const VALID_CF_OPERATORS = ['equals', 'notEquals', 'contains', 'greaterThan', 'lessThan', 'greaterThanOrEqual', 'lessThanOrEqual'];
const VALID_CF_STYLES = ['danger', 'warning', 'success', 'info', 'muted'];

const conditionalFormatRuleSchema = z.object({
    field: safeFieldPath,
    operator: z.enum(VALID_CF_OPERATORS),
    value: z.union([z.string(), z.number(), z.boolean()]),
    style: z.enum(VALID_CF_STYLES)
});

const dataTableSchema = baseComponentSchema.extend({
    type: z.literal('data-table'),
    columns: z.array(columnSchema).min(1).max(20),
    pageSize: z.number().int().min(5).max(100).optional().default(10),
    searchable: z.boolean().optional().default(true),
    onRowClick: onRowClickSchema.optional(),
    conditionalFormatting: z.array(conditionalFormatRuleSchema).max(10).optional()
});

/**
 * ECharts component – pass-through option object rendered by Apache ECharts.
 * Uses the ECharts `dataset` component for data injection: the renderer sets
 * `option.dataset.source` to the fetched API data array. Structural validation
 * checks for the presence of `series`; the option itself is sanitized at render
 * time (functions stripped, HTML removed) rather than deeply validated here.
 */
const echartsOptionSchema = z.object({}).passthrough().refine(
    (obj) => {
        const hasSeries = obj.series && (Array.isArray(obj.series) ? obj.series.length > 0 : typeof obj.series === 'object');
        const hasGraphic = !!obj.graphic;
        return hasSeries || hasGraphic;
    },
    { message: 'ECharts option must contain a "series" array or "graphic" element' }
);

const echartsSchema = baseComponentSchema.extend({
    type: z.literal('echarts'),
    option: echartsOptionSchema
});

/**
 * AG Grid component – pass-through column definitions rendered by AG Grid Community.
 * The `columnDefs` array defines columns; each entry needs at minimum a `field` or
 * `headerName`. The `defaultColDef` object sets defaults for all columns.
 */
const agGridColumnDefSchema = z.object({
    field: z.string().max(200).optional(),
    headerName: z.string().max(200).optional(),
    header: z.string().max(200).optional(),
    sortable: z.boolean().optional(),
    filter: z.boolean().optional(),
    resizable: z.boolean().optional(),
    flex: z.number().optional(),
    width: z.union([z.string().max(20), z.number()]).optional(),
    minWidth: z.number().optional(),
    format: z.enum(VALID_FORMATS).optional(),
    valueGetter: z.boolean().optional(),
    valueFields: z.array(z.string().max(200).regex(/^[a-zA-Z0-9_.]+$/)).max(10).optional(),
    separator: z.string().max(10).optional(),
    displayField: z.string().max(100).regex(/^[a-zA-Z0-9_]+$/).optional()
}).refine(
    (col) => col.field || col.headerName || col.header || (col.valueFields && col.valueFields.length > 0),
    { message: 'Column must have at least a "field", "headerName", or "valueFields"' }
);

const agGridSchema = baseComponentSchema.extend({
    type: z.literal('ag-grid'),
    columnDefs: z.array(agGridColumnDefSchema).min(1).max(30),
    defaultColDef: z.object({}).passthrough().optional(),
    pageSize: z.number().int().min(5).max(100).optional().default(10),
    pagination: z.boolean().optional().default(true),
    searchable: z.boolean().optional().default(true),
    onRowClick: onRowClickSchema.optional(),
    conditionalFormatting: z.array(conditionalFormatRuleSchema).max(10).optional()
});

const componentSchema = z.discriminatedUnion('type', [
    kpiCardSchema,
    barChartSchema,
    lineChartSchema,
    pieChartSchema,
    dataTableSchema,
    echartsSchema,
    agGridSchema
]);

const reportConfigSchema = z.object({
    title: z.string().min(1).max(255).transform(sanitizeString),
    description: z.string().max(1000).optional().transform(v => v ? sanitizeString(v) : v),
    layout: z.enum(VALID_LAYOUTS).optional().default('grid'),
    refreshInterval: z.number().int().min(0).max(3600).optional().default(0),
    filters: z.array(filterSchema).max(5).optional().default([]),
    components: z.array(componentSchema).min(1).max(MAX_COMPONENTS)
});

/**
 * Validate a report configuration object
 * @param {Object} config - Report config to validate
 * @returns {{ success: boolean, data?: Object, errors?: Array }} Validation result
 */
function validateReportConfig(config) {
    const result = reportConfigSchema.safeParse(config);

    if (result.success) {
        return { success: true, data: result.data };
    }

    const errors = result.error.issues.map(issue => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
    }));

    return { success: false, errors };
}

module.exports = {
    reportConfigSchema,
    validateReportConfig,
    VALID_COMPONENT_TYPES,
    VALID_FORMATS,
    VALID_LAYOUTS,
    VALID_CF_OPERATORS,
    VALID_CF_STYLES,
    MAX_COMPONENTS
};
