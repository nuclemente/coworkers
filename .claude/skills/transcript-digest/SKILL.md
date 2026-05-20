---
name: transcript-digest
description: Resume transcrições de reuniões (1:1, squad, ad-hoc) de Google Drive, arquivo local ou Gmail (gemini-notes@google.com); gera digest estruturado em Markdown + Confluence (espaço privado) + Slack condicional; cria cards no `todo` para acionáveis atribuídos ao usuário. Use quando o usuário pedir "resumir transcrição", "digest da reunião", "transcript-digest", quando rodar `/digest source=...` no canal `clemente-cowork`, ou ao drenar a fila `transcript_job` do Cowork Dashboard.
---

# transcript-digest

Skill orquestradora — não tem scripts Python proprietários. Todo o trabalho é feito por Claude lendo este `SKILL.md` e invocando MCP tools, Bash (`sqlite3`, `shasum`, `find`), Read/Write e a skill `todo`.

## Pré-leitura obrigatória

Antes de qualquer execução, ler nesta ordem:

1. `MEMORY.md` — extrair `USER_NAME`, `USER_EMAIL`, `CONFLUENCE_PRIVATE_SPACE_KEY`, `CONFLUENCE_CLOUD_ID`, `CONFLUENCE_MEETINGS_PARENT_PAGE_ID`, `GMAIL_TRANSCRIPT_SENDER`, `SQLITE_DB`, `TRANSCRIPTS_RAW_DIR`, `TRANSCRIPTS_DIGEST_DIR`, `TRANSCRIPT_DIGEST_LOG`, `TRANSCRIPT_EXTRACTOR_DELEGATE_THRESHOLD_CHARS`, `SLACK_TRIGGER_CHANNEL_NAME`, `SLACK_TRIGGER_CHANNEL_ID`.
2. `CLAUDE.md` — regras críticas (Confluence só no espaço privado; Slack só no canal de trigger; pt-BR; dados sensíveis em `/data/`).
3. `config/team.yaml` — lista de liderados com `id`, `name`, `email`.
4. `.claude/skills/transcript-digest/templates.md` — só na etapa de renderização.

## Parâmetros de invocação

| Param | Valores | Obrigatório | Descrição |
|-------|---------|-------------|-----------|
| `source` | `local` \| `drive` \| `gmail` \| `queue` | **sim** | Fonte da transcrição. `queue` drena `transcript_job` com `status='queued'`. |
| `ref` | string | depende | `local`: path. `drive`: file_id ou URL. `gmail`: message_id (opcional — se ausente, varre não-processados do `GMAIL_TRANSCRIPT_SENDER`). |
| `trigger_source` | `slack` \| `code` \| `cowork` | **sim** | Origem do trigger. Determina se o renderer Slack é ativado. |

Validar `source` no início. Se ausente ou inválido, abortar com mensagem clara: `❌ "source" é obrigatório (local|drive|gmail|queue).`

## Migração do schema (idempotente)

Na primeira execução de cada sessão, aplicar o DDL abaixo via Bash. `CREATE TABLE IF NOT EXISTS` torna a operação segura para reexecução.

```bash
sqlite3 ./data/coworker.db <<'SQL'
CREATE TABLE IF NOT EXISTS transcript_digest (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('drive','local','gmail')),
  source_ref TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('one_on_one','meeting')),
  event_name TEXT,
  meeting_date TEXT NOT NULL,
  participants TEXT,
  markdown_path TEXT NOT NULL,
  confluence_page_id TEXT,
  slack_message_ts TEXT,
  trigger_source TEXT NOT NULL CHECK (trigger_source IN ('slack','code','cowork')),
  status TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','partial','failed')),
  error_log TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (source_type, source_ref, version)
);
CREATE INDEX IF NOT EXISTS idx_transcript_digest_hash ON transcript_digest(content_hash);
CREATE INDEX IF NOT EXISTS idx_transcript_digest_date ON transcript_digest(meeting_date);
CREATE INDEX IF NOT EXISTS idx_transcript_digest_participants ON transcript_digest(participants);

CREATE TABLE IF NOT EXISTS transcript_action (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  digest_id INTEGER NOT NULL REFERENCES transcript_digest(id),
  assignee TEXT NOT NULL,
  description TEXT NOT NULL,
  due_date TEXT,
  todo_card_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transcript_action_digest ON transcript_action(digest_id);

CREATE TABLE IF NOT EXISTS transcript_job (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL CHECK (source IN ('local','drive','gmail')),
  ref TEXT,
  requested_via TEXT NOT NULL DEFAULT 'cowork' CHECK (requested_via IN ('cowork','code','slack')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','done','failed','skipped')),
  digest_id INTEGER REFERENCES transcript_digest(id),
  error_log TEXT,
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_transcript_job_status ON transcript_job(status);
SQL
```

