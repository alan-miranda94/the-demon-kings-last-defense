import type { Runtime } from "@langchain/langgraph";
import type { ObstacleInvocationBalance } from "../../prompts/v1/obstacleInvocationBalance";
import { SoundEffectGenerationService } from "../../services/soundEffectGenerationService";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

type ObstacleAudioField = "audio_invocation" | "audio_dead";

type ObstacleAudioPrompt = {
    field: ObstacleAudioField;
    prompt: string;
    durationSeconds: number;
};

const compactText = (text: string, maxLength = 100) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const limitPrompt = (text: string, maxLength = 420) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const buildObstacleAudioPrompts = (
    obstacleInvocation: ObstacleInvocationBalance,
): ObstacleAudioPrompt[] => {
    const { nome, categoria, descricaoVisual } = obstacleInvocation.invocacao;
    const visual = compactText(descricaoVisual);
    const base = `${nome}, ${categoria}. Visual: ${visual}. Dark fantasy game obstacle SFX, no speech, no music.`;

    return [
        {
            field: "audio_invocation",
            durationSeconds: 2.0,
            prompt: limitPrompt(
                `${base} Summoning obstacle from ground: stone cracks, dust, dark magic, rising mass, heavy entrance.`,
            ),
        },
        {
            field: "audio_dead",
            durationSeconds: 1.7,
            prompt: limitPrompt(
                `${base} Obstacle destroyed: breaking stone, splintering material, magic burst, debris collapse.`,
            ),
        },
    ];
};

export function createObstacleInvocationAudioNode(
    soundEffectGenerationService = new SoundEffectGenerationService(),
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const obstacleInvocation = state.obstacleInvocationResult;

        if (!obstacleInvocation) return {};
        if (state.generateAudio === false) {
            return {
                obstacleInvocationResult: {
                    ...obstacleInvocation,
                    invocacao: {
                        ...obstacleInvocation.invocacao,
                        audio_invocation: null,
                        audio_dead: null,
                    },
                },
            };
        }

        const audioPrompts = buildObstacleAudioPrompts(obstacleInvocation);
        const generatedAudios = await Promise.allSettled(
            audioPrompts.map(async (audioPrompt) => {
                const result =
                    await soundEffectGenerationService.generateSoundEffect(
                        audioPrompt.prompt,
                        audioPrompt.durationSeconds,
                    );

                if (!result.success) {
                    console.warn(
                        `Obstacle ${audioPrompt.field} generation failed:`,
                        result.error,
                    );

                    return [audioPrompt.field, null] as const;
                }

                return [audioPrompt.field, result.audioUrl] as const;
            }),
        );
        const audioFields = Object.fromEntries(
            generatedAudios.map((result, index) => {
                if (result.status === "fulfilled") return result.value;

                const field = audioPrompts[index].field;
                console.warn(`Obstacle ${field} generation failed:`, result.reason);

                return [field, null] as const;
            }),
        ) as Record<ObstacleAudioField, string | null>;

        return {
            obstacleInvocationResult: {
                ...obstacleInvocation,
                invocacao: {
                    ...obstacleInvocation.invocacao,
                    ...audioFields,
                },
            },
        };
    };
}
