process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '0';

// Provide defaults for Atlassian env vars so mocked tests do not attempt live calls
process.env.ATLASSIAN_EMAIL = process.env.ATLASSIAN_EMAIL || 'test@example.com';
process.env.ATLASSIAN_API_TOKEN = process.env.ATLASSIAN_API_TOKEN || 'test-token';
process.env.ATLASSIAN_SITE_URL = process.env.ATLASSIAN_SITE_URL || 'https://example.atlassian.net';

