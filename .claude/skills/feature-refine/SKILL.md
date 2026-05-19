---
name: feature-refine
description: Refina um doc de feature existente em features/<slug>.md identificando gaps remanescentes (seções vagas, decisões em aberto, integrações imprecisas, DoD ausente) e resolvendo via perguntas dirigidas em lote. Use após feature-bootstrap ou em qualquer doc de feature parcialmente preenchido.
---

# feature-refine

Fecha gaps de um doc de feature já existente.

## Pré-leitura

- `features/<slug>.md` — o doc a refinar.
- `SPEC.md` seção 7 — template de referência.
- `CLAUDE.md` — regras críticas.
- `MEMORY.md` — para verificar se chaves citadas existem.

## Workflow

1. Leia `features/<slug>.md` por completo.
2. **Detecte gaps**:
   - Seções vazias ou apenas com cabeçalho.
   - Frases genéricas ("a definir", "talvez", "X ou Y", "depende").
   - Integrações citadas sem origem/destino concretos.
   - Persistência mencionada sem tabela/coluna definida.
   - DoD ausente ou impreciso (sem métrica ou condição verificável).
   - Chaves citadas que não existem em `MEMORY.md`.
   - Riscos & Privacidade vazio quando há dado sensível envolvido.
3. **Apresente os gaps** em uma tabela compacta priorizada:
   - **Críticos** — bloqueiam o plano (ex.: tipo indefinido, trigger indefinida).
   - **Secundários** — refinamentos úteis mas não bloqueantes.
4. **Resolva em rodadas** com `AskUserQuestion`, batchando até **4 perguntas relacionadas** por rodada.
5. **Atualize `features/<slug>.md`** após cada rodada.
6. **Encerre quando**: zero gaps críticos restantes + usuário confirmar que pode avançar para `feature-plan`.

## Saída

Mesmo arquivo `features/<slug>.md`, com gaps fechados. **Não crie arquivo novo. Não duplique seções.**

## Anti-padrões

- Refazer o brainstorm do zero — se faltam decisões grandes, sugira voltar para `feature-bootstrap`.
- Encerrar com gaps críticos abertos.
- Inventar respostas para gaps em vez de perguntar ao usuário.
