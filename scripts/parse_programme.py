#!/usr/bin/env python3
"""
Parse MIE conference programme PDF into a structured JSON file.

Downloads the PDF directly from Google Drive when --gdrive-url or --gdrive-id
is given. Falls back to a local --pdf path.

Usage:
    python scripts/parse_programme.py
    python scripts/parse_programme.py --gdrive-id 1_SAA1ks7xbW7TRGKiLvhSZ_6MYdrsA4P
    python scripts/parse_programme.py --pdf programme.pdf --output data/programme.json
"""

import argparse
import json
import re
import sys
import tempfile
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber is required:  pip install pdfplumber")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cell(text: str | None) -> str:
    """Normalise a table cell: strip whitespace, collapse newlines to spaces."""
    if text is None:
        return ""
    return re.sub(r"\s*\n\s*", " ", text.strip())


def _parse_time_range(text: str) -> tuple[str | None, str | None]:
    m = re.search(r"\((\d{1,2}:\d{2})-(\d{1,2}:\d{2})\)", text)
    return (m.group(1), m.group(2)) if m else (None, None)


def _has_datetime(text: str) -> bool:
    return bool(re.search(r"\d{2}/\d{2}/\d{4}.*\(\d{1,2}:\d{2}-\d{1,2}:\d{2}\)", text))


# ---------------------------------------------------------------------------
# Room mapping: auto-detected from the PDF table header
# ---------------------------------------------------------------------------

def _detect_rooms(tables: list[list[list]]) -> dict[int, tuple[str, str]]:
    """
    Derive {col_offset: (room_label, room_nickname)} from the PDF's header row.

    The header row contains a merged cell like:
      'Main Hall Room 1 Room 2 ... Room 7\\nOther\\n"Maestrale" "Scirocco" ...'

    Room data repeats every 4 columns starting at offset 1:
      offset 1  → room 0 (Main Hall)
      offset 5  → room 1 (Room 1)
      ...
    """
    for table in tables:
        for row in table[:5]:
            for cell in row:
                if not cell:
                    continue
                text = str(cell)
                # Look for the header that lists multiple rooms
                labels = re.findall(r"Main Hall|Room \d+|Other", text)
                nicks  = re.findall(r'"([A-Za-z]+)"', text)
                if len(labels) >= 2:
                    return {
                        1 + i * 4: (labels[i], nicks[i] if i < len(nicks) else "")
                        for i in range(len(labels))
                    }
    # Fallback: common MIE layout
    return {
        1:  ("Main Hall", ""), 5:  ("Room 1", ""), 9:  ("Room 2", ""),
        13: ("Room 3",    ""), 17: ("Room 4", ""), 21: ("Room 5", ""),
        25: ("Room 6",    ""), 29: ("Room 7", ""),
    }


# ---------------------------------------------------------------------------
# Table processor
# ---------------------------------------------------------------------------

def _process_table(
    table: list[list],
    days_map: dict,
    room_map: dict[int, tuple[str, str]],
) -> None:
    """Walk rows of one extracted table and populate days_map."""
    current_day: str | None = None
    active_sessions: dict[int, dict] = {}   # col_offset → session_dict

    for row in table:
        col0 = _cell(row[0] if row else None)

        # ---- Day header (e.g. "25-May") ---------------------------------
        day_m = re.match(r"^(\d{1,2})-May$", col0)
        if day_m:
            current_day = f"2026-05-{int(day_m.group(1)):02d}"
            if current_day not in days_map:
                days_map[current_day] = {"date": current_day, "events": []}
            active_sessions = {}
            continue

        if current_day is None:
            continue

        day = days_map[current_day]

        # ---- Session header row ----------------------------------------
        new_sessions: dict[int, dict] = {}
        for offset in range(1, len(row), 4):
            cell = _cell(row[offset] if offset < len(row) else None)
            sm = re.match(
                r"Session\s+(\S+)\s+(.*?)\s+(\d{2}/\d{2}/\d{4}.*)",
                cell, re.DOTALL
            )
            if sm:
                session_id = f"Session {sm.group(1)}"
                name = sm.group(2).strip()
                start, end = _parse_time_range(sm.group(3))
                room_label, room_name = room_map.get(offset, (f"Col {offset}", ""))
                sess = {
                    "type": "session",
                    "session_id": session_id,
                    "name": name,
                    "room": room_label,
                    "room_name": room_name,
                    "start": start,
                    "end": end,
                    "presentations": [],
                }
                new_sessions[offset] = sess
                day["events"].append(sess)

        if new_sessions:
            active_sessions.update(new_sessions)
            continue

        # ---- Column header row ("ID TYPE PRESENTER TITLE") → skip ------
        if _cell(row[1] if len(row) > 1 else None) == "ID TYPE PRESENTER TITLE":
            continue

        # ---- Special / whole-programme events ---------------------------
        # Any cell that contains a date+time but is NOT a session header
        for cell_raw in row:
            if not cell_raw:
                continue
            cell = _cell(cell_raw)
            if _has_datetime(cell) and not cell.startswith("Session"):
                # Strip trailing date from the name
                name = re.sub(r"\s+\d{2}/\d{2}/\d{4}.*$", "", cell).strip()
                if not name:
                    continue
                start, end = _parse_time_range(cell)
                if not any(
                    e.get("type") == "special" and e.get("name") == name
                    for e in day["events"]
                ):
                    day["events"].append({"type": "special", "name": name,
                                          "start": start, "end": end})
                break

        # ---- Presentation data rows ------------------------------------
        for offset, sess in active_sessions.items():
            if offset >= len(row):
                continue
            id_cell  = _cell(row[offset]     if offset     < len(row) else None)
            typ_cell = _cell(row[offset + 1] if offset + 1 < len(row) else None)
            pre_cell = _cell(row[offset + 2] if offset + 2 < len(row) else None)
            ttl_cell = _cell(row[offset + 3] if offset + 3 < len(row) else None)

            if not re.match(r"^\d+$", id_cell):
                continue

            pres = {
                "id":        int(id_cell),
                "type":      typ_cell,
                "presenter": pre_cell,
                "title":     ttl_cell,
            }
            if not any(p["id"] == pres["id"] for p in sess["presentations"]):
                sess["presentations"].append(pres)


