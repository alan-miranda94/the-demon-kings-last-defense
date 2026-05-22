import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type SoundEffectGenerationResult =
    | {
          success: true;
          audioUrl: string;
      }
    | {
          success: false;
          error: string;
      };

export class SoundEffectGenerationService {
    private apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    private client?: ElevenLabsClient;
    private maxPromptLength = 420;

    async generateSoundEffect(
        prompt: string,
        durationSeconds: number,
    ): Promise<SoundEffectGenerationResult> {
        if (!this.apiKey) {
            return {
                success: false,
                error: "ELEVENLABS_API_KEY is required to generate invocation sound effects.",
            };
        }

        try {
            const stream = await this.getClient().textToSoundEffects.convert({
                text: this.limitPrompt(prompt),
                durationSeconds,
            });
            const buffer = await this.readStream(stream);

            return {
                success: true,
                audioUrl: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private getClient() {
        this.client ??= new ElevenLabsClient({
            apiKey: this.apiKey,
        });

        return this.client;
    }

    private limitPrompt(prompt: string) {
        return prompt.replace(/\s+/g, " ").trim().slice(0, this.maxPromptLength);
    }

    private async readStream(stream: ReadableStream<Uint8Array>) {
        const reader = stream.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) chunks.push(value);
        }

        return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)));
    }
}
