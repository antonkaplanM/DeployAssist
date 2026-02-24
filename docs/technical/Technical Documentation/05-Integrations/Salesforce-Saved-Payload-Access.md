# Salesforce Saved Payload Access

## Summary

**Saved (unsubmitted) payloads created in Salesforce are not accessible through the existing Deploy Assist Salesforce integration.** The integration only reads payload data from **submitted** provisioning requests (PS records). A payload that was saved via "Save" on the Create Payload screen for a deployment (e.g. Deploy-6816) does not create a PS record, so there is no record or field in the data the integration queries that contains that payload.

## How the integration gets payload data

| Aspect | Detail |
|--------|--------|
| **Object** | `Prof_Services_Request__c` (Professional Services Request / Technical Team Request) |
| **Field** | `Payload_Data__c` – raw JSON submitted with the provisioning request |
| **When populated** | When the user clicks **Submit** in Salesforce on the Create Payload screen. Submitting creates the PS record and stores the payload in `Payload_Data__c`. |

All app features that show payload data (Provisioning Monitor, Current Accounts, Staging, Excel Lookup, PS audit, validation, etc.) use this same source: they query `Prof_Services_Request__c` and read `Payload_Data__c`. No other Salesforce object is queried for payload or draft payload data.

## Save vs Submit in Salesforce

| Action | Effect in Salesforce | Visible to integration? |
|--------|----------------------|--------------------------|
| **Save** | Saves the payload on the Create Payload screen for the deployment (e.g. Deploy-6816). No PS record is created. | **No** – the integration does not query Deployment or any draft-payload object. |
| **Submit** | Creates a PS record (`Prof_Services_Request__c`) and stores the payload in `Payload_Data__c`. | **Yes** – the integration reads `Prof_Services_Request__c.Payload_Data__c`. |

So for a deployment where the user has only clicked **Save** (e.g. Deploy-6816 with the entitlements you described), there is no `Prof_Services_Request__c` row for that payload, and therefore **the existing integration cannot return that saved payload**.

## Example: Deploy-6816

If you started and saved a payload for **Deploy-6816** (with Data entitlements like DATA-COD-STN, DATA-COD-PRO, DATA-COD-CORP-FAC and Apps like RI-COD-STN):

- That payload exists in Salesforce on the Create Payload screen for that deployment.
- It is **not** stored in `Prof_Services_Request__c.Payload_Data__c` until the user clicks **Submit**.
- Queries and APIs that use the integration (provisioning search, get by ID, staging, current accounts, etc.) only see **submitted** PS records and their `Payload_Data__c`.
- So **this specific saved payload for Deploy-6816 is not accessible** through the integration today.

## What would be needed to support saved payloads

To expose saved (unsubmitted) payloads through the integration, you would need:

1. **Where Salesforce stores them**  
   Confirm which object and field hold the draft/saved payload for a deployment (e.g. a field on the Deployment record or a related draft object). This is determined by your Salesforce configuration, not by Deploy Assist.

2. **Integration changes**  
   - Add SOQL (and possibly new API routes) to query that object/field by deployment name or ID (e.g. Deploy-6816).  
   - Document the new data source and any limits (e.g. one draft per deployment).

3. **UI/API design**  
   Decide how saved payloads should appear (e.g. a separate “Draft payloads” or “Saved payload by deployment” view vs. only after Submit).

Until the integration is extended in this way, **only submitted payloads** (those that exist on `Prof_Services_Request__c` with `Payload_Data__c` populated) are accessible.

## Flow: Get products from saved payload by deploy record

**Question:** If we create a flow where the user provides the deploy record (e.g. Deploy-6816), is it possible to find what products were saved in the Create Payload form?

**Answer:** **Yes, but only if Salesforce stores that saved payload in a queryable place.** The integration does not currently know where the Create Payload “Save” action writes data; that is determined by your Salesforce configuration.

### When it is possible

| Prerequisite | What’s needed |
|--------------|-------------------------------|
| **Storage location** | The saved payload (or equivalent product list) must be stored in a **field on a Salesforce object** that we can query via SOQL (e.g. a long text/JSON field on the Deployment record, or on a related “draft payload” object). |
| **Deploy identifier** | We can look up by deployment **Name** (e.g. `Deploy-6816`) or by Deployment **Id**. The app already uses `Deployment__c` and `Deployment__r.Name` from `Prof_Services_Request__c`, so the Deployment object exists; we just need its API name and the field that holds the draft payload. |

If those are true, the flow would work as follows:

