/**
 * Handlers específicos para processamento de mensagens do GitHub Copilot
 */

import { ApiStream } from "../../transform/stream"
import { ChatMessage } from "../../../utils/github-copilot-api"
import { forceRemoveIntroductions, looksGeneric, processResponse } from "./response-processor"
import { createDirectPrompt } from "./models"
import { extractMessageContent, modifyUserMessage } from "./utils"
import { GitHubCopilotApi } from "../../../utils/github-copilot-api"
import { CopilotModel } from "../../../utils/github-copilot-api"

/**
 * Creates a streaming message generator
 * @param api Copilot API instance
 * @param model Selected model
 * @param messages Chat messages
 * @param temperature Temperature parameter
 */
export async function* createStreamingMessage(
    api: GitHubCopilotApi,
    model: CopilotModel,
    messages: any[],
    temperature: number
): AsyncGenerator<any, void, unknown> {
    const abortController = new AbortController();

    try {
        let fullResponse = "";
        // Criar um array para simular um stream iterável
        const stream: any[] = [];

        // Chamar a API com os três parâmetros necessários
        await api.sendChatRequestStream({
            messages,
            model: model.id,
            temperature,
            top_p: 1,
            max_tokens: model.capabilities?.limits?.max_output_tokens || 4096,
            stream: true
        }, "user", (chunk: string) => {
            fullResponse += chunk;
            // Criar um objeto que simula o formato esperado pelo código existente
            const fakeChunk = {
                choices: [{
                    delta: {
                        content: chunk
                    }
                }]
            };
            // Adicionar ao array de stream para processamento
            stream.push(fakeChunk);
        });

        let totalOutputTokens = 0;

        for await (const chunk of stream) {
            if (chunk?.choices?.[0]?.delta?.content) {
                const content = chunk.choices[0].delta.content;
                totalOutputTokens += content.split(' ').length; // Aproximação simples
                yield {
                    type: "text",
                    text: content,
                    metadata: {
                        model: model.id,
                        timestamp: Date.now()
                    }
                };
            }
        }

        // Estimativa aproximada de tokens de entrada
        const inputTokens = messages.reduce((acc, msg) =>
            acc + (msg.content?.split(' ').length || 0), 0);

        yield {
            type: "usage",
            inputTokens,
            outputTokens: totalOutputTokens,
            model: model.id
        };
    } catch (error) {
        console.error("Streaming error:", error);
        abortController.abort();
        throw error;
    }
}

/**
 * Handles message request with retry logic
 * @param api Copilot API instance
 * @param params Request parameters
 */
export async function handleMessageRequest(
    api: GitHubCopilotApi,
    params: any
): Promise<any> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            return await api.sendChatRequest(params);
        } catch (error: any) {
            attempt++;
            if (attempt === maxRetries || !isRetryableError(error)) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

function isRetryableError(error: any): boolean {
    return error.status === 429 || error.status >= 500;
}

/**
 * Cria uma mensagem sem streaming (fallback)
 * @param api Cliente da API do GitHub Copilot
 * @param model Modelo selecionado
 * @param copilotMessages Mensagens preparadas para a API
 * @param temperature Temperatura do modelo
 * @returns Stream de resposta com a mensagem processada
 */
export async function* createNonStreamingMessage(
    api: any,
    model: any,
    copilotMessages: ChatMessage[],
    temperature: number = 0.1
): ApiStream {
    console.warn("Roo Code <GitHub Copilot API>: Usando modo não-streaming");

    // Abordagem não-streaming como fallback
    const response = await api.sendChatRequest({
        messages: copilotMessages,
        model: model.id,
        temperature: temperature,
        top_p: 1,
        max_tokens: 16384,
        stream: false
    }, "user");

    if (!response || response.trim() === "") {
        console.error("Roo Code <GitHub Copilot API>: Resposta vazia recebida da API");
        const fallbackResponse = "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente ou use outro modelo.";
        yield { type: "text", text: fallbackResponse };
        yield { type: "usage", inputTokens: 0, outputTokens: 0 };
        return;
    }

    console.debug(`Roo Code <GitHub Copilot API>: Resposta recebida com ${response.length} caracteres`);

    // Limpa a resposta usando o método simplificado
    let cleanedResponse = processResponse(response);

    // Verifica se a resposta está vazia após a limpeza
    if (!cleanedResponse || cleanedResponse.trim() === "") {
        console.warn("Roo Code <GitHub Copilot API>: Resposta vazia após limpeza, usando resposta original");
        cleanedResponse = response.trim();
    }

    // Se a resposta ainda parece ser genérica, tenta uma abordagem mais direta
    if (looksGeneric(cleanedResponse)) {
        console.warn("Roo Code <GitHub Copilot API>: Resposta parece genérica, tentando abordagem mais direta");

        // Tenta com um prompt extremamente direto
        const directPrompt = createDirectPrompt(copilotMessages[copilotMessages.length - 1]?.content || '');

        const directResponse = await api.sendChatRequest({
            messages: [
                {
                    role: "system",
                    content: "Você é um assistente técnico que fornece APENAS respostas diretas. NUNCA use introduções ou cumprimentos. NUNCA inclua a frase 'Roo está tendo problemas...' em suas respostas. NUNCA mencione 'Claude 3.7 Sonnet' ou qualquer outro modelo em suas respostas."
                },
                { role: "user", content: directPrompt }
            ],
            model: model.id,
            temperature: 0,
            top_p: 1,
            max_tokens: 16384,
            stream: false
        }, "user");

        if (directResponse && directResponse.trim() !== "") {
            cleanedResponse = processResponse(directResponse);

            // Se ainda parece genérica, tenta remover manualmente introduções comuns
            if (looksGeneric(cleanedResponse)) {
                cleanedResponse = forceRemoveIntroductions(cleanedResponse);
            }
        }
    }

    // Retorna a resposta limpa
    yield { type: "text", text: cleanedResponse };

    // Adiciona um chunk de uso para compatibilidade com outros providers
    yield {
        type: "usage",
        inputTokens: 0,
        outputTokens: 0
    };
}

/**
 * Prepara as mensagens para a API do GitHub Copilot
 * @param systemPrompt Prompt do sistema original
 * @param messages Mensagens do histórico
 * @returns Objeto com as mensagens preparadas e o conteúdo da última mensagem do usuário
 */
export function prepareMessages(
    systemPrompt: string,
    messages: any[]
): { copilotMessages: ChatMessage[], lastUserContent: string } {
    // Extrai a última mensagem do usuário para uso em prompts diretos
    const lastUserMessage = messages
        .filter(msg => msg.role === "user")
        .pop();

    const lastUserContent = extractMessageContent(lastUserMessage || { role: "user", content: "" });

    // Cria um prompt de sistema mais específico com instruções claras
    const enhancedSystemPrompt = `Você é um assistente de programação técnico e direto. NUNCA use introduções ou cumprimentos.

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

    // Prepara as mensagens para a API do GitHub Copilot
    const copilotMessages: Array<ChatMessage> = [
        { role: "system", content: enhancedSystemPrompt }
    ];

    // Adiciona as mensagens do histórico
    for (const msg of messages) {
        const msgRole = msg.role;
        let content = extractMessageContent(msg);

        if (content) {
            if (msgRole === "user") {
                // Modifica a mensagem do usuário para forçar uma resposta direta
                content = modifyUserMessage(content);
                copilotMessages.push({ role: "user", content });
            } else if (msgRole === "assistant") {
                copilotMessages.push({ role: "assistant", content });
            }
        }
    }

    return { copilotMessages, lastUserContent };
}
