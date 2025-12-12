/**
 * Jira Routes
 * API endpoints for Jira integration
 */

const express = require('express');
const router = express.Router();
const JiraService = require('../services/jira.service');
const logger = require('../utils/logger');

// Initialize Jira service
const jiraService = new JiraService();

/**
 * POST /api/jira/initiatives
 * Fetch Jira initiatives for an assignee
 * Body: { assigneeName: string }
 */
router.post('/initiatives', async (req, res) => {
    try {
        const { assigneeName } = req.body;
        
        if (!assigneeName || assigneeName.trim() === '') {
            logger.warn('No assignee name provided in Jira initiatives request');
            return res.status(400).json({
                error: 'Assignee name is required',
                message: 'Please provide an assignee name to search for initiatives'
            });
        }
        
        logger.info('Jira initiatives API called', { assigneeName });
        
        // Fetch initiatives from Jira API
        const jiraData = await jiraService.fetchInitiatives(assigneeName);
        
        if (jiraData && jiraData.issues && jiraData.issues.length > 0) {
            const response = {
                issues: jiraData.issues,
                total: jiraData.issues.length,
                source: 'DIRECT_ATLASSIAN_API',
                timestamp: new Date().toISOString(),
                assigneeName: assigneeName,
                apiUsed: true,
                cloudId: jiraService.config.cloudId
            };
            
            logger.info('Successfully fetched initiatives from Atlassian API', {
                count: jiraData.issues.length,
                assigneeName
            });
            res.json(response);
        } else {
            // Fallback to demo data if API fails
            logger.warn('Atlassian API failed or returned no data, using fallback', {
                assigneeName,
                reason: jiraData ? jiraData.error : 'API call failed'
            });
            
            const fallbackResponse = {
                issues: jiraService.getFallbackInitiatives(assigneeName),
                total: 3,
                source: 'FALLBACK_DATA',
                timestamp: new Date().toISOString(),
                assigneeName: assigneeName,
                apiUsed: false,
                fallbackReason: jiraData ? jiraData.error || 'API returned no data' : 'API call failed'
            };
            res.json(fallbackResponse);
        }
        
    } catch (error) {
        logger.error('Jira API error', { error: error.message });
        
        // Return fallback data on error
        const errorResponse = {
            issues: jiraService.getFallbackInitiatives(req.body.assigneeName || 'Unknown User'),
            total: 3,
            source: 'ERROR_FALLBACK',
            timestamp: new Date().toISOString(),
            assigneeName: req.body.assigneeName || 'Unknown User',
            error: error.message
        };
        res.json(errorResponse);
    }
});

module.exports = router;








