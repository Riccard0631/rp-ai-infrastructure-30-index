from __future__ import annotations

import argparse
import json
import logging
import time
from pathlib import Path
from typing import Iterable, Mapping, Sequence

import pandas as pd
import yfinance as yf


INDEX_NAME = "RP AI Infrastructure 30 Index"
INDEX_TICKER = "RPAI30"
BASE_VALUE = 1000.0
BASE_DATE = "2026-06-18"
TRADING_DAYS = 252

ROOT = Path(__file__).resolve().parent
DEFAULT_COMPONENTS_PATH = ROOT / "components.csv"
DEFAULT_HISTORY_PATH = ROOT / "history.csv"


def load_components(path: str | Path = DEFAULT_COMPONENTS_PATH) -> pd.DataFrame:
    """Load and validate the component universe."""
    component_path = Path(path)
    if not component_path.exists():
        raise FileNotFoundError(f"Component file not found: {component_path}")

    df = pd.read_csv(component_path)
    df.columns = [column.strip().lower() for column in df.columns]

    required_columns = ["ticker", "name", "sector", "weight"]
    missing = [column for column in required_columns if column not in df.columns]
    if missing:
        raise ValueError(f"Component file is missing columns: {', '.join(missing)}")

    df = df[required_columns].copy()
    df["ticker"] = df["ticker"].astype(str).str.strip().str.upper()
    df["name"] = df["name"].astype(str).str.strip()
    df["sector"] = df["sector"].astype(str).str.strip()
    df["weight"] = pd.to_numeric(df["weight"], errors="raise")

    if df.empty:
        raise ValueError("Component file is empty.")
    if df["ticker"].duplicated().any():
        duplicates = ", ".join(df.loc[df["ticker"].duplicated(), "ticker"])
        raise ValueError(f"Duplicate component tickers found: {duplicates}")
    if df[["ticker", "name", "sector"]].eq("").any().any():
        raise ValueError("Component file contains blank ticker, name, or sector values.")
    if (df["weight"] <= 0).any():
        raise ValueError("All component weights must be positive.")

    weight_sum = float(df["weight"].sum())
    if abs(weight_sum - 1.0) > 0.001:
        raise ValueError(f"Component weights must sum to 1.0. Current sum: {weight_sum:.8f}")

    return df


def _extract_close_prices(raw: pd.DataFrame, tickers: Sequence[str]) -> pd.DataFrame:
    if raw is None or raw.empty:
        raise ValueError("No price data returned from yfinance.")

    if isinstance(raw.columns, pd.MultiIndex):
        level_zero = set(str(value) for value in raw.columns.get_level_values(0))
        if "Close" in level_zero:
            prices = raw["Close"].copy()
        elif "Adj Close" in level_zero:
            prices = raw["Adj Close"].copy()
        else:
            raise ValueError("Downloaded data does not include Close or Adj Close prices.")
    else:
        price_column = None
        for candidate in ("Close", "Adj Close"):
            if candidate in raw.columns:
                price_column = candidate
                break
        if price_column is None:
            raise ValueError("Downloaded data does not include Close or Adj Close prices.")
        prices = raw[[price_column]].copy()
        prices.columns = [tickers[0]]

    if isinstance(prices, pd.Series):
        prices = prices.to_frame(name=tickers[0])

    prices.columns = [str(column).strip().upper() for column in prices.columns]
    requested = [ticker.strip().upper() for ticker in tickers]
    prices = prices.reindex(columns=requested)
    prices = prices.apply(pd.to_numeric, errors="coerce")

    prices.index = pd.to_datetime(prices.index)
    if getattr(prices.index, "tz", None) is not None:
        prices.index = prices.index.tz_convert(None)
    prices.index = prices.index.normalize()

    prices = prices.sort_index()
    prices = prices[~prices.index.duplicated(keep="last")]
    prices = prices.dropna(how="all")

    if prices.empty:
        raise ValueError("Downloaded price data contains no usable close prices.")

    missing = [ticker for ticker in requested if ticker not in prices.columns or prices[ticker].isna().all()]
    if missing:
        logging.warning("No usable prices for: %s", ", ".join(missing))

    return prices


