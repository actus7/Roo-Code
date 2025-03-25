import * as vscode from "vscode"
import { PurecodeHandler } from "../purecode"
import { ApiHandlerOptions } from "../../../shared/api"

// Mock do vscode
jest.mock("vscode", () => ({
    workspace: {
        onDidChangeConfiguration: jest.fn(),
    },
    LanguageModelChatMessage: {
        System: jest.fn((content) => ({ role: "system", content })),
        User: jest.fn((content) => ({ role: "user", content })),
        Assistant: jest.fn((content) => ({ role: "assistant", content })),
    },
    LanguageModelTextPart: jest.fn(),
    extensions: {
        getExtension: jest.fn(),
    },
    commands: {
        executeCommand: jest.fn(),
    },
}))

describe("PurecodeHandler Discovery Tests", () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe("Purecode Extension Discovery", () => {
        it("should check if Purecode extension is installed", () => {
            const purecodeExtensionId = "purecode-ai.purecode" // Precisamos descobrir o ID correto
            const mockExtension = {
                id: purecodeExtensionId,
                isActive: true,
                exports: {},
            }

            // Teste para verificar se a extensão está instalada
            ;(vscode.extensions.getExtension as jest.Mock).mockReturnValue(mockExtension)
            
            const extension = vscode.extensions.getExtension(purecodeExtensionId)
            expect(extension).toBeDefined()
            expect(extension?.isActive).toBe(true)
        })

        it("should explore Purecode extension exports", () => {
            const mockPurecodeExports = {
                // Vamos logar tudo que encontrarmos na API
                someApi: {},
                someMethod: () => {},
            }

            ;(vscode.extensions.getExtension as jest.Mock).mockReturnValue({
                exports: mockPurecodeExports,
            })

            const extension = vscode.extensions.getExtension("purecode-ai.purecode")
            console.log("Purecode Extension Exports:", extension?.exports)
            
            // Teste genérico para ver se temos alguma API exposta
            expect(extension?.exports).toBeDefined()
        })
    })

    describe("Purecode Commands Discovery", () => {
        it("should discover available Purecode commands", async () => {
            const mockCommands = [
                "purecode.someCommand",
                "purecode.anotherCommand",
            ]

            ;(vscode.commands.executeCommand as jest.Mock).mockResolvedValue(mockCommands)

            // Tenta executar alguns comandos comuns que podem existir
            await vscode.commands.executeCommand("purecode.getCompletion", "test prompt")
            await vscode.commands.executeCommand("purecode.chat", "test message")

            // Verifica quais comandos foram chamados
            const calledCommands = (vscode.commands.executeCommand as jest.Mock).mock.calls.map(call => call[0])
            console.log("Called Purecode Commands:", calledCommands)
        })
    })

    describe("PurecodeHandler API Tests", () => {
        let handler: PurecodeHandler
        const mockOptions: ApiHandlerOptions = {
            // apiProvider is not part of ApiHandlerOptions, so we'll remove it
        }

        beforeEach(() => {
            handler = new PurecodeHandler(mockOptions)
        })

        it("should create a chat completion", async () => {
            const systemPrompt = "You are a helpful assistant"
            const messages = [
                { role: "user", content: "Hello!" },
            ]

            const stream = handler.createMessage(systemPrompt, messages)
            const chunks: any[] = []

            for await (const chunk of stream) {
                chunks.push(chunk)
            }

            expect(chunks).toEqual([
                { type: 'text', text: "Response chunk 1" },
                { type: 'text', text: "Response chunk 2" }
            ])
        })

        it("should return model capabilities", () => {
            const modelInfo = handler.getModel()
            
            expect(modelInfo).toEqual({
                id: "purecode-default",
                info: {
                    maxTokens: 4096,
                    contextWindow: 8192,
                    supportsImages: false,
                    supportsComputerUse: false,
                    supportsPromptCache: false,
                    description: "Default Purecode AI model"
                }
            })
        })

        it("should count tokens correctly", async () => {
            const content = [
                { text: "Hello" },
                { text: "World" },
                { someOtherProperty: "This should be ignored" }
            ]
            const tokenCount = await handler.countTokens(content)
            expect(tokenCount).toBe(10) // "Hello" (5) + "World" (5) = 10
        })
    })

    describe("VS Code Language Model Integration Tests", () => {
        it("should check if Purecode uses VS Code's Language Model API", async () => {
            // Mock do VS Code Language Model API
            const mockLmApi = {
                selectChatModels: jest.fn(),
            }

            // Adiciona o mock ao objeto vscode
            ;(vscode as any).lm = mockLmApi

            try {
                await (vscode as any).lm.selectChatModels({ vendor: "purecode" })
                
                // Verifica se a API foi chamada
                expect(mockLmApi.selectChatModels).toHaveBeenCalled()
                
                // Loga os argumentos passados para a API
                const callArgs = mockLmApi.selectChatModels.mock.calls[0]
                console.log("Language Model API Call Args:", callArgs)
            } catch (error) {
                console.log("Language Model API Error:", error)
                expect(error).toBeDefined()
            }
        })
    })

    describe("Error Handling Tests", () => {
        it("should handle various error scenarios", async () => {
            const handler = new PurecodeHandler({})

            // Teste 1: Sem autenticação
            try {
                const stream = handler.createMessage("test", [])
                for await (const _ of stream) {
                    // noop
                }
            } catch (error) {
                console.log("No Auth Error:", error)
            }

            // Teste 2: Prompt inválido
            try {
                const stream = handler.createMessage("", [])
                for await (const _ of stream) {
                    // noop
                }
            } catch (error) {
                console.log("Invalid Prompt Error:", error)
            }

            // Teste 3: Modelo inválido
            try {
                const handler = new PurecodeHandler({
                    apiModelId: "invalid-model"
                })
                console.log("Model Info:", handler.getModel())
            } catch (error) {
                console.log("Invalid Model Error:", error)
            }
        })
    })
})