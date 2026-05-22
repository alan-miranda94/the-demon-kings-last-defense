export type ImageGenerationChoice = "openai" | "google";

export type GameSettings = {
    backgroundMusicEnabled: boolean;
    backgroundMusicVolume: number;
    imageGenerationProvider: ImageGenerationChoice;
    generateAudio: boolean;
    maxDistanceToCastle: number;
};

const STORAGE_KEY = "demon-kings-last-defense-settings";
const MIN_CASTLE_DISTANCE = 1000;
const MAX_CASTLE_DISTANCE = 50000;
const MIN_MUSIC_VOLUME = 0;
const MAX_MUSIC_VOLUME = 1;

export const DEFAULT_GAME_SETTINGS: GameSettings = {
    backgroundMusicEnabled: true,
    backgroundMusicVolume: 0.35,
    imageGenerationProvider: "openai",
    generateAudio: true,
    maxDistanceToCastle: 10000,
};

const clampDistance = (distance: number) =>
    Math.min(Math.max(Math.round(distance), MIN_CASTLE_DISTANCE), MAX_CASTLE_DISTANCE);
const clampVolume = (volume: number) =>
    Math.min(Math.max(volume, MIN_MUSIC_VOLUME), MAX_MUSIC_VOLUME);

const isImageGenerationChoice = (
    value: unknown,
): value is ImageGenerationChoice => value === "openai" || value === "google";

export const getGameSettings = (): GameSettings => {
    if (typeof window === "undefined") return DEFAULT_GAME_SETTINGS;

    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) return DEFAULT_GAME_SETTINGS;

        const parsed = JSON.parse(saved) as Partial<GameSettings>;

        return {
            backgroundMusicEnabled:
                typeof parsed.backgroundMusicEnabled === "boolean"
                    ? parsed.backgroundMusicEnabled
                    : DEFAULT_GAME_SETTINGS.backgroundMusicEnabled,
            backgroundMusicVolume:
                typeof parsed.backgroundMusicVolume === "number"
                    ? clampVolume(parsed.backgroundMusicVolume)
                    : DEFAULT_GAME_SETTINGS.backgroundMusicVolume,
            imageGenerationProvider: isImageGenerationChoice(
                parsed.imageGenerationProvider,
            )
                ? parsed.imageGenerationProvider
                : DEFAULT_GAME_SETTINGS.imageGenerationProvider,
            generateAudio:
                typeof parsed.generateAudio === "boolean"
                    ? parsed.generateAudio
                    : DEFAULT_GAME_SETTINGS.generateAudio,
            maxDistanceToCastle:
                typeof parsed.maxDistanceToCastle === "number"
                    ? clampDistance(parsed.maxDistanceToCastle)
                    : DEFAULT_GAME_SETTINGS.maxDistanceToCastle,
        };
    } catch (error) {
        console.warn("Failed to read game settings:", error);
        return DEFAULT_GAME_SETTINGS;
    }
};

export const saveGameSettings = (settings: GameSettings) => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
            ...settings,
            backgroundMusicVolume: clampVolume(settings.backgroundMusicVolume),
            maxDistanceToCastle: clampDistance(settings.maxDistanceToCastle),
        }),
    );
};

export const updateGameSettings = (
    updater: (settings: GameSettings) => GameSettings,
) => {
    const nextSettings = updater(getGameSettings());
    saveGameSettings(nextSettings);

    return nextSettings;
};

export const getCastleDistanceLimits = () => ({
    min: MIN_CASTLE_DISTANCE,
    max: MAX_CASTLE_DISTANCE,
});

export const getMusicVolumeLimits = () => ({
    min: MIN_MUSIC_VOLUME,
    max: MAX_MUSIC_VOLUME,
});
