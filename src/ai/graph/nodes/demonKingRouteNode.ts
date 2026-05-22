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
        if (state.eventType !== "action") {
            return { nextRoute: "speech" };
        }

        if (state.invocationType === "obstacle") {
            return { nextRoute: "obstacle-invocation" };
        }

        if (state.invocationType === "sky") {
            return { nextRoute: "sky-invocation" };
        }

        return { nextRoute: "character-invocation" };
    };
}

export const routeAfterDemonKingRoute = (
    state: DemonKingSpeechState,
): DemonKingRoute => state.nextRoute ?? "speech";
