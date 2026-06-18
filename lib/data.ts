import fs from "node:fs";
import path from "node:path";

export const INDEX_META = {
  name: "RP AI Infrastructure 30 Index",
  ticker: "RPAI30",
  baseValue: 1000,
  baseDate: "2026-06-18",
  type: "Price Return",
  weighting: "Equal Weight",
  rebalance: "Quarterly"
} as const;

export type IndexComponent = {
  ticker: string;
  name: string;
  sector: string;
  weight: number;
};

export type HistoryPoint = {
  date: string;
  indexValue: number;
  dailyReturn: number;
};

export type IndexMetrics = {
  currentValue: number;
  date: string;
  dailyReturn: number;
  performanceSinceLaunch: number;
  totalReturn: number;
  cagr: number;
  annualizedVolatility: number;
  maxDrawdown: number;
  bestDay: number;
  worstDay: number;
  observations: number;
  oneMonthReturn: number | null;
  threeMonthReturn: number | null;
  oneYearReturn: number | null;
};

export type BacktestSummary = {
  name: string;
  ticker: string;
  start_date: string;
  end_date: string;
  start_value: number;
  end_value: number;
  total_return: number;
  cagr: number;
  annualized_volatility: number;
  max_drawdown: number;
  observations: number;
};

export type DataStatus = {
  status: string;
  started_at_utc?: string;
  updated_at_utc?: string;
  component_count?: number;
  index_latest_date?: string;
  index_latest_value?: number;
  index_history_rows?: number;
  backtest_start_date?: string;
  backtest_end_date?: string;
  backtest_latest_date?: string;
  backtest_latest_value?: number;
  backtest_observations?: number;
  error?: string;
};

const COMPONENTS_PATH = path.join(process.cwd(), "components.csv");
const HISTORY_PATH = path.join(process.cwd(), "history.csv");
const BACKTEST_HISTORY_PATH = path.join(process.cwd(), "backtest_history.csv");
const BACKTEST_SUMMARY_PATH = path.join(process.cwd(), "backtest_summary.json");
const DATA_STATUS_PATH = path.join(process.cwd(), "data_status.json");
const TRADING_DAYS = 252;

function readTextIfExists(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === "\"") {
      if (inQuotes && line[index + 1] === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  values.push(current.trim());
  return values;
}

function parseCsv(text: string): Record<string, string>[] {
  const normalized = text.replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const headers = parseCsvLine(lines[0]).map((header) => header.trim());

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? "";
      return row;
    }, {});
  });
}

export function getComponents(): IndexComponent[] {
  const text = readTextIfExists(COMPONENTS_PATH);
  if (!text) {
    return [];
  }

  return parseCsv(text).map((row) => ({
    ticker: row.ticker,
    name: row.name,
    sector: row.sector,
    weight: Number(row.weight)
  }));
}

function readHistory(filePath: string, fallbackDate = INDEX_META.baseDate): HistoryPoint[] {
  const text = readTextIfExists(filePath);
  if (!text) {
    return [
      {
        date: fallbackDate,
        indexValue: INDEX_META.baseValue,
        dailyReturn: 0
      }
    ];
  }

  const rows = parseCsv(text)
    .map((row) => ({
      date: row.date,
      indexValue: Number(row.index_value),
      dailyReturn: Number(row.daily_return)
    }))
    .filter((row) => row.date && Number.isFinite(row.indexValue))
    .sort((left, right) => left.date.localeCompare(right.date));

  return rows.length > 0
    ? rows
    : [
        {
          date: INDEX_META.baseDate,
          indexValue: INDEX_META.baseValue,
          dailyReturn: 0
        }
      ];
}

function trailingReturn(history: HistoryPoint[], tradingDays: number): number | null {
  if (history.length <= tradingDays) {
    return null;
  }
  const latest = history[history.length - 1];
  const prior = history[history.length - 1 - tradingDays];
  return prior.indexValue !== 0 ? latest.indexValue / prior.indexValue - 1 : null;
}

