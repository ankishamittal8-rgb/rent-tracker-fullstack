"""
Ledger — Rent & Bills Tracker
Flask backend: serves the frontend and exposes a small REST API
backed by SQLite. Run with `python app.py` from inside backend/.
"""

import os
import sqlite3
import uuid

from flask import Flask, request, jsonify, send_from_directory

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "frontend")
DB_PATH = os.path.join(BASE_DIR, "ledger.db")

app = Flask(__name__, static_folder=FRONTEND_DIR, static_url_path="")


# ---------------------------------------------------------------- storage --

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS bills (
            id         TEXT PRIMARY KEY,
            month_key  TEXT NOT NULL,
            name       TEXT NOT NULL,
            category   TEXT NOT NULL DEFAULT 'other',
            amount     REAL NOT NULL,
            due        TEXT,
            paid       INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
        """
    )
    conn.commit()
    conn.close()


def row_to_dict(row):
    d = dict(row)
    d["paid"] = bool(d["paid"])
    return d


# ------------------------------------------------------------- frontend ---

@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


# -------------------------------------------------------------- API: read --

@app.route("/api/entries", methods=["GET"])
def get_entries():
    month = request.args.get("month")
    if not month:
        return jsonify({"error": "month query param required, e.g. ?month=2026-08"}), 400

    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM bills WHERE month_key = ? ORDER BY due ASC, created_at ASC",
        (month,),
    ).fetchall()
    conn.close()
    return jsonify([row_to_dict(r) for r in rows])


# ------------------------------------------------------------- API: create --

@app.route("/api/entries", methods=["POST"])
def add_entry():
    data = request.get_json(force=True, silent=True) or {}

    name = (data.get("name") or "").strip()
    month = (data.get("month") or "").strip()
    amount = data.get("amount")

    if not name:
        return jsonify({"error": "name is required"}), 400
    if not month:
        return jsonify({"error": "month is required, e.g. 2026-08"}), 400
    try:
        amount = float(amount)
    except (TypeError, ValueError):
        return jsonify({"error": "amount must be a number"}), 400
    if amount < 0:
        return jsonify({"error": "amount cannot be negative"}), 400

    entry_id = uuid.uuid4().hex[:12]
    category = data.get("category") or "other"
    due = data.get("due") or ""

    conn = get_db()
    conn.execute(
        "INSERT INTO bills (id, month_key, name, category, amount, due, paid) "
        "VALUES (?, ?, ?, ?, ?, ?, 0)",
        (entry_id, month, name, category, amount, due),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM bills WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row)), 201


# --------------------------------------------------------- API: update ----

@app.route("/api/entries/<entry_id>", methods=["PATCH"])
def update_entry(entry_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM bills WHERE id = ?", (entry_id,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "entry not found"}), 404

    data = request.get_json(force=True, silent=True) or {}
    new_paid = data.get("paid")
    if new_paid is None:
        new_paid = not bool(row["paid"])

    conn.execute("UPDATE bills SET paid = ? WHERE id = ?", (1 if new_paid else 0, entry_id))
    conn.commit()
    row = conn.execute("SELECT * FROM bills WHERE id = ?", (entry_id,)).fetchone()
    conn.close()
    return jsonify(row_to_dict(row))


# --------------------------------------------------------- API: delete ----

@app.route("/api/entries/<entry_id>", methods=["DELETE"])
def delete_entry(entry_id):
    conn = get_db()
    conn.execute("DELETE FROM bills WHERE id = ?", (entry_id,))
    conn.commit()
    conn.close()
    return "", 204


@app.route("/api/entries/month/<month>", methods=["DELETE"])
def clear_month(month):
    conn = get_db()
    conn.execute("DELETE FROM bills WHERE month_key = ?", (month,))
    conn.commit()
    conn.close()
    return "", 204


# ------------------------------------------------------------------ main --

if __name__ == "__main__":
    import os
    init_db()
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
