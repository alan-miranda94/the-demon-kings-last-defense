import type { Runtime } from "@langchain/langgraph";
import { OpenRouterService } from "../../services/openrouterService";
import {
    getSkyInvocationBalanceSystemPrompt,
    getSkyInvocationBalanceUserPrompt,
    placeholderByCategory,
    SkyInvocationBalanceSchema,
    type SkyInvocationBalance,
} from "../../prompts/v1/skyInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

const createFallbackSkyInvocation = (
    inputOriginal: string,
): SkyInvocationBalance => ({
    ok: true,
    inputOriginal,
    invocacao: {
        id: "ataque-celeste-instavel",
        nome: "Ataque Celeste Instavel",
        tipo: "ataque_celeste",
        categoriaObjeto: "objeto_magico",
        tamanho: "medio",
        peso: "medio",
        elemento: "sombra",
        dano: 35,
        atraso: 1.2,
        areaImpacto: 90,
        custoMana: 70,
        cooldown: 7,
        tempoQueda: 1.1,
        efeitos: ["impacto"],
        descricaoVisual:
            "Um fragmento sombrio instavel envolto por energia demoniaca roxa cai em alta velocidade.",
        mensagemCombate:
            "Um ataque celeste instavel despenca sobre o Heroi!",
        imageStatus: "pending",
        imageUrl: null,
        audio_invocation: null,
        placeholderSprite: "falling_magic",
    },
    balanceamento: {
        foiNerfado: true,
        motivo: "Fallback seguro usado porque o balanceamento da IA falhou.",
        nivelPoder: "medio",
    },
});

const normalizeSkyInvocation = (
    result: SkyInvocationBalance,
): SkyInvocationBalance => ({
    ...result,
    invocacao: {
        ...result.invocacao,
        imageStatus: "pending",
        imageUrl: null,
        audio_invocation: null,
        placeholderSprite:
            placeholderByCategory[result.invocacao.categoriaObjeto],
    },
});

export function createSkyInvocationBalanceNode(llmClient: OpenRouterService) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const inputOriginal =
            state.eventDescription?.trim() || "algo caindo do ceu";
        const result = await llmClient.generateStructured(
            getSkyInvocationBalanceUserPrompt(inputOriginal),
            getSkyInvocationBalanceSystemPrompt(),
            SkyInvocationBalanceSchema,
        );

        const skyInvocation =
            result.success && result.data
                ? normalizeSkyInvocation(result.data)
                : createFallbackSkyInvocation(inputOriginal);

        return {
            skyInvocationResult: skyInvocation,
            invocationMessage: "Invocando ataque celeste...",
            message: skyInvocation.invocacao.mensagemCombate,
        };
    };
}
