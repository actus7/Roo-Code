/**
 * Cliente para a API do GitHub Copilot
 */

import * as vscode from "vscode"
import axios, { AxiosInstance } from "axios"
import { v4 as uuidv4 } from "uuid"

import {
    ChatMessage,
    ChatRequest,
    CopilotModel,
    CopilotModelsResponse,
    CopilotToken,
    GitHubCopilotApiOptions
} from "./types"
import { handleNonStreamingRequest, handleStreamingRequest } from "./request-handlers"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { cleanResponse } from "./response-handlers"

/**
 * Classe para interagir com a API do GitHub Copilot
 */
export class GitHubCopilotApi {
    private githubToken?: string
    private copilotToken?: string
    private githubBaseUrl: string
    private copilotBaseUrl: string
    private editorVersion: string
    private pluginVersion: string
    private userAgent: string
    private sessionId: string
    private machineId: string
    private githubClient: AxiosInstance
    private copilotClient: AxiosInstance

    /**
     * Cria uma nova instância da API do GitHub Copilot
     * @param options Opções de configuração
     */
    constructor(options: GitHubCopilotApiOptions = {}) {
        this.githubToken = options.githubToken
        this.githubBaseUrl = options.githubBaseUrl || "https://api.github.com"
        this.copilotBaseUrl = options.copilotBaseUrl || "https://api.individual.githubcopilot.com"
        this.editorVersion = options.editorVersion || "vscode/1.99.0"
        this.pluginVersion = options.pluginVersion || "copilot-chat/0.26.0"
        this.userAgent = options.userAgent || "GitHubCopilotChat/0.26.0"

        // Gerar IDs de sessão e máquina
        this.sessionId = `${uuidv4()}${Date.now()}`
        this.machineId = uuidv4().replace(/-/g, '')

        // Criar clientes HTTP
        this.githubClient = axios.create({
            baseURL: this.githubBaseUrl,
            headers: {
                "Connection": "keep-alive",
                "X-GitHub-Api-Version": "2025-04-01",
                "Editor-Version": this.editorVersion,
                "Editor-Plugin-Version": this.pluginVersion,
                "User-Agent": this.userAgent,
                "X-VSCode-User-Agent-Library-Version": "node-fetch",
                "Accept": "*/*",
                "Accept-Language": "*",
                "Sec-Fetch-Mode": "cors",
                "Accept-Encoding": "br, gzip, deflate"
            }
        })

        this.copilotClient = axios.create({
            baseURL: this.copilotBaseUrl,
            headers: {
                "Host": "api.individual.githubcopilot.com",
                "Connection": "keep-alive",
                "X-GitHub-Api-Version": "2025-04-01",
                "Copilot-Integration-Id": "vscode-chat",
                "VScode-SessionId": this.sessionId,
                "VScode-MachineId": this.machineId,
                "Editor-Version": this.editorVersion,
                "Editor-Plugin-Version": this.pluginVersion,
                "User-Agent": this.userAgent,
                "X-VSCode-User-Agent-Library-Version": "node-fetch",
                "Accept": "*/*",
                "Accept-Language": "*",
                "Sec-Fetch-Mode": "cors",
                "Accept-Encoding": "br, gzip, deflate"
            }
        })
    }

    /**
     * Tenta obter o token do GitHub do VS Code
     * @returns Token do GitHub ou undefined se não encontrado
     */
    private async getGitHubTokenFromVSCode(): Promise<string | undefined> {
        try {
            // Tenta obter a sessão do GitHub do VS Code
            const session = await vscode.authentication.getSession('github', ['read:user'], { createIfNone: false })
            return session?.accessToken
        } catch (error) {
            console.error("Erro ao obter token do GitHub do VS Code:", error)
            return undefined
        }
    }

