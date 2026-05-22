export type DemonKingSpeechAudio = {
    audioContent: string;
    audioMimeType: string;
    audioFormat: "wav";
};

const DEFAULT_TTS_URL = "http://localhost:9080/v1/audio/speech";
const DEFAULT_TTS_MODEL = "tts-1-hd";
const DEFAULT_TTS_VOICE = "demon_lord";
let pendingDemonKingSpeechAudio: Promise<DemonKingSpeechAudio | undefined> | null =
    null;

export async function generateDemonKingSpeechAudio(
    input: string,
): Promise<DemonKingSpeechAudio | undefined> {
    const trimmedInput = input.trim();

    if (!trimmedInput) return undefined;
    if (pendingDemonKingSpeechAudio) return undefined;

    pendingDemonKingSpeechAudio = (async () => {
        const response = await fetch(
            process.env.DEMON_KING_TTS_URL ?? DEFAULT_TTS_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model:
                        process.env.DEMON_KING_TTS_MODEL ??
                        DEFAULT_TTS_MODEL,
                    voice:
                        process.env.DEMON_KING_TTS_VOICE ??
                        DEFAULT_TTS_VOICE,
                    input: trimmedInput,
                    response_format: "wav",
                }),
            },
        );

        if (!response.ok) {
            console.warn(
                `Demon king TTS failed with status ${response.status}.`,
            );
            return undefined;
        }

        const audioBuffer = Buffer.from(await response.arrayBuffer());

        if (audioBuffer.byteLength === 0) return undefined;

        return {
            audioContent: audioBuffer.toString("base64"),
            audioMimeType: "audio/wav",
            audioFormat: "wav",
        };
    })();

    try {
        return await pendingDemonKingSpeechAudio;
    } catch (error) {
        console.warn("Demon king TTS request failed:", error);
        return undefined;
    } finally {
        pendingDemonKingSpeechAudio = null;
    }
}
