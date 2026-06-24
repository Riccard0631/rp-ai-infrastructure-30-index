from __future__ import annotations

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
PUBLIC_DIR = ROOT / "public" / "documents"
OUTPUT_PATH = OUTPUT_DIR / "RPAI30-factsheet.pdf"
PUBLIC_PATH = PUBLIC_DIR / "RPAI30-factsheet.pdf"


ACCENT = colors.HexColor("#c67800")
DARK = colors.HexColor("#111111")
TEXT = colors.HexColor("#222222")
MUTED = colors.HexColor("#666666")
LINE = colors.HexColor("#d7d7d2")
GREEN = colors.HexColor("#047857")
RED = colors.HexColor("#be123c")


def pct(value: float) -> str:
    sign = "+" if value > 0 else ""
    return f"{sign}{value * 100:.2f}%"


def money(value: float) -> str:
    return f"{value:,.2f}"


def draw_wrapped(c: canvas.Canvas, text: str, x: float, y: float, width: float, style: ParagraphStyle) -> float:
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, 1000)
    paragraph.drawOn(c, x, y - height)
    return y - height


def draw_metric(c: canvas.Canvas, x: float, y: float, w: float, h: float, label: str, value: str, color=TEXT) -> None:
    c.setStrokeColor(LINE)
    c.setFillColor(colors.white)
    c.rect(x, y - h, w, h, stroke=1, fill=1)
    c.setFillColor(MUTED)
    c.setFont("Helvetica-Bold", 7.8)
    c.drawString(x + 7, y - 14, label.upper())
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(x + 7, y - 34, value)


def draw_chip(c: canvas.Canvas, x: float, y: float, text: str) -> float:
    c.setFont("Helvetica-Bold", 7.8)
    width = stringWidth(text, "Helvetica-Bold", 7.8) + 12
    c.setStrokeColor(LINE)
    c.setFillColor(colors.HexColor("#f3f3ef"))
    c.rect(x, y - 14, width, 14, stroke=1, fill=1)
    c.setFillColor(TEXT)
    c.drawString(x + 6, y - 10, text)
    return x + width + 5


