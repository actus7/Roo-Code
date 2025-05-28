import { z } from "zod"
import { ValidationPipeline, ValidationResult } from "../../shared/validation/validator"

/**
 * Schema de validação para comandos de terminal
 */
export const terminalCommandSchema = z.string()
  .min(1, "Comando não pode estar vazio")
  .max(8192, "Comando muito longo (máximo 8192 caracteres)")
  .refine(
    (cmd) => cmd.trim().length > 0,
    "Comando não pode conter apenas espaços em branco"
  )

/**
 * Schema para validação de segurança de comandos
 */
export const secureCommandSchema = terminalCommandSchema
  .refine(
    (cmd) => !cmd.includes("$(") && !cmd.includes("`"),
    "Comando não pode conter subshells por segurança"
  )
  .refine(
    (cmd) => !cmd.toLowerCase().includes("rm -rf /"),
    "Comando 'rm -rf /' não é permitido"
  )
  .refine(
    (cmd) => !cmd.toLowerCase().includes("format c:"),
    "Comando 'format' não é permitido"
  )
  .refine(
    (cmd) => !cmd.toLowerCase().includes("del /f /s /q"),
    "Comando de exclusão recursiva não é permitido"
  )

/**
 * Lista de comandos perigosos que devem ser bloqueados
 */
const DANGEROUS_COMMANDS = [
  'rm -rf /',
  'rm -rf *',
  'format c:',
  'del /f /s /q',
  'dd if=/dev/zero',
  'mkfs.',
  'fdisk',
  'parted',
  'shutdown',
  'reboot',
  'halt',
  'poweroff',
  'init 0',
  'init 6',
  'killall',
  'pkill -9',
  'chmod 777 /',
  'chown -R',
  'passwd',
  'su -',
  'sudo su',
  'curl | sh',
  'wget | sh',
  'eval',
  'exec',
  '> /dev/sda',
  '> /dev/hda'
]

/**
 * Lista de padrões perigosos usando regex
 */
const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//, // rm -rf /
  /rm\s+-rf\s+\*/, // rm -rf *
  />\s*\/dev\/[sh]d[a-z]/, // redirecionamento para dispositivos
  /curl\s+.*\|\s*sh/, // curl | sh
  /wget\s+.*\|\s*sh/, // wget | sh
  /\$\(.*\)/, // command substitution
  /`.*`/, // backtick command substitution
  /;\s*rm\s+-rf/, // ; rm -rf
  /&&\s*rm\s+-rf/, // && rm -rf
  /\|\s*rm\s+-rf/, // | rm -rf
]

/**
 * Validador de comandos de terminal com verificações de segurança
 */
export class TerminalCommandValidator {
  /**
   * Valida um comando básico
   */
  static validateBasic(command: string): ValidationResult<string> {
    return ValidationPipeline.validate(terminalCommandSchema, command, {
      context: 'terminal_command_basic'
    })
  }

  /**
   * Valida um comando com verificações de segurança
   */
  static validateSecure(command: string): ValidationResult<string> {
    // Primeiro faz a validação básica
    const basicValidation = this.validateBasic(command)
    if (!basicValidation.success) {
      return basicValidation
    }

    // Depois faz as verificações de segurança
    return ValidationPipeline.validate(secureCommandSchema, command, {
      context: 'terminal_command_secure'
    })
  }

