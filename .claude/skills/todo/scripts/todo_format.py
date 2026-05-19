#!/usr/bin/env python3
"""
todo_format.py — renderização (CLI, Slack, mensagens de erro).

Saídas pt-BR. Sem dependências externas.
"""
from __future__ import annotations

from typing import Iterable


def render_card_created(card: dict) -> str:
    col = card.get("column_label", "?")
    return f'Card #{card["id"]} criado em "{col}": "{card["title"]}"'


def render_card_moved(card: dict) -> str:
    col = card.get("column_label", "?")
    return f'Card #{card["id"]} movido para "{col}".'


def render_card_completed(card: dict) -> str:
    return f'Card #{card["id"]} concluído.'


def render_card_deleted(card_id: int) -> str:
    return f"Card #{card_id} removido (hard delete)."


def render_card_edited(card: dict) -> str:
    return f'Card #{card["id"]} atualizado: "{card["title"]}".'


def render_list_cli(cards: Iterable[dict]) -> str:
    cards = list(cards)
    if not cards:
        return "Nenhum card."
    # Agrupa por coluna preservando ordem de chegada.
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for c in cards:
        col = c.get("column_label", "?")
        if col not in groups:
            groups[col] = []
            order.append(col)
        groups[col].append(c)

    lines: list[str] = []
    for col in order:
        lines.append(f"[{col}]")
        for c in groups[col]:
            labels = c.get("labels") or []
            label_str = f"  tags: {', '.join(labels)}" if labels else ""
            due = f"  vence: {c['due_date']}" if c.get("due_date") else ""
            lines.append(f"  #{c['id']} {c['title']}{label_str}{due}")
        lines.append("")
    return "\n".join(lines).rstrip()


def render_list_slack(cards: Iterable[dict]) -> str:
    cards = list(cards)
    if not cards:
        return "_Nenhum card._"
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for c in cards:
        col = c.get("column_label", "?")
        if col not in groups:
            groups[col] = []
            order.append(col)
        groups[col].append(c)
    out: list[str] = []
    for col in order:
        out.append(f"*{col}*")
        for c in groups[col]:
            labels = c.get("labels") or []
            label_str = f" — `{'`, `'.join(labels)}`" if labels else ""
            due = f" (vence {c['due_date']})" if c.get("due_date") else ""
            out.append(f"• `#{c['id']}` {c['title']}{label_str}{due}")
        out.append("")
    return "\n".join(out).rstrip()


def render_error(message: str) -> str:
    """Erro em formato pt-BR, prefixado para Slack/CLI."""
    return f":warning: {message}"