Depois do bloco acima, aplicar as **colunas opcionais de QA** (`summary_short`, `topics_json`, `tags_json`, `keywords_json`) com `ALTER TABLE` condicional — `ALTER TABLE ... ADD COLUMN` não suporta `IF NOT EXISTS`, então inspecionar via `PRAGMA table_info` antes:

```bash
existing=$(sqlite3 ./data/coworker.db "SELECT name FROM pragma_table_info('transcript_digest')")
for col_spec in \
  "summary_short:TEXT" \
  "topics_json:TEXT" \
  "tags_json:TEXT" \
  "keywords_json:TEXT"; do
  col="${col_spec%%:*}"; typ="${col_spec##*:}"
  if ! grep -qx "$col" <<<"$existing"; then
    sqlite3 ./data/coworker.db "ALTER TABLE transcript_digest ADD COLUMN $col $typ"
  fi
done
```

> Essas 4 colunas alimentam a skill `transcript-qa` (Q&A agêntico). Ficam **NULL** em digests gerados antes desta atualização — o backfill é feito por `transcript-qa mode=backfill`.

## Workflow `run`

### 1. Validar parâmetros
- `source` ∈ {`local`,`drive`,`gmail`,`queue`}; se ausente/inválido → abort.
- `trigger_source` ∈ {`slack`,`code`,`cowork`}; default lógico depende do contexto da invocação.

### 2. Aplicar migração do schema (idempotente)

### 3. Resolver entradas (conteúdo bruto)

| `source` | Como obter | Como popular `source_ref` |
|----------|-----------|---------------------------|
| `local`  | `Read <ref>` | `ref` (caminho absoluto após resolução) |
| `drive`  | `mcp__google-workspace__drive_search` (se URL) → extrai `file_id`; `mcp__google-workspace__drive_downloadFile` → path temp em `TRANSCRIPTS_RAW_DIR/<file_id>.txt`; depois `Read` | `file_id` |
| `gmail` (com `ref`) | `mcp__google-workspace__gmail_get messageId=<ref>` → identifica anexo → `mcp__google-workspace__gmail_downloadAttachment` em `TRANSCRIPTS_RAW_DIR/<message_id>.txt`; `Read` | `message_id` |
| `gmail` (sem `ref`) | `mcp__google-workspace__gmail_search query="from:<GMAIL_TRANSCRIPT_SENDER> has:attachment"` → para cada `message_id` que **não** esteja em `transcript_digest`, recursar com `ref=<message_id>` | (por item) |
| `queue` | `sqlite3 ./data/coworker.db "SELECT id,source,ref FROM transcript_job WHERE status='queued' ORDER BY requested_at"` → para cada job: `UPDATE transcript_job SET status='processing' WHERE id=?`, recursar com (`source`,`ref`) do job. Ao concluir: `UPDATE transcript_job SET status=?, digest_id=?, processed_at=datetime('now'), error_log=? WHERE id=?` | (por item) |

Salvar todos os brutos baixados em `TRANSCRIPTS_RAW_DIR` antes do hash.

### 4. Calcular `content_hash`
```bash
shasum -a 256 <path-do-bruto> | awk '{print $1}'
```

### 5. Dedup (DD3)
```bash
sqlite3 ./data/coworker.db "SELECT id, content_hash, MAX(version) AS max_version FROM transcript_digest WHERE source_type='<src>' AND source_ref='<ref>' GROUP BY source_type, source_ref"
```
- Sem linha → `version=1`, prosseguir.
- Hash idêntico → log `{"event":"already_processed","source":"<src>","ref":"<ref>","hash":"<hash>"}` em `TRANSCRIPT_DIGEST_LOG` e abortar com mensagem amigável.
- Hash diferente → `version = max_version + 1`. Markdown e Confluence ganham sufixo `-v<version>` (ex.: `2026-05-14-v2.md`).

### 6. Extrair digest estruturado

