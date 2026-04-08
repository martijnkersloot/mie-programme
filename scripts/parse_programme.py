#!/usr/bin/env python3
"""
Parse MIE conference programme PDF into a structured JSON file.

Downloads the PDF directly from Google Drive when --gdrive-id is given.
Falls back to a local --pdf path.

Usage:
    python scripts/parse_programme.py
    python scripts/parse_programme.py --gdrive-id 1_SAA1ks7xbW7TRGKiLvhSZ_6MYdrsA4P
    python scripts/parse_programme.py --pdf programme.pdf --output data/programme.json
"""

import argparse
import json
import os
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

def _cell(text) -> str:
    """Normalise a table cell: strip whitespace, collapse newlines to spaces."""
    if text is None:
        return ""
    return re.sub(r"\s*\n\s*", " ", str(text).strip())


def _parse_time_range(text: str) -> tuple[str | None, str | None]:
    # \s* after hyphen handles cells where "18:00-\n19:00" normalises to "18:00- 19:00"
    m = re.search(r"\((\d{1,2}:\d{2})-\s*(\d{1,2}:\d{2})\)", text)
    return (m.group(1), m.group(2)) if m else (None, None)


def _has_datetime(text: str) -> bool:
    return bool(re.search(r"\d{2}/\d{2}/\d{4}.*\(\d{1,2}:\d{2}-\s*\d{1,2}:\d{2}\)", text))


def _make_room_id(label: str) -> str:
    """'Main Hall' → 'main-hall',  'Room 1' → 'room-1'"""
    return label.strip().lower().replace(" ", "-")


# ---------------------------------------------------------------------------
# Room mapping: auto-detected from the PDF table header
# ---------------------------------------------------------------------------

def _detect_rooms(tables: list) -> dict[int, tuple[str, str]]:
    """
    Derive {col_offset: (room_label, room_nickname)} from the PDF's header row.

    The header row contains a merged cell like:
      'Main Hall Room 1 Room 2 ... Room 7\\nOther\\n"Maestrale" "Scirocco" ...'

    Rooms repeat every 4 columns starting at offset 1.
    """
    for table in tables:
        for row in table[:5]:
            for cell in row:
                if not cell:
                    continue
                text = str(cell)
                labels = re.findall(r"Main Hall|Room \d+|Other", text)
                nicks  = re.findall(r'"([A-Za-z]+)"', text)
                if len(labels) >= 2:
                    return {
                        1 + i * 4: (labels[i], nicks[i] if i < len(nicks) else "")
                        for i in range(len(labels))
                    }
    # Fallback: known MIE 2026 layout
    return {
        1:  ("Main Hall", "Maestrale"), 5:  ("Room 1", "Scirocco"),
        9:  ("Room 2",    "Libeccio"),  13: ("Room 3", "Ponente"),
        17: ("Room 4",    "Levante"),   21: ("Room 5", "Aliseo"),
        25: ("Room 6",    "Zefiro"),    29: ("Room 7", "Austro"),
        33: ("Other",     ""),
    }


def _room_id_for_col(col_idx: int, room_map: dict) -> str | None:
    """Return the room_id for an exact column offset, or None."""
    entry = room_map.get(col_idx)
    return _make_room_id(entry[0]) if entry else None


# ---------------------------------------------------------------------------
# Table processor
# ---------------------------------------------------------------------------

