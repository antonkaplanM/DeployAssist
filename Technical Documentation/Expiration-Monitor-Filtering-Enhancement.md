# Expiration Monitor - Filtering Enhancement

## Overview
Enhanced the Expiration Monitor logic to filter out products that were intentionally removed in subsequent PS records, reducing noise and focusing attention on truly unexpected expirations.

## Problem Statement

### Before Enhancement
The Expiration Monitor would show ALL products expiring within the configured timeframe (e.g., 30 days), even if those products were intentionally removed in a later PS record for the same account.

**Example Scenario:**
- **PS-100** (created Jan 1, 2025) for Account A includes Product X with end date Feb 15, 2025
- **PS-200** (created Jan 20, 2025) for Account A does NOT include Product X
- Today is Feb 1, 2025
- **Issue**: Product X shows as expiring in 14 days, but it was already removed in PS-200

This created unnecessary noise in the expiration monitor, as these are **expected** expirations (product was removed intentionally).

## Solution

### Enhanced Logic
The system now:
1. **Tracks all PS records** for each account with their creation dates
2. **Extracts product codes** from each PS record
3. **For each expiring product**, checks if there's a later PS record (by creation date) for the same account
4. **Filters out** products that are missing from later PS records (expected removal)
5. **Only shows** products that are truly expiring without planned removal

### Implementation Details

**File: `salesforce.js` - `analyzeExpirations()` function**

#### Key Components:

1. **PS Record Tracking Map**
   ```javascript
   const psRecordsByAccount = new Map();
   // Maps: accountId -> [{ id, name, createdDate, productCodes }]
   ```

2. **Product Code Extraction**
   - Extracts all product codes from modelEntitlements, dataEntitlements, and appEntitlements
   - Stores in a Set for efficient lookup

3. **Removal Detection**
   ```javascript
   // Find PS records created after the current one
   const laterRecords = accountPsRecords.filter(pr => 
       pr.createdDate > currentPsRecord.createdDate &&
       !pr.productCodes.has(productCode)
   );
   
   // If product missing from later record = intentional removal
   if (laterRecords.length > 0) {
       wasRemovedInLaterRecord = true;
   }
   ```

4. **Filtering**
   - Only adds expiration to results if `!wasRemovedInLaterRecord`
   - Tracks count of filtered items in `removedInSubsequentRecord` metric

## Results

### Test Metrics (October 6, 2025)
- **Total expirations before filter**: 228
- **Filtered out (removed in later records)**: 48 (21.1%)
- **Remaining active expirations**: 180

### Impact
- **21% reduction** in expiration alerts
- More focused monitoring on truly unexpected expirations
- Reduced alert fatigue for operations team

## API Response

### New Metric
The `/api/expiration/refresh` endpoint now includes:

```json
{
  "success": true,
  "summary": {
    "recordsAnalyzed": 1000,
    "entitlementsProcessed": 22373,
    "expirationsFound": 180,
    "extensionsFound": 136,
    "removedInSubsequentRecord": 48,  // ← NEW
    "lookbackYears": 5,
    "expirationWindow": 30,
    "duration": 2.19
  }
}
```

## Database Impact

### Before Enhancement
```sql
SELECT COUNT(*) FROM expiration_monitor;
-- Result: 228 records
```

### After Enhancement
```sql
SELECT COUNT(*) FROM expiration_monitor;
-- Result: 180 records (48 filtered out)
```

## User Experience

### Expiration Monitor Page
- **Cleaner view**: Only shows products that are truly at risk
- **Better prioritization**: Team can focus on unexpected expirations
- **Reduced noise**: Expected expirations (from intentional removals) are filtered out

### Example Use Cases

#### Use Case 1: Product Downgrade
**Scenario:**
- Customer downgrades from Premium to Standard edition
- Premium products removed in new PS record
- **Result**: Premium product expirations are NOT shown (expected)

#### Use Case 2: Service Cancellation
**Scenario:**
- Customer cancels a specific service
- Service removed in new PS record
- **Result**: Service expiration is NOT shown (expected)

#### Use Case 3: True Expiration
**Scenario:**
- Product is in PS record, expiring in 15 days
- No subsequent PS record removes it
- **Result**: Product IS shown in monitor (needs attention)

## Technical Considerations

### Performance
- Additional processing to build PS record map: ~0.3 seconds
- Efficient Set-based product code lookup: O(1)
- Overall analysis time: ~2.2 seconds (minimal increase)

### Edge Cases Handled
1. **Multiple later records**: If multiple PS records exist after, only needs one without the product
2. **Same-day records**: Uses creation date comparison (later date = removal)
3. **Missing payloads**: Gracefully handles records without payload data
4. **Product code variations**: Handles different product code field names

### Future Enhancements
Potential improvements:
- [ ] Add UI toggle to show/hide filtered expirations
- [ ] Track removal reason (if available in PS record)
- [ ] Generate report of products removed across accounts
- [ ] Alert on patterns of mass removals

## Testing

### Manual Testing
1. Navigate to Expiration Monitor
2. Run "Refresh Analysis"
3. Verify count is lower than before enhancement
4. Check console logs for filtered count

### Automated Testing
```bash
# Run expiration analysis
node test-expiration-filtering.js
```

## Rollback Plan
If issues arise, revert changes in `salesforce.js`:
```bash
git diff HEAD~1 salesforce.js
git checkout HEAD~1 -- salesforce.js
```

## Related Documentation
- [Expiration Monitor Feature](./Expiration-Monitor-Feature.md)
- [Expiration Monitor Implementation](./Expiration-Monitor-Implementation-Summary.md)
- [Database Enhancement Proposal](../Product%20Initiatives/Database%20Enhancement%20Documentation/Database-Enhancement-Proposal.md)

## Changelog
- **2025-10-06**: Enhanced filtering logic implemented
- **2025-10-06**: Tested with production data (48 items filtered)
- **2025-10-06**: Database updated with filtered results

## Conclusion
This enhancement significantly improves the quality of expiration monitoring by filtering out expected expirations, allowing the operations team to focus on products that truly need attention before they expire.

