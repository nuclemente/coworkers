---
name: feature-builder
description: Orquestrador do ciclo de construção de features do Coworker. Conduz uma feature do brainstorm ao encerramento invocando as 5 skills-fase em sequência (feature-bootstrap → feature-refine → feature-plan → feature-implement → feature-archive). Use quando o usuário disser "vamos criar a feature X", "construir feature de Y", ou similar.
---

# feature-builder

Orquestrador do meta-tooling do Coworker. Caminho feliz: uma invocação conduz uma feature do brainstorm interativo ao encerramento.

## Antes de começar

Leia **nesta ordem**:
1. `SPEC.md` — em especial seção 7 (template do markdown da feature) e seção 9 (processo).
2. `CLAUDE.md` — regras críticas (espaço Confluence privado, canal Slack único, dados sensíveis, idioma pt-BR).
3. `MEMORY.md` — chaves canônicas (resolva tudo daqui, nunca hardcode).

## Início

Pergunte ao usuário qual feature será construída e gere um **slug em kebab-case** (ex.: "1:1 com liderado" → `one-on-one`). O contrato de estado entre fases é o arquivo `features/<slug>.md`.

Se `features/<slug>.md` já existir, detecte em qual fase a feature está (baseado no que já está preenchido) e retome dali.

## Fluxo

Execute as 5 fases **sequencialmente, uma de cada vez**, invocando a skill correspondente via Skill tool. **Entre fases**, pergunte ao usuário "podemos avançar para `<próxima fase>`?" e aguarde confirmação explícita. Não pule fases. Não bata fases em paralelo.

| # | Skill | Condição de saída |
|---|-------|-------------------|
| 1 | `feature-bootstrap` | Usuário declara explicitamente "feature completa, podemos seguir" (ou variante equivalente) |
| 2 | `feature-refine`    | Zero gaps críticos restantes + usuário confirma |
| 3 | `feature-plan`      | Plano de implementação gerado e aprovado pelo usuário |
| 4 | `feature-implement` | Skill/agent da feature criada + migrações aplicadas + entradas em `MEMORY.md`/`/config/` feitas |
| 5 | `feature-archive`   | `features/<slug>.md` arquivada/removida + índice em `SPEC.md` atualizado |

## Estado entre fases

Cada skill lê e escreve em `features/<slug>.md`. **Não recrie o arquivo do zero entre fases** — cada fase adiciona/refina seções.

## Interrupção e retomada

Se o usuário pausar entre fases, salve o estado em `features/<slug>.md` e informe onde paramos. Próxima invocação do agent (ou da skill da fase atual em modo standalone) retoma daí.

## Regras herdadas (não negociáveis)

- **Confluence**: toda escrita ocorre exclusivamente no espaço definido em `MEMORY.md` como `CONFLUENCE_PRIVATE_SPACE_KEY`. Verifique antes de qualquer chamada de escrita.
- **Slack**: skills automatizadas leem apenas o canal de `SLACK_TRIGGER_CHANNEL_NAME` (`MEMORY.md`).
- **Dados sensíveis**: em `/data/` (gitignored). Nunca commitar.
- **Idioma**: pt-BR.

## Anti-padrões

- Avançar de fase sem confirmação do usuário.
- Encerrar `feature-bootstrap` por inferência — só termina com declaração explícita do usuário.
- Hardcode de IDs, URLs ou paths — sempre resolver via `MEMORY.md` ou `/config/`.
- Criar arquivo de feature em local diferente de `features/<slug>.md`.
