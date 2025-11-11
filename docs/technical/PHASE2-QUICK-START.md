# Phase 2 Quick Start Guide

## 🚀 Getting Started with Phase 2

**Prerequisites:** ✅ Phase 1 Complete  
**Duration:** 2-3 weeks  
**Start Date:** Ready to begin

---

## 📋 Quick Overview

Phase 2 focuses on:
1. **Repository Pattern** - Move all SQL to dedicated data access layer
2. **Configuration Management** - Centralize all environment config
3. **Response Standardization** - Ensure consistent API responses
4. **Database Optimization** - Remove duplicate connections

---

## 🎯 Week 1: Repositories

### Day 1-2: Create Core Repositories

**Create these files:**

1. `repositories/base.repository.js` (Base class for all repositories)
```javascript
const db = require('../database');

class BaseRepository {
    constructor(tableName) {
        this.tableName = tableName;
        this.db = db;
    }

    async findById(id) {
        const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
        const result = await this.db.query(query, [id]);
        return result.rows[0] || null;
    }

    async findAll(limit = 100, offset = 0) {
        const query = `SELECT * FROM ${this.tableName} LIMIT $1 OFFSET $2`;
        const result = await this.db.query(query, [limit, offset]);
        return result.rows;
    }

    async count() {
        const query = `SELECT COUNT(*) as total FROM ${this.tableName}`;
        const result = await this.db.query(query);
        return parseInt(result.rows[0].total);
    }
}

module.exports = BaseRepository;
```

2. `repositories/product.repository.js`
3. `repositories/bundle.repository.js`
4. `repositories/package.repository.js`

### Day 3-5: Refactor First Services

**Update these services to use repositories:**
1. `services/product-catalogue.service.js`
2. `services/bundles.service.js`
3. `services/packages.service.js`

**Pattern:**
```javascript
// Before
const result = await db.query('SELECT * FROM products WHERE id = $1', [id]);

// After  
const product = await productRepository.findById(id);
```

---

## 🎯 Week 2: More Repositories + Config

### Day 6-8: Create Remaining Repositories

4. `repositories/customer.repository.js`
5. `repositories/audit.repository.js`
6. `repositories/validation.repository.js`
7. `repositories/expiration.repository.js`
8. `repositories/ghost-account.repository.js`
9. `repositories/analytics.repository.js`

### Day 9-10: Centralize Configuration

**Create config directory:**

```bash
mkdir -p config
```

**Create these files:**

1. `config/environment.js` - All env vars
2. `config/database.js` - DB configuration
3. `config/index.js` - Config aggregator

**Update services to use config:**
```javascript
// Before
const port = process.env.PORT || 5000;

// After
const config = require('../config');
const port = config.port;
```

---

## 🎯 Week 3: Polish & Test

### Day 11-13: Standardize Responses

**Audit all routes for response format:**
```javascript
// Ensure all routes use response helpers
const { success, error } = require('../utils/response');

// Good
return success(res, data);

// Bad
return res.json({ data });
```

### Day 14-15: Database Consistency

**Enhance database.js:**
```javascript
// Add transaction support
async withTransaction(callback) {
    const client = await this.pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
```

### Day 16-18: Testing & Documentation

1. Write unit tests for repositories
2. Update documentation
3. Final testing

---

## 📝 Daily Checklist Template

### Each Day:
- [ ] Start with a clear goal
- [ ] Create/update 1-2 files
- [ ] Test changes locally
- [ ] Commit with clear message
- [ ] Update progress document

### Example Daily Flow:

**Morning:**
- Review yesterday's work
- Choose today's target file
- Read existing code

**Midday:**
- Implement changes
- Write tests
- Run local tests

**Afternoon:**
- Fix issues
- Document changes
- Prepare for next day

---

## 🧪 Testing Strategy

### Unit Tests (Create as you go)

**Example: Product Repository Test**
```javascript
// tests/repositories/product.repository.test.js
const productRepository = require('../../repositories/product.repository');

describe('ProductRepository', () => {
    describe('findById', () => {
        it('should return product when found', async () => {
            const product = await productRepository.findById('test-id');
            expect(product).toBeDefined();
            expect(product.Id).toBe('test-id');
        });

        it('should return null when not found', async () => {
            const product = await productRepository.findById('nonexistent');
            expect(product).toBeNull();
        });
    });
});
```

---

## 📊 Progress Tracking

### Create Progress Document

**File:** `docs/summaries/PHASE2-PROGRESS.md`

```markdown
# Phase 2 Progress Tracker

## Week 1
- [x] Day 1: Created base repository
- [x] Day 2: Created product repository
- [ ] Day 3: Created bundle repository
...

## Blockers
- None

## Next Steps
- Complete bundle repository
```

---

## 🔧 Useful Commands

### During Development

```bash
# Test syntax
node --check <file>

# Run single test
npm test <test-file>

# Check for direct db queries (should be in repositories only)
grep -r "db.query" services/

# Check for hardcoded config (should use config/ modules)
grep -r "process.env" services/
```

---

## 💡 Tips for Success

### 1. Start Small
- Begin with one repository
- Test thoroughly
- Then move to next

### 2. One Service at a Time
- Refactor one service completely
- Test all endpoints
- Then move to next

### 3. Keep Tests Running
- Write tests as you go
- Run tests frequently
- Fix issues immediately

### 4. Document Decisions
- Note why you made choices
- Document patterns used
- Help future you

### 5. Ask for Help
- Review Phase 2 full guide when stuck
- Check existing patterns
- Don't hesitate to research

---

## 🎯 Success Metrics

Track these weekly:

| Metric | Week 1 | Week 2 | Week 3 |
|--------|--------|--------|--------|
| Repositories Created | 3 | 9 | 9 |
| Services Refactored | 3 | 9 | 12 |
| Tests Written | 5 | 15 | 25 |
| Config Centralized | 0% | 50% | 100% |

---

## 📚 Reference Documents

- Full Guide: `PHASE2-IMPLEMENTATION-GUIDE.md`
- Phase 1 Summary: `PHASE1-FINAL-IMPLEMENTATION-SUMMARY.md`
- Refactoring Plan: `REFACTORING-IMPLEMENTATION-PLAN.md`

---

## ⚠️ Common Pitfalls

### 1. Too Much at Once
❌ Don't refactor all services at once  
✅ Do one service completely, test, then move on

### 2. Forgetting Tests
❌ Don't skip writing tests  
✅ Write tests as you create repositories

### 3. Inconsistent Patterns
❌ Don't use different patterns per repository  
✅ Use base repository pattern consistently

### 4. Direct DB Access
❌ Don't leave `db.query` in services  
✅ Move all SQL to repositories

---

## 🚀 Ready to Start?

1. ✅ Read this guide
2. ✅ Review Phase 2 full guide
3. ✅ Create `repositories/` directory
4. ✅ Start with `base.repository.js`
5. ✅ Track progress in `PHASE2-PROGRESS.md`

**Let's build something great! 🎉**

---

**Created:** November 11, 2025  
**Updated:** November 11, 2025  
**Next Review:** After Week 1

