/**
 * Funcionalidades de processamento de respostas para o GitHub Copilot
 */

/**
 * Força a remoção de introduções comuns de uma resposta
 * Método mais agressivo para garantir que não haja introduções
 *
 * @param response Resposta a ser processada
 * @returns Resposta sem introduções
 */
export function forceRemoveIntroductions(response: string): string {
    if (!response) return "";

    // Lista de padrões de introdução comuns
    const introPatterns = [
        /^Olá!?\s+/i,
        /^Oi!?\s+/i,
        /^Bom dia!?\s+/i,
        /^Boa tarde!?\s+/i,
        /^Boa noite!?\s+/i,
        /^Claro!?\s+/i,
        /^Certamente!?\s+/i,
        /^Com certeza!?\s+/i,
        /^Entendi!?\s+/i,
        /^Compreendo!?\s+/i,
        /^Vou ajudar!?\s+/i,
        /^Posso ajudar!?\s+/i,
        /^Como posso ajudar!?\s+/i,
        /^Como posso te ajudar!?\s+/i,
        /^Como posso ser útil!?\s+/i,
        /^Em que posso ajudar!?\s+/i,
        /^Estou aqui para ajudar!?\s+/i,
        /^Aqui está!?\s+/i,
        /^Aqui estão!?\s+/i,
        /^Aqui vai!?\s+/i,
        /^Seguem!?\s+/i,
        /^Segue!?\s+/i,
        /^Hello!?\s+/i,
        /^Hi!?\s+/i,
        /^Sure!?\s+/i,
        /^Of course!?\s+/i,
        /^I understand!?\s+/i,
        /^I'll help!?\s+/i,
        /^I can help!?\s+/i,
        /^How can I help!?\s+/i,
        /^Here's!?\s+/i,
        /^Here are!?\s+/i,
        /^Based on!?\s+/i,
        /^According to!?\s+/i,
        /^Looking at!?\s+/i,
        /^Analyzing!?\s+/i,
        /^After analyzing!?\s+/i,
        /^Para melhorar!?\s+/i,
        /^Algumas sugestões!?\s+/i,
        /^Algumas ideias!?\s+/i,
        /^Aqui estão algumas!?\s+/i,
        /^Aqui estão alguns!?\s+/i,
        /^Aqui está uma lista!?\s+/i,
        /^Aqui está uma relação!?\s+/i,
        /^Seguem algumas!?\s+/i,
        /^Seguem alguns!?\s+/i,
        /^Seguem sugestões!?\s+/i,
        /^Seguem ideias!?\s+/i,
        /^Veja algumas!?\s+/i,
        /^Veja alguns!?\s+/i,
        /^Considere!?\s+/i,
        /^Você pode!?\s+/i,
        /^Você poderia!?\s+/i,
        /^Para o seu projeto!?\s+/i,
        /^Para melhorar o projeto!?\s+/i,
        /^Para aprimorar!?\s+/i,
        /^Para otimizar!?\s+/i,
    ];

    let cleanedResponse = response;

    // Remove introduções no início da resposta
    for (const pattern of introPatterns) {
        cleanedResponse = cleanedResponse.replace(pattern, "");
    }

    // Se a resposta começa com "lista" ou "sugestões", remove essa parte também
    cleanedResponse = cleanedResponse.replace(/^lista\s+de\s+/i, "");
    cleanedResponse = cleanedResponse.replace(/^sugestões\s+para\s+/i, "");
    cleanedResponse = cleanedResponse.replace(/^ideias\s+para\s+/i, "");

    // Se a resposta ainda não começa com um número ou marcador de lista e contém ":" no início,
    // remove tudo até o primeiro ":"
    if (!/^\d+\.|\*|-/.test(cleanedResponse) && cleanedResponse.includes(":")) {
        const colonIndex = cleanedResponse.indexOf(":");
        if (colonIndex < 50) { // Só remove se o ":" estiver próximo do início
            cleanedResponse = cleanedResponse.substring(colonIndex + 1).trim();
        }
    }

    // Se for uma lista e não começar com número, tenta encontrar o primeiro item numerado
    if (!cleanedResponse.trim().startsWith("1.") && /\n\s*1\./.test(cleanedResponse)) {
        const firstItemIndex = cleanedResponse.search(/\n\s*1\./);
        if (firstItemIndex > 0) {
            cleanedResponse = cleanedResponse.substring(firstItemIndex).trim();
        }
    }

    return cleanedResponse.trim();
}

/**
 * Verifica se uma resposta parece genérica com base em heurísticas simples
 * Esta é uma verificação básica que complementa as instruções ao modelo
 *
 * @param response Resposta a ser verificada
 * @returns true se a resposta parecer genérica
 */
export function looksGeneric(response: string): boolean {
    // Se a resposta for muito curta, pode ser genérica
    if (response.length < 50) {
        // Verifica por padrões comuns de respostas genéricas
        const genericPhrases = [
            "ajudar", "auxiliar", "útil", "olá", "oi", "bom dia",
            "boa tarde", "boa noite", "help", "assist", "hello", "hi"
        ];

        const lowerResponse = response.toLowerCase();
        return genericPhrases.some(phrase => lowerResponse.includes(phrase));
    }

    // Verifica se a resposta começa com uma introdução genérica
    const genericStarts = [
        "como posso", "em que posso", "estou aqui", "how can",
        "how may", "i'm here", "i am here", "olá", "oi", "hello",
        "hi", "bom dia", "boa tarde", "boa noite", "claro",
        "certamente", "com certeza", "sure", "of course"
    ];

    const lowerStart = response.toLowerCase().substring(0, 50);
    return genericStarts.some(start => lowerStart.includes(start));
}

/**
 * Processa e limpa a resposta do modelo
 * Método simplificado que foca em remover apenas problemas óbvios
 *
 * @param response Resposta original do modelo
 * @returns Resposta processada
 */
export function processResponse(response: string): string {
    if (!response) return "";

    let processed = response;

    // Remove tags HTML/XML
    processed = processed.replace(/<[^>]*>/g, "");

    // Remove caracteres nulos
    processed = processed.replace(/\u0000/g, "");

    // Remove mensagens de erro comuns
    const errorPatterns = [
        /\[ERROR\].*\n/g,
        /Reminder: Instructions for Tool Use.*\n/g,
        /You did not use a tool.*\n/g,
        /Tool uses are formatted.*\n/g,
        /Always adhere to this format.*\n/g,
        /Roo está tendo problemas.*\n/g,
        /Roo Code uses complex prompts.*\n/g,
        /This may indicate a failure.*\n/g,
        /For best results.*\n/g
    ];

    for (const pattern of errorPatterns) {
        processed = processed.replace(pattern, "");
    }

    // Remove linhas vazias extras
    processed = processed.replace(/\n\s*\n\s*\n/g, "\n\n");

    // Limpa espaços extras
    processed = processed.trim();

    return processed;
}
