---
name: feature-archive
description: Encerra o ciclo de construção de uma feature — remove ou arquiva features/<slug>.md e atualiza o índice de features implementadas em SPEC.md. Use após feature-implement confirmar sucesso e o usuário confirmar encerramento.
---

# feature-archive

Encerra o ciclo da feature.

## Pré-condição

- `feature-implement` reportou sucesso (arquivos criados, migrações aplicadas, configs atualizados).
- Usuário confirmou explicitamente que pode encerrar.

## Workflow

1. **Pergunte ao usuário**: arquivar ou excluir o `features/<slug>.md`?
   - **Arquivar** → mover para `features/_archive/<slug>.md` (criar `_archive/` se não existir).
   - **Excluir** → remover do filesystem.
2. **Atualize o índice em `SPEC.md`**:
   - Se não existir, crie ao final do arquivo uma seção `## Features implementadas`.
   - Adicione uma linha: `- <slug> — <objetivo em uma frase, copiado do doc da feature> — implementado em <YYYY-MM-DD>`.
   - Mantenha as linhas em ordem cronológica (mais novas embaixo).
3. **Reporte o estado final**:
   - Onde a feature mora agora (`.claude/skills/<nome>/` ou `.claude/agents/<nome>/`).
   - Status do `features/<slug>.md` (arquivado em `_archive/` ou removido).
   - Linha adicionada em `SPEC.md`.

## Nota sobre o diretório `features/`

Conforme `SPEC.md` seção 3, `features/` é scaffolding temporário. **Quando todas as features previstas estiverem implementadas, o diretório pode ser removido por completo** (incluindo `_archive/`). Sugira isso ao usuário quando perceber que `features/` ficou vazio (sem docs vivos), apenas com `_archive/`.

## Regras

- Não toque em `.claude/`, `MEMORY.md` ou `/config/` aqui — essas mudanças já foram feitas por `feature-implement`.
- Não delete arquivos fora de `features/`.
