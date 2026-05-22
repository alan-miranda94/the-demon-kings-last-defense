import { StateGraph, START, END, MessagesZodMeta } from "@langchain/langgraph";
import { withLangGraph } from "@langchain/langgraph/zod";
import { z } from "zod/v3";

import type { BaseMessage } from "@langchain/core/messages";
import { OpenRouterService } from "../services/openrouterService";
import { createChatNode } from "./nodes/chatNode";

import {
    createDemonKingSpeechNode,
    type DemonKingSpeechState,
} from "./nodes/demonKingSpeechNode";
import {
    createDemonKingRouteNode,
    routeAfterDemonKingRoute,
} from "./nodes/demonKingRouteNode";
import { createCharacterInvocationNode } from "./nodes/characterInvocationNode";
import { createCharacterInvocationImageNode } from "./nodes/characterInvocationImageNode";
import { createCharacterInvocationAudioNode } from "./nodes/characterInvocationAudioNode";
import { createObstacleInvocationNode } from "./nodes/obstacleInvocationNode";
import { createObstacleInvocationImageNode } from "./nodes/obstacleInvocationImageNode";
import { createObstacleInvocationAudioNode } from "./nodes/obstacleInvocationAudioNode";
import { createSkyInvocationBalanceNode } from "./nodes/skyInvocationBalanceNode";
import { createSkyInvocationImageNode } from "./nodes/skyInvocationImageNode";
import { createSkyInvocationAudioNode } from "./nodes/skyInvocationAudioNode";

const ChatStateAnnotation = z.object({
    messages: withLangGraph(z.custom<BaseMessage[]>(), MessagesZodMeta),
    userContext: z.string().optional(),
    extractedPreferences: z.any().optional(),
    needsSummarization: z.boolean().optional(),
    conversationSummary: z.any().optional(),
    userId: z.string().optional(),
});

export type GraphState = z.infer<typeof ChatStateAnnotation>;

export function buildChatGraph(llmClient: OpenRouterService) {
    const graph = new StateGraph(ChatStateAnnotation)
        .addNode("chat", createChatNode(llmClient))
        .addEdge(START, "chat")
        .addEdge("chat", END);

    return graph.compile();
}

export function buildDemonKingSpeechGraph(llmClient: OpenRouterService) {
    const graph = new StateGraph<DemonKingSpeechState>({
        channels: {
            eventType: null,
            eventDescription: null,
            invocationType: null,
            imageGenerationProvider: null,
            generateAudio: null,
            distanceToCastle: null,
            maxDistanceToCastle: null,
            survivalTimeSeconds: null,
            mana: null,
            maxMana: null,
            triggerPercent: null,
            nextRoute: null,
            invocationMessage: null,
            characterInvocationResult: null,
            skyInvocationResult: null,
            obstacleInvocationResult: null,
            message: null,
            error: null,
        },
    })
        .addNode("routeDemonKingAction", createDemonKingRouteNode())
        .addNode("characterInvocation", createCharacterInvocationNode(llmClient))
        .addNode("characterInvocationImage", createCharacterInvocationImageNode())
        .addNode("characterInvocationAudio", createCharacterInvocationAudioNode())
        .addNode("obstacleInvocation", createObstacleInvocationNode(llmClient))
        .addNode("obstacleInvocationImage", createObstacleInvocationImageNode())
        .addNode("obstacleInvocationAudio", createObstacleInvocationAudioNode())
        .addNode("skyInvocationBalance", createSkyInvocationBalanceNode(llmClient))
        .addNode("skyInvocationImage", createSkyInvocationImageNode())
        .addNode("skyInvocationAudio", createSkyInvocationAudioNode())
        .addNode("demonKingSpeech", createDemonKingSpeechNode(llmClient))
        .addEdge(START, "routeDemonKingAction")
        .addConditionalEdges("routeDemonKingAction", routeAfterDemonKingRoute, {
            "character-invocation": "characterInvocation",
            "obstacle-invocation": "obstacleInvocation",
            "sky-invocation": "skyInvocationBalance",
            speech: "demonKingSpeech",
        })
        .addEdge("characterInvocation", "characterInvocationImage")
        .addEdge("characterInvocationImage", "characterInvocationAudio")
        .addEdge("characterInvocationAudio", END)
        .addEdge("obstacleInvocation", "obstacleInvocationImage")
        .addEdge("obstacleInvocationImage", "obstacleInvocationAudio")
        .addEdge("obstacleInvocationAudio", END)
        .addEdge("skyInvocationBalance", "skyInvocationImage")
        .addEdge("skyInvocationImage", "skyInvocationAudio")
        .addEdge("skyInvocationAudio", END)
        .addEdge("demonKingSpeech", END);

    return graph.compile();
}
