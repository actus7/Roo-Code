/**
 * Wrapper para a API do GitHub Copilot
 * Este arquivo serve como um proxy para a implementação em utils/github-copilot-api
 */

import { GitHubCopilotApi as OriginalGitHubCopilotApi } from "../../../utils/github-copilot-api";

// Re-exporta a classe original
export class GitHubCopilotApi extends OriginalGitHubCopilotApi {
    // Mantém a implementação original
}
