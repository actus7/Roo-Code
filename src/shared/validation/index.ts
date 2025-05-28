/**
 * Centralized validation exports
 *
 * Este arquivo exporta todos os schemas e utilitários de validação
 * para facilitar o uso em toda a aplicação.
 */

// Schemas básicos
export * from "./schemas"

// Pipeline de validação
export * from "./validator"

// Schemas específicos do webview
export * from "./webview-schemas"

// Re-export de tipos comuns para conveniência
export type {
  ValidationResult,
  ValidationError,
  ValidationOptions
} from "./validator"

export type {
  ChatMessage,
  ChatInput,
  SearchQuery,
  TerminalOperation
} from "./schemas"

export type {
  ValidatedWebviewMessage,
  NewTaskMessage,
  TerminalOperationMessage,
  SearchFilesMessage,
  ApiConfigurationMessage
} from "./webview-schemas"

/**
 * Utilitários de validação comumente usados
 */
export const ValidationHelpers = {
  /**
   * Verifica se uma string é um comando seguro
   */
  isSafeCommand: (command: string): boolean => {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//,
      /rm\s+-rf\s+\*/,
      /\$\(.*\)/,
      /`.*`/,
      /format\s+c:/i,
      /del\s+\/f\s+\/s\s+\/q/i
    ]

    return !dangerousPatterns.some(pattern => pattern.test(command.toLowerCase()))
  },

  /**
   * Sanitiza uma string removendo caracteres perigosos
   */
  sanitizeInput: (input: string): string => {
    return input
      .replace(/[<>]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      .replace(/\0/g, '')
      .trim()
  },

  /**
   * Valida se uma URL é segura para uso
   */
  isSecureUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  },

  /**
   * Verifica se um valor é um número válido dentro de um range
   */
  isNumberInRange: (value: unknown, min: number, max: number): boolean => {
    return typeof value === 'number' &&
           !isNaN(value) &&
           isFinite(value) &&
           value >= min &&
           value <= max
  },

  /**
   * Valida formato de email básico
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Verifica se um caminho de arquivo é seguro
   */
  isSafeFilePath: (path: string): boolean => {
    const dangerousPatterns = [
      /\.\./,  // Directory traversal
      /^\/etc/,  // System directories
      /^\/proc/,
      /^\/sys/,
      /^C:\\Windows/i,
      /^C:\\System/i
    ]

    return !dangerousPatterns.some(pattern => pattern.test(path))
  }
}

/**
 * Constantes de validação
 */
export const VALIDATION_CONSTANTS = {
  MAX_TEXT_LENGTH: 100000,
  MAX_COMMAND_LENGTH: 8192,
  MAX_FILE_PATH_LENGTH: 260,
  MAX_FILE_NAME_LENGTH: 255,
  MAX_SEARCH_QUERY_LENGTH: 1000,
  MAX_CHAT_INPUT_LENGTH: 50000,

  MIN_TIMEOUT: 1000,
  MAX_TIMEOUT: 300000,

  MIN_TEMPERATURE: 0,
  MAX_TEMPERATURE: 1,

  MIN_TOKENS: 1,
  MAX_TOKENS: 1000000,

  MIN_VOLUME: 0,
  MAX_VOLUME: 100,

  MIN_SPEED: 0.1,
  MAX_SPEED: 3.0,

  MIN_PERCENTAGE: 0,
  MAX_PERCENTAGE: 100
} as const

/**
 * Mensagens de erro padrão
 */
export const VALIDATION_MESSAGES = {
  REQUIRED: "Campo é obrigatório",
  INVALID_FORMAT: "Formato inválido",
  TOO_LONG: "Valor muito longo",
  TOO_SHORT: "Valor muito curto",
  INVALID_URL: "URL inválida",
  INVALID_EMAIL: "Email inválido",
  INVALID_NUMBER: "Número inválido",
  OUT_OF_RANGE: "Valor fora do range permitido",
  UNSAFE_COMMAND: "Comando não é seguro",
  UNSAFE_PATH: "Caminho não é seguro",
  INVALID_CHARACTERS: "Contém caracteres inválidos"
} as const
