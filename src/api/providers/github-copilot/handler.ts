/**
 * Handler principal para o GitHub Copilot
 */

import { Anthropic } from "@anthropic-ai/sdk"
import { ApiHandler, SingleCompletionHandler } from "../.."
import { ModelInfo } from "../../../shared/api"
import { ApiStream } from "../../transform/stream"
import { convertCopilotModelToModelInfo, getDefaultModels, EnhancedModelInfo } from "./models"
import { createStreamingMessage, createNonStreamingMessage } from "./message-handlers"
import { GitHubCopilotApi, CopilotModel } from "../../../utils/github-copilot-api"
import { BaseProvider } from "../base-provider"

/**
 * Interface for provider handlers
 */
interface ProviderHandler {
    getModels(): Promise<EnhancedModelInfo[]>;
}

/**
 * Handler for GitHub Copilot API integration
 * @class GitHubCopilotHandler
 * @implements {ProviderHandler}
 * @implements {ApiHandler}
 * @implements {SingleCompletionHandler}
 */
export class GitHubCopilotHandler extends BaseProvider implements ProviderHandler, ApiHandler, SingleCompletionHandler {
    private api: GitHubCopilotApi;
    private retryAttempts = 3;
    private retryDelay = 1000;
    private options: any; // Armazenar as opções do usuário

    /**
     * Cria uma nova instância do handler do GitHub Copilot
     * @param options Opções de configuração
     */
    constructor(options: any) {
        super();
        // Armazenar as opções para uso posterior
        this.options = options || {};

        // Criar uma instância da API do GitHub Copilot
        this.api = new GitHubCopilotApi({
            // Usar opções do usuário ou valores padrão
            githubBaseUrl: this.options.githubBaseUrl || "https://api.github.com",
            copilotBaseUrl: this.options.githubCopilotBaseUrl || "https://api.individual.githubcopilot.com",
            editorVersion: "vscode/1.99.0",
            pluginVersion: "copilot-chat/0.26.0",
            userAgent: "GitHubCopilotChat/0.26.0"
        });

        // Log das opções para debug
        console.log("GitHub Copilot Handler inicializado com opções:", {
            modeloSelecionado: this.options.githubCopilotModel,
            baseUrl: this.options.githubCopilotBaseUrl
        });
    }

    /**
     * Retrieves available models from GitHub Copilot
     * @returns {Promise<EnhancedModelInfo[]>} List of available models
     */
    async getModels(): Promise<EnhancedModelInfo[]> {
        try {
            const models = await this.retryOperation(() => this.api.getModels());

            if (!models?.length) {
                console.log("No models available, using default list");
                return getDefaultModels();
            }

            return models
                .filter((model: CopilotModel) => !!model.capabilities?.supports)
                .map(convertCopilotModelToModelInfo);
        } catch (error) {
            console.error("Error fetching models:", error);
            return getDefaultModels();
        }
    }

    /**
     * Handles chat completion request
     * @param params Chat completion parameters
     * @returns Stream of completion responses
     */
    async *handleChatCompletion(params: any): AsyncGenerator<any, void, unknown> {
        const { messages, model, temperature = 0.7 } = params;

        try {
            const selectedModel = await this.getModelInfo(model.id);
            if (!selectedModel) {
                throw new Error(`Model ${model.id} not found`);
            }

            try {
                // Tenta primeiro com streaming
                yield* createStreamingMessage(
                    this.api,
                    selectedModel,
                    messages,
                    temperature
                );
            } catch (streamError) {
                console.warn("Streaming failed, falling back to non-streaming mode:", streamError);

                // Fallback para modo não-streaming
                yield* createNonStreamingMessage(
                    this.api,
                    selectedModel,
                    messages,
                    temperature
                );
            }
        } catch (error) {
            console.error("Chat completion error:", error);
            throw error;
        }
    }

    /**
     * Retries an operation with exponential backoff
     * @param operation Operation to retry
     * @returns Operation result
     */
    private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
        let lastError: Error | null = null;

