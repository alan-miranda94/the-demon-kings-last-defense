import { Pool } from "pg";
import type { CharacterInvocationBalance } from "../prompts/v1/characterInvocationBalance";
import type { SkyInvocationBalance } from "../prompts/v1/skyInvocationBalance";
import type { ObstacleInvocationBalance } from "../prompts/v1/obstacleInvocationBalance";

export type SavedInvocation =
    | CharacterInvocationBalance
    | SkyInvocationBalance
    | ObstacleInvocationBalance;

export type SavedInvocationRecord = {
    id: string;
    invocation: SavedInvocation;
    createdAt: string;
    isFavorite: boolean;
};

const DEFAULT_DATABASE_URL =
    "postgresql://postgres:mysecretpassword@localhost:5433/the_demon_kings_last_defense";

declare global {
    // eslint-disable-next-line no-var
    var invocationHistoryPool: Pool | undefined;
}

const getPool = () => {
    globalThis.invocationHistoryPool ??= new Pool({
        connectionString: process.env.DATABASE_URL ?? DEFAULT_DATABASE_URL,
    });

    return globalThis.invocationHistoryPool;
};

export class InvocationHistoryService {
    private static isInitialized = false;

    private async ensureTable() {
        if (InvocationHistoryService.isInitialized) return;

        await getPool().query(`
            CREATE TABLE IF NOT EXISTS invocation_history (
                id BIGSERIAL PRIMARY KEY,
                invocation JSONB NOT NULL,
                is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        `);
        await getPool().query(`
            ALTER TABLE invocation_history
            ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT FALSE;
        `);

        InvocationHistoryService.isInitialized = true;
    }

    async save(invocation: SavedInvocation) {
        await this.ensureTable();

        await getPool().query(
            `
                INSERT INTO invocation_history (invocation)
                VALUES ($1::jsonb)
            `,
            [JSON.stringify(invocation)],
        );
    }

    async listLatest(limit = 5) {
        await this.ensureTable();

        const result = await getPool().query<{ invocation: SavedInvocation }>(
            `
                WITH favorite_invocations AS (
                    SELECT invocation, is_favorite, created_at, id
                    FROM invocation_history
                    WHERE is_favorite = TRUE
                    ORDER BY created_at DESC, id DESC
                    LIMIT $1
                ),
                recent_invocations AS (
                    SELECT invocation, is_favorite, created_at, id
                    FROM invocation_history
                    WHERE is_favorite = FALSE
                    ORDER BY created_at DESC, id DESC
                    LIMIT $1
                )
                SELECT invocation
                FROM (
                    SELECT * FROM favorite_invocations
                    UNION ALL
                    SELECT * FROM recent_invocations
                ) ordered_invocations
                ORDER BY is_favorite DESC, created_at DESC, id DESC
                LIMIT $1
            `,
            [limit],
        );

        return result.rows.map((row) => row.invocation);
    }

    async listLatestRecords(limit = 100): Promise<SavedInvocationRecord[]> {
        await this.ensureTable();

        const result = await getPool().query<{
            id: string;
            invocation: SavedInvocation;
            is_favorite: boolean;
            created_at: Date;
        }>(
            `
                SELECT id::text, invocation, is_favorite, created_at
                FROM invocation_history
                ORDER BY is_favorite DESC, created_at DESC, id DESC
                LIMIT $1
            `,
            [limit],
        );

        return result.rows.map((row) => ({
            id: row.id,
            invocation: row.invocation,
            createdAt: row.created_at.toISOString(),
            isFavorite: row.is_favorite,
        }));
    }

    async listAllRecords(): Promise<SavedInvocationRecord[]> {
        await this.ensureTable();

        const result = await getPool().query<{
            id: string;
            invocation: SavedInvocation;
            is_favorite: boolean;
            created_at: Date;
        }>(
            `
                SELECT id::text, invocation, is_favorite, created_at
                FROM invocation_history
                ORDER BY is_favorite DESC, created_at DESC, id DESC
            `,
        );

        return result.rows.map((row) => ({
            id: row.id,
            invocation: row.invocation,
            createdAt: row.created_at.toISOString(),
            isFavorite: row.is_favorite,
        }));
    }

    async setFavorite(id: string, isFavorite: boolean) {
        await this.ensureTable();

        const result = await getPool().query(
            `
                UPDATE invocation_history
                SET is_favorite = $2
                WHERE id = $1
            `,
            [id, isFavorite],
        );

        return (result.rowCount ?? 0) > 0;
    }

    async deleteById(id: string) {
        await this.ensureTable();

        const result = await getPool().query(
            `
                DELETE FROM invocation_history
                WHERE id = $1
            `,
            [id],
        );

        return (result.rowCount ?? 0) > 0;
    }
}
