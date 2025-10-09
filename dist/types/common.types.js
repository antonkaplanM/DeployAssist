"use strict";
/**
 * Common Type Definitions
 * Shared types used across the application
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = exports.ErrorCode = void 0;
// ===== Error Types =====
var ErrorCode;
(function (ErrorCode) {
    // Authentication Errors (1000-1099)
    ErrorCode[ErrorCode["AUTH_MISSING"] = 1000] = "AUTH_MISSING";
    ErrorCode[ErrorCode["AUTH_INVALID"] = 1001] = "AUTH_INVALID";
    ErrorCode[ErrorCode["AUTH_EXPIRED"] = 1002] = "AUTH_EXPIRED";
    // Validation Errors (1100-1199)
    ErrorCode[ErrorCode["VALIDATION_FAILED"] = 1100] = "VALIDATION_FAILED";
    ErrorCode[ErrorCode["INVALID_INPUT"] = 1101] = "INVALID_INPUT";
    ErrorCode[ErrorCode["MISSING_REQUIRED_FIELD"] = 1102] = "MISSING_REQUIRED_FIELD";
    // Database Errors (1200-1299)
    ErrorCode[ErrorCode["DATABASE_CONNECTION_FAILED"] = 1200] = "DATABASE_CONNECTION_FAILED";
    ErrorCode[ErrorCode["DATABASE_QUERY_FAILED"] = 1201] = "DATABASE_QUERY_FAILED";
    ErrorCode[ErrorCode["DATABASE_TRANSACTION_FAILED"] = 1202] = "DATABASE_TRANSACTION_FAILED";
    // External Service Errors (1300-1399)
    ErrorCode[ErrorCode["SALESFORCE_CONNECTION_FAILED"] = 1300] = "SALESFORCE_CONNECTION_FAILED";
    ErrorCode[ErrorCode["SALESFORCE_QUERY_FAILED"] = 1301] = "SALESFORCE_QUERY_FAILED";
    ErrorCode[ErrorCode["SALESFORCE_AUTH_FAILED"] = 1302] = "SALESFORCE_AUTH_FAILED";
    ErrorCode[ErrorCode["ATLASSIAN_CONNECTION_FAILED"] = 1310] = "ATLASSIAN_CONNECTION_FAILED";
    ErrorCode[ErrorCode["ATLASSIAN_QUERY_FAILED"] = 1311] = "ATLASSIAN_QUERY_FAILED";
    // Business Logic Errors (1400-1499)
    ErrorCode[ErrorCode["RESOURCE_NOT_FOUND"] = 1400] = "RESOURCE_NOT_FOUND";
    ErrorCode[ErrorCode["DUPLICATE_RESOURCE"] = 1401] = "DUPLICATE_RESOURCE";
    ErrorCode[ErrorCode["INVALID_OPERATION"] = 1402] = "INVALID_OPERATION";
    // System Errors (1500-1599)
    ErrorCode[ErrorCode["INTERNAL_ERROR"] = 1500] = "INTERNAL_ERROR";
    ErrorCode[ErrorCode["CONFIGURATION_ERROR"] = 1501] = "CONFIGURATION_ERROR";
    ErrorCode[ErrorCode["TIMEOUT_ERROR"] = 1502] = "TIMEOUT_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
// ===== Logging Types =====
var LogLevel;
(function (LogLevel) {
    LogLevel["ERROR"] = "error";
    LogLevel["WARN"] = "warn";
    LogLevel["INFO"] = "info";
    LogLevel["DEBUG"] = "debug";
    LogLevel["VERBOSE"] = "verbose";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
//# sourceMappingURL=common.types.js.map