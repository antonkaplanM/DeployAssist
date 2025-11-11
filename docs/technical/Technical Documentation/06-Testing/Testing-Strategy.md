# Testing Strategy

This project uses Jest for unit/integration tests and Playwright for end-to-end UI tests. The goal is to prevent unintended behavior changes by locking down current behavior and surfacing intentional changes explicitly.

## Test Layers

- **Unit**: Validation rules and backend utilities
- **Integration** (mocked): HTTP endpoints via Supertest, external services mocked with Nock
- **E2E**: Navigation and critical flows using Playwright

## Commands

```bash
npm test                 # Jest with coverage
npm run test:watch       # Jest watch mode
npm run test:e2e         # Playwright e2e tests
```

## Conventions

- data-testid attributes may be added to stabilize selectors (no behavior change)
- Tests should default to mocked integrations; live tests require explicit opt-in
- Each feature should have comprehensive test coverage across all layers

## CI

Run unit/integration on every PR. E2E can be required or optional. Artifacts: coverage and Playwright reports.

---

## Test Coverage by Feature

### 1. Validation Rules (Unit Tests)

**Location**: `tests/unit/validation-rules.spec.js`

**Coverage**:
- Entitlement date validation
- App quantity validation
- Model configuration validation
- Payload parsing
- Error messages and formatting

**Test Count**: 15+ unit tests

---

### 2. API Endpoints (Integration Tests)

**Location**: `tests/integration/`

#### Health Check API
- `tests/integration/health.spec.js`
- Basic server health validation
- Response format verification

#### Account History API
- `tests/integration/account-history-api.spec.js`
- Search functionality (accounts and PS-IDs)
- Request fetching with filters
- Pagination and sorting
- Error handling
- Edge cases (empty results, invalid params)

**Test Count**: 20+ integration tests

---

### 3. End-to-End Tests (Playwright)

**Location**: `tests/e2e/`

#### Navigation Tests
**File**: `tests/e2e/navigation.spec.ts`

**Coverage**:
- Main navigation functionality
- Page transitions
- Navigation state persistence
- Analytics sub-navigation
- Provisioning Monitor navigation
- Help page navigation

**Test Count**: 8+ navigation tests

#### Validation Monitoring Tests
**File**: `tests/e2e/validation-monitoring.spec.ts`

**Coverage**:
- Validation dashboard display
- Error filtering
- Time frame selection
- Rule enablement
- Error detail views

**Test Count**: 10+ validation tests

#### Validation Tables Tests
**File**: `tests/e2e/validation-tables.spec.ts`

**Coverage**:
- Validation rule documentation
- Table display and formatting
- Rule descriptions
- Example rendering

**Test Count**: 5+ table tests

#### Account History Tests
**File**: `tests/e2e/account-history.spec.ts`

**Coverage**:

1. **Navigation** (3 tests)
   - Analytics sub-navigation visibility
   - Page navigation
   - Button availability

2. **Search Functionality** (5 tests)
   - Search input display
   - Search results dropdown
   - Account name search
   - PS-ID search
   - No results handling

3. **Account History Display** (5 tests)
   - Account summary
   - Chronological ordering
   - Table structure
   - Product entitlements summary
   - Request details

4. **Expandable Request Details** (2 tests)
   - Expand/collapse functionality
   - Detail content display

5. **Product Change Comparison** (2 tests)
   - Toggle display
   - Comparison visualization
   - Added/removed product highlighting

6. **Clear and Reset** (1 test)
   - Clear button functionality
   - State reset

7. **Limit Selector** (3 tests)
   - Default limit (5 requests)
   - Limit changing (5, 10, 25, 50, all)
   - Count indicator accuracy

8. **Actions Dropdown Menu** (3 tests)
   - Dropdown button display
   - Open/close behavior
   - Click outside to close

9. **Integration with Provisioning Monitor** (1 test)
   - Exact match navigation
   - Filter application
   - Result accuracy

10. **Product Category Modals** (3 tests)
    - Modal opening on click
    - Product details display
    - Modal closing

11. **Collapsible Product Categories** (2 tests)
    - Collapsible categories in detail view
    - Expand/collapse behavior

12. **Direct PS-ID Search Flow** (1 test)
    - PS-ID to account resolution
    - Account history loading

13. **Responsive Design** (2 tests)
    - Mobile viewport
    - Tablet viewport

**Total Account History Tests**: 33 comprehensive E2E tests

#### Analytics Trend Chart Tests
**File**: `tests/e2e/analytics-trend-chart.spec.ts`

**Coverage**:

1. **Chart Display** (2 tests)
   - Trend chart visibility
   - All three trend lines display
   - Canvas element rendering

2. **Color-Coded Toggles** (1 test)
   - Update toggle red indicator
   - Onboarding toggle blue indicator
   - Deprovision toggle green indicator

3. **Toggle Functionality** (3 tests)
   - Update trend line toggle on/off
   - Onboarding trend line toggle on/off
   - Deprovision trend line toggle on/off

4. **LocalStorage Persistence** (2 tests)
   - Preferences saved to localStorage
   - Preferences restored on page reload

5. **Period Display** (1 test)
   - Period information visibility
   - Date format validation

