---
name: feature-implement
description: Executa o plano de implementação de uma feature — cria os arquivos da Skill/agent, scripts Python, aplica migração SQLite, atualiza MEMORY.md e /config/. Use após o plano em features/<slug>.md ter sido aprovado pelo usuário.
---

# feature-implement

Materializa o plano da feature em código e configuração.

## Pré-condição

`features/<slug>.md` tem a seção `## Plano de implementação` preenchida e **aprovada explicitamente pelo usuário**. Se faltar aprovação, peça antes de prosseguir.

## Pré-leitura

- `features/<slug>.md` — para extrair o plano.
- `CLAUDE.md` — regras críticas (recheque antes de cada escrita).
- `MEMORY.md` — estrutura atual (preservar formato ao atualizar).
- Arquivos existentes em `.claude/skills/_shared/` (se houver) — para reuso.

## Workflow

1. **Leia o plano** em `features/<slug>.md`.
2. **Crie a Skill ou agent** da feature:
   - Skill: `.claude/skills/<nome>/SKILL.md` com frontmatter (`name`, `description`).
   - Agent: `.claude/agents/<nome>.md` (arquivo flat) com frontmatter.
3. **Crie scripts Python** dentro do diretório da Skill (`.claude/skills/<nome>/scripts/`). Agents flat não têm diretório próprio — se o agent precisar de scripts, eles ficam em `.claude/skills/_shared/scripts/` ou dentro de uma Skill que o agent invoca.
4. **Aplique a migração SQLite** em `data/coworker.db`:
   - Crie `data/` se não existir (é gitignored).
   - Use `.claude/skills/_shared/scripts/migrate.py` como runner idempotente (cria se ainda não existir; mantém log de migrações aplicadas em uma tabela `_migrations`).
   - DDL vem exato do plano.
5. **Atualize `MEMORY.md`**:
   - Adicione chaves novas nas tabelas existentes (preservando formato Markdown).
   - Marque valores não conhecidos como `_(a preencher)_`.
6. **Atualize `/config/*.yaml`** conforme planejado, mantendo comentários de schema.
7. **Dry-run mental**:
   - A Skill consegue ser invocada (frontmatter válido, description trigger-friendly)?
   - As chaves citadas existem em `MEMORY.md`?
   - As tabelas referenciadas existem no SQLite após migração?
   - Toda escrita em Confluence usa `CONFLUENCE_PRIVATE_SPACE_KEY`?
8. **Reporte** em uma tabela compacta: arquivo, ação (criado/editado), propósito.

## Regras não negociáveis

- **Confluence**: se o plano violar a regra do espaço privado, **pare e alerte** o usuário. Não implemente.
- **Dados sensíveis**: sempre em `/data/` (gitignored). Nunca em arquivos commitados.
- **Não execute a feature aqui** — apenas crie os artefatos. Execução é responsabilidade do usuário ou da própria Skill quando invocada.
- **Idempotência**: rodar `feature-implement` duas vezes não pode quebrar o estado. Migrações usam o log; escritas em `MEMORY.md` checam se a chave já existe.

## Anti-padrões

- Hardcoded de IDs/URLs/paths em vez de ler `MEMORY.md`.
- Scripts Python fora do diretório da Skill que os usa.
- Migração não aditiva sem aviso ao usuário.
- Criar a Skill em local diferente do plano.
