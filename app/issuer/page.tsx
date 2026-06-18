import Link from "next/link";

import { INDEX_META, getBacktestSummary, getComponents, getDataStatus } from "@/lib/data";

function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${(value * 100).toFixed(2)}%`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

export default function IssuerPage() {
  const components = getComponents();
  const summary = getBacktestSummary();
  const status = getDataStatus();

  return (
    <main className="shell issuer-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-lockup">
            <span className="ticker-chip">{INDEX_META.ticker}</span>
            <span>Issuer Brief</span>
          </div>
          <nav aria-label="Primary navigation">
            <Link href="/">Dashboard</Link>
            <Link href="/methodology">Methodology</Link>
            <a href="/documents/RPAI30-factsheet.pdf">Factsheet</a>
          </nav>
        </div>
      </header>

      <section className="issuer-hero">
        <div>
          <p className="eyebrow">Issuer / Index Partner Package</p>
          <h1>RPAI30 as a licensable AI infrastructure index concept</h1>
          <p>
            A transparent equal-weight index concept focused on the infrastructure layer behind AI deployment:
            semiconductors, cloud, data centers, power, networking, cybersecurity, and observability.
          </p>
          <div className="issuer-actions">
            <a href="/documents/RPAI30-factsheet.pdf">Download Factsheet</a>
            <Link href="/methodology">View Methodology</Link>
            <a href="/api/backtest">Backtest API</a>
          </div>
        </div>
        <aside className="issuer-snapshot">
          <span>Current Status</span>
          <strong>Informational Proprietary Index</strong>
          <p>Not an ETF, fund, advisory service, regulated benchmark, or investment product.</p>
        </aside>
      </section>

      <section className="issuer-metrics" aria-label="Issuer metrics">
        <div>
          <span>Components</span>
          <strong>{components.length}</strong>
        </div>
        <div>
          <span>Weighting</span>
          <strong>{INDEX_META.weighting}</strong>
        </div>
        <div>
          <span>Rebalance</span>
          <strong>{INDEX_META.rebalance}</strong>
        </div>
        <div>
          <span>Backtest Return</span>
          <strong>{summary ? formatPercent(summary.total_return) : "n/a"}</strong>
        </div>
        <div>
          <span>Backtest CAGR</span>
          <strong>{summary ? formatPercent(summary.cagr) : "n/a"}</strong>
        </div>
        <div>
          <span>Data Status</span>
          <strong>{status?.status ?? "missing"}</strong>
        </div>
      </section>

      <section className="issuer-grid">
        <article>
          <p className="eyebrow">Why This Index</p>
          <h2>AI infrastructure, not generic AI exposure</h2>
          <p>
            Many AI products concentrate on broad mega-cap technology or software narratives. RPAI30 isolates
            companies tied to the compute, cloud, networking, power, data-center, and security stack required to
            deploy AI at scale.
          </p>
        </article>
        <article>
          <p className="eyebrow">Productization Paths</p>
          <h2>Designed for review, not shortcut compliance</h2>
          <p>
            The current package is suitable for issuer evaluation, research distribution, commercial API review,
            or index administrator discussion. Regulated product use requires separate legal, data, calculation,
            and benchmark-administration review.
          </p>
        </article>
        <article>
          <p className="eyebrow">Available Materials</p>
          <h2>Due diligence starting point</h2>
          <p>
            Public methodology, components, history, backtest, automation status, API endpoints, draft governance,
            draft licensing summary, pitch templates, and one-page factsheet are included in the repository.
          </p>
        </article>
      </section>

      <section className="issuer-table-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Evaluation Package</p>
            <h2>Files and endpoints to send</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Purpose</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Factsheet PDF</td>
                <td>One-page issuer overview</td>
                <td>
                  <a href="/documents/RPAI30-factsheet.pdf">/documents/RPAI30-factsheet.pdf</a>
                </td>
              </tr>
              <tr>
                <td>Methodology</td>
                <td>Index rules and disclaimer</td>
                <td>
                  <Link href="/methodology">/methodology</Link>
                </td>
              </tr>
              <tr>
                <td>Index API</td>
                <td>Latest level and metadata</td>
                <td>
                  <a href="/api/index">/api/index</a>
                </td>
              </tr>
              <tr>
                <td>Backtest API</td>
                <td>History and performance metrics</td>
                <td>
                  <a href="/api/backtest">/api/backtest</a>
                </td>
              </tr>
              <tr>
                <td>Status API</td>
                <td>Data update monitoring</td>
                <td>
                  <a href="/api/status">/api/status</a>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="issuer-grid">
        <article>
          <p className="eyebrow">Issuer Conversation</p>
          <h2>Suggested ask</h2>
          <p>
            Ask for concept review, index administration review, calculation-agent partnership, data-vendor
            upgrade path, or commercial licensing discussion. Do not present the current MVP as already approved
            for regulated product use.
          </p>
        </article>
        <article>
          <p className="eyebrow">Current Gaps</p>
          <h2>What a serious partner will ask</h2>
          <p>
            Licensed market data, formal corporate action rules, formal restatement policy, benchmark
            administrator status, calculation agent, legal terms, trademark review, and jurisdictional regulatory
            analysis.
          </p>
        </article>
        <article>
          <p className="eyebrow">Backtest Snapshot</p>
          <h2>{summary ? `${summary.start_date} to ${summary.end_date}` : "Generate backtest"}</h2>
          <p>
            {summary
              ? `End value ${formatNumber(summary.end_value)}, total return ${formatPercent(
                  summary.total_return
                )}, annualized volatility ${formatPercent(summary.annualized_volatility)}.`
              : "Run python scripts/run_daily_update.py to generate backtest outputs."}
          </p>
        </article>
      </section>

      <section className="issuer-disclaimer">
        <strong>Important regulatory positioning</strong>
        <p>
          RPAI30 is currently an informational proprietary index. It is not intended for use as the basis of
          financial instruments, financial contracts, ETFs, ETPs, funds, derivatives, certificates, or regulated
          investment products unless separate legal, regulatory, market-data, calculation, and licensing
          arrangements are agreed.
        </p>
      </section>
    </main>
  );
}
