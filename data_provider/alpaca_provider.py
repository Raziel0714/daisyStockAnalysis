import os
import asyncio
import threading
import pandas as pd
from datetime import datetime
from alpaca.data.historical import StockHistoricalDataClient
from alpaca.data.requests import StockBarsRequest
from alpaca.data.live import StockDataStream
from alpaca.data.models.bars import Bar
from alpaca.data.timeframe import TimeFrame, TimeFrameUnit
from .base import DataProvider


def _alpaca_time(s: str) -> datetime:
    return datetime.fromisoformat(s) if isinstance(s, str) else s

def _to_timeframe(interval: str) -> TimeFrame:
    interval = (interval or "").strip().lower()
    if interval.endswith("m"):
        n = int(interval[:-1] or 1)
        return TimeFrame(n, TimeFrameUnit.Minute)
    if interval.endswith("h"):
        n = int(interval[:-1] or 1)
        return TimeFrame(n, TimeFrameUnit.Hour)
    # default day
    if interval.endswith("d"):
        n = int(interval[:-1] or 1)
        if n == 1:
            return TimeFrame.Day
        return TimeFrame(n, TimeFrameUnit.Day)
    # fallback
    return TimeFrame.Day

class AlpacaProvider(DataProvider):
    _STREAM: StockDataStream | None = None
    _STREAM_THREAD: threading.Thread | None = None
    _STREAM_LOCK = threading.Lock()
    _SUBSCRIBERS: set[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = set()
    _ACTIVE_TICKER: str | None = None
    _ACTIVE_INTERVAL: str | None = None
    def __init__(self) -> None:
        api_key = os.getenv("ALPACA_API_KEY")
        secret = os.getenv("ALPACA_SECRET_KEY")
        if not api_key or not secret:
            raise RuntimeError("Missing ALPACA_API_KEY/ALPACA_SECRET_KEY in environment")
        self.hist = StockHistoricalDataClient(api_key, secret)

    def _extract_bars(self, resp, ticker: str) -> list[Bar]:
        """Robustly extract list[Bar] from alpaca-py response for single/multi symbol."""
        try:
            data = getattr(resp, "data", None)
            if isinstance(data, dict):
                if ticker in data and data[ticker] is not None:
                    return list(data[ticker])
                # fallback to any available series
                first = next(iter(data.values()), [])
                return list(first or [])
            if data is not None:
                return list(data)
            # last resort: try to iterate resp
            return list(resp)
        except Exception:
            return []

    def _bars_to_df(self, bars: list[Bar]) -> pd.DataFrame:
        if not bars:
            return pd.DataFrame(columns=["Open","High","Low","Close","Volume"]).astype({
                "Open":"float64","High":"float64","Low":"float64","Close":"float64","Volume":"float64"
            })
        records = []
        for b in bars:
            ts = b.timestamp
            records.append({
                "time": ts,
                "Open": float(b.open),
                "High": float(b.high),
                "Low": float(b.low),
                "Close": float(b.close),
                "Volume": float(b.volume or 0)
            })
        df = pd.DataFrame.from_records(records).set_index("time")
        return df[["Open","High","Low","Close","Volume"]]

    def get_ohlc(self, ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
        req = StockBarsRequest(
            symbol_or_symbols=ticker,
            timeframe=_to_timeframe(interval),
            start=_alpaca_time(start),
            end=_alpaca_time(end) if end else None,
            adjustment=None,
        )
        resp = self.hist.get_stock_bars(req)
        bars = self._extract_bars(resp, ticker)
        return self._bars_to_df(bars)

    def get_recent_ohlc(self, ticker: str, period: str = "2d", interval: str = "1m") -> pd.DataFrame:
        # Alpaca没有yfinance样式period；用近N条作为近似（例如2d*390=~780条）
        lookback = 800 if interval.endswith('m') else 100
        req = StockBarsRequest(symbol_or_symbols=ticker, timeframe=_to_timeframe(interval), limit=lookback)
        resp = self.hist.get_stock_bars(req)
        bars = self._extract_bars(resp, ticker)
        return self._bars_to_df(bars)

    async def stream_bars(self, ticker: str, interval: str = "1m"):
        api_key = os.getenv("ALPACA_API_KEY")
        secret = os.getenv("ALPACA_SECRET_KEY")
        loop = asyncio.get_running_loop()
        q: asyncio.Queue[dict] = asyncio.Queue()

        # register subscriber
        with self.__class__._STREAM_LOCK:
            self.__class__._SUBSCRIBERS.add((loop, q))

            def _ensure_stream_locked():
                # Start or switch the single shared stream
                need_restart = (
                    self.__class__._STREAM is None
                    or self.__class__._ACTIVE_TICKER != ticker
                    or self.__class__._ACTIVE_INTERVAL != interval
                )
                if need_restart:
                    # stop existing
                    try:
                        if self.__class__._STREAM is not None:
                            self.__class__._STREAM.stop()
                    except Exception:
                        pass
                    try:
                        if self.__class__._STREAM_THREAD is not None:
                            self.__class__._STREAM_THREAD.join(timeout=1)
                    except Exception:
                        pass
                    self.__class__._STREAM = None
                    self.__class__._STREAM_THREAD = None

                    stream = StockDataStream(api_key, secret)

                    async def on_bar(bar: Bar):
                        item = {
                            "time": bar.timestamp.isoformat(),
                            "Open": float(bar.open),
                            "High": float(bar.high),
                            "Low": float(bar.low),
                            "Close": float(bar.close),
                            "Volume": float(bar.volume or 0),
                        }
                        # broadcast to all subscribers' loops
                        subs = list(self.__class__._SUBSCRIBERS)
                        for lp, qq in subs:
                            try:
                                lp.call_soon_threadsafe(qq.put_nowait, item)
                            except Exception:
                                pass

                    stream.subscribe_bars(on_bar, ticker)
                    t = threading.Thread(target=stream.run, daemon=True)
                    self.__class__._STREAM = stream
                    self.__class__._STREAM_THREAD = t
                    self.__class__._ACTIVE_TICKER = ticker
                    self.__class__._ACTIVE_INTERVAL = interval
                    t.start()

            _ensure_stream_locked()
        try:
            while True:
                try:
                    item = await q.get()
                except asyncio.CancelledError:
                    break
                yield item
        finally:
            with self.__class__._STREAM_LOCK:
                # unregister subscriber
                try:
                    self.__class__._SUBSCRIBERS.discard((loop, q))
                except Exception:
                    pass
                # if no subscribers, stop shared stream
                if not self.__class__._SUBSCRIBERS:
                    try:
                        if self.__class__._STREAM is not None:
                            self.__class__._STREAM.stop()
                    except Exception:
                        pass
                    try:
                        if self.__class__._STREAM_THREAD is not None:
                            self.__class__._STREAM_THREAD.join(timeout=1)
                    except Exception:
                        pass
                    self.__class__._STREAM = None
                    self.__class__._STREAM_THREAD = None
                    self.__class__._ACTIVE_TICKER = None
                    self.__class__._ACTIVE_INTERVAL = None

