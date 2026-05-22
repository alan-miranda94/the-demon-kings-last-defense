import type { Runtime } from "@langchain/langgraph";
import { ImageGenerationService } from "../../services/imageGenerationService";
import { buildCharacterInvocationImagePrompt } from "../../prompts/v1/characterInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

export function createCharacterInvocationImageNode(
    imageGenerationService?: ImageGenerationService,
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const characterInvocation = state.characterInvocationResult;

        if (!characterInvocation) return {};

        const imagePrompt = buildCharacterInvocationImagePrompt(
            characterInvocation.invocacao.nome,
            characterInvocation.invocacao.descricaoVisual,
        );
        const service =
            imageGenerationService ??
            new ImageGenerationService(state.imageGenerationProvider);
        const result = await service.generateImage(imagePrompt);

        if (!result.success) {
            console.warn(
                "Character image generation failed:",
                result.error,
            );

            return {
                characterInvocationResult: {
                    ...characterInvocation,
                    invocacao: {
                        ...characterInvocation.invocacao,
                        imageStatus: "failed",
                        imageUrl: null,
                    },
                },
            };
        }

        return {
            characterInvocationResult: {
                ...characterInvocation,
                invocacao: {
                    ...characterInvocation.invocacao,
                    imageStatus: "ready",
                    imageUrl: result.imageUrl,
                },
            },
        };
    };
}