  /**
   * Valida comando com verificações avançadas de segurança
   */
  static validateAdvanced(command: string, allowedCommands?: string[]): ValidationResult<string> {
    // Validação básica e de segurança
    const secureValidation = this.validateSecure(command)
    if (!secureValidation.success) {
      return secureValidation
    }

    const normalizedCommand = command.toLowerCase().trim()

    // Verifica comandos explicitamente perigosos
    for (const dangerousCmd of DANGEROUS_COMMANDS) {
      if (normalizedCommand.includes(dangerousCmd.toLowerCase())) {
        return {
          success: false,
          errors: [{
            field: 'command',
            message: `Comando perigoso detectado: ${dangerousCmd}`,
            code: 'DANGEROUS_COMMAND'
          }]
        }
      }
    }

    // Verifica padrões perigosos
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(normalizedCommand)) {
        return {
          success: false,
          errors: [{
            field: 'command',
            message: `Padrão perigoso detectado no comando`,
            code: 'DANGEROUS_PATTERN'
          }]
        }
      }
    }

    // Se há lista de comandos permitidos, verifica se o comando está na lista
    if (allowedCommands && allowedCommands.length > 0) {
      const isAllowed = this.isCommandAllowed(command, allowedCommands)
      if (!isAllowed) {
        return {
          success: false,
          errors: [{
            field: 'command',
            message: 'Comando não está na lista de comandos permitidos',
            code: 'COMMAND_NOT_ALLOWED'
          }]
        }
      }
    }

    return {
      success: true,
      data: command
    }
  }

  /**
   * Verifica se um comando está na lista de comandos permitidos
   */
  private static isCommandAllowed(command: string, allowedCommands: string[]): boolean {
    // Se '*' está na lista, todos os comandos são permitidos
    if (allowedCommands.includes('*')) {
      return true
    }

    const commandParts = command.trim().split(/\s+/)
    const baseCommand = commandParts[0]

    // Verifica se o comando base está na lista de permitidos
    return allowedCommands.some(allowed => {
      // Permite correspondência exata
      if (allowed === baseCommand) {
        return true
      }
      
      // Permite correspondência por prefixo (ex: "git" permite "git status", "git commit", etc.)
      if (command.startsWith(allowed + ' ') || command === allowed) {
        return true
      }

      return false
    })
  }

  /**
   * Sanitiza um comando removendo caracteres perigosos
   */
  static sanitizeCommand(command: string): string {
    return command
      .replace(/[;&|`$()]/g, '') // Remove caracteres de controle
      .replace(/\s+/g, ' ') // Normaliza espaços
      .trim()
  }

  /**
   * Analisa um comando e retorna informações sobre ele
   */
  static analyzeCommand(command: string): {
    baseCommand: string
    arguments: string[]
    hasRedirection: boolean
    hasPipes: boolean
    hasSubshells: boolean
    riskLevel: 'low' | 'medium' | 'high'
  } {
    const trimmedCommand = command.trim()
    const parts = trimmedCommand.split(/\s+/)
    const baseCommand = parts[0] || ''
    const args = parts.slice(1)

    const hasRedirection = /[<>]/.test(trimmedCommand)
    const hasPipes = /\|/.test(trimmedCommand)
    const hasSubshells = /\$\(|\`/.test(trimmedCommand)

    // Determina o nível de risco
    let riskLevel: 'low' | 'medium' | 'high' = 'low'

    if (hasSubshells || DANGEROUS_COMMANDS.some(cmd => 
      trimmedCommand.toLowerCase().includes(cmd.toLowerCase())
    )) {
      riskLevel = 'high'
    } else if (hasRedirection || hasPipes || ['sudo', 'su', 'chmod', 'chown'].includes(baseCommand)) {
      riskLevel = 'medium'
    }

    return {
      baseCommand,
      arguments: args,
      hasRedirection,
      hasPipes,
      hasSubshells,
      riskLevel
    }
  }

  /**
   * Valida múltiplos comandos (para scripts)
   */
  static validateMultipleCommands(
    commands: string[], 
    allowedCommands?: string[]
  ): ValidationResult<string[]> {
    const validatedCommands: string[] = []
    const errors: any[] = []

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i]
      const validation = this.validateAdvanced(command, allowedCommands)
      
      if (validation.success) {
        validatedCommands.push(validation.data!)
      } else {
        errors.push(...(validation.errors || []).map(error => ({
          ...error,
          field: `command[${i}].${error.field}`
        })))
      }
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? validatedCommands : undefined,
      errors: errors.length > 0 ? errors : undefined
    }
  }
}

/**
 * Configuração padrão para validação de comandos
 */
export const DEFAULT_COMMAND_VALIDATION_CONFIG = {
  maxLength: 8192,
  allowSubshells: false,
  allowDangerousCommands: false,
  defaultAllowedCommands: [
    'ls', 'dir', 'pwd', 'cd', 'cat', 'type', 'echo', 'grep', 'find', 'which', 'where',
    'git', 'npm', 'yarn', 'pnpm', 'node', 'python', 'pip', 'cargo', 'go', 'java', 'javac',
    'gcc', 'make', 'cmake', 'docker', 'kubectl', 'helm', 'terraform', 'ansible',
    'curl', 'wget', 'ping', 'telnet', 'ssh', 'scp', 'rsync',
    'ps', 'top', 'htop', 'kill', 'jobs', 'nohup',
    'tar', 'zip', 'unzip', 'gzip', 'gunzip',
    'head', 'tail', 'less', 'more', 'wc', 'sort', 'uniq', 'cut', 'awk', 'sed'
  ]
}

// Export dos tipos
export type TerminalCommand = z.infer<typeof terminalCommandSchema>
export type SecureCommand = z.infer<typeof secureCommandSchema>
