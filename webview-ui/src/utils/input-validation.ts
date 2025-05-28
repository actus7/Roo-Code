import { z } from "zod"

/**
 * Schemas de validação específicos para inputs do frontend
 */

// Validação de input de chat
export const chatInputValidationSchema = z.string()
  .min(1, "Mensagem não pode estar vazia")
  .max(50000, "Mensagem muito longa (máximo 50.000 caracteres)")
  .refine(
    (input) => input.trim().length > 0,
    "Mensagem não pode conter apenas espaços em branco"
  )
  .refine(
    (input) => !input.includes('<script'),
    "Mensagem não pode conter scripts"
  )

// Validação de configuração de API
export const apiConfigValidationSchema = z.object({
  apiProvider: z.string().min(1, "Provider é obrigatório"),
  apiKey: z.string().optional(),
  baseUrl: z.string().url("URL base deve ser válida").optional(),
  modelId: z.string().min(1, "Model ID é obrigatório").optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().min(1).max(1000000).optional(),
})

// Validação de busca de arquivos
export const fileSearchValidationSchema = z.object({
  query: z.string()
    .min(1, "Query de busca não pode estar vazia")
    .max(500, "Query muito longa")
    .refine(
      (query) => query.trim().length > 0,
      "Query não pode conter apenas espaços"
    ),
  maxResults: z.number()
    .min(1, "Número mínimo de resultados é 1")
    .max(100, "Número máximo de resultados é 100")
    .optional()
    .default(20),
  includeContent: z.boolean().optional().default(false)
})

// Validação de configurações de terminal
export const terminalConfigValidationSchema = z.object({
  command: z.string()
    .min(1, "Comando não pode estar vazio")
    .max(8192, "Comando muito longo")
    .refine(
      (cmd) => !cmd.includes("$(") && !cmd.includes("`"),
      "Comando não pode conter subshells por segurança"
    )
    .refine(
      (cmd) => !cmd.toLowerCase().includes("rm -rf /"),
      "Comando perigoso não permitido"
    ),
  workingDirectory: z.string()
    .max(260, "Caminho muito longo")
    .optional(),
  timeout: z.number()
    .min(1000, "Timeout mínimo é 1 segundo")
    .max(300000, "Timeout máximo é 5 minutos")
    .optional()
    .default(30000)
})

// Validação de configurações de browser
export const browserConfigValidationSchema = z.object({
  viewportSize: z.string()
    .regex(/^\d+x\d+$/, "Formato deve ser 'largura x altura'")
    .refine(
      (size) => {
        const [width, height] = size.split('x').map(Number)
        return width >= 320 && width <= 7680 && height >= 240 && height <= 4320
      },
      "Dimensões devem estar entre 320x240 e 7680x4320"
    )
    .optional(),
  screenshotQuality: z.number()
    .min(10, "Qualidade mínima é 10")
    .max(100, "Qualidade máxima é 100")
    .optional(),
  enabled: z.boolean().optional()
})

// Validação de configurações de áudio
export const audioConfigValidationSchema = z.object({
  ttsEnabled: z.boolean().optional(),
  ttsSpeed: z.number()
    .min(0.1, "Velocidade mínima é 0.1")
    .max(3.0, "Velocidade máxima é 3.0")
    .optional(),
  soundEnabled: z.boolean().optional(),
  soundVolume: z.number()
    .min(0, "Volume mínimo é 0")
    .max(100, "Volume máximo é 100")
    .optional()
})

// Validação de configurações de modo personalizado
export const customModeValidationSchema = z.object({
  slug: z.string()
    .min(1, "Slug é obrigatório")
    .max(50, "Slug muito longo")
    .regex(/^[a-zA-Z0-9-]+$/, "Slug deve conter apenas letras, números e hífens"),
  name: z.string()
    .min(1, "Nome é obrigatório")
    .max(100, "Nome muito longo"),
  roleDefinition: z.string()
    .min(10, "Definição de papel deve ter pelo menos 10 caracteres")
    .max(5000, "Definição muito longa"),
  whenToUse: z.string()
    .max(1000, "Descrição muito longa")
    .optional(),
  customInstructions: z.string()
    .max(10000, "Instruções muito longas")
    .optional()
})

