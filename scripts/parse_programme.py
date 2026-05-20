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
import datetime
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


def _ungarble_minutes(garbled: str, suffix_digits: str) -> str | None:
    """Remove session-suffix digits from a garbled minutes string.

    pdfplumber interleaves adjacent-column text into session header cells.
    For a session with suffix '8' the minutes '00' become '080'; for suffix
    '13' the minutes '30' become '1330'.  The rule that recovers the original
    two digits is: remove the *first* occurrence of each suffix digit in order,
    except for the *last* suffix digit where we remove the *last* occurrence.

    Returns the recovered 2-digit string, or None when recovery fails.
    """
    # Already a clean 2-digit value – nothing to remove
    if len(garbled) == 2 and garbled.isdigit():
        return garbled
    n = len(suffix_digits)
    result = garbled
    for i, d in enumerate(suffix_digits):
        idx = result.rfind(d) if i == n - 1 else result.find(d)
        if idx < 0:
            break
        result = result[:idx] + result[idx + 1:]
    return result if (len(result) == 2 and result.isdigit()) else None


def _clean_garbled_datetime_cell(text: str) -> str:
    """Fix interleaved adjacent-column text in session header cells.

    pdfplumber merges neighbouring column text into one cell, turning e.g.
      'Session De8 26/05/2026 (13:00-13:30)'
    into
      'Session De8 26/05/2D02e6m (1o3: 080-13:30)'

    Steps:
    1. Strip all alpha chars (restores the DD/MM/YYYY date and HH hours).
    2. Collapse stray spaces between date/time components.
    3. Un-garble the minutes fields using the session-number suffix digits.
    Returns the original string unchanged if recovery is not possible.
    """
    m = re.match(r'^(Session\s+(\S+))\s+(.*)', text, re.DOTALL)
    if not m:
        return text
    prefix     = m.group(1)   # 'Session De8'
    suffix_raw = m.group(2)   # 'De8'
    rest       = m.group(3)   # the possibly-garbled date/time portion

    # Already clean – nothing to do
    if re.search(r'\d{2}/\d{2}/\d{4}', rest):
        return text

    suffix_digits = re.sub(r'\D', '', suffix_raw)  # 'De8'→'8', 'Pa13'→'13'

    # Step 1: remove all alpha chars (restores date digits and hour digits)
    cleaned = re.sub(r'[A-Za-z]', '', rest)

    # Step 2: collapse stray spaces in date and time parts separately.
    # Splitting at '(' avoids merging hours from adjacent time components
    # (e.g. '13 2:040' must not become '132:040').
    if '(' in cleaned:
        paren_idx = cleaned.index('(')
        date_part = cleaned[:paren_idx]
        time_part = cleaned[paren_idx:]
        date_part = re.sub(r'(\d)\s+([/\d])', r'\1\2', date_part)
        date_part = re.sub(r'([/])\s+(\d)',   r'\1\2', date_part)
        time_part = re.sub(r'(\d)\s+([-:])',   r'\1\2', time_part)
        time_part = re.sub(r'([-:])\s+(\d)',   r'\1\2', time_part)
        cleaned = date_part + time_part
    else:
        cleaned = re.sub(r'(\d)\s+([/:\d])',  r'\1\2', cleaned)
        cleaned = re.sub(r'([-/:])\s+(\d)',   r'\1\2', cleaned)

    # Bail out if the date still isn't clean
    if not re.search(r'\d{2}/\d{2}/\d{4}', cleaned):
        return text

    # Step 3: un-garble start and end minutes
    def fix_time(tm):
        sh, sm_g = tm.group(1), tm.group(2)
        eh, em_g = tm.group(3), tm.group(4)

        start_mins = _ungarble_minutes(sm_g, suffix_digits)
        end_mins   = _ungarble_minutes(em_g, suffix_digits)

        if (start_mins is not None and end_mins is not None
                and int(start_mins) % 30 == 0 and int(end_mins) % 30 == 0):
            return f'({sh}:{start_mins}-{eh}:{end_mins})'

        # Fallback: derive start from a clean end time (demos are always 30 min)
        if end_mins is not None and int(end_mins) % 30 == 0:
            total = int(eh) * 60 + int(end_mins) - 30
            if total >= 0:
                return f'({total // 60}:{total % 60:02d}-{eh}:{end_mins})'

        return tm.group(0)

    cleaned = re.sub(
        r'\((\d{1,2}):(\d+)\s*-\s*(\d{1,2}):(\d+)\)',
        fix_time, cleaned,
    )

    if _has_datetime(cleaned):
        return f'{prefix} {cleaned}'.strip()
    # Return partially cleaned text when at least the date is recoverable so
    # the session is registered in active_sessions (preventing presentations
    # from contaminating adjacent sessions) even if the time cannot be parsed.
    if re.search(r'\d{2}/\d{2}/\d{4}', cleaned):
        return f'{prefix} {cleaned}'.strip()
    return text


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
      state["current_day"]      – str | None
      state["active_sessions"]  – dict[int, dict]   col_offset → session dict
      state["pending_ids"]      – dict[int, str]    col_offset → "Session Xn"
      state["pending_labels"]   – dict[int, str]    col_offset → plain label text
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
            state["pending_labels"] = {}
            continue

        if state["current_day"] is None:
            continue

        day = days_map[state["current_day"]]

        # ---- Session analysis at standard 4-col offsets -----------------
        full_sessions: dict[int, dict] = {}
        id_only: dict[int, str] = {}
        name_time: dict[int, tuple] = {}   # offset → (name, start, end)
        has_col_header = False

        for offset in range(1, len(row), 4):
            c = _cell(row[offset] if offset < len(row) else None)
            if not c:
                continue
            c = _clean_garbled_datetime_cell(c)

            # Skip column-header marker cells ("ID TYPE PRESENTER TITLE")
            if c == "ID TYPE PRESENTER TITLE":
                has_col_header = True
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

            # Cell with a datetime: either "Name DD/MM ... (HH:MM-HH:MM)"
            # or just "DD/MM/YYYY (HH:MM-HH:MM)" (date-only, row 3 of 3-row split)
            if _has_datetime(c):
                name_m = re.match(r"(.*?)\s+\d{2}/\d{2}/\d{4}", c)
                name   = name_m.group(1).strip() if name_m else ""
                # If "name" is itself a date, clear it
                if re.match(r"^\d{2}/\d{2}/\d{4}", name):
                    name = ""
                # Prepend any buffered plain label (handles 3-row split headers
                # and special events whose label was on the previous row)
                if offset in state["pending_labels"]:
                    prefix = state["pending_labels"].pop(offset)
                    name = f"{prefix} {name}".strip() if name else prefix
                if not name:
                    continue
                start, end = _parse_time_range(c)
                name_time[offset] = (name, start, end)
                continue

            # Plain label cell (no Session prefix, no datetime) — buffer for
            # the next row which may supply the date (2nd or 3rd row of split).
            # Only buffer at session column offsets (1, 5, 9, …) to avoid
            # capturing TYPE/PRESENTER/TITLE values from presentation rows.
            if not re.match(r"^\d+$", c) and offset in room_map:
                state["pending_labels"][offset] = c

        # Always buffer session ID-only cells for the next row
        state["pending_ids"].update(id_only)

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

        # Name+time cells NOT matched to a pending ID → special events.
        # Exception: paired demo sessions (session_id "De16-17" etc.) have a
        # second time-block in the same column ("Demo 17" after "De16-17").
        # Recognise this pattern and skip the spurious special event.
        for offset, (name, start, end) in name_time.items():
            if offset not in matched_sessions and name:
                active = state["active_sessions"].get(offset)
                if active and re.match(r"Session De\d+-\d+$", active.get("session_id", "")):
                    # Split paired demos: create a second session for the second block
                    # so each demo has its own name, time range and presentations.
                    second = {
                        "type":          "session",
                        "session_id":    active["session_id"],
                        "name":          name,
                        "room_id":       active["room_id"],
                        "start":         start,
                        "end":           end,
                        "presentations": [],
                    }
                    day["events"].append(second)
                    state["active_sessions"][offset] = second  # subsequent rows → second block
                    continue
                # A cell with a full session name ("Session A9 Name …") that
                # wasn't buffered as id_only: create a proper session dict.
                sid_m = re.match(r"^Session\s+(\S+)", name)
                if sid_m and offset in room_map:
                    session_id = f"Session {sid_m.group(1)}"
                    room_label, room_nickname = room_map.get(offset, ("?", ""))
                    new_sess = {
                        "type":          "session",
                        "session_id":    session_id,
                        "name":          name,
                        "room_id":       _make_room_id(room_label),
                        "start":         start,
                        "end":           end,
                        "presentations": [],
                    }
                    state["active_sessions"][offset] = new_sess
                    day["events"].append(new_sess)
                    continue
                room_id = _room_id_for_col(offset, room_map)
                _add_special(day, name, start, end, room_id)

        # ---- Special events from non-session-column cells with a datetime --
        # Catches events like Welcome Party that appear at TYPE/PRESENTER/TITLE
        # column offsets rather than the session-ID column (every 4th col).
        # Session-column offsets are already handled by the name_time path above.
        if not has_col_header:
            session_offsets = set(range(1, len(row), 4))
            for ci, cell_raw in enumerate(row):
                if ci in session_offsets or not cell_raw:
                    continue
                c = _cell(cell_raw)
                if _has_datetime(c) and not c.startswith("Session"):
                    name_m = re.match(r"(.*?)\s+\d{2}/\d{2}/\d{4}", c)
                    name = name_m.group(1).strip() if name_m else c
                    if not name or re.match(r"^\d{2}/\d{2}/\d{4}", name):
                        continue
                    start, end = _parse_time_range(c)
                    _add_special(day, name, start, end, None)
                    break

        # ---- Presentation data rows (skip on col-header rows) -----------
        if has_col_header:
            continue
        for offset, sess in state["active_sessions"].items():
            if offset >= len(row):
                continue
            id_cell  = _cell(row[offset]     if offset     < len(row) else None)
            typ_cell = _cell(row[offset + 1] if offset + 1 < len(row) else None)
            pre_cell = _cell(row[offset + 2] if offset + 2 < len(row) else None)
            ttl_cell = _cell(row[offset + 3] if offset + 3 < len(row) else None)

            # Strip merged column-header prefixes (e.g. "ID 929" → "929")
            id_cell  = re.sub(r'^ID\s+',        '', id_cell)
            typ_cell = re.sub(r'^TYPE\s+',      '', typ_cell)
            pre_cell = re.sub(r'^PRESENTER\s+', '', pre_cell)
            ttl_cell = re.sub(r'^TITLE\s+',     '', ttl_cell)

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
        # y_tolerance=2 keeps session-name text and date/time text on separate
        # lines; the default of 3 merges them (difference is ~2.8 pt) causing
        # characters from the two streams to interleave when sorted by x.
        all_tables = [
            t.extract(y_tolerance=2)
            for page in pdf.pages
            for t in page.find_tables()
        ]
        room_map   = _detect_rooms(all_tables)

        # State shared across all table calls so that a day split over multiple
        # pages/tables continues correctly without needing a repeated day header.
        state = {
            "current_day":      None,
            "active_sessions":  {},
            "pending_ids":      {},
            "pending_labels":   {},
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

def download_from_gdrive(gdrive_id: str, dest: str) -> str:
    """Download file from Google Drive to dest and return the original filename."""
    try:
        import gdown
    except ImportError:
        sys.exit("gdown is required for Google Drive downloads:  pip install gdown")
    print(f"Downloading PDF from Google Drive ({gdrive_id}) …")
    # Download into a temp dir so gdown preserves the original filename
    tmp_dir = tempfile.mkdtemp()
    result = gdown.download(id=gdrive_id, output=tmp_dir + "/", quiet=False)
    if not result:
        sys.exit("gdown failed to download the file")
    original_name = Path(result).name
    # Move to the requested destination path
    Path(result).rename(dest)
    return original_name


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

# Google Drive file ID — read from environment variable, with a fallback.
# Set GDRIVE_ID in your shell or .env before running locally.
# In GitHub Actions it is injected via the workflow env: block.
GDRIVE_ID = os.environ.get("GDRIVE_ID", "19QpygtOuHtUhN_3sx_WFrSm6CiFOG7rs")


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
        source_label = Path(pdf_path).name
    else:
        tmp = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
        tmp.close()
        tmp_pdf = tmp.name
        original_name = download_from_gdrive(args.gdrive_id, tmp_pdf)
        pdf_path = tmp_pdf
        source_label = original_name

    if not Path(pdf_path).exists():
        sys.exit(f"PDF not found: {pdf_path}")

    print(f"Parsing {pdf_path} …")
    programme = parse_pdf(pdf_path)

    stat = Path(pdf_path).stat()
    meta: dict = {
        "imported_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "source_filename": source_label,
        "source_file_modified": datetime.datetime.fromtimestamp(
            stat.st_mtime, tz=datetime.timezone.utc
        ).isoformat(),
    }
    if not args.pdf:
        meta["gdrive_id"] = args.gdrive_id
    programme["meta"] = meta

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
