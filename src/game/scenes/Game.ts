import * as Phaser from "phaser";
import { EventBus } from "../EventBus";
import {
    getInitialGameInvocations,
    loadInvocationHistoryCache,
} from "../invocationHistoryCache";
import {
    playBackgroundMusic,
    preloadBackgroundMusic,
} from "../backgroundMusic";
import { getGameSettings } from "../gameSettings";
import {
    playButtonClickSound,
    playButtonHoverSound,
    preloadButtonSounds,
} from "../buttonSounds";

export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
const HERO_START_X = 150;
const HERO_GROUND_Y = 500;
const INVOCATION_CARD_LIMIT = 5;
const INVOCATION_CARD_WIDTH = 94;
const INVOCATION_CARD_HEIGHT = 127;
const INVOCATION_CARD_GAP = 12;
const INVOCATION_CARD_IMAGE_SIZE = 76;
const IMAGE_GENERATE_SIZE = 1024;
const HERO_DEPTH = 18;
const SCENERY_PROGRESS_STEP = 20;

type SceneryConfig = {
    folder: string;
    label: string;
    skyTextureKey: string;
    groundTextureKey: string;
};

const SCENERY_SEQUENCE: SceneryConfig[] = [
    {
        folder: "forest",
        label: "Floresta Sombria",
        skyTextureKey: "scenery_forest_sky",
        groundTextureKey: "scenery_forest_ground",
    },
    {
        folder: "swamp",
        label: "Pantano Maldito",
        skyTextureKey: "scenery_swamp_sky",
        groundTextureKey: "scenery_swamp_ground",
    },
    {
        folder: "ash_mountains",
        label: "Montanhas de Cinzas",
        skyTextureKey: "scenery_ash_mountains_sky",
        groundTextureKey: "scenery_ash_mountains_ground",
    },
    {
        folder: "abyss_bridge",
        label: "Ponte do Abismo",
        skyTextureKey: "scenery_abyss_bridge_sky",
        groundTextureKey: "scenery_abyss_bridge_ground",
    },
    {
        folder: "castle_gates",
        label: "Portoes do Castelo",
        skyTextureKey: "scenery_castle_gates_sky",
        groundTextureKey: "scenery_castle_gates_ground",
    },
];

type DemonKingSpeechEventType =
    | "distance_milestone"
    | "mana_full"
    | "mana_empty"
    | "action";

type InvocationType = "character" | "obstacle" | "sky";
const CHARACTER_INVOCATION_AUDIO_DURATION_SECONDS = 2.4;
type InvocationAudioField =
    | "audio_attack"
    | "audio_invocation"
    | "audio_running"
    | "audio_dead";
const DEFAULT_INVOCATION_AUDIO_BY_FIELD: Record<InvocationAudioField, string> =
    {
        audio_attack: "assets/sounds/attack.mp3",
        audio_invocation: "assets/sounds/invocation.mp3",
        audio_running: "assets/sounds/person_running.mp3",
        audio_dead: "assets/sounds/death.mp3",
    };
const HERO_AUDIO_KEYS = {
    attack: "hero_audio_attack",
    hit: "hero_audio_hit",
    jump: "hero_audio_jump",
    running: "hero_audio_running",
} as const;
type InvocationAudioFields = Partial<
    Record<InvocationAudioField, string | null>
>;

type DemonKingSpeechEvent = {
    eventType: DemonKingSpeechEventType;
    eventDescription?: string;
    invocationType?: InvocationType;
    triggerPercent?: number;
    invocationCardId?: number;
};

type SkyInvocationResponse = {
    invocacao: Pick<InvocationAudioFields, "audio_invocation"> & {
        nome: string;
        tipo: "ataque_celeste";
        dano: number;
        atraso: number;
        areaImpacto: number;
        custoMana: number;
        tempoQueda: number;
        mensagemCombate: string;
        imageStatus: "pending" | "ready" | "failed";
        imageUrl: string | null;
        placeholderSprite: string;
    };
};

type ObstacleInvocationResponse = {
    invocacao: Pick<
        InvocationAudioFields,
        "audio_invocation" | "audio_dead"
    > & {
        nome: string;
        tipo: "obstaculo";
        comportamentoHeroi: "atacar" | "pular";
        tamanho: "pequeno" | "medio" | "grande";
        vida: number;
        atraso: number;
        custoMana: number;
        tempoAproximacao: number;
        mensagemCombate: string;
        mensagemAcaoHeroi: string;
        imageStatus: "pending" | "ready" | "failed";
        imageUrl: string | null;
        placeholderSprite: string;
    };
};

type CharacterInvocationResponse = {
    invocacao: InvocationAudioFields & {
        nome: string;
        tipo: "personagem";
        papel:
            | "guerreiro"
            | "mago"
            | "assassino"
            | "tanque"
            | "invocador"
            | "absurdo_balanceado";
        tamanho: "pequeno" | "medio" | "grande";
        vida: number;
        dano: number;
        atraso: number;
        custoMana: number;
        tempoAproximacao: number;
        mensagemCombate: string;
        mensagemAcaoHeroi: string;
        imageStatus: "pending" | "ready" | "failed";
        imageUrl: string | null;
        placeholderSprite: string;
    };
};

type InvocationCard = {
    id: number;
    container: Phaser.GameObjects.Container;
    frame: Phaser.GameObjects.Image;
    titleText: Phaser.GameObjects.Text;
    statusText: Phaser.GameObjects.Text;
    symbolText: Phaser.GameObjects.Text;
    artwork?: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite;
    artworkTextureKey?: string;
    artworkAnimationKey?: string;
    blinkTween?: Phaser.Tweens.Tween;
    characterInvocation?: CharacterInvocationResponse;
    invocation?: SkyInvocationResponse;
    obstacleInvocation?: ObstacleInvocationResponse;
    invocationType?: InvocationType;
    message?: string;
    isPending: boolean;
};

type PendingInvocationArtworkLoad = {
    card: InvocationCard;
    imageUrl: string;
    artworkType: InvocationType;
    textureKey: string;
};

type InvocationAudioOptions = {
    loop?: boolean;
    volume?: number;
    onPlay?: (sound: Phaser.Sound.BaseSound) => void;
};

type GridAnimationConfig = {
    textureKey: string;
    animationKey: string;
    columns: number;
    rows: number;
    frameRate: number;
    repeat?: number;
    startFrame?: number;
};

type ObstacleMarker = Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
type CharacterMarker = Phaser.GameObjects.Sprite | Phaser.GameObjects.Container;

type ActiveObstacle = {
    marker: ObstacleMarker;
    invocation: ObstacleInvocationResponse;
    currentHealth: number;
    hasCollided: boolean;
    isSummoning: boolean;
};

type ObstacleMarkerResult = {
    marker: ObstacleMarker;
    isSummoning: boolean;
};

type ActiveCharacter = {
    marker: CharacterMarker;
    invocation: CharacterInvocationResponse;
    currentHealth: number;
    maxHealth: number;
    hasCollided: boolean;
    isSummoning: boolean;
    approachSpeed: number;
    artworkTextureKey?: string;
    runningAudio?: Phaser.Sound.BaseSound;
    healthBarContainer: Phaser.GameObjects.Container;
    healthBarFill: Phaser.GameObjects.Rectangle;
    healthBarMaxWidth: number;
};

export class Game extends Phaser.Scene {
    private skyLayer!: Phaser.GameObjects.TileSprite;
    private mountainsLayer!: Phaser.GameObjects.TileSprite;
    private treesBackLayer!: Phaser.GameObjects.TileSprite;
    private groundLayer!: Phaser.GameObjects.TileSprite;

    private hero!: Phaser.GameObjects.Sprite;
    private distanceText!: Phaser.GameObjects.Text;
    private distanceValueText!: Phaser.GameObjects.Text;
    private survivalTimeText!: Phaser.GameObjects.Text;
    private distanceFillLayer!: Phaser.GameObjects.Image;
    private manaFillLayer!: Phaser.GameObjects.Image;
    private heroHealthFillLayer!: Phaser.GameObjects.Image;
    private heroHealthText!: Phaser.GameObjects.Text;
    private heroStrengthText!: Phaser.GameObjects.Text;
    private manaText!: Phaser.GameObjects.Text;
    private manaRegenText!: Phaser.GameObjects.Text;
    private messageText!: Phaser.GameObjects.Text;
    private demonKingChatText!: Phaser.GameObjects.Text;
    private creativeInvocationPanel!: Phaser.GameObjects.DOMElement;
    private creativeInvocationInput?: HTMLTextAreaElement;
    private gameLoadingContainer?: Phaser.GameObjects.Container;
    private heroRunningAudio?: Phaser.Sound.BaseSound;
    private invocationAudioKeys = new Map<string, string>();
    private pendingInvocationAudioLoads = new Set<string>();
    private pendingInvocationArtworkLoads: PendingInvocationArtworkLoad[] = [];
    private isLoadingInvocationArtwork = false;
    private skyScrollX = 0;
    private groundScrollX = 0;
    private currentSceneryIndex = 0;
    private invocationCards: InvocationCard[] = [];
    private nextInvocationCardId = 1;

    private worldSpeed = 150;
    private manaRegenPerSecond = 12;

    private heroHealthRegenPerSecond = 5;
    private heroHealthIncreaseIntervalSeconds = 10;
    private heroHealthIncreasePercent = 5;
    private heroStrengthDistanceStep = 1000;
    private heroStrengthIncreasePercent = 5;
    private nextHeroHealthIncreaseTime = 10;
    private nextHeroStrengthIncreaseDistance = 500;
    private heroHealth = 2458;
    private maxHeroHealth = 5000;
    private heroStrength = 56;
    private isHeroActing = false;
    private isWorldPausedForObstacle = false;
    private activeObstacles: ActiveObstacle[] = [];
    private activeCharacters: ActiveCharacter[] = [];

    private demonKingSpeechStepPercent = 10;
    private nextDemonKingSpeechPercent = 10;
    private isDemonKingSpeechLoading = false;
    private demonKingSpeechQueue: DemonKingSpeechEvent[] = [];
    private wasManaFull = false;
    private wasManaEmpty = false;
    private survivalTime = 0;
    private distanceToCastle = 10000;
    private maxDistanceToCastle = 10000;
    private mana = 120;
    private maxMana = 250;
    private enemiesDefeated = 0;
    private manaSpentTotal = 0;
    private isGameOver = false;

    constructor() {
        super("Game");
    }

