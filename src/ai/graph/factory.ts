import { OpenRouterService } from "../services/openrouterService";
import { config } from "../config";
import { buildChatGraph } from "./graph";

export async function buildGraph() {
    const llmClient = new OpenRouterService(config);

    const graph = buildChatGraph(llmClient);

    return {
        graph,
        memoryService: {
            store: {
                search: (arg1: any, arg2: any) => Promise.resolve([]),
            },
        },
    };
}

export const graph = async () => buildGraph();
export default graph;