        for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error as Error;
                await new Promise(resolve =>
                    setTimeout(resolve, this.retryDelay * Math.pow(2, attempt))
                );
            }
        }

        throw lastError || new Error("Operation failed after retries");
    }

    /**
     * Obtém informações detalhadas sobre um modelo específico
     * @param modelId ID do modelo a ser obtido
     * @returns Informações do modelo ou null se não for encontrado
     */
    private async getModelInfo(modelId: string): Promise<CopilotModel | null> {
        try {
            console.log(`Buscando informações para o modelo: ${modelId}`);

            // Verificar se é o modelo Claude 3.7 Sonnet
            if (modelId === 'claude-3-7-sonnet-20240307' || modelId.includes('claude-3-7-sonnet')) {
                console.log('Criando definição para Claude 3.7 Sonnet');
                return {
                    id: 'claude-3-7-sonnet-20240307',
                    name: 'Claude 3.7 Sonnet',
                    vendor: "anthropic",
                    version: "1",
                    family: "chat",
                    object: "model",
                    preview: false,
                    model_picker_enabled: true,
                    capabilities: {
                        family: "chat",
                        type: "chat",
                        tokenizer: "cl100k_base",
                        supports: {
                            streaming: true,
                            tool_calls: false,
                            vision: true
                        },
                        limits: {
                            max_context_window_tokens: 200000,
                            max_output_tokens: 4096
                        }
                    }
                };
            }

            // Para outros modelos, buscar na lista de modelos da API
            const models = await this.retryOperation(() => this.api.getModels());

            // Tentar encontrar o modelo pelo ID exato
            let model = models.find(m => m.id === modelId);

            // Se não encontrar, tentar por substrings no ID ou nome
            if (!model) {
                model = models.find(m =>
                    m.id.includes(modelId) ||
                    (m.name && m.name.toLowerCase().includes(modelId.toLowerCase()))
                );
            }

            if (model) {
                console.log(`Modelo encontrado: ${model.id} (${model.name || 'Sem nome'})`);
            } else {
                console.log(`Modelo não encontrado: ${modelId}`);
            }

            return model || null;
        } catch (error) {
            console.error(`Erro ao buscar informações do modelo ${modelId}:`, error);
            return null;
        }
    }

    /**
     * Implementa a interface ApiHandler createMessage
     * @param systemPrompt Prompt do sistema
     * @param messages Mensagens da conversa
     * @returns Stream de resposta da API
     */
    async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
        try {
            // Obter o modelo selecionado
            const modelInfo = this.getModel();
            const selectedModel = await this.getModelInfo(modelInfo.id);

            if (!selectedModel) {
                throw new Error(`Model ${modelInfo.id} not found`);
            }

            // Converter mensagens do formato Anthropic para o formato do GitHub Copilot
            const copilotMessages = messages.map(msg => {
                // Garantir que o role seja um dos valores válidos
                let role = msg.role;
                if (role !== 'user' && role !== 'assistant') {
                    role = 'user';
                }

                return {
                    role: role as 'user' | 'assistant',
                    content: typeof msg.content === 'string' ? msg.content :
                        Array.isArray(msg.content) ?
                            msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n') :
                            ''
                };
            });

            // Adicionar o prompt do sistema como primeira mensagem se não estiver vazio
            if (systemPrompt && systemPrompt.trim() !== '') {
                // Adicionar como mensagem do usuário com prefixo para indicar que é um prompt do sistema
                copilotMessages.unshift({
                    role: 'user' as const,
                    content: `[SYSTEM PROMPT]: ${systemPrompt}`
                });
            }

            // Usar o método handleChatCompletion para processar a requisição
            yield* this.handleChatCompletion({
                messages: copilotMessages,
                model: { id: modelInfo.id },
                temperature: 0.7
            });
        } catch (error) {
            console.error('GitHub Copilot API error:', error);
            throw error;
        }
    }

    /**
     * Implementa a interface ApiHandler getModel
     * @returns Informações do modelo
     */
    getModel(): { id: string; info: ModelInfo } {
        // Usar o modelo especificado nas opções ou Claude 3.7 Sonnet como padrão
        const modelId = this.options?.githubCopilotModel || 'claude-3-7-sonnet-20240307';

        console.log(`Usando modelo: ${modelId}`);

        // Configurações específicas para o Claude 3.7 Sonnet
        if (modelId === 'claude-3-7-sonnet-20240307' || modelId.includes('claude-3-7-sonnet')) {
            return {
                id: 'claude-3-7-sonnet-20240307',
                info: {
                    contextWindow: 200000,
                    maxTokens: 4096,
                    supportsImages: true,
                    supportsPromptCache: false,
                    description: `GitHub Copilot: Claude 3.7 Sonnet`
                }
            };
        }

        // Configurações para outros modelos
        return {
            id: modelId,
            info: {
                contextWindow: 16384,
                maxTokens: 4096,
                supportsImages: true,
                supportsPromptCache: false,
                description: `GitHub Copilot: ${modelId}`
            }
        };
    }

    /**
     * Implementa a interface SingleCompletionHandler completePrompt
     * @param prompt Prompt para completar
     * @returns Resposta do modelo
     */
    async completePrompt(prompt: string): Promise<string> {
        try {
            // Obter o modelo selecionado
            const modelInfo = this.getModel();
            const selectedModel = await this.getModelInfo(modelInfo.id);

            if (!selectedModel) {
                throw new Error(`Model ${modelInfo.id} not found`);
            }

            // Criar mensagens para a requisição
            const messages = [
                {
                    role: 'system' as const,
                    content: 'You are a helpful programming assistant.'
                },
                {
                    role: 'user' as const,
                    content: prompt
                }
            ];

            // Fazer a requisição sem streaming
            const response = await this.api.sendChatRequest({
                messages,
                model: selectedModel.id,
                temperature: 0.7,
                stream: false
            }, 'user');

            return response || '';
        } catch (error) {
            console.error('GitHub Copilot API error:', error);
            return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
        }
    }
}
