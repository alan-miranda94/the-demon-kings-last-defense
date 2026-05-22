import { createMemoryService } from "./../services/memoryService";
import { OpenRouterService } from "../services/openrouterService";
import { config } from "../config";
import { buildDemonKingSpeechGraph, buildHeroChatGraph } from "./graph";

type GraphBundle = Awaited<ReturnType<typeof createGraphBundle>>;

let graphBundlePromise: Promise<GraphBundle> | undefined;

async function createGraphBundle() {
    const llmClient = new OpenRouterService(config);
    const memoryService = await createMemoryService();

    return {
        graph: buildDemonKingSpeechGraph(llmClient, memoryService),
        heroChatGraph: buildHeroChatGraph(llmClient, memoryService),
    };
}

export async function buildGraph() {
    graphBundlePromise ??= createGraphBundle();

    return graphBundlePromise;
}

export const graph = async () => {
    const bundle = await buildGraph();

    return bundle.graph;
};

export const heroChatGraph = async () => {
    const bundle = await buildGraph();

    return bundle.heroChatGraph;
};

export default graph;
