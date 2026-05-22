export type CachedInvocation = {
    invocacao?: {
        id?: string;
        nome?: string;
        tipo?: string;
        imageUrl?: string | null;
        audio_attack?: string | null;
        audio_invocation?: string | null;
        audio_running?: string | null;
        audio_dead?: string | null;
        mensagemCombate?: string;
        [key: string]: unknown;
    };
};

export type CachedInvocationRecord = {
    id: string;
    createdAt: string;
    isFavorite: boolean;
    invocation: CachedInvocation;
};

let cachedRecords: CachedInvocationRecord[] | null = null;
let pendingLoad: Promise<CachedInvocationRecord[]> | null = null;
const INVOCATION_HISTORY_TIMEOUT_MS = 2500;

const sortRecords = (records: CachedInvocationRecord[]) => {
    return [...records].sort((first, second) => {
        if (first.isFavorite !== second.isFavorite) {
            return first.isFavorite ? -1 : 1;
        }

        return (
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
        );
    });
};

const normalizeFallbackAssetUrl = (assetUrl?: string | null) => {
    if (!assetUrl) return assetUrl;

    return assetUrl
        .replace(/^\.\//, "assets/")
        .replace(/^assets\/invocation\//, "assets/invocations/");
};

const loadFallbackInvocations = async (): Promise<CachedInvocationRecord[]> => {
    const response = await fetch("/assets/invocations/start_invocation.json");
    if (!response.ok) return [];

    const data = (await response.json()) as {
        start_invocation?: CachedInvocation[];
    };
    const fallbackInvocations = data.start_invocation ?? [];
    const fallbackCreatedAt = new Date(0).toISOString();

    return fallbackInvocations.map((invocation, index) => ({
        id: `fallback-${invocation.invocacao?.id ?? index}`,
        createdAt: fallbackCreatedAt,
        isFavorite: false,
        invocation: {
            ...invocation,
            invocacao: invocation.invocacao
                ? {
                      ...invocation.invocacao,
                      imageUrl: normalizeFallbackAssetUrl(
                          invocation.invocacao.imageUrl,
                      ),
                      audio_attack: normalizeFallbackAssetUrl(
                          invocation.invocacao.audio_attack,
                      ),
                      audio_invocation: normalizeFallbackAssetUrl(
                          invocation.invocacao.audio_invocation,
                      ),
                      audio_running: normalizeFallbackAssetUrl(
                          invocation.invocacao.audio_running,
                      ),
                      audio_dead: normalizeFallbackAssetUrl(
                          invocation.invocacao.audio_dead,
                      ),
                  }
                : undefined,
        },
    }));
};

const fetchInvocationHistory = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        controller.abort();
    }, INVOCATION_HISTORY_TIMEOUT_MS);

    try {
        return await fetch("/api/invocations?includeMeta=1", {
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

const appendMissingFallbackInvocations = async (
    historyRecords: CachedInvocationRecord[],
) => {
    const fallbackRecords = await loadFallbackInvocations();
    const existingInvocationIds = new Set(
        historyRecords
            .map((record) => record.invocation.invocacao?.id)
            .filter(Boolean),
    );
    const missingFallbackRecords = fallbackRecords.filter((record) => {
        const invocationId = record.invocation.invocacao?.id;

        return !invocationId || !existingInvocationIds.has(invocationId);
    });

    return [...historyRecords, ...missingFallbackRecords];
};

export const loadInvocationHistoryCache = async (force = false) => {
    if (!force && cachedRecords) return cachedRecords;
    if (!force && pendingLoad) return pendingLoad;

    pendingLoad = fetchInvocationHistory()
        .then(async (response) => {
            if (!response.ok) {
                console.warn(
                    "Invocation history unavailable; using starter invocations.",
                );
                cachedRecords = await loadFallbackInvocations();

                return cachedRecords;
            }

            const data = (await response.json()) as {
                invocations?: CachedInvocationRecord[];
            };

            const historyRecords = sortRecords(data.invocations ?? []);
            cachedRecords =
                await appendMissingFallbackInvocations(historyRecords);
            return cachedRecords;
        })
        .catch(async (error) => {
            console.warn(
                "Failed to load invocation history; using starter invocations.",
                error,
            );
            cachedRecords = await loadFallbackInvocations();

            return cachedRecords;
        })
        .finally(() => {
            pendingLoad = null;
        });

    return pendingLoad;
};

export const getCachedInvocationHistory = () => cachedRecords;

export const getInitialGameInvocations = (limit: number) => {
    if (!cachedRecords) return null;

    return cachedRecords.slice(0, limit).map((record) => record.invocation);
};

export const setCachedInvocationFavorite = (
    id: string,
    isFavorite: boolean,
) => {
    if (!cachedRecords) return;

    cachedRecords = sortRecords(
        cachedRecords.map((record) =>
            record.id === id ? { ...record, isFavorite } : record,
        ),
    );
};

export const removeCachedInvocation = (id: string) => {
    if (!cachedRecords) return;

    cachedRecords = cachedRecords.filter((record) => record.id !== id);
};
