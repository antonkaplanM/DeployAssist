/**
 * HTTPS Client Utility
 * Provides reusable HTTPS request functionality
 */

const https = require('https');
const logger = require('./logger');

/**
 * Make an HTTPS request
 * @param {String} url - Full URL to request
 * @param {Object} options - Request options
 * @param {String} options.method - HTTP method (GET, POST, etc.)
 * @param {Object} options.headers - Request headers
 * @param {String} options.body - Request body (for POST/PUT)
 * @param {Number} options.timeout - Request timeout in ms (default: 30000)
 * @returns {Promise<Object>} Response object with success, data, statusCode
 */
function makeHttpsRequest(url, options = {}) {
    return new Promise((resolve) => {
        const urlObj = new URL(url);
        
        const requestOptions = {
            hostname: urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            timeout: options.timeout || 30000, // 30 second default timeout
            // Disable SSL certificate validation for corporate environments
            rejectUnauthorized: false
        };
        
        const req = https.request(requestOptions, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        const parsedData = data ? JSON.parse(data) : {};
                        resolve({
                            success: true,
                            data: parsedData,
                            statusCode: res.statusCode
                        });
                    } else {
                        logger.warn('HTTPS request failed', {
                            url: urlObj.hostname + urlObj.pathname,
                            statusCode: res.statusCode,
                            error: data.substring(0, 200)
                        });
                        resolve({
                            success: false,
                            error: `HTTP ${res.statusCode}: ${data}`,
                            statusCode: res.statusCode
                        });
                    }
                } catch (parseError) {
                    logger.error('Failed to parse HTTPS response', {
                        error: parseError.message,
                        url: urlObj.hostname + urlObj.pathname
                    });
                    resolve({
                        success: false,
                        error: `Failed to parse response: ${parseError.message}`,
                        statusCode: res.statusCode
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            logger.error('HTTPS request error', {
                error: error.message,
                url: urlObj.hostname + urlObj.pathname
            });
            resolve({
                success: false,
                error: `Request failed: ${error.message}`
            });
        });
        
        req.on('timeout', () => {
            req.destroy();
            logger.warn('HTTPS request timeout', {
                url: urlObj.hostname + urlObj.pathname,
                timeout: requestOptions.timeout
            });
            resolve({
                success: false,
                error: `Request timeout after ${requestOptions.timeout}ms`
            });
        });
        
        // Write body if provided
        if (options.body) {
            req.write(options.body);
        }
        
        req.end();
    });
}

/**
 * Test web resource connectivity
 * @param {String} url - URL to test
 * @param {Number} timeout - Timeout in ms
 * @returns {Promise<Object>} Result with statusCode and responseTime
 */
function testWebResource(url, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const client = isHttps ? require('https') : require('http');
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'HEAD', // Use HEAD to minimize data transfer
            timeout: timeout,
            headers: {
                'User-Agent': 'DeployAssist/1.0.0'
            }
        };
        
        const req = client.request(options, (res) => {
            const responseTime = Date.now() - startTime;
            resolve({
                statusCode: res.statusCode,
                responseTime: responseTime,
                headers: res.headers
            });
        });
        
        req.on('error', (error) => {
            reject(new Error(`Network error: ${error.message}`));
        });
        
        req.on('timeout', () => {
            req.destroy();
            reject(new Error(`Request timeout after ${timeout}ms`));
        });
        
        req.end();
    });
}

module.exports = {
    makeHttpsRequest,
    testWebResource
};








