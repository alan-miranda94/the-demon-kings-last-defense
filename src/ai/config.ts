export type ModelConfig = {
    apiKey: string;
    baseUrl: string;
    providerName: "openai" | "openrouter";
    httpReferer: string;
    xTitle: string;

    provider: {
        sort: {
            by: string;
            partition: string;
        };
    };

    models: string[];
    temperature: number;

    memory: {
        dbUri: string;
    };
};

const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim();
const openAiApiKey = process.env.OPENAI_API_KEY?.trim();

if (!openAiApiKey && !openRouterApiKey) {
    throw new Error(
        "Set OPENAI_API_KEY or OPENROUTER_API_KEY in environment variables",
    );
}

if (!openAiApiKey && !openRouterApiKey?.startsWith("sk-or-")) {
    throw new Error(
        "OPENROUTER_API_KEY must be an OpenRouter key. It should start with sk-or-.",
    );
}

const selectedApiKey = openAiApiKey ?? openRouterApiKey!;

export const config: ModelConfig = {
    apiKey: selectedApiKey,
    baseUrl: openAiApiKey
        ? "https://api.openai.com/v1"
        : "https://openrouter.ai/api/v1",
    providerName: openAiApiKey ? "openai" : "openrouter",
    httpReferer: "",
    xTitle: "IA Devs - Prompt Chaining Article Generator",
    models: [
        // "nvidia/nemotron-nano-9b-v2:free",
        "gpt-4.1-mini",
        // https://openrouter.ai/models?fmt=cards&max_price=0&order=throughput-high-to-low&supported_parameters=structured_outputs%2Cresponse_format
        // "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        // "gpt-oss-120b:free",
    ],
    provider: {
        sort: {
            by: "throughput", // Route to model with highest throughput (fastest response)
            partition: "none",
        },
    },
    temperature: 0.7,
    memory: {
        dbUri:
            process.env.DATABASE_URL ??
            "postgresql://postgres:mysecretpassword@localhost:5433/the_demon_kings_last_defense",
    },
};
