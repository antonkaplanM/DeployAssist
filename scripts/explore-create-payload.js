/**
 * Explore Create Payload / saved payload in Salesforce
 *
 * Discovers where saved (unsubmitted) payloads are stored using recordId and/or uid
 * from the Create Payload Lightning URL.
 *
 * Salesforce Create Payload URL pattern:
 *   https://riskms.lightning.force.com/lightning/n/Create_Payload?c__recordId=<recordId>&c__uid=<uid>
 * - c__recordId: typically the Deployment record Id (e.g. for Deploy-6816)
 * - c__uid: unique identifier for the saved payload (may be required to find the draft)
 *
 * Usage: node scripts/explore-create-payload.js <recordId> [uid]
 * Example: node scripts/explore-create-payload.js a1B6Q00000apJHBUA2 1770832773
 *
 * Provide both recordId and uid when available (e.g. from a saved payload URL).
 */

require('dotenv').config();
const salesforce = require('../salesforce');

// Possible API names for a Create Payload object (custom objects use __c)
const OBJECT_CANDIDATES = ['Create_Payload__c', 'CreatePayload__c'];

// Keywords to find candidate custom objects for draft/saved payload
const OBJECT_NAME_HINTS = /Payload|Draft|Deployment|Create|Save/i;

// Field names that might hold the saved payload JSON
const PAYLOAD_FIELD_PATTERNS = /Payload|payload|Data__c|Saved_|Draft|JSON|Json/i;

// Field names that might be the uid (numeric or string identifier)
const UID_FIELD_PATTERNS = /Uid|Unique_Id|External_Id|Number|Session|Draft_Id/i;

function isQueryableField(f) {
    if (!f.name || f.type === 'address' || f.type === 'location') return false;
    if (f.type === 'reference' && f.relationshipName) return true;
    return f.updateable !== false || f.createable !== false || f.name === 'Id' || f.name === 'Name';
}

function getQueryableFields(describe) {
    return describe.fields
        .filter(isQueryableField)
        .map(f => f.name)
        .filter(Boolean);
}

function safeJsonParse(str) {
    if (str == null || typeof str !== 'string') return null;
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
}

function extractEntitlements(payload) {
    if (!payload || typeof payload !== 'object') return null;
    const ents = payload.properties?.provisioningDetail?.entitlements || {};
    const models = ents.modelEntitlements || [];
    const data = ents.dataEntitlements || [];
    const apps = ents.appEntitlements || [];
    if (models.length || data.length || apps.length) {
        return { models, data, apps };
    }
    return null;
}

function printRecordAndPayload(record, describe, objectName) {
    const payloadLikeFields = describe.fields.filter(f =>
        f.name && PAYLOAD_FIELD_PATTERNS.test(f.name)
    );
    console.log('Record (raw):');
    console.log(JSON.stringify(record, null, 2));
    for (const f of payloadLikeFields) {
        const val = record[f.name];
        if (val == null) continue;
        console.log('\n--- Parsed payload from', f.name, '---');
        const parsed = safeJsonParse(typeof val === 'string' ? val : JSON.stringify(val));
        if (parsed) {
            const ents = extractEntitlements(parsed);
            if (ents) {
                console.log('Models:', ents.models.length);
                console.log('Data:', ents.data.length);
                console.log('Apps:', ents.apps.length);
            }
            console.log(JSON.stringify(parsed, null, 2).slice(0, 2000) + (JSON.stringify(parsed).length > 2000 ? '...' : ''));
        } else {
            console.log('(not valid JSON or empty)');
        }
    }
}

