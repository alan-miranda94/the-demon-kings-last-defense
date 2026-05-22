import fs from "node:fs/promises";
import path from "node:path";
import {
    InferenceClient,
    type InferenceProviderOrPolicy,
} from "@huggingface/inference";
import { ChatGoogle } from "@langchain/google";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import sharp from "sharp";
import { buildModelSheetTemplatePrompt } from "../prompts/v1/modelSheet";

export type ImageGenerationResult =
    | {
          success: true;
          imageUrl: string;
      }
    | {
          success: false;
          error: string;
      };

type ImageContentBlock = {
    [key: string]: unknown;
    type?: unknown;
    data?: unknown;
    result?: unknown;
    b64_json?: unknown;
    image?: unknown;
    mimeType?: unknown;
    text?: unknown;
};

type ImageGenerationProvider = "openai" | "google" | "huggingface";
export type RuntimeImageGenerationProvider = "openai" | "google";
type OpenAiImageQuality = "low" | "medium" | "high" | "auto";
type OpenAiImageSize = "1024x1024" | "1024x1536" | "1536x1024" | "auto";
type GoogleImageSize = "1K" | "2K" | "4K";
type GoogleImageAspectRatio =
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9";
type ImageGenerationInput = string | HumanMessage[];

export class ImageGenerationService {
    private modelSheetBasePath = path.join(
        process.cwd(),
        "public",
        "assets",
        "model_sheet_base.png",
    );
    private modelSheetBaseDataUrl?: string;
    private provider: ImageGenerationProvider;
    private googleApiKey = process.env.GOOGLE_API_KEY?.trim();
    private googleModel =
        process.env.GOOGLE_IMAGE_MODEL?.trim() ?? "gemini-2.5-flash-image";
    private googleImageSize = this.readGoogleImageSize();
    private googleImageAspectRatio = this.readGoogleImageAspectRatio();
    private openAiApiKey = process.env.OPENAI_API_KEY?.trim();
    private openAiModel = process.env.OPENAI_IMAGE_MODEL?.trim() ?? "gpt-5.4";
    private openAiImageQuality = this.readOpenAiImageQuality();
    private openAiImageSize = this.readOpenAiImageSize();
    private huggingFaceToken =
        process.env.HF_TOKEN?.trim() ??
        process.env.HUGGINGFACE_API_KEY?.trim();
    private huggingFaceModel =
        process.env.HF_IMAGE_MODEL?.trim() ??
        "black-forest-labs/FLUX.2-klein-4B";
    private huggingFaceProvider = this.readHuggingFaceProvider();
    private googleLlm?: ChatGoogle;
    private openAiLlm?: ReturnType<ChatOpenAI["bindTools"]>;
    private huggingFaceClient?: InferenceClient;

    constructor(provider?: RuntimeImageGenerationProvider) {
        this.provider = provider ?? this.readProvider();
    }

    async generateImage(prompt: string): Promise<ImageGenerationResult> {
        if (this.provider === "google") {
            return this.generateWithGoogle(prompt);
        }

        if (this.provider === "huggingface") {
            return this.generateWithHuggingFace(prompt);
        }

        return this.generateWithOpenAi(prompt);
    }

