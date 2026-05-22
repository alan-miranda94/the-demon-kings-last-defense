import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v3";
import { config } from "../../../../ai/config";
import { OpenRouterService } from "../../../../ai/services/openrouterService";
import { buildDemonKingSpeechGraph } from "../../../../ai/graph/graph";
import { InvocationHistoryService } from "../../../../ai/services/invocationHistoryService";
import type { CharacterInvocationBalance } from "../../../../ai/prompts/v1/characterInvocationBalance";
import type { SkyInvocationBalance } from "../../../../ai/prompts/v1/skyInvocationBalance";
import type { ObstacleInvocationBalance } from "../../../../ai/prompts/v1/obstacleInvocationBalance";

const RequestSchema = z.object({
    eventType: z.enum([
        "distance_milestone",
        "mana_full",
        "mana_empty",
        "action",
    ]),
    eventDescription: z.string().optional(),
    invocationType: z.enum(["character", "obstacle", "sky"]).optional(),
    imageGenerationProvider: z.enum(["openai", "google"]).optional(),
    generateAudio: z.boolean().optional(),
    distanceToCastle: z.number().nonnegative(),
    maxDistanceToCastle: z.number().positive(),
    survivalTimeSeconds: z.number().nonnegative(),
    mana: z.number().nonnegative(),
    maxMana: z.number().positive(),
    triggerPercent: z.number().min(0).max(100).optional(),
});

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(
            { error: "Invalid request body" },
            { status: 400 },
        );
    }

    try {
        const llmClient = new OpenRouterService(config);
        const graph = buildDemonKingSpeechGraph(llmClient);
        const result = await graph.invoke(parsed.data);
        const characterInvocation = result.characterInvocationResult as
            | CharacterInvocationBalance
            | undefined;
        const skyInvocation =
            result.skyInvocationResult as SkyInvocationBalance | undefined;
        const obstacleInvocation = result.obstacleInvocationResult as
            | ObstacleInvocationBalance
            | undefined;

        const invocationToSave =
            characterInvocation ?? skyInvocation ?? obstacleInvocation;

        if (invocationToSave) {
            try {
                const invocationHistory = new InvocationHistoryService();
                await invocationHistory.save(invocationToSave);
            } catch (error) {
                console.error("Failed to save invocation history:", error);
            }
        }

        return NextResponse.json({
            invocationMessage:
                typeof result.invocationMessage === "string"
                    ? result.invocationMessage
                    : undefined,
            characterInvocation,
            skyInvocation,
            obstacleInvocation,
            message:
                typeof result.message === "string"
                    ? result.message
                    : "O Herói avança... invoquem algo!",
        });
    } catch (error) {
        console.error("Demon king speech API error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
