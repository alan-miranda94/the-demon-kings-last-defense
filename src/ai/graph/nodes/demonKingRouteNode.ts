import type { Runtime } from "@langchain/langgraph";
import type { DemonKingSpeechState } from "./demonKingSpeechNode";

export type DemonKingRoute =
    | "character-invocation"
    | "obstacle-invocation"
    | "sky-invocation"
    | "speech";

export function createDemonKingRouteNode() {
    return async (
        state: DemonKingSpeechState,
        _runtime?: Runtime,
    ): Promise<Partial<DemonKingSpeechState>> => {
        const resetPreviousOutput = {
            invocationMessage: null,
            characterInvocationResult: null,
            skyInvocationResult: null,
            obstacleInvocationResult: null,
            message: null,
            audioContent: null,
            audioMimeType: null,
            audioFormat: null,
            error: null,
        };

        if (state.eventType !== "action") {
            return { ...resetPreviousOutput, nextRoute: "speech" };
        }

        if (state.invocationType === "character") {
            return {
                ...resetPreviousOutput,
                nextRoute: "character-invocation",
            };
        }

        if (state.invocationType === "obstacle") {
            return {
                ...resetPreviousOutput,
                nextRoute: "obstacle-invocation",
            };
        }

        if (state.invocationType === "sky") {
            return { ...resetPreviousOutput, nextRoute: "sky-invocation" };
        }

        return { ...resetPreviousOutput, nextRoute: "speech" };
    };
}

export const routeAfterDemonKingRoute = (
    state: DemonKingSpeechState,
): DemonKingRoute => state.nextRoute ?? "speech";
