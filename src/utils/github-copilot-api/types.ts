/**
 * Tipos e interfaces para a API do GitHub Copilot
 */

/**
 * Interface para as opções de configuração da API do GitHub Copilot
 */
export interface GitHubCopilotApiOptions {
    /**
     * Token de acesso pessoal do GitHub (opcional)
     * Se não fornecido, tentará obter do VS Code
     */
    githubToken?: string

    /**
     * URL base da API do GitHub
     */
    githubBaseUrl?: string

    /**
     * URL base da API do GitHub Copilot
     */
    copilotBaseUrl?: string

    /**
     * Versão do editor (VS Code)
     */
    editorVersion?: string

    /**
     * Versão do plugin (Copilot Chat)
     */
    pluginVersion?: string

    /**
     * User Agent para as requisições
     */
    userAgent?: string
}

/**
 * Interface para o token do Copilot
 */
export interface CopilotToken {
    /**
     * Token de acesso para a API do GitHub Copilot
     */
    token: string

    /**
     * Data de expiração do token
     */
    expires_at: number

    /**
     * Indica se o chat está habilitado
     */
    chat_enabled: boolean

    /**
     * Endpoints da API
     */
    endpoints: {
        api: string
    }
}

/**
 * Interface para a resposta da API de modelos do GitHub Copilot
 */
export interface CopilotModelsResponse {
    data: CopilotModel[]
    object: string
}

/**
 * Interface para um modelo do GitHub Copilot
 */
export interface CopilotModel {
    id: string
    name: string
    vendor: string
    version: string
    family: string
    object: string
    preview: boolean
    model_picker_enabled: boolean
    capabilities: {
        family: string
        type: string
        tokenizer: string
        supports: {
            streaming?: boolean
            tool_calls?: boolean
            parallel_tool_calls?: boolean
            vision?: boolean
        }
        limits?: {
            max_context_window_tokens?: number
            max_output_tokens?: number
            max_prompt_tokens?: number
            vision?: {
                max_prompt_image_size?: number
                max_prompt_images?: number
                supported_media_types?: string[]
            }
        }
    }
    policy?: {
        state: string
        terms: string
    }
}

/**
 * Interface para uma mensagem de chat
 */
export interface ChatMessage {
    role: "system" | "user" | "assistant"
    content: string
}

/**
 * Interface para uma requisição de chat
 */
export interface ChatRequest {
    messages: ChatMessage[]
    model: string
    temperature?: number
    top_p?: number
    max_tokens?: number
    n?: number
    stream?: boolean
    stop?: string[]
}

/**
 * Interface para uma resposta de chat
 */
export interface ChatResponse {
    id: string
    object: string
    created: number
    model: string
    choices: {
        index: number
        message: {
            role: string
            content: string
        }
        finish_reason: string
    }[]
    usage: {
        prompt_tokens: number
        completion_tokens: number
        total_tokens: number
    }
}
