"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { BacktestSummary, DataStatus, HistoryPoint, IndexComponent, IndexMetrics } from "@/lib/data";

type IndexMeta = {
  name: string;
  ticker: string;
  baseValue: number;
  baseDate: string;
  type: string;
  weighting: string;
  rebalance: string;
};

type Tone = "positive" | "negative" | "neutral";
type PeriodKey = "1M" | "3M" | "YTD" | "1Y" | "3Y" | "5Y" | "MAX";

type ChartPoint = HistoryPoint & {
  x: number;
  y: number;
};

type DashboardProps = {
  meta: IndexMeta;
  components: IndexComponent[];
  launchHistory: HistoryPoint[];
  launchMetrics: IndexMetrics;
  backtestHistory: HistoryPoint[];
  backtestMetrics: IndexMetrics;
  backtestSummary: BacktestSummary | null;
  dataStatus: DataStatus | null;
};

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1Y" },
  { key: "3Y", label: "3Y" },
  { key: "5Y", label: "5Y" },
  { key: "MAX", label: "MAX" }
];

const TRADING_DAYS = 252;

function formatIndexValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0
  }).format(value);
}

function formatPercent(value: number, signed = true): string {
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatMaybePercent(value: number | null): string {
  return value === null ? "n/a" : formatPercent(value);
}

function formatDrawdown(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function toneClass(value: number | null): Tone {
  if (value === null) {
    return "neutral";
  }
  if (value > 0) {
    return "positive";
  }
  if (value < 0) {
    return "negative";
  }
  return "neutral";
}

function parseDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function compactDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC"
  }).format(parseDate(date));
}

function compactDateTime(value: string | undefined): string {
  if (!value) {
    return "n/a";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short"
  }).format(new Date(value));
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getCutoffDate(latestDate: string, period: PeriodKey): string | null {
  if (period === "MAX") {
    return null;
  }

  const latest = parseDate(latestDate);
  const cutoff = new Date(latest);

  if (period === "YTD") {
    cutoff.setUTCMonth(0, 1);
    return isoDate(cutoff);
  }

  const periodMonths: Record<Exclude<PeriodKey, "YTD" | "MAX">, number> = {
    "1M": 1,
    "3M": 3,
    "1Y": 12,
    "3Y": 36,
    "5Y": 60
  };

  cutoff.setUTCMonth(cutoff.getUTCMonth() - periodMonths[period]);
  return isoDate(cutoff);
}

function filterHistoryByPeriod(history: HistoryPoint[], period: PeriodKey): HistoryPoint[] {
  if (history.length <= 1 || period === "MAX") {
    return history;
  }

  const latest = history[history.length - 1];
  const cutoff = getCutoffDate(latest.date, period);
  if (!cutoff) {
    return history;
  }

  const filtered = history.filter((point) => point.date >= cutoff);
  return filtered.length > 1 ? filtered : history;
}

function calculateCagr(startValue: number, endValue: number, startDate: string, endDate: string): number {
  const elapsedMs = parseDate(endDate).getTime() - parseDate(startDate).getTime();
  const elapsedYears = elapsedMs > 0 ? elapsedMs / (365.25 * 24 * 60 * 60 * 1000) : 0;
  if (elapsedYears <= 0 || startValue <= 0) {
    return 0;
  }
  return (endValue / startValue) ** (1 / elapsedYears) - 1;
}

function calculateWindowMetrics(history: HistoryPoint[]): IndexMetrics {
  const latest = history[history.length - 1];
  const first = history[0];
  const previous = history.length > 1 ? history[history.length - 2] : latest;
  const dailyReturns = history.slice(1).map((point) => point.dailyReturn).filter(Number.isFinite);
  const averageReturn =
    dailyReturns.length > 0 ? dailyReturns.reduce((total, value) => total + value, 0) / dailyReturns.length : 0;
  const variance =
    dailyReturns.length > 1
      ? dailyReturns.reduce((total, value) => total + (value - averageReturn) ** 2, 0) / dailyReturns.length
      : 0;
  let peak = first.indexValue;
  let maxDrawdown = 0;

  for (const point of history) {
    peak = Math.max(peak, point.indexValue);
    maxDrawdown = Math.min(maxDrawdown, point.indexValue / peak - 1);
  }

  return {
    currentValue: latest.indexValue,
    date: latest.date,
    dailyReturn: previous.indexValue !== 0 ? latest.indexValue / previous.indexValue - 1 : 0,
    performanceSinceLaunch: latest.indexValue / 1000 - 1,
    totalReturn: first.indexValue !== 0 ? latest.indexValue / first.indexValue - 1 : 0,
    cagr: calculateCagr(first.indexValue, latest.indexValue, first.date, latest.date),
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(TRADING_DAYS),
    maxDrawdown,
    bestDay: dailyReturns.length > 0 ? Math.max(...dailyReturns) : 0,
    worstDay: dailyReturns.length > 0 ? Math.min(...dailyReturns) : 0,
    observations: history.length,
    oneMonthReturn: null,
    threeMonthReturn: null,
    oneYearReturn: null
  };
}

