# Integration Tests

Integration tests verify that multiple components work together correctly.

## Future Tests

These integration tests should be implemented:

### Trading Loop Integration

Test the complete trading loop with mocked services:

```typescript
test('should execute full trading loop', async () => {
  // Mock Alpaca API
  // Mock DB service
  // Run trading loop
  // Verify signals generated
  // Verify trades executed
  // Verify data logged
});
```

### Strategy Integration

Test strategy with real historical data:

```typescript
test('should detect crossovers in historical data', async () => {
  // Load real historical candles
  // Generate signals
  // Verify expected crossovers detected
});
```

### Portfolio Integration

Test portfolio management with broker:

```typescript
test('should manage positions correctly', async () => {
  // Mock broker responses
  // Execute buy signal
  // Verify position created
  // Execute sell signal
  // Verify position closed
});
```

## Mocking External Services

### Mock Alpaca API

```typescript
// Mock server for Alpaca API
const mockAlpaca = {
  getAccount: () => ({ equity: 100000, cash: 100000 }),
  getPositions: () => [],
  createOrder: (order) => ({ id: 'mock-order', ...order }),
};
```

### Mock DB Service

```typescript
// Mock HTTP server for DB service
const mockDB = {
  '/candles': (req) => ({ success: true, data: [] }),
  '/trades': (req) => ({ success: true, data: { tradeId: 'mock-id' } }),
  '/signals': (req) => ({ success: true, data: { signalId: 'mock-id' } }),
};
```

## Running Integration Tests

```bash
# Run only integration tests
bun test tests/integration/

# Run with real API (paper trading)
INTEGRATION_TEST=true bun test tests/integration/
```

## Notes

Integration tests:
- Take longer to run than unit tests
- May require network access
- Should use paper trading accounts only
- Should clean up created resources
- May be flaky due to external dependencies

Consider:
- Using separate test data
- Implementing test fixtures
- Adding retry logic for network calls
- Cleaning up test trades after execution
