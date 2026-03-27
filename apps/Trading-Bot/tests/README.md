# Trading Bot Tests

Comprehensive test suite for the trading bot using Bun's built-in test runner.

## Running Tests

### Run all tests

```bash
bun test
```

### Run specific test file

```bash
bun test tests/strategy/indicators.test.ts
```

### Run tests in watch mode

```bash
bun test --watch
```

### Run tests with coverage

```bash
bun test --coverage
```

### Run tests matching a pattern

```bash
bun test --test-name-pattern="SMA"
```

## Test Structure

```
tests/
├── setup.ts                          # Test utilities and mock data generators
├── utils/
│   ├── helpers.test.ts              # Tests for utility functions
│   └── logger.test.ts               # Tests for logging
├── strategy/
│   ├── indicators.test.ts           # Tests for technical indicators
│   └── signals.test.ts              # Tests for signal generation
└── README.md                         # This file
```

## Test Categories

### Unit Tests

- **Indicators** (`strategy/indicators.test.ts`)
  - SMA calculation
  - EMA calculation
  - Crossover detection
  - Moving average computation

- **Signals** (`strategy/signals.test.ts`)
  - Signal generation
  - Bullish/bearish crossover detection
  - Signal filtering
  - Strength threshold validation

- **Utilities** (`utils/helpers.test.ts`)
  - Date formatting and parsing
  - Currency and percentage formatting
  - Number rounding
  - List parsing

- **Logger** (`utils/logger.test.ts`)
  - Log level filtering
  - Logging methods
  - Specialized trade/signal logging

### Integration Tests

Integration tests would test the full trading loop with mocked external services (Alpaca, DB service). These can be added in a separate `integration/` directory.

## Test Utilities

The `setup.ts` file provides several utilities for testing:

### Mock Data Generators

```typescript
import {
  generateMockCandles,
  generateMockNormalizedCandles,
  generateCrossoverCandles,
  generateMockSignal,
  generateMockTrade
} from './setup';

// Generate 60 days of candles
const candles = generateMockNormalizedCandles('AAPL', 60, 100, 'up');

// Generate candles that will produce a bullish crossover
const crossoverCandles = generateCrossoverCandles('AAPL', 'bullish');

// Generate a mock buy signal
const signal = generateMockSignal('AAPL', 'buy');
```

### Test Environment Setup

```typescript
import { setupTestEnv, cleanupTestEnv } from './setup';

// Set up environment variables for testing
setupTestEnv();

// Clean up after tests
cleanupTestEnv();
```

### Assertion Helpers

```typescript
import { assertArraysApproxEqual } from './setup';

// Assert two arrays of floats are approximately equal
assertArraysApproxEqual(actual, expected, 0.01);
```

## Writing New Tests

### Basic Test Structure

```typescript
import { describe, test, expect } from 'bun:test';
import { myFunction } from '../../src/module';

describe('MyModule', () => {
  describe('myFunction', () => {
    test('should do something', () => {
      const result = myFunction(input);
      expect(result).toBe(expected);
    });

    test('should handle edge case', () => {
      const result = myFunction(edgeCase);
      expect(result).toBeDefined();
    });
  });
});
```

### Using Mock Data

```typescript
import { generateMockNormalizedCandles } from '../setup';

test('should calculate MA from candles', () => {
  const candles = generateMockNormalizedCandles('AAPL', 50, 100);
  const ma = calculateMA(candles, 10);

  expect(ma.length).toBeGreaterThan(0);
});
```

### Testing Async Functions

```typescript
test('should fetch data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

## Coverage Goals

Aim for:
- **>80%** code coverage overall
- **>90%** coverage for core strategy logic
- **100%** coverage for indicator calculations

Check coverage with:

```bash
bun test --coverage
```

## Best Practices

1. **Test one thing per test** - Each test should verify a single behavior
2. **Use descriptive names** - Test names should clearly state what they test
3. **Arrange-Act-Assert** - Structure tests with setup, execution, and verification
4. **Mock external dependencies** - Don't call real APIs in unit tests
5. **Test edge cases** - Zero values, empty arrays, null, undefined
6. **Keep tests fast** - Unit tests should run in milliseconds
7. **Make tests deterministic** - Same input should always produce same output

## Continuous Integration

Tests should run automatically on:
- Every commit
- Every pull request
- Before deployment

Example GitHub Actions workflow:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
      - run: bun install
      - run: bun test
```

## Debugging Tests

### Run single test with logging

```bash
LOG_LEVEL=debug bun test tests/strategy/signals.test.ts
```

### Use console.log in tests

```typescript
test('debugging test', () => {
  const result = myFunction();
  console.log('Result:', result);
  expect(result).toBeDefined();
});
```

### Use Bun's debugger

```bash
bun --inspect test tests/my.test.ts
```

## Future Test Coverage

Areas that still need tests:

- [ ] Service layer tests (with mocked Alpaca API)
- [ ] Portfolio management tests (with mocked broker)
- [ ] Trade executor tests (with mocked broker and DB)
- [ ] Database client tests (with mocked HTTP responses)
- [ ] Integration tests for full trading loop
- [ ] Configuration validation tests
- [ ] Error handling and retry logic tests

## Questions?

See [Bun Test Documentation](https://bun.sh/docs/cli/test) for more information on Bun's test runner.
