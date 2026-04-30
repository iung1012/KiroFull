"""Reads Kiro accounts from any-auto-register SQLite and returns gateway credential entries."""
import json
import sqlite3
from pathlib import Path
from typing import List, Dict


def load_kiro_credentials(db_path: str, default_region: str = "us-east-1") -> List[Dict]:
    """
    Read active Kiro accounts from the SQLite database.
    Returns a list of credential dicts compatible with kiro-gateway AccountManager.
    """
    path = Path(db_path)
    if not path.exists():
        return []

    try:
        conn = sqlite3.connect(str(path))
        conn.row_factory = sqlite3.Row
        cursor = conn.execute(
            "SELECT email, token, extra_json, region FROM accounts "
            "WHERE platform = 'kiro' "
            "AND status NOT IN ('invalid', 'expired') "
            "AND token != '' "
            "ORDER BY updated_at DESC"
        )
        rows = cursor.fetchall()
        conn.close()
    except Exception as e:
        print(f"[WARN] db_source: failed to read kiro accounts: {e}")
        return []

    credentials = []
    for row in rows:
        token = row["token"]
        if not token:
            continue

        region = row["region"] or default_region

        entry: Dict = {
            "type": "refresh_token",
            "refresh_token": token,
            "region": region,
            "comment": row["email"],
        }

        try:
            extra = json.loads(row["extra_json"] or "{}")
            if extra.get("client_id"):
                entry["client_id"] = extra["client_id"]
            if extra.get("client_secret"):
                entry["client_secret"] = extra["client_secret"]
        except Exception:
            pass

        credentials.append(entry)

    return credentials