    private async generateWithOpenAi(
        prompt: string,
    ): Promise<ImageGenerationResult> {
        if (!this.openAiApiKey) {
            return {
                success: false,
                error: "OPENAI_API_KEY is required to generate invocation images with OpenAI.",
            };
        }

        try {
            const response = await this.getOpenAiLlm().invoke(
                await this.buildGenerationInput(prompt),
            );
            const result = await this.readProcessedImageFromResponse(response);

            if (result) {
                return {
                    success: true,
                    imageUrl: result,
                };
            }

            return {
                success: false,
                error:
                    this.readTextFromResponse(response) ??
                    "OpenAI image generation response did not include an image.",
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async generateWithGoogle(
        prompt: string,
    ): Promise<ImageGenerationResult> {
        if (!this.googleApiKey) {
            return {
                success: false,
                error: "GOOGLE_API_KEY is required to generate invocation images with Gemini.",
            };
        }

        try {
            const response = await this.getGoogleLlm().invoke(
                await this.buildGenerationInput(prompt),
            );
            const result = await this.readProcessedImageFromResponse(response);

            if (result) {
                return {
                    success: true,
                    imageUrl: result,
                };
            }

            return {
                success: false,
                error:
                    this.readTextFromResponse(response) ??
                    "Google image generation response did not include an image.",
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async generateWithHuggingFace(
        prompt: string,
    ): Promise<ImageGenerationResult> {
        if (!this.huggingFaceToken) {
            return {
                success: false,
                error: "HF_TOKEN is required to generate invocation images with Hugging Face.",
            };
        }

        try {
            const inputImage = await this.readModelSheetBaseBlob();

            if (!inputImage) {
                return {
                    success: false,
                    error: "Model sheet base image is required for Hugging Face image-to-image generation.",
                };
            }

            const image = await this.getHuggingFaceClient().imageToImage({
                provider: this.huggingFaceProvider,
                model: this.huggingFaceModel,
                inputs: inputImage,
                parameters: {
                    prompt: buildModelSheetTemplatePrompt(prompt),
                },
            });
            const imageUrl = await this.blobToDataUrl(image);
            const result = await this.removeModelSheetBaseColors(imageUrl);

            return {
                success: true,
                imageUrl: result,
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private getGoogleLlm() {
        this.googleLlm ??= new ChatGoogle({
            apiKey: this.googleApiKey,
            model: this.googleModel,
            responseModalities: ["IMAGE", "TEXT"],
            imageConfig: {
                aspectRatio: this.googleImageAspectRatio,
                imageSize: this.googleImageSize,
            },
        });

        return this.googleLlm;
    }

    private getOpenAiLlm() {
        this.openAiLlm ??= new ChatOpenAI({
            apiKey: this.openAiApiKey,
            model: this.openAiModel,
            useResponsesApi: true,
        }).bindTools([
            {
                type: "image_generation",
                quality: this.openAiImageQuality,
                size: this.openAiImageSize,
            },
        ]);

        return this.openAiLlm;
    }

    private getHuggingFaceClient() {
        this.huggingFaceClient ??= new InferenceClient(this.huggingFaceToken);

        return this.huggingFaceClient;
    }

    private readProvider(): ImageGenerationProvider {
        const provider = process.env.IMAGE_GENERATION_PROVIDER?.trim()
            .toLowerCase();

        if (provider === "google") return "google";
        if (provider === "huggingface" || provider === "hf") {
            return "huggingface";
        }

        return "openai";
    }

    private readHuggingFaceProvider(): InferenceProviderOrPolicy {
        return (
            process.env.HF_IMAGE_PROVIDER?.trim() ?? "fal-ai"
        ) as InferenceProviderOrPolicy;
    }

    private async buildGenerationInput(
        prompt: string,
    ): Promise<ImageGenerationInput> {
        const baseImageDataUrl = await this.readModelSheetBaseDataUrl();

        if (!baseImageDataUrl) {
            return buildModelSheetTemplatePrompt(prompt);
        }

        return [
            new HumanMessage({
                content: [
                    {
                        type: "text",
                        text: buildModelSheetTemplatePrompt(prompt),
                    },
                    {
                        type: "image_url",
                        image_url: {
                            url: baseImageDataUrl,
                        },
                    },
                ],
            }),
        ];
    }

    private async readModelSheetBaseDataUrl() {
        if (this.modelSheetBaseDataUrl) return this.modelSheetBaseDataUrl;

        try {
            const image = await fs.readFile(this.modelSheetBasePath);
            this.modelSheetBaseDataUrl = `data:image/png;base64,${image.toString(
                "base64",
            )}`;

            return this.modelSheetBaseDataUrl;
        } catch (error) {
            console.warn(
                "Model sheet base image was not found. Falling back to prompt-only image generation.",
                error,
            );

            return undefined;
        }
    }

    private async readModelSheetBaseBlob() {
        try {
            const image = await fs.readFile(this.modelSheetBasePath);

            return new Blob([new Uint8Array(image)], { type: "image/png" });
        } catch (error) {
            console.warn(
                "Model sheet base image was not found. Hugging Face image-to-image generation requires it.",
                error,
            );

            return undefined;
        }
    }

    private readOpenAiImageQuality(): OpenAiImageQuality {
        const quality = process.env.OPENAI_IMAGE_QUALITY?.trim()
            .toLowerCase();

        if (
            quality === "low" ||
            quality === "medium" ||
            quality === "high" ||
            quality === "auto"
        ) {
            return quality;
        }

        return "low";
    }

    private readOpenAiImageSize(): OpenAiImageSize {
        const size = process.env.OPENAI_IMAGE_SIZE?.trim();

        if (
            size === "1024x1024" ||
            size === "1024x1536" ||
            size === "1536x1024" ||
            size === "auto"
        ) {
            return size;
        }

        return "1024x1024";
    }

    private readGoogleImageSize(): GoogleImageSize {
        const size = process.env.GOOGLE_IMAGE_SIZE?.trim().toUpperCase();

        if (size === "1K" || size === "2K" || size === "4K") {
            return size;
        }

        return "1K";
    }

    private readGoogleImageAspectRatio(): GoogleImageAspectRatio {
        const aspectRatio = process.env.GOOGLE_IMAGE_ASPECT_RATIO?.trim();

        if (
            aspectRatio === "1:1" ||
            aspectRatio === "2:3" ||
            aspectRatio === "3:2" ||
            aspectRatio === "3:4" ||
            aspectRatio === "4:3" ||
            aspectRatio === "4:5" ||
            aspectRatio === "5:4" ||
            aspectRatio === "9:16" ||
            aspectRatio === "16:9" ||
            aspectRatio === "21:9"
        ) {
            return aspectRatio;
        }

        return "1:1";
    }

    private async readProcessedImageFromResponse(response: unknown) {
        const imageUrl = this.readImageFromResponse(response);

        if (!imageUrl) return undefined;

        return this.removeModelSheetBaseColors(imageUrl);
    }

    private readImageFromResponse(response: unknown) {
        const blocks = this.collectResponseBlocks(response);

        for (const block of blocks) {
            const image = this.readImageFromBlock(block);

            if (image) return image;
        }

        return undefined;
    }

    private collectResponseBlocks(response: unknown) {
        if (!this.isContentBlockRecord(response)) return [];

        const blocks: unknown[] = [];
        const contentBlocks = response.contentBlocks;
        const content = response.content;
        const additionalKwargs = response.additional_kwargs;

        if (Array.isArray(contentBlocks)) blocks.push(...contentBlocks);
        if (Array.isArray(content)) blocks.push(...content);

        if (this.isContentBlockRecord(additionalKwargs)) {
            const toolOutputs = additionalKwargs.tool_outputs;

            if (Array.isArray(toolOutputs)) blocks.push(...toolOutputs);
        }

        return blocks;
    }

    private readImageFromBlock(block: unknown) {
        if (!this.isImageContentBlock(block)) return undefined;

        const mimeType = this.readMimeType(block.mimeType) ?? "image/png";
        const data =
            this.readImageData(block.data) ||
            this.readImageData(block.result) ||
            this.readImageData(block.b64_json) ||
            this.readImageData(block.image);

        if (!data) return undefined;
        if (data.startsWith("data:")) return data;

        return `data:${mimeType};base64,${data}`;
    }

    private async removeModelSheetBaseColors(imageUrl: string) {
        const imageData = this.readImageDataUrl(imageUrl);

        if (!imageData) return imageUrl;

        const image = sharp(imageData.data).ensureAlpha().resize(1024, 1024, {
            fit: "fill",
        });
        const { data, info } = await image
            .raw()
            .toBuffer({ resolveWithObject: true });

        for (let index = 0; index < data.length; index += info.channels) {
            const red = data[index];
            const green = data[index + 1];
            const blue = data[index + 2];

            if (this.isModelSheetBaseColor(red, green, blue)) {
                data[index + 3] = 0;
            }
        }

        const output = await sharp(data, {
            raw: {
                width: info.width,
                height: info.height,
                channels: info.channels,
            },
        })
            .png()
            .toBuffer();

        return `data:image/png;base64,${output.toString("base64")}`;
    }

    private readImageDataUrl(imageUrl: string) {
        const match = imageUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);

        if (!match) return undefined;

        return {
            mimeType: match[1],
            data: Buffer.from(match[2], "base64"),
        };
    }

    private async blobToDataUrl(blob: Blob) {
        const buffer = Buffer.from(await blob.arrayBuffer());
        const mimeType = blob.type || "image/png";

        return `data:${mimeType};base64,${buffer.toString("base64")}`;
    }

    private isModelSheetBaseColor(red: number, green: number, blue: number) {
        return (
            this.isColorWithinTolerance(red, green, blue, 105, 255, 0, 48) ||
            this.isColorWithinTolerance(red, green, blue, 0, 203, 63, 48) ||
            this.isColorWithinTolerance(red, green, blue, 56, 231, 28, 48)
        );
    }

    private isColorWithinTolerance(
        red: number,
        green: number,
        blue: number,
        targetRed: number,
        targetGreen: number,
        targetBlue: number,
        tolerance: number,
    ) {
        return (
            Math.abs(red - targetRed) <= tolerance &&
            Math.abs(green - targetGreen) <= tolerance &&
            Math.abs(blue - targetBlue) <= tolerance
        );
    }

    private isImageContentBlock(block: unknown): block is ImageContentBlock {
        if (!this.isContentBlockRecord(block)) return false;

        return (
            this.readImageData(block.data).length > 0 ||
            this.readImageData(block.result).length > 0 ||
            this.readImageData(block.b64_json).length > 0 ||
            this.readImageData(block.image).length > 0
        );
    }

    private isContentBlockRecord(block: unknown): block is ImageContentBlock {
        return typeof block === "object" && block !== null;
    }

    private readImageData(data: unknown) {
        if (typeof data === "string") return data;

        if (data instanceof Uint8Array) {
            return Buffer.from(data).toString("base64");
        }

        return "";
    }

    private readMimeType(mimeType: unknown) {
        if (typeof mimeType !== "string") return undefined;

        return mimeType.split(";")[0];
    }

    private readText(text: unknown) {
        return typeof text === "string" ? text : undefined;
    }

    private readTextFromResponse(response: unknown) {
        const blocks = this.collectResponseBlocks(response);

        for (const block of blocks) {
            if (!this.isContentBlockRecord(block)) continue;

            const text = this.readText(block.text);
            if (text) return text;
        }

        if (this.isContentBlockRecord(response)) {
            return this.readText(response.content);
        }

        return undefined;
    }
}
