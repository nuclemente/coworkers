---
name: todo
description: Gerencia a To Do list pessoal do EM (Coworker). Operações add/list/move/done/show/edit/rm sobre cards persistidos em data/coworker.db, exibíveis também no Cowork Dashboard (web/cowork). Use quando o usuário pedir para criar/listar/mover/concluir/remover/editar tarefas, ou invocar /todo no canal SLACK_TRIGGER_CHANNEL_NAME.
---

# Skill `todo`

Lista pessoal do Engineering Manager. Persistência única em SQLite (`data/coworker.db`, schema v1). UI opcional via Cowork Dashboard (`web/cowork/`, ver `bin/web-up`).

## Quando usar

- Usuário pede para criar/listar/mover/concluir/remover/editar tarefas pessoais.
- Invocação `/todo …` no canal `SLACK_TRIGGER_CHANNEL_NAME` (`MEMORY.md`).
- Chamada direta no Claude Code / Cowork via subcomando documentado abaixo.

## Quando NÃO usar

- Tarefas de outro colaborador — esta lista é estritamente pessoal.
- Atalho para Jira — não há sync automático (decisão Rodada 1).
- Notas de reunião ou pauta de 1:1 — usar as skills correspondentes.

## Pré-requisitos

- `data/coworker.db` existente com `_schema_meta.version = 1`. Caso contrário, executar `python3 .claude/skills/todo/scripts/migrate.py` (idempotente).
- `config/todo.yaml` definindo colunas e `default_column`.

## Gramática (CLI / Slack)

Todos os comandos são roteados por `.claude/skills/todo/scripts/todo_cli.py`. Slack envia argv equivalente.

| Comando | Descrição | Exemplos |
|---|---|---|
| `add <título> [--col <slug>] [--desc <texto>] [--labels <a,b>] [--due YYYY-MM-DD] [--person <slug>] [--context <texto>]` | Cria card. Default `--col` lido de `default_column` em `config/todo.yaml` (`a-fazer`). | `todo add "Revisar PDI da Ana" --labels "1on1,prioridade"` |
| `list [--all] [--done] [--col <slug>] [--label <tag>] [--person <slug>] [--limit <n>]` | Lista cards. Default: ativos (não concluídos). | `todo list --col em-andamento` |
| `move <id> <coluna>` | Move card. | `todo move 12 em-andamento` |
| `done <id>` | Marca concluído e move para `concluido`. | `todo done 12` |
| `show <id>` | Detalhe do card. | `todo show 12` |
| `edit <id> [--title …] [--desc …] [--labels …] [--due …] [--person …] [--context …]` | Edita campos. | `todo edit 12 --due 2026-06-01` |
| `rm <id> [--force]` | **HARD DELETE** (sem desfazer). Em terminal interativo pede confirmação; em pipeline exige `--force`. | `todo rm 12 --force` |

### Convenção `source`

Toda inserção via este CLI grava `source = 'manual_cli'`. Outras skills (1:1, transcript) usam seus próprios valores (`one_on_one`, `transcript`). Inserção via Slack do Dashboard: `manual_slack`.

## Outputs

- **CLI**: texto pt-BR via `todo_format.render_list_cli` (lista) e mensagens curtas (mutações).
- **Slack** (quando invocado pela orquestração do canal trigger): `todo_format.render_list_slack` (Markdown Slack).
- **Erros**: `:warning: <mensagem>` em stderr; exit code `2` (validação) ou `3` (banco).

## Persistência

- `data/coworker.db` (schema v1). Tabelas: `todo_column` (seed via `config/todo.yaml`), `todo_card` (CRUD).
- Sem soft delete. `rm` é destrutivo.
- Banco gitignored (`/data/` em `.gitignore`).

## Restrições

- **Não** escreve em Confluence, Jira ou Google Workspace.
- **Não** lê nem escreve em canais Slack além do `SLACK_TRIGGER_CHANNEL_NAME`.
- Scripts Python usam apenas stdlib + `sqlite3`. Sem HTTP, sem libs externas.
- Idioma pt-BR em todos os artefatos.

## Configs lidas

- `config/todo.yaml`: colunas, `default_column`, `labels_suggested`.
- `MEMORY.md`: `SQLITE_DB`, `TODO_CONFIG_PATH`, `WEB_APP_EXPECTED_SCHEMA_VERSION` (validação cruzada com Dashboard).

## Integração com Cowork Dashboard

A skill grava no mesmo SQLite que o app web (`web/cowork/`). DDL é responsabilidade exclusiva do Coworker (esta skill / `migrate.py`); o Dashboard só faz DML.

Subir o Dashboard: `bin/web-up`. Acesso em `http://localhost:3000` (ou porta indicada no `MEMORY.md`).

## Riscos & Mitigações

| Risco | Mitigação |
|---|---|
| Lock SQLite (Python + Node simultâneos) | `busy_timeout=2000` em ambos; transações curtas. |
| `rm` irreversível | Confirmação interativa; `--force` explícito em scripts. Documentado neste help. |
| Drift de schema vs Dashboard | `_schema_meta.version` validado pelo Dashboard (fail-fast). Skill rodar `migrate.py` quando schema mudar. |
