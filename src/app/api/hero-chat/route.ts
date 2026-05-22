import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod/v3";
import { HumanMessage } from "@langchain/core/messages";

import { buildGraph } from "../../../ai/graph/factory";

const ChatMessageSchema = z.object({
    role: z.enum(["lord", "hero"]),
    content: z.string().min(1).max(500),
});

const RequestSchema = z.object({
    demonKingMessage: z.string().min(1).max(500),
    threadId: z.string().min(1).max(120).optional(),
    history: z.array(ChatMessageSchema).max(12).optional(),
    distanceToCastle: z.number().nonnegative().optional(),
    maxDistanceToCastle: z.number().positive().optional(),
    survivalTimeSeconds: z.number().nonnegative().optional(),
    mana: z.number().nonnegative().optional(),
    heroHealth: z.number().nonnegative().optional(),
    heroStrength: z.number().nonnegative().optional(),
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
        const { heroChatGraph } = await buildGraph();
        const result = await heroChatGraph.invoke(
            {
                messages: [new HumanMessage(parsed.data.demonKingMessage)],
                distanceToCastle: parsed.data.distanceToCastle,
                maxDistanceToCastle: parsed.data.maxDistanceToCastle,
                survivalTimeSeconds: parsed.data.survivalTimeSeconds,
                mana: parsed.data.mana,
                heroHealth: parsed.data.heroHealth,
                heroStrength: parsed.data.heroStrength,
            },
            {
                configurable: {
                    thread_id: parsed.data.threadId ?? "hero-chat-session-id",
                },
            },
        );

        return NextResponse.json({
            message:
                typeof result.message === "string"
                    ? result.message
                    : "Continue marchando. Eu ainda estou de pe.",
        });
    } catch (error) {
        console.error("Hero chat API error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
