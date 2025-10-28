import os
from datetime import date
from typing import Any

import pandas as pd
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi import WebSocket, WebSocketDisconnect, Query

from data_provider.yfinance_provider import YFinanceProvider
try:
    from data_provider.alpaca_provider import AlpacaProvider  # type: ignore
    ALPACA_AVAILABLE = True
except Exception:
    AlpacaProvider = None  # type: ignore
    ALPACA_AVAILABLE = False
from indicators.indicator_utils import compute_basics
from strategies.crossover import ma_crossover_signals, naive_backtest
from strategies.break_retest import break_retest_signals


def df_to_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    # Ensure simple, JSON-serializable structure: string keys and float/str/None values
    out: list[dict[str, Any]] = []
    safe_df = df.copy()
    safe_df.columns = [str(c) for c in safe_df.columns]
    for ts, row in safe_df.iterrows():
        item: dict[str, Any] = {}
        # timestamp
        try:
            item["time"] = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
        except Exception:
            item["time"] = str(ts)
        # columns
        for col in safe_df.columns:
            key = str(col)
            val = row[col]
            if isinstance(val, pd.Timestamp):
                item[key] = val.isoformat()
            elif pd.isna(val):
                item[key] = None
            else:
                try:
                    item[key] = float(val)
                except Exception:
                    item[key] = str(val)
        out.append(item)
    return out


app = FastAPI(title="Daisy Stock Analysis API")
@app.websocket("/ws/bars")
async def ws_bars(
    ws: WebSocket,
    ticker: str,
    interval: str = "1m",
    strategy: str = "break_retest",
    brk_lookback: int = 20,
    brk_tolerance: float = 0.003,
    brk_confirm: int = 1,
):
    await ws.accept()
    if not 'ALPACA_AVAILABLE' in globals() or not ALPACA_AVAILABLE or AlpacaProvider is None:
        await ws.send_json({"type": "error", "message": "Alpaca provider not available. Install alpaca-py and set ALPACA_API_KEY/ALPACA_SECRET_KEY."})
        await ws.close()
        return
    provider = AlpacaProvider()  # type: ignore
    # 1) send initial snapshot with computed indicators/signals
    df = provider.get_recent_ohlc(ticker, period="2d", interval=interval)
    if not df.empty:
        base = compute_basics(df)
        if strategy == "ma_crossover":
            from strategies.crossover import ma_crossover_signals
            buy_bool, sell_bool = ma_crossover_signals(base, fast_col="MA10", slow_col="MA30")
            out = base.copy()
            out["BRK_BUY"] = buy_bool.astype(int)
            out["BRK_SELL"] = sell_bool.astype(int)
            out["BRK_STATE"] = "neutral"
        else:
            out = break_retest_signals(
                base,
                lookback=brk_lookback,
                price_col="Close",
                tolerance=brk_tolerance,
                confirmation_bars=brk_confirm,
            )
        await ws.send_json({"type": "snapshot", "data": df_to_records(out)})

    # If not minute interval, don't open a live stream to avoid provider WS limits; close after snapshot
    if not interval.endswith("m"):
        await ws.close()
        return

    # 2) stream new bars and send last computed record
    try:
        async for bar in provider.stream_bars(ticker=ticker, interval=interval):
            # append bar to df
            try:
                ts = pd.to_datetime(bar.get("time"))
                row = pd.DataFrame([
                    [bar.get("Open"), bar.get("High"), bar.get("Low"), bar.get("Close"), bar.get("Volume")]
                ], columns=["Open","High","Low","Close","Volume"], index=[ts])
                df = pd.concat([df, row]).sort_index().drop_duplicates()
            except Exception:
                continue
            base = compute_basics(df)
            if strategy == "ma_crossover":
                from strategies.crossover import ma_crossover_signals
                buy_bool, sell_bool = ma_crossover_signals(base, fast_col="MA10", slow_col="MA30")
                out = base.copy()
                out["BRK_BUY"] = buy_bool.astype(int)
                out["BRK_SELL"] = sell_bool.astype(int)
                out["BRK_STATE"] = "neutral"
            else:
                out = break_retest_signals(
                    base,
                    lookback=brk_lookback,
                    price_col="Close",
                    tolerance=brk_tolerance,
                    confirmation_bars=brk_confirm,
                )
            last = df_to_records(out.tail(1))
            if last:
                await ws.send_json({"type": "bar", "data": last[0]})
    except WebSocketDisconnect:
        return
    except Exception as e:
        # Best-effort error report then close (e.g., connection limit exceeded 429)
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
        try:
            await ws.close()
        except Exception:
            pass
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/ohlc")
def get_ohlc(
    ticker: str = Query("TSLA"),
    start: str = Query("2024-01-01"),
    end: str = Query(str(date.today())),
    interval: str = Query("1d"),
    source: str = Query("yfinance"),  # yfinance | alpaca
    strategy: str = Query("break_retest"),  # break_retest | ma_crossover
    brk_lookback: int = Query(20),
    brk_tolerance: float = Query(0.003),
    brk_confirm: int = Query(1),
):
    if source == "alpaca":
        if not 'ALPACA_AVAILABLE' in globals() or not ALPACA_AVAILABLE:
            raise HTTPException(status_code=400, detail="Alpaca provider not available. Please install alpaca-py and set API keys.")
        provider = AlpacaProvider()  # type: ignore
    else:
        provider = YFinanceProvider()
    # If end < start (or empty), fall back to recent mode
    try:
        if end and start and end < start:
            end = str(date.today())
    except Exception:
        pass
    df = provider.get_ohlc(ticker, start=start, end=end, interval=interval)
    if df.empty:
        return {"ticker": ticker, "data": []}
    base = compute_basics(df)

    # Strategy routing
    if strategy == "ma_crossover":
        # Map MA crossover signals to BRK_BUY/BRK_SELL so frontend stays unchanged
        buy_bool, sell_bool = ma_crossover_signals(base, fast_col="MA10", slow_col="MA30")
        out = base.copy()
        out["BRK_BUY"] = buy_bool.astype(int)
        out["BRK_SELL"] = sell_bool.astype(int)
        out["BRK_STATE"] = "neutral"
    else:
        out = break_retest_signals(
            base,
            lookback=brk_lookback,
            price_col="Close",
            tolerance=brk_tolerance,
            confirmation_bars=brk_confirm,
        )
    return {"ticker": ticker, "data": df_to_records(out)}


