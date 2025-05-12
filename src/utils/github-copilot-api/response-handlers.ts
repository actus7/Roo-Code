/**
 * Manipuladores de respostas para a API do GitHub Copilot
 */

/**
 * Limpa a resposta do modelo de caracteres e padrões indesejados
 * @param response Resposta original
 * @returns Resposta limpa
 */
export function cleanResponse(response: string): string {
    if (!response) return "";

    // Remove caracteres de controle e espaços extras
    let cleaned = response.trim();

    // Remove mensagens de erro comuns
    cleaned = cleaned.replace(/\[ERROR\].*\n/g, "");
    cleaned = cleaned.replace(/Reminder: Instructions for Tool Use.*\n/g, "");
    cleaned = cleaned.replace(/You did not use a tool.*\n/g, "");
    cleaned = cleaned.replace(/Tool uses are formatted.*\n/g, "");
    cleaned = cleaned.replace(/Always adhere to this format.*\n/g, "");
    cleaned = cleaned.replace(/Roo está tendo problemas.*/g, "");
    cleaned = cleaned.replace(/Roo Code uses complex prompts.*/g, "");
    cleaned = cleaned.replace(/This may indicate a failure.*/g, "");
    cleaned = cleaned.replace(/which can be mitigated with some user guidance.*/g, "");
    cleaned = cleaned.replace(/For best results.*/g, "");

    return cleaned;
}

/**
 * Extrai o conteúdo de texto da resposta da API
 * @param responseData Dados da resposta
 * @returns Conteúdo extraído ou undefined se não encontrado
 */
export function extractContentFromResponse(responseData: any): string | undefined {
    if (!responseData) return undefined;

    // Formato OpenAI
    if (responseData.choices && responseData.choices.length > 0) {
        const choice = responseData.choices[0];

        if (choice.message && choice.message.content) {
            return choice.message.content;
        }
        if (choice.delta && choice.delta.content) {
            return choice.delta.content;
        }
        if (choice.text) {
            return choice.text;
        }
        if (choice.content) {
            return choice.content;
        }
    }

    // Formato direto
    if (responseData.content) {
        return responseData.content;
    }
    if (responseData.text) {
        return responseData.text;
    }
    if (typeof responseData === 'string') {
        return responseData;
    }

    return undefined;
}

/**
 * Processa uma resposta de streaming
 * @param streamData Dados do stream
 * @param onChunk Callback para cada chunk processado
 * @returns Resposta completa processada
 */
export function processStreamResponse(streamData: string, onChunk: (chunk: string) => void): string {
    if (!streamData) return "";

    const lines = streamData.split('\n');
    let responseBuffer = "";

    for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
            try {
                const jsonData = JSON.parse(line.substring(6));

                // Extrai o conteúdo do chunk
                let chunk = "";
                if (jsonData.choices && jsonData.choices.length > 0) {
                    const choice = jsonData.choices[0];
                    if (choice.delta && choice.delta.content) {
                        chunk = choice.delta.content;
                    } else if (choice.message && choice.message.content) {
                        chunk = choice.message.content;
                    }
                }

                if (chunk) {
                    // Limpa o chunk
                    const cleanedChunk = cleanResponse(chunk);

                    // Adiciona ao buffer
                    responseBuffer += cleanedChunk;

                    // Chama o callback com o chunk limpo
                    onChunk(cleanedChunk);
                }
            } catch (parseError) {
                console.error("Erro ao processar chunk:", parseError);
            }
        }
    }

    return responseBuffer;
}
