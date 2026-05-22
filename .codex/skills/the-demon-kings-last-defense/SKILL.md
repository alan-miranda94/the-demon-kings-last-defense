---
name: the-demon-kings-last-defense
description: Project onboarding and continuity guide for The Demon King's Last Defense. Use when Codex is working inside or discussing this repository, especially after a restart or context loss, for tasks involving the Next.js app, Phaser game scene, AI/LangGraph invocation pipeline, image generation, Docker/local model services, database-backed invocation history, project commands, architecture, or coding conventions.
---

# The Demon Kings Last Defense

## Overview

Use this skill to regain orientation before changing this project. The project is a Next.js 15 + React 19 app that embeds a Phaser 4 game and routes in-game demon king events through a LangGraph/LLM pipeline that can generate balanced invocations, images, speech, and invocation history.

## First Moves

1. Confirm the workspace is `D:\CURSOS\ENGENHARIA_APLICA_IA\the-demon-kings-last-defense`.
2. Run `git status --short` and treat existing changes as user work.
3. Read `package.json` before running commands; prefer `npm run dev-nolog` for local preview and `npm run build-nolog` for validation when telemetry is not wanted.
4. Read [references/project-map.md](references/project-map.md) before touching architecture, game behavior, AI flows, API routes, Docker, database, or assets.
5. Keep edits scoped. This repo currently has substantial uncommitted work, so do not reset, checkout, or remove files unless the user explicitly asks.

## Project Rules

- Keep the App Router entry path: `src/app/page.tsx` -> `src/app/GameClient.tsx` -> `src/App.tsx` -> `src/PhaserGame.tsx`.
- Keep Phaser-only code out of server-rendered components. Use `"use client"` and dynamic `ssr: false` boundaries for game UI.
- Treat `src/game/scenes/Game.ts` as the main gameplay surface. It is large; search for the exact method or constant before editing.
- Preserve the invocation type contract: `character`, `obstacle`, and `sky` travel from Phaser to `/api/demon-king/speech`, through LangGraph nodes, then back to cards/game effects.
- Keep structured LLM outputs aligned with Zod schemas in `src/ai/prompts/v1/*` and with the response types consumed in `Game.ts`.
- Prefer adding small helpers near related game logic over broad refactors of `Game.ts`.
- Keep generated/static assets under `public/assets`. Phaser loads them as `assets/...`.
- Preserve environment-variable fallbacks in `src/ai/config.ts` and service files; do not hardcode secrets.
- Use ASCII when editing unless the target file already needs Portuguese text. If touching existing mojibake strings, fix only the strings relevant to the request.

## Validation

Use the smallest validation that proves the change:

- Type/build validation: `npm run build-nolog`
- Local app: `npm run dev-nolog` at `http://localhost:8080`
- Full dev script with template logging: `npm run dev`
- LangGraph local dev: `npm run langgraph:serve`
- Database-dependent history paths expect PostgreSQL at `postgresql://postgres:mysecretpassword@localhost:5433/the_demon_kings_last_defense` unless `DATABASE_URL` is set.

## When Unsure

Read the relevant section of `references/project-map.md`, then inspect the live source. The reference is a map, not a substitute for the current code.
