#!/usr/bin/env python3
"""
todo_db.py — CRUD direto sobre o SQLite (data/coworker.db) usando stdlib.

Restrições:
- Apenas stdlib (sqlite3, json, datetime). Sem HTTP, sem ORMs.
- Conexão por chamada; PRAGMA foreign_keys=ON; busy_timeout=2000ms.
- Hard delete (sem soft delete). Schema v1 vide migrate.py.
"""
from __future__ import annotations

import json
import pathlib
import sqlite3
from datetime import datetime
from typing import Any, Iterable

REPO_ROOT = pathlib.Path(__file__).resolve().parents[4]
DB_PATH = REPO_ROOT / "data" / "coworker.db"

SCHEMA_VERSION_EXPECTED = 1

VALID_SOURCES = ("manual_slack", "manual_cli", "one_on_one", "transcript")


# ---------- Infra ----------

def _conn() -> sqlite3.Connection:
    if not DB_PATH.exists():
        raise RuntimeError(
            f"Banco {DB_PATH} não existe. Rode "
            f".claude/skills/todo/scripts/migrate.py via feature-implement."
        )
    conn = sqlite3.connect(DB_PATH, timeout=2.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 2000")
    return conn


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    d = dict(row)
    if "labels" in d:
        d["labels"] = _decode_labels(d.get("labels"))
    return d


def _decode_labels(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [str(x) for x in parsed]
    except json.JSONDecodeError:
        pass
    return []


def _encode_labels(labels: Iterable[str] | None) -> str | None:
    if labels is None:
        return None
    return json.dumps(list(labels), ensure_ascii=False)


def _now_iso() -> str:
    return datetime.utcnow().replace(microsecond=0).isoformat() + "Z"


# ---------- Schema ----------

def schema_version() -> int:
    with _conn() as conn:
        row = conn.execute(
            "SELECT version FROM _schema_meta ORDER BY version DESC LIMIT 1"
        ).fetchone()
    return int(row[0]) if row else 0


def list_columns() -> list[dict]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, slug, label, position FROM todo_column ORDER BY position"
        ).fetchall()
    return [dict(r) for r in rows]


def _column_id_by_slug(conn: sqlite3.Connection, slug: str) -> int:
    row = conn.execute(
        "SELECT id FROM todo_column WHERE slug = ?", (slug,)
    ).fetchone()
    if not row:
        raise ValueError(f"Coluna inexistente: {slug}")
    return int(row[0])


def _default_column_slug() -> str:
    cfg_path = REPO_ROOT / "config" / "todo.yaml"
    if cfg_path.exists():
        for line in cfg_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("default_column:"):
                return line.split(":", 1)[1].strip().strip('"').strip("'")
    return "a-fazer"


def _next_position(conn: sqlite3.Connection, column_id: int) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM todo_card WHERE column_id = ?",
        (column_id,),
    ).fetchone()
    return int(row[0])


# ---------- CRUD ----------