- Se `len(bruto) < TRANSCRIPT_EXTRACTOR_DELEGATE_THRESHOLD_CHARS` → Claude extrai inline, seguindo o prompt em `templates.md` → seção "Prompt de extração".
- Caso contrário → delegar ao sub-agent: `Agent(subagent_type="transcript-extractor", prompt=...)`.

Output esperado: JSON com `summary`, `topics`, `decisions`, `actions[]` (`assignee_name`, `assignee_email?`, `description`, `due_date?`, `originated_from_user?`), `risks`, `sentiment`, `next_steps`, `meeting_date` (`YYYY-MM-DD`), `event_name?`, `participants[]` (cada um: `name`, `email?`), **`tags[]`** (2-6 temas em pt-BR) e **`keywords[]`** (5-15 termos relevantes para recuperação posterior pela skill `transcript-qa`).

### 7. Match de participantes (PI2)

Para cada `participant` da extração:
1. Procurar em `config/team.yaml` por `email` (case-insensitive).
2. Se não achar, procurar por `name` exato.
3. Se achar → preencher `slug` com `id` do `team.yaml`.
4. Se não achar → manter `name` literal (sem prefixo). Status final do digest segue `ok`.

### 8. Determinar `meeting_type`

- Mapear o `USER_NAME`/`USER_EMAIL` para o conjunto de participantes.
- Se a transcrição tem **exatamente** 2 participantes — o usuário + 1 outro mapeado em `team.yaml` (liderado) → `meeting_type = one_on_one`.
- Caso contrário → `meeting_type = meeting`.

### 9. Calcular caminhos (filesystem + Confluence)

| Caso | Filesystem | Confluence (hierarquia) |
|------|-----------|-------------------------|
| 1:1 com `<Nome>` em `YYYY-MM-DD` | `TRANSCRIPTS_DIGEST_DIR<Nome>/1:1s/<YYYY-MM>/<YYYY-MM-DD>[v?].md` | `<Nome>` → `1:1s` → `<YYYY-MM>` → `Digest — <YYYY-MM-DD> — <Nome>[v?]` |
| Meeting `<Evento>` em `YYYY-MM-DD` | `TRANSCRIPTS_DIGEST_DIR<Meetings>/<Evento>/<YYYY-MM-DD>[v?].md` | `Meetings` → `<Evento>` → `Digest — <YYYY-MM-DD> — <Evento>[v?]` |

`<Nome>` = display literal do participante (do `team.yaml` quando mapeado, do JSON extraído caso contrário).

Sufixo de versão `-v2`, `-v3` (omite quando `version=1`). Colisão no mesmo dia/versão recebe `-2`, `-3`.

### 10. Renderizar e gravar Markdown

`Read .claude/skills/transcript-digest/templates.md` → seção "Template — Digest Markdown". Substituir placeholders inline. **Omitir seções cujo conteúdo da extração esteja vazio.** Gravar com `Write` no path calculado.

### 11. Publicar no Confluence

Verificar/criar ancestrais via `mcp__atlassian__getPagesInConfluenceSpace` filtrando por `spaceId = CONFLUENCE_PRIVATE_SPACE_KEY`:
- Caso 1:1: garantir página raiz `<Nome>`, filha `1:1s`, neta `<YYYY-MM>`.
- Caso meeting: garantir `Meetings` (cachear ID em `MEMORY.md` como `CONFLUENCE_MEETINGS_PARENT_PAGE_ID` se ausente) → filha `<Evento>`.

Quando criar um novo ancestral, registrar o `pageId` para reuso. Publicar a página final com `mcp__atlassian__createConfluencePage` (`contentFormat: "markdown"`). Persistir `confluence_page_id`.

> **REGRA CRÍTICA** — antes de qualquer `createConfluencePage`/`updateConfluencePage`, validar que `spaceId == CONFLUENCE_PRIVATE_SPACE_KEY`. Nunca escrever fora do espaço privado.

### 12. Slack (somente quando `trigger_source == 'slack'`)

`Read templates.md` → "Template — Mensagem Slack". Enviar via `mcp__plugin_slack_slack__slack_send_message` com:
- `channel_id = SLACK_TRIGGER_CHANNEL_ID`
- `thread_ts = <ts da mensagem /digest>` (recebido no contexto da invocação)

Persistir `slack_message_ts`.

### 13. Criar cards no `todo`

