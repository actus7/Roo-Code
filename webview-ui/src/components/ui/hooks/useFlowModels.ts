import { useQuery } from "@tanstack/react-query"
import { ModelInfo } from "@roo/shared/api"
import { vscode } from "@src/utils/vscode"
import { ExtensionMessage } from "@roo/shared/ExtensionMessage"

/**
 * Busca modelos disponíveis no Flow Provider
 * @param tenant Tenant do Flow
 * @param clientId Client ID para autenticação
 * @param clientSecret Client Secret para autenticação
 * @param baseUrl URL base da API Flow
 * @returns Modelos disponíveis para o Flow Provider
 */
const getFlowModels = async (tenant?: string, clientId?: string, clientSecret?: string, baseUrl?: string) =>
	new Promise<Record<string, ModelInfo>>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Flow models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "flowModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.flowModels) {
					resolve(message.flowModels)
				} else {
					reject(new Error("No Flow models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({
			type: "requestFlowModels",
			flowConfig: {
				tenant,
				clientId,
				clientSecret,
				baseUrl,
			},
		})
	})

/**
 * Hook para buscar modelos do Flow Provider
 * @param tenant Tenant do Flow
 * @param clientId Client ID para autenticação
 * @param clientSecret Client Secret para autenticação
 * @param baseUrl URL base da API Flow
 * @returns Query com os modelos do Flow Provider
 */
export const useFlowModels = (tenant?: string, clientId?: string, clientSecret?: string, baseUrl?: string) =>
	useQuery({
		queryKey: ["flowModels", tenant, clientId, baseUrl],
		queryFn: () => getFlowModels(tenant, clientId, clientSecret, baseUrl),
		enabled: !!(tenant && clientId && clientSecret),
	})
