---
name: feature-plan
description: Gera o plano de implementação concreto de uma feature do Coworker a partir do seu doc refinado. Lista arquivos a criar, migrações SQLite (DDL exato), chaves novas em MEMORY.md, alterações em /config/, integrações MCP a usar, ordem dos passos e verificação. Use após feature-refine.
---

# feature-plan

Transforma o doc da feature em um plano executável por `feature-implement`.

## Pré-leitura

- `features/<slug>.md` — doc refinado.
- `SPEC.md` — seções 3 (arquitetura), 4 (runtime/trigger), 5 (Confluence), 6 (output), 8 (acceptance criteria).
- `MEMORY.md` e `/config/*.yaml` — para identificar reuso e novas chaves.
- Skills/agents existentes em `.claude/skills/` e `.claude/agents/` — para identificar reuso.

## Saída

**Adicione** (ou substitua, se já existir) uma seção `## Plano de implementação` ao final de `features/<slug>.md`, contendo:

### 1. Tipo a criar
- Skill em `.claude/skills/<nome>/SKILL.md`, agent em `.claude/agents/<nome>.md` (flat), ou combinação.

### 2. Arquivos a criar/editar
Caminhos absolutos. Para cada um, propósito em uma linha.

### 3. Scripts Python
Caminho **dentro do diretório da Skill que invoca** (`.claude/skills/<nome>/scripts/`). Compartilhamento genuíno: `.claude/skills/_shared/scripts/`.

### 4. Migração SQLite
DDL exato (`CREATE TABLE`, `ALTER TABLE`, índices) com colunas e tipos. **Aditiva sempre que possível** — não quebrar schema existente. Banco em `data/coworker.db` (gitignored).

### 5. Chaves novas em `MEMORY.md`
Nome canônico (CAIXA_ALTA) + valor concreto ou marcação "_(a preencher)_" + a tabela onde entra.

### 6. Mudanças em `/config/*.yaml`
Schemas novos ou ampliações; sempre com comentário documentando os campos.

### 7. Integrações externas
Para cada integração: ferramentas MCP usadas, escopo (leitura/escrita), restrição (ex.: Confluence só no espaço privado).

### 8. Ordem dos passos
Sequência clara que `feature-implement` executará. Passos pequenos e independentes quando possível.

### 9. Verificação
Como testar end-to-end. Comandos concretos, expected outputs.

### 10. Riscos
Pontos de atenção. **Sempre** verificar:
- Escrita em Confluence vai apenas para `CONFLUENCE_PRIVATE_SPACE_KEY`.
- Dados sensíveis ficam em `/data/` (gitignored).
- Slack automatizado lê só `SLACK_TRIGGER_CHANNEL_NAME`.

## Princípios

- **Reutilizar antes de criar** — verifique skills/scripts existentes que resolvam parte do problema.
- **Migração aditiva** — evite breaking changes em tabelas SQLite existentes.
- **Resolução via MEMORY/config** — toda chave/path/ID resolvido via `MEMORY.md` ou `/config/`. Nada hardcoded.
- **Plano executável, não filosofia** — passos concretos, com caminhos e DDL exatos.

## Encerramento

Apresente o plano ao usuário em mensagem resumida (tabela ou lista curta) e peça aprovação explícita antes de avançar para `feature-implement`.
