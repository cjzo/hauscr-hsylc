#!/usr/bin/env python3
"""
Preprocess written applications (New SLs) into parsed_candidates.json
so you can upload them into Supabase from the hauscr-hsylc repo root.

Usage (from this directory):

    python3 preprocess_written.py

Input:
- ../sheets/Written.csv

Output:
- parsed_candidates.json (written into this directory)
"""

import os
import json
import pandas as pd


def clean_na(val):
    if pd.isna(val) or val == "nan":
        return None
    if isinstance(val, str):
        return val.strip()
    return val


def rename_col(df, match_str, new_name):
    for col in df.columns:
        if match_str.lower() in col.lower():
            df.rename(columns={col: new_name}, inplace=True)
            return


def process_written_data(csv_path: str, output_path: str) -> None:
    print(f"Reading {csv_path}...")

    written_new = pd.read_csv(csv_path)

    # We no longer ingest past / returning SL written data into the platform database.
    dataframes = [written_new]

    for df in dataframes:
        rename_col(df, "First Name", "First Name")
        rename_col(df, "Last Name", "Last Name")
        rename_col(df, "Concentration", "Major")
        rename_col(df, "title and course description", "Seminar Title & Description")
        rename_col(df, "Nationality", "Nationality")
        rename_col(df, "Email Address", "Email Address")
        rename_col(df, "School", "School")
        rename_col(df, "Class Year", "Class Year")
        rename_col(df, "categorize your proposed seminar", "Seminar Category")
        rename_col(df, "meaningful, tangible final product", "Final Product")
        rename_col(df, "more possible topic(s)", "More Topics")
        rename_col(df, "describe your interest in participating", "Interest Reason")
        rename_col(df, "past teaching and/or mentoring experience", "Teaching Exp")
        rename_col(df, "seeking counsel", "Advice")
        rename_col(df, "self introduction", "Self Intro")

    # Specific renames for New SLs grading
    rename_col(written_new, "Team Grader", "Grader Name")
    rename_col(written_new, "Tier Level", "Tier Level")
    rename_col(written_new, "Rate interest in", "Score Interest")
    rename_col(written_new, "Rate teaching/mentoring", "Score Teaching")
    rename_col(written_new, "Rate seminar including", "Score Seminar")
    rename_col(written_new, "Rate personal qualities", "Score Personal")

    base_new = pd.DataFrame(
        {
            "email": written_new.get("Email Address"),
            "first_name": written_new.get("First Name"),
            "last_name": written_new.get("Last Name"),
            "school": written_new.get("School"),
            "class_year": written_new.get("Class Year"),
            "major": written_new.get("Major"),
            "nationality": written_new.get("Nationality"),
            "candidate_type": "New",
            "seminar_title": written_new.get("Seminar Title & Description"),
            "seminar_category": written_new.get("Seminar Category"),
            "final_product": written_new.get("Final Product"),
            "more_topics": written_new.get("More Topics"),
            "interest_reason": written_new.get("Interest Reason"),
            "teaching_exp": written_new.get("Teaching Exp"),
            "advice": written_new.get("Advice"),
            "self_intro": written_new.get("Self Intro"),
            "grader_name": written_new.get("Grader Name"),
            "tier_level": written_new.get("Tier Level"),
            "written_score_interest": written_new.get("Score Interest"),
            "written_score_teaching": written_new.get("Score Teaching"),
            "written_score_seminar": written_new.get("Score Seminar"),
            "written_score_personal": written_new.get("Score Personal"),
        }
    )

    all_written = base_new.copy()
    all_written["full_name"] = (
        all_written["first_name"].astype(str) + " " + all_written["last_name"].astype(str)
    )
    all_written["full_name"] = all_written["full_name"].str.strip()

    candidates = []

    for _, row in all_written.iterrows():
        if pd.isna(row["email"]):
            continue

        candidate = {
            "email": clean_na(row["email"]),
            "first_name": clean_na(row["first_name"]),
            "last_name": clean_na(row["last_name"]),
            "full_name": clean_na(row["full_name"]),
            "school": clean_na(row["school"]),
            "class_year": str(clean_na(row["class_year"])),
            "major": clean_na(row["major"]),
            "nationality": clean_na(row["nationality"]),
            "candidate_type": clean_na(row["candidate_type"]),
            "seminar_title": clean_na(row["seminar_title"]),
            "seminar_category": clean_na(row["seminar_category"]),
            "seminar_description": None,
            "final_product": clean_na(row["final_product"]),
            "more_topics": clean_na(row["more_topics"]),
            "interest_reason": clean_na(row["interest_reason"]),
            "teaching_exp": clean_na(row["teaching_exp"]),
            "advice": clean_na(row["advice"]),
            "self_intro": clean_na(row["self_intro"]),
            "grader_name": clean_na(row.get("grader_name")),
            "tier_level": clean_na(row.get("tier_level")),
            "written_score_interest": clean_na(row.get("written_score_interest")),
            "written_score_teaching": clean_na(row.get("written_score_teaching")),
            "written_score_seminar": clean_na(row.get("written_score_seminar")),
            "written_score_personal": clean_na(row.get("written_score_personal")),
            "availability": None,
            "score_written": None,
            "score_overall": None,
        }

        candidates.append(candidate)

    print(f"Processed {len(candidates)} written applications.")

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(candidates, f, indent=2)
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    repo_dir = os.path.dirname(os.path.abspath(__file__))
    default_csv = os.path.abspath(os.path.join(repo_dir, "..", "sheets", "Written.csv"))
    output_json = os.path.join(repo_dir, "parsed_candidates.json")
    process_written_data(default_csv, output_json)

