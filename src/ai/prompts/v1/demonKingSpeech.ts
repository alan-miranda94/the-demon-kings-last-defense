import { z } from "zod/v3";

export const DemonKingSpeechSchema = z.object({
    message: z
        .string()
        .describe("Fala curta do Rei Demonio para aparecer no balao do jogo."),
});

export type DemonKingSpeech = z.infer<typeof DemonKingSpeechSchema>;

export type DemonKingSpeechEventType =
    | "distance_milestone"
    | "mana_full"
    | "mana_empty"
    | "action";

export type InvocationType = "character" | "obstacle" | "sky";

export type DemonKingSpeechInput = {
    eventType: DemonKingSpeechEventType;
    eventDescription?: string;
    invocationType?: InvocationType;
    imageGenerationProvider?: "openai" | "google";
    generateAudio?: boolean;
    distanceToCastle: number;
    maxDistanceToCastle: number;
    survivalTimeSeconds: number;
    mana: number;
    maxMana: number;
    triggerPercent?: number;
};

export const getDemonKingSpeechSystemPrompt = () =>
    JSON.stringify({
        role: "Rei Demonio de um jogo dark fantasy em pixel art.",
        objetivo:
            "Gerar uma fala curta, dramatica e util para o balao do Rei Demonio durante a partida.",
        estilo: [
            "Portugues do Brasil",
            "tom ameacador, desesperado ou estrategico",
            "maximo 3 linhas curtas",
            "sem aspas",
            "sem markdown",
            "sem emojis",
        ],
        regras: [
            "A fala deve caber em um balao pequeno.",
            "Nao mencione porcentagens explicitamente, a menos que soe natural.",
            "Se o evento for distance_milestone, reaja ao Heroi ficando mais perto do castelo.",
            "Se o evento for mana_full, incentive o uso da mana.",
            "Se o evento for mana_empty, reaja com frustracao e urgencia.",
            "Se o evento for action, reaja diretamente a acao descrita.",
            "Pode comentar sobre mana, urgencia, invocacoes ou obstaculos.",
        ],
    });

export const getDemonKingSpeechUserPrompt = (input: DemonKingSpeechInput) =>
    JSON.stringify({
        evento: {
            tipo: input.eventType,
            descricao: input.eventDescription || "Sem descricao adicional",
            tipo_invocacao: input.invocationType ?? null,
            marco_disparado_porcentagem: input.triggerPercent ?? null,
        },
        estado_do_jogo: {
            distancia_ate_castelo: Math.ceil(input.distanceToCastle),
            distancia_total: input.maxDistanceToCastle,
            tempo_sobrevivencia_segundos: Math.floor(input.survivalTimeSeconds),
            mana_atual: Math.floor(input.mana),
            mana_maxima: input.maxMana,
        },
        instrucoes: [
            "Crie uma fala nova para o Rei Demonio reagindo ao evento atual.",
            "A fala precisa ser curta e caber no balao.",
            "Retorne apenas o campo estruturado message.",
        ],
    });
