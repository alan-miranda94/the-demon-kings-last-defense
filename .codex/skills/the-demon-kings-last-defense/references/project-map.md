# The Demon King's Last Defense Project Map

## Stack

- Runtime/app: Next.js 15.3.1, React 19, TypeScript 5.
- Game: Phaser 4 in a client-only React wrapper.
- AI orchestration: LangGraph/LangChain under `src/ai`.
- LLM provider: OpenAI or OpenRouter through `src/ai/config.ts` and `src/ai/services/openrouterService.ts`.
- Image generation: OpenAI, Google, or Hugging Face through `src/ai/services/imageGenerationService.ts`.
- Storage: PostgreSQL via `pg`, currently used for invocation history.
- Assets: `public/assets`, referenced from Phaser as `assets/...`.

## Entry Points

- `src/app/page.tsx`: App Router page, renders `GameClient`.
- `src/app/GameClient.tsx`: client boundary; dynamically imports `@/App` with `ssr: false`.
- `src/App.tsx`: React shell around the game.
- `src/PhaserGame.tsx`: creates Phaser and bridges React <-> Phaser through refs/events.
- `src/game/main.ts`: Phaser game config.
- `src/game/scenes/Game.ts`: main scene and most gameplay logic.
- `src/game/EventBus.ts`: React/Phaser event bridge.

## Main Gameplay Shape

`Game.ts` owns:

- World constants such as `GAME_WIDTH`, `GAME_HEIGHT`, hero start values, card sizes, and image size.
- Phaser preload/create/update lifecycle.
- Parallax background, hero animation, HUD, mana, health, distance, survival time, cards, and demon king speech bubble.
- Creative invocation panel and invocation type selection.
- Active obstacle/character/sky invocation behavior.
- Calls to `/api/demon-king/speech` and `/api/invocations`.

Before changing gameplay, search for the relevant helper name instead of scanning the whole file. Useful anchors:

- `createCreativeInvocationPanel`
- `handleCreativeInvocation`
- `queueDemonKingSpeech`
- `requestDemonKingSpeech`
- `completeInvocationCard`
- `applySkyInvocation`
- `applyObstacleInvocation`
- `applyCharacterInvocation`
- `createGridAnimation`
- `checkGameOver`

## Invocation Contract

The game sends demon king events to `POST /api/demon-king/speech` with:

- `eventType`: `distance_milestone`, `mana_full`, `mana_empty`, or `action`
- `invocationType`: `character`, `obstacle`, or `sky` for player actions
- game state fields: distance, max distance, survival time, mana, max mana, optional trigger percent

The API route validates with Zod, builds `buildDemonKingSpeechGraph`, invokes the graph, saves successful invocation results, and returns:

- `invocationMessage`
- `characterInvocation`
- `skyInvocation`
- `obstacleInvocation`
- `message`

Keep the response names stable because `Game.ts` consumes these exact fields.

## AI Graph

- `src/ai/graph/graph.ts`: defines `buildChatGraph` and `buildDemonKingSpeechGraph`.
- `src/ai/graph/factory.ts`: currently exports the chat graph factory for LangGraph CLI.
- `src/ai/graph/nodes/demonKingRouteNode.ts`: routes demon king actions.
- `src/ai/graph/nodes/*InvocationNode.ts`: creates balanced structured invocation data.
- `src/ai/graph/nodes/*InvocationImageNode.ts`: generates images for invocations.
- `src/ai/graph/nodes/demonKingSpeechNode.ts`: generates speech-only responses.
- `src/ai/prompts/v1/*`: prompt builders and structured output schemas.

When adding a new invocation field, update the prompt schema/type, the graph node output, the API route type handling, and the matching `Game.ts` response type and application code.

## Services

- `OpenRouterService.generateStructured`: wraps LangChain `createAgent` with provider-native structured output. Despite the class name, it supports OpenAI directly when `OPENAI_API_KEY` is present.
- `ImageGenerationService.generateImage`: chooses provider with `IMAGE_GENERATION_PROVIDER` (`openai`, `google`, `huggingface`/`hf`), uses `model_sheet_base.png` when possible, and removes green base-sheet colors with Sharp.
- `InvocationHistoryService`: creates `invocation_history` lazily and stores/list latest invocation JSONB rows.

## Environment

Minimum LLM requirement:

- `OPENAI_API_KEY` or `OPENROUTER_API_KEY`

Image generation options:

- `IMAGE_GENERATION_PROVIDER`
- `OPENAI_IMAGE_MODEL`, `OPENAI_IMAGE_QUALITY`, `OPENAI_IMAGE_SIZE`
- `GOOGLE_API_KEY`, `GOOGLE_IMAGE_MODEL`, `GOOGLE_IMAGE_SIZE`, `GOOGLE_IMAGE_ASPECT_RATIO`
- `HF_TOKEN` or `HUGGINGFACE_API_KEY`, `HF_IMAGE_MODEL`, `HF_IMAGE_PROVIDER`

Database:

- `DATABASE_URL`, otherwise defaults to local PostgreSQL on port `5433`.

Never commit real `.env` secrets.

## Commands

- Install: `npm install`
- Dev without template logging: `npm run dev-nolog`
- Build without template logging: `npm run build-nolog`
- Dev with template logging: `npm run dev`
- Build with template logging: `npm run build`
- LangGraph local dev: `npm run langgraph:serve`

The default dev port is `8080`.

## Docker

- `docker/docker-compose.yml` and `docker/Dockerfile` support local AI/model services.
- `docker/api_server.py`, `docker/models/*`, and `docker/outputs/*` are local model/API artifacts.
- `docker/postgres/init/01-enable-pgvector.sql` enables pgvector for PostgreSQL.

Inspect Docker files before changing ports, volumes, or model paths.

## Assets

Important asset groups:

- `public/assets/forest`: background layers.
- `public/assets/hero`: hero portrait, bars, run/jump/attack sprites.
- `public/assets/mana_bar` and `public/assets/distance_bar`: HUD bars.
- `public/assets/model_sheet_base.png`: base image for generated invocation sprites.
- `public/assets/sounds/background.mp4`: background music.

Phaser uses keys loaded in `Game.ts`; changing filenames requires updating preload keys and every key reference.

## Current Repo Caution

This project may have many uncommitted changes, deleted template files, and new project files. Treat them as intentional user work. Do not restore old `src/pages` template files or deleted Phaser template scenes unless the user asks.
