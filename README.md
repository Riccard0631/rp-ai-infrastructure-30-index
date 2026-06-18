# RP AI Infrastructure 30 Index

RP AI Infrastructure 30 Index (`RPAI30`) is a public informational stock index MVP. It is a price-return, equal-weight benchmark with 30 AI infrastructure-related components and a base value of 1000 on 2026-06-18.

This is not an ETF, fund, advisory service, regulated investment product, or investment recommendation.

## Repository Structure

```text
.
|-- app/                         # Next.js app, dashboard, methodology page, REST API routes
|-- lib/data.ts                  # CSV/JSON readers and metrics used by frontend and API
|-- components.csv               # 30 index components and target weights
|-- history.csv                  # Official live index history from the base date
|-- backtest_history.csv         # Historical simulation output
|-- backtest_summary.json        # Backtest performance metrics
|-- data_status.json             # Latest automation run status
|-- docs/                        # Issuer outreach, governance, licensing, due diligence materials
|-- public/documents/            # Public downloadable factsheet
|-- output/pdf/                  # Generated PDF artifacts
|-- methodology.md               # Public methodology and disclaimer
|-- calculate_index.py           # Daily index calculation/update script
|-- backtest.py                  # Backtest and performance summary script
|-- scripts/run_daily_update.py  # Automated production update runner
|-- .github/workflows/           # Scheduled GitHub Actions automation
|-- requirements.txt             # Python dependencies
`-- package.json                 # Next.js dependencies and scripts
```

## Installation

Python 3.10+ and Node.js 20+ are recommended.

```bash
pip install -r requirements.txt
npm install
```

## Run Index Calculations

Update `history.csv` with daily yfinance prices:

```bash
python calculate_index.py
```

Useful options:

```bash
python calculate_index.py --start 2026-06-18
python calculate_index.py --end 2026-12-31
python calculate_index.py --min-components 20
```

The calculation uses:

```text
index_today = index_yesterday * (1 + average_component_return)
```

Because the official base date is 2026-06-18, the live history may contain only the base value until market data is available for later dates.

## Automated Daily Updates

The repository includes a production automation workflow:

```text
.github/workflows/update-index-data.yml
```

It runs automatically on GitHub Actions every day at `22:30 UTC`, after the U.S. market close on trading days. It can also be launched manually from the GitHub Actions tab with `workflow_dispatch`.

The workflow:

1. Installs Python dependencies.
2. Runs `python scripts/run_daily_update.py`.
3. Updates `history.csv`.
4. Updates `backtest_history.csv`.
5. Updates `backtest_summary.json`.
6. Writes `data_status.json`.
7. Regenerates `RPAI30-factsheet.pdf`.
8. Commits the refreshed data back to the repository.

If the repository is connected to Vercel, the automated commit triggers a fresh Vercel deployment, so the public website and API update automatically.

Local equivalent:

```bash
python scripts/run_daily_update.py
```

## Run Backtests

Run a historical simulation from a chosen start date:

```bash
python backtest.py --start 2020-01-01 --min-components 20
```

Outputs:

- `backtest_history.csv`
- `backtest_summary.json`

Summary metrics include total return, CAGR, annualized volatility, max drawdown, observations, start value, and end value.

## Run Website Locally

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## REST API

```text
GET /api/index
GET /api/components
GET /api/history
GET /api/backtest
GET /api/status
```

`GET /api/index` returns the current official index level plus metadata:

```json
{
  "name": "RP AI Infrastructure 30 Index",
  "ticker": "RPAI30",
  "value": 1000,
  "date": "2026-06-18",
  "dailyReturn": 0,
  "performanceSinceLaunch": 0,
  "type": "Price Return",
  "weighting": "Equal Weight",
  "rebalance": "Quarterly",
  "baseValue": 1000,
  "baseDate": "2026-06-18",
  "components": 30
}
```

`GET /api/history` returns official history and calculated metrics.

`GET /api/backtest` returns backtest history, backtest summary, and calculated metrics.

`GET /api/status` returns the latest automation status from `data_status.json`.

## Dashboard

The homepage includes:

- Official RPAI30 level
- Daily return and since-launch performance
- 1M, 3M, and 1Y trailing fields when enough live history exists
- Official live index chart
- Historical simulation chart
- Interactive period selector: 1M, 3M, YTD, 1Y, 3Y, 5Y, MAX
- Crosshair tooltip with date, index level, and daily return on hover
- Automation status bar with latest data run time and production schedule
- Backtest total return, CAGR, annualized volatility, max drawdown, best day, and worst day
- Sector breakdown
- Full components table
- Methodology and disclaimer links

## Issuer / Partner Package

The project includes an issuer-facing page:

```text
/issuer
```

It is designed for ETF/ETP issuers, index administrators, calculation agents, market-data partners, and research/data distribution partners.

Public factsheet:

```text
/documents/RPAI30-factsheet.pdf
```

Supporting materials:

- `docs/issuer-one-pager.md`
- `docs/pitch-email.md`
- `docs/index-governance.md`
- `docs/licensing-summary.md`
- `docs/due-diligence-checklist.md`

Use the issuer page and factsheet for first-contact outreach. The current index remains informational only and is not approved for ETF, ETP, fund, certificate, derivative, financial contract, or other regulated product use without separate written agreement and legal/regulatory/data/index-administration review.

## Deployment

This project is Vercel deployable as a standard Next.js app.

1. Push this repository to GitHub.
2. Connect the GitHub repository to Vercel.
3. Ensure GitHub Actions has repository write permission.
4. The scheduled workflow will refresh the data and commit CSV/JSON updates automatically.
5. Deploy to Vercel with:
   - Build command: `npm run build`
   - Output: Next.js default

Vercel redeploys automatically whenever the GitHub Actions workflow commits refreshed data.

## Data Notes and Limitations

- Market data is downloaded from yfinance and may be delayed, revised, incomplete, unavailable, or affected by ticker/corporate-action changes.
- The MVP uses yfinance close prices for price-return calculations.
- Schneider Electric is represented by the U.S. ADR ticker `SBGSY` for yfinance compatibility.
- Hewlett Packard Enterprise Company (`HPE`) replaces Juniper Networks Inc. after HPE completed its acquisition of Juniper, preserving exposure to enterprise networking and AI-native infrastructure with an actively traded public ticker.
- This is a price-return informational benchmark and is not an official regulated index calculation agent.
- The MVP does not implement a full corporate action ledger, divisor file, historical constituent changes, dividend treatment, currency conversion model, or independent data-vendor validation.
- Equal-weight returns re-normalize across available component returns when some tickers are missing data for a date.

## Legal Disclaimer

This is an informational benchmark only.

Not investment advice.

Not an ETF.

Not a fund.

Not a regulated investment product.

RP AI Infrastructure 30 Index and ticker RPAI30 are provided for informational and educational purposes only. The index is not intended to be a recommendation to buy, sell, or hold any security. No representation is made that the methodology, data, calculation, or output is complete, accurate, timely, or suitable for any purpose. Users are responsible for their own independent review and should consult qualified professionals before making financial decisions.
