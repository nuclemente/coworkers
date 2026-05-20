---
name: transcript-qa
description: Responde perguntas em linguagem natural sobre transcrições já resumidas pela skill `transcript-digest`, navegando o corpus de digests via sub-agent (`transcript-qa-analyzer`). Sem embeddings, sem vector store — apenas pré-filtragem SQL + leitura agêntica. Use quando o usuário pedir "pergunta sobre transcrições", "o que rolou em X", "ações pendentes com Y", "transcript-qa", quando rodar `/qa <pergunta>` no canal `clemente-cowork`, ou para fazer backfill dos metadados de QA (`mode=backfill`).
---

# transcript-qa

Skill orquestradora — sem scripts proprietários. Todo o trabalho é feito por Claude lendo este `SKILL.md`, executando Bash (`sqlite3`), Read/Glob/Grep, MCP Slack quando aplicável e o sub-agent `transcript-qa-analyzer`.

## Pré-leitura obrigatória

Antes de qualquer execução:

1. `MEMORY.md` — `USER_NAME`, `USER_EMAIL`, `SQLITE_DB`, `TRANSCRIPTS_DIGEST_DIR`, `TRANSCRIPTS_RAW_DIR`, `TRANSCRIPT_QA_LOG`, `TRANSCRIPT_QA_MAX_CANDIDATES`, `TRANSCRIPT_QA_MAX_FULL_READS`, `SLACK_TRIGGER_CHANNEL_ID`, `CONFLUENCE_PRIVATE_SPACE_KEY`, `CONFLUENCE_CLOUD_ID`.
2. `CLAUDE.md` — regras críticas (Slack só no canal de trigger; pt-BR; dados sensíveis em `/data/`).
3. `config/team.yaml` — lista de liderados (`id`, `name`, `email`).
4. `.claude/skills/transcript-qa/templates.md` — só na etapa de composição.

## Parâmetros de invocação

| Param | Valores | Obrigatório | Descrição |
|-------|---------|-------------|-----------|
| `question` | string | **sim** (exceto em `mode=backfill`) | Pergunta em linguagem natural. |
| `mode` | `query` \| `backfill` | não (default `query`) | `backfill` re-extrai metadados de QA de digests pré-existentes. |
| `trigger_source` | `slack` \| `code` | não (default `code`) | Determina se a resposta vai pro Slack ou stdout. |
| `person` | string | não | Override do filtro de pessoa (nome do liderado ou USER_NAME). |
| `since` / `until` | `YYYY-MM-DD` | não | Override do filtro de data. |
| `top_k` | int | não | Override de `TRANSCRIPT_QA_MAX_CANDIDATES`. |

Validar parâmetros no início:
- `mode=query` sem `question` → abortar: `❌ "question" é obrigatório no modo query.`
- `trigger_source ∉ {slack,code}` → abortar.
- `slack` deve sempre vir acompanhado do `thread_ts` da mensagem `/qa` original; caso contrário, fallback para `code` com warning no log.

## Migração do schema (idempotente)

Verifica/adiciona as 4 colunas opcionais em `transcript_digest` que alimentam o manifest. **A skill `transcript-digest` já é responsável por aplicar este DDL** na sua execução normal, mas reaplicamos aqui para o caso em que `transcript-qa` for invocada antes de qualquer execução nova de `transcript-digest`.

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
sqlite3 ./data/coworker.db "CREATE INDEX IF NOT EXISTS idx_transcript_digest_participants ON transcript_digest(participants);"
```

## Workflow `mode=query`

### 1. Validar parâmetros e aplicar migração

### 2. Extrair filtros estruturados

Compor o prompt a partir de `templates.md` → "Prompt — Filter extraction" substituindo `{{USER_NAME}}`, `{{USER_EMAIL}}`, `{{TEAM_YAML_SUMMARY}}`, `{{TODAY_ISO}}` (use `date +%F`), `{{QUESTION}}`. Produzir o JSON inline (Claude resolve em raciocínio próprio).

Aplicar overrides explícitos dos parâmetros: se `person`/`since`/`until` foram passados, sobrescrever os valores extraídos.

### 3. Resolver `person`

- Se `person` é não-nulo e diferente de `USER_NAME`, procurar em `config/team.yaml` por `name` exato. Se não bater, tentar substring case-insensitive.
- Persistir `person_resolved` (nome canônico do `team.yaml` ou `USER_NAME`).

### 4. Pré-filtragem SQL — candidatos

```bash
sqlite3 -separator $'\t' ./data/coworker.db <<SQL
SELECT id, meeting_date, meeting_type, COALESCE(event_name,''),
       COALESCE(participants,''), markdown_path,
       COALESCE(summary_short,''), COALESCE(topics_json,'[]'),
       COALESCE(tags_json,'[]'), COALESCE(keywords_json,'[]'),
       COALESCE(confluence_page_id,'')
  FROM transcript_digest
 WHERE status = 'ok'
   AND (:person IS NULL OR participants LIKE '%' || :person || '%')
   AND (:meeting_type IS NULL OR meeting_type = :meeting_type)
   AND (:since IS NULL OR meeting_date >= :since)
   AND (:until IS NULL OR meeting_date <= :until)
 ORDER BY meeting_date DESC
 LIMIT :max_candidates;
