#!/usr/bin/env python3
"""
todo_cli.py — despachante CLI da skill `todo`.

Subcomandos: add, list, move, done, rm, show, edit.

Output: render via todo_format.* (pt-BR). Erros vão para stderr com exit ≠ 0.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Permite execução tanto como módulo quanto como script direto.
HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

import todo_db  # noqa: E402
import todo_format as fmt  # noqa: E402


def _split_labels(raw: str | None) -> list[str] | None:
    if raw is None:
        return None
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    return parts


def cmd_add(args: argparse.Namespace) -> int:
    card = todo_db.add_card(
        args.title,
        column_slug=args.col,
        description=args.desc,
        labels=_split_labels(args.labels),
        due_date=args.due,
        source="manual_cli",
        linked_person=args.person,
        context=args.context,
    )
    # Preenche column_label para o renderer.
    col_match = next(
        (c for c in todo_db.list_columns() if c["id"] == card["column_id"]), None
    )
    if col_match:
        card["column_label"] = col_match["label"]
    print(fmt.render_card_created(card))
    return 0


def cmd_list(args: argparse.Namespace) -> int:
    cards = todo_db.list_cards(
        include_done=args.all,
        only_done=args.done,
        column_slug=args.col,
        label=args.label,
        person=args.person,
        limit_per_column=args.limit,
    )
    print(fmt.render_list_cli(cards))
    return 0


def cmd_move(args: argparse.Namespace) -> int:
    card = todo_db.move_card(args.id, args.column)
    col_match = next(
        (c for c in todo_db.list_columns() if c["id"] == card["column_id"]), None
    )
    if col_match:
        card["column_label"] = col_match["label"]
    print(fmt.render_card_moved(card))
    return 0


def cmd_done(args: argparse.Namespace) -> int:
    card = todo_db.complete_card(args.id)
    print(fmt.render_card_completed(card))
    return 0


def cmd_rm(args: argparse.Namespace) -> int:
    if not args.force:
        # Confirmação implícita: o CLI alerta e exige --force quando rodando interativo.
        # Em pipelines não-interativos, --force é obrigatório.
        if sys.stdin.isatty():
            ans = input(
                f"Confirma remoção permanente do card #{args.id}? (s/N): "
            ).strip().lower()
            if ans not in ("s", "sim", "y", "yes"):
                print("Cancelado.")
                return 1
        else:
            print(
                fmt.render_error(
                    f"rm é destrutivo. Use --force para confirmar (id={args.id})."
                ),
                file=sys.stderr,
            )
            return 2
    todo_db.delete_card(args.id)
    print(fmt.render_card_deleted(args.id))
    return 0


def cmd_show(args: argparse.Namespace) -> int:
    card = todo_db.get_card(args.id)
    if not card:
        print(fmt.render_error(f"Card #{args.id} inexistente."), file=sys.stderr)
        return 2
    cols = {c["id"]: c["label"] for c in todo_db.list_columns()}
    card["column_label"] = cols.get(card["column_id"], "?")
    print(fmt.render_list_cli([card]))
    return 0


def cmd_edit(args: argparse.Namespace) -> int:
    fields: dict[str, object] = {}
    if args.title is not None:
        fields["title"] = args.title
    if args.desc is not None:
        fields["description"] = args.desc
    if args.labels is not None:
        fields["labels"] = _split_labels(args.labels)
    if args.due is not None:
        fields["due_date"] = args.due
    if args.person is not None:
        fields["linked_person"] = args.person
    if args.context is not None:
        fields["context"] = args.context
    if not fields:
        print(fmt.render_error("Nada a editar (passe ao menos um campo)."), file=sys.stderr)
        return 2
    card = todo_db.edit_card(args.id, **fields)
    print(fmt.render_card_edited(card))
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="todo",
        description="CLI da skill todo (Coworker). pt-BR.",
    )
    sub = p.add_subparsers(dest="cmd", required=True)

    pa = sub.add_parser("add", help="Cria um card.")
    pa.add_argument("title")
    pa.add_argument("--col", help="Slug da coluna (default: a-fazer).")
    pa.add_argument("--desc", help="Descrição.")
    pa.add_argument("--labels", help="Tags separadas por vírgula.")
    pa.add_argument("--due", help="Data limite YYYY-MM-DD.")
    pa.add_argument("--person", help="Slug do liderado (config/team.yaml).")
    pa.add_argument("--context", help="Contexto livre.")
    pa.set_defaults(func=cmd_add)

    pl = sub.add_parser("list", help="Lista cards.")
    pl.add_argument("--all", action="store_true", help="Inclui concluídos.")
    pl.add_argument("--done", action="store_true", help="Somente concluídos.")
    pl.add_argument("--col", help="Filtra por coluna.")
    pl.add_argument("--label", help="Filtra por tag.")
    pl.add_argument("--person", help="Filtra por linked_person.")
    pl.add_argument("--limit", type=int, default=20)
    pl.set_defaults(func=cmd_list)

    pm = sub.add_parser("move", help="Move card para outra coluna.")
    pm.add_argument("id", type=int)
    pm.add_argument("column", help="Slug da coluna destino.")
    pm.set_defaults(func=cmd_move)

    pd = sub.add_parser("done", help="Conclui card.")
    pd.add_argument("id", type=int)
    pd.set_defaults(func=cmd_done)

    pr = sub.add_parser("rm", help="Remove card (hard delete).")
    pr.add_argument("id", type=int)
    pr.add_argument("--force", action="store_true", help="Pula confirmação.")
    pr.set_defaults(func=cmd_rm)

    ps = sub.add_parser("show", help="Detalhe de um card.")
    ps.add_argument("id", type=int)
    ps.set_defaults(func=cmd_show)

    pe = sub.add_parser("edit", help="Edita campos de um card.")
    pe.add_argument("id", type=int)
    pe.add_argument("--title")
    pe.add_argument("--desc")
    pe.add_argument("--labels")
    pe.add_argument("--due")
    pe.add_argument("--person")
    pe.add_argument("--context")
    pe.set_defaults(func=cmd_edit)

    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except ValueError as e:
        print(fmt.render_error(str(e)), file=sys.stderr)
        return 2
    except RuntimeError as e:
        print(fmt.render_error(str(e)), file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
