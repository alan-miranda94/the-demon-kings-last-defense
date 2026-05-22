import { Game as MainGame } from "./scenes/Game";
import { GalleryScene } from "./scenes/GalleryScene";
import { InitialScene } from "./scenes/InitialScene";
import { SettingsScene } from "./scenes/SettingsScene";
import * as Phaser from "phaser";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: "game-container",
    backgroundColor: "#0b0613",
    pixelArt: true,
    roundPixels: true,
    dom: {
        createContainer: true,
    },
    physics: {
        default: "arcade",
        arcade: {
            gravity: { x: 0, y: 900 },
            debug: false,
        },
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: "100%",
        height: "100%",
        expandParent: true,
    },
    scene: [InitialScene, GalleryScene, SettingsScene, MainGame],
};

const StartGame = (parent: string) => {
    return new Phaser.Game({ ...config, parent });
};

export default StartGame;
