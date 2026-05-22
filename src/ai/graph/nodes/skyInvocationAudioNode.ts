import type { Runtime } from "@langchain/langgraph";
import type { SkyInvocationBalance } from "../../prompts/v1/skyInvocationBalance";
import { SoundEffectGenerationService } from "../../services/soundEffectGenerationService";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

const compactText = (text: string, maxLength = 110) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const limitPrompt = (text: string, maxLength = 420) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const buildSkyInvocationAudioPrompt = (
    skyInvocation: SkyInvocationBalance,
) => {
    const { nome, elemento, peso, descricaoVisual } = skyInvocation.invocacao;
    const visual = compactText(descricaoVisual);

    return limitPrompt(
        `${nome}, ${elemento}, ${peso}. Visual: ${visual}. Dark fantasy falling sky attack summoning SFX: sky tear, magic launch, heavy falling object, no speech, no music.`,
    );
};

export function createSkyInvocationAudioNode(
    soundEffectGenerationService = new SoundEffectGenerationService(),
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const skyInvocation = state.skyInvocationResult;

        if (!skyInvocation) return {};
        if (state.generateAudio === false) {
            return {
                skyInvocationResult: {
                    ...skyInvocation,
                    invocacao: {
                        ...skyInvocation.invocacao,
                        audio_invocation: null,
                    },
                },
            };
        }

        const result = await soundEffectGenerationService.generateSoundEffect(
            buildSkyInvocationAudioPrompt(skyInvocation),
            2.0,
        );

        if (!result.success) {
            console.warn("Sky audio_invocation generation failed:", result.error);

            return {
                skyInvocationResult: {
                    ...skyInvocation,
                    invocacao: {
                        ...skyInvocation.invocacao,
                        audio_invocation: null,
                    },
                },
            };
        }

        return {
            skyInvocationResult: {
                ...skyInvocation,
                invocacao: {
                    ...skyInvocation.invocacao,
                    audio_invocation: result.audioUrl,
                },
            },
        };
    };
}
