import argparse, time
from datetime import date
import pandas as pd

from data_provider.yfinance_provider import YFinanceProvider
from indicators.indicator_utils import compute_basics, notify
from strategies.crossover import naive_backtest
from strategies.break_retest import break_retest_signals, last_signal_row

def get_provider(source: str, host: str, port: int, client: int):
    return YFinanceProvider()
    # if source == "yfinance":
    #     return YFinanceProvider()
    # elif source == "ibkr":
    #     return IBKRProvider(host=host, port=port, client_id=client)
    # else:
    #     raise ValueError("unknown source")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["yfinance","ibkr"], default="yfinance")
    ap.add_argument("--ticker", default="AAPL")
    ap.add_argument("--start", default="2024-01-01")
    ap.add_argument("--end",   default=str(date.today()))
    ap.add_argument("--interval", default="1d")
    ap.add_argument("--realtime", action="store_true", help="Enable realtime alert loop")
    ap.add_argument("--rt-interval", default="1m", help="Realtime bar interval for polling")
    ap.add_argument("--rt-period", default="2d", help="Recent period to pull in realtime")
    ap.add_argument("--brk-lookback", type=int, default=20, help="Lookback window for break/retest levels")
    ap.add_argument("--brk-tolerance", type=float, default=0.003, help="Retest tolerance (relative)")
    ap.add_argument("--brk-confirm", type=int, default=1, help="Confirmation bars after retest")
    ap.add_argument("--poll-secs", type=int, default=30, help="Polling seconds for realtime loop")
    ap.add_argument("--ibkr-host", default="127.0.0.1")
    ap.add_argument("--ibkr-port", type=int, default=7497)
    ap.add_argument("--ibkr-client", type=int, default=7)
    args = ap.parse_args()

    provider = get_provider(args.source, args.ibkr_host, args.ibkr_port, args.ibkr_client)

    if args.realtime:
        print(f"Realtime alerts ON for {args.ticker} ({args.rt_interval}, poll {args.poll_secs}s)")
        last_alert_ts = None
        while True:
            try:
                df = provider.get_recent_ohlc(args.ticker, period=args.rt_period, interval=args.rt_interval)
                if df.empty:
                    time.sleep(args.poll_secs)
                    continue
                base = compute_basics(df)
                br = break_retest_signals(
                    base,
                    lookback=args.brk_lookback,
                    price_col="Close",
                    tolerance=args.brk_tolerance,
                    confirmation_bars=args.brk_confirm,
                )
                sig, ts = last_signal_row(br)
                if sig and ts is not None:
                    if last_alert_ts is None or ts > last_alert_ts:
                        notify(
                            title=f"{args.ticker} {sig}",
                            message=f"Break&Retest {sig} at {ts} price {float(br.loc[ts,'Close']):.2f}"
                        )
                        print(f"Signal {sig} at {ts}")
                        last_alert_ts = ts
                time.sleep(args.poll_secs)
            except KeyboardInterrupt:
                print("Stopped.")
                break
            except Exception as e:
                import traceback
                print("Realtime loop error:", e)
                traceback.print_exc()
                time.sleep(args.poll_secs)
        return

    # Historical flow
    df = provider.get_ohlc(args.ticker, start=args.start, end=args.end, interval=args.interval)
    if df.empty:
        raise SystemExit("No data returned.")

    df = compute_basics(df)

    # 简易回测
    ec, stats = naive_backtest(df, fast_col="MA10", slow_col="MA30", price_col="Close", fee_bp=5.0)
    print("Backtest:", stats)

if __name__ == "__main__":
    main()
