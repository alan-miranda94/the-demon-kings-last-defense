import type { Runtime } from "@langchain/langgraph";
import { AIMessage, type BaseMessage } from "@langchain/core/messages";
import type { GraphState } from "../graph";
import { OpenRouterService } from "../../services/openrouterService";
import {
    HeroChatSchema,
    getHeroChatSystemPrompt,
    getHeroChatUserPrompt,
    type HeroChatInput,
} from "../../prompts/v1/heroChat";

function readMessageText(message: BaseMessage | undefined) {
    if (!message) return "";

    if (typeof message.content === "string") return message.content;

    if (Array.isArray(message.content)) {
        return message.content
            .map((item) => {
                if (typeof item === "string") return item;
                if (
                    typeof item === "object" &&
                    item !== null &&
                    "text" in item &&
                    typeof item.text === "string"
                ) {
                    return item.text;
                }

                return "";
            })
            .filter(Boolean)
            .join(" ");
    }

    return "";
}

function toHeroChatHistory(messages: BaseMessage[]): HeroChatInput["history"] {
    return messages.slice(-12).map((message) => ({
        role: message._getType() === "human" ? "lord" : "hero",
        content: readMessageText(message),
    }));
}

export function createChatNode(llmClient: OpenRouterService) {
    return async (
        state: GraphState,
        _runtime?: Runtime,
    ): Promise<Partial<GraphState>> => {
        const demonKingMessage = readMessageText(state.messages.at(-1));
        const input: HeroChatInput = {
            demonKingMessage,
            history: toHeroChatHistory(state.messages),
            distanceToCastle: state.distanceToCastle,
            maxDistanceToCastle: state.maxDistanceToCastle,
            survivalTimeSeconds: state.survivalTimeSeconds,
            mana: state.mana,
            heroHealth: state.heroHealth,
            heroStrength: state.heroStrength,
        };

        const result = await llmClient.generateStructured(
            getHeroChatUserPrompt(input),
            getHeroChatSystemPrompt(),
            HeroChatSchema,
        );

        if (!result.success || !result.data) {
            console.error("Falha ao gerar resposta do Heroi:", result.error);
            return {
                messages: [
                    new AIMessage("Continue marchando. Eu ainda estou de pe."),
                ],
                message: "Continue marchando. Eu ainda estou de pe.",
            };
        }

        return {
            messages: [new AIMessage(result.data.message)],
            message: result.data.message,
        };
    };
}
