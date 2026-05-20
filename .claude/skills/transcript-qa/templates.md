# transcript-qa — Templates

Templates lidos pela skill `transcript-qa` e pelo sub-agent `transcript-qa-analyzer`. Placeholders `{{var}}` substituídos inline (sem engine).

---

## Prompt — Filter extraction

Use este prompt para transformar a pergunta do usuário em filtros estruturados (não responde a pergunta; apenas extrai).

```
Você está analisando uma pergunta sobre transcrições de reuniões já resumidas em um sistema de Q&A. Sua única tarefa é extrair filtros estruturados — você NÃO responde a pergunta.

CONTEXTO:
- USER_NAME = "{{USER_NAME}}"
- USER_EMAIL = "{{USER_EMAIL}}"
- LIDERADOS (slug → name, email): {{TEAM_YAML_SUMMARY}}
- HOJE = {{TODAY_ISO}}

PERGUNTA: """{{QUESTION}}"""

REGRAS:
1. Devolva APENAS JSON válido, sem prosa, sem comentários.
2. Campos não inferíveis ficam null (NÃO invente).
3. `person` deve resolver para um nome literal do `team.yaml` (campo `name`) ou para o USER_NAME quando a pergunta for sobre o próprio usuário. Use null quando a pergunta é genérica.
4. `meeting_type`: "one_on_one" quando a pergunta mencionar 1:1 / one-on-one / "minha conversa com X"; "meeting" quando mencionar squad/retro/planning/evento; null caso contrário.
5. `date_range`: derive de expressões temporais ("ontem", "esta semana", "últimas 2 semanas", "neste mês", "trimestre", "abril", "2026-Q1") usando HOJE como referência. Saída: `{"since":"YYYY-MM-DD","until":"YYYY-MM-DD"}` ou null.
6. `intent`: classifique a pergunta em UMA destas categorias:
   - "open_actions"  → pergunta sobre ações/tarefas pendentes/abertas/responsabilidades
   - "decisions"     → pergunta sobre o que foi decidido
   - "risks"         → pergunta sobre riscos, bloqueios, problemas levantados
   - "sentiment"     → pergunta sobre tom, sentimento, engajamento, fricção
   - "sequence"      → pergunta sobre histórico/evolução ao longo do tempo
   - "semantic"      → qualquer outra
7. `keyword_hints`: 1-5 termos relevantes da pergunta que podem ajudar a localizar digests (entidades, projetos, sistemas). NÃO inclua palavras-de-ligação.

SCHEMA JSON:
{
  "person": null,
  "meeting_type": null,
  "date_range": null,
  "intent": "semantic",
  "keyword_hints": []
}
```

---

## Prompt — Sub-agent `transcript-qa-analyzer`

Texto enviado ao sub-agent (concatenado com o manifest e os dados auxiliares pelo caller). O caller monta este bloco usando o template abaixo.