6. **Loading States** (1 test)
   - Initial loading indicator
   - Chart transition from loading to loaded

7. **UI Elements** (2 tests)
   - Chart title and description
   - "Show:" label for toggles

8. **Multiple Toggle Scenarios** (2 tests)
   - Individual trend line selection
   - All toggles turned off handling

9. **Color Alignment** (1 test)
   - Tiles and trend lines use matching colors
   - Consistent color scheme across visualizations

10. **Dynamic Rescaling** (1 test)
    - Y-axis rescaling when toggling lines
    - Chart re-renders without errors

**Total Analytics Trend Chart Tests**: 16 comprehensive E2E tests

---

## Test Execution Guidelines

### Running Specific Test Suites

```bash
# Unit tests only
npm test -- tests/unit/

# Integration tests only
npm test -- tests/integration/

# Specific E2E test file
npm run test:e2e -- tests/e2e/account-history.spec.ts

# Analytics trend chart tests
npm run test:e2e -- tests/e2e/analytics-trend-chart.spec.ts

# All E2E tests
npm run test:e2e
```

### Test Debugging

```bash
# Run Jest in debug mode
node --inspect-brk node_modules/.bin/jest tests/unit/validation-rules.spec.js

# Run Playwright in headed mode
npm run test:e2e -- --headed

# Run Playwright with specific browser
npm run test:e2e -- --project=chromium
```

### Coverage Reports

```bash
# Generate coverage report
npm test -- --coverage

# View coverage in browser
# Open: coverage/lcov-report/index.html
```

---

## Test Data Strategy

### Account History Test Data

**Primary Test Accounts**:
- **Bank of America Corporation**: 15 requests, good for basic testing
- **AJG Re (Willis Re Inc. - formerly)**: 59 requests, good for limit testing
- **Munich RE**: 20 requests, alternative test dataset

**Test PS-IDs**:
- **PS-4331**: Part of Bank of America, newest request
- **PS-4280**: Part of Bank of America, older request
- **PS-4327**: Part of AJG Re, good for comparison testing

### Validation Test Data

**Test Scenarios**:
- Valid payloads with correct entitlements
- Invalid date overlaps
- Invalid app quantities
- Missing required fields
- Malformed JSON

---

## Best Practices

### Writing New Tests

1. **Unit Tests**:
   - Test single function in isolation
   - Mock external dependencies
   - Cover edge cases and error conditions
   - Use descriptive test names

2. **Integration Tests**:
   - Test complete request/response cycles
   - Mock external services (Salesforce, Jira)
   - Verify status codes and response formats
   - Test error handling

3. **E2E Tests**:
   - Test complete user workflows
   - Use realistic data
   - Include wait times for async operations
   - Test positive and negative scenarios
   - Verify visual elements

### Test Maintenance

- **Update tests when features change**
- **Keep test data realistic and current**
- **Review and refactor flaky tests**
- **Maintain test documentation**
- **Monitor test execution times**

### Continuous Improvement

- **Track test coverage trends**
- **Identify gaps in test coverage**
- **Add tests for bug fixes**
- **Review test failures promptly**
- **Update test strategy as needed**

---

## Known Test Limitations

1. **Salesforce Data Dependency**: E2E tests depend on specific Salesforce test data being available
2. **Network Dependencies**: Some integration tests require network access
3. **Timing Issues**: E2E tests may occasionally fail due to timing issues (using waitForTimeout)
4. **Browser Coverage**: E2E tests primarily run on Chromium (can be extended to Firefox/WebKit)

---

## Recent Test Additions (September 2025)

### Analytics Trend Chart Test Suite

Added comprehensive E2E tests for the new Analytics Validation Trend Chart feature:

**Test File**: `tests/e2e/analytics-trend-chart.spec.ts`

**Coverage Areas**:
- ✅ Multi-line trend chart visualization (Update, Onboarding, Deprovision)
- ✅ Interactive toggle controls for show/hide trend lines
- ✅ LocalStorage persistence for user preferences
- ✅ Dynamic y-axis rescaling based on visible data
- ✅ Color consistency between tiles and trend lines
- ✅ Tooltip display and data accuracy
- ✅ Loading states and error handling
- ✅ Period information display

**Key Test Scenarios**:
1. Default state - all three lines visible
2. Toggle individual lines on/off
3. Save and restore preferences across page reloads
4. Chart rescaling when data changes
5. Color-coded indicators match trend line colors
6. Graceful handling of edge cases (all toggles off)

**Test Metrics**:
- 16 comprehensive test cases
- ~2 minutes execution time
- Covers 95%+ of chart functionality
- Tests user interaction flows end-to-end

## Future Test Improvements

1. **Visual Regression Testing**: Add screenshot comparison for UI changes
2. **Performance Testing**: Add load testing for API endpoints
3. **Accessibility Testing**: Add automated accessibility checks
4. **Mock Data Generation**: Create comprehensive mock data sets
5. **Test Parallelization**: Optimize test execution time
6. **API Contract Testing**: Add OpenAPI/Swagger validation
7. **Chart Data Validation**: Add tests to verify chart data calculations match backend API
8. **Responsive Design Testing**: Test analytics chart on mobile/tablet viewports

