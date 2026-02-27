/**
 * Report Config Schema
 * 
 * Zod validation schema for report configuration JSON.
 * Ensures AI-generated report definitions conform to the expected structure
 * before they are saved to the database.
 */

const { z } = require('zod');
const { isEndpointAllowed } = require('./report-data-catalog');

const VALID_COMPONENT_TYPES = ['kpi-card', 'bar-chart', 'line-chart', 'pie-chart', 'data-table'];
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

const dataSourceSchema = z.object({
    endpoint: z.string().refine(
        (val) => isEndpointAllowed(val),
        { message: 'Endpoint is not in the allowlisted data catalog' }
    ),
    params: z.record(z.union([z.string(), z.number(), z.boolean()])).optional().default({}),
    transform: z.enum(['count', 'sum', 'average', 'first', 'last', 'raw']).optional(),
    linkedParams: z.record(safeId).optional()
});

const filterOptionSchema = z.object({
    value: z.string(),
    label: z.string()
});

const filterSchema = z.object({
    id: safeId,
    type: z.enum(['select', 'date-range', 'text']),
    label: z.string().min(1).max(100).transform(sanitizeString),
    options: z.array(filterOptionSchema).optional(),
    default: z.string().optional(),
    mapsToParam: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/)
});

const columnSchema = z.object({
    field: safeFieldPath,
    header: z.string().min(1).max(100).transform(sanitizeString),
    format: z.enum(VALID_FORMATS).optional(),
    sortable: z.boolean().optional().default(true),
    width: z.string().max(20).optional()
});

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

const componentSchema = z.discriminatedUnion('type', [
    kpiCardSchema,
    barChartSchema,
    lineChartSchema,
    pieChartSchema,
    dataTableSchema
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
