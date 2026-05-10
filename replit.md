# VRF Monitor LG

Plataforma de monitoramento preditivo de sistemas de ar condicionado VRF da LG. Técnicos cadastram sistemas Multi V, fazem upload de relatórios de partida (PDF) e fotos mensais do LGMV; a IA extrai as leituras, compara com os ranges LG e o baseline de partida, e gera diagnósticos e alertas de manutenção.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — API server (porta 8080, roteada em `/api`)
- `pnpm --filter @workspace/vrf-monitor run dev` — Frontend Vite (porta dinâmica, roteado em `/`)
- `pnpm run typecheck` — typecheck completo em todos os pacotes
- `pnpm run build` — typecheck + build todos os pacotes
- `pnpm --filter @workspace/api-spec run codegen` — regera hooks React Query e schemas Zod a partir do OpenAPI
- `pnpm --filter @workspace/db run push` — aplica mudanças no schema DB (somente dev)
- Required env: `DATABASE_URL` — string de conexão Postgres
- Required env: `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY` — provisionados via integração Replit OpenAI

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui + wouter + TanStack Query
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validação: Zod (`zod/v4`), `drizzle-zod`
- AI: OpenAI GPT-4o Vision (via integração Replit)
- API codegen: Orval (a partir do spec OpenAPI)
- Build: esbuild (bundle CJS)
- Uploads: multer, armazenados em `./uploads/` relativo ao CWD do api-server

## Where things live

- `lib/api-spec/openapi.yaml` — contrato OpenAPI (source of truth)
- `lib/db/src/schema/systems.ts` — tabelas: `vrf_systems`, `startup_reports`
- `lib/db/src/schema/readings.ts` — tabelas: `reading_sessions`, `reading_photos`, `lgmv_readings`
- `lib/lg-param-ranges.ts` — ranges de parâmetros LG por modelo/modo (Multi V II/III/IV/5, cooling/heating)
- `artifacts/api-server/src/routes/systems/index.ts` — CRUD de sistemas + dashboard
- `artifacts/api-server/src/routes/startup-reports/index.ts` — upload PDF + análise IA
- `artifacts/api-server/src/routes/reading-sessions/index.ts` — sessões de leitura + upload de fotos + análise LGMV
- `lib/api-client-react/src/generated/api.ts` — hooks gerados (React Query)
- `lib/api-zod/src/generated/api.ts` — schemas Zod gerados
- `artifacts/vrf-monitor/src/` — frontend React

## Architecture decisions

- Contrato OpenAPI-first: o spec em `lib/api-spec/openapi.yaml` é a fonte da verdade; todos os hooks e schemas são gerados via Orval.
- Análise de IA com GPT-4o Vision: fotos do LGMV são enviadas como base64 ao modelo; a resposta JSON inclui leituras extraídas, status, insights e recomendações.
- Tipos VRF suportados: `multi_v_ii`, `multi_v_iii`, `multi_v_iv`, `multi_v_5`. Modos: `cooling`, `heating`.
- Upload de arquivos via multer com `memoryStorage` para PDFs de relatório de partida e fotos de sessão.
- Health status calculado pela IA e persistido na sessão + sistema.

## Product

- Dashboard com visão geral de saúde de todos os sistemas (healthy/warning/critical)
- Cadastro de sistemas VRF com código, localização, modelo, tipo, data de partida
- Upload e processamento de relatórios de partida (PDF) — extração de baseline via IA
- Criação de sessões de leitura LGMV com upload de fotos e análise automática por IA
- Tabela de leituras com status por parâmetro (normal/warning/critical), comparação com baseline e desvio percentual
- Alertas e recomendações de manutenção gerados pela IA

## User preferences

- Interface em português (Brasil)
- Sem emojis na UI
- Design industrial: navy escuro + âmbar/laranja para avisos + vermelho para crítico + verde para saudável

## Gotchas

- Os enums VRF type e mode são strings literais — não há TypeScript enum exportado de `@workspace/api-zod`; use constantes `as const` locais nas páginas.
- Uploads de foto devem usar `formData.append('photo', file)` (campo `photo`, não `file`).
- Uploads de relatório de partida usam `formData.append('file', file)` (campo `file`).
- O `@workspace/api-zod` deve estar declarado em `devDependencies` do `vrf-monitor` para que o Vite resolva o pacote workspace.
- Sempre rodar `pnpm --filter @workspace/api-spec run codegen` após mudar o OpenAPI spec.

## Pointers

- Ver skill `pnpm-workspace` para estrutura do workspace, TypeScript e detalhes dos pacotes.
