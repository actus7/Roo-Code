/**
 * Manipuladores de requisições para a API do GitHub Copilot
 */

import { AxiosInstance } from "axios"
import { ChatRequest } from "./types"
import { cleanResponse, extractContentFromResponse, processStreamResponse } from "./response-handlers"

/**
 * Processa uma requisição sem streaming
 * @param copilotClient Cliente Axios configurado
 * @param requestBody Corpo da requisição
 * @param requestId ID da requisição
 * @param interactionId ID da interação
 * @param initiator Tipo de iniciador
 * @param sessionId ID da sessão
 * @param machineId ID da máquina
 * @param editorVersion Versão do editor
 * @param pluginVersion Versão do plugin
 * @param userAgent User Agent
 * @returns Resposta do chat
 */
export async function handleNonStreamingRequest(
    copilotClient: AxiosInstance,
    requestBody: ChatRequest,
    requestId: string,
    interactionId: string,
    initiator: "agent" | "user",
    sessionId: string,
    machineId: string,
    editorVersion: string,
    pluginVersion: string,
    userAgent: string
): Promise<string> {
    console.debug("GitHub Copilot API: Processando requisição");

    try {
        // Configura headers exatamente como no exemplo
        const headers = {
            "X-Request-Id": requestId,
            "X-Interaction-Type": "conversation-panel",
            "OpenAI-Intent": "conversation-panel",
            "X-GitHub-Api-Version": "2025-04-01",
            "Copilot-Integration-Id": "vscode-chat",
            "VScode-SessionId": sessionId,
            "VScode-MachineId": machineId,
            "X-Interaction-Id": interactionId,
            "X-Initiator": initiator,
            "Editor-Version": editorVersion,
            "Editor-Plugin-Version": pluginVersion,
            "User-Agent": userAgent,
            "Content-Type": "application/json"
        };

        // Faz a requisição para a API do Copilot
        const response = await copilotClient.post("/chat/completions",
            requestBody,
            {
                headers,
                timeout: 30000 // 30 segundos de timeout
            }
        );

        // Extrai o conteúdo da resposta
        if (response.data) {
            const content = extractContentFromResponse(response.data);
            if (content) {
                return cleanResponse(content);
            }
        }

        // Se não conseguiu extrair o conteúdo
        throw new Error("Não foi possível extrair conteúdo da resposta");
    } catch (error) {
        console.error("GitHub Copilot API: Erro na requisição:", error);
        throw error;
    }
}

/**
 * Processa uma requisição com streaming
 * @param copilotClient Cliente Axios configurado
 * @param requestBody Corpo da requisição
 * @param requestId ID da requisição
 * @param interactionId ID da interação
 * @param initiator Tipo de iniciador
 * @param sessionId ID da sessão
 * @param machineId ID da máquina
 * @param editorVersion Versão do editor
 * @param pluginVersion Versão do plugin
 * @param userAgent User Agent
 * @param onChunk Callback para cada chunk de resposta
 * @returns Resposta completa após o fim do streaming
 */
export async function handleStreamingRequest(
    copilotClient: AxiosInstance,
    requestBody: ChatRequest,
    requestId: string,
    interactionId: string,
    initiator: "agent" | "user",
    sessionId: string,
    machineId: string,
    editorVersion: string,
    pluginVersion: string,
    userAgent: string,
    onChunk: (chunk: string) => void
): Promise<string> {
    try {
        // Garante que o streaming está habilitado
        if (!requestBody.stream) {
            requestBody.stream = true;
        }

        // Configura headers exatamente como no exemplo
        const headers = {
            "X-Request-Id": requestId,
            "X-Interaction-Type": "conversation-panel",
            "OpenAI-Intent": "conversation-panel",
            "X-GitHub-Api-Version": "2025-04-01",
            "Copilot-Integration-Id": "vscode-chat",
            "VScode-SessionId": sessionId,
            "VScode-MachineId": machineId,
            "X-Interaction-Id": interactionId,
            "X-Initiator": initiator,
            "Editor-Version": editorVersion,
            "Editor-Plugin-Version": pluginVersion,
            "User-Agent": userAgent,
            "Content-Type": "application/json"
        };

        // Faz a requisição para a API do Copilot com streaming
        const response = await copilotClient.post("/chat/completions",
            requestBody,
            {
                headers,
                timeout: 60000, // 60 segundos de timeout para streaming
                responseType: "text",
                responseEncoding: "utf8",
                transformResponse: (data) => {
                    // Não transformar a resposta, queremos o texto bruto
                    return data;
                }
            }
        );

        // Processando a resposta de streaming
        if (response.data) {
            return processStreamResponse(response.data, onChunk);
        }

        return "";
    } catch (error) {
        console.error("GitHub Copilot API: Erro na requisição com streaming:", error);
        throw error;
    }
}
