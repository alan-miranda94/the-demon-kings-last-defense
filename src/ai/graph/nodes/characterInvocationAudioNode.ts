import type { Runtime } from "@langchain/langgraph";
import { SoundEffectGenerationService } from "../../services/soundEffectGenerationService";
import type { CharacterInvocationBalance } from "../../prompts/v1/characterInvocationBalance";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

type CharacterAudioField =
    | "audio_attack"
    | "audio_invocation"
    | "audio_running"
    | "audio_dead";

type CharacterAudioPrompt = {
    field: CharacterAudioField;
    prompt: string;
    durationSeconds: number;
};

const compactText = (text: string, maxLength = 90) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const limitPrompt = (text: string, maxLength = 420) =>
    text.replace(/\s+/g, " ").trim().slice(0, maxLength);

const buildCharacterAudioPrompts = (
    characterInvocation: CharacterInvocationBalance,
): CharacterAudioPrompt[] => {
    const { nome, papel, descricaoVisual } = characterInvocation.invocacao;
    const visual = compactText(descricaoVisual);
    const base = `${nome}, ${papel}. Visual: ${visual}. Dark fantasy game SFX, no speech, no music.`;

    return [
        {
            field: "audio_invocation",
            durationSeconds: 2.4,
            prompt: limitPrompt(
                `${base} Summoning entrance: demonic portal burst, smoke, shadow energy, ` +
                    "magical materialization, powerful but brief.",
            ),
        },
        {
            field: "audio_running",
            durationSeconds: 1.2,
            prompt: limitPrompt(
                `${base} Seamless looping run: fast footsteps or creature motion, ` +
                    "cloth, armor, claws, embers or magical trail.",
            ),
        },
        {
            field: "audio_attack",
            durationSeconds: 1.6,
            prompt: limitPrompt(
                `${base} Attack impact: aggressive swing, bite, spell cast, slash, hit burst ` +
                    "or elemental strike matching the visual.",
            ),
        },
        {
            field: "audio_dead",
            durationSeconds: 2.0,
            prompt: limitPrompt(
                `${base} Death disappearance: body collapse, dissolving smoke, fading magic, ` +
                    "embers or shadow energy vanishing.",
            ),
        },
    ];
};

export function createCharacterInvocationAudioNode(
    soundEffectGenerationService = new SoundEffectGenerationService(),
) {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const characterInvocation = state.characterInvocationResult;

        if (!characterInvocation) return {};
        if (state.generateAudio === false) {
            return {
                characterInvocationResult: {
                    ...characterInvocation,
                    invocacao: {
                        ...characterInvocation.invocacao,
                        audio_attack: null,
                        audio_invocation: null,
                        audio_running: null,
                        audio_dead: null,
                    },
                },
            };
        }

        const audioPrompts = buildCharacterAudioPrompts(characterInvocation);
        const generatedAudios = await Promise.allSettled(
            audioPrompts.map(async (audioPrompt) => {
                const result =
                    await soundEffectGenerationService.generateSoundEffect(
                        audioPrompt.prompt,
                        audioPrompt.durationSeconds,
                    );

                if (!result.success) {
                    console.warn(
                        `Character ${audioPrompt.field} generation failed:`,
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
                console.warn(
                    `Character ${field} generation failed:`,
                    result.reason,
                );

                return [field, null] as const;
            }),
        ) as Record<CharacterAudioField, string | null>;

        return {
            characterInvocationResult: {
                ...characterInvocation,
                invocacao: {
                    ...characterInvocation.invocacao,
                    ...audioFields,
                },
            },
        };
    };
}
