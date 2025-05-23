import { formatFlowChatResponse, formatFlowChatChunk } from "../flow-format"
import azureOpenAiResponse from "./fixtures/flow-azure-openai-response.json"
import geminiResponse from "./fixtures/flow-gemini-response.json"
import bedrockResponse from "./fixtures/flow-bedrock-response.json"
import foundryResponse from "./fixtures/flow-foundry-response.json"

describe("flow-format", () => {
	describe("formatFlowChatResponse", () => {
		it("formata resposta do Azure OpenAI corretamente", () => {
			const formatted = formatFlowChatResponse(azureOpenAiResponse as any, {
				includeUsage: true,
				includeSafety: true,
				preserveMetadata: true,
			})

			expect(formatted.content).toBe("Esta é uma resposta de teste do Azure OpenAI")
			expect(formatted.usage).toEqual({
				promptTokens: 50,
				completionTokens: 30,
				totalTokens: 80,
			})
			expect(formatted.safetyRatings).toEqual([
				{ category: "hate", probability: 0.01 },
				{ category: "violence", probability: 0.02 },
			])
			expect(formatted.metadata).toEqual({
				provider: "azure-openai",
				model: "gpt-4",
				temperature: 0.7,
				requestId: "abc-123",
				version: "2024-02",
			})
		})

		it("formata resposta do Gemini corretamente", () => {
			const formatted = formatFlowChatResponse(geminiResponse as any, {
				includeUsage: true,
				includeSafety: true,
			})

			expect(formatted.content).toBe("Esta é uma resposta de teste do Gemini")
			expect(formatted.usage).toEqual({
				promptTokens: 40,
				completionTokens: 25,
				totalTokens: 65,
			})
			expect(formatted.safetyRatings).toEqual([
				{ category: "HARM_CATEGORY_HATE", probability: 0.1 },
				{ category: "HARM_CATEGORY_DANGEROUS", probability: 0.05 },
			])
		})

		it("formata resposta do Bedrock corretamente", () => {
			const formatted = formatFlowChatResponse(bedrockResponse as any)
			expect(formatted.content).toBe("Esta é uma resposta de teste do Amazon Bedrock")
		})

		it("formata resposta do Foundry e limpa tags think", () => {
			const formatted = formatFlowChatResponse(foundryResponse as any)
			expect(formatted.content).toBe("Esta é uma resposta de teste do Foundry")
		})

		it("preserva apenas metadados solicitados", () => {
			const formatted = formatFlowChatResponse(azureOpenAiResponse as any, {
				preserveMetadata: false,
			})
			expect(formatted.metadata).toBeUndefined()
		})

		it("lida com resposta malformada", () => {
			const malformed = {} as any
			const formatted = formatFlowChatResponse(malformed)
			expect(formatted.content).toBe("")
		})
	})

	describe("formatFlowChatChunk", () => {
		it("formata chunk com delta.content", () => {
			const chunk = {
				id: "chunk-1",
				object: "chat.completion.chunk",
				created: 1700000004,
				model: "gpt-4",
				choices: [
					{
						index: 0,
						delta: { content: "Teste chunk" },
						finishReason: null,
					},
				],
			}
			expect(formatFlowChatChunk(chunk as any)).toBe("Teste chunk")
		})

		it("formata chunk com choices[0].delta.content", () => {
			const chunk = {
				id: "chunk-2",
				object: "chat.completion.chunk",
				created: 1700000005,
				model: "gemini-pro",
				choices: [
					{
						index: 0,
						delta: { content: "Teste chunk 2" },
						finishReason: null,
					},
				],
			}
			expect(formatFlowChatChunk(chunk as any)).toBe("Teste chunk 2")
		})

		it("retorna string vazia para chunk sem conteúdo", () => {
			const chunk = {
				id: "chunk-3",
				object: "chat.completion.chunk",
				created: 1700000006,
				model: "gpt-4",
				choices: [
					{
						index: 0,
						delta: {},
						finishReason: null,
					},
				],
			}
			expect(formatFlowChatChunk(chunk as any)).toBe("")
		})

		it("limpa tags think de chunks", () => {
			const chunk = {
				id: "chunk-4",
				object: "chat.completion.chunk",
				created: 1700000007,
				model: "foundry-v1",
				choices: [
					{
						index: 0,
						delta: { content: "<think>Pensando...</think>Resultado" },
						finishReason: null,
					},
				],
			}
			expect(formatFlowChatChunk(chunk as any)).toBe("Resultado")
		})
	})

	describe("funções auxiliares", () => {
		it("extrai métricas de uso corretamente", () => {
			const formatted = formatFlowChatResponse(geminiResponse as any, { includeUsage: true })
			expect(formatted.usage).toEqual({
				promptTokens: 40,
				completionTokens: 25,
				totalTokens: 65,
			})
		})

		it("mapeia classificações de segurança corretamente", () => {
			const formatted = formatFlowChatResponse(foundryResponse as any, { includeSafety: true })
			expect(formatted.safetyRatings).toEqual([
				{ category: "HARM_LEVEL_1", probability: 0.01 },
				{ category: "HARM_LEVEL_2", probability: 0.03 },
			])
		})
	})
})
