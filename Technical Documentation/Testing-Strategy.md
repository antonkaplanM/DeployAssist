# Testing Strategy

This project uses Jest for unit/integration tests and Playwright for end-to-end UI tests. The goal is to prevent unintended behavior changes by locking down current behavior and surfacing intentional changes explicitly.

## Test Layers

- Unit: validation rules and backend utilities
- Integration (mocked): HTTP endpoints via Supertest, external services mocked with Nock
- E2E: Navigation and critical flows using Playwright

## Commands

```bash
npm test                 # Jest with coverage
npm run test:watch       # Jest watch mode
npm run test:e2e         # Playwright e2e tests
```

## Conventions

- data-testid attributes may be added to stabilize selectors (no behavior change)
- Tests should default to mocked integrations; live tests require explicit opt-in

## CI

Run unit/integration on every PR. E2E can be required or optional. Artifacts: coverage and Playwright reports.

