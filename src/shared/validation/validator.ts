import { z, ZodError, ZodSchema } from "zod"

/**
 * Resultado da validação
 */
export interface ValidationResult<T = any> {
  success: boolean
  data?: T
  errors?: ValidationError[]
}

/**
 * Erro de validação estruturado
 */
export interface ValidationError {
  field: string
  message: string
  code: string
  value?: any
}

/**
 * Opções para validação
 */
export interface ValidationOptions {
  /** Se deve fazer parsing dos dados ou apenas validar */
  parseData?: boolean
  /** Se deve incluir o valor que causou erro no resultado */
  includeErrorValue?: boolean
  /** Contexto adicional para logging */
  context?: string
}

/**
 * Pipeline de validação type-safe usando Zod
 */
export class ValidationPipeline {
  /**
   * Valida dados usando um schema Zod
   */
  static validate<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    const { parseData = true, includeErrorValue = false, context } = options

    try {
      const result = parseData ? schema.parse(data) : schema.safeParse(data)

      if (parseData) {
        return {
          success: true,
          data: result as T
        }
      } else {
        const safeResult = result as z.SafeParseReturnType<unknown, T>
        if (safeResult.success) {
          return {
            success: true,
            data: safeResult.data
          }
        } else {
          return {
            success: false,
            errors: this.formatZodErrors(safeResult.error, includeErrorValue)
          }
        }
      }
    } catch (error) {
      if (error instanceof ZodError) {
        return {
          success: false,
          errors: this.formatZodErrors(error, includeErrorValue)
        }
      }

      // Erro inesperado
      return {
        success: false,
        errors: [{
          name: 'ValidationError',
          field: 'unknown',
          message: error instanceof Error ? error.message : 'Erro de validação desconhecido',
          code: 'UNKNOWN_ERROR',
          value: includeErrorValue ? data : undefined
        }]
      }
    }
  }

  /**
   * Valida dados de forma assíncrona
   */
  static async validateAsync<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): Promise<ValidationResult<T>> {
    return this.validate(schema, data, options)
  }

  /**
   * Valida múltiplos campos usando diferentes schemas
   */
  static validateMultiple(
    validations: Array<{
      schema: ZodSchema<any>
      data: unknown
      field: string
    }>,
    options: ValidationOptions = {}
  ): ValidationResult<Record<string, any>> {
    const results: Record<string, any> = {}
    const errors: ValidationError[] = []

    for (const { schema, data, field } of validations) {
      const result = this.validate(schema, data, options)

      if (result.success) {
        results[field] = result.data
      } else {
        errors.push(...(result.errors || []).map(error => ({
          ...error,
          field: `${field}.${error.field}`
        })))
      }
    }

    return {
      success: errors.length === 0,
      data: errors.length === 0 ? results : undefined,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  /**
   * Sanitiza dados removendo campos não permitidos
   */
  static sanitize<T>(
    schema: ZodSchema<T>,
    data: unknown,
    options: ValidationOptions = {}
  ): ValidationResult<T> {
    // Primeiro valida os dados
    const validation = this.validate(schema, data, options)

    if (!validation.success) {
      return validation
    }

    // Se a validação passou, os dados já estão sanitizados pelo Zod
    return validation
  }

  /**
   * Formata erros do Zod para o formato padronizado
   */
  private static formatZodErrors(error: ZodError, includeValue: boolean = false): ValidationError[] {
    return error.errors.map(issue => ({
      name: 'ValidationError',
      field: issue.path.join('.') || 'root',
      message: issue.message,
      code: issue.code,
      value: includeValue ? (issue as any).received : undefined
    }))
  }

  /**
   * Cria um validador reutilizável para um schema específico
   */
  static createValidator<T>(schema: ZodSchema<T>, defaultOptions: ValidationOptions = {}) {
    return (data: unknown, options: ValidationOptions = {}) => {
      return this.validate(schema, data, { ...defaultOptions, ...options })
    }
  }

  /**
   * Valida e transforma dados em uma única operação
   */
  static validateAndTransform<T, R>(
    schema: ZodSchema<T>,
    data: unknown,
    transformer: (validData: T) => R,
    options: ValidationOptions = {}
  ): ValidationResult<R> {
    const validation = this.validate(schema, data, options)

    if (!validation.success) {
      return {
        success: false,
        errors: validation.errors
      }
    }

    try {
      const transformed = transformer(validation.data!)
      return {
        success: true,
        data: transformed
      }
    } catch (error) {
      return {
        success: false,
        errors: [{
          name: 'ValidationError',
          field: 'transformation',
          message: error instanceof Error ? error.message : 'Erro na transformação dos dados',
          code: 'TRANSFORMATION_ERROR'
        }]
      }
    }
  }
}

/**
 * Decorador para validação automática de métodos
 */
export function ValidateInput<T>(schema: ZodSchema<T>, options: ValidationOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = function (...args: any[]) {
      // Assume que o primeiro argumento é o que precisa ser validado
      const [inputData, ...restArgs] = args

      const validation = ValidationPipeline.validate(schema, inputData, options)

      if (!validation.success) {
        throw new ValidationError(`Validation failed for ${propertyKey}: ${
          validation.errors?.map(e => e.message).join(', ')
        }`)
      }

      return originalMethod.apply(this, [validation.data, ...restArgs])
    }

    return descriptor
  }
}

/**
 * Classe de erro personalizada para validação
 */
export class ValidationError extends Error {
  constructor(message: string, public validationErrors?: ValidationError[]) {
    super(message)
    this.name = 'ValidationError'
  }
}

/**
 * Utilitários para validação comum
 */
export const ValidationUtils = {
  /**
   * Verifica se um valor é uma string não vazia
   */
  isNonEmptyString: (value: unknown): value is string => {
    return typeof value === 'string' && value.trim().length > 0
  },

  /**
   * Verifica se um valor é um número válido
   */
  isValidNumber: (value: unknown): value is number => {
    return typeof value === 'number' && !isNaN(value) && isFinite(value)
  },

  /**
   * Verifica se um valor é uma URL válida
   */
  isValidUrl: (value: unknown): boolean => {
    if (typeof value !== 'string') return false
    try {
      new URL(value)
      return true
    } catch {
      return false
    }
  },

  /**
   * Sanitiza uma string removendo caracteres perigosos
   */
  sanitizeString: (value: string): string => {
    return value
      .replace(/[<>]/g, '') // Remove < e >
      .replace(/javascript:/gi, '') // Remove javascript:
      .replace(/on\w+=/gi, '') // Remove event handlers
      .trim()
  }
}
