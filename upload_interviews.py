#!/usr/bin/env python3
"""
Upload interview data from sheets/Interviews.csv into the Supabase `interviews` table.

Usage (from the hauscr-hsylc repo root):

    SUPABASE_URL="..." SUPABASE_KEY="..." python3 upload_interviews.py

By default this script:
- Reads ../sheets/Interviews.csv (relative to this file)
- Matches each interview row to a candidate in the `candidates` table by full name
- Inserts rows into the `interviews` table with:
    - interviewer_name
    - long-form notes (why_sl, seminar, extracurricular, teach_me, commitment, comments)
    - standardized scores for enthusiasm, seminar quality, teaching, interest, overall, empirical

You can pass a different CSV path with --csv.
Use --truncate to delete existing rows in `interviews` before inserting (be careful).
"""

import argparse
import csv
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

try:
    from dotenv import load_dotenv

    # Load from default locations and from frontend/.env so SUPABASE_URL/KEY
    # are available even if you don't export them manually.
    load_dotenv()
    load_dotenv(os.path.join(os.path.dirname(__file__), "frontend", ".env"))
except ImportError:
    # If python-dotenv isn't installed, we just fall back to plain env vars.
    pass


def env_or_exit(name: str) -> str:
    value = os.getenv(name)
    if not value:
        print(f"ERROR: Missing required environment variable {name}", file=sys.stderr)
        sys.exit(1)
    return value


def normalize_name(name: str) -> str:
    """Lowercase + collapse whitespace for safer matching."""
    return " ".join(name.strip().lower().split())


def parse_float(value: Optional[str]) -> Optional[float]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def parse_bool_flag(value: Optional[str]) -> Optional[bool]:
    if value is None:
        return None
    s = str(value).strip().lower()
    if not s:
        return None
    if s.startswith("y") or s in {"true", "t", "1"}:
        return True
    if s.startswith("n") or s in {"false", "f", "0"}:
        return False
    return None


def http_json(method: str, url: str, headers: Dict[str, str], body: Optional[Any] = None) -> Any:
    data: Optional[bytes]
    if body is None:
        data = None
    else:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method.upper())
    try:
        with urllib.request.urlopen(req) as resp:
            content_type = resp.headers.get("Content-Type", "")
            raw = resp.read()
            if "application/json" in content_type:
                return json.loads(raw.decode("utf-8"))
            return raw
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} error for {method} {url}", file=sys.stderr)
        try:
            err_body = e.read().decode("utf-8")
            print(err_body, file=sys.stderr)
        except Exception:
            pass
        raise


def fetch_all_candidates(rest_url: str, base_headers: Dict[str, str]) -> List[Dict[str, Any]]:
    # Only fetch New candidates, to avoid collisions with past years / returning SLs.
    url = f"{rest_url}/candidates?select=id,full_name,first_name,last_name,candidate_type&candidate_type=eq.New"
    print(f"Fetching candidates from {url}")
    return http_json("GET", url, base_headers)  # type: ignore[return-value]


def build_name_index(candidates: List[Dict[str, Any]]) -> Dict[str, List[str]]:
    index: Dict[str, List[str]] = {}
    for c in candidates:
        names: List[str] = []
        full = c.get("full_name")
        if isinstance(full, str) and full.strip():
            names.append(full)
        first = c.get("first_name")
        last = c.get("last_name")
        if isinstance(first, str) and isinstance(last, str) and first.strip() and last.strip():
            names.append(f"{first} {last}")

        for n in names:
            key = normalize_name(n)
            index.setdefault(key, []).append(c["id"])
    return index


def load_interviews_csv(path: str) -> List[Dict[str, str]]:
    print(f"Loading interviews from CSV: {path}")
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return list(reader)


