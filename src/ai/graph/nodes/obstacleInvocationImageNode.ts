import type { Runtime } from "@langchain/langgraph";
import { ImageGenerationService } from "../../services/imageGenerationService";
import { buildObstacleInvocationImagePrompt } from "../../prompts/v1/obstacleInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

export function createObstacleInvocationImageNode(
    imageGenerationService?: ImageGenerationService,
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const obstacleInvocation = state.obstacleInvocationResult;

        if (!obstacleInvocation) return {};

        const imagePrompt = buildObstacleInvocationImagePrompt(
            obstacleInvocation.invocacao.nome,
            obstacleInvocation.invocacao.descricaoVisual,
        );
        const service =
            imageGenerationService ??
            new ImageGenerationService(state.imageGenerationProvider);
        const result = await service.generateImage(imagePrompt);

        if (!result.success) {
            console.warn(
                "Obstacle image generation failed:",
                result.error,
            );

            return {
                obstacleInvocationResult: {
                    ...obstacleInvocation,
                    invocacao: {
                        ...obstacleInvocation.invocacao,
                        imageStatus: "failed",
                        imageUrl: null,
                    },
                },
            };
        }

        return {
            obstacleInvocationResult: {
                ...obstacleInvocation,
                invocacao: {
                    ...obstacleInvocation.invocacao,
                    imageStatus: "ready",
                    imageUrl: result.imageUrl,
                },
            },
        };
    };
}