function calculateCagr(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const elapsedMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const elapsedYears = elapsedMs > 0 ? elapsedMs / (365.25 * 24 * 60 * 60 * 1000) : 0;
  if (elapsedYears <= 0 || startValue <= 0) {
    return 0;
  }
  return (endValue / startValue) ** (1 / elapsedYears) - 1;
}

function calculateMaxDrawdown(history: HistoryPoint[]): number {
  let peak = history[0]?.indexValue ?? INDEX_META.baseValue;
  let maxDrawdown = 0;

  for (const point of history) {
    peak = Math.max(peak, point.indexValue);
    if (peak > 0) {
      maxDrawdown = Math.min(maxDrawdown, point.indexValue / peak - 1);
    }
  }

  return maxDrawdown;
}

export function getIndexHistory(): HistoryPoint[] {
  return readHistory(HISTORY_PATH);
}

export function getBacktestHistory(): HistoryPoint[] {
  return readHistory(BACKTEST_HISTORY_PATH);
}

export function getMetricsForHistory(history: HistoryPoint[], baseValue = history[0]?.indexValue ?? INDEX_META.baseValue): IndexMetrics {
  const latest = history[history.length - 1];
  const previous = history.length > 1 ? history[history.length - 2] : latest;
  const inferredDailyReturn = previous.indexValue !== 0 ? latest.indexValue / previous.indexValue - 1 : 0;
  const dailyReturns = history.slice(1).map((point) => point.dailyReturn).filter(Number.isFinite);
  const averageReturn =
    dailyReturns.length > 0 ? dailyReturns.reduce((total, value) => total + value, 0) / dailyReturns.length : 0;
  const variance =
    dailyReturns.length > 1
      ? dailyReturns.reduce((total, value) => total + (value - averageReturn) ** 2, 0) / dailyReturns.length
      : 0;
  const dailyReturn = Number.isFinite(latest.dailyReturn) ? latest.dailyReturn : inferredDailyReturn;

  return {
    currentValue: latest.indexValue,
    date: latest.date,
    dailyReturn,
    performanceSinceLaunch: latest.indexValue / INDEX_META.baseValue - 1,
    totalReturn: baseValue !== 0 ? latest.indexValue / baseValue - 1 : 0,
    cagr: calculateCagr(baseValue, latest.indexValue, history[0].date, latest.date),
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(TRADING_DAYS),
    maxDrawdown: calculateMaxDrawdown(history),
    bestDay: dailyReturns.length > 0 ? Math.max(...dailyReturns) : 0,
    worstDay: dailyReturns.length > 0 ? Math.min(...dailyReturns) : 0,
    observations: history.length,
    oneMonthReturn: trailingReturn(history, 21),
    threeMonthReturn: trailingReturn(history, 63),
    oneYearReturn: trailingReturn(history, 252)
  };
}

export function getIndexMetrics(): IndexMetrics {
  return getMetricsForHistory(getIndexHistory(), INDEX_META.baseValue);
}

export function getBacktestSummary(): BacktestSummary | null {
  const text = readTextIfExists(BACKTEST_SUMMARY_PATH);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as BacktestSummary;
  } catch {
    return null;
  }
}

export function getDataStatus(): DataStatus | null {
  const text = readTextIfExists(DATA_STATUS_PATH);
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as DataStatus;
  } catch {
    return null;
  }
}

export function getSectorBreakdown(components: IndexComponent[]): { sector: string; weight: number; count: number }[] {
  const sectors = new Map<string, { weight: number; count: number }>();

  for (const component of components) {
    const current = sectors.get(component.sector) ?? { weight: 0, count: 0 };
    current.weight += component.weight;
    current.count += 1;
    sectors.set(component.sector, current);
  }

  return Array.from(sectors.entries())
    .map(([sector, data]) => ({ sector, ...data }))
    .sort((left, right) => right.weight - left.weight);
}
