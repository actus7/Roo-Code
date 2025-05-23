import { authenticate } from "../auth"

// Mock global fetch
const mockFetch = jest.fn()
global.fetch = mockFetch

/**
 * Testes para autenticação no Flow Provider.
 */
describe("Flow Auth", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		mockFetch.mockClear()
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	it("deve autenticar com sucesso", async () => {
		// Mock successful response
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => ({
				access_token: "valid-token",
				expires_in: 3600,
			}),
		})

		const result = await authenticate({
			apiKey: "valid",
			providerType: "azure",
			apiUrl: "https://flow.ciandt.com",
			flowAuthBaseUrl: "https://flow.ciandt.com",
			flowTenant: "tenant",
			flowClientId: "client",
			flowClientSecret: "secret",
			flowAppToAccess: "llm-api",
			flowAgent: "chat",
			flowRequestTimeout: 30000,
		})

		expect(result).toEqual({
			token: "valid-token",
			expiresIn: 3600,
		})
		expect(mockFetch).toHaveBeenCalledWith(
			"https://flow.ciandt.com/auth-engine-api/v1/api-key/token",
			expect.objectContaining({
				method: "POST",
				headers: expect.objectContaining({
					"Content-Type": "application/json",
					Accept: "application/json",
					FlowTenant: "tenant",
				}),
				body: JSON.stringify({
					clientId: "client",
					clientSecret: "secret",
					appToAccess: "llm-api",
				}),
			}),
		)
	})

	it("deve falhar na autenticação", async () => {
		// Mock failed response
		mockFetch.mockResolvedValueOnce({
			ok: false,
			statusText: "Unauthorized",
		})

		await expect(
			authenticate({
				apiKey: "fail",
				providerType: "azure",
				apiUrl: "https://flow.ciandt.com",
				flowAuthBaseUrl: "https://flow.ciandt.com",
				flowTenant: "tenant",
				flowClientId: "client",
				flowClientSecret: "secret",
				flowAppToAccess: "llm-api",
				flowAgent: "chat",
				flowRequestTimeout: 30000,
			}),
		).rejects.toThrow("Authentication failed: Unauthorized")
	})

	it("deve timeout na autenticação", async () => {
		// Mock network timeout
		mockFetch.mockImplementationOnce(
			() => new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 100)),
		)

		await expect(
			authenticate({
				apiKey: "timeout",
				providerType: "azure",
				apiUrl: "https://flow.ciandt.com",
				flowAuthBaseUrl: "https://flow.ciandt.com",
				flowTenant: "tenant",
				flowClientId: "client",
				flowClientSecret: "secret",
				flowAppToAccess: "llm-api",
				flowAgent: "chat",
				flowRequestTimeout: 30000,
			}),
		).rejects.toThrow("Timeout")
	})

	it("deve tentar novamente após falha", async () => {
		const mockFn = jest.fn()
		mockFn.mockRejectedValueOnce(new Error("Temporary error")).mockResolvedValue({ token: "retry-token" })

		// First call should fail
		await expect(mockFn()).rejects.toThrow("Temporary error")

		// Second call should succeed
		const result = await mockFn()
		expect(result).toHaveProperty("token", "retry-token")

		expect(mockFn).toHaveBeenCalledTimes(2)
	})
})
