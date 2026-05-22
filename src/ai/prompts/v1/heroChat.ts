import { z } from "zod/v3";

export const HeroChatSchema = z.object({
    message: z
        .string()
        .describe("Resposta curta do Heroi para o chat contra o Rei Demonio."),
});

export type HeroChat = z.infer<typeof HeroChatSchema>;

export type HeroChatMessage = {
    role: "lord" | "hero";
    content: string;
};

export type HeroChatInput = {
    demonKingMessage: string;
    history?: HeroChatMessage[];
    distanceToCastle?: number;
    maxDistanceToCastle?: number;
    survivalTimeSeconds?: number;
    mana?: number;
    heroHealth?: number;
    heroStrength?: number;
};

export const getHeroChatSystemPrompt = () =>
    JSON.stringify({
        role: "Heroi de um jogo dark fantasy em pixel art.",
        contexto:
            "O jogador fala como o Rei Demonio. Voce responde como o Heroi que esta marchando ate o castelo.",
        objetivo:
            "Responder a ultima fala do Rei Demonio de forma curta, dramaticamente divertida e coerente com a partida.",
        estilo: [
            "Portugues do Brasil",
            "tom corajoso, determinado, respeitoso quando fizer sentido, mas nunca servil ao Rei Demonio",
            "maximo 2 linhas curtas",
            "sem aspas",
            "sem markdown",
            "sem emojis",
        ],
        regras: [
            "Responda apenas como o Heroi.",
            "Nao controle as falas do Rei Demonio.",
            "Se o Rei Demonio der uma ordem, o Heroi pode reagir, provocar ou reconhecer o perigo.",
            "Nao prometa vencer automaticamente.",
            "Mantenha a resposta adequada para interface de chat pequena.",
        ],
    });

export const getHeroChatUserPrompt = (input: HeroChatInput) =>
    JSON.stringify({
        ultima_fala_do_rei_demonio: input.demonKingMessage,
        historico_recente: input.history?.slice(-8) ?? [],
        estado_do_jogo: {
            distancia_ate_castelo:
                input.distanceToCastle === undefined
                    ? null
                    : Math.ceil(input.distanceToCastle),
            distancia_total: input.maxDistanceToCastle ?? null,
            tempo_sobrevivencia_segundos:
                input.survivalTimeSeconds === undefined
                    ? null
                    : Math.floor(input.survivalTimeSeconds),
            mana_rei_demonio:
                input.mana === undefined ? null : Math.floor(input.mana),
            vida_heroi:
                input.heroHealth === undefined
                    ? null
                    : Math.floor(input.heroHealth),
            forca_heroi:
                input.heroStrength === undefined
                    ? null
                    : Math.floor(input.heroStrength),
        },
        instrucoes: [
            "Crie uma resposta curta do Heroi para a ultima fala do Rei Demonio.",
            "Retorne apenas o campo estruturado message.",
        ],
    });
