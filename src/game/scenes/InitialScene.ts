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

type StoryPage = {
    title: string;
    body: string;
};

const STORY_PAGES: StoryPage[] = [
    {
        title: "O TRONO ESQUECIDO",
        body: "Nas terras que os reinos abandonaram, monstros, espíritos e exilados encontraram abrigo sob minha coroa.",
    },
    {
        title: "A CRUZADA DO HERÓI",
        body: "Eles chamam de justiça. Eu chamo de invasão. O herói cruzou minhas fronteiras e destruiu tudo que eu protegia.",
    },
    {
        title: "O NOME QUE ME DERAM",
        body: "Se querem que eu seja o Rei Demônio, então eu serei. Que tremam diante do nome que cuspiram sobre mim.",
    },
    {
        title: "A ÚLTIMA DEFESA",
        body: "Não luto para conquistar o mundo. Luto para defender o último castelo que ainda é meu.",
    },
];
const STORY_AUDIO_KEYS = STORY_PAGES.map(
    (_page, index) => `story_phase_${index + 1}`,
);

export class InitialScene extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private logo!: Phaser.GameObjects.Image;
    private loadingText!: Phaser.GameObjects.Text;
    private loadingBarFrame!: Phaser.GameObjects.Rectangle;
    private loadingBarFill!: Phaser.GameObjects.Rectangle;
    private loadingTween?: Phaser.Tweens.Tween;
    private menuButtons: MenuButton[] = [];
    private storyOverlay?: Phaser.GameObjects.Container;
    private storyShade?: Phaser.GameObjects.Rectangle;
    private storyPanel?: Phaser.GameObjects.Rectangle;
    private storyTitle?: Phaser.GameObjects.Text;
    private storyBody?: Phaser.GameObjects.Text;
    private storyCounter?: Phaser.GameObjects.Text;
    private storyPrevButton?: Phaser.GameObjects.Text;
    private storyNextButton?: Phaser.GameObjects.Text;
    private storyStartButton?: Phaser.GameObjects.Text;
    private storyCloseButton?: Phaser.GameObjects.Text;
    private storyVoiceSound?: Phaser.Sound.BaseSound;
    private storyPageIndex = 0;

    constructor() {
        super("InitialScene");
    }

    preload() {
        this.load.image("initial_background", "assets/initial_background.png");
        this.load.image("initial_button", "assets/avoid_button.png");
        this.load.image("initial_logo", "assets/game_logo.png");
        STORY_AUDIO_KEYS.forEach((key, index) => {
            this.load.audio(key, [`assets/sounds/phase_${index + 1}.mp3`]);
        });
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

        this.createMenuButton("INICIAR", -100, () => {
            this.startGame();
        });
        this.createMenuButton("HISTORIA", 0, () => {
            this.showStoryOverlay();
        });
        this.createMenuButton("GALERIA", 100, () => {
            this.scene.start("GalleryScene");
        });
        this.createMenuButton("CONFIG", 200, () => {
            this.scene.start("SettingsScene");
        });
        this.createStoryOverlay();

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
                    console.error(
                        "Failed to preload invocation history:",
                        error,
                    );
                    this.finishLoadingProgress("DADOS INDISPONIVEIS");
                });
        }
        EventBus.emit("current-scene-ready", this);
    }

    private createMenuButton(
        label: string,
        yOffset: number,
        onClick: () => void,
    ) {
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
        const buttonWidth = Math.min(width * 0.43, 340);
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
                .setFontSize(Math.max(20, Math.round(buttonWidth * 0.075)));
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
        this.loadingBarFill.setPosition(
            menuCenterX - loadingWidth / 2 + 4,
            loadingY,
        );
        this.loadingBarFill.height = 8;
        this.loadingText.setPosition(menuCenterX, loadingY - 27);
        this.layoutStoryOverlay(width, height);
    }

    private createStoryOverlay() {
        const depth = 20;
        this.storyShade = this.add
            .rectangle(0, 0, 1, 1, 0x05020a, 0.88)
            .setOrigin(0)
            .setInteractive();
        this.storyPanel = this.add
            .rectangle(0, 0, 1, 1, 0x160713, 0.96)
            .setStrokeStyle(3, 0xf3b45a, 0.9);
        this.storyTitle = this.add
            .text(0, 0, "", {
                fontFamily: "AriW9500, monospace",
                fontSize: "30px",
                color: "#f3b45a",
                align: "center",
                stroke: "#120711",
                strokeThickness: 5,
            })
            .setOrigin(0.5);
        this.storyBody = this.add
            .text(0, 0, "", {
                fontFamily: "AriW9500, monospace",
                fontSize: "20px",
                color: "#f4e7d0",
                align: "center",
                lineSpacing: 10,
                wordWrap: { width: 520 },
                stroke: "#120711",
                strokeThickness: 3,
            })
            .setOrigin(0.5);
        this.storyCounter = this.add
            .text(0, 0, "", {
                fontFamily: "AriW9500, monospace",
                fontSize: "15px",
                color: "#b88f68",
                align: "center",
            })
            .setOrigin(0.5);
        this.storyPrevButton = this.createStoryTextButton("ANTERIOR", () => {
            this.setStoryPage(this.storyPageIndex - 1);
        });
        this.storyNextButton = this.createStoryTextButton("PROXIMO", () => {
            this.setStoryPage(this.storyPageIndex + 1);
        });
        this.storyStartButton = this.createStoryTextButton(
            "INICIAR DEFESA",
            () => {
                this.startGame();
            },
        );
        this.storyCloseButton = this.createStoryTextButton("VOLTAR", () => {
            this.hideStoryOverlay();
        });

        this.storyOverlay = this.add
            .container(0, 0, [
                this.storyShade,
                this.storyPanel,
                this.storyTitle,
                this.storyBody,
                this.storyCounter,
                this.storyPrevButton,
                this.storyNextButton,
                this.storyStartButton,
                this.storyCloseButton,
            ])
            .setDepth(depth)
            .setVisible(false);
        this.setStoryPage(0);
    }

    private createStoryTextButton(label: string, onClick: () => void) {
        const button = this.add
            .text(0, 0, label, {
                fontFamily: "AriW9500, monospace",
                fontSize: "18px",
                color: "#f4e7a1",
                align: "center",
                backgroundColor: "#2b1020",
                padding: { x: 18, y: 10 },
                stroke: "#120711",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        button.on("pointerover", () => {
            playButtonHoverSound(this);
            button.setColor("#ffffff");
        });
        button.on("pointerout", () => {
            button.setColor("#f4e7a1");
        });
        button.on("pointerdown", () => {
            playButtonClickSound(this);
            onClick();
        });

        return button;
    }

    private layoutStoryOverlay(width: number, height: number) {
        if (!this.storyOverlay) return;

        const panelWidth = Math.min(width * 0.82, 720);
        const panelHeight = Math.min(height * 0.68, 430);
        const centerX = width / 2;
        const centerY = height / 2;

        this.storyShade?.setSize(width, height);
        this.storyPanel
            ?.setPosition(centerX, centerY)
            .setSize(panelWidth, panelHeight);
        this.storyTitle?.setPosition(centerX, centerY - panelHeight * 0.28);
        this.storyBody
            ?.setPosition(centerX, centerY - 4)
            .setWordWrapWidth(panelWidth - 120);
        this.storyCounter?.setPosition(centerX, centerY + panelHeight * 0.24);
        this.storyPrevButton?.setPosition(
            centerX - panelWidth * 0.29,
            centerY + panelHeight * 0.36,
        );
        this.storyNextButton?.setPosition(
            centerX,
            centerY + panelHeight * 0.36,
        );
        this.storyStartButton?.setPosition(
            centerX + panelWidth * 0.29,
            centerY + panelHeight * 0.36,
        );
        this.storyCloseButton?.setPosition(
            centerX + panelWidth * 0.39,
            centerY - panelHeight * 0.39,
        );
    }

    private showStoryOverlay() {
        this.storyOverlay?.setVisible(true);
        this.setStoryPage(0);
    }

    private hideStoryOverlay() {
        this.storyOverlay?.setVisible(false);
        this.stopStoryVoice();
    }

    private setStoryPage(index: number) {
        const maxIndex = STORY_PAGES.length - 1;
        this.storyPageIndex = Phaser.Math.Clamp(index, 0, maxIndex);
        const page = STORY_PAGES[this.storyPageIndex];

        this.storyTitle?.setText(page.title);
        this.storyBody?.setText(page.body);
        this.storyCounter?.setText(
            `${this.storyPageIndex + 1}/${STORY_PAGES.length}`,
        );
        this.storyPrevButton?.setAlpha(this.storyPageIndex === 0 ? 0.45 : 1);
        this.storyNextButton?.setVisible(this.storyPageIndex < maxIndex);
        this.storyStartButton?.setVisible(this.storyPageIndex === maxIndex);

        if (this.storyOverlay?.visible) {
            this.playStoryVoice();
        }
    }

    private playStoryVoice() {
        const audioKey = STORY_AUDIO_KEYS[this.storyPageIndex];
        if (!audioKey || !this.cache.audio.exists(audioKey)) return;

        this.stopStoryVoice();

        try {
            if (this.sound.locked) {
                this.input.once("pointerdown", () => this.playStoryVoice());
                return;
            }

            this.storyVoiceSound = this.sound.add(audioKey, {
                volume: 0.95,
            });
            this.storyVoiceSound.play();
        } catch (error) {
            console.warn("Story voice audio failed:", error);
        }
    }

    private stopStoryVoice() {
        if (!this.storyVoiceSound) return;

        try {
            this.storyVoiceSound.stop();
            this.storyVoiceSound.destroy();
        } catch (error) {
            console.warn("Story voice audio stop failed:", error);
        } finally {
            this.storyVoiceSound = undefined;
        }
    }

    private startGame() {
        this.stopStoryVoice();
        this.scene.start("Game");
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