def add_card(
    title: str,
    *,
    column_slug: str | None = None,
    description: str | None = None,
    labels: list[str] | None = None,
    due_date: str | None = None,
    source: str = "manual_cli",
    linked_person: str | None = None,
    context: str | None = None,
) -> dict:
    if not title or not title.strip():
        raise ValueError("title obrigatório")
    if source not in VALID_SOURCES:
        raise ValueError(f"source inválido: {source!r}")
    slug = column_slug or _default_column_slug()

    with _conn() as conn:
        col_id = _column_id_by_slug(conn, slug)
        pos = _next_position(conn, col_id)
        cur = conn.execute(
            """
            INSERT INTO todo_card
                (title, column_id, position, description, labels, due_date,
                 source, linked_person, context)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                title.strip(),
                col_id,
                pos,
                description,
                _encode_labels(labels),
                due_date,
                source,
                linked_person,
                context,
            ),
        )
        new_id = cur.lastrowid
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (new_id,)
        ).fetchone()
    return _row_to_dict(row)


def get_card(card_id: int) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
    return _row_to_dict(row) if row else None


def list_cards(
    *,
    include_done: bool = False,
    only_done: bool = False,
    column_slug: str | None = None,
    label: str | None = None,
    person: str | None = None,
    limit_per_column: int = 20,
) -> list[dict]:
    where: list[str] = []
    args: list[Any] = []
    if only_done:
        where.append("c.completed_at IS NOT NULL")
    elif not include_done:
        where.append("c.completed_at IS NULL")
    if column_slug:
        where.append("col.slug = ?")
        args.append(column_slug)
    if person:
        where.append("c.linked_person = ?")
        args.append(person)
    sql = (
        "SELECT c.*, col.slug AS column_slug, col.label AS column_label, col.position AS column_position "
        "FROM todo_card c JOIN todo_column col ON col.id = c.column_id "
    )
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY col.position, c.position, c.id"
    with _conn() as conn:
        rows = conn.execute(sql, args).fetchall()
    cards = [_row_to_dict(r) for r in rows]
    if label:
        cards = [c for c in cards if label in (c.get("labels") or [])]
    if limit_per_column and limit_per_column > 0:
        capped: list[dict] = []
        counts: dict[str, int] = {}
        for c in cards:
            slug = c.get("column_slug", "")
            n = counts.get(slug, 0)
            if n >= limit_per_column:
                continue
            counts[slug] = n + 1
            capped.append(c)
        cards = capped
    return cards


def move_card(card_id: int, column_slug: str, position: int | None = None) -> dict:
    with _conn() as conn:
        col_id = _column_id_by_slug(conn, column_slug)
        existing = conn.execute(
            "SELECT id FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
        if not existing:
            raise ValueError(f"Card #{card_id} inexistente.")
        new_pos = position if position is not None else _next_position(conn, col_id)
        conn.execute(
            "UPDATE todo_card SET column_id = ?, position = ? WHERE id = ?",
            (col_id, new_pos, card_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
    return _row_to_dict(row)


_EDITABLE_FIELDS = {
    "title",
    "description",
    "labels",
    "due_date",
    "linked_person",
    "context",
}


def edit_card(card_id: int, **fields: Any) -> dict:
    if not fields:
        raise ValueError("Nada a editar.")
    sets: list[str] = []
    args: list[Any] = []
    for key, val in fields.items():
        if key not in _EDITABLE_FIELDS:
            raise ValueError(f"Campo não editável: {key}")
        if key == "labels":
            sets.append("labels = ?")
            args.append(_encode_labels(val))
        else:
            sets.append(f"{key} = ?")
            args.append(val)
    args.append(card_id)
    with _conn() as conn:
        existing = conn.execute(
            "SELECT id FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
        if not existing:
            raise ValueError(f"Card #{card_id} inexistente.")
        conn.execute(
            f"UPDATE todo_card SET {', '.join(sets)} WHERE id = ?", args
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
    return _row_to_dict(row)


def complete_card(card_id: int) -> dict:
    with _conn() as conn:
        existing = conn.execute(
            "SELECT id FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
        if not existing:
            raise ValueError(f"Card #{card_id} inexistente.")
        done_col_id = _column_id_by_slug(conn, "concluido")
        new_pos = _next_position(conn, done_col_id)
        conn.execute(
            "UPDATE todo_card SET completed_at = ?, column_id = ?, position = ? WHERE id = ?",
            (_now_iso(), done_col_id, new_pos, card_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
    return _row_to_dict(row)


def reopen_card(card_id: int) -> dict:
    with _conn() as conn:
        existing = conn.execute(
            "SELECT id FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
        if not existing:
            raise ValueError(f"Card #{card_id} inexistente.")
        backlog_col_id = _column_id_by_slug(conn, _default_column_slug())
        new_pos = _next_position(conn, backlog_col_id)
        conn.execute(
            "UPDATE todo_card SET completed_at = NULL, column_id = ?, position = ? WHERE id = ?",
            (backlog_col_id, new_pos, card_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM todo_card WHERE id = ?", (card_id,)
        ).fetchone()
    return _row_to_dict(row)


def delete_card(card_id: int) -> None:
    """Hard delete (sem desfazer)."""
    with _conn() as conn:
        cur = conn.execute("DELETE FROM todo_card WHERE id = ?", (card_id,))
        if cur.rowcount == 0:
            raise ValueError(f"Card #{card_id} inexistente.")
        conn.commit()
