/**
 * Funcionalidades relacionadas a modelos do GitHub Copilot
 */

import { ModelInfo } from '../../../shared/api';
import { CopilotModel } from '../../../utils/github-copilot-api';

/**
 * Interface estendida para informações de modelo com capacidades adicionais
 */
export interface EnhancedModelInfo extends ModelInfo {
    /** ID do modelo */
    modelId: string;
    /** Nome de exibição do modelo */
    displayName: string;
    /** Provedor do modelo */
    provider: string;
    /** Preço de entrada (por 1K tokens) */
    inputPrice: number;
    /** Preço de saída (por 1K tokens) */
    outputPrice: number;
    /** Preços específicos para prompt */
    promptPricing: {
        prompt: number;
        completion: number;
    };
    /** Descrição do modelo (opcional) */
    description?: string;
    /** Capacidades específicas do modelo */
    capabilities?: {
        streaming?: boolean;
        tool_calls?: boolean;
        vision?: boolean;
        [key: string]: boolean | undefined;
    };
}

/**
 * Validates a Copilot model
 * @param model Model to validate
 * @throws {Error} If model is invalid
 */
function validateCopilotModel(model: CopilotModel): void {
    if (!model?.id) {
        throw new Error("Invalid model: ID is required");
    }
    if (!model.capabilities) {
        throw new Error(`Invalid model ${model.id}: capabilities are required`);
    }
}

/**
 * Converts a Copilot model to EnhancedModelInfo
 * @param model Copilot model to convert
 * @returns {EnhancedModelInfo} Converted model info
 */
export function convertCopilotModelToModelInfo(model: CopilotModel): EnhancedModelInfo {
    validateCopilotModel(model);

    const contextWindow = model.capabilities.limits?.max_context_window_tokens || 16384;
    const maxTokens = model.capabilities.limits?.max_output_tokens || 4096;
    const supportsImages = model.capabilities.supports?.vision || false;

    return {
        contextWindow,
        maxTokens,
        supportsPromptCache: false,
        supportsImages,
        supportsComputerUse: false,
        modelId: model.id,
        displayName: model.name || model.id,
        provider: "github-copilot",
        inputPrice: 0,
        outputPrice: 0,
        promptPricing: {
            prompt: 0,
            completion: 0
        },
        description: model.name || model.id,
        capabilities: {
            streaming: true,
            ...model.capabilities.supports
        }
    };
}

/**
 * Converte um modelo do GitHub Copilot para o formato CopilotModel
 * @param modelInfo Informações do modelo
 * @returns Modelo no formato CopilotModel
 */
export function convertModelInfoToCopilotModel(modelInfo: EnhancedModelInfo): CopilotModel {
    return {
        id: modelInfo.modelId,
        name: modelInfo.displayName,
        vendor: "github",
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
                vision: modelInfo.supportsImages || false
            },
            limits: {
                max_context_window_tokens: modelInfo.contextWindow,
                max_output_tokens: modelInfo.maxTokens || 4096
            }
        }
    };
}

/**
 * Returns default models when API fails
 * @returns {EnhancedModelInfo[]} List of default models
 */
export function getDefaultModels(): EnhancedModelInfo[] {
    return [
        {
            modelId: "claude-3-7-sonnet-20240307",
            displayName: "Claude 3.7 Sonnet",
            provider: "github-copilot",
            contextWindow: 200000,
            maxTokens: 4096,
            supportsPromptCache: false,
            supportsImages: true,
            supportsComputerUse: false,
            inputPrice: 0,
            outputPrice: 0,
            promptPricing: {
                prompt: 0,
                completion: 0
            },
            capabilities: {
                streaming: true,
                vision: true
            }
        },
        {
            modelId: "copilot-default",
            displayName: "GitHub Copilot",
            provider: "github-copilot",
            contextWindow: 16384,
            maxTokens: 4096,
            supportsPromptCache: false,
            supportsImages: false,
            supportsComputerUse: false,
            inputPrice: 0,
            outputPrice: 0,
            promptPricing: {
                prompt: 0,
                completion: 0
            },
            capabilities: {
                streaming: true
            }
        }
    ];
}

/**
 * Cria um enhanced system prompt com instruções específicas para o GitHub Copilot
 * @param systemPrompt Prompt base do sistema
 * @returns Prompt aprimorado com instruções específicas
 */
export function createEnhancedSystemPrompt(systemPrompt: string): string {
    // Cria um prompt de sistema mais específico com instruções claras
    return `Você é um assistente de programação técnico e direto. NUNCA use introduções ou cumprimentos.

REGRAS ESTRITAS (OBRIGATÓRIAS):
1. NUNCA comece suas respostas com "Olá", "Claro", "Certamente", "Como posso ajudar" ou qualquer introdução.
2. VÁ DIRETO AO PONTO. Responda à pergunta imediatamente sem preâmbulos.
3. Se for solicitado a fazer uma lista, comece IMEDIATAMENTE com "1." sem qualquer texto introdutório.
4. Se for perguntado sobre provedores disponíveis, liste TODOS os provedores de IA da extensão Roo-Code.
5. NUNCA pergunte "Como posso ajudar?" ou qualquer variação disso.
6. NUNCA use frases introdutórias como "Baseado no código" ou "Analisando o arquivo".
7. Forneça APENAS informações técnicas precisas e relevantes.
8. Suas respostas devem ser DIRETAS e ESPECÍFICAS.
9. NUNCA inclua a frase "Roo está tendo problemas..." em suas respostas.
10. NUNCA mencione "Claude 3.7 Sonnet" ou qualquer outro modelo em suas respostas.
11. NUNCA inclua a frase "This may indicate a failure in his thought process" em suas respostas.
12. NUNCA inclua a frase "which can be mitigated with some user guidance" em suas respostas.

${systemPrompt || ""}`;
}

/**
 * Cria um direct prompt extremamente direto para quando a resposta inicial parece genérica
 * @param userContent Conteúdo da mensagem do usuário
 * @returns Prompt direto para corrigir respostas genéricas
 */
export function createDirectPrompt(userContent: string): string {
    return `RESPONDA APENAS À PERGUNTA ABAIXO. NÃO USE INTRODUÇÕES, CUMPRIMENTOS OU FRASES COMO "COMO POSSO AJUDAR".
SE FOR PEDIDO UMA LISTA, COMECE IMEDIATAMENTE COM "1." SEM TEXTO ANTES.

PERGUNTA: ${userContent}

IMPORTANTE: SUA RESPOSTA DEVE COMEÇAR DIRETAMENTE COM O CONTEÚDO RELEVANTE, SEM NENHUMA INTRODUÇÃO.
NUNCA INCLUA A FRASE "Roo está tendo problemas..." EM SUAS RESPOSTAS.
NUNCA MENCIONE "Claude 3.7 Sonnet" OU QUALQUER OUTRO MODELO EM SUAS RESPOSTAS.`;
}
