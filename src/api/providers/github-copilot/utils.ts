/**
 * Funções utilitárias para o handler do GitHub Copilot
 */

import { Anthropic } from "@anthropic-ai/sdk"

// Fator de ajuste para contagem de tokens
export const TOKEN_FUDGE_FACTOR = 1.5;

/**
 * Conta tokens em um texto
 * Implementação simplificada para estimativa de tokens
 *
 * @param text Texto para contar tokens
 * @returns Número estimado de tokens
 */
export async function internalCountTokens(text: string): Promise<number> {
    try {
        // Implementação simplificada de contagem de tokens
        // Na prática, seria necessário usar um tokenizador específico para o modelo
        return Math.ceil(text.length / 4)
    } catch (error) {
        console.error("Roo Code <GitHub Copilot API>: Error counting tokens:", error)
        return 0
    }
}

/**
 * Conta tokens em blocos de conteúdo Anthropic
 *
 * @param content Blocos de conteúdo Anthropic
 * @returns Número estimado de tokens
 */
export async function countAnthropicTokens(content: Array<Anthropic.Messages.ContentBlockParam>): Promise<number> {
    // Converte blocos de conteúdo Anthropic para texto
    let textContent = ""

    for (const block of content) {
        if (block.type === "text") {
            textContent += block.text + " "
        }
    }

    // Estimativa simples: 1 token ~= 4 caracteres em inglês
    return Math.ceil(textContent.length / 4 * TOKEN_FUDGE_FACTOR)
}

/**
 * Modifica uma mensagem do usuário para forçar uma resposta direta
 *
 * @param content Conteúdo original da mensagem
 * @returns Conteúdo modificado
 */
export function modifyUserMessage(content: string): string {
    return `RESPONDA DIRETAMENTE SEM INTRODUÇÕES OU CUMPRIMENTOS: ${content}`;
}

/**
 * Extrai o conteúdo de texto de uma mensagem Anthropic
 *
 * @param msg Mensagem Anthropic
 * @returns Conteúdo extraído como string
 */
export function extractMessageContent(msg: Anthropic.Messages.MessageParam): string {
    let content = "";

    if (typeof msg.content === "string") {
        content = msg.content;
    } else if (Array.isArray(msg.content)) {
        content = msg.content
            .filter(block => block.type === "text")
            .map(block => (block as any).text)
            .join("\n");
    }

    return content;
}
