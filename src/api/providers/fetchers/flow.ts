import { ModelInfo } from "../../../shared/api"
import { makeRequestWithRetry } from "../flow/request-utils"
import { authenticate } from "../flow/auth"

/**
 * Busca modelos disponíveis na plataforma Flow para todos os provedores suportados
 * @param flowTenant Tenant do Flow
 * @param flowClientId Client ID para autenticação
 * @param flowClientSecret Client Secret para autenticação
 * @param flowBaseUrl URL base da API Flow
 * @returns Dicionário de modelos disponíveis
 */
export async function getFlowModels(
	flowTenant?: string,
	flowClientId?: string,
	flowClientSecret?: string,
	flowBaseUrl: string = "https://flow.ciandt.com",
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	if (!flowTenant || !flowClientId || !flowClientSecret) {
		console.log("Flow credentials not provided, skipping model fetch")
		return models
	}

	try {
		// Autenticação
		const authResponse = await authenticate({
			apiKey: "", // Campo obrigatório mas não usado para Flow
			apiUrl: flowBaseUrl,
			providerType: "azure", // Valor padrão
			flowTenant,
			flowClientId,
			flowClientSecret,
			flowAuthBaseUrl: flowBaseUrl,
			flowAppToAccess: "llm-api",
		})

		const token = authResponse.token

		// Lista de provedores suportados
		const providers = ["azure-openai", "google-gemini", "amazon-bedrock", "azure-foundry"]

		// Para cada provedor, buscar modelos com capabilities específicas
		for (const provider of providers) {
			// Adicionar capabilities como parâmetro de consulta para filtrar modelos compatíveis
			const url = `${flowBaseUrl}/ai-orchestration-api/v1/models/${provider}?capabilities=system-instruction,chat-conversation`

			const response = await makeRequestWithRetry(url, {
				headers: {
					Accept: "application/json",
					Authorization: `Bearer ${token}`,
					FlowTenant: flowTenant,
				},
			})

			if (response.ok) {
				const data = await response.json()

				// Adicionar modelos de embeddings para Azure OpenAI
				if (provider === "azure-openai") {
					// Adicionar modelos de embeddings que não são retornados pela API
					const embeddingModels = [
						{
							name: "text-embedding-ada-002",
							capabilities: ["embeddings"],
							inputTokens: 8191,
						},
						{
							name: "text-embedding-3-small",
							capabilities: ["embeddings"],
							inputTokens: 8191,
						},
					]

					// Adicionar modelos de embeddings à lista
					embeddingModels.forEach((modelData) => {
						models[modelData.name] = {
							maxTokens: modelData.inputTokens || 4000,
							contextWindow: modelData.inputTokens || 8000,
							supportsImages: false,
							supportsPromptCache: false,
							supportsComputerUse: false,
							description: `${provider} - ${modelData.name} (embeddings)`,
						}
					})
				}

				// Processar modelos retornados pela API
				data.forEach((modelData: any) => {
					// Usar o nome do modelo como ID
					const modelName = modelData.name
					const hasStreaming =
						Array.isArray(modelData.capabilities) && modelData.capabilities.includes("streaming")
					const hasImages =
						Array.isArray(modelData.capabilities) && modelData.capabilities.includes("image-recognition")

					models[modelName] = {
						maxTokens: modelData.inputTokens || 4000,
						contextWindow: modelData.inputTokens || 8000,
						supportsImages: hasImages,
						supportsPromptCache: false,
						supportsComputerUse: false,
						description: `${provider} - ${modelName}${hasStreaming ? " (streaming)" : ""}`,
					}
				})
			} else {
				console.error(`Error fetching ${provider} models: ${response.statusText}`)
			}
		}

		console.log(`Flow fetched ${Object.keys(models).length} models successfully`)
	} catch (error) {
		console.error(`Error fetching Flow models: ${JSON.stringify(error, Object.getOwnPropertyNames(error), 2)}`)
	}

	return models
}
