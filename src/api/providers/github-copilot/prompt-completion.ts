/**
 * Funcionalidades relacionadas à conclusão de prompts
 */

import { processResponse } from "./response-processor"

/**
 * Gerencia a conclusão de um prompt único
 * @param api Cliente da API do GitHub Copilot
 * @param model Modelo selecionado
 * @param prompt Prompt para completar
 * @param temperature Temperatura do modelo
 * @returns Resposta do modelo processada
 */
export async function handlePromptCompletion(
    api: any,
    model: any,
    prompt: string,
    temperature: number = 0.1
): Promise<string> {
    // Prepara as mensagens para a API do GitHub Copilot
    const copilotMessages = [
        {
            role: "system" as const,
            content: "Você é um assistente de programação útil e direto."
        },
        {
            role: "user" as const,
            content: typeof prompt === "string" ? prompt : "Olá"
        }
    ]

    // Enviar requisição diretamente para o modelo selecionado
    console.debug("Roo Code <GitHub Copilot API>: Enviando requisição direta")

    try {
        // Configura a requisição para usar o X-Initiator: user para pular a etapa de classificação
        const response = await api.sendChatRequest({
            messages: copilotMessages,
            model: model.id,
            temperature: temperature,
            top_p: 1,
            max_tokens: 4000
        }, "user") // Passa "user" como X-Initiator para pular a etapa de classificação

        // Verifica se a resposta está vazia
        if (!response || response.trim() === "") {
            console.error("Roo Code <GitHub Copilot API>: Resposta vazia recebida da API");
            return "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente ou use outro modelo.";
        }

        console.debug(`Roo Code <GitHub Copilot API>: Resposta completa recebida com ${response.length} caracteres`);

        // Limpa a resposta usando o método auxiliar
        let cleanedResponse = processResponse(response);

        // Verifica se a resposta está vazia após a limpeza
        if (!cleanedResponse || cleanedResponse.trim() === "") {
            console.warn("Roo Code <GitHub Copilot API>: Resposta vazia após limpeza, usando resposta original");
            cleanedResponse = response.trim();
        }

        return cleanedResponse
    } catch (chatError) {
        console.error("Roo Code <GitHub Copilot API>: Erro na requisição principal:", chatError);
        throw chatError;
    }
}

/**
 * Tenta completar um prompt com um modelo alternativo como fallback
 * @param api Cliente da API do GitHub Copilot
 * @param prompt Prompt para completar
 * @param temperature Temperatura do modelo
 * @returns Resposta do modelo alternativo processada
 */
export async function handleAlternativeModelCompletion(
    api: any,
    prompt: string,
    temperature: number = 0.1
): Promise<string> {
    console.debug("Roo Code <GitHub Copilot API>: Tentando com modelo alternativo (GPT-4o)");

    const alternativeResponse = await api.sendChatRequest({
        messages: [
            { role: "system" as const, content: "Você é um assistente útil." },
            { role: "user" as const, content: typeof prompt === "string" ? prompt : "Olá" }
        ],
        model: "gpt-4o", // Tenta com GPT-4o como fallback
        temperature: temperature,
        top_p: 1,
        max_tokens: 4000
    }, "user");

    if (alternativeResponse && alternativeResponse.trim() !== "") {
        console.debug(`Roo Code <GitHub Copilot API>: Resposta alternativa recebida`);

        // Limpa a resposta alternativa
        const cleanedAltResponse = processResponse(alternativeResponse);

        // Retorna a resposta alternativa diretamente
        return cleanedAltResponse;
    }
    
    throw new Error("Falha ao gerar resposta com modelo alternativo");
}
