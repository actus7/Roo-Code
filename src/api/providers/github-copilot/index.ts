/**
 * Módulo para interação com o GitHub Copilot
 * Exporta as interfaces e componentes principais
 */

import { GitHubCopilotHandler } from "./handler"
import { GitHubCopilotApi } from "../../../utils/github-copilot-api"

/**
 * Obtém a lista de modelos disponíveis no GitHub Copilot
 * Função auxiliar para uso externo
 *
 * @returns Lista de modelos formatada
 */
export async function getGitHubCopilotModels(): Promise<{ id: string; name: string }[]> {
    try {
        const api = new GitHubCopilotApi()
        const models = await api.getModels()

        return models.map(model => ({
            id: model.id,
            name: `${model.vendor} - ${model.name}`
        }))
    } catch (error) {
        console.error("Roo Code <GitHub Copilot API>: Error fetching models:", error)
        return []
    }
}

export { GitHubCopilotHandler }
