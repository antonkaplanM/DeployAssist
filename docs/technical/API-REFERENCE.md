# 📡 DeployAssist API Reference

**Version:** 2.0  
**Last Updated:** November 11, 2025  
**Base URL:** `http://localhost:5000/api`

---

## 📋 Table of Contents

1. [Authentication](#authentication)
2. [Response Format](#response-format)
3. [Error Codes](#error-codes)
4. [Rate Limiting](#rate-limiting)
5. [Endpoints](#endpoints)
   - [Products](#products)
   - [Bundles](#bundles)
   - [Packages](#packages)
   - [Customer Products](#customer-products)
   - [Expiration Monitoring](#expiration-monitoring)
   - [Provisioning](#provisioning)
   - [Validation](#validation)
   - [PS Audit Trail](#ps-audit-trail)
   - [Jira Integration](#jira-integration)

---

## 🔐 Authentication

Most endpoints require authentication using JWT tokens.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Login

```http
POST /api/auth/login
```

**Request:**
```json
{
    "email": "user@example.com",
    "password": "password123"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "id": 1,
            "email": "user@example.com",
            "role": "admin"
        }
    },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123..."
    }
}
```

---

## 📤 Response Format

### Success Response

All successful responses follow this format:

```json
{
    "success": true,
    "data": { ... },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123..."
    }
}
```

### Paginated Response

```json
{
    "success": true,
    "data": [...],
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123...",
        "page": 1,
        "pageSize": 50,
        "totalPages": 10,
        "totalRecords": 500
    }
}
```

### List Response

```json
{
    "success": true,
    "data": {
        "items": [...],
        "count": 25
    },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123..."
    }
}
```

---

## ⚠️ Error Codes

### Error Response Format

```json
{
    "success": false,
    "error": {
        "message": "Error description",
        "code": "ERROR_CODE",
        "details": { ... }
    },
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123..."
    }
}
```

### HTTP Status Codes

| Status | Code | Description |
|--------|------|-------------|
| 200 | OK | Request successful |
| 201 | CREATED | Resource created |
| 204 | NO_CONTENT | Success, no content |
| 400 | BAD_REQUEST | Invalid request |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | FORBIDDEN | Insufficient permissions |
| 404 | NOT_FOUND | Resource not found |
| 408 | TIMEOUT | Request timeout |
| 409 | CONFLICT | Resource conflict |
| 422 | VALIDATION_ERROR | Validation failed |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Service down |

### Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Input validation failed |
| `BAD_REQUEST` | Malformed request |
| `UNAUTHORIZED` | Authentication required |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `CONFLICT` | Resource already exists |
| `TIMEOUT` | Operation timed out |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Internal server error |
| `DATABASE_ERROR` | Database operation failed |
| `EXTERNAL_API_ERROR` | External API call failed |
| `SERVICE_UNAVAILABLE` | Service temporarily unavailable |
| `FEATURE_DISABLED` | Feature is disabled |

---

## 🔒 Rate Limiting

- **Window:** 15 minutes
- **Limit:** 100 requests per window
- **Headers:**
  - `X-RateLimit-Limit`: Maximum requests
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset timestamp

---

## 📦 Endpoints

### Products

#### Get Products

```http
GET /api/product-catalogue
```

**Query Parameters:**
- `search` (string) - Search term
- `family` (string) - Product family filter
- `group` (string) - Product group filter
- `category` (string) - Category filter
- `region` (string) - Region filter (NAM, EMEA, APAC)
- `isActive` (boolean) - Active status filter
- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50)

**Example:**
```http
GET /api/product-catalogue?search=flood&family=Model&page=1&limit=50
```

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "product_code": "PROD-001",
            "product_name": "Flood Risk Model",
            "family": "Model",
            "group": "Risk Models",
            "category": "Analytics",
            "region": "NAM",
            "is_active": true
        }
    ],
    "meta": {
        "timestamp": "2025-11-11T12:00:00.000Z",
        "requestId": "abc123...",
        "page": 1,
        "pageSize": 50,
        "totalPages": 5,
        "totalRecords": 250
    }
}
```

#### Get Product by ID

```http
GET /api/product-catalogue/:id
```

**Response:**
```json
{
    "success": true,
    "data": {
        "id": 1,
        "product_code": "PROD-001",
        "product_name": "Flood Risk Model",
        "description": "Advanced flood risk modeling",
        "family": "Model",
        "packages": ["Package A", "Package B"]
    },
    "meta": { ... }
}
```

---

### Bundles

#### Get Bundles

```http
GET /api/bundles
```

**Query Parameters:**
- `search` (string) - Search bundle name/description

**Response:**
```json
{
    "success": true,
    "data": {
        "bundles": [
            {
                "bundle_id": 1,
                "bundle_name": "Premium Bundle",
                "description": "Premium product bundle",
                "category": "Enterprise",
                "product_count": 5,
                "is_active": true
            }
        ],
        "count": 1
    },
    "meta": { ... }
}
```

#### Get Bundle with Products

```http
GET /api/bundles/:id
```

**Response:**
```json
{
    "success": true,
    "data": {
        "bundle_id": 1,
        "bundle_name": "Premium Bundle",
        "products": [
            {
                "product_code": "PROD-001",
                "product_name": "Flood Risk Model",
                "quantity": 2,
                "sort_order": 1
            }
        ]
    },
    "meta": { ... }
}
```

#### Create Bundle

```http
POST /api/bundles
```

**Request:**
```json
{
    "bundle_name": "New Bundle",
    "description": "Bundle description",
    "category": "Enterprise",
    "is_active": true
}
```

**Response:** 201 Created
```json
{
    "success": true,
    "data": {
        "bundle_id": 2,
        "bundle_name": "New Bundle",
        ...
    },
    "meta": { ... }
}
```

#### Update Bundle

```http
PUT /api/bundles/:id
```

**Request:**
```json
{
    "bundle_name": "Updated Bundle",
    "description": "Updated description"
}
```

**Response:** 200 OK

#### Delete Bundle

```http
DELETE /api/bundles/:id
```

**Response:** 204 No Content

---

### Packages

#### Get Packages

```http
GET /api/packages
```

**Query Parameters:**
- `type` (string) - Filter by type (base, expansion)
- `includeDeleted` (boolean) - Include deleted packages

**Response:**
```json
{
    "success": true,
    "data": {
        "packages": [
            {
                "package_id": 1,
                "package_name": "Standard Package",
                "salesforce_package_id": "SF-PKG-001",
                "type": "base",
                "is_active": true
            }
        ],
        "count": 1
    },
    "meta": { ... }
}
```

#### Get Package by Name

```http
GET /api/packages/:packageName
```

**Response:**
```json
{
    "success": true,
    "data": {
        "package_id": 1,
        "package_name": "Standard Package",
        "products": [
            {
                "product_code": "PROD-001",
                "product_name": "Flood Risk Model"
            }
        ]
    },
    "meta": { ... }
}
```

---

### Customer Products

#### Get Customer Products

```http
GET /api/customer-products
```

**Query Parameters:**
- `accountName` (string) - Filter by account name
- `region` (string) - Filter by region
- `category` (string) - Filter by product category
- `limit` (number) - Items per page (default: 100)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "account_name": "Acme Corp",
            "region": "NAM",
            "product_code": "PROD-001",
            "product_name": "Flood Risk Model",
            "category": "Model",
            "is_active": true
        }
    ],
    "meta": { ... }
}
```

---

### Expiration Monitoring

#### Get Expiring Entitlements

```http
GET /api/expiration/monitor
```

**Query Parameters:**
- `days` (number) - Days ahead to check (default: 30, max: 90)
- `accountName` (string) - Filter by account
- `productName` (string) - Filter by product
- `region` (string) - Filter by region
- `sortBy` (string) - Sort field (default: expirationDate)

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "account_name": "Acme Corp",
            "product_name": "Flood Risk Model",
            "expiration_date": "2025-12-31",
            "days_until_expiration": 50,
            "region": "NAM",
            "status": "expiring_soon"
        }
    ],
    "meta": { ... }
}
```

#### Get Expiration Statistics

```http
GET /api/expiration/stats
```

**Query Parameters:**
- `days` (number) - Days ahead (default: 30)

**Response:**
```json
{
    "success": true,
    "data": {
        "total_expiring": 50,
        "expired": 10,
        "expiring_this_week": 5,
        "expiring_this_month": 15,
        "expiring_next_month": 20,
        "by_region": {
            "NAM": 30,
            "EMEA": 15,
            "APAC": 5
        }
    },
    "meta": { ... }
}
```

---

### Provisioning

#### Search Provisioning Requests

```http
GET /api/provisioning/search
```

**Query Parameters:**
- `query` (string) - Search term
- `status` (string) - Filter by status
- `page` (number) - Page number
- `limit` (number) - Items per page

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "request_id": "PS-12345",
            "account_name": "Acme Corp",
            "request_type": "New License",
            "status": "pending",
            "created_date": "2025-11-01",
            "product_name": "Flood Risk Model"
        }
    ],
    "meta": { ... }
}
```

#### Get Provisioning Request

```http
GET /api/provisioning/:id
```

**Response:**
```json
{
    "success": true,
    "data": {
        "request_id": "PS-12345",
        "account_name": "Acme Corp",
        "request_type": "New License",
        "status": "pending",
        "products": [...],
        "history": [...]
    },
    "meta": { ... }
}
```

---

### Validation

#### Get Validation Results

```http
GET /api/validation/results
```

**Query Parameters:**
- `recordIds` (string) - Comma-separated record IDs

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "record_id": "PS-12345",
            "validation_status": "passed",
            "errors": [],
            "warnings": [],
            "validated_at": "2025-11-11T12:00:00.000Z"
        }
    ],
    "meta": { ... }
}
```

#### Get Validation Errors

```http
GET /api/validation/errors
```

**Query Parameters:**
- `severity` (string) - Filter by severity (error, warning, info)
- `limit` (number) - Items per page

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "record_id": "PS-12345",
            "error_code": "MISSING_FIELD",
            "error_message": "Product name is missing",
            "severity": "error",
            "field": "product_name"
        }
    ],
    "meta": { ... }
}
```

---

### PS Audit Trail

#### Search PS Records

```http
GET /api/ps-audit/search
```

**Query Parameters:**
- `query` (string) - Search term
- `status` (string) - Filter by status
- `page` (number) - Page number
- `limit` (number) - Items per page

**Response:**
```json
{
    "success": true,
    "data": [
        {
            "ps_record_id": "PS-001",
            "ps_record_name": "Project Alpha",
            "account_name": "Acme Corp",
            "status": "in_progress",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31"
        }
    ],
    "meta": { ... }
}
```

#### Get PS Record

```http
GET /api/ps-audit/:identifier
```

**Response:**
```json
{
    "success": true,
    "data": {
        "ps_record_id": "PS-001",
        "ps_record_name": "Project Alpha",
        "status_history": [...],
        "changes": [...]
    },
    "meta": { ... }
}
```

---

### Jira Integration

#### Get Jira Initiatives

```http
POST /api/jira/initiatives
```

**Request:**
```json
{
    "assigneeName": "John Doe"
}
```

**Response:**
```json
{
    "success": true,
    "data": {
        "issues": [
            {
                "key": "PROJ-123",
                "summary": "Initiative Title",
                "status": "In Progress",
                "assignee": "John Doe",
                "priority": "High"
            }
        ],
        "count": 1
    },
    "meta": { ... }
}
```

---

## 🧪 Testing Endpoints

### Test Salesforce Connection

```http
GET /api/test/salesforce
```

**Response:**
```json
{
    "success": true,
    "data": {
        "connected": true,
        "org_name": "Production Org",
        "username": "api@example.com"
    },
    "meta": { ... }
}
```

### Test Web Connectivity

```http
GET /api/test/web-connectivity
```

**Response:**
```json
{
    "success": true,
    "data": {
        "tests": [
            {
                "service": "Google",
                "url": "https://www.google.com",
                "status": "success",
                "response_time": 150
            }
        ]
    },
    "meta": { ... }
}
```

---

## 📋 Common Query Parameters

### Pagination

- `page` (number) - Page number (default: 1)
- `limit` (number) - Items per page (default: 50, max: 100)

### Sorting

- `sortBy` (string) - Field to sort by
- `sortOrder` (string) - Sort direction (asc, desc)

### Filtering

- `search` (string) - Full-text search
- `isActive` (boolean) - Filter by active status
- `startDate` (string) - Filter by start date (ISO 8601)
- `endDate` (string) - Filter by end date (ISO 8601)

---

## 🔧 Request Examples

### cURL

```bash
# Get products
curl -X GET "http://localhost:5000/api/product-catalogue?search=flood&page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create bundle
curl -X POST "http://localhost:5000/api/bundles" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "bundle_name": "New Bundle",
    "description": "Test bundle"
  }'
```

### JavaScript (Fetch)

```javascript
// Get products
const response = await fetch('http://localhost:5000/api/product-catalogue?page=1', {
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    }
});
const data = await response.json();

// Create bundle
const response = await fetch('http://localhost:5000/api/bundles', {
    method: 'POST',
    headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        bundle_name: 'New Bundle',
        description: 'Test bundle'
    })
});
```

---

**Last Updated:** November 11, 2025  
**API Version:** 2.0  
**Status:** ✅ Complete


