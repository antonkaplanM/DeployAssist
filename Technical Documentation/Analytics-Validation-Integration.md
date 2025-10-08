# Analytics Dashboard - Validation Failure Integration

**Last Updated:** September 30, 2025  
**Related Pages:** Provisioning Monitor, Validation Rules, Analytics Dashboard

## Overview

The Analytics Dashboard provides comprehensive validation failure analytics through two integrated features:

1. **Request Type Tiles** - Shows validation failure counts and rates for each request type over the last year
2. **Validation Trend Chart** - Displays rolling annual validation failure percentages over a 3-month period for Update, Onboarding, and Deprovision request types

Both features integrate directly with the **Provisioning Monitor's Data Validation Monitor** system to provide consistent, accurate validation metrics.

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
SELECT Id, Name, Account__c, Account_Site__c, TenantRequestAction__c, 
       Status__c, CreatedDate, LastModifiedDate, Payload_Data__c
FROM Prof_Services_Request__c
WHERE CreatedDate >= [1 year ago]
  AND CreatedDate <= [today]
  AND Name LIKE 'PS-%'
  AND TenantRequestAction__c != null
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
    const requestType = record.TenantRequestAction__c;
    
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

## Validation Trend Chart

### Overview

The Validation Trend Chart displays rolling annual validation failure percentages for three request types over the last 3 months:
- **🔴 Update** - Red trend line
- **🔵 Onboarding** - Blue trend line  
- **🟢 Deprovision** - Green trend line

### Features

#### 1. Interactive Trend Line Toggles

Users can show/hide individual trend lines using checkboxes:
- Click any checkbox to toggle that request type's trend line
- Changes are saved to localStorage and persist across sessions
- Chart automatically rescales to maximize readability based on visible data

#### 2. Dynamic Y-Axis Scaling

The y-axis automatically adjusts based on the data:
- **Maximum**: Set to 15% above the highest visible data point (minimum 10%)
- **Minimum**: Intelligent scaling - 0% for low values, or 15% below minimum for high values
- **Rescaling**: When you toggle trend lines, the axis recalculates to show only visible data
- **Benefit**: Eliminates wasted space and improves trend visibility

#### 3. Color-Coded Design

Colors are consistent across all analytics visualizations:

| Request Type | Trend Line | Tile Badge | Toggle Indicator |
|--------------|------------|------------|------------------|
| Update | Red `rgb(239, 68, 68)` | `bg-red-100 text-red-800` | Red circle |
| Onboarding | Blue `rgb(59, 130, 246)` | `bg-blue-100 text-blue-800` | Blue circle |
| Deprovision | Green `rgb(16, 185, 129)` | `bg-green-100 text-green-800` | Green circle |

#### 4. Rolling Annual Calculation

Each data point represents a **rolling 1-year validation failure percentage**:
- **X-Axis**: Daily points over last 3 months (sampled every 3 days for clarity)
- **Y-Axis**: Percentage of requests that failed validation in the trailing 12 months
- **Calculation**: For each day, counts all failures in the 365 days ending on that date

**Example:**
- Point on "Sep 30": Shows % of failures from Oct 1, 2024 - Sep 30, 2025
- Point on "Sep 27": Shows % of failures from Sep 28, 2024 - Sep 27, 2025

### Technical Implementation

#### API Endpoint

**Endpoint:** `GET /api/analytics/validation-trend`

**Query Parameters:**
- `enabledRules` - JSON array of enabled rule IDs

**Example:**
```javascript
fetch('/api/analytics/validation-trend?enabledRules=["app-quantity-validation","model-count-validation"]')
```

#### Response Format

```json
{
  "success": true,
  "trendData": [
    {
      "date": "2025-09-30",
      "displayDate": "Sep 30",
      "updateTotal": 1234,
      "updateFailures": 42,
      "updateFailurePercentage": "3.4",
      "onboardingTotal": 156,
      "onboardingFailures": 8,
      "onboardingFailurePercentage": "5.1",
      "deprovisionTotal": 89,
      "deprovisionFailures": 2,
      "deprovisionFailurePercentage": "2.2"
    }
  ],
  "period": {
    "startDate": "2025-06-30",
    "endDate": "2025-09-30"
  }
}
```

#### Backend Function

**File:** `salesforce.js`  
**Function:** `getValidationFailureTrend(startDate, endDate, enabledRuleIds)`

**Process:**
1. Fetches 15 months of data (12 months + 3 months for display)
2. Queries Update, Onboarding, and Deprovision requests
3. Validates each record using enabled rules
4. Groups validated records by request type
5. Calculates rolling annual percentage for each day
6. Returns daily data points with all three request types

### User Preferences

Trend line visibility preferences are stored in localStorage:

**Key:** `validationTrendPreferences`

**Structure:**
```json
{
  "showUpdate": true,
  "showOnboarding": true,
  "showDeprovision": false
}
```

### Tooltips

Hovering over any data point shows:
- **Update**: Annual failure rate and count (e.g., "42 of 1234 failed")
- **Onboarding**: Annual failure rate and count  
- **Deprovision**: Annual failure rate and count

### Troubleshooting

#### Issue: Onboarding/Deprovision Lines Show 0%

**Possible Causes:**
1. No Onboarding/Deprovision requests in the time period
2. All requests passed validation (0 failures = 0%)
3. Validation rules may not apply to these request types

**Solution:**
- Check console logs for data point samples
- Verify requests exist in Salesforce for these types
- Confirm validation rules are appropriate for request type

#### Issue: Chart Doesn't Rescale When Toggling Lines

**Solution:**
- Clear browser cache
- Check console for JavaScript errors
- Verify localStorage is enabled in browser

## Related Documentation

- [Validation Rules Documentation](./Validation-Rules-Documentation.md) - Detailed rule descriptions
- [Provisioning Monitor](./Product-Removals-Feature.md) - Main monitoring interface
- [Testing Strategy](./Testing-Strategy.md) - How validation is tested

---

**Questions?** Check the [Troubleshooting Checklist](./Troubleshooting-Checklist.md) or review console logs for debugging information.