async function main() {
    const recordIdRaw = process.argv[2];
    const uidRaw = process.argv[3];

    if (!recordIdRaw && !uidRaw) {
        console.error('Usage: node scripts/explore-create-payload.js <recordId> [uid]');
        console.error('  recordId - from URL c__recordId (e.g. Deployment record Id)');
        console.error('  uid      - from URL c__uid (e.g. unique id for the saved payload)');
        console.error('Example: node scripts/explore-create-payload.js a1B6Q00000apJHBUA2 1770832773');
        process.exit(1);
    }

    // recordId: 15 or 18 alphanumeric (Salesforce Id)
    const recordId = recordIdRaw && recordIdRaw.trim();
    if (recordId && !/^[a-zA-Z0-9]{15,18}$/.test(recordId)) {
        console.error('Invalid recordId format (expected 15 or 18 alphanumeric characters).');
        process.exit(1);
    }

    // uid: numeric or alphanumeric (component-specific)
    const uid = uidRaw != null ? String(uidRaw).trim() : null;

    console.log('Connecting to Salesforce...');
    const conn = await salesforce.getConnection();
    console.log('Connected.\n');

    console.log('Input: recordId =', recordId || '(none)', ', uid =', uid ?? '(none)');
    console.log('');

    // --- Phase 1: Try known Create Payload object names ---
    if (recordId || uid) {
        for (const candidate of OBJECT_CANDIDATES) {
            try {
                const describe = await conn.sobject(candidate).describe();
                const fields = getQueryableFields(describe);
                const selectList = fields.join(', ');
                const payloadLike = describe.fields.filter(f => f.name && PAYLOAD_FIELD_PATTERNS.test(f.name));
                const uidLike = describe.fields.filter(f => f.name && UID_FIELD_PATTERNS.test(f.name));

                let record = null;
                if (recordId) {
                    try {
                        const result = await conn.query(`SELECT ${selectList} FROM ${candidate} WHERE Id = '${recordId}' LIMIT 1`);
                        if (result.records && result.records.length > 0) record = result.records[0];
                    } catch (_) {}
                }
                if (!record && recordId) {
                    const lookupFields = describe.fields.filter(f => f.type === 'reference' && f.name && f.name !== 'OwnerId');
                    for (const f of lookupFields) {
                        try {
                            const result = await conn.query(`SELECT ${selectList} FROM ${candidate} WHERE ${f.name} = '${recordId}' LIMIT 1`);
                            if (result.records && result.records.length > 0) {
                                record = result.records[0];
                                console.log('Found by lookup', f.name, '=', recordId);
                                break;
                            }
                        } catch (_) {}
                    }
                }
                if (!record && uid && uidLike.length > 0) {
                    const uidNumeric = /^[0-9]+$/.test(uid);
                    for (const f of uidLike) {
                        try {
                            const soql = uidNumeric
                                ? `SELECT ${selectList} FROM ${candidate} WHERE ${f.name} = ${uid} LIMIT 1`
                                : `SELECT ${selectList} FROM ${candidate} WHERE ${f.name} = '${String(uid).replace(/'/g, "''")}' LIMIT 1`;
                            const result = await conn.query(soql);
                            if (result.records && result.records.length > 0) {
                                record = result.records[0];
                                console.log('Found by uid field', f.name, '=', uid);
                                break;
                            }
                        } catch (_) {}
                    }
                }
                if (record) {
                    console.log('Object:', candidate);
                    printRecordAndPayload(record, describe, candidate);
                    process.exit(0);
                }
            } catch (e) {
                console.log('  ', candidate, ':', e.message);
            }
        }
    }

    // --- Phase 2: Discovery - describeGlobal and try Deployment + custom objects ---
    console.log('Create_Payload object not found. Running discovery (recordId + uid)...\n');

    let globalDescribe;
    try {
        globalDescribe = await conn.describeGlobal();
    } catch (e) {
        console.error('describeGlobal failed:', e.message);
        process.exit(1);
    }

    const sobjects = globalDescribe.sobjects || [];
    const customObjects = sobjects.filter(s => s.name && s.name.endsWith('__c'));
    const deploymentCandidates = customObjects.filter(s =>
        s.name === 'Deployment__c' || OBJECT_NAME_HINTS.test(s.name)
    );

    // 2a) Try Deployment__c by recordId (Id = recordId)
    if (recordId) {
        for (const name of ['Deployment__c', 'Deploy__c']) {
            try {
                const describe = await conn.sobject(name).describe();
                const fields = getQueryableFields(describe);
                const selectList = fields.join(', ');
                const result = await conn.query(`SELECT ${selectList} FROM ${name} WHERE Id = '${recordId}' LIMIT 1`);
                if (result.records && result.records.length > 0) {
                    const record = result.records[0];
                    console.log('--- Deployment record by Id ---');
                    console.log('Object:', name);
                    printRecordAndPayload(record, describe, name);
                    console.log('\n(If the saved payload is not here, it may be in a related object keyed by uid.)');
                    process.exit(0);
                }
            } catch (e) {
                if (e.message && !e.message.includes('does not exist')) console.log('  ', name, ':', e.message);
            }
        }
    }

    // 2b) Search custom objects for one that has a uid-like field and query by uid (and optionally recordId)
    console.log('Searching custom objects for uid / recordId...');
    const toTry = deploymentCandidates.length ? deploymentCandidates : customObjects.slice(0, 80);

    for (const sobject of toTry) {
        const objName = sobject.name;
        if (!objName) continue;
        try {
            const describe = await conn.sobject(objName).describe();
            const fields = getQueryableFields(describe);
            if (fields.length === 0) continue;
            const selectList = fields.join(', ');
            const uidFields = describe.fields.filter(f => f.name && UID_FIELD_PATTERNS.test(f.name));
            const refFields = describe.fields.filter(f => f.type === 'reference' && f.name && f.name !== 'OwnerId');
            const payloadLike = describe.fields.filter(f => f.name && PAYLOAD_FIELD_PATTERNS.test(f.name));

            let record = null;
            let how = '';

            if (uid && uidFields.length > 0) {
                for (const f of uidFields) {
                    try {
                        const isNum = /^[0-9]+$/.test(uid);
                        const soql = isNum && (f.type === 'int' || f.type === 'double' || f.type === 'number')
                            ? `SELECT ${selectList} FROM ${objName} WHERE ${f.name} = ${uid} LIMIT 1`
                            : `SELECT ${selectList} FROM ${objName} WHERE ${f.name} = '${String(uid).replace(/'/g, "''")}' LIMIT 1`;
                        const result = await conn.query(soql);
                        if (result.records && result.records.length > 0) {
                            record = result.records[0];
                            how = `WHERE ${f.name} = ${uid}`;
                            break;
                        }
                    } catch (_) {}
                }
            }
            if (!record && recordId && refFields.length > 0) {
                for (const f of refFields) {
                    try {
                        const result = await conn.query(`SELECT ${selectList} FROM ${objName} WHERE ${f.name} = '${recordId}' LIMIT 1`);
                        if (result.records && result.records.length > 0) {
                            record = result.records[0];
                            how = `WHERE ${f.name} = '${recordId}'`;
                            break;
                        }
                    } catch (_) {}
                }
            }
            if (!record && recordId && uid && uidFields.length > 0 && refFields.length > 0) {
                for (const ref of refFields) {
                    for (const uf of uidFields) {
                        try {
                            const isNum = /^[0-9]+$/.test(uid);
                            const condUid = isNum ? `${uf.name} = ${uid}` : `${uf.name} = '${String(uid).replace(/'/g, "''")}'`;
                            const soql = `SELECT ${selectList} FROM ${objName} WHERE ${ref.name} = '${recordId}' AND ${condUid} LIMIT 1`;
                            const result = await conn.query(soql);
                            if (result.records && result.records.length > 0) {
                                record = result.records[0];
                                how = `WHERE ${ref.name} = recordId AND ${uf.name} = uid`;
                                break;
                            }
                        } catch (_) {}
                    }
                    if (record) break;
                }
            }

            if (record) {
                console.log('\n--- Record found ---');
                console.log('Object:', objName);
                console.log('Query:', how);
                printRecordAndPayload(record, describe, objName);
                process.exit(0);
            }
        } catch (e) {
            // skip objects we can't describe
        }
    }

    console.log('\nNo record found with recordId and/or uid.');
    console.log('Tried: Create_Payload object names, Deployment__c by Id, and custom objects with uid/recordId fields.');
    console.log('If the saved payload is stored elsewhere (e.g. different object/field names), check Setup -> Object Manager.');
}

main();
