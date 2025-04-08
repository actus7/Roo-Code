export interface CopilotModel {
    id: string;
    name?: string;
    description?: string;
    capabilities: {
        limits?: {
            max_context_window_tokens?: number;
            max_output_tokens?: number;
        };
        supports?: {
            vision?: boolean;
            streaming?: boolean;
            [key: string]: boolean | undefined;
        };
    };
}

export interface ChatRequestParams {
    messages: any[];
    model: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    stream?: boolean;
    signal?: AbortSignal;
}

export interface StreamChunk {
    choices?: Array<{
        delta?: {
            content?: string;
        };
    }>;
}