SQL
```

> `:person` é tratado como parte do JSON-string em `participants`. Quando o JSON usar a forma `{"name":"..."}`, ainda há match por LIKE (a string literal aparece). Mesma estratégia já validada em `transcript-digest`.

**Refinar com keyword_hints** (opcional, intent ≠ open_actions): se `keyword_hints` não-vazio, aplicar um segundo passo no resultado — reordenar prioritariamente os candidatos cujos `keywords_json` ou `tags_json` contiverem pelo menos um hint (case-insensitive). Não descartar quem não bate; apenas priorizar.

**Aviso de backfill:** se algum candidato tem `summary_short IS NULL`, anotar no log `{"event":"missing_qa_metadata","digest_ids":[...]}` e adicionar na resposta final um rodapé `_⚠️ Alguns digests não têm metadados de QA; rode `transcript-qa mode=backfill` para melhorar a recuperação._`

### 5. Query auxiliar — `intent=open_actions`

```bash
sqlite3 -separator $'\t' ./data/coworker.db <<SQL
SELECT a.assignee, a.description, COALESCE(a.due_date,''),
       COALESCE(a.todo_card_id,0), COALESCE(c.column_slug,''),
       a.digest_id
  FROM transcript_action a
  LEFT JOIN todo_card c ON c.id = a.todo_card_id
 WHERE (:person IS NULL OR a.assignee LIKE '%' || :person || '%')
   AND (:since IS NULL OR a.due_date IS NULL OR a.due_date >= :since)
   AND (:until IS NULL OR a.due_date IS NULL OR a.due_date <= :until)
   -- "abertas" = sem card OU card fora de coluna terminal
   AND (a.todo_card_id IS NULL OR c.column_slug NOT IN ('feito','arquivado','done'))
 ORDER BY a.created_at DESC
 LIMIT 50;
SQL
```

Materializar em uma tabela ASCII para o sub-agent (template `ACTIONS_BLOCK`). Se intent ≠ open_actions, omitir esta etapa.

### 6. Montar `MANIFEST_BLOCK`

Para cada candidato, gerar o bloco descrito em `templates.md` → "Construção do MANIFEST_BLOCK". `summary_short` em campo vazio → `—`. `tags`/`keywords` JSON arrays → CSV.

### 7. Delegar ao sub-agent

```
Agent(subagent_type="transcript-qa-analyzer", prompt=<resultado do template "Prompt — Sub-agent">)
```

O sub-agent retorna Markdown com `## Resposta` + `## Fontes`. Capturar a lista de `digest_id`s efetivamente citados em `## Fontes` (parse simples por regex `digest_id=(\d+)`) para o log.

### 8. Renderizar resposta

| `trigger_source` | Como reportar |
|------------------|---------------|
| `code` | stdout via template "Render stdout (modo Code)" em `templates.md`. |
| `slack` | Mensagem em thread no canal `SLACK_TRIGGER_CHANNEL_ID` via template "Mensagem Slack". |

**Validação Slack obrigatória** antes de chamar `mcp__plugin_slack_slack__slack_send_message`:
- `channel_id == SLACK_TRIGGER_CHANNEL_ID` (lido de MEMORY.md). Se divergir, abortar e logar.
- `thread_ts` sempre presente.

### 9. Log estruturado

Append em `TRANSCRIPT_QA_LOG` (JSON lines, uma linha):