function buildChartPoints(history: HistoryPoint[]) {
  const width = 980;
  const height = 330;
  const padX = 54;
  const padY = 28;
  const values = history.map((point) => point.indexValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return history.map((point, index) => {
    const x =
      history.length === 1
        ? width / 2
        : padX + (index / (history.length - 1)) * (width - padX * 2);
    const y = height - padY - ((point.indexValue - min) / range) * (height - padY * 2);
    return { ...point, x, y };
  });
}

function getNearestPoint(points: ChartPoint[], pointerX: number): ChartPoint {
  return points.reduce((nearest, point) =>
    Math.abs(point.x - pointerX) < Math.abs(nearest.x - pointerX) ? point : nearest
  );
}

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function RangeSelector({
  selected,
  onChange,
  disabled
}: {
  selected: PeriodKey;
  onChange: (period: PeriodKey) => void;
  disabled: boolean;
}) {
  return (
    <div className="range-control" aria-label="Historical period selector">
      {PERIODS.map((period) => (
        <button
          type="button"
          key={period.key}
          className={period.key === selected ? "range-button active" : "range-button"}
          onClick={() => onChange(period.key)}
          disabled={disabled}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

function HistoryChart({
  eyebrow,
  title,
  history,
  caption,
  defaultPeriod = "MAX"
}: {
  eyebrow: string;
  title: string;
  history: HistoryPoint[];
  caption: string;
  defaultPeriod?: PeriodKey;
}) {
  const width = 980;
  const height = 330;
  const [period, setPeriod] = useState<PeriodKey>(defaultPeriod);
  const [hovered, setHovered] = useState<ChartPoint | null>(null);

  const filteredHistory = useMemo(() => filterHistoryByPeriod(history, period), [history, period]);
  const metrics = useMemo(() => calculateWindowMetrics(filteredHistory), [filteredHistory]);
  const points = useMemo(() => buildChartPoints(filteredHistory), [filteredHistory]);
  const values = filteredHistory.map((point) => point.indexValue);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = min + (max - min) / 2;
  const minPoint = points.reduce((lowest, point) => (point.indexValue < lowest.indexValue ? point : lowest), points[0]);
  const maxPoint = points.reduce((highest, point) => (point.indexValue > highest.indexValue ? point : highest), points[0]);
  const latestPoint = points[points.length - 1];
  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x.toFixed(2)} ${height - 28} L ${points[0].x.toFixed(
          2
        )} ${height - 28} Z`
      : "";
  const focusPoint = hovered ?? latestPoint;
  const tooltipX = focusPoint.x > width - 210 ? focusPoint.x - 184 : focusPoint.x + 16;
  const tooltipY = focusPoint.y < 88 ? focusPoint.y + 18 : focusPoint.y - 72;
  const selectorDisabled = history.length <= 1;

  return (
    <section className="chart-panel" aria-labelledby={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>
      <div className="section-heading chart-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={`${title.replace(/\s+/g, "-").toLowerCase()}-title`}>{title}</h2>
        </div>
        <div className="chart-actions">
          <RangeSelector selected={period} onChange={setPeriod} disabled={selectorDisabled} />
          <div className="date-range">
            {compactDate(filteredHistory[0].date)} / {compactDate(filteredHistory[filteredHistory.length - 1].date)}
          </div>
        </div>
      </div>

      <div className="chart-summary">
        <div>
          <span>Latest</span>
          <strong>{formatIndexValue(filteredHistory[filteredHistory.length - 1].indexValue)}</strong>
        </div>
        <div>
          <span>Period Return</span>
          <strong className={toneClass(metrics.totalReturn)}>{formatPercent(metrics.totalReturn)}</strong>
        </div>
        <div>
          <span>Max Drawdown</span>
          <strong className={toneClass(metrics.maxDrawdown)}>{formatDrawdown(metrics.maxDrawdown)}</strong>
        </div>
        <div>
          <span>Observations</span>
          <strong>{formatNumber(metrics.observations)}</strong>
        </div>
      </div>

      <div className="chart-wrap">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${title} chart`}
          onPointerMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            const pointerX = ((event.clientX - rect.left) / rect.width) * width;
            setHovered(getNearestPoint(points, pointerX));
          }}
          onPointerLeave={() => setHovered(null)}
        >
          <line x1="54" x2="926" y1="28" y2="28" className="grid-line" />
          <line x1="54" x2="926" y1="165" y2="165" className="grid-line" />
          <line x1="54" x2="926" y1="302" y2="302" className="grid-line" />
          <text x="12" y="34" className="axis-label">
            {formatNumber(max)}
          </text>
          <text x="12" y="171" className="axis-label">
            {formatNumber(midpoint)}
          </text>
          <text x="12" y="307" className="axis-label">
            {formatNumber(min)}
          </text>
          {areaPath ? <path d={areaPath} className="chart-area" /> : null}
          {linePath ? <path d={linePath} className="chart-line" /> : null}
          {points.length > 2 ? (
            <>
              <circle cx={maxPoint.x} cy={maxPoint.y} r="4" className="chart-dot secondary" />
              <circle cx={minPoint.x} cy={minPoint.y} r="4" className="chart-dot low" />
            </>
          ) : null}
          <line x1={focusPoint.x} x2={focusPoint.x} y1="28" y2="302" className="crosshair-line" />
          <circle cx={focusPoint.x} cy={focusPoint.y} r="5" className="chart-dot focus" />
          <g className="chart-tooltip" transform={`translate(${tooltipX}, ${tooltipY})`}>
            <rect width="168" height="62" rx="0" />
            <text x="10" y="18" className="tooltip-date">
              {compactDate(focusPoint.date)}
            </text>
            <text x="10" y="38" className="tooltip-value">
              {formatIndexValue(focusPoint.indexValue)}
            </text>
            <text x="10" y="54" className={toneClass(focusPoint.dailyReturn)}>
              {formatPercent(focusPoint.dailyReturn)} day
            </text>
          </g>
        </svg>
      </div>

      <div className="chart-foot">
        <span>{caption}</span>
        <span>
          High {formatIndexValue(max)} / Low {formatIndexValue(min)}
        </span>
      </div>
    </section>
  );
}

function ComponentsTable({ components }: { components: IndexComponent[] }) {
  return (
    <section className="table-section" aria-labelledby="components-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Constituents</p>
          <h2 id="components-title">Equal-Weight Components</h2>
        </div>
        <div className="component-count">{components.length} stocks</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th>Sector</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {components.map((component) => (
              <tr key={component.ticker}>
                <td className="ticker-cell">{component.ticker}</td>
                <td>{component.name}</td>
                <td>{component.sector}</td>
                <td>{formatPercent(component.weight, false)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function IndexDashboard({
  meta,
  components,
  launchHistory,
  launchMetrics,
  backtestHistory,
  backtestMetrics,
  backtestSummary,
  dataStatus
}: DashboardProps) {
  const sectorBreakdown = useMemo(() => {
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
  }, [components]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <span className="ticker-chip">{meta.ticker}</span>
            <span>{meta.type}</span>
          </div>
          <nav aria-label="Primary navigation">
            <Link href="/methodology">Methodology</Link>
            <a href="/api/index">Index API</a>
            <a href="/api/backtest">Backtest API</a>
          </nav>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Public Informational Benchmark</p>
          <h1>{meta.name}</h1>
          <div className="hero-meta">
            <span>Base {meta.baseValue}</span>
            <span>Base Date {meta.baseDate}</span>
            <span>{meta.weighting}</span>
            <span>{meta.rebalance} Rebalance</span>
            <span>{components.length} Components</span>
          </div>
        </div>
        <div className="quote-block">
          <span className="quote-label">Official Level</span>
          <strong>{formatIndexValue(launchMetrics.currentValue)}</strong>
          <span className="quote-date">{compactDate(launchMetrics.date)}</span>
        </div>
      </section>

      <section className="automation-strip" aria-label="Data automation status">
        <div>
          <span>Automation</span>
          <strong className={dataStatus?.status === "ok" ? "positive" : "negative"}>
            {dataStatus?.status ?? "missing"}
          </strong>
        </div>
        <div>
          <span>Last Data Run</span>
          <strong>{compactDateTime(dataStatus?.updated_at_utc)}</strong>
        </div>
        <div>
          <span>Schedule</span>
          <strong>Weekdays 22:30 UTC</strong>
        </div>
        <div>
          <span>Pipeline</span>
          <strong>GitHub Actions to Vercel</strong>
        </div>
      </section>

      <section className="metric-grid six" aria-label="Index summary">
        <MetricCard
          label="Daily Return"
          value={formatPercent(launchMetrics.dailyReturn)}
          tone={toneClass(launchMetrics.dailyReturn)}
        />
        <MetricCard
          label="Since Launch"
          value={formatPercent(launchMetrics.performanceSinceLaunch)}
          tone={toneClass(launchMetrics.performanceSinceLaunch)}
        />
        <MetricCard
          label="1M"
          value={formatMaybePercent(launchMetrics.oneMonthReturn)}
          tone={toneClass(launchMetrics.oneMonthReturn)}
        />
        <MetricCard
          label="3M"
          value={formatMaybePercent(launchMetrics.threeMonthReturn)}
          tone={toneClass(launchMetrics.threeMonthReturn)}
        />
        <MetricCard
          label="1Y"
          value={formatMaybePercent(launchMetrics.oneYearReturn)}
          tone={toneClass(launchMetrics.oneYearReturn)}
        />
        <MetricCard label="Rebalance" value={meta.rebalance} />
      </section>

      <HistoryChart
        eyebrow="Official History"
        title="RPAI30 Live Index Level"
        history={launchHistory}
        caption="Official index history starts from the 2026-06-18 base date."
      />

      <HistoryChart
        eyebrow="Historical Simulation"
        title="Backtest Price Return Series"
        history={backtestHistory}
        defaultPeriod="5Y"
        caption={
          backtestSummary
            ? `Backtest period ${backtestSummary.start_date} to ${backtestSummary.end_date}.`
            : "Generate with python backtest.py --start 2020-01-01."
        }
      />

      <section className="metric-grid six" aria-label="Backtest summary">
        <MetricCard
          label="Backtest Return"
          value={formatPercent(backtestMetrics.totalReturn)}
          tone={toneClass(backtestMetrics.totalReturn)}
        />
        <MetricCard label="CAGR" value={formatPercent(backtestMetrics.cagr)} tone={toneClass(backtestMetrics.cagr)} />
        <MetricCard label="Ann. Volatility" value={formatPercent(backtestMetrics.annualizedVolatility, false)} />
        <MetricCard
          label="Max Drawdown"
          value={formatDrawdown(backtestMetrics.maxDrawdown)}
          tone={toneClass(backtestMetrics.maxDrawdown)}
        />
        <MetricCard label="Best Day" value={formatPercent(backtestMetrics.bestDay)} tone={toneClass(backtestMetrics.bestDay)} />
        <MetricCard label="Worst Day" value={formatPercent(backtestMetrics.worstDay)} tone="negative" />
      </section>

      <section className="sector-strip" aria-labelledby="sector-title">
        <div className="section-heading compact">
          <div>
            <p className="eyebrow">Exposure</p>
            <h2 id="sector-title">Sector Breakdown</h2>
          </div>
          <div className="component-count">{sectorBreakdown.length} groups</div>
        </div>
        <div className="sector-grid">
          {sectorBreakdown.map((sector) => (
            <div className="sector-item" key={sector.sector}>
              <span>{sector.sector}</span>
              <strong>{formatPercent(sector.weight, false)}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="spec-grid" aria-label="Index specification">
        <div className="spec-block">
          <p className="eyebrow">Calculation</p>
          <h2>Price Return Equal Weight</h2>
          <p>
            Daily index return is the average valid component price return. The level updates from the prior
            close using the published base value.
          </p>
        </div>
        <div className="spec-block">
          <p className="eyebrow">Files</p>
          <h2>CSV-Backed MVP</h2>
          <p>
            `components.csv`, `history.csv`, `backtest_history.csv`, and `backtest_summary.json` are the
            portable data layer for the public site and REST API.
          </p>
        </div>
        <div className="spec-block">
          <p className="eyebrow">Endpoints</p>
          <h2>REST API</h2>
          <p>/api/index, /api/components, /api/history, and /api/backtest are available from the same app.</p>
        </div>
      </section>

      <ComponentsTable components={components} />

      <section className="disclaimer">
        <strong>Disclaimer</strong>
        <p>
          This is an informational benchmark only. Not investment advice. Not an ETF. Not a fund. Not a
          regulated investment product.
        </p>
      </section>
    </main>
  );
}
