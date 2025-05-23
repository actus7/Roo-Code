import { DEFAULT_FLOW_AGENT, initializeFlowConfig } from "../config"

describe("flow/config", () => {
	describe("DEFAULT_FLOW_AGENT", () => {
		it("deve ter o valor padrão correto", () => {
			expect(DEFAULT_FLOW_AGENT).toBe("chat")
		})
	})

	describe("initializeFlowConfig", () => {
		it("inicializa configuração com valores obrigatórios", () => {
			const config = initializeFlowConfig({
				apiKey: "test-key",
				providerType: "azure",
				flowTenant: "tenant",
				flowClientId: "client-id",
				flowClientSecret: "client-secret",
			})

			expect(config).toEqual({
				apiKey: "test-key",
				apiUrl: "https://flow.ciandt.com",
				providerType: "azure",
				flowAuthBaseUrl: "https://flow.ciandt.com",
				flowTenant: "tenant",
				flowClientId: "client-id",
				flowClientSecret: "client-secret",
				flowAppToAccess: "llm-api",
				flowAgent: "chat",
				flowRequestTimeout: 30000,
				version: undefined,
				deploymentId: undefined,
				region: undefined,
				project: undefined,
				apiModelId: undefined,
			})
		})

		it("usa valores personalizados quando fornecidos", () => {
			const config = initializeFlowConfig({
				apiKey: "custom-key",
				apiUrl: "https://custom.flow.com",
				providerType: "azure",
				flowAuthBaseUrl: "https://auth.custom.flow.com",
				flowTenant: "custom-tenant",
				flowClientId: "custom-client",
				flowClientSecret: "custom-secret",
				flowAppToAccess: "custom-app",
				version: "2024-03",
				deploymentId: "deployment-1",
				region: "us-east-1",
				project: "project-1",
			})

			expect(config).toEqual({
				apiKey: "custom-key",
				apiUrl: "https://custom.flow.com",
				providerType: "azure",
				flowAuthBaseUrl: "https://auth.custom.flow.com",
				flowTenant: "custom-tenant",
				flowClientId: "custom-client",
				flowClientSecret: "custom-secret",
				flowAppToAccess: "custom-app",
				flowAgent: "chat",
				flowRequestTimeout: 30000,
				version: "2024-03",
				deploymentId: "deployment-1",
				region: "us-east-1",
				project: "project-1",
				apiModelId: undefined,
			})
		})
	})
})
