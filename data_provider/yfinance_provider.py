import pandas as pd
import yfinance as yf
from .base import DataProvider

class YFinanceProvider(DataProvider):
    def _normalize_columns(self, df: pd.DataFrame, ticker: str) -> pd.DataFrame:
        # Flatten MultiIndex columns to simple one-level names used by the app
        if isinstance(df.columns, pd.MultiIndex):
            # Prefer selecting by ticker level if present
            try:
                if ticker in df.columns.get_level_values(-1):
                    df = df.xs(ticker, axis=1, level=-1)
                elif ticker in df.columns.get_level_values(0):
                    df = df.xs(ticker, axis=1, level=0)
            except Exception:
                # Fallback: drop to the first level names
                df.columns = df.columns.get_level_values(0)
        return df
    def get_ohlc(self, ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
        df = yf.download(
            ticker,
            start=start,
            end=end,
            interval=interval,
            progress=False,
            auto_adjust=False,
            group_by="column",
        )
        df = self._normalize_columns(df, ticker)
        return df[['Open','High','Low','Close','Volume']].dropna()

    def get_recent_ohlc(self, ticker: str, period: str = "2d", interval: str = "1m") -> pd.DataFrame:
        """Get recent OHLC by period for intraday polling (e.g., period='2d', interval='1m')."""
        df = yf.download(
            ticker,
            period=period,
            interval=interval,
            progress=False,
            auto_adjust=False,
            group_by="column",
        )
        df = self._normalize_columns(df, ticker)
        return df[['Open','High','Low','Close','Volume']].dropna()
