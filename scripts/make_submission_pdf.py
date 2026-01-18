#!/usr/bin/env python3

"""Generate a single PDF that contains:

1) A custom header section (team info, video link, collaborative tools summary)
2) All code files in the repository, each preceded by its filename

This helps satisfy the submission guideline: "copy into the PDF all the code
files you coded, with the filename next to the code.".

Notes:
- By default, the script excludes node_modules and .git.
- It uses a wide landscape page size and a monospace font.
- It tries to avoid wrapping lines ("lines are not broken"). If lines are very
  long, it will shrink the font for that file.

Requirements (local machine):
  pip install reportlab

Usage:
  python scripts/make_submission_pdf.py \
    --header submission/HEADER_TEMPLATE.txt \
    --output moshe_israeli.pdf
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Iterable, List, Tuple

from reportlab.lib.pagesizes import A3, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas


DEFAULT_INCLUDE_EXTS = {
    ".js",
    ".json",
    ".md",
    ".yml",
    ".yaml",
    ".env.example",
    ".dockerignore",
    "",
}


def is_code_file(p: Path) -> bool:
    """Return True if this file should be included in the PDF."""
    name = p.name
    if name in {"Dockerfile", "docker-compose.yml"}:
        return True

    # Special-case .env.example files
    if name.endswith(".env.example"):
        return True

    # Regular extensions
    return p.suffix in {".js", ".json", ".md", ".yml", ".yaml"}


def iter_code_files(repo_root: Path) -> List[Path]:
    skip_dirs = {
        "node_modules",
        ".git",
        "coverage",
        "dist",
        "build",
        ".next",
        ".venv",
        "venv",
    }

    out: List[Path] = []
    for p in repo_root.rglob("*"):
        if p.is_dir():
            continue
        if any(part in skip_dirs for part in p.parts):
            continue
        if is_code_file(p):
            out.append(p)

    # Stable ordering for reviewers
    out.sort(key=lambda x: str(x).lower())
    return out


def read_text(p: Path) -> str:
    try:
        return p.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Fallback for odd files
        return p.read_text(encoding="latin-1")


def choose_font_size_to_fit(lines: List[str], font_name: str, base_size: int, available_width: float) -> int:
    """Pick a font size so the longest line fits in the available width."""
    if not lines:
        return base_size

    # Compute width of the longest line at the base size
    longest = max(lines, key=len)
    longest_width = pdfmetrics.stringWidth(longest.rstrip("\n"), font_name, base_size)
    if longest_width <= available_width:
        return base_size

    scale = available_width / max(longest_width, 1.0)
    scaled = int(base_size * scale)
    return max(6, min(base_size, scaled))


def draw_wrapped_text(c: canvas.Canvas, text: str, x: float, y: float, max_width: float, font_name: str, font_size: int, leading: int) -> float:
    """Draw text with simple word-wrapping for the header section only."""
    c.setFont(font_name, font_size)
    for raw_line in text.splitlines():
        # Keep blank lines
        if raw_line.strip() == "":
            y -= leading
            continue

        words = raw_line.split(" ")
        line = ""
        for w in words:
            candidate = (line + " " + w).strip()
            if pdfmetrics.stringWidth(candidate, font_name, font_size) <= max_width:
                line = candidate
            else:
                c.drawString(x, y, line)
                y -= leading
                line = w
        if line:
            c.drawString(x, y, line)
            y -= leading
    return y


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True, help="Output PDF filename")
    parser.add_argument("--header", default="", help="Path to header text file (optional)")
    parser.add_argument("--root", default=".", help="Project root (default: current directory)")
    args = parser.parse_args()

    repo_root = Path(args.root).resolve()
    out_path = Path(args.output).resolve()

    page_w, page_h = landscape(A3)
    margin = 36
    c = canvas.Canvas(str(out_path), pagesize=(page_w, page_h))
    monospace = "Courier"
    header_font = "Helvetica"

    # --- Header section (first pages) ---
    y = page_h - margin
    c.setFont("Helvetica-Bold", 18)
    c.drawString(margin, y, "Final Project Submission")
    y -= 28

    if args.header:
        header_path = (repo_root / args.header).resolve() if not Path(args.header).is_absolute() else Path(args.header)
        if header_path.exists():
            header_text = read_text(header_path)
            y = draw_wrapped_text(
                c,
                header_text,
                x=margin,
                y=y,
                max_width=page_w - 2 * margin,
                font_name=header_font,
                font_size=11,
                leading=14,
            )
        else:
            c.setFont(header_font, 11)
            c.drawString(margin, y, f"(Header file not found: {header_path})")
            y -= 14

    c.showPage()

    # --- Code section ---
    files = iter_code_files(repo_root)
    base_font_size = 9
    leading = 10
    file_title_leading = 14

    for p in files:
        rel = p.relative_to(repo_root)
        content = read_text(p)
        lines = content.splitlines()

        available_width = page_w - 2 * margin
        font_size = choose_font_size_to_fit(lines, monospace, base_font_size, available_width)
        leading = max(int(font_size + 1), 7)

        y = page_h - margin
        c.setFont("Helvetica-Bold", 12)
        c.drawString(margin, y, f"FILE: {rel}")
        y -= file_title_leading
        c.setFont(monospace, font_size)

        for line in lines:
            if y <= margin:
                c.showPage()
                y = page_h - margin
                c.setFont("Helvetica-Bold", 12)
                c.drawString(margin, y, f"FILE: {rel} (continued)")
                y -= file_title_leading
                c.setFont(monospace, font_size)
            # No wrapping: keep lines unbroken
            c.drawString(margin, y, line)
            y -= leading

        c.showPage()

    c.save()
    print(f"Wrote PDF: {out_path}")


if __name__ == "__main__":
    main()
