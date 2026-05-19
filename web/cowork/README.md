# Cowork Dashboard

UI local do Coworker (Engineering Manager). Next.js 15 (App Router) + TypeScript + AntD 6 + `@nuds-in/ui` + `@dnd-kit`. Persistência única: `data/coworker.db` na raiz do repositório.

## Como subir

```bash
bin/web-up
```

O script:

1. Valida `node`/`npm` disponíveis.
2. Roda `python3 .claude/skills/todo/scripts/migrate.py` (idempotente).
3. `npm install` se `node_modules/` faltar.
4. `npm run dev` em `web/cowork/` (default `http://localhost:3000`).

## Schema

Versão atual: **v1**. Validada em tempo de request via `lib/db/schema-version.ts`. Se houver drift, o app falha rapidamente com mensagem orientando a rodar `feature-implement`.

## Fontes Nu Sans (passo manual pós-clone)

A licença das fontes não vai pro git. Copiar manualmente os WOFF2 da Display variant (Light/Regular/Medium/Semibold + itálicos correspondentes) para `public/fonts/nusans/`. Origem indicada em `MEMORY.md` (`NUDS_REPO_URL` / `NUDS_TOKENS_URL`).

Enquanto os arquivos não estiverem em disco, o stack cai no fallback declarado em `app/globals.css` (`Roboto`, `-apple-system`, etc).

## Restrições

- Apenas DML neste app. DDL é exclusiva da skill `todo` (`migrate.py`).
- Sem WAL no SQLite (decisão Rodada 7).
- Hard delete em cards.
- pt-BR em toda UI.
