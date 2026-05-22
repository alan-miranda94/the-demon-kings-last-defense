import { NextResponse, type NextRequest } from "next/server";
import { InvocationHistoryService } from "../../../ai/services/invocationHistoryService";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const includeMeta = searchParams.get("includeMeta") === "1";
        const requestedLimit = Number(searchParams.get("limit"));
        const hasRequestedLimit = searchParams.has("limit");
        const limit = Number.isFinite(requestedLimit)
            ? Math.min(Math.max(Math.floor(requestedLimit), 1), 250)
            : includeMeta
              ? 100
              : 5;
        const invocationHistory = new InvocationHistoryService();

        if (includeMeta) {
            const invocations = hasRequestedLimit
                ? await invocationHistory.listLatestRecords(limit)
                : await invocationHistory.listAllRecords();

            return NextResponse.json({ invocations });
        }

        const invocations = await invocationHistory.listLatest(limit);

        return NextResponse.json({ invocations });
    } catch (error) {
        console.error("Invocation history API error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
        return NextResponse.json(
            { error: "Missing invocation id" },
            { status: 400 },
        );
    }

    try {
        const invocationHistory = new InvocationHistoryService();
        const deleted = await invocationHistory.deleteById(id);

        return NextResponse.json({ deleted });
    } catch (error) {
        console.error("Invocation history delete API error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest) {
    const body = (await request.json().catch(() => null)) as
        | { id?: unknown; isFavorite?: unknown }
        | null;
    const id = typeof body?.id === "string" ? body.id : "";
    const isFavorite =
        typeof body?.isFavorite === "boolean" ? body.isFavorite : undefined;

    if (!id || typeof isFavorite !== "boolean") {
        return NextResponse.json(
            { error: "Invalid favorite payload" },
            { status: 400 },
        );
    }

    try {
        const invocationHistory = new InvocationHistoryService();
        const updated = await invocationHistory.setFavorite(id, isFavorite);

        return NextResponse.json({ updated, isFavorite });
    } catch (error) {
        console.error("Invocation history favorite API error:", error);

        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
