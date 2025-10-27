import os
from datetime import date
from typing import Any

import pandas as pd
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from data_provider.yfinance_provider import YFinanceProvider
from indicators.indicator_utils import compute_basics
from strategies.crossover import ma_crossover_signals
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
    strategy: str = Query("break_retest"),  # break_retest | ma_crossover
    brk_lookback: int = Query(20),
    brk_tolerance: float = Query(0.003),
    brk_confirm: int = Query(1),
):
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
    strategy: str = Query("break_retest"),  # break_retest | ma_crossover
    brk_lookback: int = Query(20),
    brk_tolerance: float = Query(0.003),
    brk_confirm: int = Query(1),
):
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