def _process_table(table: list, days_map: dict, room_map: dict, state: dict) -> None:
    """Walk rows of one extracted table and populate days_map.

    state is a mutable dict shared across all table calls:
      state["current_day"]     – str | None
      state["active_sessions"] – dict[int, dict]   col_offset → session dict
      state["pending_ids"]     – dict[int, str]    col_offset → "Session Xn"
    """
    for row in table:
        col0 = _cell(row[0] if row else None)

        # ---- Day header (e.g. "25-May") ---------------------------------
        day_m = re.match(r"^(\d{1,2})-May$", col0)
        if day_m:
            state["current_day"] = f"2026-05-{int(day_m.group(1)):02d}"
            days_map.setdefault(state["current_day"], {"date": state["current_day"], "events": []})
            state["active_sessions"] = {}
            state["pending_ids"] = {}
            continue

        if state["current_day"] is None:
            continue

        day = days_map[state["current_day"]]

        # ---- Column header row → skip -----------------------------------
        if _cell(row[1] if len(row) > 1 else None) == "ID TYPE PRESENTER TITLE":
            continue

        # ---- Session analysis at standard 4-col offsets -----------------
        full_sessions: dict[int, dict] = {}
        id_only: dict[int, str] = {}
        name_time: dict[int, tuple] = {}   # offset → (name, start, end)

        for offset in range(1, len(row), 4):
            c = _cell(row[offset] if offset < len(row) else None)
            if not c:
                continue

            # Full session cell: "Session Xn [name] DD/MM/YYYY (HH:MM-HH:MM)"
            sm = re.match(
                r"Session\s+(\S+)\s*(.*?)\s*(\d{2}/\d{2}/\d{4}.*)",
                c, re.DOTALL
            )
            if sm:
                session_id = f"Session {sm.group(1)}"
                name       = sm.group(2).strip() or session_id
                start, end = _parse_time_range(sm.group(3))
                room_label, room_nickname = room_map.get(offset, ("?", ""))
                full_sessions[offset] = {
                    "type":       "session",
                    "session_id": session_id,
                    "name":       name,
                    "room_id":    _make_room_id(room_label),
                    "start":      start,
                    "end":        end,
                    "presentations": [],
                }
                continue

            # Session ID only (no name/time yet): "Session A5"
            if re.match(r"^Session\s+\S+$", c):
                id_only[offset] = f"Session {c.split()[1]}"
                continue

            # Name+time only (second row of a split header): "AI in Medicine 7 DD/MM ..."
            if _has_datetime(c):
                name_m = re.match(r"(.*?)\s+\d{2}/\d{2}/\d{4}", c)
                name   = name_m.group(1).strip() if name_m else c
                # Skip cells where the "name" is actually just a date
                if re.match(r"^\d{2}/\d{2}/\d{4}", name):
                    continue
                start, end = _parse_time_range(c)
                name_time[offset] = (name, start, end)

        # Always buffer session ID-only cells for the next row
        state["pending_ids"].update(id_only)

        # If this row is purely session IDs, nothing else to do
        if id_only and not full_sessions and not name_time:
            continue

        # Match name+time cells with buffered pending IDs (split-header rows)
        matched_sessions: dict[int, dict] = {}
        for offset, (name, start, end) in name_time.items():
            if offset in state["pending_ids"]:
                session_id = state["pending_ids"].pop(offset)
                room_label, room_nickname = room_map.get(offset, ("?", ""))
                matched_sessions[offset] = {
                    "type":       "session",
                    "session_id": session_id,
                    "name":       name,
                    "room_id":    _make_room_id(room_label),
                    "start":      start,
                    "end":        end,
                    "presentations": [],
                }

        new_sessions = {**full_sessions, **matched_sessions}
        if new_sessions:
            for offset, sess in new_sessions.items():
                state["active_sessions"][offset] = sess
                day["events"].append(sess)

        # Name+time cells NOT matched to a pending ID → special events
        for offset, (name, start, end) in name_time.items():
            if offset not in matched_sessions and name:
                room_id = _room_id_for_col(offset, room_map)
                _add_special(day, name, start, end, room_id)

        # ---- Special events from non-session cells with a datetime ------
        # Covers Coffee Break, Lunch, Welcome Party, Gala Dinner, etc.
        # These can appear at any column (often col 33 "Other")
        for cell_raw in row:
            if not cell_raw:
                continue
            c = _cell(cell_raw)
            if _has_datetime(c) and not c.startswith("Session"):
                name_m = re.match(r"(.*?)\s+\d{2}/\d{2}/\d{4}", c)
                name = name_m.group(1).strip() if name_m else c
                # Skip cells where the "name" is empty or is itself a date
                if not name or re.match(r"^\d{2}/\d{2}/\d{4}", name):
                    continue
                start, end = _parse_time_range(c)
                _add_special(day, name, start, end, None)
                break

        # ---- Presentation data rows ------------------------------------
        for offset, sess in state["active_sessions"].items():
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


def _add_special(day: dict, name: str, start, end, room_id) -> None:
    """Add a special event to the day, avoiding duplicates."""
    if not any(e.get("type") == "special" and e.get("name") == name for e in day["events"]):
        day["events"].append({
            "type":    "special",
            "name":    name,
            "room_id": room_id,
            "start":   start,
            "end":     end,
        })


# ---------------------------------------------------------------------------
# Main parse
# ---------------------------------------------------------------------------

def parse_pdf(pdf_path: str) -> dict:
    programme: dict = {
        "conference": "MIE 2026",
        "title": "Opening the Personal Gate between Technology and Health Care",
        "rooms": [],
        "days": [],
    }
    days_map: dict[str, dict] = {}

    with pdfplumber.open(pdf_path) as pdf:
        all_tables = [t for page in pdf.pages for t in page.extract_tables()]
        room_map   = _detect_rooms(all_tables)

        # State shared across all table calls so that a day split over multiple
        # pages/tables continues correctly without needing a repeated day header.
        state = {
            "current_day":     None,
            "active_sessions": {},
            "pending_ids":     {},
        }
        for table in all_tables:
            _process_table(table, days_map, room_map, state)

    programme["rooms"] = [
        {"id": _make_room_id(label), "label": label, "nickname": nickname}
        for _, (label, nickname) in sorted(room_map.items())
    ]
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

# Google Drive file ID — read from environment variable, with a fallback.
# Set GDRIVE_ID in your shell or .env before running locally.
# In GitHub Actions it is injected via the workflow env: block.
GDRIVE_ID = os.environ.get("GDRIVE_ID", "1_SAA1ks7xbW7TRGKiLvhSZ_6MYdrsA4P")


def main():
    ap = argparse.ArgumentParser(description="Parse MIE conference programme PDF → JSON")
    src = ap.add_mutually_exclusive_group()
    src.add_argument("--pdf",       help="Local PDF path")
    src.add_argument("--gdrive-id", default=GDRIVE_ID,
                     help="Google Drive file ID (default: $GDRIVE_ID env var)")
    ap.add_argument("--output",   default="data/programme.json")
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