// Validação de upload de arquivo
export const fileUploadValidationSchema = z.object({
  file: z.instanceof(File, { message: "Deve ser um arquivo válido" }),
  maxSize: z.number()
    .min(1, "Tamanho máximo deve ser pelo menos 1 byte")
    .max(100 * 1024 * 1024, "Tamanho máximo é 100MB")
    .optional()
    .default(10 * 1024 * 1024), // 10MB default
  allowedTypes: z.array(z.string())
    .optional()
    .default(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'text/plain', 'application/json'])
}).refine(
  (data) => data.file.size <= data.maxSize,
  "Arquivo excede o tamanho máximo permitido"
).refine(
  (data) => data.allowedTypes.includes(data.file.type),
  "Tipo de arquivo não permitido"
)

/**
 * Funções utilitárias para validação de inputs
 */
export class InputValidator {
  /**
   * Valida input de chat antes de enviar
   */
  static validateChatInput(input: string): { isValid: boolean; error?: string } {
    try {
      chatInputValidationSchema.parse(input)
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          isValid: false, 
          error: error.errors[0]?.message || "Input inválido" 
        }
      }
      return { isValid: false, error: "Erro de validação" }
    }
  }

  /**
   * Valida configuração de API
   */
  static validateApiConfig(config: any): { isValid: boolean; errors?: string[] } {
    try {
      apiConfigValidationSchema.parse(config)
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          isValid: false, 
          errors: error.errors.map(e => e.message)
        }
      }
      return { isValid: false, errors: ["Erro de validação"] }
    }
  }

  /**
   * Sanitiza string removendo caracteres perigosos
   */
  static sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove < e >
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .replace(/\0/g, '') // Remove null bytes
      .trim()
  }

  /**
   * Valida se uma URL é segura
   */
  static isSecureUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      return parsed.protocol === 'https:' || parsed.protocol === 'http:'
    } catch {
      return false
    }
  }

  /**
   * Valida comando de terminal
   */
  static validateTerminalCommand(command: string): { isValid: boolean; error?: string } {
    try {
      terminalConfigValidationSchema.shape.command.parse(command)
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          isValid: false, 
          error: error.errors[0]?.message || "Comando inválido" 
        }
      }
      return { isValid: false, error: "Erro de validação" }
    }
  }

  /**
   * Valida arquivo antes do upload
   */
  static validateFileUpload(file: File, options?: { maxSize?: number; allowedTypes?: string[] }): { isValid: boolean; error?: string } {
    try {
      fileUploadValidationSchema.parse({
        file,
        maxSize: options?.maxSize,
        allowedTypes: options?.allowedTypes
      })
      return { isValid: true }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return { 
          isValid: false, 
          error: error.errors[0]?.message || "Arquivo inválido" 
        }
      }
      return { isValid: false, error: "Erro de validação" }
    }
  }
}

// Export dos tipos inferidos
export type ChatInputValidation = z.infer<typeof chatInputValidationSchema>
export type ApiConfigValidation = z.infer<typeof apiConfigValidationSchema>
export type FileSearchValidation = z.infer<typeof fileSearchValidationSchema>
export type TerminalConfigValidation = z.infer<typeof terminalConfigValidationSchema>
export type BrowserConfigValidation = z.infer<typeof browserConfigValidationSchema>
export type AudioConfigValidation = z.infer<typeof audioConfigValidationSchema>
export type CustomModeValidation = z.infer<typeof customModeValidationSchema>
export type FileUploadValidation = z.infer<typeof fileUploadValidationSchema>
