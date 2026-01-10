# Trading Bot

A Bun/TypeScript trading bot implementing a moving average crossover strategy. Currently supports stocks via Alpaca API with plans to expand to crypto and forex markets.

## Features

- **Moving Average Crossover Strategy**: Configurable fast/slow MA periods (default 10/50)
- **Alpaca Integration**: Paper and live trading support via Alpaca API
- **External Database**: Clean HTTP client abstraction for database microservice
- **Portfolio Management**: Track positions, balance, and P&L
- **Risk Management**: Configurable position sizing and maximum positions
- **Comprehensive Logging**: Structured logging of signals, trades, and execution
- **Dry Run Mode**: Test strategies without executing real trades
- **Scheduled Execution**: Run on a schedule or on-demand

## Architecture

```
trading-bot/
├── src/
│   ├── index.ts              # Entry point with main trading loop
│   ├── config.ts             # Configuration management
│   │
│   ├── services/
│   │   ├── broker.ts         # Alpaca API wrapper
│   │   ├── marketData.ts     # Market data fetching
│   │   └── dbClient.ts       # Database service HTTP client
│   │
│   ├── strategy/
│   │   ├── indicators.ts     # SMA/EMA calculations
│   │   └── signals.ts        # Signal generation logic
│   │
│   ├── trading/
│   │   ├── executor.ts       # Order execution engine
│   │   └── portfolio.ts      # Portfolio management
│   │
│   ├── types/
│   │   ├── candle.ts         # OHLCV data types
│   │   ├── trade.ts          # Trade execution types
│   │   ├── signal.ts         # Trading signal types
│   │   └── api.ts            # Database API types
│   │
│   └── utils/
│       ├── logger.ts         # Structured logging
│       └── helpers.ts        # Utility functions
```

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- Alpaca account (paper or live)
- Database microservice running (see Database Service section)

## Installation

1. Clone the repository and navigate to the project:

```bash
cd trading-bot
```

2. Install dependencies:

```bash
bun install
```

3. Copy the environment template and configure:

```bash
cp .env.example .env
```

4. Edit `.env` and fill in your credentials:

```env
# Required
APCA_API_KEY=your_alpaca_api_key
APCA_SECRET_KEY=your_alpaca_secret_key
DB_SERVICE_URL=http://localhost:3000/api

# Optional (defaults shown)
APCA_PAPER=true
FAST_MA_PERIOD=10
SLOW_MA_PERIOD=50
TIMEFRAME=1d
SYMBOLS=AAPL,SPY
```

## Configuration

### Alpaca API

- `APCA_API_KEY`: Your Alpaca API key
- `APCA_SECRET_KEY`: Your Alpaca secret key
- `APCA_PAPER`: Set to `true` for paper trading (recommended for testing)
- `APCA_API_BASE_URL`: API base URL (defaults to paper trading endpoint)

### Strategy Parameters

- `FAST_MA_PERIOD`: Fast moving average period (default: 10)
- `SLOW_MA_PERIOD`: Slow moving average period (default: 50)
- `TIMEFRAME`: Candle timeframe - `1d`, `1h`, `5m`, etc. (default: `1d`)
- `SYMBOLS`: Comma-separated list of symbols to trade (default: `AAPL,SPY`)
- `USE_EMA`: Use EMA instead of SMA (default: `false`)
- `MIN_SIGNAL_STRENGTH`: Minimum signal strength 0-1 (default: `0.5`)

### Trading Parameters

- `POSITION_SIZE_PERCENT`: Position size as % of equity (default: `10`)
- `MAX_POSITIONS`: Maximum concurrent positions (default: `5`)
- `DRY_RUN`: Enable dry-run mode without real trades (default: `false`)
- `ACCOUNT_ID`: Account identifier (default: `default`)

### Scheduling

- `EXECUTION_SCHEDULE`: Cron expression (default: `0 16 * * 1-5` = 4 PM weekdays)
- `RUN_ONCE`: Run once and exit instead of scheduling (default: `false`)
- `ENABLE_SCHEDULE`: Enable scheduled execution (default: `true`)

### Logging

- `LOG_LEVEL`: Log level - `debug`, `info`, `warn`, `error` (default: `info`)

## Usage

### Run Once (On-Demand)

Execute the trading loop once and exit:

```bash
RUN_ONCE=true bun run src/index.ts
```

### Run with Scheduling

Start the bot with scheduled execution:

```bash
bun run src/index.ts
```

### Development Mode

Run in dry-run mode with debug logging:

```bash
DRY_RUN=true LOG_LEVEL=debug RUN_ONCE=true bun run src/index.ts
```

### Type Checking

Check TypeScript types without running:

```bash
bun run type-check
```

## Database Service

The bot expects an external database microservice with the following REST endpoints:

### GET /candles

