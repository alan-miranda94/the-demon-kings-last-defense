# The Demon King's Last Defense

## Visao Geral

The Demon King's Last Defense e um jogo em Next.js, React e Phaser onde o jogador controla o Rei Demonio tentando impedir o avanco do Heroi ate o castelo. O jogo usa LangGraph/LangChain para gerar falas, invocacoes balanceadas, imagens, audio e respostas do chat entre o Rei Demonio e o Heroi.

## Stack

- App: Next.js 15, React 19 e TypeScript.
- Game: Phaser 4 em um boundary client-only.
- IA: LangGraph e LangChain.
- LLM: OpenAI ou OpenRouter via `src/ai/config.ts`.
- Imagem: OpenAI, Google ou Hugging Face via `ImageGenerationService`.
- Banco: PostgreSQL para memoria/checkpoints e historico de invocacoes.
- Audio local: servico TTS em `http://localhost:9080/v1/audio/speech` para fala do Rei Demonio.

## Como Rodar

Instale as dependencias:

```bash
npm install
```

Rode o app local:

```bash
npm run dev-nolog
```

O servidor Next usa a porta `9090`.

Rode o LangGraph Studio local:

```bash
npm run langgraph:serve
```

Valide TypeScript:

```bash
npx tsc --noEmit
```

## Variaveis de Ambiente

O projeto precisa de pelo menos uma chave de LLM:

```env
OPENAI_API_KEY=
OPENROUTER_API_KEY=
```

Banco local padrao:

```env
DATABASE_URL=postgresql://postgres:mysecretpassword@localhost:5433/the_demon_kings_last_defense
```

TTS do Rei Demonio:

```env
DEMON_KING_TTS_URL=http://localhost:9080/v1/audio/speech
DEMON_KING_TTS_MODEL=tts-1-hd
DEMON_KING_TTS_VOICE=demon_lord
```

LangSmith:

```env
LANGSMITH_API_KEY=
LANGSMITH_TRACING=true
LANGCHAIN_TRACING_V2=true
LANGCHAIN_PROJECT=the-demon-kings-last-defense
LANGCHAIN_CALLBACKS_BACKGROUND=false
```

## Entrada do App

Fluxo principal:

```text
src/app/page.tsx
src/app/GameClient.tsx
src/App.tsx
src/PhaserGame.tsx
src/game/main.ts
src/game/scenes/Game.ts
```

`Game.ts` e a cena principal. Ele concentra HUD, heroi, cenario, cartas, invocacoes, chat, pausa, audio, colisoes e chamadas para as APIs.

## Fluxo de Invocacoes

O jogo chama:

```text
POST /api/demon-king/speech
```

Com estado do jogo, tipo de evento e tipo de invocacao. A API chama o graph principal, salva invocacoes no historico quando necessario e retorna:

- `message`
- `invocationMessage`
- `characterInvocation`
- `obstacleInvocation`
- `skyInvocation`
- `audioContent`, `audioMimeType`, `audioFormat` quando for fala direta do Rei Demonio.

Tipos de invocacao:

- `character`: personagem/guerreiro/inimigo.
- `obstacle`: obstaculo fisico.
- `sky`: ataque celeste.

## Graphs

Configurados em `langgraph.json`:

```json
{
    "the-demon-kings-last-defense": "./src/ai/graph/factory.ts:graph",
    "hero-chat": "./src/ai/graph/factory.ts:heroChatGraph"
}
```

Graph principal:

```text
routeDemonKingAction
characterInvocation -> characterInvocationImage -> characterInvocationAudio
obstacleInvocation -> obstacleInvocationImage -> obstacleInvocationAudio
skyInvocationBalance -> skyInvocationImage -> skyInvocationAudio
demonKingSpeech -> demonKingSpeechAudio
```

`demonKingSpeechAudio` roda somente para fala direta do Rei Demonio, nao para invocacoes.

Graph do chat:

```text
heroChat
```

Ele usa historico por `thread_id` e gera respostas do Heroi para o chat lateral.

## APIs

- `src/app/api/demon-king/speech/route.ts`: fala do Rei Demonio e invocacoes.
- `src/app/api/hero-chat/route.ts`: chat LORD x HEROI.
- `src/app/api/invocations/route.ts`: historico de invocacoes.

## Assets

Assets ficam em:

```text
public/assets
```

Grupos importantes:

- `hero`: sprites e HUD do Heroi.
- `invocations`: invocacoes iniciais e geradas.
- `sounds`: sons do jogo.
- `distance_bar`, `mana_bar`: barras de HUD.
- `chat-painel.png`, `chat-icon.png`, `avoid_button.png`: UI do chat.
- `model_sheet_base.png`: base usada para geracao de sprites.

Phaser carrega arquivos por chaves em `Game.ts`. Ao renomear assets, atualize o preload e todos os usos da chave.

## Docker e Servicos Locais

Arquivos principais:

- `docker/docker-compose.yml`
- `docker/Dockerfile`
- `docker/config/voice_to_speaker.yaml`
- `docker/text-to-speech.html`

Servicos esperados:

- PostgreSQL na porta `5433`.
- TTS local na porta `9080`.

Exemplo de chamada TTS:

```bash
curl.exe http://localhost:9080/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"tts-1-hd\",\"voice\":\"demon_lord\",\"input\":\"Meu servo, o heroi se aproxima do ultimo portao.\",\"response_format\":\"wav\"}" \
  --output demon-lord-raw.wav
```

## Cuidados

- Nao commitar segredos de `.env`.
- Nao resetar alteracoes locais sem confirmacao.
- Manter o contrato da API estavel, porque `Game.ts` consome os campos diretamente.
- Ao adicionar campos de invocacao, atualizar schema Zod, node do graph, rota da API e tipos do Phaser.
