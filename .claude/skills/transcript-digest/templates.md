# transcript-digest — Templates

Templates lidos por Claude na execução da skill. Placeholders `{{var}}` são substituídos inline (sem engine de template). Seções com placeholder vazio são removidas antes de gravar.

---

## Prompt de extração

Use este prompt para produzir o JSON estruturado a partir do texto bruto da transcrição. Aplicável tanto à extração inline (skill) quanto ao sub-agent `transcript-extractor`.

```
Você está extraindo um digest estruturado de uma transcrição de reunião em pt-BR.

CONTEXTO:
- USER_NAME = "{{USER_NAME}}"  (o usuário do Coworker; pode ou não ter participado)
- USER_EMAIL = "{{USER_EMAIL}}"
- LIDERADOS (slug → name, email): {{TEAM_YAML_SUMMARY}}

REGRAS:
1. Devolva APENAS JSON válido, sem comentários nem prosa.
2. Campos vazios (sem evidência na transcrição) devem ser arrays vazios ou string vazia — NÃO invente.
3. Para cada `action`, identifique o `assignee_name` exatamente como aparece na fala. Se houver e-mail explícito, preencha `assignee_email`. Use `originated_from_user=true` somente quando a ação for um compromisso assumido pelo próprio USER_NAME na primeira pessoa.
4. NUNCA atribua ao USER por papel ("EM", "gestor", "manager"). Atribua pelo nome/e-mail literal ou por compromisso na primeira pessoa do USER.
5. `meeting_date` no formato `YYYY-MM-DD`. Se a transcrição não mencionar data, use a data do arquivo/e-mail informada no contexto.
6. `participants` lista todos os nomes mencionados ou identificáveis na transcrição.
7. `event_name` é o nome do evento (squad sync, ad-hoc) quando a reunião NÃO for 1:1. Para 1:1, deixe vazio.
8. `sentiment` é um bloco curto (1-3 frases) descrevendo tom geral, sinais de fricção/engajamento, gatilhos emocionais. Aplicável a qualquer tipo de reunião.
9. `tags` é uma lista de 2 a 6 temas/áreas que descrevem a reunião em alto nível (ex.: "onboarding", "performance", "arquitetura", "incidente", "carreira", "1:1", "planning"). Use rótulos curtos em pt-BR, kebab-case opcional. NÃO invente — somente o que ficar evidente.
10. `keywords` é uma lista de 5 a 15 termos relevantes mencionados na transcrição (nomes de sistemas, projetos, conceitos, decisões-chave). NÃO incluir nomes de pessoas (já estão em `participants`). NÃO incluir stopwords. Sirva para recuperação posterior por busca lexical/agêntica.

SCHEMA JSON:
{
  "meeting_date": "YYYY-MM-DD",
  "event_name": "",
  "participants": [
    { "name": "...", "email": "..." }
  ],
  "summary": "...",
  "topics": ["..."],
  "decisions": ["..."],
  "actions": [
    {
      "assignee_name": "...",
      "assignee_email": "",
      "description": "...",
      "due_date": "",
      "originated_from_user": false
    }
  ],
  "risks": ["..."],
  "sentiment": "...",
  "next_steps": ["..."],
  "tags": ["..."],
  "keywords": ["..."]
}

TRANSCRIÇÃO:
<<<
{{RAW_TRANSCRIPT}}
>>>
```

---

## Template — Digest Markdown

Arquivo gravado em `TRANSCRIPTS_DIGEST_DIR<hierarquia>/<YYYY-MM-DD>[-v<n>].md`.

```markdown
# Digest — {{meeting_type_label}} — {{participants_or_event}} — {{meeting_date}}

> Fonte: {{source_type}}:{{source_ref}} · Hash: {{content_hash_short}} · Versão: {{version}}

## Resumo executivo
{{summary}}

## Tópicos discutidos
{{topics_bullets}}

## Decisões
{{decisions_bullets}}

## Acionáveis
| Quem | O quê | Quando | Card |
|------|-------|--------|------|
{{actions_table_rows}}

## Riscos & bloqueios
{{risks_bullets}}

## Sentimento / sinais
{{sentiment_block}}

## Próximos passos
{{next_steps_bullets}}
```

**Regras de renderização:**
- `meeting_type_label` = `"1:1"` ou `"Reunião"`.
- `participants_or_event` = nome do liderado (1:1) ou `event_name` (meeting).
- `content_hash_short` = 8 primeiros chars do hash.
- `actions_table_rows`: cada linha `| {{assignee_name}} | {{description}} | {{due_date_or_dash}} | {{card_link_or_dash}} |`. `card_link_or_dash` = `#<card_id>` quando virou card; `—` caso contrário.
- Bullets: gerar `- {{item}}` por linha.
- **Omitir a seção inteira** (heading incluso) quando o conteúdo for vazio.

---

## Template — Página Confluence

Mesmo corpo do Markdown acima — Confluence aceita `contentFormat: "markdown"`. Título canônico:

```
Digest — {{meeting_date}} — {{participants_or_event}}[ (v{{version}})]
```

Sufixo `(v2)`, `(v3)` aparece somente quando `version > 1`.

`parentId` é o ID da página `<YYYY-MM>` (para 1:1) ou `<Evento>` (para meeting). Skill é responsável por criar ancestrais ausentes via `getPagesInConfluenceSpace` + `createConfluencePage`.

> **Validar antes de criar:** `spaceId == CONFLUENCE_PRIVATE_SPACE_KEY`.

---

## Template — Mensagem Slack

Aplicado **apenas** quando `trigger_source == 'slack'`. Enviado em thread à mensagem original `/digest`.

```markdown
*Digest — {{meeting_type_label}} — {{participants_or_event}} — {{meeting_date}}*

> {{summary_oneliner}}

*Seus acionáveis:*
{{user_actions_bullets_with_card_links}}

🔗 <{{confluence_url}}|Digest completo>
```

**Regras:**
- `summary_oneliner` = primeira frase de `summary` ou os primeiros ~200 chars.
- `user_actions_bullets_with_card_links`: cada bullet `• {{description}} → <{{cowork_card_url}}|#{{card_id}}>`. Se não houver acionável do usuário, substituir o bloco inteiro por `_Nenhum acionável atribuído a você._`.
- `confluence_url`: URL completa da página criada.

Em modo varredura Gmail (múltiplos digests), enviar **uma única mensagem-resumo** com lista de digests gerados (data · participantes/evento · link), em vez de N mensagens.
