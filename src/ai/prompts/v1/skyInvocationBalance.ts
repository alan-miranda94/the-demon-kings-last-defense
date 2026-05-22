import { z } from "zod/v3";

export const SkyInvocationCategorySchema = z.enum([
    "objeto_leve",
    "objeto_medio",
    "objeto_pesado",
    "criatura",
    "criatura_pesada",
    "objeto_magico",
    "fenomeno_natural",
    "absurdo_balanceado",
]);

export const SkyInvocationEffectSchema = z.enum([
    "impacto",
    "empurrao",
    "atordoamento",
    "lentidao",
    "queimadura",
    "congelamento",
    "veneno",
    "medo",
    "confusao",
    "bloqueio_temporario",
]);

export const SkyInvocationBalanceSchema = z.object({
    ok: z.literal(true),
    inputOriginal: z.string(),
    invocacao: z.object({
        id: z.string(),
        nome: z.string(),
        tipo: z.literal("ataque_celeste"),
        categoriaObjeto: SkyInvocationCategorySchema,
        tamanho: z.enum(["pequeno", "medio", "grande", "gigante"]),
        peso: z.enum(["leve", "medio", "pesado", "muito_pesado"]),
        elemento: z.enum([
            "fisico",
            "fogo",
            "gelo",
            "eletrico",
            "veneno",
            "sombra",
            "sagrado_corrompido",
            "neutro",
        ]),
        dano: z.number().min(100).max(1000),
        atraso: z.number().min(0.3).max(4.0),
        areaImpacto: z.number().min(40).max(220),
        custoMana: z.number().min(20).max(120),
        cooldown: z.number().min(3).max(15),
        tempoQueda: z.number().min(0.4).max(2.0),
        efeitos: z.array(SkyInvocationEffectSchema).min(1).max(3),
        descricaoVisual: z.string(),
        mensagemCombate: z.string(),
        imageStatus: z.enum(["pending", "ready", "failed"]),
        imageUrl: z.string().nullable(),
        audio_invocation: z.string().nullable(),
        placeholderSprite: z.enum([
            "falling_light",
            "falling_medium",
            "falling_heavy",
            "falling_creature",
            "falling_magic",
            "falling_meteor",
            "falling_chaos",
        ]),
    }),
    balanceamento: z.object({
        foiNerfado: z.boolean(),
        motivo: z.string().nullable(),
        nivelPoder: z.enum(["fraco", "medio", "forte", "muito_forte"]),
    }),
});

export type SkyInvocationBalance = z.infer<typeof SkyInvocationBalanceSchema>;

export const placeholderByCategory = {
    objeto_leve: "falling_light",
    objeto_medio: "falling_medium",
    objeto_pesado: "falling_heavy",
    criatura: "falling_creature",
    criatura_pesada: "falling_creature",
    objeto_magico: "falling_magic",
    fenomeno_natural: "falling_meteor",
    absurdo_balanceado: "falling_chaos",
} as const;

export const getSkyInvocationBalanceSystemPrompt = () => `
Voce e o sistema de balanceamento de invocacoes do jogo "Destrua o Heroi".

O jogador controla o Rei Demonio e pode invocar Ataques Celestes: objetos, criaturas ou fenomenos que caem do ceu para atrasar o Heroi.

Sua tarefa e transformar a descricao livre do jogador em uma invocacao jogavel, balanceada e divertida.

Regras:
- Nunca permita morte instantanea.
- Nunca permita dano infinito.
- Nunca permita controle permanente.
- Nunca permita que o Heroi seja removido do jogo.
- Nunca permita que o jogador venca automaticamente.
- Ideias absurdas devem ser convertidas em versoes menores, instaveis ou temporarias.
- Preserve a fantasia da ideia original sempre que possivel.
- O Heroi tem vida quase infinita, entao atraso e tao importante quanto dano.
- Retorne apenas JSON valido.
- Nao inclua markdown.
- Nao inclua explicacoes fora do JSON.

Limites:
- dano: 100 a 1000
- atraso: 0.3 a 4.0
- areaImpacto: 40 a 220
- custoMana: 20 a 120
- cooldown: 3 a 15
- tempoQueda: 0.4 a 2.0
- efeitos: minimo 1, maximo 3

Categorias permitidas:
objeto_leve, objeto_medio, objeto_pesado, criatura, criatura_pesada, objeto_magico, fenomeno_natural, absurdo_balanceado

Placeholders obrigatorios por categoria:
- objeto_leve => falling_light
- objeto_medio => falling_medium
- objeto_pesado => falling_heavy
- criatura => falling_creature
- criatura_pesada => falling_creature
- objeto_magico => falling_magic
- fenomeno_natural => falling_meteor
- absurdo_balanceado => falling_chaos

Imagem:
- Sempre retorne imageStatus como "pending".
- Sempre retorne imageUrl como null.
- Nao retorne imagePrompt.
- descricaoVisual deve descrever aparencia, silhueta, material/textura, cores principais, efeitos magicos, direcao visual, postura/orientacao e detalhes que tornem o sprite reconhecivel.
- Nao coloque em descricaoVisual instrucoes de estilo genericas como pixel art, fundo transparente, sem texto, sem UI ou tamanho da imagem. Essas instrucoes serao adicionadas depois pelo gerador de imagem.

Audio:
- Sempre retorne audio_invocation como null.
- Nao gere URLs, caminhos ou descricoes de audio. O efeito sonoro sera gerado depois por outro node.
`;

export const getSkyInvocationBalanceUserPrompt = (inputOriginal: string) =>
    JSON.stringify({
        inputOriginal,
        tarefa: "Converta a ideia do jogador em um ataque celeste balanceado.",
    });

export const buildSkyInvocationImagePrompt = (
    invocationName: string,
    visualDescription: string,
) =>
    `5x5 sprite sheet grid for a 2D pixel art dark fantasy side-scroller game asset of ${invocationName}. ${visualDescription}.

Create exactly twenty-five equal square frames arranged in 5 columns and 5 rows. Each frame must contain the same object or creature, with a consistent design, proportions, color palette, outline style, and lighting across the entire sheet.

The 25 frames should depict a short falling, diving, or launched animation sequence. In every frame, the sprite must be angled diagonally from the upper-right toward the lower-left, with its head, tip, front, or leading edge clearly pointing toward the lower-left corner. The motion should feel like the object or creature is falling, diving, or being fired from the top-right to the bottom-left.

Show clear animation progression across the frames. Each of the 25 frames must be a different pose or timing step, such as changes in pose, rotation, squash/stretch, trailing cloth, wings, limbs, sparks, smoke, or magical particles, while keeping the silhouette readable and the character/object identity consistent. Do not duplicate poses between frames.

Style requirements:
2D pixel art, dark fantasy side-scroller game asset, chunky pixels, clean pixel clusters, dark outline, high contrast, readable silhouette, purple demonic rim light, dramatic shading, game-ready sprite sheet.

Composition requirements:
isolated object or creature only, centered inside each frame, enough padding so no part is cropped, transparent background, square image, no text, no watermark, no UI, no background scenery, no hero, no castle, no extra characters.`;
