# Coworker — instruções do projeto

Assistente do Engineering Manager. **Leia `SPEC.md` para entender a arquitetura e `MEMORY.md` para chaves, IDs e paths.**

## Documentos de referência (obrigatório consultar antes de agir)

- [`SPEC.md`](./SPEC.md) — arquitetura, acceptance criteria, processo de construção de features.
- [`MEMORY.md`](./MEMORY.md) — configurações fixas: `CONFLUENCE_PRIVATE_SPACE`, canal Slack de trigger, project keys de Jira, paths.
- [`config/team.yaml`](./config/team.yaml) — lista de liderados e seus IDs externos.

## Regras críticas (não negociáveis)

### 1. Escrita em Confluence — espaço privado exclusivamente

Toda escrita em Confluence (página, comentário, anexo) **DEVE** ocorrer **EXCLUSIVAMENTE** no espaço definido em `MEMORY.md` como `CONFLUENCE_PRIVATE_SPACE_KEY` / `CONFLUENCE_PRIVATE_SPACE_URL`.

**Nunca escrever fora desse espaço.** Antes de qualquer chamada a `mcp__atlassian__createConfluencePage`, `updateConfluencePage`, `createConfluenceFooterComment` ou `createConfluenceInlineComment`, verificar que o `spaceId` corresponde ao privado lido de `MEMORY.md`. Leitura em outros espaços é permitida; escrita não.

### 2. Trigger Slack — canal único

Skills automatizadas (Loop/Schedule) leem **apenas** o canal definido em `MEMORY.md` como `SLACK_TRIGGER_CHANNEL_NAME` / `SLACK_TRIGGER_CHANNEL_ID`. Mensagens de outros canais são ignoradas.

### 3. Dados sensíveis

`/data/` é `.gitignore`. Notas de 1:1, registros de performance e o SQLite (`/data/coworker.db`) **nunca** vão para o repositório.

### 4. Idioma

Artefatos, respostas e documentação: **pt-BR**.

## Onde tudo vive

| Tipo | Local |
|------|-------|
| Skills | `.claude/skills/<skill>/SKILL.md` |
| Agents | `.claude/agents/<agent>.md` (arquivo flat) |
| Scripts Python | `.claude/skills/<skill>/scripts/` (dentro da Skill que invoca) |
| Configurações fixas | `MEMORY.md` |
| Listas estruturadas | `/config/*.yaml` |
| SQLite | `/data/coworker.db` |
| Notas brutas | `/data/notes/` |
| Specs de features em construção | `/features/<feature>.md` (temporário; descartável após implementação) |

## Processo de construção de features

Conduzido por **um agent orquestrador + 5 skills-fase** (ver seção 9 do `SPEC.md`):

- **Entry point recomendado:** agent `feature-builder` em `.claude/agents/feature-builder.md` — conduz a feature do brainstorm ao encerramento numa única invocação.
- **Cada skill-fase também é invocável isoladamente** (útil para pular fases ou regerar apenas uma parte):
  - `.claude/skills/feature-bootstrap/` — doc base em **brainstorm interativo**; a feature só é dada como pronta quando o usuário declarar explicitamente.
  - `.claude/skills/feature-refine/` — fechar gaps.
  - `.claude/skills/feature-plan/` — plano de implementação.
  - `.claude/skills/feature-implement/` — criar a Skill/agent + migrações SQLite + entradas em `MEMORY.md` / `/config/`.
  - `.claude/skills/feature-archive/` — descartar `/features/<feature>.md` e atualizar índice em `SPEC.md`.

A ordem de implementação das features é **escolha do usuário** caso a caso.

## Estilo de interação

Conforme `~/.claude/CLAUDE.md` (perfil EM): tom executivo, direto, bullet points, tabelas comparativas. Feedback no modelo SBI quando aplicável. Sem microgerenciamento, sem burocracia desnecessária.
