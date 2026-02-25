# HSYLC Data Pipeline

This repo contains scripts for preprocessing written applications and interview data, then uploading candidates into Supabase.

## Processing Interviews and Written CSVs into Supabase

### 1) Prepare input files

- Written applications CSV should live at `sheets/written_new_sl.csv`.
- Interview data lives inside the Excel workbook used by `scripts/preprocess.py` (default: `sheets/Example.xlsx`).

If your files are named differently, update the script arguments or paths accordingly.

### 2) Generate `parsed_candidates.json`

Choose one of the flows below depending on what data you have.

**A. Written-only CSV (no interviews yet)**

```bash
python3 scripts/preprocess_written.py
```

This reads `sheets/written_new_sl.csv` and writes `parsed_candidates.json` in the repo root.

**B. Written + interviews (single Excel workbook)**

```bash
python3 scripts/preprocess.py
```

This reads `sheets/Example.xlsx` (tabs: `Written - New SLs`, `Written - Past SLs`, `Interviews_Normalized`) and writes `parsed_candidates.json` in the repo root.

### 3) Upload to Supabase

Set your Supabase credentials and run the uploader:

```bash
SUPABASE_URL="..." SUPABASE_KEY="..." python3 scripts/upload_to_supabase.py
```

The uploader inserts rows into the `candidates` table in batches of 100 and ignores any keys that do not exist in the table schema.
