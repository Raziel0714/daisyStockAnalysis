import pandas as pd


def rolling_extrema(df: pd.DataFrame, lookback: int = 20, price_col: str = "Close") -> pd.DataFrame:
    out = df.copy()
    out["HH"] = out[price_col].rolling(window=lookback, min_periods=lookback).max()
    out["LL"] = out[price_col].rolling(window=lookback, min_periods=lookback).min()
    return out


def break_retest_signals(
    df: pd.DataFrame,
    lookback: int = 20,
    price_col: str = "Close",
    tolerance: float = 0.002,
    confirmation_bars: int = 1,
) -> pd.DataFrame:
    """
    Generate break-and-retest signals.

    Logic (long):
    1) Breakout: price closes above recent rolling high HH
    2) Retest: later price pulls back near HH (within tolerance)
    3) Confirmation: closes back up (confirmation_bars bars green above HH)
    -> BUY signal at confirmation close

    Symmetric short logic against rolling low LL -> SELL signal

    Parameters
    - lookback: window for HH/LL
    - tolerance: relative proximity allowed for retest (e.g., 0.002 = 0.2%)
    - confirmation_bars: bars after retest that must close in the breakout direction
    """
    out = rolling_extrema(df, lookback=lookback, price_col=price_col).copy()

    # Ensure Series types (avoid DataFrame-vs-DataFrame alignment issues)
    price = out[price_col]
    if isinstance(price, pd.DataFrame):
        price = price.iloc[:, 0]
    price = pd.to_numeric(price, errors="coerce")

    hh = out["HH"]
    if isinstance(hh, pd.DataFrame):
        hh = hh.iloc[:, 0]
    hh = pd.to_numeric(hh, errors="coerce")

    ll = out["LL"]
    if isinstance(ll, pd.DataFrame):
        ll = ll.iloc[:, 0]
    ll = pd.to_numeric(ll, errors="coerce")

    # Breakout conditions (defensive fillna to avoid alignment/NA issues)
    broke_up = (price > hh).fillna(False)
    broke_dn = (price < ll).fillna(False)

    # Track regimes: after breakout, wait for retest near level
    state = []
    regime = "neutral"  # neutral | wait_retest_up | wait_confirm_up | wait_retest_dn | wait_confirm_dn
    level = None
    bars_after_retest = 0

    buy_signal = []
    sell_signal = []

    for i, idx in enumerate(out.index):
        p = float(price.iloc[i])
        hh_i = float(hh.iloc[i]) if pd.notna(hh.iloc[i]) else None
        ll_i = float(ll.iloc[i]) if pd.notna(ll.iloc[i]) else None

        buy = 0
        sell = 0

        if regime == "neutral":
            if broke_up.iloc[i] and hh_i is not None:
                regime = "wait_retest_up"
                level = hh_i
                bars_after_retest = 0
            elif broke_dn.iloc[i] and ll_i is not None:
                regime = "wait_retest_dn"
                level = ll_i
                bars_after_retest = 0

        elif regime == "wait_retest_up":
            if level is not None and abs(p - level) / level <= tolerance:
                regime = "wait_confirm_up"
                bars_after_retest = 0
            # invalidate if price loses the level materially
            elif level is not None and p < level * (1 - 3 * tolerance):
                regime = "neutral"
                level = None

        elif regime == "wait_confirm_up":
            # confirmation requires closes above level for N bars
            if level is not None and p > level:
                bars_after_retest += 1
                if bars_after_retest >= confirmation_bars:
                    buy = 1
                    regime = "neutral"
                    level = None
                    bars_after_retest = 0
            elif level is not None and p < level * (1 - 2 * tolerance):
                # failed retest
                regime = "neutral"
                level = None
                bars_after_retest = 0

        elif regime == "wait_retest_dn":
            if level is not None and abs(p - level) / level <= tolerance:
                regime = "wait_confirm_dn"
                bars_after_retest = 0
            elif level is not None and p > level * (1 + 3 * tolerance):
                regime = "neutral"
                level = None

        elif regime == "wait_confirm_dn":
            if level is not None and p < level:
                bars_after_retest += 1
                if bars_after_retest >= confirmation_bars:
                    sell = 1
                    regime = "neutral"
                    level = None
                    bars_after_retest = 0
            elif level is not None and p > level * (1 + 2 * tolerance):
                regime = "neutral"
                level = None
                bars_after_retest = 0

        state.append(regime)
        buy_signal.append(buy)
        sell_signal.append(sell)

    out["BRK_BUY"] = pd.Series(buy_signal, index=out.index)
    out["BRK_SELL"] = pd.Series(sell_signal, index=out.index)
    out["BRK_STATE"] = pd.Series(state, index=out.index)
    return out


def last_signal_row(df: pd.DataFrame) -> tuple[str | None, pd.Timestamp | None]:
    if len(df) == 0:
        return None, None
    # Safely extract last numeric flag as a Python scalar to avoid FutureWarning
    def _last_flag(column: str) -> float:
        if column not in df.columns or df[column].empty:
            return 0.0
        s = pd.to_numeric(df[column].tail(1), errors="coerce")
        v = s.iloc[0]
        if pd.isna(v):
            return 0.0
        return float(v)

    last_buy = _last_flag("BRK_BUY")
    last_sell = _last_flag("BRK_SELL")
    if last_buy >= 1.0:
        return "BUY", df.index[-1]
    if last_sell >= 1.0:
        return "SELL", df.index[-1]
    return None, df.index[-1]



