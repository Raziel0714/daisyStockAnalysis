import pandas as pd

def ma_crossover_signals(df: pd.DataFrame, fast_col="MA10", slow_col="MA30"):
    buy = (df[fast_col] > df[slow_col]) & (df[fast_col].shift(1) <= df[slow_col].shift(1))
    sell = (df[fast_col] < df[slow_col]) & (df[fast_col].shift(1) >= df[slow_col].shift(1))
    return buy, sell

def naive_backtest(df: pd.DataFrame, fast_col="MA10", slow_col="MA30", price_col="Close", fee_bp: float = 0.0):
    """简易回测：金叉全仓买入，死叉全仓卖出，持币/持仓切换；fee_bp 为双边费率（基点）"""
    df = df.copy()
    buy, sell = ma_crossover_signals(df, fast_col, slow_col)
    position = 0
    last_price = None
    equity = 1.0
    equity_curve = []

    fee = fee_bp / 10000.0
    for idx, row in df.iterrows():
        price = float(row[price_col])
        # 信号优先级：先卖后买，避免同日反复
        if position == 1 and sell.loc[idx]:
            equity *= (price / last_price) * (1 - fee)
            position = 0
            last_price = None
        if position == 0 and buy.loc[idx]:
            position = 1
            last_price = price * (1 + fee)

        # 持仓中浮动收益
        if position == 1 and last_price is not None:
            eq = equity * (price / last_price)
        else:
            eq = equity
        equity_curve.append((idx, eq))

    ec = pd.DataFrame(equity_curve, columns=["Date","Equity"]).set_index("Date")
    stats = {
        "final_equity": float(ec["Equity"].iloc[-1]) if len(ec) else 1.0,
        "max_drawdown": float((ec["Equity"].cummax() - ec["Equity"]).max() / ec["Equity"].cummax().max()) if len(ec) else 0.0
    }
    return ec, stats
