import type { Runtime } from "@langchain/langgraph";
import { OpenRouterService } from "../../services/openrouterService";
import {
    CharacterInvocationBalanceSchema,
    getCharacterInvocationBalanceSystemPrompt,
    getCharacterInvocationBalanceUserPrompt,
    placeholderByCharacterRole,
    type CharacterInvocationBalance,
} from "../../prompts/v1/characterInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

const createFallbackCharacterInvocation = (
    inputOriginal: string,
): CharacterInvocationBalance => ({
    ok: true,
    inputOriginal,
    invocacao: {
        id: "personagem-instavel",
        nome: "Lacaio Instavel",
        tipo: "personagem",
        papel: "guerreiro",
        tamanho: "medio",
        vida: 260,
        dano: 55,
        atraso: 1.8,
        custoMana: 60,
        tempoAproximacao: 1.1,
        descricaoVisual:
            "Um guerreiro demoniaco instavel com armadura escura rachada, olhos roxos brilhantes e espada curta enferrujada.",
        mensagemCombate: "Um lacaio instavel salta contra o Heroi!",
        mensagemAcaoHeroi:
            "O Heroi derrota o lacaio instavel, mas perde alguns segundos.",
        imageStatus: "pending",
        imageUrl: null,
        audio_attack: null,
        audio_invocation: null,
        audio_running: null,
        audio_dead: null,
        placeholderSprite: "character_warrior",
    },
    balanceamento: {
        foiNerfado: true,
        motivo: "Fallback seguro usado porque o balanceamento da IA falhou.",
        nivelPoder: "medio",
    },
});

const normalizeCharacterInvocation = (
    result: CharacterInvocationBalance,
): CharacterInvocationBalance => ({
    ...result,
    invocacao: {
        ...result.invocacao,
        imageStatus: "pending",
        imageUrl: null,
        audio_attack: null,
        audio_invocation: null,
        audio_running: null,
        audio_dead: null,
        placeholderSprite: placeholderByCharacterRole[result.invocacao.papel],
    },
});

export function createCharacterInvocationNode(llmClient: OpenRouterService) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const inputOriginal =
            state.eventDescription?.trim() || "um lacaio demoniaco";
        const result = await llmClient.generateStructured(
            getCharacterInvocationBalanceUserPrompt(inputOriginal),
            getCharacterInvocationBalanceSystemPrompt(),
            CharacterInvocationBalanceSchema,
        );

        const characterInvocation =
            result.success && result.data
                ? normalizeCharacterInvocation(result.data)
                : createFallbackCharacterInvocation(inputOriginal);

        return {
            characterInvocationResult: characterInvocation,
            invocationMessage: "Invocando personagem...",
            message: characterInvocation.invocacao.mensagemCombate,
        };
    };
}