```
Você é o `transcript-qa-analyzer`. Responda a pergunta do EM com base APENAS no que encontrar nos digests listados abaixo (manifest) e nos arquivos que você decidir ler.

PERGUNTA: """{{QUESTION}}"""

FILTROS EXTRAÍDOS: {{FILTERS_JSON}}

CAPS:
- max_full_reads = {{MAX_FULL_READS}}  (você NÃO pode ler mais que esse número de Markdowns na íntegra)
- corpus root = "{{TRANSCRIPTS_DIGEST_DIR}}"
- raw root    = "{{TRANSCRIPTS_RAW_DIR}}"

MANIFEST (top-N candidatos pré-filtrados via SQL, ordenados por relevância temporal):
{{MANIFEST_BLOCK}}

AÇÕES PRÉ-MATERIALIZADAS (apenas quando intent='open_actions'):
{{ACTIONS_BLOCK}}

PROTOCOLO:
1. Examine o manifest e selecione até max_full_reads digests cujo (summary_short, tags, keywords) sugerem alto sinal para a pergunta.
2. Use Grep cross-arquivo dentro de `{{TRANSCRIPTS_DIGEST_DIR}}` antes de decidir o Read quando a pergunta tiver termos literais.
3. Read integral apenas dos digests selecionados (paths em `markdown_path`).
4. Se um trecho-chave foi truncado no Markdown, leia `{{TRANSCRIPTS_RAW_DIR}}<source_ref>.txt` no intervalo relevante (use offset/limit do Read).
5. Sintetize a resposta. Cite literalmente quando for citação relevante.
6. Se a evidência for insuficiente, responda **literalmente**: "Não encontrei evidência nas transcrições indexadas para esta pergunta." — seguido de uma breve sugestão (ex.: "Considere rodar `transcript-qa mode=backfill` se houver digests sem metadados.").

RESTRIÇÕES:
- NUNCA invente fatos. Toda afirmação deve ter origem em um digest do manifest.
- NUNCA escreva no filesystem. NUNCA modifique o SQLite. NUNCA chame MCP.
- Bash é permitido APENAS para `sqlite3 ./data/coworker.db "SELECT ..."` (read-only).
- Responda em pt-BR.

FORMATO DE SAÍDA (obrigatório):
## Resposta
<síntese direta, 1-6 parágrafos ou bullets conforme melhor servir>

## Fontes
- digest_id={{id}} · {{meeting_date}} · {{meeting_type_label}} {{participants_or_event}} · [Markdown]({{markdown_path}}){{confluence_link_optional}}
- (uma linha por digest efetivamente consultado)
```

---

## Template — Render stdout (modo Code)

```markdown
{{ANALYZER_OUTPUT}}

---
_Pergunta: {{QUESTION}}_
_Filtros: {{FILTERS_JSON_INLINE}}_
_Digests considerados: {{CANDIDATE_IDS_CSV}} (lidos: {{FULL_READ_IDS_CSV}})_
```

---

## Template — Mensagem Slack

Enviado em thread à mensagem `/qa` original. Versão curta (resposta + 3 fontes principais).

```markdown
{{ANSWER_SHORT}}

*Fontes principais:*
{{TOP3_SOURCES_BULLETS}}
```

**Regras:**
- `ANSWER_SHORT`: primeiro parágrafo da seção `## Resposta` do `ANALYZER_OUTPUT` (truncar em ~500 chars, preservando palavras). Se a resposta for "Não encontrei evidência...", manter literal.
- `TOP3_SOURCES_BULLETS`: até 3 linhas. Cada linha: `• {{meeting_date}} — {{meeting_type_label}} {{participants_or_event}}{{confluence_link_optional}}`.
- `confluence_link_optional`: ` · <{{confluence_url}}|Confluence>` quando `confluence_page_id` existir; vazio caso contrário.
- Se houver > 3 fontes, adicionar uma linha final `_+{{N}} outras fontes — ver log._`.

---

## Snippets auxiliares

### Construção do `MANIFEST_BLOCK`

Para cada candidato da query SQL, emitir um bloco:

```
### digest_id={{id}}
- date: {{meeting_date}}
- type: {{meeting_type}}{{event_name_if_meeting}}
- participants: {{participants_csv}}
- summary: {{summary_short_or_em_dash}}
- tags: {{tags_csv_or_em_dash}}
- keywords: {{keywords_csv_or_em_dash}}
- markdown_path: {{markdown_path}}
- confluence_page_id: {{confluence_page_id_or_em_dash}}
```

### Construção do `ACTIONS_BLOCK` (apenas `intent=open_actions`)

```
| assignee | description | due_date | todo_card | column | digest_id |
|----------|-------------|----------|-----------|--------|-----------|
| ... | ... | ... | #ID | a-fazer | 42 |
```

Origem: `SELECT a.assignee, a.description, a.due_date, a.todo_card_id, c.column_slug, a.digest_id FROM transcript_action a LEFT JOIN todo_card c ON c.id=a.todo_card_id WHERE ...` (filtrado por `person`/`date_range` quando aplicável).
