import { FlowModelService } from "../model-service"
import { TokenManager } from "../auth"
import { makeJsonRequest } from "../request-utils"
import type { FlowConfig, FlowProvider, Model } from "../types"

// Mock dependencies
jest.mock("../auth")
jest.mock("../request-utils")
jest.mock("../utils", () => ({
	debug: jest.fn()
}))

const mockTokenManager = TokenManager as jest.MockedClass<typeof TokenManager>
const mockMakeJsonRequest = makeJsonRequest as jest.MockedFunction<typeof makeJsonRequest>

describe("FlowModelService", () => {
	let service: FlowModelService
	let mockConfig: FlowConfig

	beforeEach(() => {
		mockConfig = {
			flowBaseUrl: "https://test.flow.com",
			flowAuthBaseUrl: "https://test.flow.com",
			flowTenant: "test-tenant",
			flowClientId: "test-client-id",
			flowClientSecret: "test-client-secret",
			flowAppToAccess: "llm-api",
			flowAgent: "chat",
			flowRequestTimeout: 30000
		}

		// Reset mocks
		jest.clearAllMocks()
		
		// Mock TokenManager
		const mockTokenManagerInstance = {
			getValidToken: jest.fn().mockResolvedValue("mock-token")
		}
		mockTokenManager.mockImplementation(() => mockTokenManagerInstance as any)

		service = new FlowModelService(mockConfig)
	})

	describe("fetchModelsFromProvider", () => {
		it("should fetch models successfully from Azure OpenAI", async () => {
			const mockApiResponse = [
				{
					id: "gpt-4o-mini",
					name: "gpt-4o-mini",
					capabilities: ["system-instruction", "chat-conversation"],
					inputTokens: 128000
				},
				{
					id: "gpt-4o",
					name: "gpt-4o",
					capabilities: ["system-instruction", "chat-conversation"],
					inputTokens: 128000
				}
			]

			mockMakeJsonRequest.mockResolvedValue(mockApiResponse)

			const result = await service.fetchModelsFromProvider("azure-openai")

			expect(result).toHaveLength(6) // 2 from API + 4 hardcoded
			expect(result.some(model => model.id === "gpt-4o-mini")).toBe(true)
			expect(result.some(model => model.id === "gpt-4")).toBe(true) // hardcoded
			expect(mockMakeJsonRequest).toHaveBeenCalledWith(
				"https://test.flow.com/ai-orchestration-api/v1/models/azure-openai?capabilities=system-instruction,chat-conversation",
				expect.objectContaining({
					method: "GET",
					headers: expect.objectContaining({
						"Authorization": "Bearer mock-token",
						"X-Tenant": "test-tenant"
					}),
					timeout: 30000
				})
			)
		})

		it("should return hardcoded models when API fails", async () => {
			mockMakeJsonRequest.mockRejectedValue(new Error("API Error"))

			const result = await service.fetchModelsFromProvider("azure-openai")

			expect(result).toHaveLength(4) // Only hardcoded models
			expect(result.some(model => model.id === "gpt-4")).toBe(true)
			expect(result.some(model => model.id === "o1-mini")).toBe(true)
			expect(result.some(model => model.id === "text-embedding-ada-002")).toBe(true)
			expect(result.some(model => model.id === "text-embedding-3-small")).toBe(true)
		})

		it("should handle empty API response", async () => {
			mockMakeJsonRequest.mockResolvedValue([])

			const result = await service.fetchModelsFromProvider("google-gemini")

			expect(result).toHaveLength(0) // No hardcoded models for google-gemini
		})

		it("should remove duplicate models", async () => {
			const mockApiResponse = [
				{
					id: "gpt-4", // This should be deduplicated with hardcoded
					name: "gpt-4",
					capabilities: ["system-instruction", "chat-conversation"],
					inputTokens: 8192
				}
			]

			mockMakeJsonRequest.mockResolvedValue(mockApiResponse)

			const result = await service.fetchModelsFromProvider("azure-openai")

			// Should have 4 unique models (1 from API + 3 other hardcoded, gpt-4 deduplicated)
			expect(result).toHaveLength(4)
			const gpt4Models = result.filter(model => model.id === "gpt-4")
			expect(gpt4Models).toHaveLength(1)
		})
	})

	describe("fetchAllModels", () => {
		it("should fetch models from all providers", async () => {
			mockMakeJsonRequest.mockResolvedValue([
				{
					id: "test-model",
					name: "test-model",
					capabilities: ["system-instruction", "chat-conversation"]
				}
			])

			const result = await service.fetchAllModels()

			expect(result).toHaveProperty("azure-openai")
			expect(result).toHaveProperty("google-gemini")
			expect(result).toHaveProperty("amazon-bedrock")
			expect(result).toHaveProperty("azure-foundry")

			// Should have called API for each provider
			expect(mockMakeJsonRequest).toHaveBeenCalledTimes(4)
		})

		it("should handle partial failures gracefully", async () => {
			mockMakeJsonRequest
				.mockResolvedValueOnce([{ id: "azure-model", name: "azure-model" }])
				.mockRejectedValueOnce(new Error("Google API Error"))
				.mockResolvedValueOnce([{ id: "bedrock-model", name: "bedrock-model" }])
				.mockRejectedValueOnce(new Error("Foundry API Error"))

			const result = await service.fetchAllModels()

			expect(result["azure-openai"]).toHaveLength(5) // 1 from API + 4 hardcoded
			expect(result["google-gemini"]).toHaveLength(0) // Failed, no hardcoded
			expect(result["amazon-bedrock"]).toHaveLength(1) // 1 from API
			expect(result["azure-foundry"]).toHaveLength(0) // Failed, no hardcoded
		})
	})

	describe("getModelOptions", () => {
		it("should format models for dropdown selection", async () => {
			mockMakeJsonRequest.mockResolvedValue([
				{
					id: "gpt-4o-mini",
					name: "gpt-4o-mini",
					capabilities: ["system-instruction", "chat-conversation"],
					inputTokens: 128000
				}
			])

			const result = await service.getModelOptions()

			expect(result).toBeInstanceOf(Array)
			expect(result.length).toBeGreaterThan(0)

			const firstOption = result[0]
			expect(firstOption).toHaveProperty("value")
			expect(firstOption).toHaveProperty("label")
			expect(firstOption).toHaveProperty("provider")

			// Check if context info is included in label
			const optionWithContext = result.find(option => option.label.includes("Context:"))
			expect(optionWithContext).toBeDefined()
		})

		it("should sort options by provider and model name", async () => {
			mockMakeJsonRequest.mockResolvedValue([
				{
					id: "z-model",
					name: "z-model",
					capabilities: ["system-instruction", "chat-conversation"]
				},
				{
					id: "a-model",
					name: "a-model",
					capabilities: ["system-instruction", "chat-conversation"]
				}
			])

			const result = await service.getModelOptions()

			// Check that options are sorted
			for (let i = 1; i < result.length; i++) {
				const prev = result[i - 1]
				const curr = result[i]
				
				if (prev.provider === curr.provider) {
					expect(prev.label.localeCompare(curr.label)).toBeLessThanOrEqual(0)
				} else {
					expect(prev.provider.localeCompare(curr.provider)).toBeLessThanOrEqual(0)
				}
			}
		})
	})

	describe("clearCache", () => {
		it("should clear cache for specific provider", async () => {
			// First fetch to populate cache
			mockMakeJsonRequest.mockResolvedValue([])
			await service.fetchModelsFromProvider("azure-openai")

			// Clear cache for specific provider
			service.clearCache("azure-openai")

			// Second fetch should call API again
			await service.fetchModelsFromProvider("azure-openai")

			expect(mockMakeJsonRequest).toHaveBeenCalledTimes(2)
		})

		it("should clear all cache when no provider specified", async () => {
			// Fetch from multiple providers to populate cache
			mockMakeJsonRequest.mockResolvedValue([])
			await service.fetchModelsFromProvider("azure-openai")
			await service.fetchModelsFromProvider("google-gemini")

			// Clear all cache
			service.clearCache()

			// Subsequent fetches should call API again
			await service.fetchModelsFromProvider("azure-openai")
			await service.fetchModelsFromProvider("google-gemini")

			expect(mockMakeJsonRequest).toHaveBeenCalledTimes(4)
		})
	})

	describe("caching behavior", () => {
		it("should use cache for subsequent requests", async () => {
			mockMakeJsonRequest.mockResolvedValue([])

			// First call
			await service.fetchModelsFromProvider("azure-openai", true)
			
			// Second call should use cache
			await service.fetchModelsFromProvider("azure-openai", true)

			expect(mockMakeJsonRequest).toHaveBeenCalledTimes(1)
		})

		it("should bypass cache when useCache is false", async () => {
			mockMakeJsonRequest.mockResolvedValue([])

			// First call
			await service.fetchModelsFromProvider("azure-openai", false)
			
			// Second call should not use cache
			await service.fetchModelsFromProvider("azure-openai", false)

			expect(mockMakeJsonRequest).toHaveBeenCalledTimes(2)
		})
	})
})
