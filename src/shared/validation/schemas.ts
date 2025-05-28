import { z } from "zod"

/**
 * Common validation schemas for runtime validation across the application
 */

// Base types
export const nonEmptyStringSchema = z.string().min(1, "Campo não pode estar vazio")
export const urlSchema = z.string().url("URL deve ser válida")
export const emailSchema = z.string().email("Email deve ser válido")
export const positiveNumberSchema = z.number().positive("Número deve ser positivo")
export const nonNegativeNumberSchema = z.number().min(0, "Número não pode ser negativo")

// File and path validation
export const filePathSchema = z.string()
  .min(1, "Caminho do arquivo é obrigatório")
  .regex(/^[^<>:"|?*\x00-\x1f]*$/, "Caminho contém caracteres inválidos")
  .max(260, "Caminho muito longo (máximo 260 caracteres)")

export const fileNameSchema = z.string()
  .min(1, "Nome do arquivo é obrigatório")
  .regex(/^[^<>:"/\\|?*\x00-\x1f]*$/, "Nome do arquivo contém caracteres inválidos")
  .max(255, "Nome do arquivo muito longo")

// Command validation
export const commandSchema = z.string()
  .min(1, "Comando não pode estar vazio")
  .max(8192, "Comando muito longo")
  .refine(
    (cmd) => !cmd.includes("$(") && !cmd.includes("`"),
    "Comando não pode conter subshells"
  )

// Chat input validation
export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"], {
    errorMap: () => ({ message: "Role deve ser user, assistant ou system" })
  }),
  content: z.string()
    .min(1, "Conteúdo da mensagem não pode estar vazio")
    .max(100000, "Mensagem muito longa (máximo 100.000 caracteres)")
    .refine(
      (content) => content.trim().length > 0,
      "Mensagem não pode conter apenas espaços em branco"
    )
})

export const chatInputSchema = z.string()
  .min(1, "Input não pode estar vazio")
  .max(50000, "Input muito longo (máximo 50.000 caracteres)")
  .refine(
    (input) => input.trim().length > 0,
    "Input não pode conter apenas espaços em branco"
  )

// Search validation
export const searchQuerySchema = z.string()
  .min(1, "Query de busca não pode estar vazia")
  .max(1000, "Query de busca muito longa")
  .refine(
    (query) => query.trim().length > 0,
    "Query não pode conter apenas espaços em branco"
  )

// WebView message validation moved to webview-schemas.ts to avoid duplication

// Terminal operation validation
export const terminalOperationSchema = z.object({
  type: z.enum(["run", "kill", "clear"], {
    errorMap: () => ({ message: "Tipo de operação deve ser run, kill ou clear" })
  }),
  command: commandSchema.optional(),
  terminalId: z.string().optional(),
})

// API timeout validation
export const timeoutSchema = z.number()
  .min(1000, "Timeout deve ser pelo menos 1 segundo")
  .max(300000, "Timeout não pode exceder 5 minutos")

// Temperature validation for AI models
export const temperatureSchema = z.number()
  .min(0, "Temperature deve ser entre 0 e 1")
  .max(1, "Temperature deve ser entre 0 e 1")

// Model token validation
export const maxTokensSchema = z.number()
  .min(1, "Max tokens deve ser pelo menos 1")
  .max(1000000, "Max tokens muito alto")

// Request ID validation
export const requestIdSchema = z.string()
  .min(1, "Request ID é obrigatório")
  .max(100, "Request ID muito longo")
  .regex(/^[a-zA-Z0-9\-_]+$/, "Request ID deve conter apenas letras, números, hífens e underscores")

// Language validation
export const languageCodeSchema = z.string()
  .length(2, "Código de idioma deve ter 2 caracteres")
  .regex(/^[a-z]{2}$/, "Código de idioma deve conter apenas letras minúsculas")

// Validation for numeric settings
export const percentageSchema = z.number()
  .min(0, "Porcentagem deve ser entre 0 e 100")
  .max(100, "Porcentagem deve ser entre 0 e 100")

// Git commit validation
export const commitHashSchema = z.string()
  .min(7, "Hash do commit deve ter pelo menos 7 caracteres")
  .max(40, "Hash do commit não pode ter mais de 40 caracteres")
  .regex(/^[a-f0-9]+$/, "Hash do commit deve conter apenas caracteres hexadecimais")

// Browser viewport validation
export const viewportSizeSchema = z.string()
  .regex(/^\d+x\d+$/, "Tamanho do viewport deve estar no formato 'largura x altura' (ex: 1920x1080)")
  .refine(
    (size) => {
      const [width, height] = size.split('x').map(Number)
      return width >= 320 && width <= 7680 && height >= 240 && height <= 4320
    },
    "Dimensões do viewport devem estar entre 320x240 e 7680x4320"
  )

// Volume validation (0-100)
export const volumeSchema = z.number()
  .min(0, "Volume deve ser entre 0 e 100")
  .max(100, "Volume deve ser entre 0 e 100")

// Speed validation for TTS
export const speedSchema = z.number()
  .min(0.1, "Velocidade deve ser entre 0.1 e 3.0")
  .max(3.0, "Velocidade deve ser entre 0.1 e 3.0")

// Export type for all schemas
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type ChatInput = z.infer<typeof chatInputSchema>
export type SearchQuery = z.infer<typeof searchQuerySchema>
export type TerminalOperation = z.infer<typeof terminalOperationSchema>
