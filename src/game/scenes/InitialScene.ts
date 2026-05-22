import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import {
    getCachedInvocationHistory,
    loadInvocationHistoryCache,
} from "../invocationHistoryCache";
import {
    playBackgroundMusic,
    preloadBackgroundMusic,
} from "../backgroundMusic";
import {
    playButtonClickSound,
    playButtonHoverSound,
    preloadButtonSounds,
} from "../buttonSounds";

type MenuButton = {
    image: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    yOffset: number;
};

export class InitialScene extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private logo!: Phaser.GameObjects.Image;
    private loadingText!: Phaser.GameObjects.Text;
    private loadingBarFrame!: Phaser.GameObjects.Rectangle;
    private loadingBarFill!: Phaser.GameObjects.Rectangle;
    private loadingTween?: Phaser.Tweens.Tween;
    private menuButtons: MenuButton[] = [];

    constructor() {
        super("InitialScene");
    }

    preload() {
        this.load.image("initial_background", "assets/initial_background.png");
        this.load.image("initial_button", "assets/avoid_button.png");
        this.load.image("initial_logo", "assets/game_logo.png");
        preloadBackgroundMusic(this);
        preloadButtonSounds(this);
    }

    create() {
        this.registerMenuFont();
        playBackgroundMusic(this);

        this.background = this.add.image(0, 0, "initial_background");
        this.logo = this.add.image(0, 0, "initial_logo").setDepth(1);
        this.loadingBarFrame = this.add
            .rectangle(0, 0, 360, 14, 0x120711, 0.84)
            .setStrokeStyle(2, 0xf3b45a, 0.9)
            .setDepth(4);
        this.loadingBarFill = this.add
            .rectangle(0, 0, 1, 8, 0x8f35d5, 0.95)
            .setOrigin(0, 0.5)
            .setDepth(5);
        this.loadingText = this.add
            .text(0, 0, "CARREGANDO DADOS...", {
                fontFamily: "AriW9500, monospace",
                fontSize: "16px",
                color: "#f4e7a1",
                align: "center",
                stroke: "#120711",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(5);

        this.createMenuButton("INICIAR", -104, () => {
            this.scene.start("Game");
        });
        this.createMenuButton("GALERIA", 16, () => {
            this.scene.start("GalleryScene");
        });
        this.createMenuButton("CONFIG", 136, () => {
            this.scene.start("SettingsScene");
        });

        this.layoutScene();
        this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        });

        if (getCachedInvocationHistory()) {
            this.setLoadingProgressVisible(false);
        } else {
            this.startLoadingProgress();
            void loadInvocationHistoryCache()
                .then(() => this.finishLoadingProgress("DADOS CARREGADOS"))
                .catch((error) => {
                    console.error("Failed to preload invocation history:", error);
                    this.finishLoadingProgress("DADOS INDISPONIVEIS");
                });
        }
        EventBus.emit("current-scene-ready", this);
    }

    private createMenuButton(label: string, yOffset: number, onClick: () => void) {
        const image = this.add
            .image(0, 0, "initial_button")
            .setInteractive({ useHandCursor: true })
            .setDepth(2);

        const buttonLabel = this.add
            .text(0, 0, label, {
                fontFamily: "AriW9500, monospace",
                fontSize: "36px",
                color: "#f4e7a1",
                align: "center",
                stroke: "#241006",
                strokeThickness: 5,
            })
            .setOrigin(0.5)
            .setDepth(3);

        image.on("pointerover", () => {
            playButtonHoverSound(this);
            image.setTint(0xc68cff);
            buttonLabel.setColor("#ffffff");
        });
        image.on("pointerout", () => {
            image.clearTint();
            buttonLabel.setColor("#f4e7a1");
        });
        image.on("pointerdown", () => {
            playButtonClickSound(this);
            this.time.delayedCall(90, onClick);
        });

        this.menuButtons.push({ image, label: buttonLabel, yOffset });
    }

    private layoutScene() {
        const width = this.scale.width;
        const height = this.scale.height;
        const backgroundScale = Math.max(
            width / this.background.width,
            height / this.background.height,
        );
        const logoWidth = Math.min(width * 0.62, 620);
        const buttonWidth = Math.min(width * 0.52, 430);
        const buttonHeight = buttonWidth * (119 / 518);
        const menuCenterX = width * 0.52;
        const menuCenterY = height * 0.58;

        this.background
            .setPosition(width / 2, height / 2)
            .setScale(backgroundScale);

        this.logo
            .setPosition(width * 0.52, height * 0.23)
            .setDisplaySize(logoWidth, logoWidth * (326 / 655));

        this.menuButtons.forEach((button) => {
            const y = menuCenterY + button.yOffset;
            button.image
                .setPosition(menuCenterX, y)
                .setDisplaySize(buttonWidth, buttonHeight);
            button.label
                .setPosition(menuCenterX, y)
                .setFontSize(Math.max(24, Math.round(buttonWidth * 0.083)));
        });

        const loadingWidth = Math.min(width * 0.44, 360);
        const lastButtonBottom =
            menuCenterY +
            Math.max(...this.menuButtons.map((button) => button.yOffset)) +
            buttonHeight / 2;
        const loadingY = lastButtonBottom + 44;
        this.loadingBarFrame
            .setPosition(menuCenterX, loadingY)
            .setSize(loadingWidth, 14);
        this.loadingBarFill.setPosition(menuCenterX - loadingWidth / 2 + 4, loadingY);
        this.loadingBarFill.height = 8;
        this.loadingText.setPosition(menuCenterX, loadingY - 27);
    }

    private startLoadingProgress() {
        this.setLoadingProgressVisible(true);
        const maxWidth = Math.max(1, this.loadingBarFrame.width - 8);
        this.loadingBarFill.width = Math.max(32, maxWidth * 0.18);
        this.loadingTween?.stop();
        this.loadingTween = this.tweens.add({
            targets: this.loadingBarFill,
            width: maxWidth,
            duration: 950,
            ease: "Sine.easeInOut",
            yoyo: true,
            repeat: -1,
        });
    }

    private setLoadingProgressVisible(isVisible: boolean) {
        this.loadingText.setVisible(isVisible);
        this.loadingBarFrame.setVisible(isVisible);
        this.loadingBarFill.setVisible(isVisible);
    }

    private finishLoadingProgress(message: string) {
        const maxWidth = Math.max(1, this.loadingBarFrame.width - 8);
        this.loadingTween?.stop();
        this.loadingTween = undefined;
        this.loadingBarFill.width = maxWidth;
        this.loadingText.setText(message);

        this.tweens.add({
            targets: [
                this.loadingText,
                this.loadingBarFrame,
                this.loadingBarFill,
            ],
            alpha: 0.3,
            delay: 850,
            duration: 320,
            ease: "Sine.easeOut",
        });
    }

    private registerMenuFont() {
        if (typeof document === "undefined") return;

        const fontId = "ari-w9500-menu-font";
        if (document.getElementById(fontId)) return;

        const style = document.createElement("style");
        style.id = fontId;
        style.textContent = `
            @font-face {
                font-family: "AriW9500";
                src: url("/assets/fonts/ari-w9500-bold.ttf") format("truetype");
                font-weight: 700;
                font-style: normal;
                font-display: swap;
            }
        `;
        document.head.appendChild(style);
    }
}