def download_prices(
    tickers: Sequence[str],
    start: str | None = None,
    end: str | None = None,
    *,
    retries: int = 3,
    retry_delay: float = 2.0,
    auto_adjust: bool = False,
) -> pd.DataFrame:
    """Download daily close prices from yfinance with simple retry handling."""
    clean_tickers = [ticker.strip().upper() for ticker in tickers if str(ticker).strip()]
    if not clean_tickers:
        raise ValueError("At least one ticker is required.")

    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            raw = yf.download(
                tickers=clean_tickers,
                start=start,
                end=end,
                auto_adjust=auto_adjust,
                progress=False,
                group_by="column",
                threads=True,
            )
            return _extract_close_prices(raw, clean_tickers)
        except Exception as exc:  # yfinance can raise transport and parsing errors.
            last_error = exc
            logging.warning("Price download attempt %s/%s failed: %s", attempt, retries, exc)
            if attempt < retries:
                time.sleep(retry_delay)

    raise RuntimeError("Unable to download price data after retries.") from last_error


def _weights_for_prices(
    prices: pd.DataFrame,
    weights: Mapping[str, float] | pd.Series | None,
) -> pd.Series:
    if weights is None:
        weight_series = pd.Series(1.0 / len(prices.columns), index=prices.columns, dtype=float)
    else:
        weight_series = pd.Series(weights, dtype=float)
        weight_series.index = [str(index).strip().upper() for index in weight_series.index]
        weight_series = weight_series.reindex(prices.columns).fillna(0.0)

    total_weight = float(weight_series.sum())
    if total_weight <= 0:
        raise ValueError("Weights must have a positive sum.")
    return weight_series / total_weight


def calculate_returns(
    prices: pd.DataFrame,
    weights: Mapping[str, float] | pd.Series | None = None,
    *,
    min_components: int = 20,
) -> pd.Series:
    """Calculate equal-weight daily component returns."""
    if prices.empty:
        raise ValueError("Price frame is empty.")

    clean_prices = prices.sort_index().copy()
    clean_prices = clean_prices.apply(pd.to_numeric, errors="coerce")
    component_returns = clean_prices.pct_change(fill_method=None)

    weight_series = _weights_for_prices(clean_prices, weights)
    valid_counts = component_returns.notna().sum(axis=1)
    available_weight = component_returns.notna().mul(weight_series, axis=1).sum(axis=1)
    weighted_return = component_returns.mul(weight_series, axis=1).sum(axis=1, skipna=True)

    index_returns = weighted_return / available_weight.replace(0, pd.NA)
    index_returns = index_returns[valid_counts >= min_components].dropna()
    index_returns.name = "daily_return"

    if index_returns.empty:
        logging.warning(
            "No index returns could be calculated. Check date range, tickers, and minimum component threshold."
        )
        return index_returns

    low_coverage_days = int((valid_counts < len(clean_prices.columns)).sum())
    if low_coverage_days:
        logging.info("Calculated returns with partial component coverage on %s dates.", low_coverage_days)

    return index_returns


def _normalize_history(history: pd.DataFrame) -> pd.DataFrame:
    required_columns = ["date", "index_value", "daily_return"]
    missing = [column for column in required_columns if column not in history.columns]
    if missing:
        raise ValueError(f"History is missing columns: {', '.join(missing)}")

    normalized = history[required_columns].copy()
    normalized["date"] = pd.to_datetime(normalized["date"]).dt.normalize()
    normalized["index_value"] = pd.to_numeric(normalized["index_value"], errors="raise")
    normalized["daily_return"] = pd.to_numeric(normalized["daily_return"], errors="coerce").fillna(0.0)
    normalized = normalized.dropna(subset=["date", "index_value"])
    normalized = normalized.sort_values("date")
    normalized = normalized.drop_duplicates(subset=["date"], keep="last")
    return normalized


def load_history(path: str | Path = DEFAULT_HISTORY_PATH) -> pd.DataFrame | None:
    history_path = Path(path)
    if not history_path.exists():
        return None
    return _normalize_history(pd.read_csv(history_path))


