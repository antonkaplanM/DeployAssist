# Analytics Dashboard - Validation Failure Integration

**Last Updated:** September 30, 2025  
**Related Pages:** Provisioning Monitor, Validation Rules, Analytics Dashboard

## Overview

The Analytics Dashboard's "Technical Team Requests - Last Year" section now displays validation failure counts and rates for each request type. This feature integrates directly with the **Provisioning Monitor's Data Validation Monitor** system to provide consistent, accurate validation metrics.

## How It Works

### 1. Validation Rules Source

The analytics dashboard uses the **same validation rules** as configured in:
- **Page:** Provisioning Monitor → Validation Rules (sub-page)
- **Rules:** Only **enabled** rules are applied
- **Configuration:** Stored in browser localStorage (`deploymentAssistant_validationRules`)

### 2. Validation Process

When you load the Analytics page:

1. **Fetches Last Year's Data** - Queries all PS requests from the past 12 months
2. **Loads Enabled Rules** - Reads your validation rule configuration from localStorage
3. **Validates Each Record** - Runs the same `ValidationEngine.validateRecord()` as the Data Validation Monitor
4. **Groups by Request Type** - Aggregates failures by request type (Update, Provision, etc.)
5. **Displays Results** - Shows count and percentage of failures per type

### 3. Query Consistency

The analytics endpoint uses the **exact same query pattern** as `/api/validation/errors`:
```sql
SELECT Id, Name, Account__c, Account_Site__c, Request_Type_RI__c, 
       Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
FROM Prof_Services_Request__c
WHERE CreatedDate >= [1 year ago]
  AND CreatedDate <= [today]
  AND Name LIKE 'PS-%'
  AND Request_Type_RI__c != null
```

This ensures consistency between:
- Data Validation Monitor (Dashboard tile)
- Provisioning Monitor validation display
- Analytics Dashboard validation counts

## Default Validation Rules

If no custom configuration is found, these default rules are used:

1. **app-quantity-validation** - App Quantity Validation
2. **model-count-validation** - Model Count Validation  
3. **entitlement-date-overlap-validation** - Entitlement Date Overlap Validation

## Syncing with Validation Rules Page

### To Update Which Rules Are Applied:

1. Navigate to **Provisioning Monitor** → **Validation Rules**
2. **Enable/Disable** the rules you want to apply
3. Configuration is automatically saved to localStorage
4. Return to **Analytics** page
5. **Refresh** the page to reload with updated rules

The analytics will now show validation failures based on your updated rule selection.

## Understanding the Display

### Analytics Tile Example

```
┌───────────────────────────────┐
│ Update                        │
│ 1,234              [1234]     │
│ 45.5% of total                │
├───────────────────────────────┤
│ ⚠️ Validation            42   │
│               failed          │
│               (3.4%)          │
└───────────────────────────────┘
```

**Interpretation:**
- **1,234** = Total "Update" requests in the last year
- **42** = Number of "Update" requests that failed at least one validation rule
- **3.4%** = Percentage of "Update" requests with validation failures (42/1234)

### Color Coding

- **Green (✓)** - No validation failures for this request type
- **Red (⚠️)** - One or more validation failures detected

## Technical Details

### API Endpoint

**Endpoint:** `GET /api/analytics/request-types-week`

**Query Parameters:**
- `enabledRules` - JSON array of enabled rule IDs (e.g., `["app-quantity-validation"]`)

**Example:**
```javascript
fetch('/api/analytics/request-types-week?enabledRules=["app-quantity-validation","model-count-validation"]')
```

### Response Format

```json
{
  "success": true,
  "data": [
    {
      "requestType": "Update",
      "count": 1234,
      "validationFailures": 42,
      "validationFailureRate": "3.4",
      "percentage": "45.5"
    }
  ],
  "totalRequests": 2710,
  "totalValidationFailures": 156,
  "enabledRulesCount": 3,
  "period": {
    "startDate": "2024-09-30",
    "endDate": "2025-09-30"
  }
}
```

### Backend Implementation

**File:** `salesforce.js`  
**Function:** `getWeeklyRequestTypeAnalytics(startDate, endDate, enabledRuleIds)`

```javascript
// Process records by request type and validate them
analyticsResult.records.forEach(record => {
    const requestType = record.Request_Type_RI__c;
    
    // Validate using the same logic as /api/validation/errors
    const validationResult = validationEngine.ValidationEngine.validateRecord(record, enabledRules);
    
    if (validationResult.overallStatus === 'FAIL') {
        stats.validationFailures++;
    }
});
```

## Troubleshooting

### Issue: Validation Failures Show as 0 but I Know There Are Failures

**Possible Causes:**

1. **Different Validation Rules Enabled**
   - Analytics uses rules from Validation Rules page
   - Check which rules are enabled in Provisioning Monitor → Validation Rules
   - Ensure the rules you expect are enabled

2. **localStorage Not Synced**
   - Clear browser cache and reload
   - Re-configure validation rules in Validation Rules page
   - Refresh Analytics page

3. **Time Frame Difference**
   - Data Validation Monitor shows configurable time frame (1d, 1w, 1m, 1y)
   - Analytics always shows last 1 year
   - Failures might be outside the current timeframe

4. **Query Filter Differences**
   - Analytics only includes records with `Name LIKE 'PS-%'`
   - Verify failing records match this pattern

### Issue: Different Counts Between Data Validation Monitor and Analytics

**Expected Behavior:** Counts may differ because:
- **Data Validation Monitor** - Shows all failures within selected time frame (e.g., 1 week)
- **Analytics Dashboard** - Shows failures grouped by request type over 1 year
- **Solution** - Set Data Validation Monitor to "1 year" time frame for comparison

### Debugging

Enable console logging to see validation details:

1. Open browser Developer Tools (F12)
2. Go to Console tab
3. Navigate to Analytics page
4. Look for messages like:
   ```
   📋 Analytics using enabled validation rules: app-quantity-validation, model-count-validation
   [ANALYTICS] Record PS-12345 (Update) FAILED validation
   ✅ Analytics data fetched: 6 request types, 2710 total requests, 156 validation failures
   ```

## Best Practices

1. **Keep Rules Consistent**
   - Use the same validation rules across Dashboard and Provisioning Monitor
   - Configure once in Validation Rules page, applies everywhere

2. **Review Regularly**
   - Monitor validation failure rates in Analytics
   - Investigate request types with high failure rates
   - Use Provisioning Monitor to drill into specific failures

3. **Time Frame Awareness**
   - Analytics shows 1-year trend
   - Use Data Validation Monitor for recent failures (1w, 1m)
   - Compare rates over time to track improvement

4. **Rule Management**
   - Only enable rules that are actively monitored
   - Document why each rule is enabled/disabled
   - Review rule effectiveness based on failure patterns

## Related Documentation

- [Validation Rules Documentation](./Validation-Rules-Documentation.md) - Detailed rule descriptions
- [Provisioning Monitor](./Product-Removals-Feature.md) - Main monitoring interface
- [Testing Strategy](./Testing-Strategy.md) - How validation is tested

---

**Questions?** Check the [Troubleshooting Checklist](./Troubleshooting-Checklist.md) or review console logs for debugging information.
