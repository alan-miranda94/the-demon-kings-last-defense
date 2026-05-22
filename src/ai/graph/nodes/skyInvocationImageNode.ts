import type { Runtime } from "@langchain/langgraph";
import { ImageGenerationService } from "../../services/imageGenerationService";
import { buildSkyInvocationImagePrompt } from "../../prompts/v1/skyInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

export function createSkyInvocationImageNode(
    imageGenerationService?: ImageGenerationService,
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const skyInvocation = state.skyInvocationResult;

        if (!skyInvocation) return {};

        const imagePrompt = buildSkyInvocationImagePrompt(
            skyInvocation.invocacao.nome,
            skyInvocation.invocacao.descricaoVisual,
        );
        const service =
            imageGenerationService ??
            new ImageGenerationService(state.imageGenerationProvider);
        const result = await service.generateImage(imagePrompt);

        if (!result.success) {
            console.warn("Invocation image generation failed:", result.error);

            return {
                skyInvocationResult: {
                    ...skyInvocation,
                    invocacao: {
                        ...skyInvocation.invocacao,
                        imageStatus: "failed",
                        imageUrl: null,
                    },
                },
            };
        }

        return {
            skyInvocationResult: {
                ...skyInvocation,
                invocacao: {
                    ...skyInvocation.invocacao,
                    imageStatus: "ready",
                    imageUrl: result.imageUrl,
                },
            },
        };
    };
}
