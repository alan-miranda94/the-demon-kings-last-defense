import * as Phaser from "phaser";
import { getGameSettings } from "./gameSettings";

const BACKGROUND_MUSIC_KEY = "background_music";
const BACKGROUND_MUSIC_PATH = "assets/sounds/background.mp3";

let backgroundMusic: Phaser.Sound.BaseSound | undefined;
let isWaitingForUnlock = false;

export const preloadBackgroundMusic = (scene: Phaser.Scene) => {
    if (scene.cache.audio.exists(BACKGROUND_MUSIC_KEY)) return;

    scene.load.audio(BACKGROUND_MUSIC_KEY, [BACKGROUND_MUSIC_PATH]);
};

export const playBackgroundMusic = (scene: Phaser.Scene) => {
    const settings = getGameSettings();

    if (!settings.backgroundMusicEnabled) {
        stopBackgroundMusic();
        return;
    }

    if (!scene.cache.audio.exists(BACKGROUND_MUSIC_KEY)) {
        preloadBackgroundMusic(scene);
        scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
            playBackgroundMusic(scene);
        });

        if (!scene.load.isLoading()) {
            scene.load.start();
        }

        return;
    }

    if (backgroundMusic?.isPlaying) return;

    backgroundMusic =
        backgroundMusic ??
        scene.sound.add(BACKGROUND_MUSIC_KEY, {
            loop: true,
            volume: settings.backgroundMusicVolume,
        });
    setBackgroundMusicVolume(settings.backgroundMusicVolume);

    const playMusic = () => {
        isWaitingForUnlock = false;

        try {
            if (!backgroundMusic?.isPlaying) {
                backgroundMusic?.play();
            }
        } catch (error) {
            console.warn("Background music play failed:", error);
        }
    };

    if (scene.sound.locked) {
        if (!isWaitingForUnlock) {
            isWaitingForUnlock = true;
            scene.input.once("pointerdown", playMusic);
        }

        return;
    }

    playMusic();
};

export const stopBackgroundMusic = () => {
    try {
        backgroundMusic?.stop();
    } catch (error) {
        console.warn("Background music stop failed:", error);
    }
};

export const setBackgroundMusicVolume = (volume: number) => {
    try {
        const sound = backgroundMusic as
            | (Phaser.Sound.BaseSound & {
                  setVolume?: (volume: number) => Phaser.Sound.BaseSound;
                  volume?: number;
              })
            | undefined;

        if (sound?.setVolume) {
            sound.setVolume(volume);
            return;
        }

        if (sound) {
            sound.volume = volume;
        }
    } catch (error) {
        console.warn("Background music volume update failed:", error);
    }
};
