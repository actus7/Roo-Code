import { FlowConfig, AuthResponse } from "./types"

/**
 * Autentica com o serviço Flow usando as credenciais fornecidas
 * @param config Configuração do Flow contendo as credenciais necessárias
 * @returns Objeto AuthResponse contendo o token de acesso e sua validade
 */
export async function authenticate(config: FlowConfig): Promise<AuthResponse> {
	const url = `${config.flowAuthBaseUrl}/auth-engine-api/v1/api-key/token`

	const response = await fetch(url, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Accept: "application/json",
			FlowTenant: config.flowTenant,
		},
		body: JSON.stringify({
			clientId: config.flowClientId,
			clientSecret: config.flowClientSecret,
			appToAccess: config.flowAppToAccess,
		}),
	})

	if (!response.ok) {
		throw new Error(`Authentication failed: ${response.statusText}`)
	}

	const data = await response.json()

	return {
		token: data.access_token,
		expiresIn: data.expires_in,
	}
}
