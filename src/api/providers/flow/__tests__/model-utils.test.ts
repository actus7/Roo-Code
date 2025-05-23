/**
 * Testes para funções de model-utils
 */

import {
	transformChatResponse,
	determineProvider,
	getProviderEndpoint,
	transformModelData,
	selectOptimalModel,
} from "../model-utils"

describe("model-utils", () => {
	describe("determineProvider", () => {
		test("identifica Azure OpenAI models corretamente", () => {
			expect(determineProvider("gpt-4")).toBe("azure-openai")
			expect(determineProvider("gpt-3.5-turbo")).toBe("azure-openai")
			expect(determineProvider("o3-mini")).toBe("azure-openai")
		})

		test("identifica Google Gemini models corretamente", () => {
			expect(determineProvider("gemini-1.5-pro")).toBe("google-gemini")
			expect(determineProvider("gemini-2.5-flash")).toBe("google-gemini")
		})

		test("identifica Amazon Bedrock models corretamente", () => {
			expect(determineProvider("anthropic.claude-3-sonnet")).toBe("amazon-bedrock")
			expect(determineProvider("amazon.titan-text")).toBe("amazon-bedrock")
			expect(determineProvider("meta.llama3-70b")).toBe("amazon-bedrock")
		})

		test("identifica Azure Foundry models corretamente", () => {
			expect(determineProvider("DeepSeek-V3")).toBe("azure-foundry")
		})

		test("retorna azure-openai como padrão", () => {
			expect(determineProvider("unknown-model")).toBe("azure-openai")
		})
	})

	describe("getProviderEndpoint", () => {
		test("retorna endpoint correto para Azure OpenAI", () => {
			expect(getProviderEndpoint("azure-openai")).toBe("/ai-orchestration-api/v1/openai/chat/completions")
		})

		test("retorna endpoint correto para Google Gemini", () => {
			expect(getProviderEndpoint("google-gemini")).toBe("/ai-orchestration-api/v1/google/generateContent")
		})

		test("retorna endpoint correto para Amazon Bedrock", () => {
			expect(getProviderEndpoint("amazon-bedrock")).toBe("/ai-orchestration-api/v1/bedrock/invoke")
		})

		test("retorna endpoint correto para Azure Foundry", () => {
			expect(getProviderEndpoint("azure-foundry")).toBe("/ai-orchestration-api/v1/foundry/chat/completions")
		})

		test("lança erro para provider não suportado", () => {
			expect(() => getProviderEndpoint("unsupported")).toThrow("Provider não suportado: unsupported")
		})
	})

	describe("transformChatResponse", () => {
		test("transforma resposta Azure OpenAI corretamente", () => {
			const mockResponse = {
				id: "chatcmpl-123",
				object: "chat.completion",
				created: 1677652288,
				model: "gpt-4",
				choices: [
					{
						index: 0,
						message: { role: "assistant", content: "Resposta Azure" },
						finish_reason: "stop",
					},
				],
				usage: {
					prompt_tokens: 10,
					completion_tokens: 20,
					total_tokens: 30,
				},
				system_fingerprint: "fp_123",
			}

			const result = transformChatResponse("azure-openai", mockResponse)

			expect(result.id).toBe("chatcmpl-123")
			expect(result.choices[0].message.content).toBe("Resposta Azure")
			expect(result.usage.totalTokens).toBe(30)
		})

		test("transforma resposta Google Gemini corretamente", () => {
			const mockResponse = {
				responseId: "gemini-123",
				createTime: "2024-01-01T00:00:00Z",
				modelVersion: "gemini-1.5-pro",
				candidates: [
					{
						content: {
							parts: [{ text: "Resposta Gemini" }],
						},
						finishReason: "STOP",
					},
				],
				usageMetadata: {
					promptTokenCount: 10,
					candidatesTokenCount: 20,
					totalTokenCount: 30,
				},
			}

			const result = transformChatResponse("google-gemini", mockResponse)

			expect(result.choices[0].message.content).toBe("Resposta Gemini")
			expect(result.usage.totalTokens).toBe(30)
		})

		test("transforma resposta Amazon Bedrock corretamente", () => {
			const mockResponse = {
				id: "bedrock-123",
				model: "anthropic.claude-3-sonnet",
				content: [{ text: "Resposta Bedrock" }],
				stop_reason: "end_turn",
				usage: {
					input_tokens: 10,
					output_tokens: 20,
				},
			}

			const result = transformChatResponse("amazon-bedrock", mockResponse)

			expect(result.choices[0].message.content).toBe("Resposta Bedrock")
			expect(result.usage.totalTokens).toBe(30)
		})

		test("lança erro para provider não suportado", () => {
			expect(() => transformChatResponse("unsupported", {})).toThrow("Provider não suportado: unsupported")
		})
	})

	describe("transformModelData", () => {
		test("transforma dados do modelo corretamente", () => {
			const apiData = {
				id: "gpt-4",
				contextLength: 8192,
				capabilities: ["chat", "completion"],
				deprecated: false,
			}

			const result = transformModelData(apiData)

			expect(result.id).toBe("gpt-4")
			expect(result.provider).toBe("azure-openai")
			expect(result.inputTokens).toBe(8192)
			expect(result.capabilities).toEqual(["chat", "completion"])
			expect(result.deprecated).toBe(false)
		})
	})

	describe("selectOptimalModel", () => {
		const mockModels = [
			{
				id: "gpt-4",
				provider: "azure-openai",
				inputTokens: 8192,
				capabilities: ["chat", "completion"],
				deprecated: false,
			},
			{
				id: "gemini-1.5-flash",
				provider: "google-gemini",
				inputTokens: 1000000,
				capabilities: ["chat", "completion"],
				deprecated: false,
			},
		]

		test("seleciona modelo baseado em capabilities", () => {
			const result = selectOptimalModel({ capabilities: ["chat"] }, mockModels)

			expect(result).not.toBeNull()
			expect(result!.capabilities).toContain("chat")
		})

		test("seleciona modelo baseado em contextLength", () => {
			const result = selectOptimalModel({ maxContextLength: 100000 }, mockModels)

			expect(result).not.toBeNull()
			expect(result!.inputTokens).toBeGreaterThanOrEqual(100000)
		})

		test("retorna null quando nenhum modelo atende aos requisitos", () => {
			const result = selectOptimalModel({ maxContextLength: 2000000 }, mockModels)

			expect(result).toBeNull()
		})
	})
})
