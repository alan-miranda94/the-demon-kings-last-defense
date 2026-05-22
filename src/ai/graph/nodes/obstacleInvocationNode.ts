import type { Runtime } from "@langchain/langgraph";
import { OpenRouterService } from "../../services/openrouterService";
import {
    getObstacleInvocationBalanceSystemPrompt,
    getObstacleInvocationBalanceUserPrompt,
    ObstacleInvocationBalanceSchema,
    placeholderByObstacleCategory,
    type ObstacleInvocationBalance,
} from "../../prompts/v1/obstacleInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

const createFallbackObstacleInvocation = (
    inputOriginal: string,
): ObstacleInvocationBalance => ({
    ok: true,
    inputOriginal,
    invocacao: {
        id: "obstaculo-instavel",
        nome: "Obstaculo Instavel",
        tipo: "obstaculo",
        comportamentoHeroi: "atacar",
        categoria: "barreira",
        tamanho: "medio",
        vida: 250,
        atraso: 1.5,
        custoMana: 35,
        tempoAproximacao: 1.2,
        descricaoVisual:
            "Uma barreira sombria rachada, feita de pedra escura e energia demoniaca roxa.",
        mensagemCombate: "Um obstaculo instavel surge no caminho do Heroi!",
        mensagemAcaoHeroi:
            "O Heroi quebra o obstaculo instavel, mas perde terreno.",
        imageStatus: "pending",
        imageUrl: null,
        audio_invocation: null,
        audio_dead: null,
        placeholderSprite: "obstacle_stone",
    },
    balanceamento: {
        foiNerfado: true,
        motivo: "Fallback seguro usado porque o balanceamento da IA falhou.",
        nivelPoder: "medio",
    },
});

const normalizeObstacleInvocation = (
    result: ObstacleInvocationBalance,
): ObstacleInvocationBalance => ({
    ...result,
    invocacao: {
        ...result.invocacao,
        comportamentoHeroi:
            result.invocacao.tamanho === "pequeno" ? "pular" : "atacar",
        imageStatus: "pending",
        imageUrl: null,
        audio_invocation: null,
        audio_dead: null,
        placeholderSprite:
            placeholderByObstacleCategory[result.invocacao.categoria],
    },
});

export function createObstacleInvocationNode(llmClient: OpenRouterService) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const inputOriginal =
            state.eventDescription?.trim() || "um obstaculo no caminho";
        const result = await llmClient.generateStructured(
            getObstacleInvocationBalanceUserPrompt(inputOriginal),
            getObstacleInvocationBalanceSystemPrompt(),
            ObstacleInvocationBalanceSchema,
        );

        const obstacleInvocation =
            result.success && result.data
                ? normalizeObstacleInvocation(result.data)
                : createFallbackObstacleInvocation(inputOriginal);

        return {
            obstacleInvocationResult: obstacleInvocation,
            invocationMessage: "Invocando obstaculo...",
            message: obstacleInvocation.invocacao.mensagemCombate,
        };
    };
}