# ---------------------------------------------------------------------------
# Main parse
# ---------------------------------------------------------------------------

def parse_pdf(pdf_path: str) -> dict:
    programme: dict = {
        "conference": "MIE 2026",
        "title": "Opening the Personal Gate between Technology and Health Care",
        "days": [],
    }
    days_map: dict[str, dict] = {}

    with pdfplumber.open(pdf_path) as pdf:
        all_tables = [t for page in pdf.pages for t in page.extract_tables()]
        room_map = _detect_rooms(all_tables)

        for table in all_tables:
            _process_table(table, days_map, room_map)

    programme["days"] = sorted(days_map.values(), key=lambda d: d["date"])

    for day in programme["days"]:
        day["events"] = [
            e for e in day["events"]
            if e.get("type") == "special" or e.get("presentations")
        ]

    return programme


# ---------------------------------------------------------------------------
# Google Drive download
# ---------------------------------------------------------------------------

def download_from_gdrive(gdrive_id: str, dest: str) -> None:
    try:
        import gdown
    except ImportError:
        sys.exit("gdown is required for Google Drive downloads:  pip install gdown")

    url = f"https://drive.google.com/file/d/{gdrive_id}/view"
    print(f"Downloading PDF from Google Drive ({gdrive_id}) …")
    gdown.download(url=url, output=dest, fuzzy=True, quiet=False)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

GDRIVE_ID = "1_SAA1ks7xbW7TRGKiLvhSZ_6MYdrsA4P"  # MIE 2026 programme PDF


def main():
    ap = argparse.ArgumentParser(description="Parse MIE conference programme PDF → JSON")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--pdf",       help="Local PDF path")
    src.add_argument("--gdrive-id", default=GDRIVE_ID,
                     help="Google Drive file ID (default: MIE 2026 PDF)")
    ap.add_argument("--output", default="data/programme.json",
                    help="Output JSON path (default: data/programme.json)")
    ap.add_argument("--keep-pdf", action="store_true",
                    help="Keep downloaded PDF instead of deleting it")
    args = ap.parse_args()

    tmp_pdf: str | None = None

    if args.pdf:
        pdf_path = args.pdf
    else:
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.close()
        tmp_pdf = tmp.name
        download_from_gdrive(args.gdrive_id, tmp_pdf)
        pdf_path = tmp_pdf

    if not Path(pdf_path).exists():
        sys.exit(f"PDF not found: {pdf_path}")

    print(f"Parsing {pdf_path} …")
    programme = parse_pdf(pdf_path)

    out_path = Path(args.output)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(programme, f, indent=2, ensure_ascii=False)

    total = sum(
        len(e.get("presentations", []))
        for day in programme["days"]
        for e in day["events"]
    )
    print(f"Done → {out_path}  ({total} presentations across {len(programme['days'])} days)")

    if tmp_pdf and not args.keep_pdf:
        Path(tmp_pdf).unlink(missing_ok=True)


if __name__ == "__main__":
    main()
