import type { Runtime } from "@langchain/langgraph";
import { generateDemonKingSpeechAudio } from "../../services/demonKingTtsService";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

export function createDemonKingSpeechAudioNode() {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        if (state.generateAudio === false) return {};
        if (!state.message) return {};

        return (await generateDemonKingSpeechAudio(state.message)) ?? {};
    };
}