    /**
     * Obtém o token do GitHub
     * @returns Token do GitHub
     * @throws Erro se não for possível obter o token
     */
    private async getGitHubToken(): Promise<string> {
        // Se já temos um token, retorna ele
        if (this.githubToken) {
            return this.githubToken
        }

        // Tenta obter o token do VS Code
        const tokenFromVSCode = await this.getGitHubTokenFromVSCode()
        if (tokenFromVSCode) {
            this.githubToken = tokenFromVSCode
            return tokenFromVSCode
        }

        // Se não conseguiu obter o token, lança um erro
        throw new Error("Não foi possível obter o token do GitHub. Por favor, faça login no GitHub no VS Code.")
    }

    /**
     * Obtém o token do Copilot
     * @returns Token do Copilot
     * @throws Erro se não for possível obter o token
     */
    public async getCopilotToken(): Promise<string> {
        // Se já temos um token válido, retorna ele
        if (this.copilotToken) {
            return this.copilotToken
        }

        try {
            // Obtém o token do GitHub
            const githubToken = await this.getGitHubToken()

            // Faz a requisição para obter o token do Copilot
            const response = await this.githubClient.get<CopilotToken>("/copilot_internal/v2/token", {
                headers: {
                    "Authorization": `token ${githubToken}`
                }
            })

            // Armazena o token
            this.copilotToken = response.data.token

            // Configura o cliente do Copilot com o token
            this.copilotClient.defaults.headers.common["Authorization"] = `Bearer ${this.copilotToken}`

            return this.copilotToken
        } catch (error) {
            console.error("Erro ao obter token do Copilot:", error)
            throw new Error("Não foi possível obter o token do Copilot. Verifique se você tem acesso ao GitHub Copilot.")
        }
    }

    /**
     * Obtém a lista de modelos disponíveis no GitHub Copilot
     * @returns Lista de modelos
     */
    public async getModels(): Promise<CopilotModel[]> {
        try {
            // Garante que temos um token válido
            await this.getCopilotToken()

            // Faz a requisição para obter os modelos
            const response = await this.copilotClient.get<CopilotModelsResponse>("/models", {
                headers: {
                    "X-Request-Id": uuidv4(),
                    "X-Interaction-Type": "model-access",
                    "OpenAI-Intent": "model-access"
                }
            })

            return response.data.data
        } catch (error) {
            console.error("Erro ao obter modelos do Copilot:", error)
            throw new Error("Não foi possível obter a lista de modelos do GitHub Copilot.")
        }
    }

    /**
     * Envia uma requisição de chat para o GitHub Copilot
     * @param request Requisição de chat
     * @param initiator Tipo de iniciador ("agent" para classificação, "user" para resposta direta)
     * @returns Resposta do chat
     */
    public async sendChatRequest(request: ChatRequest, initiator: "agent" | "user" = "agent"): Promise<string> {
        try {
            // Garante que temos um token válido
            await this.getCopilotToken()

            // Gerar IDs para a requisição
            const requestId = uuidv4();
            const interactionId = uuidv4();

            // Cria o corpo da requisição com os parâmetros exatos do exemplo
            const requestBody: ChatRequest = {
                messages: request.messages,
                model: request.model,
                temperature: request.temperature || 0.1,
                top_p: request.top_p || 1,
                max_tokens: request.max_tokens || 16384,
                n: request.n || 1,
                stream: request.stream || false
            }

            console.debug("GitHub Copilot API: Enviando requisição", {
                requestId,
                interactionId,
                initiator,
                model: requestBody.model
            });

            return handleNonStreamingRequest(
                this.copilotClient,
                requestBody,
                requestId,
                interactionId,
                initiator,
                this.sessionId,
                this.machineId,
                this.editorVersion,
                this.pluginVersion,
                this.userAgent
            );
        } catch (error) {
            console.error("Erro ao enviar requisição de chat:", error);

            // Tenta com modelo alternativo como último recurso
            try {
                const alternativeModel = "gpt-4o";
                console.debug(`GitHub Copilot API: Tentando com modelo alternativo ${alternativeModel}`);

                // Simplifica as mensagens para o modelo alternativo
                const simplifiedMessages: ChatMessage[] = [
                    { role: "system", content: "Você é um assistente de programação. Responda de forma direta e técnica." },
                    {
                        role: "user",
                        content: typeof request.messages[request.messages.length - 1]?.content === "string"
                            ? request.messages[request.messages.length - 1]?.content as string
                            : ""
                    }
                ];

                // Cria uma nova requisição com o modelo alternativo
                const alternativeRequest: ChatRequest = {
                    messages: simplifiedMessages,
                    model: alternativeModel,
                    temperature: 0.1,
                    top_p: 1,
                    max_tokens: 4000,
                    stream: false
                };

                // Gera novos IDs para a requisição alternativa
                const altRequestId = uuidv4();
                const altInteractionId = uuidv4();

                return handleNonStreamingRequest(
                    this.copilotClient,
                    alternativeRequest,
                    altRequestId,
                    altInteractionId,
                    "user",
                    this.sessionId,
                    this.machineId,
                    this.editorVersion,
                    this.pluginVersion,
                    this.userAgent
                );
            } catch (alternativeError) {
                console.error("Erro com modelo alternativo:", alternativeError);
                return "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente ou use outro modelo.";
            }
        }
    }

