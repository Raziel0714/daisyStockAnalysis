import pandas as pd
import shutil
import subprocess

# --- 内部工具：把列名/列表/单列DataFrame 统一成 Series（数值型） ---
def _to_series(df: pd.DataFrame, col: str | list = "Close") -> pd.Series:
    s = df[col[0]] if isinstance(col, list) else df[col]
    if isinstance(s, pd.DataFrame):  # 避免 out[[col]] 之类返回 DataFrame
        s = s.iloc[:, 0]
    return pd.to_numeric(s, errors="coerce")

def ma(df: pd.DataFrame, period: int, col: str = "Close", out_col: str | None = None) -> pd.DataFrame:
    out = df.copy()
    out_col = out_col or f"MA{period}"
    s = _to_series(out, col)
    out[out_col] = s.rolling(period).mean()
    return out

def ema(df: pd.DataFrame, period: int, col: str = "Close", out_col: str | None = None) -> pd.DataFrame:
    out = df.copy()
    out_col = out_col or f"EMA{period}"
    s = _to_series(out, col)
    out[out_col] = s.ewm(span=period, adjust=False).mean()
    return out

def macd(df: pd.DataFrame, fast: int = 12, slow: int = 26, signal: int = 9, col: str = "Close") -> pd.DataFrame:
    out = df.copy()
    s = _to_series(out, col)
    ema_fast = s.ewm(span=fast, adjust=False).mean()
    ema_slow = s.ewm(span=slow, adjust=False).mean()
    out["MACD"] = ema_fast - ema_slow
    out["MACD_signal"] = out["MACD"].ewm(span=signal, adjust=False).mean()
    out["MACD_hist"] = out["MACD"] - out["MACD_signal"]
    return out

def rsi(df: pd.DataFrame, period: int = 14, col: str = "Close") -> pd.DataFrame:
    out = df.copy()
    s = _to_series(out, col)
    delta = s.diff()
    gain = (delta.where(delta > 0, 0)).rolling(period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(period).mean()
    rs = gain / loss.replace(0, 1e-9)
    out[f"RSI{period}"] = 100 - (100 / (1 + rs))
    return out

def bollinger(df: pd.DataFrame, period: int = 20, stds: float = 2.0, col: str | list = "Close") -> pd.DataFrame:
    out = df.copy()
    s = _to_series(out, col)  # 强制单列 Series

    ma_col = f"BB_MA{period}"
    mid = s.rolling(window=period, min_periods=period).mean()
    std = s.rolling(window=period, min_periods=period).std(ddof=0)

    out[ma_col] = mid
    out["BB_UPPER"] = mid + stds * std
    out["BB_LOWER"] = mid - stds * std
    return out

def add_cross_signals(df: pd.DataFrame, fast_col: str = "MA10", slow_col: str = "MA30") -> pd.DataFrame:
    out = df.copy()
    up = (out[fast_col] > out[slow_col]) & (out[fast_col].shift(1) <= out[slow_col].shift(1))
    dn = (out[fast_col] < out[slow_col]) & (out[fast_col].shift(1) >= out[slow_col].shift(1))
    out["SIG_GOLDEN"] = up.astype(int)
    out["SIG_DEATH"]  = dn.astype(int)
    return out

def compute_basics(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    # 均线
    out = ma(out, 10, col="Close", out_col="MA10")
    out = ma(out, 30, col="Close", out_col="MA30")
    # MACD / RSI
    out = macd(out, col="Close")
    out = rsi(out, 14, col="Close")
    # 布林带
    out = bollinger(out, period=20, stds=2.0, col="Close")
    # 金/死叉标记
    out = add_cross_signals(out, "MA10", "MA30")
    return out


# --- Simple local notifier ---
def notify(title: str, message: str) -> None:
    """
    Best-effort user notification.
    - Always prints to console
    - On macOS, if terminal-notifier exists, send a native notification
    """
    print(f"[ALERT] {title}: {message}")
    try:
        tn = shutil.which("terminal-notifier")
        if tn:
            subprocess.run([
                tn,
                "-title", title,
                "-message", message
            ], check=False)
    except Exception:
        # non-fatal
        pass
