# RPAI30 Draft Index Governance

## Status

RPAI30 is currently an informational proprietary index. It is not an ETF, fund, regulated benchmark, investment product, or investment advice.

This governance document is a draft operating framework for issuer, index administrator, data vendor, or calculation partner review.

## Index Owner

RP AI Infrastructure 30 Index is maintained by the project owner.

Before any regulated financial product use, the governance model should be reviewed by qualified legal, compliance, data, and index administration professionals.

## Oversight Principles

The index should be operated with:

- transparent methodology
- public component disclosure
- repeatable calculation rules
- documented data sources
- documented component changes
- documented rebalance dates
- documented errors and restatements
- conflict-of-interest controls before commercial licensing

## Methodology Changes

Material methodology changes should be documented before implementation.

Examples:

- change from equal weight to modified market-cap weight
- change in component count
- change in sector eligibility
- change in price source
- change in rebalance schedule
- change in corporate action treatment

For commercial or regulated use, methodology changes should include a notice period and an oversight approval process.

## Constituent Changes

Constituent changes should be documented with:

- effective date
- removed security
- added security
- reason for change
- expected weight treatment
- data source used to confirm eligibility

## Data Quality Controls

The MVP uses yfinance close prices. For issuer-grade use, this should be upgraded to a licensed market-data provider.

Daily controls should include:

- component count validation
- weight-sum validation
- stale price checks
- missing price checks
- extreme return checks
- benchmark level continuity checks
- output file validation

## Calculation Agent

The current calculation is run by project automation.

For ETF, ETP, certificate, fund, or other financial product use, an independent or professionally qualified calculation agent/index administrator should be considered.

## Restatement Policy

If an error is identified, the operator should document:

- error date
- affected index dates
- cause
- corrected values
- publication time
- whether historical files were restated

## Conflicts Of Interest

Before commercial licensing, the index owner should maintain a conflict-of-interest policy covering:

- personal trading
- paid inclusion requests
- issuer relationships
- sponsor influence
- methodology changes requested by commercial partners

## Regulatory Positioning

RPAI30 is currently published as an informational proprietary index.

Use as a reference for financial instruments, financial contracts, investment funds, ETFs, ETPs, certificates, or other regulated products may require authorization, registration, recognition, endorsement, or use of a regulated benchmark administrator depending on jurisdiction and product structure.