    /**
     * Envia uma requisição de chat para o GitHub Copilot com suporte a streaming
     * @param request Requisição de chat (deve ter stream: true)
     * @param initiator Tipo de iniciador ("agent" para classificação, "user" para resposta direta)
     * @param onChunk Callback chamado para cada chunk de resposta recebido
     * @returns Resposta completa após o fim do streaming
     */
    public async sendChatRequestStream(
        request: ChatRequest,
        initiator: "agent" | "user" = "agent",
        onChunk: (chunk: string) => void
    ): Promise<string> {
        try {
            // Garante que temos um token válido
            await this.getCopilotToken()

            // Garante que o streaming está habilitado
            if (!request.stream) {
                request.stream = true
            }

            // Gerar IDs para a requisição
            const requestId = uuidv4()
            const interactionId = uuidv4()

            // Cria o corpo da requisição com os parâmetros exatos do exemplo
            const requestBody: ChatRequest = {
                messages: request.messages,
                model: request.model,
                temperature: request.temperature || 0.1,
                top_p: request.top_p || 1,
                max_tokens: request.max_tokens || 16384,
                n: request.n || 1,
                stream: true
            }

            console.debug("GitHub Copilot API: Enviando requisição com streaming", {
                requestId,
                interactionId,
                initiator,
                model: requestBody.model
            })

            return handleStreamingRequest(
                this.copilotClient,
                requestBody,
                requestId,
                interactionId,
                initiator,
                this.sessionId,
                this.machineId,
                this.editorVersion,
                this.pluginVersion,
                this.userAgent,
                onChunk
            )
        } catch (error) {
            console.error("Erro ao enviar requisição de chat com streaming:", error)

            // Tenta com modelo alternativo como último recurso
            try {
                const alternativeModel = "gpt-4o"
                console.debug(`GitHub Copilot API: Tentando modelo alternativo ${alternativeModel} sem streaming`)

                // Simplifica as mensagens para o modelo alternativo
                const simplifiedMessages: ChatMessage[] = [
                    { role: "system", content: "Você é um assistente de programação. Responda de forma direta e técnica." },
                    {
                        role: "user",
                        content: typeof request.messages[request.messages.length - 1]?.content === "string"
                            ? request.messages[request.messages.length - 1]?.content as string
                            : ""
                    }
                ]

                // Cria uma nova requisição com o modelo alternativo
                const alternativeRequest: ChatRequest = {
                    messages: simplifiedMessages,
                    model: alternativeModel,
                    temperature: 0.1,
                    top_p: 1,
                    max_tokens: 4000,
                    stream: false
                }

                // Usa a versão não-streaming como fallback
                const fallbackResponse = await this.sendChatRequest(alternativeRequest, "user")

                // Chama o callback com a resposta completa
                onChunk(fallbackResponse)

                return fallbackResponse
            } catch (alternativeError) {
                console.error("Erro com modelo alternativo:", alternativeError)
                const errorMessage = "Desculpe, não consegui gerar uma resposta. Por favor, tente novamente ou use outro modelo."

                // Chama o callback com a mensagem de erro
                onChunk(errorMessage)

                return errorMessage
            }
        }
    }
}
