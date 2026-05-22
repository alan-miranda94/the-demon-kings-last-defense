import { z } from "zod/v3";

export const ObstacleInvocationBehaviorSchema = z.enum(["atacar", "pular"]);

export const ObstacleInvocationBalanceSchema = z.object({
    ok: z.literal(true),
    inputOriginal: z.string(),
    invocacao: z.object({
        id: z.string(),
        nome: z.string(),
        tipo: z.literal("obstaculo"),
        comportamentoHeroi: ObstacleInvocationBehaviorSchema,
        categoria: z.enum([
            "barreira",
            "armadilha",
            "perigo_magico",
            "criatura_obstaculo",
            "absurdo_balanceado",
        ]),
        tamanho: z.enum(["pequeno", "medio", "grande"]),
        vida: z.number().min(100).max(1000),
        atraso: z.number().min(0.4).max(5.0),
        custoMana: z.number().min(15).max(95),
        tempoAproximacao: z.number().min(0.6).max(2.4),
        descricaoVisual: z.string(),
        mensagemCombate: z.string(),
        mensagemAcaoHeroi: z.string(),
        imageStatus: z.enum(["pending", "ready", "failed"]),
        imageUrl: z.string().nullable(),
        audio_invocation: z.string().nullable(),
        audio_dead: z.string().nullable(),
        placeholderSprite: z.enum([
            "obstacle_stone",
            "obstacle_spikes",
            "obstacle_magic",
            "obstacle_creature",
            "obstacle_chaos",
        ]),
    }),
    balanceamento: z.object({
        foiNerfado: z.boolean(),
        motivo: z.string().nullable(),
        nivelPoder: z.enum(["fraco", "medio", "forte"]),
    }),
});

export type ObstacleInvocationBalance = z.infer<
    typeof ObstacleInvocationBalanceSchema
>;

export const placeholderByObstacleCategory = {
    barreira: "obstacle_stone",
    armadilha: "obstacle_spikes",
    perigo_magico: "obstacle_magic",
    criatura_obstaculo: "obstacle_creature",
    absurdo_balanceado: "obstacle_chaos",
} as const;

export const getObstacleInvocationBalanceSystemPrompt = () => `
Voce e o sistema de balanceamento de obstaculos do jogo "Destrua o Heroi".

O jogador controla o Rei Demonio e pode invocar obstaculos no caminho do Heroi.
O Heroi sempre reage quando chega perto:
- Se tamanho for "pequeno", comportamentoHeroi deve ser "pular". O Heroi pula automaticamente por cima do obstaculo.
- Se tamanho for "medio" ou "grande", comportamentoHeroi deve ser "atacar". O Heroi para, ataca e destroi o obstaculo automaticamente.

Sua tarefa e transformar a descricao livre do jogador em um obstaculo jogavel, balanceado e divertido.

Regras:
- Nunca permita morte instantanea.
- Nunca permita vida infinita.
- Nunca bloqueie o Heroi permanentemente.
- Nunca permita que o jogador venca automaticamente.
- Ideias absurdas devem virar versoes menores, instaveis ou temporarias.
- Obstaculos pequenos podem ter vida baixa, porque o Heroi pula por cima deles.
- Obstaculos medios e grandes devem ter vida suficiente para exigir um ou mais ataques do Heroi.
- A acao do Heroi e sempre automatica, nunca escolhida pelo usuario.
- Retorne apenas JSON valido.
- Nao inclua markdown.
- Nao inclua explicacoes fora do JSON.

Limites:
- vida: 100 a 1000
- atraso: 0.4 a 5.0
- custoMana: 15 a 95
- tempoAproximacao: 0.6 a 2.4

Categorias permitidas:
barreira, armadilha, perigo_magico, criatura_obstaculo, absurdo_balanceado

Placeholders obrigatorios por categoria:
- barreira => obstacle_stone
- armadilha => obstacle_spikes
- perigo_magico => obstacle_magic
- criatura_obstaculo => obstacle_creature
- absurdo_balanceado => obstacle_chaos

Imagem:
- Sempre retorne imageStatus como "pending".
- Sempre retorne imageUrl como null.
- Nao retorne imagePrompt.
- descricaoVisual deve descrever aparencia, silhueta, material/textura, cores principais, efeitos magicos e detalhes que tornem o sprite reconhecivel.
- Nao coloque em descricaoVisual instrucoes de estilo genericas como pixel art, fundo transparente, sem texto, sem UI ou tamanho da imagem. Essas instrucoes serao adicionadas depois pelo gerador de imagem.

Audio:
- Sempre retorne audio_invocation como null.
- Sempre retorne audio_dead como null.
- Nao gere URLs, caminhos ou descricoes de audio. Os efeitos sonoros serao gerados depois por outro node.
`;

export const getObstacleInvocationBalanceUserPrompt = (inputOriginal: string) =>
    JSON.stringify({
        inputOriginal,
        tarefa: "Converta a ideia do jogador em um obstaculo balanceado.",
    });

export const buildObstacleInvocationImagePrompt = (
    invocationName: string,
    visualDescription: string,
) =>
    `5x5 sprite sheet grid for a 2D 16-bit pixel art side-scroller platform game obstacle asset of ${invocationName}. ${visualDescription}.

Create exactly twenty-five equal square frames arranged in 5 columns and 5 rows. Each frame must contain the same obstacle, with a consistent design, proportions, color palette, outline style, and lighting across the entire sheet.

Frames 1 through 10 should depict the obstacle being summoned from the ground: cracks opening, dust, shadow energy, and the object rising upward until fully visible. Each frame must be a distinct animation pose or timing step, with no duplicated poses.

Frames 11 through 25 should depict only the completed obstacle in a subtle idle or pulsing loop suitable for repeating after the summon animation finishes. Each idle frame must still be visibly different through pose, pulse shape, glow, cracks, particles, shadow, or secondary motion; do not duplicate the same static obstacle frame.

Do not create living animals. If the requested obstacle is an animal or creature, depict it as a stone, wood, bone, metal, or magical statue being summoned instead. The statue must be facing left, looking toward the approaching hero.

Keep the obstacle grounded, readable from a side view, and facing left toward an approaching hero.

Style requirements:
classic 8-bit platformer pixel art, colorful console-era side-scroller look.

Composition requirements:
isolated obstacle only, centered inside each frame, enough padding so no part is cropped, transparent background, square image, no text, no watermark, no UI, no background scenery, no hero, no castle, no extra characters.`;