Para cada `action` cuja atribuição corresponda ao **usuário**:

**Match de identidade do usuário (regra obrigatória):**
- `assignee_email` (case-insensitive) == `USER_EMAIL` **OU**
- `assignee_name` (case-insensitive, contém) == `USER_NAME` **OU**
- `originated_from_user == true` (a fala que origina o acionável é do próprio usuário)

> **PROIBIDO:** atribuir ao usuário com base no papel "EM"/"Engineering Manager"/"gestor". O usuário participa de reuniões com outros EMs.

Para cada acionável que casar:
```
Skill(skill="todo", args="add '<description>' --col a-fazer --context '<reunião + trecho + link Confluence>' --due <due_date|nada> --source transcript")
```

Capturar o `card_id` retornado e persistir em `transcript_action.todo_card_id`.

### 14. Persistir

```bash
sqlite3 ./data/coworker.db <<SQL
INSERT INTO transcript_digest (
  source_type, source_ref, content_hash, version, meeting_type, event_name,
  meeting_date, participants, markdown_path, confluence_page_id, slack_message_ts,
  trigger_source, status, error_log,
  summary_short, topics_json, tags_json, keywords_json
)
VALUES (
  '<src>','<ref>','<hash>',<version>,'<mtype>',<event_or_null>,
  '<date>','<json_participants>','<md_path>',<page_id_or_null>,<ts_or_null>,
  '<trigger>','<status>',<err_or_null>,
  '<summary_short>','<topics_json>','<tags_json>','<keywords_json>'
);
SQL
```

**Preparo dos novos campos:**
- `summary_short` = primeiras ~300 chars de `extracao.summary` (preservando palavras inteiras). Aspas simples no SQL escapadas como `''`.
- `topics_json` = `json(extracao.topics)` — array JSON serializado como TEXT.
- `tags_json` = `json(extracao.tags)`.
- `keywords_json` = `json(extracao.keywords)`.

Para cada `transcript_action`:
```bash
sqlite3 ./data/coworker.db "INSERT INTO transcript_action (digest_id, assignee, description, due_date, todo_card_id) VALUES (?,?,?,?,?)"
```

### 15. Relatório final

| `trigger_source` | Como reportar |
|------------------|---------------|
| `slack`  | Mensagem em thread (template Slack já cobre). Se múltiplos digests (varredura Gmail), agregar em uma mensagem-resumo |
| `cowork` | stdout estruturado (`{digest_id, markdown_path, confluence_page_id, cards_created[]}`) — também já reflete em `transcript_job.status='done'` |
| `code`   | stdout em pt-BR, conciso, com paths e IDs |

## Tratamento de erros (falha aberta, isolada por item)

Toda exceção em qualquer etapa (extração, render, Confluence, Slack, todo) é capturada e registrada em `TRANSCRIPT_DIGEST_LOG` como linha JSON:

```json
{"ts":"<iso>","source":"<src>","ref":"<ref>","stage":"<stage>","error":"<msg>"}
```

- Falha em **extração** ou **persistência principal** → `status='failed'`; pular renderer e cards.
- Falha em **renderer/Confluence/Slack/todo** com digest persistido → `status='partial'`; relatório final lista o(s) stage(s) com falha.

Em modo `queue`, atualizar `transcript_job.status` e `error_log` correspondentes.

## Idempotência & re-run

- Mesmo `source_ref` + mesmo `content_hash` → no-op (log `already_processed`).
- Mesmo `source_ref` + hash diferente → nova `version`, Markdown/Confluence com sufixo `-v<n>`.
- Reexecução parcial após falha: o item permanece em `transcript_job.status='processing'` ou `failed`; reinvocar `source=queue` retoma.

## Anti-padrões

- ❌ Criar scripts Python proprietários — toda lógica vive aqui ou em MCP tools.
- ❌ Atribuir cards ao "EM" pelo papel — apenas por `USER_NAME`/`USER_EMAIL`/`originated_from_user`.
- ❌ Escrever em Confluence fora de `CONFLUENCE_PRIVATE_SPACE_KEY`.
- ❌ Enviar Slack quando `trigger_source != 'slack'`.
- ❌ Slugificar nomes de pastas/páginas (`<Nome>`/`<Evento>` mantém forma humana).
- ❌ Falhar a execução inteira por causa de um item — falha aberta, isolada, logada.
