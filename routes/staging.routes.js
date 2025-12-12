const express = require('express');
const router = express.Router();
const salesforce = require('../salesforce');

/**
 * Staging Routes
 * API endpoints for the experimental Staging page
 * Used for PoC staging area where PS records are reviewed before processing
 */

/**
 * GET /api/staging/random-records
 * Fetch random PS records for staging review
 * Query params:
 *   - count: number of records to fetch (default: 10)
 *   - exclude: comma-separated list of record IDs to exclude
 */
router.get('/random-records', async (req, res) => {
  try {
    const count = parseInt(req.query.count) || 10;
    const excludeIds = req.query.exclude ? req.query.exclude.split(',') : [];
    
    // Get Salesforce connection
    const conn = await salesforce.getConnection();
    
    if (!conn) {
      return res.status(500).json({
        success: false,
        error: 'Salesforce connection not initialized'
      });
    }

    // Query to fetch random PS records
    // Note: Payload_Data__c cannot be filtered in WHERE clause (Long Text field)
    // So we fetch more records and filter server-side
    const fetchCount = count * 10; // Fetch 10x more to ensure we have enough with payload data
    
    let query = `
      SELECT 
        Id,
        Name,
        Account__c,
        Account_Site__c,
        Status__c,
        Deployment__c,
        Deployment__r.Name,
        TenantRequestAction__c,
        Tenant_Name__c,
        Payload_Data__c,
        CreatedDate,
        LastModifiedDate,
        CreatedBy.Name,
        SMLErrorMessage__c
      FROM Prof_Services_Request__c
      WHERE Name LIKE 'PS-%'
      ORDER BY CreatedDate DESC
      LIMIT ${fetchCount}
    `;

    const result = await conn.query(query);
    
    if (!result.records || result.records.length === 0) {
      return res.json({
        success: true,
        records: [],
        totalAvailable: 0
      });
    }

    // Filter for records with payload data (server-side filtering since SOQL can't filter this field)
    // Also filter out excluded records
    let availableRecords = result.records.filter(r => 
      r.Payload_Data__c && 
      r.Payload_Data__c.trim() !== '' && 
      !excludeIds.includes(r.Id)
    );
    
    console.log(`Found ${availableRecords.length} records with payload data (from ${result.records.length} total)`);
    
    // If we don't have enough records, return what we have
    if (availableRecords.length === 0) {
      return res.json({
        success: true,
        records: [],
        totalAvailable: 0,
        message: 'No PS records found with payload data'
      });
    }
    
    // Randomly select the requested count
    const selectedRecords = [];
    const actualCount = Math.min(count, availableRecords.length);
    while (selectedRecords.length < actualCount && availableRecords.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableRecords.length);
      selectedRecords.push(availableRecords[randomIndex]);
      availableRecords.splice(randomIndex, 1);
    }

    // Parse payload for each record
    const processedRecords = selectedRecords.map(record => {
      let parsedPayload = null;
      
      if (record.Payload_Data__c) {
        try {
          const payload = JSON.parse(record.Payload_Data__c);
          const provisioningDetail = payload.properties?.provisioningDetail || payload.Properties?.provisioningDetail;
          const entitlements = provisioningDetail?.entitlements;

          if (entitlements) {
            parsedPayload = {
              models: entitlements.modelEntitlements || [],
              data: entitlements.dataEntitlements || [],
              apps: entitlements.appEntitlements || [],
              tenantName: provisioningDetail.tenantName,
              region: provisioningDetail.region,
              adminUsername: provisioningDetail.adminUsername
            };
          }
        } catch (err) {
          console.error('Error parsing payload for record:', record.Id, err);
        }
      }

      return {
        ...record,
        parsedPayload
      };
    });

    console.log(`Returning ${processedRecords.length} random PS records for staging`);
    
    res.json({
      success: true,
      records: processedRecords,
      totalAvailable: result.totalSize,
      returnedCount: processedRecords.length,
      requestedCount: count,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching random staging records:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch random records',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/staging/record/:id
 * Fetch a single PS record by ID
 */
router.get('/record/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get Salesforce connection
    const conn = await salesforce.getConnection();
    
    if (!conn) {
      return res.status(500).json({
        success: false,
        error: 'Salesforce connection not initialized'
      });
    }

    const query = `
      SELECT 
        Id,
        Name,
        Account__c,
        Account_Site__c,
        Status__c,
        Deployment__c,
        Deployment__r.Name,
        TenantRequestAction__c,
        Tenant_Name__c,
        Payload_Data__c,
        CreatedDate,
        LastModifiedDate,
        CreatedBy.Name,
        SMLErrorMessage__c
      FROM Prof_Services_Request__c
      WHERE Id = '${id}'
      LIMIT 1
    `;

    const result = await conn.query(query);
    
    if (!result.records || result.records.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Record not found'
      });
    }

    const record = result.records[0];
    let parsedPayload = null;
    
    if (record.Payload_Data__c) {
      try {
        const payload = JSON.parse(record.Payload_Data__c);
        const provisioningDetail = payload.properties?.provisioningDetail || payload.Properties?.provisioningDetail;
        const entitlements = provisioningDetail?.entitlements;

        if (entitlements) {
          parsedPayload = {
            models: entitlements.modelEntitlements || [],
            data: entitlements.dataEntitlements || [],
            apps: entitlements.appEntitlements || [],
            tenantName: provisioningDetail.tenantName,
            region: provisioningDetail.region,
            adminUsername: provisioningDetail.adminUsername
          };
        }
      } catch (err) {
        console.error('Error parsing payload for record:', record.Id, err);
      }
    }

    res.json({
      success: true,
      record: {
        ...record,
        parsedPayload
      }
    });

  } catch (error) {
    console.error('Error fetching staging record:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch record'
    });
  }
});

module.exports = router;