    preload() {
        this.createGameLoadingScreen();

        //cenario
        SCENERY_SEQUENCE.forEach((scenery) => {
            this.load.image(
                scenery.skyTextureKey,
                `assets/${scenery.folder}/sky.png`,
            );
            this.load.image(
                scenery.groundTextureKey,
                `assets/${scenery.folder}/ground.png`,
            );
        });
        this.load.image("forest_mountains", "assets/forest/mountains.png");
        this.load.image("forest_trees_back", "assets/forest/trees_back.png");

        //BARRA DE DISTANCIA
        this.load.image(
            "distance_bar_frame",
            "assets/distance_bar/avoid_bar.png",
        );
        this.load.image("distance_bar_fill", "assets/distance_bar/red_bar.png");
        this.load.image(
            "distance_bar_castle",
            "assets/distance_bar/castle.png",
        );

        //BARRA DE MANA
        this.load.image("mana_bar_frame", "assets/mana_bar/avoid_bar.png");
        this.load.image("mana_bar_fill", "assets/mana_bar/full_bar.png");
        this.load.image("mana_bar_icon", "assets/mana_bar/mana.png");

        this.load.image("demon_king_portrait", "assets/demon_king.png");
        this.load.image("demon_king_chat_balloon", "assets/ballon_chat.png");
        this.load.image("game_over_panel", "assets/painel.png");
        this.load.image("game_over_button", "assets/avoid_button.png");
        this.load.image("game_over_logo", "assets/game_logo.png");

        this.load.image("invocation_card_frame", "assets/avoid_card.png");
        this.load.image("creative_invocation_panel", "assets/painel.png");
        this.load.image(
            "creative_invocation_button",
            "assets/invocar_button.png",
        );
        preloadButtonSounds(this);

        this.load.image("hero_portrait", "assets/hero/hero_portrait.png");
        this.load.image("hero_health_bar_frame", "assets/hero/avoid_bar.png");
        this.load.image("hero_health_bar_fill", "assets/hero/full_bar.png");
        this.load.image("hero_heart_icon", "assets/hero/heart.png");
        this.load.image("hero_sword_icon", "assets/hero/sword.png");
        this.load.spritesheet("hero_run", "assets/hero/hero_run.png", {
            frameWidth: IMAGE_GENERATE_SIZE / 5,
            frameHeight: IMAGE_GENERATE_SIZE / 5,
        });

        this.load.spritesheet("hero_jump", "assets/hero/hero-jump-v1.png", {
            frameWidth: IMAGE_GENERATE_SIZE / 5,
            frameHeight: IMAGE_GENERATE_SIZE / 5,
        });
        this.load.spritesheet("hero_attack", "assets/hero/hero_attack.png", {
            frameWidth: IMAGE_GENERATE_SIZE / 5,
            frameHeight: IMAGE_GENERATE_SIZE / 5,
        });
        this.load.audio(HERO_AUDIO_KEYS.attack, ["assets/sounds/attack.mp3"]);
        this.load.audio(HERO_AUDIO_KEYS.hit, ["assets/sounds/death.mp3"]);
        this.load.audio(HERO_AUDIO_KEYS.jump, ["assets/sounds/sky_fall.mp3"]);
        this.load.audio(HERO_AUDIO_KEYS.running, [
            "assets/sounds/person_running.mp3",
        ]);
        preloadBackgroundMusic(this);
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

    create() {
        this.gameLoadingContainer?.destroy(true);
        this.gameLoadingContainer = undefined;

        const settings = getGameSettings();
        this.distanceToCastle = settings.maxDistanceToCastle;
        this.maxDistanceToCastle = settings.maxDistanceToCastle;
        this.survivalTime = 0;
        this.nextDemonKingSpeechPercent = this.demonKingSpeechStepPercent;
        this.nextHeroHealthIncreaseTime =
            this.heroHealthIncreaseIntervalSeconds;
        this.nextHeroStrengthIncreaseDistance = this.heroStrengthDistanceStep;
        this.isDemonKingSpeechLoading = false;
        this.demonKingSpeechQueue = [];
        this.invocationCards = [];
        this.activeObstacles = [];
        this.activeCharacters = [];
        this.nextInvocationCardId = 1;
        this.heroHealth = 2458;
        this.heroStrength = 80;
        this.mana = 120;
        this.enemiesDefeated = 0;
        this.manaSpentTotal = 0;
        this.wasManaFull = this.mana >= this.maxMana;
        this.wasManaEmpty = this.mana <= 0;
        this.isGameOver = false;
        this.isHeroActing = false;
        this.isWorldPausedForObstacle = false;
        this.currentSceneryIndex = 0;

        this.registerHudFont();
        this.configureResponsiveCamera();
        this.createParallaxBackground();
        // this.createCastle();
        this.createHero();
        this.createDistanceHud();
        this.createExitButton();
        this.createCreativeInvocationPanel();
        void this.loadInvocationHistoryCards();
        this.tryPlayBackgroundMusic();

        EventBus.emit("current-scene-ready", this);
    }

    private configureResponsiveCamera() {
        const resizeGame = () => {
            const width = this.scale.width;
            const height = this.scale.height;
            const zoom = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);

            this.cameras.main.setZoom(zoom);
            this.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
            this.resizeParallaxBackground();
            this.layoutInvocationCards();
        };

        resizeGame();
        this.scale.on(Phaser.Scale.Events.RESIZE, resizeGame);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, resizeGame);
            this.stopHeroRunningAudio();
        });
    }

    update(_time: number, delta: number) {
        if (this.isGameOver) return;

        const dt = delta / 1000;

        try {
            this.updateParallax(delta);
            this.updateHeroMovement(dt);
            this.updateHeroRunningAudio();
            this.updateCharacters(dt);
            this.updateObstacles(dt);
            this.updateResources(dt);
            this.updateSurvivalTime(dt);
            this.updateHeroProgression();
            this.checkDemonKingSpeechTriggers();
            this.updateHud();
            this.updateDistanceHud();
            this.checkGameOver();
        } catch (error) {
            console.error("Game update failed:", error);
        }
    }

    private createParallaxBackground() {
        const initialScenery = SCENERY_SEQUENCE[this.currentSceneryIndex];

        this.skyLayer = this.add
            .tileSprite(
                0,
                0,
                GAME_WIDTH,
                GAME_HEIGHT,
                initialScenery.skyTextureKey,
            )
            .setOrigin(0, 0);

        // this.mountainsLayer = this.add
        //     .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "forest_mountains")
        //     .setOrigin(0, 0);

        // this.treesBackLayer = this.add
        //     .tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, "forest_trees_back")
        //     .setOrigin(0, 0);

        this.groundLayer = this.add
            .tileSprite(
                0,
                0,
                GAME_WIDTH,
                GAME_HEIGHT,
                initialScenery.groundTextureKey,
            )
            .setOrigin(0, 0);

        this.resizeParallaxBackground();
    }

    private updateSceneryForDistance() {
        if (!this.skyLayer || !this.groundLayer) return;

        const distanceReducedPercent =
            ((this.maxDistanceToCastle - this.distanceToCastle) /
                this.maxDistanceToCastle) *
            100;
        const nextSceneryIndex = Phaser.Math.Clamp(
            Math.floor(distanceReducedPercent / SCENERY_PROGRESS_STEP),
            0,
            SCENERY_SEQUENCE.length - 1,
        );

        if (nextSceneryIndex === this.currentSceneryIndex) return;

        this.currentSceneryIndex = nextSceneryIndex;
        const scenery = SCENERY_SEQUENCE[this.currentSceneryIndex];

        this.skyLayer.setTexture(scenery.skyTextureKey);
        this.groundLayer.setTexture(scenery.groundTextureKey);
        this.syncParallaxTilesToView(this.skyLayer.x, this.skyLayer.y);

        this.skyLayer.setAlpha(0.35);
        this.groundLayer.setAlpha(0.35);
        this.tweens.add({
            targets: [this.skyLayer, this.groundLayer],
            alpha: 1,
            duration: 420,
            ease: "Sine.easeOut",
        });
    }

    private resizeParallaxBackground() {
        if (!this.skyLayer || !this.groundLayer) return;

        const camera = this.cameras.main;
        const viewWidth = this.scale.width / camera.zoom;
        const viewHeight = this.scale.height / camera.zoom;
        const viewX = GAME_WIDTH / 2 - viewWidth / 2;
        const viewY = GAME_HEIGHT / 2 - viewHeight / 2;

        this.skyLayer.setPosition(viewX, viewY).setSize(viewWidth, viewHeight);
        this.groundLayer
            .setPosition(viewX, viewY)
            .setSize(viewWidth, viewHeight);
        this.syncParallaxTilesToView(viewX, viewY);
    }

    private updateParallax(delta: number) {
        if (this.isWorldPausedForObstacle) return;

        const dt = delta / 1000;

        this.skyScrollX += this.worldSpeed * 0.08 * dt;
        this.groundScrollX += this.worldSpeed * 1.0 * dt;
        this.syncParallaxTilesToView(this.skyLayer.x, this.skyLayer.y);
        // this.mountainsLayer.tilePositionX += this.worldSpeed * 0.18 * dt;
        // this.treesBackLayer.tilePositionX += this.worldSpeed * 0.35 * dt;
    }

    private syncParallaxTilesToView(viewX: number, viewY: number) {
        this.skyLayer.tilePositionX = this.skyScrollX + viewX;
        this.skyLayer.tilePositionY = viewY;
        this.groundLayer.tilePositionX = this.groundScrollX + viewX;
        this.groundLayer.tilePositionY = viewY;
    }

    private getVisibleWorldBounds() {
        const camera = this.cameras.main;
        const viewWidth = this.scale.width / camera.zoom;
        const viewHeight = this.scale.height / camera.zoom;

        return {
            x: GAME_WIDTH / 2 - viewWidth / 2,
            y: GAME_HEIGHT / 2 - viewHeight / 2,
            width: viewWidth,
            height: viewHeight,
        };
    }

    private createPendingInvocationCard(description: string) {
        const id = this.nextInvocationCardId++;
        const container = this.add.container(0, 0).setDepth(45);
        const frame = this.add
            .image(0, 0, "invocation_card_frame")
            .setOrigin(0, 0)
            .setDisplaySize(INVOCATION_CARD_WIDTH, INVOCATION_CARD_HEIGHT);
        const symbolText = this.add
            .text(INVOCATION_CARD_WIDTH / 2, 36, "?", {
                fontFamily: "AriW9500, monospace",
                fontSize: "42px",
                color: "#fff1b8",
                align: "center",
                stroke: "#160915",
                strokeThickness: 6,
            })
            .setOrigin(0.5);
        const titleText = this.add
            .text(
                INVOCATION_CARD_WIDTH / 2,
                69,
                this.shortenCardText(description),
                {
                    fontFamily: "AriW9500, monospace",
                    fontSize: "9px",
                    color: "#ffffff",
                    align: "center",
                    wordWrap: { width: INVOCATION_CARD_WIDTH - 16 },
                },
            )
            .setOrigin(0.5, 0);
        const statusText = this.add
            .text(
                INVOCATION_CARD_WIDTH / 2,
                INVOCATION_CARD_HEIGHT - 14,
                "GERANDO",
                {
                    fontFamily: "AriW9500, monospace",
                    fontSize: "8px",
                    color: "#d99b43",
                    align: "center",
                    stroke: "#09050d",
                    strokeThickness: 3,
                },
            )
            .setOrigin(0.5);

        container.add([frame, symbolText, titleText, statusText]);

        const card: InvocationCard = {
            id,
            container,
            frame,
            titleText,
            statusText,
            symbolText,
            isPending: true,
        };

        frame.setTint(0x6d5f83);
        card.blinkTween = this.tweens.add({
            targets: container,
            alpha: 0.45,
            duration: 420,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        });

        this.invocationCards.unshift(card);
        this.trimInvocationCards();
        this.layoutInvocationCards();

        return id;
    }

    private async loadInvocationHistoryCards() {
        try {
            const cachedInvocations =
                getInitialGameInvocations(INVOCATION_CARD_LIMIT) ??
                (await loadInvocationHistoryCache())
                    .slice(0, INVOCATION_CARD_LIMIT)
                    .map((record) => record.invocation);
            const invocations = cachedInvocations as Array<
                | CharacterInvocationResponse
                | SkyInvocationResponse
                | ObstacleInvocationResponse
            >;

            [...invocations].reverse().forEach((invocation) => {
                if (!invocation?.invocacao) return;

                const invocationType =
                    "tipo" in invocation.invocacao &&
                    invocation.invocacao.tipo === "personagem"
                        ? "character"
                        : invocation.invocacao.tipo === "obstaculo"
                          ? "obstacle"
                          : "sky";
                const cardId = this.createPendingInvocationCard(
                    invocation.invocacao.nome,
                );
                this.completeInvocationCard(
                    cardId,
                    {
                        eventType: "action",
                        eventDescription: invocation.invocacao.nome,
                        invocationType,
                        invocationCardId: cardId,
                    },
                    invocation.invocacao.mensagemCombate,
                    invocationType === "character"
                        ? (invocation as CharacterInvocationResponse)
                        : undefined,
                    invocationType === "sky"
                        ? (invocation as SkyInvocationResponse)
                        : undefined,
                    invocationType === "obstacle"
                        ? (invocation as ObstacleInvocationResponse)
                        : undefined,
                );
            });
        } catch (error) {
            console.error("Failed to load invocation history:", error);
        }
    }

    private completeInvocationCard(
        cardId: number,
        event: DemonKingSpeechEvent,
        message?: string,
        characterInvocation?: CharacterInvocationResponse,
        skyInvocation?: SkyInvocationResponse,
        obstacleInvocation?: ObstacleInvocationResponse,
    ) {
        const card = this.invocationCards.find((item) => item.id === cardId);
        if (!card) return;

        const invocationName =
            characterInvocation?.invocacao.nome ??
            skyInvocation?.invocacao.nome ??
            obstacleInvocation?.invocacao.nome ??
            event.eventDescription ??
            "Invocação";

        card.blinkTween?.stop();
        card.container.setAlpha(1);
        card.frame.clearTint();
        card.titleText.setText(this.shortenCardText(invocationName));
        card.characterInvocation = characterInvocation;
        card.invocation = skyInvocation;
        card.obstacleInvocation = obstacleInvocation;
        card.invocationType = event.invocationType;
        card.message =
            message ??
            characterInvocation?.invocacao.mensagemCombate ??
            skyInvocation?.invocacao.mensagemCombate ??
            obstacleInvocation?.invocacao.mensagemCombate;
        card.statusText.setText(`${this.getCardManaCost(card, skyInvocation)}`);
        card.statusText.setColor("#670b75");
        card.symbolText.setFontSize(19);
        card.symbolText.setText(
            this.getInvocationCardSymbol(event.invocationType),
        );

        if (characterInvocation?.invocacao.imageUrl) {
            card.statusText.setText("...");
            card.isPending = true;
            this.loadInvocationCardArtwork(
                card,
                characterInvocation.invocacao.imageUrl,
                "character",
            );
            return;
        }

        if (skyInvocation?.invocacao.imageUrl) {
            card.statusText.setText("...");
            card.isPending = true;
            this.loadInvocationCardArtwork(
                card,
                skyInvocation.invocacao.imageUrl,
            );
            return;
        }

        if (obstacleInvocation?.invocacao.imageUrl) {
            card.statusText.setText("...");
            card.isPending = true;
            this.loadInvocationCardArtwork(
                card,
                obstacleInvocation.invocacao.imageUrl,
                "obstacle",
            );
            return;
        }

        this.activateInvocationCard(card);
    }

    private failInvocationCard(cardId?: number) {
        if (!cardId) return;

        const card = this.invocationCards.find((item) => item.id === cardId);
        if (!card) return;

        card.blinkTween?.stop();
        card.container.setAlpha(1);
        card.frame.setTint(0x4f2632);
        card.symbolText.setFontSize(42);
        card.symbolText.setText("!");
        card.statusText.setText("FALHOU");
        card.statusText.setColor("#ff8b8b");
        card.isPending = false;
    }

    private activateInvocationCard(card: InvocationCard) {
        card.isPending = false;
        card.statusText.setText(`${this.getCardManaCost(card)}`);
        card.statusText.setFontSize(12);
        card.statusText.setColor("#ffffff");

        card.container
            .setSize(INVOCATION_CARD_WIDTH, INVOCATION_CARD_HEIGHT)
            .setInteractive(
                new Phaser.Geom.Rectangle(
                    0,
                    0,
                    INVOCATION_CARD_WIDTH,
                    INVOCATION_CARD_HEIGHT,
                ),
                Phaser.Geom.Rectangle.Contains,
                true,
            )
            .off("pointerdown")
            .off("pointerover")
            .on("pointerover", () => playButtonHoverSound(this))
            .on("pointerdown", () => {
                playButtonClickSound(this);
                this.invokeCard(card);
            });

        card.frame
            .setInteractive({ useHandCursor: true })
            .off("pointerdown")
            .off("pointerover")
            .on("pointerover", () => playButtonHoverSound(this))
            .on("pointerdown", () => {
                playButtonClickSound(this);
                this.invokeCard(card);
            });
    }

    private loadInvocationCardArtwork(
        card: InvocationCard,
        imageUrl: string,
        artworkType: InvocationType = "sky",
    ) {
        const textureKey = `invocation-card-${card.id}`;
        const normalizedImageUrl = this.normalizeInvocationAssetUrl(imageUrl);

        if (this.textures.exists(textureKey)) {
            this.showInvocationCardArtwork(card, textureKey, artworkType);
            return;
        }

        this.pendingInvocationArtworkLoads.push({
            card,
            imageUrl: normalizedImageUrl,
            artworkType,
            textureKey,
        });
        this.processNextInvocationArtworkLoad();
    }

    private normalizeInvocationAssetUrl(assetUrl: string) {
        if (
            /^https?:\/\//i.test(assetUrl) ||
            assetUrl.startsWith("data:") ||
            assetUrl.startsWith("blob:")
        ) {
            return assetUrl;
        }

        return assetUrl
            .replace(/^\//, "")
            .replace(/^\.\//, "assets/")
            .replace(/^assets\/invocation\//, "assets/invocations/");
    }

    private processNextInvocationArtworkLoad() {
        if (this.isLoadingInvocationArtwork) return;

        const nextLoad = this.pendingInvocationArtworkLoads.shift();
        if (!nextLoad) return;

        const { card, imageUrl, artworkType, textureKey } = nextLoad;

        if (!card.container.active) {
            this.processNextInvocationArtworkLoad();
            return;
        }

        if (this.textures.exists(textureKey)) {
            this.showInvocationCardArtwork(card, textureKey, artworkType);
            this.processNextInvocationArtworkLoad();
            return;
        }

        if (!this.load.isReady()) {
            this.pendingInvocationArtworkLoads.unshift(nextLoad);
            this.time.delayedCall(50, () => {
                this.processNextInvocationArtworkLoad();
            });
            return;
        }

        this.isLoadingInvocationArtwork = true;
        const gridSize = 5;
        this.load.spritesheet(textureKey, imageUrl, {
            frameWidth: IMAGE_GENERATE_SIZE / gridSize,
            frameHeight: IMAGE_GENERATE_SIZE / gridSize,
        });

        const onLoadError = () => {
            this.activateInvocationCard(card);
        };
        const onComplete = () => {
            this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
            this.isLoadingInvocationArtwork = false;

            if (!this.textures.exists(textureKey)) {
                this.activateInvocationCard(card);
                this.processNextInvocationArtworkLoad();
                return;
            }

            this.showInvocationCardArtwork(card, textureKey, artworkType);
            this.processNextInvocationArtworkLoad();
        };

        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, onLoadError);
        this.load.once(Phaser.Loader.Events.COMPLETE, onComplete);
        this.load.start();
    }

    private showInvocationCardArtwork(
        card: InvocationCard,
        textureKey: string,
        artworkType: InvocationType = "sky",
    ) {
        const animationKey =
            artworkType === "obstacle"
                ? `${textureKey}-obstacle-idle`
                : artworkType === "character"
                  ? `${textureKey}-character-idle`
                  : `${textureKey}-fall`;

        card.artworkTextureKey = textureKey;
        card.artworkAnimationKey = animationKey;

        if (artworkType === "obstacle") {
            this.createFrameRangeAnimation({
                textureKey,
                animationKey: `${textureKey}-obstacle-summon`,
                startFrame: 0,
                endFrame: 9,
                frameRate: 12,
                repeat: 0,
            });
            this.createFrameRangeAnimation({
                textureKey,
                animationKey,
                startFrame: 10,
                endFrame: 24,
                frameRate: 10,
                repeat: -1,
            });
        } else if (artworkType === "character") {
            this.createFrameRangeAnimation({
                textureKey,
                animationKey: `${textureKey}-character-summon`,
                startFrame: 0,
                endFrame: 4,
                frameRate: 5 / CHARACTER_INVOCATION_AUDIO_DURATION_SECONDS,
                repeat: 0,
            });
            this.createFrameRangeAnimation({
                textureKey,
                animationKey,
                startFrame: 5,
                endFrame: 9,
                frameRate: 10,
                repeat: -1,
            });
            this.createFrameRangeAnimation({
                textureKey,
                animationKey: `${textureKey}-character-attack`,
                startFrame: 10,
                endFrame: 19,
                frameRate: 14,
                repeat: 0,
            });
            this.createFrameRangeAnimation({
                textureKey,
                animationKey: `${textureKey}-character-death`,
                startFrame: 20,
                endFrame: 24,
                frameRate: 12,
                repeat: 0,
            });
        } else {
            this.createGridAnimation({
                textureKey,
                animationKey,
                columns: 5,
                rows: 5,
                frameRate: 12,
            });
        }

        card.symbolText.setVisible(false);
        card.titleText.setVisible(false);
        card.artwork?.destroy();
        card.artwork = this.add
            .sprite(INVOCATION_CARD_WIDTH / 2, 48, textureKey, 0)
            .setDisplaySize(
                INVOCATION_CARD_IMAGE_SIZE,
                INVOCATION_CARD_IMAGE_SIZE,
            )
            .setOrigin(0.5)
            .play(animationKey);
        card.container.add(card.artwork);
        card.container.bringToTop(card.statusText);
        this.activateInvocationCard(card);
    }

    private invokeCard(card: InvocationCard) {
        if (card.isPending) return;

        if (
            (card.characterInvocation || card.invocationType === "character") &&
            this.hasActiveCharacterInvocation()
        ) {
            this.updateDemonKingChat(
                "Ja existe um personagem invocado em combate.",
            );
            return;
        }

        if (!this.spendMana(this.getCardManaCost(card))) return;

        if (card.characterInvocation) {
            this.updateDemonKingChat(
                card.characterInvocation.invocacao.mensagemCombate,
            );
            this.applyCharacterInvocation(
                card.characterInvocation,
                card.artworkTextureKey,
            );
            return;
        }

        if (card.invocation) {
            this.updateDemonKingChat(card.invocation.invocacao.mensagemCombate);
            this.applySkyInvocation(
                card.invocation,
                card.artworkTextureKey,
                card.artworkAnimationKey,
            );
            return;
        }

        if (card.obstacleInvocation) {
            this.updateDemonKingChat(
                card.obstacleInvocation.invocacao.mensagemCombate,
            );
            this.applyObstacleInvocation(
                card.obstacleInvocation,
                card.artworkTextureKey,
                card.artworkAnimationKey,
            );
            return;
        }

        if (card.invocationType === "obstacle") {
            this.invokeObstacleCard(card);
            return;
        }

        this.invokeCharacterCard(card);
    }

    private getCardManaCost(
        card: InvocationCard,
        skyInvocation = card.invocation,
    ) {
        if (card.characterInvocation) {
            return card.characterInvocation.invocacao.custoMana;
        }
        if (skyInvocation) return skyInvocation.invocacao.custoMana;
        if (card.obstacleInvocation) {
            return card.obstacleInvocation.invocacao.custoMana;
        }
        if (card.invocationType === "obstacle") return 25;

        return 60;
    }

    private invokeObstacleCard(card: InvocationCard) {
        this.updateDemonKingChat(card.message ?? "Obstáculo invocado!");

        this.applyObstacleInvocation({
            invocacao: {
                nome: "Obstáculo",
                tipo: "obstaculo",
                comportamentoHeroi: "atacar",
                tamanho: "medio",
                vida: 250,
                atraso: 1.2,
                custoMana: 25,
                tempoAproximacao: 1.1,
                mensagemCombate: card.message ?? "Obstáculo invocado!",
                mensagemAcaoHeroi:
                    card.message ??
                    "O Herói quebrou o obstáculo, mas perdeu tempo.",
                imageStatus: "failed",
                imageUrl: null,
                placeholderSprite: "obstacle_stone",
            },
        });
    }

    private invokeCharacterCard(card: InvocationCard) {
        if (this.hasActiveCharacterInvocation()) {
            this.updateDemonKingChat(
                "Ja existe um personagem invocado em combate.",
            );
            return;
        }

        this.updateDemonKingChat(card.message ?? "Personagem invocado!");

        this.applyCharacterInvocation({
            invocacao: {
                nome: "Personagem",
                tipo: "personagem",
                papel: "guerreiro",
                tamanho: "medio",
                vida: 260,
                dano: 55,
                atraso: 1.8,
                custoMana: 60,
                tempoAproximacao: 1.1,
                mensagemCombate: card.message ?? "Personagem invocado!",
                mensagemAcaoHeroi:
                    card.message ??
                    "A invocação segurou o Herói por alguns segundos.",
                imageStatus: "failed",
                imageUrl: null,
                placeholderSprite: "character_warrior",
            },
        });
    }

    private applyCharacterInvocation(
        characterInvocation: CharacterInvocationResponse,
        artworkTextureKey?: string,
    ) {
        const invocation = characterInvocation.invocacao;
        const view = this.getVisibleWorldBounds();
        const y = HERO_GROUND_Y - 18;
        const size = this.getCharacterDisplaySize(invocation);
        const x = view.x + view.width - size * 0.55;
        const collisionX = this.hero.x + 116;
        const marker = this.createCharacterMarker(
            x,
            y,
            size,
            characterInvocation,
            artworkTextureKey,
        );
        const maxHealth = this.getCharacterMaxHealth(invocation);
        const healthBar = this.createCharacterHealthBar(marker, size);
        const activeCharacter: ActiveCharacter = {
            marker,
            invocation: characterInvocation,
            currentHealth: maxHealth,
            maxHealth,
            hasCollided: false,
            isSummoning: this.playCharacterAnimation(
                marker,
                artworkTextureKey,
                "summon",
            ),
            approachSpeed: Math.max(
                this.worldSpeed * 0.45,
                (x - collisionX) /
                    Math.max(invocation.tempoAproximacao * 2.4, 1.4),
            ),
            artworkTextureKey,
            healthBarContainer: healthBar.container,
            healthBarFill: healthBar.fill,
            healthBarMaxWidth: healthBar.maxWidth,
        };

        this.updateCharacterHealthBar(activeCharacter);
        this.playInvocationAudio(invocation, "audio_invocation");
        this.activeCharacters.push(activeCharacter);

        if (activeCharacter.isSummoning) {
            marker.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                activeCharacter.isSummoning = false;
                this.playCharacterAnimation(marker, artworkTextureKey, "idle");
                this.playCharacterRunningAudio(activeCharacter);
            });
        } else {
            this.playCharacterAnimation(marker, artworkTextureKey, "idle");
            this.playCharacterRunningAudio(activeCharacter);
        }
    }

    private playCharacterRunningAudio(character: ActiveCharacter) {
        character.runningAudio = this.playInvocationAudio(
            character.invocation.invocacao,
            "audio_running",
            {
                loop: true,
                volume: 0.55,
                onPlay: (sound) => {
                    if (
                        !character.marker.active ||
                        character.hasCollided ||
                        !this.activeCharacters.includes(character)
                    ) {
                        this.stopInvocationAudio(sound);
                        return;
                    }

                    character.runningAudio = sound;
                },
            },
        );
    }

    private createCharacterHealthBar(marker: CharacterMarker, size: number) {
        const barWidth = Phaser.Math.Clamp(size * 0.62, 76, 132);
        const barHeight = 9;
        const container = this.add.container(marker.x, marker.y).setDepth(19);
        const background = this.add
            .rectangle(0, 0, barWidth + 4, barHeight + 4, 0x120711, 0.86)
            .setOrigin(0.5)
            .setStrokeStyle(1, 0xf3b45a, 0.9);
        const fill = this.add
            .rectangle(-barWidth / 2, 0, barWidth, barHeight, 0xd64444, 0.95)
            .setOrigin(0, 0.5);

        container.add([background, fill]);

        return { container, fill, maxWidth: barWidth };
    }

    private updateCharacterHealthBar(character: ActiveCharacter) {
        if (!character.marker.active) {
            character.healthBarContainer.setVisible(false);
            return;
        }

        const markerHeight = character.marker.displayHeight;
        const barY = character.marker.y - markerHeight - 16;
        const progress = Phaser.Math.Clamp(
            character.currentHealth / character.maxHealth,
            0,
            1,
        );
        character.healthBarContainer
            .setPosition(character.marker.x, barY)
            .setVisible(progress > 0);
        character.healthBarFill.width = character.healthBarMaxWidth * progress;
        character.healthBarFill.setFillStyle(
            progress > 0.55 ? 0x42d66a : progress > 0.25 ? 0xe0b13b : 0xd64444,
            0.95,
        );
    }

    private hasActiveCharacterInvocation() {
        return this.activeCharacters.some(
            (character) => character.marker.active,
        );
    }

    private createCharacterMarker(
        x: number,
        y: number,
        size: number,
        characterInvocation: CharacterInvocationResponse,
        artworkTextureKey?: string,
    ): CharacterMarker {
        if (artworkTextureKey && this.textures.exists(artworkTextureKey)) {
            return this.add
                .sprite(x, y, artworkTextureKey, 0)
                .setOrigin(0.5, 1)
                .setDisplaySize(size, size)
                .setDepth(11);
        }

        const warrior = this.add.container(x, y - 8).setDepth(11);
        const colorByPlaceholder: Record<string, number> = {
            character_warrior: 0x653232,
            character_mage: 0x6d2f92,
            character_assassin: 0x2f2938,
            character_tank: 0x4e4238,
            character_summoner: 0x4b236b,
            character_chaos: 0xd02cff,
        };
        const color =
            colorByPlaceholder[
                characterInvocation.invocacao.placeholderSprite
            ] ?? 0x653232;

        warrior.add(this.add.rectangle(0, 0, 38, 58, color));
        warrior.add(this.add.rectangle(0, -43, 28, 28, 0x91a085));
        warrior.add(this.add.rectangle(-28, -4, 38, 10, 0xaaaaaa));

        return warrior;
    }

    private getCharacterDisplaySize(
        invocation: CharacterInvocationResponse["invocacao"],
    ) {
        if (invocation.tamanho === "pequeno") return 98;
        if (invocation.tamanho === "grande") return 190;

        return 160;
    }

    private getCharacterMaxHealth(
        invocation: CharacterInvocationResponse["invocacao"],
    ) {
        return Phaser.Math.Clamp(invocation.vida, 100, 1200);
    }

    private playCharacterAnimation(
        marker: CharacterMarker,
        artworkTextureKey: string | undefined,
        animation: "summon" | "idle" | "attack" | "death",
    ) {
        if (
            !artworkTextureKey ||
            !(marker instanceof Phaser.GameObjects.Sprite)
        ) {
            return false;
        }

        const animationKey = `${artworkTextureKey}-character-${animation}`;

        if (!this.anims.exists(animationKey)) return false;

        marker.play({
            key: animationKey,
            startFrame: 0,
        });

        return true;
    }

    private updateCharacters(dt: number) {
        if (this.activeCharacters.length === 0) return;

        const view = this.getVisibleWorldBounds();
        const collisionX = this.hero.x + 116;

        this.activeCharacters = this.activeCharacters.filter((character) => {
            if (!character.marker.active) {
                this.stopInvocationAudio(character.runningAudio);
                character.healthBarContainer.destroy(true);
                return false;
            }
            this.updateCharacterHealthBar(character);

            if (character.hasCollided) return true;

            if (!character.isSummoning) {
                character.marker.x -= character.approachSpeed * dt;
                this.updateCharacterHealthBar(character);
            }

            if (character.marker.x <= collisionX) {
                character.hasCollided = true;
                character.marker.x = collisionX;
                this.updateCharacterHealthBar(character);

                try {
                    this.stopInvocationAudio(character.runningAudio);
                    character.runningAudio = undefined;
                    this.resolveCharacterCollision(character);
                } catch (error) {
                    console.error("Character collision failed:", error);
                    this.stopInvocationAudio(character.runningAudio);
                    character.marker.destroy();
                    character.healthBarContainer.destroy(true);
                    this.returnHeroToRun();
                    this.isWorldPausedForObstacle = false;
                    return false;
                }

                return true;
            }

            if (character.marker.x < view.x - 160) {
                this.stopInvocationAudio(character.runningAudio);
                character.marker.destroy();
                character.healthBarContainer.destroy(true);
                return false;
            }

            return true;
        });
    }

    private resolveCharacterCollision(character: ActiveCharacter) {
        if (this.isHeroActing) {
            this.time.delayedCall(160, () => {
                this.resolveCharacterCollision(character);
            });
            return;
        }

        this.hero.y = HERO_GROUND_Y;
        this.isWorldPausedForObstacle = true;
        this.fightCharacterUntilDestroyed(character);
    }

    private fightCharacterUntilDestroyed(character: ActiveCharacter) {
        const { marker, invocation: characterInvocation } = character;
        const invocation = characterInvocation.invocacao;

        if (!marker.active) {
            this.stopInvocationAudio(character.runningAudio);
            character.healthBarContainer.destroy(true);
            this.isWorldPausedForObstacle = false;
            return;
        }

        this.playCharacterAnimation(
            marker,
            character.artworkTextureKey,
            "attack",
        );
        this.playInvocationAudio(invocation, "audio_attack");
        this.heroHealth = Math.max(0, this.heroHealth - invocation.dano);
        this.playHeroSound(HERO_AUDIO_KEYS.hit, 0.36);
        this.cameras.main.shake(90, 0.003);

        if (this.heroHealth <= 0) {
            this.resetHeroToStart(
                `${invocation.nome} derrubou o heroi em combate.`,
            );
            return;
        }

        this.updateHud();

        this.time.delayedCall(360, () => {
            this.playHeroAttack(() => {
                character.currentHealth = Math.max(
                    0,
                    character.currentHealth - this.heroStrength,
                );

                if (character.currentHealth > 0) {
                    this.updateCharacterHealthBar(character);
                    this.playCharacterAnimation(
                        marker,
                        character.artworkTextureKey,
                        "idle",
                    );
                    this.time.delayedCall(220, () => {
                        this.fightCharacterUntilDestroyed(character);
                    });
                    return;
                }

                this.delayHero(
                    invocation.atraso * 18,
                    invocation.mensagemAcaoHeroi,
                );
                this.cameras.main.shake(120, 0.004);
                this.enemiesDefeated += 1;
                character.healthBarContainer.destroy(true);
                this.playInvocationAudio(invocation, "audio_dead");
                this.destroyCharacterWithDeathAnimation(character);
                this.activeCharacters = this.activeCharacters.filter(
                    (activeCharacter) => activeCharacter !== character,
                );
                this.isWorldPausedForObstacle = false;
            });
        });
    }

    private destroyCharacterWithDeathAnimation(character: ActiveCharacter) {
        const playedDeath = this.playCharacterAnimation(
            character.marker,
            character.artworkTextureKey,
            "death",
        );

        if (
            playedDeath &&
            character.marker instanceof Phaser.GameObjects.Sprite
        ) {
            character.marker.once(
                Phaser.Animations.Events.ANIMATION_COMPLETE,
                () => {
                    character.marker.destroy();
                },
            );
            return;
        }

        character.marker.destroy();
    }

    private trimInvocationCards() {
        while (this.invocationCards.length > INVOCATION_CARD_LIMIT) {
            const card = this.invocationCards.pop();
            card?.blinkTween?.stop();
            card?.container.destroy(true);
        }
    }

    private layoutInvocationCards() {
        if (this.invocationCards.length === 0 || !this.cameras.main) return;

        const view = this.getVisibleWorldBounds();
        const startX = view.x + 18;
        const y = view.y + view.height - INVOCATION_CARD_HEIGHT - 18;

        this.invocationCards.forEach((card, index) => {
            card.container.setPosition(
                startX + index * (INVOCATION_CARD_WIDTH + INVOCATION_CARD_GAP),
                y,
            );
        });
    }

    private shortenCardText(text: string) {
        const normalized = text.trim();

        return normalized.length > 34
            ? `${normalized.slice(0, 31).trim()}...`
            : normalized || "Invocação";
    }

    private getInvocationCardSymbol(invocationType?: InvocationType) {
        if (invocationType === "sky") return "SKY";
        if (invocationType === "obstacle") return "OBS";

        return "INV";
    }

    private registerHudFont() {
        if (typeof document === "undefined") return;

        const fontId = "ari-w9500-hud-font";
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

    private tryPlayBackgroundMusic() {
        try {
            playBackgroundMusic(this);
        } catch (error) {
            console.warn("Background music could not start:", error);
        }
    }

    private normalizeInvocationAudioUrl(audioUrl?: string | null) {
        if (!audioUrl) return null;

        return this.normalizeInvocationAssetUrl(audioUrl);
    }

    private getInvocationAudioKey(audioUrl: string) {
        const existingKey = this.invocationAudioKeys.get(audioUrl);
        if (existingKey) return existingKey;

        const key = `invocation-audio-${this.invocationAudioKeys.size + 1}`;
        this.invocationAudioKeys.set(audioUrl, key);
        return key;
    }

    private playInvocationAudio(
        invocation: InvocationAudioFields,
        field: InvocationAudioField,
        options: InvocationAudioOptions = {},
    ): Phaser.Sound.BaseSound | undefined {
        const audioUrl = this.normalizeInvocationAudioUrl(
            invocation[field] ?? DEFAULT_INVOCATION_AUDIO_BY_FIELD[field],
        );
        if (!audioUrl) return undefined;

        const key = this.getInvocationAudioKey(audioUrl);
        const playAudio = () => {
            try {
                const start = () => {
                    const sound = this.sound.add(key, {
                        loop: options.loop ?? false,
                        volume: options.volume ?? 0.95,
                    });
                    sound.play();
                    options.onPlay?.(sound);
                    return sound;
                };

                if (this.sound.locked) {
                    this.input.once("pointerdown", start);
                    return undefined;
                }

                return start();
            } catch (error) {
                console.warn("Invocation audio play failed:", error);
                return undefined;
            }
        };

        if (this.cache.audio.exists(key)) {
            return playAudio();
        }

        if (this.pendingInvocationAudioLoads.has(key)) return undefined;

        this.pendingInvocationAudioLoads.add(key);
        this.load.audio(key, [audioUrl]);
        this.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, () => {
            this.pendingInvocationAudioLoads.delete(key);
        });
        this.load.once(Phaser.Loader.Events.COMPLETE, () => {
            this.pendingInvocationAudioLoads.delete(key);

            if (this.cache.audio.exists(key)) {
                playAudio();
            }
        });
        this.load.start();
        return undefined;
    }

    private stopInvocationAudio(sound?: Phaser.Sound.BaseSound) {
        if (!sound) return;

        try {
            sound.stop();
            sound.destroy();
        } catch (error) {
            console.warn("Invocation audio stop failed:", error);
        }
    }

    private createHero() {
        this.createGridAnimation({
            textureKey: "hero_run",
            animationKey: "hero_run",
            columns: 5,
            rows: 5,
            frameRate: 12,
        });
        this.createGridAnimation({
            textureKey: "hero_jump",
            animationKey: "hero_jump",
            columns: 5,
            rows: 5,
            frameRate: 16,
            repeat: 0,
        });
        this.createGridAnimation({
            textureKey: "hero_attack",
            animationKey: "hero_attack",
            columns: 5,
            rows: 5,
            frameRate: 18,
            repeat: 0,
        });

        this.hero = this.add
            .sprite(HERO_START_X, HERO_GROUND_Y, "hero_run")
            .setOrigin(0.5, 1)
            .setDepth(HERO_DEPTH)
            .setScale(0.9)
            .play("hero_run");
    }

    private createGridAnimation({
        textureKey,
        animationKey,
        columns,
        rows,
        frameRate,
        repeat = -1,
        startFrame = 0,
    }: GridAnimationConfig) {
        const totalFrames = columns * rows;

        if (totalFrames <= 0) {
            throw new Error(
                `Invalid grid animation "${animationKey}": columns * rows must be greater than 0.`,
            );
        }

        if (this.anims.exists(animationKey)) return;

        this.anims.create({
            key: animationKey,
            frames: this.anims.generateFrameNumbers(textureKey, {
                start: startFrame,
                end: startFrame + totalFrames - 1,
            }),
            frameRate,
            repeat,
        });
    }

    private createFrameRangeAnimation({
        textureKey,
        animationKey,
        startFrame,
        endFrame,
        frameRate,
        repeat = -1,
    }: {
        textureKey: string;
        animationKey: string;
        startFrame: number;
        endFrame: number;
        frameRate: number;
        repeat?: number;
    }) {
        if (this.anims.exists(animationKey)) return;

        this.anims.create({
            key: animationKey,
            frames: this.anims.generateFrameNumbers(textureKey, {
                start: startFrame,
                end: endFrame,
            }),
            frameRate,
            repeat,
        });
    }

    private createDistanceHud() {
        const fontFamily = "AriW9500, monospace";
        const hudScale = 0.9;
        const barY = 52;
        const demonHudRight = this.createDemonKingHud(fontFamily);
        const barWidth = 1040 * hudScale;
        const barScale = barWidth / 4024;
        const barDisplayWidth = 2024 * barScale;
        const barX = demonHudRight + 28;
        const fillX = barX + 60 * barScale;
        const fillY = barY + 3 * barScale;
        const fillMaxWidth = barDisplayWidth * 0.9;
        const fillScale = fillMaxWidth / 1902;
        const castleX = barX + barDisplayWidth * 0.98;
        const castleScale = barScale * 0.7;
        const distanceCenterX = barX + barDisplayWidth / 2;

        this.add
            .text(distanceCenterX, 15, "DISTÃ‚NCIA ATÃ‰ O CASTELO", {
                fontFamily,
                fontSize: `${16 * hudScale}px`,
                color: "#f0d58a",
                align: "center",
            })
            .setOrigin(0.5);

        this.add
            .image(barX, barY, "distance_bar_frame")
            .setOrigin(0, 0.5)
            .setScale(barScale);

        this.distanceFillLayer = this.add
            .image(fillX, fillY, "distance_bar_fill")
            .setOrigin(0, 0.5)
            .setScale(fillScale);

        this.add
            .image(castleX, barY - 3 * barScale, "distance_bar_castle")
            .setOrigin(0.5)
            .setScale(castleScale);

        this.distanceValueText = this.add
            .text(distanceCenterX, 53, "", {
                fontFamily,
                fontSize: `${28 * hudScale}px`,
                color: "#ffffff",
                align: "center",
                stroke: "#101018",
                strokeThickness: 5 * hudScale,
            })
            .setOrigin(0.5);

        this.add
            .text(distanceCenterX, 90, "TEMPO DE SOBREVIVÃŠNCIA", {
                fontFamily,
                fontSize: `${15 * hudScale}px`,
                color: "#d99b43",
                align: "center",
            })
            .setOrigin(0.5);

        this.survivalTimeText = this.add
            .text(distanceCenterX, 122, "", {
                fontFamily,
                fontSize: `${42 * hudScale}px`,
                color: "#ffd071",
                align: "center",
                stroke: "#09050d",
                strokeThickness: 7 * hudScale,
            })
            .setOrigin(0.5);

        this.createManaHud(
            fontFamily,
            barX + barDisplayWidth + 46,
            barY,
            hudScale,
        );

        this.messageText = this.add
            .text(
                36,
                188,
                "Ele estÃ¡ chegando... invoque obstÃ¡culos para atrasÃ¡-lo.",
                {
                    fontFamily,
                    fontSize: "18px",
                    color: "#ffffff",
                },
            )
            .setVisible(false);

        this.distanceText = this.add
            .text(-1000, -1000, "", {
                fontFamily,
                fontSize: "1px",
                color: "#ffffff",
            })
            .setVisible(false);

        this.updateHud();
        this.updateDistanceHud();
    }

    private createExitButton() {
        const buttonX = 82;
        const buttonY = 161;
        const button = this.add
            .image(buttonX, buttonY, "game_over_button")
            .setDisplaySize(118, 28)
            .setInteractive({ useHandCursor: true })
            .setDepth(60);
        const label = this.add
            .text(buttonX, buttonY, "ARREGAR", {
                fontFamily: "AriW9500, monospace",
                fontSize: "13px",
                color: "#f4dc83",
                align: "center",
                stroke: "#301304",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(61);

        button.on("pointerover", () => {
            playButtonHoverSound(this);
            button.setTint(0xc68cff);
            label.setColor("#ffffff");
        });
        button.on("pointerout", () => {
            button.clearTint();
            label.setColor("#f4dc83");
        });
        button.on("pointerdown", () => {
            playButtonClickSound(this);
            this.stopHeroRunningAudio();
            this.creativeInvocationPanel?.destroy();
            this.scene.start("InitialScene");
        });
    }

    private createDemonKingHud(fontFamily: string) {
        const portraitX = 6;
        const portraitY = 16;
        const portraitScale = 0.72;
        const portraitWidth = 211 * portraitScale;
        const balloonX = portraitX + portraitWidth + 12;
        const balloonY = 37;
        const balloonScale = 0.19;
        const balloonWidth = 1224 * balloonScale;

        this.add
            .image(portraitX, portraitY, "demon_king_portrait")
            .setOrigin(0, 0)
            .setScale(portraitScale);

        this.add.text(balloonX + 24, 20, "REI DEMÃ”NIO", {
            fontFamily,
            fontSize: "18px",
            color: "#d99b43",
            align: "left",
            stroke: "#09050d",
            strokeThickness: 3,
        });

        this.add
            .image(balloonX, balloonY, "demon_king_chat_balloon")
            .setOrigin(0, 0)
            .setScale(balloonScale);

        this.demonKingChatText = this.add.text(
            balloonX + 30,
            balloonY + 21,
            "Ele estÃ¡ chegando...\nPreciso criar algo\npara detÃª-lo!",
            {
                fontFamily,
                fontSize: "12px",
                color: "#ffffff",
                lineSpacing: 4,
                wordWrap: { width: 166 },
            },
        );

        this.createHeroStatusHud(fontFamily, portraitX, portraitY + 151);

        return balloonX + balloonWidth;
    }

    private createHeroStatusHud(fontFamily: string, x: number, y: number) {
        const panel = this.add.container(x, y).setDepth(20);
        const panelWidth = 350;
        const panelHeight = 118;
        const portraitSize = 86;
        const barX = 104;
        const barY = 54;
        const barWidth = 222;
        const barScale = barWidth / 2426;

        panel.add(
            this.add
                .image(10, 19, "hero_portrait")
                .setOrigin(0, 0)
                .setDisplaySize(portraitSize, portraitSize),
        );

        panel.add(
            this.add.text(barX, 10, "HERÓI", {
                fontFamily,
                fontSize: "22px",
                color: "#f0d58a",
                stroke: "#09050d",
                strokeThickness: 4,
            }),
        );

        panel.add(
            this.add
                .image(barX, barY, "hero_health_bar_frame")
                .setOrigin(0, 0.5)
                .setScale(barScale),
        );

        this.heroHealthFillLayer = this.add
            .image(barX, barY, "hero_health_bar_fill")
            .setOrigin(0, 0.5)
            .setScale(barScale);
        panel.add(this.heroHealthFillLayer);

        panel.add(
            this.add
                .image(barX + 90, 25, "hero_heart_icon")
                .setOrigin(0.5)
                .setDisplaySize(20, 20),
        );

        this.heroHealthText = this.add
            .text(barX + barWidth / 2 + 7, barY, "", {
                fontFamily,
                fontSize: "17px",
                color: "#ffffff",
                align: "center",
                stroke: "#09050d",
                strokeThickness: 4,
            })
            .setOrigin(0.5);
        panel.add(this.heroHealthText);

        panel.add(
            this.add
                .image(barX + 5, 91, "hero_sword_icon")
                .setOrigin(0.5)
                .setDisplaySize(31, 31),
        );

        this.heroStrengthText = this.add.text(barX + 31, 80, "", {
            fontFamily,
            fontSize: "18px",
            color: "#d7d2c6",
            stroke: "#09050d",
            strokeThickness: 4,
        });
        panel.add(this.heroStrengthText);

        this.updateHeroStatusHud();
    }

    private createManaHud(
        fontFamily: string,
        x: number,
        y: number,
        hudScale: number,
    ) {
        const barWidth = 430 * hudScale;
        const barScale = barWidth / 3281;
        const barDisplayWidth = 2281 * barScale;
        const iconScale = 0.1 * hudScale;
        const centerX = x + barDisplayWidth / 2;

        this.add
            .text(centerX, y - 31 * hudScale, "MANÃ DEMONÃACA", {
                fontFamily,
                fontSize: `${14 * hudScale}px`,
                color: "#ffffff",
                align: "center",
                stroke: "#09050d",
                strokeThickness: 3 * hudScale,
            })
            .setOrigin(0.5);

        this.add
            .image(x, y, "mana_bar_frame")
            .setOrigin(0, 0.5)
            .setScale(barScale);

        this.manaFillLayer = this.add
            .image(x, y + hudScale, "mana_bar_fill")
            .setOrigin(0, 0.5)
            .setScale(barScale);

        this.add
            .image(x, y - 3 * hudScale, "mana_bar_icon")
            .setOrigin(0.5)
            .setScale(iconScale);

        this.manaText = this.add
            .text(centerX, y, "", {
                fontFamily,
                fontSize: `${19 * hudScale}px`,
                color: "#ffffff",
                align: "center",
                stroke: "#101018",
                strokeThickness: 4 * hudScale,
            })
            .setOrigin(0.5);

        this.manaRegenText = this.add
            .text(centerX, y + 36 * hudScale, "", {
                fontFamily,
                fontSize: `${16 * hudScale}px`,
                color: "#ffffff",
                align: "center",
                stroke: "#101018",
                strokeThickness: 3 * hudScale,
            })
            .setOrigin(0.5);
    }

    private createCreativeInvocationPanel() {
        const panelWidth = 600;
        const panelHeight = 166;
        const panelX = GAME_WIDTH - panelWidth / 2 - 150;
        const panelY = GAME_HEIGHT - panelHeight / 2 - 22;

        this.creativeInvocationPanel = this.add
            .dom(panelX, panelY)
            .createFromHTML(
                `
                <form class="creative-invocation-panel">
                    <style>
                        .creative-invocation-panel {
                            box-sizing: border-box;
                            width: ${panelWidth}px;
                            height: ${panelHeight}px;
                            padding: 38px 34px 24px;
                            position: relative;
                            border: 0;
                            
                            background-repeat: no-repeat;
                            background-size: 100% 100%;
                            background-color: transparent;
                            color: #f2e4c2;
                            font-family: AriW9500, monospace;
                            pointer-events: auto;
                        }

                        .creative-invocation-panel h2 {
                            margin: 0 0 12px 70px;
                            color: #d99b43;
                            font-size: 31px;
                            line-height: 1;
                            text-align: left;
                            letter-spacing: 0;
                            text-transform: uppercase;
                            text-shadow:
                                0 5px 0 #21120b,
                                0 0 18px rgba(217, 155, 67, 0.25);
                        }
                     

                        .creative-invocation-panel label {
                            display: block;
                            margin-bottom: 8px;
                            color: #e8e0d1;
                            font-size: 14px;
                            text-shadow: 0 3px 0 #09050d;
                        }

                        .creative-invocation-panel textarea {
                            box-sizing: border-box;
                            width: 100%;
                            height: 48px;
                            resize: none;
                            overflow: hidden;
                            padding: 13px 14px;
                            border: 3px solid #5d432e;
                            outline: 2px solid #14100d;
                            background: rgba(21, 24, 23, 0.96);
                            color: #f4eadc;
                            font-family: AriW9500, monospace;
                            font-size: 14px;
                            line-height: 1;
                            white-space: nowrap;
                        }

                        .creative-invocation-panel textarea::placeholder {
                            color: #8d8981;
                        }

                        .creative-invocation-panel .controls-row {
                            display: grid;
                            grid-template-columns: 1fr 190px;
                            align-items: center;
                            gap: 12px;
                            margin-top: 14px;
                        }

                        .creative-invocation-panel .invocation-types {
                            display: grid;
                            grid-template-columns: repeat(3, 1fr);
                            gap: 7px;
                            margin: 0;
                        }

                        .creative-invocation-panel .invocation-type {
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            gap: 7px;
                            min-width: 0;
                            height: 45px;
                            padding: 0 8px;
                         
                            color: #d7d2c6;
                            font-size: 11px;
                            line-height: 1;
                            cursor: pointer;
                            text-shadow: 0 3px 0 #09050d;
                        }

                        .creative-invocation-panel .invocation-type input {
                            appearance: none;
                            width: 16px;
                            height: 16px;
                            margin: 0;
                            border: 2px solid #8d6a43;
                            background: #151817;
                            flex: 0 0 auto;
                        }

                        .creative-invocation-panel .invocation-type input:checked {
                            background: #b743f6;
                            box-shadow:
                                inset 0 0 0 4px #151817,
                                0 0 9px #8b2fd6;
                        }

                        .creative-invocation-panel button {
                            display: block;
                            width: 190px;
                            height: 48px;
                            margin: 0;
                            border: 0;
                            outline: 0;
                            background-image: url("/assets/invocar_button.png");
                            background-repeat: no-repeat;
                            background-size: 100% 100%;
                            background-color: transparent;
                            color: #f7e5e8;
                            font-family: AriW9500, monospace;
                            font-size: 22px;
                            line-height: 1;
                            cursor: pointer;
                            text-shadow: 0 5px 0 #1c1024;
                        }

                        .creative-invocation-panel button:hover {
                            filter: brightness(1.12);
                        }

                        .creative-invocation-panel .cost {
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            gap: 14px;
                            position: absolute;
                            left: 0;
                            right: 0;
                            bottom: 15px;
                            color: #aaa49a;
                            font-size: 12px;
                            text-shadow: 0 3px 0 #09050d;
                        }

                        .creative-invocation-panel .mana-drop {
                            display: block;
                            width: 22px;
                            height: 22px;
                            border: 0;
                            outline: 0;
                            background-image: url("/assets/mana_bar/mana.png");
                            background-repeat: no-repeat;
                            background-size: 100% 100%;
                            background-color: transparent;
                            color: #f7e5e8;
                            font-family: AriW9500, monospace;
                            font-size: 24px;
                            line-height: 1;
                            cursor: pointer;
                            text-shadow: 0 3px 0 #1c1024;
                        }
                    </style>
                    <h2>INVOCAÇÃO CRIATIVA</h2>              
                    <textarea
                        id="creative-invocation-input"
                        maxlength="140"
                        placeholder="Descreva o que deseja invocar: Ex.: Uma chuva de sapos explosivos"
                    ></textarea>
                    <div class="controls-row">
                        <div class="invocation-types">
                            <label class="invocation-type">
                                <input type="radio" name="invocation-type" value="character" checked />
                                Personagem
                            </label>
                            <label class="invocation-type">
                                <input type="radio" name="invocation-type" value="obstacle" />
                                Obstáculo
                            </label>
                            <label class="invocation-type">
                                <input type="radio" name="invocation-type" value="sky" />
                                Ataque Celeste
                            </label>
                        </div>
                        <button type="submit"> </button>
                    </div>
                    
                </form>
            `,
            )
            .setOrigin(0.5)
            .setDepth(40);

        const form = this.creativeInvocationPanel.node as HTMLFormElement;
        this.creativeInvocationInput =
            form.querySelector("textarea") ?? undefined;
        const submitButton = form.querySelector("button");
        const invocationTypeLabels = Array.from(
            form.querySelectorAll(".invocation-type"),
        );

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            playButtonClickSound(this);
            this.handleCreativeInvocation();
        });
        submitButton?.addEventListener("mouseenter", () => {
            playButtonHoverSound(this);
        });
        invocationTypeLabels.forEach((label) => {
            label.addEventListener("mouseenter", () => {
                playButtonHoverSound(this);
            });
            label.addEventListener("click", () => {
                playButtonClickSound(this);
            });
        });

        this.creativeInvocationInput?.addEventListener("focus", () => {
            if (this.input.keyboard) {
                this.input.keyboard.enabled = false;
            }
        });

        this.creativeInvocationInput?.addEventListener("blur", () => {
            if (this.input.keyboard) {
                this.input.keyboard.enabled = true;
            }
        });
    }

    private updateHeroMovement(dt: number) {
        if (this.isWorldPausedForObstacle) return;

        const baseSpeed = 18;
        this.distanceToCastle = Math.max(
            0,
            this.distanceToCastle - baseSpeed * dt,
        );
        this.updateSceneryForDistance();

        if (this.isHeroActing) return;

        // Pequena animação de corrida em pixel art fake.
        const bob = Math.sin(this.time.now * 0.012) * 3;
        this.hero.y = HERO_GROUND_Y + bob;
    }

    private updateResources(dt: number) {
        this.mana = Math.min(
            this.maxMana,
            this.mana + this.manaRegenPerSecond * dt,
        );
        this.heroHealth = Math.min(
            this.maxHeroHealth,
            this.heroHealth + this.heroHealthRegenPerSecond * dt,
        );
    }

    private updateSurvivalTime(dt: number) {
        this.survivalTime += dt;
    }

    private updateHeroProgression() {
        while (this.survivalTime >= this.nextHeroHealthIncreaseTime) {
            const healthGain =
                this.maxHeroHealth * (this.heroHealthIncreasePercent / 100);

            this.heroHealth = Math.min(
                this.maxHeroHealth,
                Math.ceil(this.heroHealth + healthGain),
            );
            this.nextHeroHealthIncreaseTime +=
                this.heroHealthIncreaseIntervalSeconds;
        }

        const distanceReduced =
            this.maxDistanceToCastle - this.distanceToCastle;

        while (distanceReduced >= this.nextHeroStrengthIncreaseDistance) {
            this.heroStrength = Math.ceil(
                this.heroStrength *
                    (1 + this.heroStrengthIncreasePercent / 100),
            );
            this.nextHeroStrengthIncreaseDistance +=
                this.heroStrengthDistanceStep;
        }
    }

    private updateHud() {
        this.distanceText.setText(
            `DISTÂNCIA ATÉ O CASTELO: ${Math.ceil(this.distanceToCastle)}m`,
        );

        const manaProgress = Phaser.Math.Clamp(this.mana / this.maxMana, 0, 1);
        this.manaFillLayer.setCrop(0, 0, 2281 * manaProgress, 358);
        this.manaText.setText(`${Math.floor(this.mana)} / ${this.maxMana}`);
        this.manaRegenText.setText(`+${this.manaRegenPerSecond}/s`);
        this.updateHeroStatusHud();
    }

    private updateHeroStatusHud() {
        const healthProgress = Phaser.Math.Clamp(
            this.heroHealth / this.maxHeroHealth,
            0,
            1,
        );

        this.heroHealthFillLayer.setCrop(0, 0, 2426 * healthProgress, 353);
        this.heroHealthText.setText(
            `${Math.floor(this.heroHealth)} / ${this.maxHeroHealth}`,
        );
        this.heroStrengthText.setText(`FORÇA: ${this.heroStrength}`);
    }

    private updateDistanceHud() {
        const currentDistance = Math.ceil(this.distanceToCastle);
        const progress = Phaser.Math.Clamp(
            currentDistance / this.maxDistanceToCastle,
            0,
            1,
        );

        this.distanceFillLayer.setCrop(0, 0, 1902 * progress, 117);
        this.distanceValueText.setText(
            `${currentDistance} / ${this.maxDistanceToCastle} m`,
        );
        this.survivalTimeText.setText(this.formatSurvivalTime());
    }

    private checkDemonKingSpeechTriggers() {
        const progressPercent =
            ((this.maxDistanceToCastle - this.distanceToCastle) /
                this.maxDistanceToCastle) *
            100;

        while (
            this.nextDemonKingSpeechPercent <= 100 &&
            progressPercent >= this.nextDemonKingSpeechPercent
        ) {
            const triggerPercent = this.nextDemonKingSpeechPercent;
            this.queueDemonKingSpeech({
                eventType: "distance_milestone",
                eventDescription: `A distancia ate o castelo reduziu ${triggerPercent}% desde o inicio.`,
                triggerPercent,
            });
            this.nextDemonKingSpeechPercent += this.demonKingSpeechStepPercent;
        }

        const manaIsFull = this.mana >= this.maxMana;
        const manaIsEmpty = this.mana <= 0;

        if (manaIsFull && !this.wasManaFull) {
            this.queueDemonKingSpeech({
                eventType: "mana_full",
                eventDescription: "A mana do Rei Demonio esta cheia.",
            });
        }

        if (manaIsEmpty && !this.wasManaEmpty) {
            this.queueDemonKingSpeech({
                eventType: "mana_empty",
                eventDescription: "A mana do Rei Demonio zerou.",
            });
        }

        this.wasManaFull = manaIsFull;
        this.wasManaEmpty = manaIsEmpty;
    }

    private queueDemonKingSpeech(event: DemonKingSpeechEvent) {
        this.demonKingSpeechQueue.push(event);
        void this.processDemonKingSpeechQueue();
    }

    private async processDemonKingSpeechQueue() {
        if (this.isDemonKingSpeechLoading) return;

        const event = this.demonKingSpeechQueue.shift();
        if (!event) return;

        await this.requestDemonKingSpeech(event);

        if (this.demonKingSpeechQueue.length > 0) {
            void this.processDemonKingSpeechQueue();
        }
    }

    private async requestDemonKingSpeech(event: DemonKingSpeechEvent) {
        this.isDemonKingSpeechLoading = true;

        try {
            const response = await fetch("/api/demon-king/speech", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    eventType: event.eventType,
                    eventDescription: event.eventDescription,
                    invocationType: event.invocationType,
                    imageGenerationProvider:
                        getGameSettings().imageGenerationProvider,
                    generateAudio: getGameSettings().generateAudio,
                    distanceToCastle: this.distanceToCastle,
                    maxDistanceToCastle: this.maxDistanceToCastle,
                    survivalTimeSeconds: this.survivalTime,
                    mana: this.mana,
                    maxMana: this.maxMana,
                    triggerPercent: event.triggerPercent,
                }),
            });

            if (!response.ok) {
                this.failInvocationCard(event.invocationCardId);
                return;
            }

            const data = (await response.json()) as {
                message?: string;
                characterInvocation?: CharacterInvocationResponse;
                skyInvocation?: SkyInvocationResponse;
                obstacleInvocation?: ObstacleInvocationResponse;
            };
            if (data.characterInvocation) {
                if (event.invocationCardId) {
                    this.completeInvocationCard(
                        event.invocationCardId,
                        event,
                        data.message,
                        data.characterInvocation,
                    );
                } else {
                    this.applyCharacterInvocation(data.characterInvocation);
                }
            } else if (data.skyInvocation) {
                if (event.invocationCardId) {
                    this.completeInvocationCard(
                        event.invocationCardId,
                        event,
                        data.message,
                        undefined,
                        data.skyInvocation,
                    );
                } else {
                    this.applySkyInvocation(data.skyInvocation);
                }
            } else if (data.obstacleInvocation) {
                if (event.invocationCardId) {
                    this.completeInvocationCard(
                        event.invocationCardId,
                        event,
                        data.message,
                        undefined,
                        undefined,
                        data.obstacleInvocation,
                    );
                } else {
                    this.applyObstacleInvocation(data.obstacleInvocation);
                }
            } else if (event.invocationCardId) {
                this.completeInvocationCard(
                    event.invocationCardId,
                    event,
                    data.message,
                );
            }
            if (data.message) {
                this.updateDemonKingChat(data.message);
                //Mudar para elevem labs
                if (window.responsiveVoice) {
                    window.responsiveVoice.speak(
                        data.message,
                        "Brazilian Portuguese Male",
                    );
                }
            }
        } catch (error) {
            console.error("Failed to request demon king speech:", error);
            this.failInvocationCard(event.invocationCardId);
        } finally {
            this.isDemonKingSpeechLoading = false;
        }
    }

    private formatSurvivalTime() {
        const totalSeconds = Math.floor(this.survivalTime);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        return `${minutes.toString().padStart(2, "0")}:${seconds
            .toString()
            .padStart(2, "0")}`;
    }

    public updateDemonKingChat(message: string) {
        this.demonKingChatText.setText(message);
    }

    public generateDemonKingSpeechForAction(eventDescription: string) {
        const invocationCardId =
            this.createPendingInvocationCard(eventDescription);

        this.queueDemonKingSpeech({
            eventType: "action",
            eventDescription,
            invocationType: "sky",
            invocationCardId,
        });
    }

    private applySkyInvocation(
        skyInvocation: SkyInvocationResponse,
        artworkTextureKey?: string,
        artworkAnimationKey?: string,
    ) {
        const invocation = skyInvocation.invocacao;
        const fallDurationMs = invocation.tempoQueda * 1000;
        const impactX = this.hero.x + 25;
        const startX = impactX + 360;
        const startY = -40;
        const impactY = this.hero.y - 72;
        const size =
            Phaser.Math.Clamp(invocation.areaImpacto * 0.45, 36, 96) * 1.7;
        const marker = this.createSkyInvocationMarker(
            startX,
            startY,
            size,
            invocation.placeholderSprite,
            artworkTextureKey,
            artworkAnimationKey,
        );
        this.playInvocationAudio(invocation, "audio_invocation");

        this.tweens.add({
            targets: marker,
            x: impactX,
            angle: marker.angle - 35,
            y: impactY,
            duration: fallDurationMs,
            ease: "Quad.easeIn",
            onComplete: () => {
                this.heroHealth = Math.max(
                    0,
                    this.heroHealth - invocation.dano,
                );
                this.playHeroSound(HERO_AUDIO_KEYS.hit, 0.36);
                if (this.heroHealth <= 0) {
                    this.resetHeroToStart(invocation.mensagemCombate);
                } else {
                    this.delayHero(
                        invocation.atraso * 18,
                        invocation.mensagemCombate,
                    );
                }
                this.cameras.main.shake(160, 0.005);
                marker.destroy();
            },
        });
    }

    private createSkyInvocationMarker(
        x: number,
        y: number,
        size: number,
        placeholderSprite: string,
        artworkTextureKey?: string,
        artworkAnimationKey?: string,
    ) {
        if (artworkTextureKey && this.textures.exists(artworkTextureKey)) {
            const marker = this.add
                .sprite(x, y, artworkTextureKey, 0)
                .setDisplaySize(size, size)
                .setAngle(12)
                .setDepth(12);

            if (artworkAnimationKey && this.anims.exists(artworkAnimationKey)) {
                marker.play(artworkAnimationKey);
            }

            return marker;
        }

        const colorByPlaceholder: Record<string, number> = {
            falling_light: 0xd8d2b0,
            falling_medium: 0xa0938a,
            falling_heavy: 0x5f5660,
            falling_creature: 0x7f2f45,
            falling_magic: 0x9b45d8,
            falling_meteor: 0xff7a2f,
            falling_chaos: 0xd02cff,
        };

        return this.add
            .rectangle(
                x,
                y,
                size,
                size,
                colorByPlaceholder[placeholderSprite] ?? 0x9b45d8,
            )
            .setAngle(45)
            .setDepth(12);
    }

    private applyObstacleInvocation(
        obstacleInvocation: ObstacleInvocationResponse,
        artworkTextureKey?: string,
        artworkAnimationKey?: string,
    ) {
        const invocation = obstacleInvocation.invocacao;
        const view = this.getVisibleWorldBounds();
        const size = this.getObstacleDisplaySize(invocation);
        const startX = view.x + view.width - size * 0.55;
        const markerResult = this.createObstacleMarker(
            startX,
            HERO_GROUND_Y + 8,
            size,
            invocation.placeholderSprite,
            artworkTextureKey,
            artworkAnimationKey,
        );
        const { marker, isSummoning } = markerResult;
        this.playInvocationAudio(invocation, "audio_invocation");

        const activeObstacle: ActiveObstacle = {
            marker,
            invocation: obstacleInvocation,
            currentHealth: this.getObstacleMaxHealth(invocation),
            hasCollided: false,
            isSummoning,
        };

        if (isSummoning && marker instanceof Phaser.GameObjects.Sprite) {
            marker.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                activeObstacle.isSummoning = false;
            });
        }

        this.activeObstacles.push(activeObstacle);
    }

    private getObstacleHeroAction(
        invocation: ObstacleInvocationResponse["invocacao"],
    ) {
        return invocation.tamanho === "pequeno" ? "pular" : "atacar";
    }

    private getObstacleMaxHealth(
        invocation: ObstacleInvocationResponse["invocacao"],
    ) {
        const legacyInvocation = invocation as typeof invocation & {
            dano?: number;
        };

        return Phaser.Math.Clamp(
            invocation.vida ?? legacyInvocation.dano ?? 250,
            100,
            1000,
        );
    }

    private getObstacleDisplaySize(
        invocation: ObstacleInvocationResponse["invocacao"],
    ) {
        if (invocation.tamanho === "pequeno") return 72;
        if (invocation.tamanho === "grande") {
            return Math.max(this.hero.displayHeight * 1.12, 250);
        }

        return 116;
    }

    private updateObstacles(dt: number) {
        if (this.activeObstacles.length === 0) return;

        const view = this.getVisibleWorldBounds();
        const collisionX = this.hero.x + 112;

        this.activeObstacles = this.activeObstacles.filter((obstacle) => {
            if (!obstacle.marker.active) return false;

            if (obstacle.hasCollided) {
                if (!this.isWorldPausedForObstacle) {
                    obstacle.marker.x -= this.worldSpeed * dt;
                }

                if (obstacle.marker.x < view.x - 160) {
                    obstacle.marker.destroy();
                    return false;
                }

                return true;
            }

            if (!this.isWorldPausedForObstacle && !obstacle.isSummoning) {
                obstacle.marker.x -= this.worldSpeed * dt;
            }

            if (obstacle.marker.x <= collisionX) {
                obstacle.hasCollided = true;
                obstacle.marker.x = collisionX;

                try {
                    this.resolveObstacleCollision(obstacle);
                } catch (error) {
                    console.error("Obstacle collision failed:", error);
                    obstacle.marker.destroy();
                    this.returnHeroToRun();
                    this.isWorldPausedForObstacle = false;
                    return false;
                }

                return true;
            }

            if (obstacle.marker.x < view.x - 160) {
                obstacle.marker.destroy();
                return false;
            }

            return true;
        });
    }

    private createObstacleMarker(
        x: number,
        y: number,
        size: number,
        placeholderSprite: string,
        artworkTextureKey?: string,
        artworkAnimationKey?: string,
    ): ObstacleMarkerResult {
        if (artworkTextureKey && this.textures.exists(artworkTextureKey)) {
            const marker = this.add
                .sprite(x, y, artworkTextureKey, 0)
                .setOrigin(0.5, 1)
                .setDisplaySize(size, size)
                .setDepth(11);

            const summonAnimationKey = `${artworkTextureKey}-obstacle-summon`;
            if (this.anims.exists(summonAnimationKey)) {
                marker.stop();
                marker.setFrame(0);
                marker.play({
                    key: summonAnimationKey,
                    startFrame: 0,
                });

                if (
                    artworkAnimationKey &&
                    this.anims.exists(artworkAnimationKey)
                ) {
                    marker.once(
                        Phaser.Animations.Events.ANIMATION_COMPLETE,
                        (completedAnimation: Phaser.Animations.Animation) => {
                            if (completedAnimation.key !== summonAnimationKey) {
                                return;
                            }

                            marker.stop();
                            marker.play({
                                key: artworkAnimationKey,
                                startFrame: 0,
                            });
                        },
                    );
                }

                return { marker, isSummoning: true };
            } else if (
                artworkAnimationKey &&
                this.anims.exists(artworkAnimationKey)
            ) {
                marker.play(artworkAnimationKey);
            }

            return { marker, isSummoning: false };
        }

        const colorByPlaceholder: Record<string, number> = {
            obstacle_stone: 0x5b4b4b,
            obstacle_spikes: 0x7e768a,
            obstacle_magic: 0x8d35d1,
            obstacle_creature: 0x6d2638,
            obstacle_chaos: 0xd02cff,
        };

        const marker = this.add
            .rectangle(
                x,
                y - size / 2,
                size,
                size * 0.72,
                colorByPlaceholder[placeholderSprite] ?? 0x5b4b4b,
            )
            .setDepth(11);

        return { marker, isSummoning: false };
    }

    private resolveObstacleCollision(obstacle: ActiveObstacle) {
        const { marker, invocation: obstacleInvocation } = obstacle;
        const invocation = obstacleInvocation.invocacao;

        if (this.isHeroActing) {
            this.time.delayedCall(160, () => {
                this.resolveObstacleCollision(obstacle);
            });
            return;
        }

        this.hero.y = HERO_GROUND_Y;

        if (this.getObstacleHeroAction(invocation) === "pular") {
            this.playHeroJump(() => {
                this.delayHero(
                    invocation.atraso * 12,
                    invocation.mensagemAcaoHeroi,
                );
            });
            return;
        }

        this.isWorldPausedForObstacle = true;
        this.attackObstacleUntilDestroyed(obstacle);
    }

    private attackObstacleUntilDestroyed(obstacle: ActiveObstacle) {
        const { marker, invocation: obstacleInvocation } = obstacle;
        const invocation = obstacleInvocation.invocacao;

        if (!marker.active) {
            this.isWorldPausedForObstacle = false;
            return;
        }

        this.playHeroAttack(() => {
            obstacle.currentHealth = Math.max(
                0,
                obstacle.currentHealth - this.heroStrength,
            );
            this.cameras.main.shake(90, 0.003);

            if (obstacle.currentHealth > 0) {
                this.updateDemonKingChat(
                    `${invocation.nome}: ${Math.ceil(
                        obstacle.currentHealth,
                    )} de vida restante.`,
                );
                this.time.delayedCall(160, () => {
                    this.attackObstacleUntilDestroyed(obstacle);
                });
                return;
            }

            this.delayHero(
                invocation.atraso * 18,
                invocation.mensagemAcaoHeroi,
            );
            this.cameras.main.shake(120, 0.004);
            this.enemiesDefeated += 1;
            this.playInvocationAudio(invocation, "audio_dead");
            marker.destroy();
            this.activeObstacles = this.activeObstacles.filter(
                (activeObstacle) => activeObstacle !== obstacle,
            );
            this.isWorldPausedForObstacle = false;
        });
    }

    private playHeroJump(onComplete: () => void) {
        let completed = false;
        const complete = () => {
            if (completed) return;
            completed = true;
            onComplete();
        };

        this.isHeroActing = true;
        this.hero.y = HERO_GROUND_Y;
        this.stopHeroRunningAudio();
        this.playHeroSound(HERO_AUDIO_KEYS.jump, 0.18);

        if (this.anims.exists("hero_jump")) {
            this.hero.play("hero_jump", true);
        }

        this.tweens.add({
            targets: this.hero,
            y: HERO_GROUND_Y - 138,
            duration: 320,
            ease: "Quad.easeOut",
            yoyo: true,
            onComplete: () => {
                this.returnHeroToRun();
                complete();
            },
        });
    }

    private playHeroAttack(onComplete: () => void) {
        let completed = false;
        const complete = () => {
            if (completed) return;
            completed = true;
            this.returnHeroToRun();
            onComplete();
        };

        this.isHeroActing = true;
        this.hero.y = HERO_GROUND_Y;
        this.stopHeroRunningAudio();
        this.playHeroSound(HERO_AUDIO_KEYS.attack, 0.55);

        if (this.anims.exists("hero_attack")) {
            this.hero.play("hero_attack", true);
        }

        this.time.delayedCall(620, () => {
            complete();
        });
    }

    private returnHeroToRun() {
        this.isHeroActing = false;
        this.hero.y = HERO_GROUND_Y;
        this.hero.play("hero_run", true);
        this.updateHeroRunningAudio();
    }

    private updateHeroRunningAudio() {
        if (
            this.isGameOver ||
            this.isHeroActing ||
            this.isWorldPausedForObstacle
        ) {
            this.stopHeroRunningAudio();
            return;
        }

        if (this.heroRunningAudio?.isPlaying) return;

        this.heroRunningAudio = this.playHeroSound(
            HERO_AUDIO_KEYS.running,
            0.18,
            {
                loop: true,
            },
        );
    }

    private playHeroSound(
        key: string,
        volume: number,
        config: Phaser.Types.Sound.SoundConfig = {},
    ) {
        try {
            if (this.sound.locked || !this.cache.audio.exists(key)) {
                return undefined;
            }

            const sound = this.sound.add(key, {
                ...config,
                volume,
            });
            sound.play();

            return sound;
        } catch (error) {
            console.warn("Hero sound failed:", error);
            return undefined;
        }
    }

    private stopHeroRunningAudio() {
        if (!this.heroRunningAudio) return;

        try {
            this.heroRunningAudio.stop();
            this.heroRunningAudio.destroy();
        } catch (error) {
            console.warn("Hero running sound stop failed:", error);
        } finally {
            this.heroRunningAudio = undefined;
        }
    }

    private resetHeroToStart(message?: string) {
        this.playHeroSound(HERO_AUDIO_KEYS.hit, 0.45);
        this.activeObstacles.forEach((obstacle) => obstacle.marker.destroy());
        this.activeCharacters.forEach((character) => {
            this.stopInvocationAudio(character.runningAudio);
            character.marker.destroy();
            character.healthBarContainer.destroy(true);
        });
        this.activeObstacles = [];
        this.activeCharacters = [];
        this.isWorldPausedForObstacle = false;
        this.isHeroActing = false;
        this.distanceToCastle = this.maxDistanceToCastle;
        this.heroHealth = this.maxHeroHealth;
        this.heroStrength = 80;
        this.nextHeroStrengthIncreaseDistance = this.heroStrengthDistanceStep;
        this.currentSceneryIndex = -1;
        this.updateSceneryForDistance();
        this.returnHeroToRun();
        this.updateDemonKingChat(
            message
                ? `${message} O heroi foi jogado de volta ao inicio.`
                : "O heroi foi jogado de volta ao inicio.",
        );
        this.updateHud();
        this.updateDistanceHud();
    }

    private handleCreativeInvocation() {
        const invocationDescription =
            this.creativeInvocationInput?.value.trim() ?? "";

        if (!invocationDescription) {
            this.updateDemonKingChat(
                "Descreva a invocação antes de gastar mana.",
            );
            return;
        }

        if (this.creativeInvocationInput) {
            this.creativeInvocationInput.value = "";
            this.creativeInvocationInput.blur();
        }

        const invocationCardId = this.createPendingInvocationCard(
            invocationDescription,
        );
        const invocationType = this.getSelectedInvocationType();

        if (
            invocationType === "character" &&
            this.hasActiveCharacterInvocation()
        ) {
            this.updateDemonKingChat(
                "Ja existe um personagem invocado em combate.",
            );
            this.failInvocationCard(invocationCardId);
            return;
        }

        this.updateDemonKingChat(`Invocando: ${invocationDescription}...`);
        this.queueDemonKingSpeech({
            eventType: "action",
            eventDescription: invocationDescription,
            invocationType,
            invocationCardId,
        });
    }

    private getSelectedInvocationType(): InvocationType {
        const form = this.creativeInvocationPanel.node as HTMLFormElement;
        const selectedInput = form.querySelector<HTMLInputElement>(
            'input[name="invocation-type"]:checked',
        );
        const selectedValue = selectedInput?.value;

        if (
            selectedValue === "character" ||
            selectedValue === "obstacle" ||
            selectedValue === "sky"
        ) {
            return selectedValue;
        }

        return "character";
    }

    private checkGameOver() {
        if (this.distanceToCastle > 0) return;

        this.isGameOver = true;
        this.showGameOverScreen();
    }

    private showGameOverScreen() {
        this.stopHeroRunningAudio();
        this.creativeInvocationPanel?.setVisible(false);
        this.hero?.setVisible(false);
        this.invocationCards.forEach((card) =>
            card.container.setVisible(false),
        );
        this.activeCharacters.forEach((character) =>
            character.marker.setVisible(false),
        );
        this.activeObstacles.forEach((obstacle) =>
            obstacle.marker.setVisible(false),
        );
        const overlayDepth = 1000;
        const fontFamily = "AriW9500, monospace";

        const visibleBounds = this.getVisibleWorldBounds();

        this.add
            .rectangle(
                visibleBounds.x,
                visibleBounds.y,
                visibleBounds.width,
                visibleBounds.height,
                0x000000,
                0.74,
            )
            .setOrigin(0)
            .setDepth(overlayDepth);

        this.add
            .image(GAME_WIDTH / 2, 102, "game_over_logo")
            .setDisplaySize(360, 179)
            .setDepth(overlayDepth + 1);

        const panel = this.add
            .image(GAME_WIDTH / 2, 365, "game_over_panel")
            .setDisplaySize(720, 438)
            .setDepth(overlayDepth + 1);

        this.add
            .text(panel.x, 235, "DERROTA", {
                fontFamily,
                fontSize: "68px",
                color: "#dca243",
                align: "center",
                stroke: "#2a1205",
                strokeThickness: 8,
            })
            .setOrigin(0.5)
            .setDepth(overlayDepth + 2);

        this.add
            .text(panel.x, 300, "O HEROI CHEGOU AO CASTELO", {
                fontFamily,
                fontSize: "30px",
                color: "#b772ff",
                align: "center",
                stroke: "#2a123f",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(overlayDepth + 2);

        this.add
            .text(panel.x, 356, "RESUMO DA PARTIDA", {
                fontFamily,
                fontSize: "24px",
                color: "#e49c2e",
                align: "center",
                stroke: "#160b05",
                strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(overlayDepth + 2);

        const summaryRows: [string, string, string?][] = [
            ["Tempo de sobrevivencia", this.formatSurvivalTime()],
            [
                "Distancia final",
                `${this.maxDistanceToCastle} / ${this.maxDistanceToCastle} m`,
            ],
            ["Inimigos derrotados", String(this.enemiesDefeated)],
            [
                "Invocacoes criativas",
                String(Math.max(0, this.nextInvocationCardId - 1)),
            ],
            ["Mana total usada", String(Math.floor(this.manaSpentTotal))],
        ];

        const leftX = panel.x - 235;
        const rightX = panel.x + 235;
        const startY = 396;
        const rowGap = 30;

        summaryRows.forEach(([label, value, valueColor], index) => {
            const y = startY + index * rowGap;

            this.add
                .text(leftX, y, label, {
                    fontFamily,
                    fontSize: "20px",
                    color: "#efe6d2",
                    align: "left",
                })
                .setOrigin(0, 0.5)
                .setDepth(overlayDepth + 2);

            this.add
                .text(panel.x + 10, y, ".".repeat(34), {
                    fontFamily,
                    fontSize: "18px",
                    color: "#6a5c52",
                    align: "center",
                })
                .setOrigin(0.5)
                .setDepth(overlayDepth + 2);

            this.add
                .text(rightX, y, value, {
                    fontFamily,
                    fontSize: "20px",
                    color: valueColor ?? "#f5ad2d",
                    align: "right",
                })
                .setOrigin(1, 0.5)
                .setDepth(overlayDepth + 2);
        });

        this.createGameOverButton(
            GAME_WIDTH / 2 - 200,
            660,
            "TENTAR NOVAMENTE",
            () => this.scene.restart(),
            overlayDepth + 2,
        );
        this.createGameOverButton(
            GAME_WIDTH / 2 + 200,
            660,
            "MENU PRINCIPAL",
            () => this.scene.start("InitialScene"),
            overlayDepth + 2,
        );
    }

    private createGameOverButton(
        x: number,
        y: number,
        label: string,
        onClick: () => void,
        depth: number,
    ) {
        const button = this.add
            .image(x, y, "game_over_button")
            .setDisplaySize(272, 62)
            .setInteractive({ useHandCursor: true })
            .setDepth(depth);

        const text = this.add
            .text(x, y, label, {
                fontFamily: "AriW9500, monospace",
                fontSize: "16px",
                color: "#f4dc83",
                align: "center",
                stroke: "#301304",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(depth + 1);

        button.on("pointerover", () => {
            playButtonHoverSound(this);
            button.setTint(0xc68cff);
            text.setColor("#ffffff");
        });
        button.on("pointerout", () => {
            button.clearTint();
            text.setColor("#f4dc83");
        });
        button.on("pointerdown", () => {
            playButtonClickSound(this);
            this.time.delayedCall(90, onClick);
        });
    }

    private spendMana(amount: number) {
        if (this.mana < amount) {
            this.updateDemonKingChat(
                "Mana insuficiente! O Rei DemÃ´nio precisa recuperar energia.",
            );
            return false;
        }

        this.mana -= amount;
        this.manaSpentTotal += amount;
        this.updateHud();
        return true;
    }

    private summonFallingAnvil() {
        if (!this.spendMana(40)) return;

        this.updateDemonKingChat("Uma bigorna demonÃ­aca caiu do cÃ©u!");

        const anvil = this.add.rectangle(250, 120, 54, 34, 0x808080);
        this.tweens.add({
            targets: anvil,
            y: 535,
            duration: 450,
            ease: "Quad.easeIn",
            onComplete: () => {
                this.delayHero(
                    35,
                    "Impacto direto! O HerÃ³i perdeu alguns metros.",
                );
                this.cameras.main.shake(130, 0.006);
                anvil.destroy();
            },
        });
    }

    private summonRockObstacle() {
        if (!this.spendMana(25)) return;

        this.updateDemonKingChat("Uma pedra bloqueou o caminho do HerÃ³i!");

        const rock = this.add.rectangle(300, 550, 64, 58, 0x5b4b4b);

        this.time.delayedCall(700, () => {
            this.delayHero(22, "O HerÃ³i quebrou a pedra, mas perdeu tempo.");
            rock.destroy();
        });
    }

    private summonWarrior() {
        if (!this.spendMana(60)) return;

        this.updateDemonKingChat("Um guerreiro sombrio foi invocado!");

        const warrior = this.add.container(330, 540);
        warrior.add(this.add.rectangle(0, 0, 38, 58, 0x653232));
        warrior.add(this.add.rectangle(0, -43, 28, 28, 0x91a085));
        warrior.add(this.add.rectangle(-28, -4, 38, 10, 0xaaaaaa));

        this.time.delayedCall(950, () => {
            this.delayHero(
                45,
                "O guerreiro segurou o HerÃ³i por alguns segundos.",
            );
            warrior.destroy();
        });
    }

    private delayHero(distanceGain: number, message: string) {
        this.distanceToCastle = Math.min(
            this.maxDistanceToCastle,
            this.distanceToCastle + distanceGain,
        );
        this.updateDemonKingChat(message);
        this.updateHud();
    }
}
