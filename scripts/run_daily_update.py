from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "data_status.json"
COMPONENTS_PATH = ROOT / "components.csv"
HISTORY_PATH = ROOT / "history.csv"
BACKTEST_HISTORY_PATH = ROOT / "backtest_history.csv"
BACKTEST_SUMMARY_PATH = ROOT / "backtest_summary.json"
FACTSHEET_PATH = ROOT / "public" / "documents" / "RPAI30-factsheet.pdf"


def run_command(args: list[str]) -> None:
    result = subprocess.run(
        args,
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
    )
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr, file=sys.stderr)
    if result.returncode != 0:
        raise RuntimeError(f"Command failed with exit code {result.returncode}: {' '.join(args)}")


def validate_components() -> pd.DataFrame:
    components = pd.read_csv(COMPONENTS_PATH)
    required = {"ticker", "name", "sector", "weight"}
    missing = required.difference(components.columns)
    if missing:
        raise ValueError(f"components.csv missing columns: {sorted(missing)}")
    if len(components) != 30:
        raise ValueError(f"Expected 30 components, found {len(components)}")
    if components["ticker"].duplicated().any():
        raise ValueError("components.csv contains duplicate tickers")
    weight_sum = float(components["weight"].sum())
    if abs(weight_sum - 1.0) > 0.001:
        raise ValueError(f"Component weights must sum to 1.0, found {weight_sum:.8f}")
    return components


def latest_history_row(path: Path) -> dict[str, object]:
    history = pd.read_csv(path)
    required = {"date", "index_value", "daily_return"}
    missing = required.difference(history.columns)
    if missing:
        raise ValueError(f"{path.name} missing columns: {sorted(missing)}")
    if history.empty:
        raise ValueError(f"{path.name} is empty")
    history["date"] = pd.to_datetime(history["date"])
    history = history.sort_values("date")
    latest = history.iloc[-1]
    return {
        "date": latest["date"].strftime("%Y-%m-%d"),
        "value": round(float(latest["index_value"]), 6),
        "rows": int(len(history)),
    }


def validate_backtest_summary() -> dict[str, object]:
    if not BACKTEST_SUMMARY_PATH.exists():
        raise FileNotFoundError("backtest_summary.json was not generated")
    summary = json.loads(BACKTEST_SUMMARY_PATH.read_text(encoding="utf-8"))
    if int(summary.get("observations", 0)) <= 0:
        raise ValueError("backtest_summary.json has no observations")
    return summary


def write_status(status: dict[str, object]) -> None:
    STATUS_PATH.write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    started_at = datetime.now(timezone.utc)
    status: dict[str, object] = {
        "status": "running",
        "started_at_utc": started_at.isoformat(timespec="seconds"),
    }
    write_status(status)

    try:
        run_command([sys.executable, "calculate_index.py", "--min-components", "20"])
        run_command([sys.executable, "backtest.py", "--start", "2020-01-01", "--min-components", "20"])

        components = validate_components()
        index_latest = latest_history_row(HISTORY_PATH)
        backtest_latest = latest_history_row(BACKTEST_HISTORY_PATH)
        backtest_summary = validate_backtest_summary()

        finished_at = datetime.now(timezone.utc)
        status = {
            "status": "ok",
            "started_at_utc": started_at.isoformat(timespec="seconds"),
            "updated_at_utc": finished_at.isoformat(timespec="seconds"),
            "component_count": int(len(components)),
            "index_latest_date": index_latest["date"],
            "index_latest_value": index_latest["value"],
            "index_history_rows": index_latest["rows"],
            "backtest_start_date": backtest_summary["start_date"],
            "backtest_end_date": backtest_summary["end_date"],
            "backtest_latest_date": backtest_latest["date"],
            "backtest_latest_value": backtest_latest["value"],
            "backtest_observations": int(backtest_summary["observations"]),
        }
        write_status(status)

        run_command([sys.executable, "scripts/build_factsheet.py"])
        if not FACTSHEET_PATH.exists() or FACTSHEET_PATH.stat().st_size <= 0:
            raise FileNotFoundError("RPAI30 factsheet PDF was not generated")

        status = {
            **status,
            "factsheet_path": "public/documents/RPAI30-factsheet.pdf",
        }
        write_status(status)
        print(json.dumps(status, indent=2))
        return 0
    except Exception as exc:
        failed_at = datetime.now(timezone.utc)
        status = {
            "status": "error",
            "started_at_utc": started_at.isoformat(timespec="seconds"),
            "updated_at_utc": failed_at.isoformat(timespec="seconds"),
            "error": str(exc),
        }
        write_status(status)
        print(json.dumps(status, indent=2), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
