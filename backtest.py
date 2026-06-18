from __future__ import annotations

import argparse
import json
import logging
import math
from pathlib import Path
from typing import Iterable

import pandas as pd

from calculate_index import (
    BASE_VALUE,
    DEFAULT_COMPONENTS_PATH,
    INDEX_NAME,
    INDEX_TICKER,
    ROOT,
    TRADING_DAYS,
    calculate_index,
    calculate_returns,
    download_prices,
    load_components,
    save_history,
)


DEFAULT_BACKTEST_HISTORY_PATH = ROOT / "backtest_history.csv"
DEFAULT_BACKTEST_SUMMARY_PATH = ROOT / "backtest_summary.json"


def _max_drawdown(values: pd.Series) -> float:
    running_max = values.cummax()
    drawdowns = values / running_max - 1.0
    return float(drawdowns.min())


def _calculate_summary(history: pd.DataFrame) -> dict[str, object]:
    values = pd.to_numeric(history["index_value"], errors="raise")
    dates = pd.to_datetime(history["date"])
    daily_returns = pd.to_numeric(history["daily_return"], errors="coerce").fillna(0.0)
    realized_returns = daily_returns[daily_returns.index != daily_returns.index.min()]

    start_value = float(values.iloc[0])
    end_value = float(values.iloc[-1])
    total_return = end_value / start_value - 1.0

    elapsed_days = max((dates.iloc[-1] - dates.iloc[0]).days, 0)
    elapsed_years = elapsed_days / 365.25 if elapsed_days else 0.0
    cagr = (end_value / start_value) ** (1.0 / elapsed_years) - 1.0 if elapsed_years > 0 else 0.0
    annualized_volatility = (
        float(realized_returns.std(ddof=0)) * math.sqrt(TRADING_DAYS) if len(realized_returns) > 1 else 0.0
    )

    return {
        "name": INDEX_NAME,
        "ticker": INDEX_TICKER,
        "start_date": dates.iloc[0].strftime("%Y-%m-%d"),
        "end_date": dates.iloc[-1].strftime("%Y-%m-%d"),
        "start_value": round(start_value, 6),
        "end_value": round(end_value, 6),
        "total_return": round(total_return, 10),
        "cagr": round(cagr, 10),
        "annualized_volatility": round(annualized_volatility, 10),
        "max_drawdown": round(_max_drawdown(values), 10),
        "observations": int(len(history)),
    }


def run_backtest(args: argparse.Namespace) -> dict[str, object]:
    components = load_components(args.components)
    prices = download_prices(
        components["ticker"].tolist(),
        start=args.start,
        end=args.end,
        retries=args.retries,
        retry_delay=args.retry_delay,
    )
    weights = components.set_index("ticker")["weight"]
    index_returns = calculate_returns(prices, weights=weights, min_components=args.min_components)
    if index_returns.empty:
        raise ValueError("Backtest produced no daily returns. Try a wider date range or lower --min-components.")

    first_price_date = pd.Timestamp(prices.index.min()).strftime("%Y-%m-%d")
    history = calculate_index(index_returns, base_value=BASE_VALUE, base_date=first_price_date)
    save_history(history, args.history)

    summary = _calculate_summary(history)
    summary_path = Path(args.summary)
    summary_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=f"Backtest {INDEX_TICKER}.")
    parser.add_argument("--start", required=True, help="Backtest start date in YYYY-MM-DD format")
    parser.add_argument("--end", default=None, help="Optional backtest end date in YYYY-MM-DD format")
    parser.add_argument("--components", default=str(DEFAULT_COMPONENTS_PATH), help="Path to components.csv")
    parser.add_argument("--history", default=str(DEFAULT_BACKTEST_HISTORY_PATH), help="Output backtest history CSV")
    parser.add_argument("--summary", default=str(DEFAULT_BACKTEST_SUMMARY_PATH), help="Output summary JSON")
    parser.add_argument("--min-components", type=int, default=20, help="Minimum valid component returns per date")
    parser.add_argument("--retries", type=int, default=3, help="yfinance download retry count")
    parser.add_argument("--retry-delay", type=float, default=2.0, help="Seconds between retries")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    logging.basicConfig(level=getattr(logging, args.log_level), format="%(levelname)s: %(message)s")

    try:
        summary = run_backtest(args)
    except Exception as exc:
        logging.exception("Backtest failed: %s", exc)
        return 1

    print(json.dumps(summary, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