1. **User input:** User provides the deploy record (e.g. `Deploy-6816` or the Deployment record Id).
2. **Query:** Backend runs SOQL against the object/field where the saved payload is stored (e.g. `SELECT Id, Name, Saved_Payload__c FROM Deployment__c WHERE Name = 'Deploy-6816'` – object and field names are illustrative until confirmed in your org).
3. **Parse:** Parse the stored JSON the same way we parse `Payload_Data__c` (e.g. `properties.provisioningDetail.entitlements` with `modelEntitlements`, `dataEntitlements`, `appEntitlements`).
4. **Return:** Return the products (Models, Data, Apps) in the same shape as for submitted payloads so existing UI or downstream logic can reuse it.

### What you need from Salesforce

To implement this flow, someone with access to your Salesforce org needs to confirm:

1. **Object** where the Create Payload “Save” stores data (e.g. the Deployment object that backs “Deploy-6816”, or a child object like “Payload Draft”).
2. **Field** on that object that holds the saved payload (e.g. `Saved_Payload__c`, `Draft_Payload_Data__c`, or similar). It may be the same JSON structure as `Payload_Data__c`.
3. **How to look up by deploy:** Either by the deployment **Name** (e.g. `Deploy-6816`) or by **Id**, and whether there is a single draft per deployment or multiple.

Once that is documented, we can add a new API (e.g. `GET /api/salesforce/deployment/:deployIdOrName/saved-payload` or a dedicated route under provisioning) and optional UI that accepts a deploy record and returns the products from the saved payload.

### When it is not possible

If the Create Payload form keeps the saved payload only in **session/UI state** or in a store that is **not exposed as a Salesforce object/field** (e.g. not in a custom object or standard object we can query), then we cannot retrieve it via SOQL/API and this flow cannot be built without a change in Salesforce (e.g. a flow or trigger that writes the draft to a custom field when the user clicks Save).

## Create_Payload object and deploy record Id

In Salesforce there is an object **Create_Payload** used by the Create Payload screen. The Lightning URL pattern is:

`https://riskms.lightning.force.com/lightning/n/Create_Payload?c__recordId=<recordId>&c__uid=...`

- **c__recordId** (e.g. `a1B6Q00000apJHBUA2`) — record Id passed to the Create Payload app (often the **Deployment** record Id for that deployment, e.g. Deploy-6816).
- **c__uid** (e.g. `1770832773`) — unique identifier for the saved payload; may be required to identify the draft record in Salesforce.

Provide **both** recordId and uid when available (e.g. copy both from the saved payload URL).

### Can we find the contents if the user provides the deploy record Id (and uid)?

**Yes.** If the user provides the deploy record Id (e.g. the Deployment record Id for Deploy-6816, or the Create_Payload record Id from the URL):

1. **Query by Id**  
   If the Id is the **Create_Payload** record Id, we can query the Create_Payload object directly by Id (e.g. `SELECT ... FROM Create_Payload__c WHERE Id = :recordId`). The exact API name for the object may be `Create_Payload__c` (custom objects use the `__c` suffix in the API).

2. **Query by Deployment lookup**  
   If the Id is the **Deployment** record Id (the deploy-6816 Id), we query the Create_Payload object using the lookup that points to that Deployment (e.g. `WHERE Deployment__c = :deployId` or whatever the lookup field is named). The schema (field names) can be discovered by describing the Create_Payload object in Salesforce.

3. **Payload field**  
   The object likely has a long text/JSON field holding the saved payload (e.g. `Payload_Data__c`, `Saved_Payload__c`, or similar). Once we have the record, we parse that field the same way we parse `Prof_Services_Request__c.Payload_Data__c` and return the products (Models, Data, Apps).

### Exploration script

A script is provided to discover where the saved payload is stored and fetch it using **recordId** and/or **uid** from the Create Payload URL:

- **Script:** `scripts/explore-create-payload.js`
- **Usage:** `node scripts/explore-create-payload.js <recordId> [uid]`
- **Example:** `node scripts/explore-create-payload.js a1B6Q00000apJHBUA2 1770832773`

Use **both** arguments when you have them (e.g. copy `c__recordId` and `c__uid` from the saved payload URL). The script:

1. Tries known object names (e.g. `Create_Payload__c`) with Id, lookup by recordId, and uid-like fields.
2. If those objects don’t exist, runs **discovery**: tries `Deployment__c` by recordId, then searches custom objects for records matching uid and/or recordId (uid-like and reference fields).
3. Prints any record found and any payload-like field (and parsed Models/Data/Apps if JSON).

After a successful run, you’ll know the object and field that hold the saved payload so the integration can be extended (e.g. API to get saved payload by deploy record Id and uid).

## Related documentation

- [Provisioning Payload Viewer](../03-Features/Provisioning-Payload-Viewer.md) – payload data source and viewer behavior
- [Current Accounts](../03-Features/Current-Accounts.md) – use of PS payload for account metadata
- `salesforce.js` – all SOQL queries use `Prof_Services_Request__c`; no queries for Deployment or draft payload objects
- `scripts/explore-create-payload.js` – script to discover Create_Payload object schema and fetch a record by deploy/Create_Payload record Id
