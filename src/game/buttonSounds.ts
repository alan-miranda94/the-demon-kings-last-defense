import * as Phaser from "phaser";

const BUTTON_CLICK_KEY = "button_mouse_click";
const BUTTON_HOVER_KEY = "button_mouse_hover";
const BUTTON_CLICK_PATH = "assets/sounds/mouse_click.mp3";
const BUTTON_HOVER_PATH = "assets/sounds/mouse_houver.mp3";

export const preloadButtonSounds = (scene: Phaser.Scene) => {
    if (!scene.cache.audio.exists(BUTTON_CLICK_KEY)) {
        scene.load.audio(BUTTON_CLICK_KEY, [BUTTON_CLICK_PATH]);
    }

    if (!scene.cache.audio.exists(BUTTON_HOVER_KEY)) {
        scene.load.audio(BUTTON_HOVER_KEY, [BUTTON_HOVER_PATH]);
    }
};

export const playButtonClickSound = (scene: Phaser.Scene) => {
    playButtonSound(scene, BUTTON_CLICK_KEY, 0.45);
};

export const playButtonHoverSound = (scene: Phaser.Scene) => {
    playButtonSound(scene, BUTTON_HOVER_KEY, 0.34);
};

const playButtonSound = (
    scene: Phaser.Scene,
    key: string,
    volume: number,
) => {
    try {
        if (!scene.cache.audio.exists(key)) return;

        if (scene.sound.locked) {
            scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
                if (scene.cache.audio.exists(key)) {
                    scene.sound.play(key, { volume });
                }
            });
            return;
        }

        scene.sound.play(key, { volume });
    } catch (error) {
        console.warn("Button sound failed:", error);
    }
};
