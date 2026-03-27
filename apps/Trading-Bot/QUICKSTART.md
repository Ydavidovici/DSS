# Quick Start Guide

Get the trading bot running in 5 minutes.

## 1. Install Dependencies

```bash
bun install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your Alpaca credentials:

```env
APCA_API_KEY=your_key_here
APCA_SECRET_KEY=your_secret_here
APCA_PAPER=true
DB_SERVICE_URL=http://localhost:3000/api
```

## 3. Test Run (Dry Mode)

Test the bot without executing real trades:

```bash
DRY_RUN=true RUN_ONCE=true bun run src/index.ts
```

## 4. Run Live (Paper Trading)

Execute with paper trading:

```bash
RUN_ONCE=true bun run src/index.ts
```

## What Happens?

1. ✅ Fetches market data for AAPL and SPY
2. ✅ Calculates 10-period and 50-period moving averages
3. ✅ Detects crossover signals
4. ✅ Displays portfolio summary
5. ✅ Executes trades (if signals present)
6. ✅ Logs everything

## Expected Output

```
[INFO] 2024-01-10T16:00:00.000Z Starting trading loop execution
[INFO] 2024-01-10T16:00:00.100Z Market status: CLOSED
[INFO] 2024-01-10T16:00:00.150Z Fetching market data for 2 symbols
[INFO] 2024-01-10T16:00:01.200Z Generated 1 actionable signals
[INFO] 2024-01-10T16:00:01.250Z Signal generated: BUY AAPL @ $150.00

=== Portfolio Summary ===
Account ID: default
Equity: $100,000.00
Cash: $100,000.00
Buying Power: $200,000.00
Total P&L: $0.00 (0.00%)

Positions (0):
  No open positions
========================

[INFO] 2024-01-10T16:00:01.500Z Executing trading signals
[INFO] 2024-01-10T16:00:02.000Z Trade executed: BUY 66 AAPL @ $150.00
[INFO] 2024-01-10T16:00:02.100Z Executed 1 trades
```

## Customize Strategy

Edit `.env` to change strategy parameters:

```env
# Use different MA periods
FAST_MA_PERIOD=20
SLOW_MA_PERIOD=100

# Trade different symbols
SYMBOLS=TSLA,NVDA,MSFT

# Adjust position sizing
POSITION_SIZE_PERCENT=5
MAX_POSITIONS=10
```

## Schedule Daily Execution

Run at 4 PM EST every weekday (after market close):

```bash
bun run src/index.ts
```

The bot will run continuously and execute at the scheduled time.

## Troubleshooting

**Error: "Missing required environment variables"**
- Copy `.env.example` to `.env` and fill in values

**Error: "DB Service request failed"**
- The bot works without a DB service, but you'll see warnings
- Set up the database microservice or ignore the warnings

**No signals generated**
- Normal! Crossovers don't happen every day
- Try backtesting with historical data or different symbols

## Next Steps

- Read [README.md](./README.md) for full documentation
- Review the code in `src/` to understand the implementation
- Implement additional indicators in `src/strategy/indicators.ts`
- Add new strategies in `src/strategy/signals.ts`
- Set up the database microservice for historical tracking

## Safety Tips

✅ **Always start with paper trading** (`APCA_PAPER=true`)
✅ **Use dry run mode first** (`DRY_RUN=true`)
✅ **Start with small position sizes** (`POSITION_SIZE_PERCENT=5`)
✅ **Limit max positions** (`MAX_POSITIONS=3`)
✅ **Monitor the logs closely**
✅ **Test thoroughly before going live**

Happy trading! 🚀