Fetch historical candles.

**Query Parameters:**
- `symbol`: Trading symbol
- `timeframe`: Candle timeframe
- `limit`: Number of candles (optional)
- `start`: Start date (optional)
- `end`: End date (optional)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "timestamp": "2024-01-01T00:00:00Z",
      "open": 150.0,
      "high": 152.0,
      "low": 149.0,
      "close": 151.0,
      "volume": 1000000,
      "timeframe": "1d"
    }
  ]
}
```

### POST /candles

Bulk insert candles for historical storage.

**Request:**
```json
{
  "candles": [...]
}
```

### POST /trades

Log executed trade.

**Request:**
```json
{
  "trade": {
    "id": "...",
    "symbol": "AAPL",
    "side": "buy",
    "quantity": 10,
    "price": 150.0,
    "timestamp": "...",
    ...
  }
}
```

### POST /signals

Log generated trading signal.

**Request:**
```json
{
  "signal": {
    "symbol": "AAPL",
    "type": "buy",
    "timestamp": "...",
    "strategy": "moving_average_crossover",
    ...
  }
}
```

### GET /portfolio/:accountId

Fetch portfolio summary (optional - bot can work without this).

## Strategy: Moving Average Crossover

The bot implements a classic moving average crossover strategy:

### Buy Signal (Bullish Crossover)
- Fast MA crosses **above** slow MA
- Indicates potential upward momentum
- Bot will open a long position if:
  - No existing position in the symbol
  - Haven't reached max position limit
  - Sufficient buying power

### Sell Signal (Bearish Crossover)
- Fast MA crosses **below** slow MA
- Indicates potential downward momentum
- Bot will close existing long position

### Signal Strength

Signal strength is calculated based on the separation between the two moving averages. Signals with strength below `MIN_SIGNAL_STRENGTH` are ignored.

## Trading Flow

1. **Fetch Market Data**: Download historical candles for all symbols
2. **Calculate Indicators**: Compute fast and slow moving averages
3. **Generate Signals**: Detect crossovers and create buy/sell signals
4. **Log Signals**: Store signals in database for analysis
5. **Execute Trades**: Place orders for actionable signals
6. **Log Trades**: Store executed trades in database
7. **Update Portfolio**: Sync portfolio state to database

## Risk Management

- **Position Sizing**: Each position is sized as a percentage of total equity
- **Position Limits**: Maximum number of concurrent positions enforced
- **Buying Power Check**: Ensures sufficient capital before opening positions
- **Signal Strength Filter**: Only executes signals above minimum threshold

## Extending the Bot

### Adding New Indicators

Add calculation functions to `src/strategy/indicators.ts`:

```typescript
export function calculateRSI(values: number[], period: number = 14): number[] {
  // Implementation here
}
```

### Creating New Strategies

Implement signal generation in `src/strategy/signals.ts`:

```typescript
export function generateRSISignal(
  symbol: string,
  candles: NormalizedCandle[],
  config: RSIConfig
): SignalResult | null {
  // Implementation here
}
```

### Supporting New Brokers

Create a new service in `src/services/` implementing the same interface as `broker.ts`.

### Supporting New Asset Classes

Update `marketData.ts` to fetch data from crypto/forex APIs (e.g., Binance, OANDA).

## Troubleshooting

### "Missing required environment variables"

Ensure `.env` file exists and contains all required variables. Copy from `.env.example`.

### "DB Service request failed"

Check that your database microservice is running and accessible at `DB_SERVICE_URL`.

### "Failed to fetch candles"

- Verify Alpaca credentials are correct
- Check symbol is valid and tradable
- Ensure enough historical data exists for the timeframe

### Orders not executing

- Check `DRY_RUN` is not set to `true`
- Verify market is open (or strategy runs after close)
- Check buying power and position limits
- Review logs for specific error messages

## Development

### Project Structure Principles

- **Types First**: All modules use strong TypeScript types
- **Service Layer**: Clean separation between external APIs and business logic
- **Singleton Pattern**: Services use singleton instances for consistency
- **Error Handling**: Comprehensive try-catch with structured logging
- **Extensibility**: Easy to add new strategies, indicators, and brokers

### Adding Dependencies

```bash
bun add package-name
```

### Code Style

- Use TypeScript strict mode
- Prefer async/await over promises
- Log all important actions and errors
- Document public functions with JSDoc comments

## Security

- **Never commit `.env`**: Keep credentials out of version control
- **Use paper trading**: Test thoroughly before using live API
- **Review trades**: Monitor bot activity closely
- **Set position limits**: Prevent excessive exposure
- **Use stop losses**: Consider adding stop-loss logic for risk management

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.

## Disclaimer

This software is for educational purposes. Trading involves risk. Always test with paper trading before using real capital. The authors are not responsible for any financial losses.
