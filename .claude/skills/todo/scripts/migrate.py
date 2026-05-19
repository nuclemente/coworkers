#!/usr/bin/env python3
"""
migrate.py — aplica o schema v1 do banco SQLite do Coworker.

Idempotente: todos os CREATE TABLE usam IF NOT EXISTS; o seed das colunas
usa INSERT OR IGNORE; a versão é persistida via INSERT OR IGNORE em _schema_meta.

Executado pelo feature-implement (ou manualmente em troubleshooting). Não
deve rodar em runtime das skills/dashboard.
"""
from __future__ import annotations

import pathlib
import re
import sqlite3
import sys

# Paths relativos à raiz do repositório
REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
DB_PATH = REPO_ROOT / "data" / "coworker.db"
TODO_CONFIG = REPO_ROOT / "config" / "todo.yaml"

SCHEMA_VERSION = 1

DDL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS _schema_meta (
  version    INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_column (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  position   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS todo_card (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  column_id     INTEGER NOT NULL REFERENCES todo_column(id),
  position      INTEGER NOT NULL,
  description   TEXT,
  labels        TEXT,
  due_date      TEXT,
  source        TEXT NOT NULL CHECK (source IN ('manual_slack','manual_cli','one_on_one','transcript')),
  linked_person TEXT,
  context       TEXT,
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_card_column_position ON todo_card(column_id, position);
CREATE INDEX IF NOT EXISTS idx_card_due_date         ON todo_card(due_date) WHERE completed_at IS NULL;

CREATE TRIGGER IF NOT EXISTS trg_todo_card_updated
AFTER UPDATE ON todo_card
BEGIN
  UPDATE todo_card SET updated_at = datetime('now') WHERE id = NEW.id;
END;
"""


def ensure_data_dir() -> None:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def apply_ddl(conn: sqlite3.Connection) -> None:
    conn.executescript(DDL)
    conn.execute(
        "INSERT OR IGNORE INTO _schema_meta(version, applied_at) VALUES (?, datetime('now'))",
        (SCHEMA_VERSION,),
    )


def _parse_columns_from_yaml(text: str) -> list[dict]:
    """Parser minimalista para a seção `columns:` de config/todo.yaml.

    Restrição do projeto: stdlib-only nos scripts Python (sem PyYAML).
    Aceita o formato exato do template:

        columns:
          - slug: a-fazer
            label: A fazer
            position: 1
    """
    cols: list[dict] = []
    in_columns = False
    current: dict | None = None
    for raw in text.splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        # Sai da seção columns ao encontrar nova chave top-level (sem indentação).
        if in_columns and re.match(r"^[A-Za-z_]", line):
            if current:
                cols.append(current)
                current = None
            in_columns = False
        if not in_columns:
            if re.match(r"^columns\s*:\s*$", line):
                in_columns = True
            continue
        # Dentro de columns
        m_item = re.match(r"^\s*-\s*slug\s*:\s*(.+?)\s*$", line)
        if m_item:
            if current:
                cols.append(current)
            current = {"slug": m_item.group(1).strip().strip('"').strip("'")}
            continue
        m_kv = re.match(r"^\s*([A-Za-z_]+)\s*:\s*(.+?)\s*$", line)
        if m_kv and current is not None:
            key = m_kv.group(1)
            val = m_kv.group(2).strip().strip('"').strip("'")
            if key == "position":
                try:
                    current[key] = int(val)
                except ValueError:
                    current[key] = val
            else:
                current[key] = val
    if current:
        cols.append(current)
    return cols


def seed_columns(conn: sqlite3.Connection) -> int:
    if not TODO_CONFIG.exists():
        print(f"ERRO: {TODO_CONFIG} não existe.", file=sys.stderr)
        sys.exit(1)
    cols = _parse_columns_from_yaml(TODO_CONFIG.read_text(encoding="utf-8"))
    if not cols:
        print(f"ERRO: {TODO_CONFIG} não declara columns.", file=sys.stderr)
        sys.exit(1)
    inserted = 0
    for col in cols:
        if "slug" not in col or "label" not in col or "position" not in col:
            print(f"ERRO: coluna inválida em {TODO_CONFIG}: {col}", file=sys.stderr)
            sys.exit(1)
        cur = conn.execute(
            "INSERT OR IGNORE INTO todo_column(slug, label, position) VALUES (?, ?, ?)",
            (col["slug"], col["label"], col["position"]),
        )
        if cur.rowcount > 0:
            inserted += 1
    return inserted


def main() -> int:
    ensure_data_dir()
    conn = sqlite3.connect(DB_PATH)
    try:
        conn.execute("PRAGMA foreign_keys = ON")
        apply_ddl(conn)
        inserted = seed_columns(conn)
        conn.commit()
    finally:
        conn.close()

    # Output de confirmação
    print(f"OK: schema v{SCHEMA_VERSION} aplicado em {DB_PATH}")
    print(f"OK: colunas seedadas (novas inseridas: {inserted}; existentes preservadas)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
