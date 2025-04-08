// Formatos de resposta suportados
export type ResponseFormat = 'text' | 'markdown' | 'json';

// Tipo para as mensagens
export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Tipo para a resposta da API
export interface ApiResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}