def main() -> None:
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.abspath(os.path.join(repo_dir, "..", "sheets", "Interviews.csv"))

    parser = argparse.ArgumentParser(description="Upload interview data from Interviews.csv into Supabase.")
    parser.add_argument(
        "--csv",
        default=default_csv,
        help=f"Path to Interviews.csv (default: {default_csv})",
    )
    parser.add_argument(
        "--truncate",
        action="store_true",
        help="Delete all existing rows in the `interviews` table before inserting.",
    )
    args = parser.parse_args()

    supabase_url = env_or_exit("SUPABASE_URL").rstrip("/")
    supabase_key = env_or_exit("SUPABASE_KEY")

    rest_url = f"{supabase_url}/rest/v1"
    base_headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Accept": "application/json",
    }
    post_headers = {
        **base_headers,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }

    candidates = fetch_all_candidates(rest_url, base_headers)
    print(f"Loaded {len(candidates)} candidates from Supabase.")

    name_index = build_name_index(candidates)
    print(f"Built name index for {len(name_index)} unique names.")

    rows = load_interviews_csv(args.csv)
    print(f"Read {len(rows)} CSV rows.")

    prepared: List[Dict[str, Any]] = []
    unmatched: List[str] = []
    multi_match_warned: List[str] = []

    for row in rows:
        applicant_raw = (row.get("Applicant Name") or "").strip()
        if not applicant_raw:
            continue

        norm = normalize_name(applicant_raw)
        candidate_ids = name_index.get(norm)
        if not candidate_ids:
            unmatched.append(applicant_raw)
            continue
        if len(candidate_ids) > 1 and applicant_raw not in multi_match_warned:
            multi_match_warned.append(applicant_raw)

        # For now, just take the first matching candidate_id.
        candidate_id = candidate_ids[0]

        # Availability / logistics parsing
        availability_raw = (row.get("HSYLC runs in 4 different cities, Shenzhen from Aug 8-18, Shanghai and Hangzhou from Aug 9-19, and Beijing + Hangzhou from Aug 10-20? Which ones are you able to make? ") or "").strip()
        availability_lower = availability_raw.lower()

        record: Dict[str, Any] = {
            "candidate_id": candidate_id,
            "interviewer_name": (row.get("Interviewer") or "").strip() or None,
            "notes_why_sl": (row.get("1. Why do you want to be a SL and what do you think makes you a good SL?") or "").strip() or None,
            "notes_seminar": (row.get("2. What is your seminar on? (If they have multiple ideas, ask them to choose their favorite.) Why do you want to teach this seminar? ") or "").strip() or None,
            "notes_extracurricular": (row.get("3. SLs also play a key role in the extracurricular lives of our students. What kind of impact do you want to make outside of the classroom?") or "").strip() or None,
            "notes_cross_cultural": (row.get("4. For many of you, this may be your first time in China. How has cross-cultural exchange shaped your life so far, and how do you hope to draw on those experiences to engage with HSYLC and your time in China?") or "").strip() or None,
            "notes_teach_me": (row.get("5. Teach me something in two minutes!") or "").strip() or None,
            "notes_commitment": (row.get("5. We expect SLs to submit a course description + syllabus (+ possibly other deliverables) during spring term and keep in contact with us during the summer. Are you able to commit to this? (SEE HOW THEY RESPOND TO THIS QUESTION/IF THEY SEEM LIKE THEY CAN COMMIT TO THIS)") or "").strip() or None,
            "notes_comments": (row.get("Any other comments about the applicant?") or "").strip() or None,
            # Interview logistics
            "availability_answer": availability_raw or None,
            "availability_shenzhen": bool(availability_lower and "shenzhen" in availability_lower) if availability_raw else None,
            "availability_shanghai": bool(availability_lower and "shanghai" in availability_lower) if availability_raw else None,
            "availability_hangzhou": bool(availability_lower and "hangzhou" in availability_lower) if availability_raw else None,
            "availability_beijing": bool(availability_lower and "beijing" in availability_lower) if availability_raw else None,
            "fly_from_interview": (row.get("Where would you likely be flying from before HSYLC?") or "").strip() or None,
            "fly_to_interview": (row.get("Where would you likely be flying to after HSYLC?") or "").strip() or None,
            "sensitive_flag": parse_bool_flag(row.get("Sensitive")),
            # Standardized scores
            "score_understanding": parse_float(row.get("[standardized] Understanding")),
            "score_enthusiasm": parse_float(row.get("[standardized] Enthusiasm")),
            "score_quality": parse_float(row.get("[standardized] Seminar Quality")),
            "score_teaching": parse_float(row.get("[standardized] Teaching")),
            "score_interest": parse_float(row.get("[standardized] Student Engagement")),
            "score_overall": parse_float(row.get("[standardized] Overall")),
            "score_empirical": parse_float(row.get("[standardized] Empirical")),
        }

        prepared.append(record)

    print(f"Prepared {len(prepared)} interview records to insert.")
    if unmatched:
        print(f"{len(unmatched)} rows could not be matched to a candidate by name.")
    if multi_match_warned:
        print(f"{len(multi_match_warned)} distinct names had multiple candidate matches by name (using the first match for each).")

    if not prepared:
        print("No interview records to insert. Exiting.")
        return

    if args.truncate:
        print("Truncating existing rows from `interviews` table...")
        # Supabase/PostgREST now requires a WHERE clause on DELETE.
        # Use a broad filter on a non-nullable column to delete all rows.
        # `is.not_null` is the accepted PostgREST syntax for "IS NOT NULL".
        http_json("DELETE", f"{rest_url}/interviews?candidate_id=is.not_null", base_headers)
        print("Existing rows deleted.")

    batch_size = 100
    total = len(prepared)
    print(f"Inserting {total} rows into `interviews`...")
    for i in range(0, total, batch_size):
        batch = prepared[i : i + batch_size]
        http_json("POST", f"{rest_url}/interviews", post_headers, body=batch)
        print(f"Inserted {min(i + len(batch), total)}/{total}")

    if unmatched or multi_match_warned:
        print("\nSome interview rows were skipped due to matching issues:")
        if unmatched:
            print("\nUnmatched applicant names (no candidate with same full name):")
            for name in sorted(set(unmatched)):
                print(f"  - {name}")
        if multi_match_warned:
            print("\nApplicant names with multiple candidate matches (used the first match):")
            for name in sorted(set(multi_match_warned)):
                print(f"  - {name}")
    else:
        print("\nAll interview rows were matched to candidates successfully.")


if __name__ == "__main__":
    main()