def build_factsheet() -> Path:
    components = pd.read_csv(ROOT / "components.csv")
    summary = json.loads((ROOT / "backtest_summary.json").read_text(encoding="utf-8"))
    status_path = ROOT / "data_status.json"
    status = json.loads(status_path.read_text(encoding="utf-8")) if status_path.exists() else {}

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    c = canvas.Canvas(str(OUTPUT_PATH), pagesize=A4)
    page_w, page_h = A4
    margin = 18 * mm
    y = page_h - margin

    c.setFillColor(DARK)
    c.rect(0, page_h - 34 * mm, page_w, 34 * mm, fill=1, stroke=0)
    c.setFillColor(ACCENT)
    c.rect(margin, page_h - 24 * mm, 33 * mm, 11 * mm, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(margin, page_h - 29 * mm, "Issuer / Index Partner Factsheet")
    c.setFillColor(colors.black)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(margin + 5, page_h - 21 * mm, "RPAI30")

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 24)
    c.drawString(margin + 40 * mm, page_h - 18 * mm, "RP AI Infrastructure 30 Index")
    c.setFont("Helvetica", 10)
    c.drawString(margin + 40 * mm, page_h - 25 * mm, "Equal-weight price return index concept for AI infrastructure equities")

    y = page_h - 45 * mm

    body = ParagraphStyle(
        "body",
        fontName="Helvetica",
        fontSize=8.8,
        leading=12,
        textColor=TEXT,
    )
    small = ParagraphStyle(
        "small",
        fontName="Helvetica",
        fontSize=7.3,
        leading=9.5,
        textColor=MUTED,
    )

    intro = (
        "RPAI30 is a public informational proprietary index tracking 30 listed companies connected to the "
        "infrastructure layer behind AI deployment: semiconductors, semiconductor equipment, cloud platforms, "
        "data centers, power and cooling, networking, cybersecurity, and observability."
    )
    y = draw_wrapped(c, intro, margin, y, page_w - margin * 2, body) - 7

    metrics_y = y
    col_w = (page_w - margin * 2 - 8) / 4
    draw_metric(c, margin, metrics_y, col_w, 21 * mm, "Components", str(len(components)))
    draw_metric(c, margin + col_w + 2.7, metrics_y, col_w, 21 * mm, "Weighting", "Equal")
    draw_metric(c, margin + (col_w + 2.7) * 2, metrics_y, col_w, 21 * mm, "Base Value", "1,000")
    draw_metric(c, margin + (col_w + 2.7) * 3, metrics_y, col_w, 21 * mm, "Rebalance", "Quarterly")

    y = metrics_y - 27 * mm

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, y, "Backtest Snapshot")
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7.8)
    c.drawString(margin + 48 * mm, y, f"{summary['start_date']} to {summary['end_date']}")
    y -= 5

    col_w = (page_w - margin * 2 - 10) / 5
    draw_metric(c, margin, y, col_w, 20 * mm, "End Value", money(float(summary["end_value"])))
    draw_metric(c, margin + (col_w + 2.5), y, col_w, 20 * mm, "Total Return", pct(float(summary["total_return"])), GREEN)
    draw_metric(c, margin + (col_w + 2.5) * 2, y, col_w, 20 * mm, "CAGR", pct(float(summary["cagr"])), GREEN)
    draw_metric(
        c,
        margin + (col_w + 2.5) * 3,
        y,
        col_w,
        20 * mm,
        "Ann. Volatility",
        pct(float(summary["annualized_volatility"])),
    )
    draw_metric(c, margin + (col_w + 2.5) * 4, y, col_w, 20 * mm, "Max Drawdown", pct(float(summary["max_drawdown"])), RED)

    y -= 28 * mm

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, y, "Index Design")
    y -= 9
    chip_x = margin
    for chip in ["Price Return", "30 stocks", "Quarterly rebalance", "Transparent components", "Daily automation"]:
        chip_x = draw_chip(c, chip_x, y, chip)
    y -= 24

    left_w = (page_w - margin * 2 - 14) * 0.52
    right_x = margin + left_w + 14
    right_w = page_w - right_x - margin

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, y, "Potential Partner Paths")
    y_left = y - 11
    partner_text = (
        "- ETF/ETP issuer concept review<br/>"
        "- Index administrator or calculation agent review<br/>"
        "- Licensed market-data upgrade path<br/>"
        "- Commercial API or research distribution<br/>"
        "- White-label dashboard or index licensing discussion"
    )
    draw_wrapped(c, partner_text, margin, y_left, left_w, body)

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(right_x, y, "Current Status")
    status_text = (
        "RPAI30 is currently an informational proprietary index. It is not an ETF, fund, advisory service, "
        "regulated benchmark, investment product, or investment advice. Product use requires separate legal, "
        "data, benchmark administration, and licensing review."
    )
    draw_wrapped(c, status_text, right_x, y - 11, right_w, body)

    y -= 92

    c.setFillColor(TEXT)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin, y, "Component Coverage")
    y -= 10
    sectors = components.groupby("sector")["weight"].sum().sort_values(ascending=False)
    max_bar = max(float(sectors.max()), 0.001)
    bar_x = margin
    bar_w = page_w - margin * 2
    for sector, weight in sectors.head(8).items():
        c.setFillColor(MUTED)
        c.setFont("Helvetica", 7.5)
        c.drawString(bar_x, y, str(sector)[:34])
        c.setFillColor(colors.HexColor("#ededE8"))
        c.rect(bar_x + 70 * mm, y - 2, bar_w - 88 * mm, 5, fill=1, stroke=0)
        c.setFillColor(ACCENT)
        c.rect(bar_x + 70 * mm, y - 2, (bar_w - 88 * mm) * (float(weight) / max_bar), 5, fill=1, stroke=0)
        c.setFillColor(TEXT)
        c.setFont("Helvetica-Bold", 7.5)
        c.drawRightString(page_w - margin, y, pct(float(weight)).replace("+", ""))
        y -= 8.5

    footer_y = 20 * mm
    c.setStrokeColor(LINE)
    c.line(margin, footer_y + 15, page_w - margin, footer_y + 15)
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    status_text = f"Latest data status: {status.get('status', 'n/a')} / generated {generated}"
    disclaimer = (
        "For evaluation only. Not investment advice. Not an ETF. Not a fund. Not a regulated investment product. "
        "Not intended for use as the basis of financial instruments without separate written agreement and review. "
        "Copyright (c) 2026 Riccardo Presti. All rights reserved. RPAI30 and RP AI Infrastructure 30 Index are "
        "proprietary index concepts created and maintained by Riccardo Presti. Unauthorized commercial use, "
        "replication, licensing, or publication of the index methodology, name, materials, or data package is not "
        "permitted without written agreement."
    )
    c.setFillColor(MUTED)
    c.setFont("Helvetica", 7)
    c.drawString(margin, footer_y + 4, status_text)
    draw_wrapped(c, disclaimer, margin, footer_y, page_w - margin * 2, small)

    c.showPage()
    c.save()

    shutil.copyfile(OUTPUT_PATH, PUBLIC_PATH)
    return OUTPUT_PATH


if __name__ == "__main__":
    print(build_factsheet())
