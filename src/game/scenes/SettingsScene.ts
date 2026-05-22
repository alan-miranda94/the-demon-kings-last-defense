import * as Phaser from "phaser";
import {
    playBackgroundMusic,
    preloadBackgroundMusic,
    setBackgroundMusicVolume,
    stopBackgroundMusic,
} from "../backgroundMusic";
import {
    getCastleDistanceLimits,
    getGameSettings,
    getMusicVolumeLimits,
    saveGameSettings,
    type GameSettings,
} from "../gameSettings";
import { EventBus } from "../EventBus";
import {
    playButtonClickSound,
    playButtonHoverSound,
    preloadButtonSounds,
} from "../buttonSounds";
import { GAME_HEIGHT, GAME_WIDTH } from "./Game";

type SettingsButton = {
    background: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    setPosition: (x: number, y: number, width: number, height: number) => void;
};

const DISTANCE_STEP = 1000;
const VOLUME_STEP = 0.05;
const FONT_FAMILY = "AriW9500, Georgia, serif";

export class SettingsScene extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private panel!: Phaser.GameObjects.Image;
    private frameGraphics!: Phaser.GameObjects.Graphics;
    private titleText!: Phaser.GameObjects.Text;
    private audioSectionImage!: Phaser.GameObjects.Image;
    private aiSectionImage!: Phaser.GameObjects.Image;
    private gameSectionImage!: Phaser.GameObjects.Image;
    private audioSectionText!: Phaser.GameObjects.Text;
    private aiSectionText!: Phaser.GameObjects.Text;
    private gameSectionText!: Phaser.GameObjects.Text;
    private musicLabelText!: Phaser.GameObjects.Text;
    private volumeLabelText!: Phaser.GameObjects.Text;
    private providerLabelText!: Phaser.GameObjects.Text;
    private generateAudioLabelText!: Phaser.GameObjects.Text;
    private distanceLabelText!: Phaser.GameObjects.Text;
    private musicButton!: SettingsButton;
    private providerButton!: SettingsButton;
    private generateAudioButton!: SettingsButton;
    private volumeDownButton!: SettingsButton;
    private volumeUpButton!: SettingsButton;
    private distanceDownButton!: SettingsButton;
    private distanceUpButton!: SettingsButton;
    private backButton!: SettingsButton;
    private volumeTrack!: Phaser.GameObjects.Image;
    private volumeFill!: Phaser.GameObjects.Image;
    private volumePercentText!: Phaser.GameObjects.Text;
    private distanceValueBox!: Phaser.GameObjects.Rectangle;
    private distanceValueText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private gameLoadingContainer?: Phaser.GameObjects.Container;
    private settings: GameSettings = getGameSettings();

    constructor() {
        super("SettingsScene");
    }

    preload() {
        this.createGameLoadingScreen();

        this.load.image("settings_background", "assets/initial_background.png");
        this.load.image("settings_panel", "assets/painel.png");
        this.load.image("settings_button", "assets/avoid_button.png");
        this.load.image(
            "settings_square_button",
            "assets/avoide_square_button.png",
        );
        this.load.image("settings_volume_track", "assets/vol_avoid_bar.png");
        this.load.image("settings_volume_fill", "assets/vol_bar_full.png");
        preloadBackgroundMusic(this);
        preloadButtonSounds(this);
    }

    create() {
        this.gameLoadingContainer?.destroy(true);
        this.gameLoadingContainer = undefined;
        this.registerSettingsFont();
        this.settings = getGameSettings();
        playBackgroundMusic(this);

        this.background = this.add.image(0, 0, "settings_background");
        this.panel = this.add.image(0, 0, "settings_panel").setDepth(2);
        this.frameGraphics = this.add.graphics().setDepth(3);

        this.titleText = this.createText("CONFIGURACOES", 42, "#f7c85a", 3);
        this.audioSectionImage = this.add
            .image(0, 0, "settings_button")
            .setDepth(4);
        this.aiSectionImage = this.add
            .image(0, 0, "settings_button")
            .setDepth(4);
        this.gameSectionImage = this.add
            .image(0, 0, "settings_button")
            .setDepth(4);
        this.audioSectionText = this.createSectionText("AUDIO");
        this.aiSectionText = this.createSectionText("IA");
        this.gameSectionText = this.createSectionText("JOGO");
        this.musicLabelText = this.createText("Musica de Fundo", 20);
        this.volumeLabelText = this.createText("Volume da Musica", 20);
        this.providerLabelText = this.createText("Gerador de Imagem", 20);
        this.generateAudioLabelText = this.createText("Gerar Audio IA", 20);
        this.distanceLabelText = this.createText("Distancia ate o Castelo", 20);

        this.musicButton = this.createButton("settings_button", () => {
            this.settings.backgroundMusicEnabled =
                !this.settings.backgroundMusicEnabled;
            this.saveAndRender();

            if (this.settings.backgroundMusicEnabled) {
                playBackgroundMusic(this);
            } else {
                stopBackgroundMusic();
            }
        });
        this.providerButton = this.createButton("settings_button", () => {
            this.settings.imageGenerationProvider =
                this.settings.imageGenerationProvider === "openai"
                    ? "google"
                    : "openai";
            this.saveAndRender();
        });
        this.generateAudioButton = this.createButton("settings_button", () => {
            this.settings.generateAudio = !this.settings.generateAudio;
            this.saveAndRender();
        });
        this.volumeDownButton = this.createButton(
            "settings_square_button",
            () => {
                this.adjustVolume(-VOLUME_STEP);
            },
        );
        this.volumeUpButton = this.createButton(
            "settings_square_button",
            () => {
                this.adjustVolume(VOLUME_STEP);
            },
        );
        this.distanceDownButton = this.createButton(
            "settings_square_button",
            () => {
                this.adjustDistance(-DISTANCE_STEP);
            },
        );
        this.distanceUpButton = this.createButton(
            "settings_square_button",
            () => {
                this.adjustDistance(DISTANCE_STEP);
            },
        );
        this.backButton = this.createButton("settings_button", () => {
            this.scene.start("InitialScene");
        });

        this.volumeTrack = this.add
            .image(0, 0, "settings_volume_track")
            .setDepth(4);
        this.volumeFill = this.add
            .image(0, 0, "settings_volume_fill")
            .setOrigin(0, 0.5)
            .setDepth(5);
        this.volumePercentText = this.createText("35%", 18, "#f6df8f");
        this.distanceValueBox = this.add
            .rectangle(0, 0, 1, 1, 0x100d14, 0.95)
            .setStrokeStyle(2, 0x8b5f25, 1)
            .setDepth(3);
        this.distanceValueText = this.createText("10000 m", 20, "#f6df8f");
        this.statusText = this.createText("", 16, "#cfa7ff");

        this.renderSettings();
        this.layoutScene();
        this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        });
        EventBus.emit("current-scene-ready", this);
    }

    private createGameLoadingScreen() {
        const viewWidth = this.scale.width || GAME_WIDTH;
        const viewHeight = this.scale.height || GAME_HEIGHT;
        const centerX = viewWidth / 2;
        const centerY = viewHeight / 2;
        const barWidth = Math.min(viewWidth * 0.62, 520);
        const barHeight = 18;
        const loadingContainer = this.add.container(0, 0).setDepth(1000);
        this.gameLoadingContainer = loadingContainer;
        const overlay = this.add.rectangle(
            centerX,
            centerY,
            viewWidth,
            viewHeight,
            0x070510,
            1,
        );
        const title = this.add
            .text(centerX, centerY - 106, "CARREGANDO DEFESAS...", {
                fontFamily: "monospace",
                fontSize: "26px",
                color: "#f4e7a1",
                align: "center",
                stroke: "#120711",
                strokeThickness: 5,
            })
            .setOrigin(0.5);
        const frame = this.add
            .rectangle(centerX, centerY, barWidth, barHeight, 0x120711, 0.92)
            .setStrokeStyle(2, 0xf3b45a, 0.95);
        const fill = this.add
            .rectangle(
                centerX - barWidth / 2 + 4,
                centerY,
                1,
                barHeight - 8,
                0x8f35d5,
                0.96,
            )
            .setOrigin(0, 0.5);
        const percentText = this.add
            .text(centerX, centerY + 42, "0%", {
                fontFamily: "monospace",
                fontSize: "18px",
                color: "#ffffff",
                align: "center",
                stroke: "#120711",
                strokeThickness: 4,
            })
            .setOrigin(0.5);

        loadingContainer.add([overlay, title, frame, fill, percentText]);

        const updateProgress = (progress: number) => {
            fill.width = Math.max(1, (barWidth - 8) * progress);
            percentText.setText(`${Math.round(progress * 100)}%`);
        };
        let didCleanup = false;
        const cleanupLoadingScreen = () => {
            if (didCleanup) return;

            didCleanup = true;
            this.load.off(Phaser.Loader.Events.PROGRESS, updateProgress);
            loadingContainer.destroy(true);

            if (this.gameLoadingContainer === loadingContainer) {
                this.gameLoadingContainer = undefined;
            }
        };

        this.load.on(Phaser.Loader.Events.PROGRESS, updateProgress);
        this.load.once(Phaser.Loader.Events.COMPLETE, cleanupLoadingScreen);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanupLoadingScreen);
    }

    private createText(
        value: string,
        fontSize: number,
        color = "#f4e7a1",
        strokeThickness = 2,
    ) {
        return this.add
            .text(0, 0, value, {
                fontFamily: FONT_FAMILY,
                fontSize: `${fontSize}px`,
                color,
                align: "center",
                stroke: "#120711",
                strokeThickness,
            })
            .setOrigin(0.5)
            .setDepth(4);
    }

    private createSectionText(value: string) {
        return this.createText(value, 20, "#f7c85a", 3);
    }

    private createButton(
        textureKey: string,
        onClick: () => void,
    ): SettingsButton {
        const background = this.add
            .image(0, 0, textureKey)
            .setInteractive({ useHandCursor: true })
            .setDepth(4);
        const label = this.createText("", 18, "#f6d66d", 3).setDepth(5);

        background.on("pointerover", () => {
            playButtonHoverSound(this);
            background.setTint(0xc68cff);
            label.setColor("#ffffff");
        });
        background.on("pointerout", () => {
            background.clearTint();
            label.setColor("#f6d66d");
        });
        background.on("pointerdown", () => {
            playButtonClickSound(this);
            onClick();
        });

        return {
            background,
            label,
            setPosition: (x, y, width, height) => {
                background.setPosition(x, y).setDisplaySize(width, height);
                label
                    .setPosition(x, y)
                    .setFontSize(Math.max(16, height * 0.44));
            },
        };
    }

    private adjustDistance(amount: number) {
        const { min, max } = getCastleDistanceLimits();
        this.settings.maxDistanceToCastle = Phaser.Math.Clamp(
            this.settings.maxDistanceToCastle + amount,
            min,
            max,
        );
        this.saveAndRender();
    }

    private adjustVolume(amount: number) {
        const { min, max } = getMusicVolumeLimits();
        this.settings.backgroundMusicVolume = Phaser.Math.Clamp(
            Number((this.settings.backgroundMusicVolume + amount).toFixed(2)),
            min,
            max,
        );
        this.saveAndRender();
        setBackgroundMusicVolume(this.settings.backgroundMusicVolume);
    }

    private saveAndRender(status = "") {
        saveGameSettings(this.settings);
        this.renderSettings(status);
    }

    private renderSettings(status = "") {
        this.musicButton.label.setText(
            this.settings.backgroundMusicEnabled ? "LIGADA" : "DESLIGADA",
        );
        this.providerButton.label.setText(
            this.settings.imageGenerationProvider.toUpperCase(),
        );
        this.generateAudioButton.label.setText(
            this.settings.generateAudio ? "SIM" : "NAO",
        );
        this.volumeDownButton.label.setText("-");
        this.volumeUpButton.label.setText("+");
        this.distanceDownButton.label.setText("-");
        this.distanceUpButton.label.setText("+");
        this.backButton.label.setText("VOLTAR");
        this.volumePercentText.setText(
            `${Math.round(this.settings.backgroundMusicVolume * 100)}%`,
        );
        this.distanceValueText.setText(
            `${this.settings.maxDistanceToCastle} m`,
        );
        this.statusText.setText(status);
        this.updateVolumeSlider();
    }

    private layoutScene() {
        const width = this.scale.width;
        const height = this.scale.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const backgroundScale = Math.max(
            width / this.background.width,
            height / this.background.height,
        );
        const panelWidth = Math.min(width * 0.94, 1020);
        const panelHeight = Math.min(height * 0.94, 720);
        const panelLeft = centerX - panelWidth / 2;
        const panelTop = centerY - panelHeight / 2;
        const rowLeft = panelLeft + panelWidth * 0.09;
        const rowRight = panelLeft + panelWidth * 0.91;
        const valueX = panelLeft + panelWidth * 0.78;
        const labelX = rowLeft + 12;
        const titleY = panelTop + panelHeight * 0.1;
        const sectionWidth = Math.min(210, panelWidth * 0.28);
        const sectionHeight = 28;
        const buttonWidth = Math.min(175, panelWidth * 0.2);
        const buttonHeight = 34;
        const smallButtonSize = 44;
        const rowGap = panelHeight * 0.074;
        const audioY = panelTop + panelHeight * 0.21;
        const musicY = audioY + rowGap * 0.65;
        const volumeY = audioY + rowGap * 1.55;
        const aiY = audioY + rowGap * 2.65;
        const providerY = aiY + rowGap * 0.65;
        const generateAudioY = aiY + rowGap * 1.55;
        const gameY = aiY + rowGap * 2.9;
        const distanceY = gameY + rowGap * 0.8;
        const footerY = panelTop + panelHeight * 0.88;
        const footerButtonWidth = Math.min(265, panelWidth * 0.31);

        this.background.setPosition(centerX, centerY).setScale(backgroundScale);
        this.panel
            .setPosition(centerX, centerY)
            .setDisplaySize(panelWidth, panelHeight);
        this.drawPanel(panelLeft, panelTop, panelWidth, panelHeight, [
            audioY,
            aiY,
            gameY,
        ]);

        this.titleText
            .setPosition(centerX, titleY)
            .setFontSize(Math.max(30, panelWidth * 0.047));
        this.audioSectionText
            .setPosition(centerX, audioY)
            .setFontSize(Math.max(16, panelWidth * 0.022));
        this.aiSectionText
            .setPosition(centerX, aiY)
            .setFontSize(Math.max(16, panelWidth * 0.022));
        this.gameSectionText
            .setPosition(centerX, gameY)
            .setFontSize(Math.max(16, panelWidth * 0.022));

        this.layoutSectionTitle(
            this.audioSectionImage,
            centerX,
            audioY,
            sectionWidth,
            sectionHeight,
        );
        this.layoutSectionTitle(
            this.aiSectionImage,
            centerX,
            aiY,
            sectionWidth,
            sectionHeight,
        );
        this.layoutSectionTitle(
            this.gameSectionImage,
            centerX,
            gameY,
            sectionWidth,
            sectionHeight,
        );

        this.musicLabelText.setPosition(labelX, musicY).setOrigin(0, 0.5);
        this.volumeLabelText.setPosition(labelX, volumeY).setOrigin(0, 0.5);
        this.providerLabelText.setPosition(labelX, providerY).setOrigin(0, 0.5);
        this.generateAudioLabelText
            .setPosition(labelX, generateAudioY)
            .setOrigin(0, 0.5);
        this.distanceLabelText.setPosition(labelX, distanceY).setOrigin(0, 0.5);

        [
            this.musicLabelText,
            this.volumeLabelText,
            this.providerLabelText,
            this.generateAudioLabelText,
            this.distanceLabelText,
        ].forEach((text) => {
            text.setFontSize(Math.max(15, panelWidth * 0.022));
        });

        this.musicButton.setPosition(valueX, musicY, buttonWidth, buttonHeight);
        this.providerButton.setPosition(
            valueX,
            providerY,
            buttonWidth,
            buttonHeight,
        );
        this.generateAudioButton.setPosition(
            valueX,
            generateAudioY,
            buttonWidth,
            buttonHeight,
        );

        const sliderWidth = (rowRight - rowLeft - panelWidth * 0.34) * 0.82;
        const sliderX = labelX + panelWidth * 0.34 + sliderWidth / 2;
        this.volumeDownButton.setPosition(
            sliderX - sliderWidth / 2 - smallButtonSize * 0.7,
            volumeY,
            smallButtonSize,
            smallButtonSize * 0.8,
        );
        this.volumeUpButton.setPosition(
            sliderX + sliderWidth / 2 + smallButtonSize * 0.7,
            volumeY,
            smallButtonSize,
            smallButtonSize * 0.8,
        );
        this.volumeTrack
            .setPosition(sliderX, volumeY)
            .setDisplaySize(sliderWidth, 18);
        this.volumeFill
            .setPosition(sliderX - sliderWidth / 2, volumeY)
            .setDisplaySize(1, 14);
        this.volumePercentText
            .setPosition(sliderX, volumeY - 20)
            .setOrigin(0.5)
            .setFontSize(Math.max(15, panelWidth * 0.02));

        const distanceBoxWidth = Math.min(190, panelWidth * 0.22);
        this.distanceDownButton.setPosition(
            valueX - distanceBoxWidth * 0.66,
            distanceY,
            smallButtonSize,
            smallButtonSize,
        );
        this.distanceValueBox
            .setPosition(valueX, distanceY)
            .setSize(distanceBoxWidth, smallButtonSize * 0.78);
        this.distanceValueText
            .setPosition(valueX, distanceY)
            .setFontSize(Math.max(17, panelWidth * 0.023));
        this.distanceUpButton.setPosition(
            valueX + distanceBoxWidth * 0.66,
            distanceY,
            smallButtonSize,
            smallButtonSize,
        );

        this.backButton.setPosition(centerX, footerY, footerButtonWidth, 54);
        this.statusText
            .setPosition(centerX, footerY - 42)
            .setFontSize(Math.max(13, panelWidth * 0.017));

        this.updateVolumeSlider();
    }

    private drawPanel(
        x: number,
        y: number,
        width: number,
        height: number,
        sectionYs: number[],
    ) {
        const graphics = this.frameGraphics.clear();
        graphics.lineStyle(1, 0x8b5f25, 0.9);
        sectionYs.forEach((sectionY, index) => {
            const sectionBottom =
                index === sectionYs.length - 1
                    ? y + height * 0.78
                    : sectionYs[index + 1] - height * 0.04;
            graphics.strokeRect(
                x + width * 0.06,
                sectionY + 2,
                width * 0.88,
                sectionBottom - sectionY,
            );
            graphics.lineBetween(
                x + width * 0.06,
                sectionY,
                x + width * 0.36,
                sectionY,
            );
            graphics.lineBetween(
                x + width * 0.64,
                sectionY,
                x + width * 0.94,
                sectionY,
            );
        });
    }

    private layoutSectionTitle(
        image: Phaser.GameObjects.Image,
        centerX: number,
        centerY: number,
        width: number,
        height: number,
    ) {
        image.setPosition(centerX, centerY).setDisplaySize(width, height);
    }

    private updateVolumeSlider() {
        if (!this.volumeTrack || !this.volumeFill) return;

        const { min, max } = getMusicVolumeLimits();
        const percent = Phaser.Math.Clamp(
            (this.settings.backgroundMusicVolume - min) / (max - min),
            0,
            1,
        );
        const trackLeft =
            this.volumeTrack.x - this.volumeTrack.displayWidth / 2;
        const fillWidth = Math.max(1, this.volumeTrack.displayWidth * percent);

        this.volumeFill.setDisplaySize(
            fillWidth,
            this.volumeFill.displayHeight,
        );
    }

    private registerSettingsFont() {
        if (typeof document === "undefined") return;

        const fontId = "ari-w9500-settings-font";
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