@app.get("/api/ohlc/recent")
def get_recent(
    ticker: str = Query("TSLA"),
    period: str = Query("2d"),
    interval: str = Query("1m"),
    source: str = Query("yfinance"),  # yfinance | alpaca
    strategy: str = Query("break_retest"),  # break_retest | ma_crossover
    brk_lookback: int = Query(20),
    brk_tolerance: float = Query(0.003),
    brk_confirm: int = Query(1),
):
    if source == "alpaca":
        if not 'ALPACA_AVAILABLE' in globals() or not ALPACA_AVAILABLE:
            raise HTTPException(status_code=400, detail="Alpaca provider not available. Please install alpaca-py and set API keys.")
        provider = AlpacaProvider()  # type: ignore
    else:
        provider = YFinanceProvider()
    df = provider.get_recent_ohlc(ticker, period=period, interval=interval)
    if df.empty:
        return {"ticker": ticker, "data": []}
    base = compute_basics(df)

    if strategy == "ma_crossover":
        buy_bool, sell_bool = ma_crossover_signals(base, fast_col="MA10", slow_col="MA30")
        out = base.copy()
        out["BRK_BUY"] = buy_bool.astype(int)
        out["BRK_SELL"] = sell_bool.astype(int)
        out["BRK_STATE"] = "neutral"
    else:
        out = break_retest_signals(
            base,
            lookback=brk_lookback,
            price_col="Close",
            tolerance=brk_tolerance,
            confirmation_bars=brk_confirm,
        )
    return {"ticker": ticker, "data": df_to_records(out)}


@app.get("/api/backtest")
def backtest(
    ticker: str = Query("TSLA"),
    start: str = Query("2024-01-01"),
    end: str = Query(str(date.today())),
    interval: str = Query("1d"),
    source: str = Query("alpaca"),
    strategy: str = Query("ma_crossover"),
    fee_bp: float = Query(0.0),
    init_capital: float = Query(10000.0),
):
    if strategy != "ma_crossover":
        return {"error": "Only ma_crossover supported for backtest now."}
    if source == "alpaca":
        if not 'ALPACA_AVAILABLE' in globals() or not ALPACA_AVAILABLE:
            raise HTTPException(status_code=400, detail="Alpaca provider not available.")
        provider = AlpacaProvider()  # type: ignore
    else:
        provider = YFinanceProvider()
    df = provider.get_ohlc(ticker, start=start, end=end, interval=interval)
    if df.empty:
        return {"ticker": ticker, "equity": [], "stats": {"final_equity": 1.0, "max_drawdown": 0.0}}
    base = compute_basics(df)
    equity, stats = naive_backtest(base, fast_col="MA10", slow_col="MA30", price_col="Close", fee_bp=fee_bp)
    # Scale equity to initial capital for absolute PnL
    equity_scaled = equity.copy()
    equity_scaled["Equity"] = equity_scaled["Equity"] * float(init_capital)
    final_equity_factor = float(stats.get("final_equity", 1.0))
    final_value = final_equity_factor * float(init_capital)
    profit = final_value - float(init_capital)
    out_stats = {
        **stats,
        "initial_capital": float(init_capital),
        "final_value": float(final_value),
        "profit": float(profit),
        "return_pct": float((final_equity_factor - 1.0) * 100.0),
    }
    return {
        "ticker": ticker,
        "equity": df_to_records(equity_scaled),
        "stats": out_stats,
    }


# --- Serve built frontend (single-port) ---
DIST_DIR = os.path.join(os.path.dirname(__file__), "web", "dist")
if os.path.isdir(DIST_DIR):
    # Serve static files at root
    app.mount("/", StaticFiles(directory=DIST_DIR, html=True), name="static")

    # SPA fallback: non-api paths return index.html
    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        if full_path.startswith("api"):
            # Let /api/* be handled by the API routes
            return {"error": "Not Found"}
        index_path = os.path.join(DIST_DIR, "index.html")
        return FileResponse(index_path)


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)