```json
{"ts":"<iso8601>","trigger_source":"<src>","question":"<q>","filters":{...},"candidate_ids":[...],"full_read_ids":[...],"answer_chars":<int>,"latency_ms":<int>,"status":"ok|no_evidence|error"}
```

`status=no_evidence` quando a resposta do sub-agent começa com "Não encontrei evidência". `status=error` em qualquer exceção; mensagem em campo extra `error`.

## Workflow `mode=backfill`

Re-extrai os 4 campos de QA (`summary_short`, `topics_json`, `tags_json`, `keywords_json`) para digests pré-existentes com algum desses campos `NULL`. Reentrável e idempotente.

### 1. Listar pendentes

```bash
sqlite3 -separator $'\t' ./data/coworker.db <<'SQL'
SELECT id, markdown_path
  FROM transcript_digest
 WHERE summary_short IS NULL
    OR topics_json   IS NULL
    OR tags_json     IS NULL
    OR keywords_json IS NULL
 ORDER BY id;
SQL
```

Se a lista estiver vazia, encerrar com mensagem `Nada para fazer — todos os digests têm metadados de QA.`

### 2. Para cada digest pendente

1. `Read` o Markdown em `markdown_path`.
2. Extração inline com prompt **reduzido** (mais barato que reabrir o raw): peça apenas os 4 campos, sem repetir o JSON completo do digest. Template embutido:
   ```
   Você está re-extraindo metadados de QA de um digest Markdown JÁ resumido (não da transcrição original).
   Devolva APENAS JSON: {"summary_short": "...", "topics": [...], "tags": [...], "keywords": [...]}.
   Regras:
   - summary_short = 1 a 3 frases capturando a essência (~250-300 chars).
   - topics = 3-10 itens curtos (frases nominais).
   - tags = 2-6 temas em pt-BR.
   - keywords = 5-15 termos relevantes para recuperação posterior (sem pessoas, sem stopwords).
   DIGEST:
   <<<
   {{MARKDOWN_BODY}}
   >>>
   ```
3. UPDATE:
   ```bash
   sqlite3 ./data/coworker.db "UPDATE transcript_digest SET summary_short=?, topics_json=?, tags_json=?, keywords_json=? WHERE id=?"
   ```
4. Log `{"event":"backfill_one","digest_id":<id>}` em `TRANSCRIPT_QA_LOG`.
5. Em falha (Markdown ausente, JSON inválido, etc.), logar `{"event":"backfill_skip","digest_id":<id>,"error":"<msg>"}` e seguir.

### 3. Relatório final

Stdout (modo `code`) ou thread Slack (se invocado com `trigger_source=slack` no backfill):

```
Backfill QA — {{N_PROCESSED}} digest(s) atualizado(s), {{N_SKIPPED}} pulado(s).
```

## Tratamento de erros

| Stage | Em caso de falha |
|-------|------------------|
| Migração | Abortar com mensagem — alguma coisa muito errada no DB. |
| Filter extraction | Continuar com filtros vazios; log warning. |
| SQL candidatos | Abortar — sem candidatos não há resposta. |
| Sub-agent | Logar erro, retornar mensagem genérica "Não consegui processar a pergunta agora." em `trigger_source=slack` (thread) ou stdout (`code`). |
| Slack post | Logar erro; fallback para stdout. |

## Idempotência

- `mode=query` é puro (sem side-effects além do log).
- `mode=backfill` é re-entrável: digests já completos são pulados pelo WHERE.

## Anti-padrões

- ❌ Inventar resposta sem evidência — o sub-agent é instruído a responder "Não encontrei evidência..." quando aplicável.
- ❌ Postar Slack em canal diferente de `SLACK_TRIGGER_CHANNEL_ID`.
- ❌ Postar Slack quando `trigger_source != 'slack'`.
- ❌ Permitir escrita do sub-agent no SQLite ou no filesystem (sub-agent só tem Read/Grep/Glob + Bash read-only).
- ❌ Carregar TODOS os digests no contexto — sempre pré-filtrar via SQL e respeitar `TRANSCRIPT_QA_MAX_CANDIDATES` / `TRANSCRIPT_QA_MAX_FULL_READS`.
- ❌ Slugificar nomes nas fontes — preservar forma humana (mesma regra da `transcript-digest`).
- ❌ Re-rodar extração via raw text no backfill quando o Markdown do digest já existe (o digest é a fonte canônica desta etapa).
