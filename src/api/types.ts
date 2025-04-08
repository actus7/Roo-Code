/**
 * Tipos e interfaces para a API do Roo-Code
 */

import { ModelInfo } from "../shared/api";

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
 * Interface para manipuladores de provedores
 */
export interface ProviderHandler {
    /** Obtém a lista de modelos disponíveis */
    getModels(): Promise<EnhancedModelInfo[]>;
}
