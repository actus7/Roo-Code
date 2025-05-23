import { debug } from "./utils"
import type { FlowRequestOptions } from "./types"

/**
 * Realiza uma requisição HTTP com retry automático e backoff exponencial
 * @param url URL da requisição
 * @param options Opções da requisição (inclui timeout e maxRetries)
 * @param maxRetries Número máximo de tentativas (default: 3)
 * @returns Response da requisição
 */
export async function makeRequestWithRetry(
	url: string,
	options: Partial<FlowRequestOptions> & RequestInit,
	maxRetries = 3,
): Promise<Response> {
	let retries = 0
	let lastError: Error | null = null

	// Extrair opções específicas do Flow
	const { timeout, maxRetries: _maxRetries, user: _user, organization: _org, ...fetchOptions } = options

	while (retries < maxRetries) {
		try {
			debug(`Tentativa ${retries + 1} de ${maxRetries} para ${url}`)

			// Se houver timeout definido, configurar AbortController
			if (timeout) {
				const controller = new AbortController()
				setTimeout(() => controller.abort(), timeout)

				// Mesclar o signal com as opções do fetch
				fetchOptions.signal = controller.signal
			}

			const response = await fetch(url, fetchOptions)

			// Se for rate limit (429), aguardar e tentar novamente
			if (response.status === 429) {
				const retryAfter = response.headers.get("Retry-After")
				const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, retries) * 1000

				debug(`Rate limit atingido. Aguardando ${waitTime}ms antes da próxima tentativa`)
				await new Promise((resolve) => setTimeout(resolve, waitTime))
				retries++
				continue
			}

			// Se chegou aqui, retornar a resposta (mesmo que não seja 2xx)
			// O chamador deve verificar response.ok se necessário
			return response
		} catch (error) {
			lastError = error as Error
			debug(`Erro na tentativa ${retries + 1}: ${error.message}`)

			// Se ainda houver tentativas, aguardar com backoff exponencial
			if (retries < maxRetries - 1) {
				const waitTime = Math.pow(2, retries) * 1000
				debug(`Aguardando ${waitTime}ms antes da próxima tentativa`)
				await new Promise((resolve) => setTimeout(resolve, waitTime))
			}
			retries++
		}
	}

	// Se chegou aqui, todas as tentativas falharam
	throw lastError || new Error("Todas as tentativas de requisição falharam")
}
