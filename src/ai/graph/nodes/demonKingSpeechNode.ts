import type { Runtime } from "@langchain/langgraph";
import { OpenRouterService } from "../../services/openrouterService";
import {
    DemonKingSpeechSchema,
    getDemonKingSpeechSystemPrompt,
    getDemonKingSpeechUserPrompt,
    type DemonKingSpeechInput,
} from "../../prompts/v1/demonKingSpeech";
import type { SkyInvocationBalance } from "../../prompts/v1/skyInvocationBalance";
import type { ObstacleInvocationBalance } from "../../prompts/v1/obstacleInvocationBalance";
import type { CharacterInvocationBalance } from "../../prompts/v1/characterInvocationBalance";

export type DemonKingSpeechState = DemonKingSpeechInput & {
    nextRoute?:
        | "character-invocation"
        | "obstacle-invocation"
        | "sky-invocation"
        | "speech";
    invocationMessage?: string;
    characterInvocationResult?: CharacterInvocationBalance;
    skyInvocationResult?: SkyInvocationBalance;
    obstacleInvocationResult?: ObstacleInvocationBalance;
    message?: string;
    error?: string;
};

export function createDemonKingSpeechNode(llmClient: OpenRouterService) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const result = await llmClient.generateStructured(
            getDemonKingSpeechUserPrompt(state),
            getDemonKingSpeechSystemPrompt(),
            DemonKingSpeechSchema,
        );

        if (!result.success || !result.data) {
            return {
                error: result.error ?? "Falha ao gerar fala do Rei Demônio.",
                message: "Maldição... preciso ganhar tempo!",
            };
        }

        return {
            message: result.data.message,
        };
    };
}
