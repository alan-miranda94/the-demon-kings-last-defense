import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import {
    getCachedInvocationHistory,
    loadInvocationHistoryCache,
    removeCachedInvocation,
    setCachedInvocationFavorite,
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

type GalleryInvocation = {
    id: string;
    createdAt: string;
    isFavorite: boolean;
    invocation: {
        invocacao?: {
            nome?: string;
            tipo?: string;
            custoMana?: number;
            imageUrl?: string | null;
            placeholderSprite?: string;
            mensagemCombate?: string;
            mensagemAcaoHeroi?: string;
        };
    };
};

type GalleryButton = {
    image: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
};

const LOGO_ASPECT = 655 / 326;
const BUTTON_ASPECT = 518 / 119;
const PAGE_SIZE = 10;
const CARD_WIDTH = 112;
const CARD_HEIGHT = 151;
const CARD_IMAGE_SIZE = 76;
const CARD_COLUMNS = 5;
const CARD_GAP_X = 24;
const CARD_GAP_Y = 18;
const IMAGE_GENERATE_SIZE = 1024;

export class GalleryScene extends Phaser.Scene {
    private background!: Phaser.GameObjects.Image;
    private logo!: Phaser.GameObjects.Image;
    private panel!: Phaser.GameObjects.Image;
    private titleText!: Phaser.GameObjects.Text;
    private statusText!: Phaser.GameObjects.Text;
    private pageText!: Phaser.GameObjects.Text;
    private contentContainer!: Phaser.GameObjects.Container;
    private maskGraphics!: Phaser.GameObjects.Graphics;
    private navButtons: GalleryButton[] = [];
    private previousPageButton!: GalleryButton;
    private nextPageButton!: GalleryButton;
    private cardContainers: Phaser.GameObjects.Container[] = [];
    private invocations: GalleryInvocation[] = [];
    private currentPage = 0;
    private listBounds = new Phaser.Geom.Rectangle(0, 0, 1, 1);
    private hasQueuedArtworkLoad = false;

    constructor() {
        super("GalleryScene");
    }

    preload() {
        this.load.image("gallery_background", "assets/initial_background.png");
        this.load.image("gallery_button", "assets/avoid_button.png");
        this.load.image("gallery_logo", "assets/game_logo.png");
        this.load.image("gallery_panel", "assets/painel.png");
        this.load.image("gallery_card", "assets/avoid_card.png");
        preloadBackgroundMusic(this);
        preloadButtonSounds(this);
    }

    create() {
        this.registerGalleryFont();
        playBackgroundMusic(this);

        this.background = this.add.image(0, 0, "gallery_background");
        this.logo = this.add.image(0, 0, "gallery_logo").setDepth(1);
        this.panel = this.add.image(0, 0, "gallery_panel").setDepth(1);
        this.titleText = this.add
            .text(0, 0, "GALERIA DE INVOCACOES", {
                fontFamily: "AriW9500, monospace",
                fontSize: "34px",
                color: "#f0b348",
                align: "center",
                stroke: "#170904",
                strokeThickness: 5,
            })
            .setOrigin(0.5)
            .setDepth(2);
        this.statusText = this.add
            .text(0, 0, "Carregando invocacoes...", {
                fontFamily: "AriW9500, monospace",
                fontSize: "20px",
                color: "#efe6d2",
                align: "center",
                stroke: "#110710",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(3);
        this.pageText = this.add
            .text(0, 0, "PAGINA 1 / 1", {
                fontFamily: "AriW9500, monospace",
                fontSize: "16px",
                color: "#f4dc83",
                align: "center",
                stroke: "#110710",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(4);

        this.contentContainer = this.add.container(0, 0).setDepth(3);
        this.maskGraphics = this.add.graphics().setVisible(false);
        this.contentContainer.setMask(this.maskGraphics.createGeometryMask());

        this.createNavButton("VOLTAR", -180, () => {
            this.scene.start("InitialScene");
        });
        this.createNavButton("CRIAR INVOCACAO", 180, () => {
            this.scene.start("Game");
        });
        this.previousPageButton = this.createButton("ANTERIOR", () => {
            this.changePage(-1);
        });
        this.nextPageButton = this.createButton("PROXIMA", () => {
            this.changePage(1);
        });

        this.layoutScene();
        this.scale.on(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.layoutScene, this);
        });

        void this.loadInvocations();
        EventBus.emit("current-scene-ready", this);
    }

    private async loadInvocations() {
        const cachedInvocations = getCachedInvocationHistory();

        if (cachedInvocations) {
            this.invocations = cachedInvocations as GalleryInvocation[];
            this.renderRows();
            return;
        }

        this.setStatus("Carregando invocacoes...");

        try {
            this.invocations = (await loadInvocationHistoryCache(
                false,
            )) as GalleryInvocation[];
            this.renderRows();
        } catch (error) {
            this.invocations = [];
            this.renderRows(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar invocacoes.",
            );
        }
    }

    private renderRows(errorMessage?: string) {
        this.cardContainers.forEach((card) => card.destroy(true));
        this.cardContainers = [];

        if (errorMessage) {
            this.setStatus(errorMessage);
            this.updatePaginationText();
            return;
        }

        if (this.invocations.length === 0) {
            this.setStatus("Nenhuma invocacao criada ainda.");
            this.currentPage = 0;
            this.updatePaginationText();
            return;
        }

        this.setStatus("");
        this.hasQueuedArtworkLoad = false;
        this.currentPage = Phaser.Math.Clamp(
            this.currentPage,
            0,
            this.getTotalPages() - 1,
        );

        const pageStart = this.currentPage * PAGE_SIZE;
        const pageInvocations = this.invocations.slice(
            pageStart,
            pageStart + PAGE_SIZE,
        );

        pageInvocations.forEach((item, index) => {
            const column = index % CARD_COLUMNS;
            const row = Math.floor(index / CARD_COLUMNS);
            const card = this.createInvocationCard(
                item,
                column * (CARD_WIDTH + CARD_GAP_X),
                row * (CARD_HEIGHT + CARD_GAP_Y),
            );
            this.contentContainer.add(card);
            this.cardContainers.push(card);
        });

        if (this.hasQueuedArtworkLoad) {
            this.load.start();
        }

        this.updatePaginationText();
    }

    private createInvocationCard(item: GalleryInvocation, x: number, y: number) {
        const invocation = item.invocation.invocacao;
        const name = invocation?.nome ?? "Invocacao sem nome";
        const type = this.formatInvocationType(invocation?.tipo);
        const mana = invocation?.custoMana ?? 0;
        const card = this.add.container(x, y);
        const frame = this.add
            .image(0, 0, "gallery_card")
            .setOrigin(0, 0)
            .setDisplaySize(CARD_WIDTH, CARD_HEIGHT);
        const symbol = this.add
            .text(CARD_WIDTH / 2, 48, this.getInvocationCardSymbol(type), {
                fontFamily: "AriW9500, monospace",
                fontSize: "24px",
                color: "#fff1b8",
                align: "center",
                stroke: "#160915",
                strokeThickness: 5,
            })
            .setOrigin(0.5);
        const title = this.add
            .text(CARD_WIDTH / 2, 86, this.shortenText(name.toUpperCase(), 24), {
                fontFamily: "AriW9500, monospace",
                fontSize: "10px",
                color: "#ffffff",
                align: "center",
                stroke: "#100610",
                strokeThickness: 2,
                wordWrap: { width: CARD_WIDTH - 18 },
            })
            .setOrigin(0.5, 0);
        const cost = this.add
            .text(CARD_WIDTH / 2, CARD_HEIGHT - 18, String(mana), {
                fontFamily: "AriW9500, monospace",
                fontSize: "12px",
                color: "#ffffff",
                align: "center",
                stroke: "#09050d",
                strokeThickness: 3,
            })
            .setOrigin(0.5);
        const typeLabel = this.add
            .text(CARD_WIDTH / 2, CARD_HEIGHT - 36, type, {
                fontFamily: "AriW9500, monospace",
                fontSize: "8px",
                color: "#b772ff",
                align: "center",
                stroke: "#09050d",
                strokeThickness: 2,
            })
            .setOrigin(0.5);
        const deleteHitArea = this.add
            .rectangle(CARD_WIDTH - 21, 20, 24, 24, 0x3d0b0b, 0.86)
            .setStrokeStyle(1, 0xf3b45a, 0.9)
            .setInteractive({ useHandCursor: true });
        const favoriteHitArea = this.add
            .rectangle(21, 20, 24, 24, 0x180c22, 0.86)
            .setStrokeStyle(1, 0xf3b45a, 0.9)
            .setInteractive({ useHandCursor: true });
        const favoriteLabel = this.add
            .text(favoriteHitArea.x, favoriteHitArea.y - 1, "♥", {
                fontFamily: "AriW9500, monospace",
                fontSize: "15px",
                color: item.isFavorite ? "#ff5f8f" : "#8a6d8f",
                align: "center",
                stroke: "#160915",
                strokeThickness: 2,
            })
            .setOrigin(0.5);
        const deleteLabel = this.add
            .text(deleteHitArea.x, deleteHitArea.y - 1, "X", {
                fontFamily: "AriW9500, monospace",
                fontSize: "14px",
                color: "#f8e39a",
                align: "center",
                stroke: "#260b05",
                strokeThickness: 2,
            })
            .setOrigin(0.5);

        favoriteHitArea.on("pointerover", () => {
            playButtonHoverSound(this);
            favoriteHitArea.setFillStyle(0x3a1748, 0.95);
            favoriteLabel.setColor("#ffffff");
        });
        favoriteHitArea.on("pointerout", () => {
            favoriteHitArea.setFillStyle(0x180c22, 0.86);
            favoriteLabel.setColor(item.isFavorite ? "#ff5f8f" : "#8a6d8f");
        });
        favoriteHitArea.on("pointerdown", () => {
            playButtonClickSound(this);
            void this.toggleFavorite(item);
        });

        deleteHitArea.on("pointerover", () => {
            playButtonHoverSound(this);
            deleteHitArea.setFillStyle(0x8d1d1d, 0.95);
            deleteLabel.setColor("#ffffff");
        });
        deleteHitArea.on("pointerout", () => {
            deleteHitArea.setFillStyle(0x3d0b0b, 0.86);
            deleteLabel.setColor("#f8e39a");
        });
        deleteHitArea.on("pointerdown", () => {
            playButtonClickSound(this);
            void this.deleteInvocation(item.id);
        });

        card.add([
            frame,
            symbol,
            title,
            typeLabel,
            cost,
            favoriteHitArea,
            favoriteLabel,
            deleteHitArea,
            deleteLabel,
        ]);

        if (invocation?.imageUrl) {
            this.loadCardArtwork(card, symbol, title, item.id, invocation.imageUrl);
        }

        return card;
    }

    private async toggleFavorite(item: GalleryInvocation) {
        const nextFavorite = !item.isFavorite;
        this.setStatus(nextFavorite ? "Favoritando invocacao..." : "Removendo favorito...");

        try {
            const response = await fetch("/api/invocations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: item.id,
                    isFavorite: nextFavorite,
                }),
            });

            if (!response.ok) {
                throw new Error("Nao foi possivel atualizar o favorito.");
            }

            item.isFavorite = nextFavorite;
            setCachedInvocationFavorite(item.id, nextFavorite);
            this.invocations.sort((first, second) => {
                if (first.isFavorite !== second.isFavorite) {
                    return first.isFavorite ? -1 : 1;
                }

                return (
                    new Date(second.createdAt).getTime() -
                    new Date(first.createdAt).getTime()
                );
            });
            this.renderRows();
        } catch (error) {
            this.setStatus(
                error instanceof Error
                    ? error.message
                    : "Erro ao atualizar favorito.",
            );
        }
    }

    private async deleteInvocation(id: string) {
        this.setStatus("Apagando invocacao...");

        try {
            const response = await fetch(`/api/invocations?id=${encodeURIComponent(id)}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Nao foi possivel apagar esta invocacao.");
            }

            this.invocations = this.invocations.filter((item) => item.id !== id);
            removeCachedInvocation(id);
            this.currentPage = Math.max(
                0,
                Math.min(this.currentPage, this.getTotalPages() - 1),
            );
            this.renderRows();
        } catch (error) {
            this.setStatus(
                error instanceof Error
                    ? error.message
                    : "Erro ao apagar invocacao.",
            );
        }
    }

    private createNavButton(label: string, xOffset: number, onClick: () => void) {
        const button = this.createButton(label, onClick);

        this.navButtons.push(button);
        button.image.setData("xOffset", xOffset);
        button.label.setData("xOffset", xOffset);
    }

    private createButton(label: string, onClick: () => void) {
        const image = this.add
            .image(0, 0, "gallery_button")
            .setInteractive({ useHandCursor: true })
            .setDepth(4);
        const buttonLabel = this.add
            .text(0, 0, label, {
                fontFamily: "AriW9500, monospace",
                fontSize: "20px",
                color: "#f4e7a1",
                align: "center",
                stroke: "#241006",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(5);

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
            onClick();
        });

        return { image, label: buttonLabel };
    }

    private layoutScene() {
        const width = this.scale.width;
        const height = this.scale.height;
        const backgroundScale = Math.max(
            width / this.background.width,
            height / this.background.height,
        );
        const logoWidth = Math.min(width * 0.36, 360);
        const panelWidth = Math.min(width * 0.86, 960);
        const panelHeight = Math.min(height * 0.78, panelWidth * (589 / 777));
        const buttonWidth = Math.min(width * 0.23, 230);
        const buttonHeight = buttonWidth / BUTTON_ASPECT;
        const paginationButtonWidth = Math.min(width * 0.16, 150);
        const paginationButtonHeight = paginationButtonWidth / BUTTON_ASPECT;
        const centerX = width / 2;
        const panelCenterY = height * 0.55;

        this.background
            .setPosition(width / 2, height / 2)
            .setScale(backgroundScale);
        this.logo
            .setPosition(centerX, Math.max(92, height * 0.15))
            .setDisplaySize(logoWidth, logoWidth / LOGO_ASPECT);
        this.panel
            .setPosition(centerX, panelCenterY)
            .setDisplaySize(panelWidth, panelHeight);
        this.titleText.setPosition(centerX, panelCenterY - panelHeight * 0.38);

        this.listBounds.setTo(
            centerX - (CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_GAP_X) / 2,
            panelCenterY - panelHeight * 0.28,
            CARD_COLUMNS * CARD_WIDTH + (CARD_COLUMNS - 1) * CARD_GAP_X,
            2 * CARD_HEIGHT + CARD_GAP_Y,
        );
        this.contentContainer.setPosition(this.listBounds.x, this.listBounds.y);
        this.maskGraphics
            .clear()
            .fillStyle(0xffffff)
            .fillRect(
                this.listBounds.x,
                this.listBounds.y,
                this.listBounds.width,
                this.listBounds.height,
            );
        this.statusText.setPosition(centerX, this.listBounds.centerY);
        this.pageText.setPosition(centerX, panelCenterY + panelHeight * 0.24);

        this.layoutButton(
            this.previousPageButton,
            centerX - paginationButtonWidth * 1.2,
            panelCenterY + panelHeight * 0.24,
            paginationButtonWidth,
            paginationButtonHeight,
            13,
        );
        this.layoutButton(
            this.nextPageButton,
            centerX + paginationButtonWidth * 1.2,
            panelCenterY + panelHeight * 0.24,
            paginationButtonWidth,
            paginationButtonHeight,
            13,
        );

        this.navButtons.forEach((button) => {
            const xOffset = Number(button.image.getData("xOffset")) || 0;
            this.layoutButton(
                button,
                centerX + xOffset,
                panelCenterY + panelHeight * 0.36,
                buttonWidth,
                buttonHeight,
                Math.max(16, Math.round(buttonWidth * 0.087)),
            );
        });

        this.layoutCards();
    }

    private layoutCards() {
        this.cardContainers.forEach((card, index) => {
            const column = index % CARD_COLUMNS;
            const row = Math.floor(index / CARD_COLUMNS);

            card.setPosition(
                column * (CARD_WIDTH + CARD_GAP_X),
                row * (CARD_HEIGHT + CARD_GAP_Y),
            );
        });
    }

    private changePage(direction: number) {
        const totalPages = this.getTotalPages();
        const nextPage = Phaser.Math.Clamp(
            this.currentPage + direction,
            0,
            totalPages - 1,
        );

        if (nextPage === this.currentPage) return;

        this.currentPage = nextPage;
        this.renderRows();
    }

    private getTotalPages() {
        return Math.max(1, Math.ceil(this.invocations.length / PAGE_SIZE));
    }

    private updatePaginationText() {
        const totalPages = this.getTotalPages();
        const currentPageLabel =
            this.invocations.length === 0 ? 1 : this.currentPage + 1;

        this.pageText.setText(`PAGINA ${currentPageLabel} / ${totalPages}`);
        this.pageText.setVisible(this.invocations.length > 0);
        this.setButtonEnabled(this.previousPageButton, this.currentPage > 0);
        this.setButtonEnabled(
            this.nextPageButton,
            this.currentPage < totalPages - 1,
        );
    }

    private setButtonEnabled(button: GalleryButton, enabled: boolean) {
        button.image.disableInteractive();
        button.image.setAlpha(enabled ? 1 : 0.42);
        button.label.setAlpha(enabled ? 1 : 0.42);

        if (enabled) {
            button.image.setInteractive({ useHandCursor: true });
        }
    }

    private layoutButton(
        button: GalleryButton,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number,
    ) {
        button.image.setPosition(x, y).setDisplaySize(width, height);
        button.label.setPosition(x, y).setFontSize(fontSize);
    }

    private setStatus(message: string) {
        this.statusText?.setText(message);
        this.statusText?.setVisible(Boolean(message));
    }

    private loadCardArtwork(
        card: Phaser.GameObjects.Container,
        symbol: Phaser.GameObjects.Text,
        title: Phaser.GameObjects.Text,
        id: string,
        imageUrl: string,
    ) {
        const textureKey = `gallery-invocation-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

        const showArtwork = () => {
            if (!card.active || !this.textures.exists(textureKey)) return;

            const animationKey = `${textureKey}-preview`;
            if (!this.anims.exists(animationKey)) {
                this.anims.create({
                    key: animationKey,
                    frames: this.anims.generateFrameNumbers(textureKey, {
                        start: 0,
                        end: 24,
                    }),
                    frameRate: 10,
                    repeat: -1,
                });
            }

            symbol.setVisible(false);
            title.setVisible(false);
            const artwork = this.add
                .sprite(CARD_WIDTH / 2, 53, textureKey, 0)
                .setDisplaySize(CARD_IMAGE_SIZE, CARD_IMAGE_SIZE)
                .setOrigin(0.5)
                .play(animationKey);
            card.addAt(artwork, 1);
        };

        if (this.textures.exists(textureKey)) {
            showArtwork();
            return;
        }

        this.load.spritesheet(textureKey, imageUrl, {
            frameWidth: IMAGE_GENERATE_SIZE / 5,
            frameHeight: IMAGE_GENERATE_SIZE / 5,
        });
        this.load.once(Phaser.Loader.Events.COMPLETE, showArtwork);
        this.hasQueuedArtworkLoad = true;
    }

    private formatInvocationType(type?: string) {
        if (type === "personagem") return "PERSONAGEM";
        if (type === "obstaculo") return "OBSTACULO";
        if (type === "ataque_celeste") return "ATAQUE CELESTE";

        return "INVOCACAO";
    }

    private getInvocationCardSymbol(type: string) {
        if (type === "ATAQUE CELESTE") return "SKY";
        if (type === "OBSTACULO") return "OBS";

        return "INV";
    }

    private shortenText(value: string, maxLength: number) {
        const normalized = value.replace(/\s+/g, " ").trim();

        return normalized.length > maxLength
            ? `${normalized.slice(0, maxLength - 3).trim()}...`
            : normalized;
    }

    private registerGalleryFont() {
        if (typeof document === "undefined") return;

        const fontId = "ari-w9500-gallery-font";
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