def calculate_index(
    index_returns: pd.Series,
    *,
    base_value: float = BASE_VALUE,
    base_date: str = BASE_DATE,
    existing_history: pd.DataFrame | None = None,
) -> pd.DataFrame:
    """Update index history using index_today = index_yesterday * (1 + return)."""
    returns = index_returns.copy()
    returns.index = pd.to_datetime(returns.index).normalize()
    returns = returns.sort_index()

    if existing_history is not None and not existing_history.empty:
        history = _normalize_history(existing_history)
        last_date = pd.Timestamp(history.iloc[-1]["date"]).normalize()
        previous_value = float(history.iloc[-1]["index_value"])
    else:
        base_timestamp = pd.Timestamp(base_date).normalize()
        history = pd.DataFrame(
            [
                {
                    "date": base_timestamp,
                    "index_value": float(base_value),
                    "daily_return": 0.0,
                }
            ]
        )
        last_date = base_timestamp
        previous_value = float(base_value)

    if returns.empty:
        return _normalize_history(history)

    records: list[dict[str, object]] = []
    for date, daily_return in returns.items():
        calculation_date = pd.Timestamp(date).normalize()
        if calculation_date <= last_date or pd.isna(daily_return):
            continue
        previous_value = previous_value * (1.0 + float(daily_return))
        records.append(
            {
                "date": calculation_date,
                "index_value": previous_value,
                "daily_return": float(daily_return),
            }
        )

    if records:
        history = pd.concat([history, pd.DataFrame(records)], ignore_index=True)

    return _normalize_history(history)


def save_history(history: pd.DataFrame, path: str | Path = DEFAULT_HISTORY_PATH) -> Path:
    """Save index history to CSV."""
    history_path = Path(path)
    history_path.parent.mkdir(parents=True, exist_ok=True)

    clean_history = _normalize_history(history)
    output = clean_history.copy()
    output["date"] = output["date"].dt.strftime("%Y-%m-%d")
    output.to_csv(history_path, index=False, float_format="%.10f")
    return history_path


def _history_download_start(existing_history: pd.DataFrame | None, explicit_start: str | None) -> str:
    if explicit_start:
        return explicit_start
    if existing_history is None or existing_history.empty:
        return BASE_DATE
    last_date = pd.Timestamp(existing_history.iloc[-1]["date"]).normalize()
    return (last_date - pd.Timedelta(days=7)).strftime("%Y-%m-%d")


def run_update(args: argparse.Namespace) -> dict[str, object]:
    components = load_components(args.components)
    existing_history = load_history(args.history)
    start = _history_download_start(existing_history, args.start)

    prices = download_prices(
        components["ticker"].tolist(),
        start=start,
        end=args.end,
        retries=args.retries,
        retry_delay=args.retry_delay,
    )
    weights = components.set_index("ticker")["weight"]
    index_returns = calculate_returns(prices, weights=weights, min_components=args.min_components)
    updated_history = calculate_index(index_returns, existing_history=existing_history)
    save_history(updated_history, args.history)

    latest = updated_history.iloc[-1]
    return {
        "name": INDEX_NAME,
        "ticker": INDEX_TICKER,
        "date": pd.Timestamp(latest["date"]).strftime("%Y-%m-%d"),
        "value": round(float(latest["index_value"]), 4),
        "rows": int(len(updated_history)),
        "history": str(Path(args.history).resolve()),
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=f"Update {INDEX_TICKER} index history.")
    parser.add_argument("--components", default=str(DEFAULT_COMPONENTS_PATH), help="Path to components.csv")
    parser.add_argument("--history", default=str(DEFAULT_HISTORY_PATH), help="Path to history.csv")
    parser.add_argument("--start", default=None, help="Optional download start date in YYYY-MM-DD format")
    parser.add_argument("--end", default=None, help="Optional download end date in YYYY-MM-DD format")
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
        result = run_update(args)
    except Exception as exc:
        logging.exception("Index update failed: %s", exc)
        return 1

    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
