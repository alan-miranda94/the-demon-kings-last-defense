import { z } from "zod/v3";

export const CharacterInvocationRoleSchema = z.enum([
    "guerreiro",
    "mago",
    "assassino",
    "tanque",
    "invocador",
    "absurdo_balanceado",
]);

export const CharacterInvocationBalanceSchema = z.object({
    ok: z.literal(true),
    inputOriginal: z.string(),
    invocacao: z.object({
        id: z.string(),
        nome: z.string(),
        tipo: z.literal("personagem"),
        papel: CharacterInvocationRoleSchema,
        tamanho: z.enum(["pequeno", "medio", "grande"]),
        vida: z.number().min(100).max(900),
        dano: z.number().min(20).max(220),
        atraso: z.number().min(0.5).max(5.0),
        custoMana: z.number().min(25).max(120),
        tempoAproximacao: z.number().min(0.5).max(2.5),
        descricaoVisual: z.string(),
        mensagemCombate: z.string(),
        mensagemAcaoHeroi: z.string(),
        imageStatus: z.enum(["pending", "ready", "failed"]),
        imageUrl: z.string().nullable(),
        audio_attack: z.string().nullable(),
        audio_invocation: z.string().nullable(),
        audio_running: z.string().nullable(),
        audio_dead: z.string().nullable(),
        placeholderSprite: z.enum([
            "character_warrior",
            "character_mage",
            "character_assassin",
            "character_tank",
            "character_summoner",
            "character_chaos",
        ]),
    }),
    balanceamento: z.object({
        foiNerfado: z.boolean(),
        motivo: z.string().nullable(),
        nivelPoder: z.enum(["fraco", "medio", "forte"]),
    }),
});

export type CharacterInvocationBalance = z.infer<
    typeof CharacterInvocationBalanceSchema
>;

export const placeholderByCharacterRole = {
    guerreiro: "character_warrior",
    mago: "character_mage",
    assassino: "character_assassin",
    tanque: "character_tank",
    invocador: "character_summoner",
    absurdo_balanceado: "character_chaos",
} as const;

export const getCharacterInvocationBalanceSystemPrompt = () => `
Voce e o sistema de balanceamento de personagens invocados do jogo "Destrua o Heroi".

O jogador controla o Rei Demonio e pode invocar personagens aliados para interceptar, ferir ou atrasar o Heroi por alguns segundos.

Sua tarefa e transformar a descricao livre do jogador em um personagem jogavel, balanceado e divertido.

Regras:
- Nunca permita morte instantanea.
- Nunca permita dano infinito.
- Nunca permita controle permanente.
- Nunca permita que o Heroi seja removido do jogo.
- Nunca permita que o jogador venca automaticamente.
- Ideias absurdas devem virar versoes menores, instaveis ou temporarias.
- O personagem deve atrasar o Heroi temporariamente, nao bloquear o jogo para sempre.
- A vida, dano e custoMana devem refletir a criatividade, ameaca e complexidade da ideia do usuario: ideias simples geram lacaios fracos, ideias muito criativas ou ameaçadoras geram personagens mais resistentes e caros.
- Personagens resistentes devem ter custoMana maior. Personagens com muito dano devem ter vida ou atraso mais moderados.
- Retorne apenas JSON valido.
- Nao inclua markdown.
- Nao inclua explicacoes fora do JSON.

Limites:
- vida: 100 a 900
- dano: 20 a 220
- atraso: 0.5 a 5.0
- custoMana: 25 a 120
- tempoAproximacao: 0.5 a 2.5

Papeis permitidos:
guerreiro, mago, assassino, tanque, invocador, absurdo_balanceado

Placeholders obrigatorios por papel:
- guerreiro => character_warrior
- mago => character_mage
- assassino => character_assassin
- tanque => character_tank
- invocador => character_summoner
- absurdo_balanceado => character_chaos

Imagem:
- Sempre retorne imageStatus como "pending".
- Sempre retorne imageUrl como null.
- Nao retorne imagePrompt.
- descricaoVisual deve descrever aparencia, silhueta, roupa/armadura, arma ou foco magico, cores principais, efeitos magicos, postura de combate, direcao visual e detalhes que tornem o sprite reconhecivel.
- Nao coloque em descricaoVisual instrucoes de estilo genericas como pixel art, fundo transparente, sem texto, sem UI ou tamanho da imagem. Essas instrucoes serao adicionadas depois pelo gerador de imagem.

Audio:
- Sempre retorne audio_attack como null.
- Sempre retorne audio_invocation como null.
- Sempre retorne audio_running como null.
- Sempre retorne audio_dead como null.
- Nao gere URLs, caminhos ou descricoes de audio. Os efeitos sonoros serao gerados depois por outro node.
`;

export const getCharacterInvocationBalanceUserPrompt = (
    inputOriginal: string,
) =>
    JSON.stringify({
        inputOriginal,
        tarefa: "Converta a ideia do jogador em um personagem invocado balanceado.",
    });

export const buildCharacterInvocationImagePrompt = (
    invocationName: string,
    visualDescription: string,
) =>
    `5x5 sprite sheet grid for a 2D 16-bit pixel art dark fantasy side-scroller summoned character of ${invocationName}. ${visualDescription}.

Create exactly twenty-five equal square frames arranged in 5 columns and 5 rows. Each frame must contain the same full-body character, with a consistent design, proportions, color palette, outline style, and lighting across the entire sheet.

Frames 1 through 5 should depict the character being summoned from demonic smoke or shadow energy, starting as a faint silhouette and ending fully visible.

Frames 6 through 10 should depict the character running from the right side of the screen toward the left side in a readable run cycle, with stronger forward lean, wider stride, and more energetic motion than a walk.

Frames 11 through 20 should depict an attack, spell cast, slash, lunge, bite, or combat action aimed toward the left side of the screen, with clear wind-up, impact, and recovery poses.

Frames 21 through 25 should depict the character dying, dissolving, collapsing, or vanishing back into demonic smoke.

Each of the 25 frames must be a distinct animation pose or timing step. Do not duplicate poses between frames. The sequence must read from left to right, top to bottom.

The character must be shown full body in every frame, from head to feet, with the entire silhouette visible and no cropped head, feet, weapon, limbs, wings, tail, cape, horns, or effects. The character must always face left in every single frame, including summon, run, attack, hit reaction, and death frames. Never show the character facing right, front-facing, back-facing, or mirrored inconsistently. The face, chest, weapon aim, feet direction, attack motion, and body orientation must all point toward the left side of the screen, toward the approaching hero. The character must stay grounded like a side-scroller enemy or ally sprite. The animation should make it clear that this summoned character enters from the right edge of the screen, runs left until reaching the hero, attacks, takes hits from the hero, and then dies.

Style requirements:
classic 16-bit dark fantasy pixel art, chunky pixels, clean pixel clusters, dark outline, readable silhouette, purple demonic rim light, dramatic shading, game-ready sprite sheet.

Composition requirements:
isolated full-body character only, centered inside each frame, generous padding on all sides so no part is cropped, transparent background, square image, no text, no watermark, no UI, no background scenery, no hero, no castle, no extra characters, no portrait, no bust, no close-up.`;
