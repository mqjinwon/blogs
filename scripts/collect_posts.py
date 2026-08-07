#!/usr/bin/env python3
"""Scan posts/**/index.qmd → data/posts.json (all posts + paper flags).

Papers dashboard uses is_paper posts.
Post-bottom graph (backlinks map) uses every post.
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POSTS_DIR = ROOT / "posts"
OUT_PATH = ROOT / "data" / "posts.json"

# "NeurIPS 2023" / "ICLR 2024" → venue without year
_VENUE_YEAR_RE = re.compile(
    r"^(?P<venue>.+?)\s+(?P<year>(?:19|20)\d{2})$"
)


def parse_frontmatter(text: str) -> dict:
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end < 0:
        return {}
    block = text[3:end].strip()
    meta: dict = {}
    for raw in block.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        key, val = line.split(":", 1)
        key = key.strip()
        val = val.strip()
        if not key:
            continue
        if val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            meta[key] = (
                []
                if not inner
                else [
                    item.strip().strip("\"'")
                    for item in inner.split(",")
                    if item.strip()
                ]
            )
        else:
            meta[key] = val.strip("\"'")
    return meta


def as_list(val) -> list[str]:
    if val is None:
        return []
    if isinstance(val, list):
        return [str(x).strip() for x in val if str(x).strip()]
    s = str(val).strip()
    return [s] if s else []


def is_paper_post(meta: dict) -> bool:
    cats = as_list(meta.get("categories"))
    if "paper-review" in cats:
        return True
    arxiv = meta.get("arxiv")
    return bool(arxiv and str(arxiv).strip())


def normalize_venue_year(meta: dict, date_iso: str) -> tuple[str | None, str | None]:
    """venue without year; year from frontmatter, venue suffix, or date."""
    venue_raw = str(meta.get("venue") or "").strip() or None
    year: str | None = None

    y_meta = str(meta.get("year") or "").strip()
    if re.fullmatch(r"(?:19|20)\d{2}", y_meta):
        year = y_meta

    venue = venue_raw
    if venue_raw:
        m = _VENUE_YEAR_RE.match(venue_raw)
        if m:
            venue = m.group("venue").strip()
            if not year:
                year = m.group("year")

    if not year and date_iso and re.match(r"^\d{4}", date_iso):
        year = date_iso[:4]

    return venue or None, year


def collect() -> list[dict]:
    items: list[dict] = []
    if not POSTS_DIR.is_dir():
        return items

    for qmd in sorted(POSTS_DIR.glob("*/index.qmd")):
        text = qmd.read_text(encoding="utf-8")
        meta = parse_frontmatter(text)
        pid = qmd.parent.name
        cats = as_list(meta.get("categories"))
        paper = is_paper_post(meta)
        # tags: all categories except paper-review marker
        tags = [c for c in cats if c != "paper-review"]

        date = str(meta.get("date") or "")
        m = re.match(r"(\d{4}-\d{2}-\d{2})", date)
        date_iso = m.group(1) if m else date

        arxiv = str(meta.get("arxiv") or "").strip()
        arxiv = arxiv.removeprefix("arxiv:").strip() or None

        venue, year = normalize_venue_year(meta, date_iso)
        related = as_list(meta.get("related"))

        items.append(
            {
                "id": pid,
                "title": str(meta.get("title") or pid),
                "date": date_iso,
                "year": year,
                "href": f"posts/{pid}/",
                "categories": cats,
                "tags": tags,
                "arxiv": arxiv,
                "one_liner": str(meta.get("one_liner") or "").strip() or None,
                "venue": venue,
                "related": related,
                "is_paper": paper,
            }
        )

    items.sort(key=lambda x: x.get("date") or "", reverse=True)
    return items


def main() -> None:
    posts = collect()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "posts": posts,
    }
    OUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    n_paper = sum(1 for p in posts if p.get("is_paper"))
    print(
        f"collect_posts: {len(posts)} post(s), {n_paper} paper(s) → "
        f"{OUT_PATH.relative_to(ROOT)}"
    )


if __name__ == "__main__":
    main()
