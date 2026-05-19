---
name: feature-bootstrap
description: Brainstorm interativo para construir o documento base de uma nova feature do Coworker em features/<slug>.md. Faz perguntas, sugere soluções, propõe alternativas e atualiza o arquivo a cada rodada. Só encerra quando o usuário declarar explicitamente "feature completa, podemos seguir". Use quando o usuário quiser começar uma nova feature do zero ou expandir um doc vazio.
---

# feature-bootstrap

Constrói o doc base de uma feature do Coworker em **modo brainstorm interativo**.

## Pré-leitura obrigatória

1. `SPEC.md` seção 7 — template obrigatório das seções da feature.
2. `CLAUDE.md` — regras críticas (Confluence privado, canal Slack, dados sensíveis, pt-BR).
3. `MEMORY.md` — chaves disponíveis (para sugerir reuso).

## Workflow

1. Pergunte o nome da feature; gere um **slug kebab-case** se ainda não tiver (ex.: `one-on-one`, `todo`, `weekly-plan`).
2. Se `features/<slug>.md` não existir, crie com o **template completo da seção 7 do SPEC**, com cada seção vazia (somente o cabeçalho `##`).
3. **Itere em rodadas curtas** até a feature estar completa:
   - Faça **1 a 3 perguntas** por rodada via `AskUserQuestion`. Ofereça alternativas com prós/contras quando aplicável.
   - **Sugira soluções, não só pergunte** — proponha caminhos concretos e deixe o usuário ajustar.
   - Após cada rodada, **atualize `features/<slug>.md`** refletindo as decisões na seção correspondente.
   - Resuma em uma frase: o que ficou definido e o que ainda falta.
4. **Encerre APENAS quando o usuário declarar explicitamente** algo como "feature completa, podemos seguir" ou variante equivalente. Não infira, não conclua sozinho, não termine só porque o template está preenchido.

## Cobertura mínima antes de aceitar declaração de "completa"

Cada seção do template deve ter conteúdo significativo (não apenas placeholder):

- **Objetivo** — uma frase clara, foco no valor para o EM.
- **Trigger** — Slack via canal de `SLACK_TRIGGER_CHANNEL_NAME`? Invocação direta? Schedule?
- **Tipo** — Skill, agent, ou combinação.
- **Inputs** — fontes concretas (Slack, Jira, Confluence, Google, SQLite, configs, arquivos).
- **Processamento** — passos macro; scripts Python necessários (dentro da Skill).
- **Outputs** — destinos concretos (Slack, SQLite, `/data/notes`, Confluence-privado, Jira).
- **Integrações** — confirmar que Confluence usa **somente** o espaço de `CONFLUENCE_PRIVATE_SPACE_KEY`.
- **Configs lidas** — quais chaves de `MEMORY.md` + quais YAMLs de `/config/`.
- **Persistência** — quais tabelas SQLite são tocadas + migração necessária + arquivos em `/data/notes`.
- **Estado e histórico** — como recuperar onde parou.
- **DoD** — critérios objetivos verificáveis.
- **Riscos & Privacidade** — pontos de atenção; reforce regra de Confluence se aplicável.

Trate como guia, não como checklist rígido — siga o fluxo da conversa, mas garanta que tudo será endereçado antes de aceitar o "completa".

## Regras

- Se a feature mencionar escrita em Confluence: confirme explicitamente que será no espaço privado de `MEMORY.md`.
- Se mencionar Slack como trigger: confirme que é o canal de `SLACK_TRIGGER_CHANNEL_NAME`.
- Idioma: pt-BR.
- Não escreva fora de `features/<slug>.md`.
