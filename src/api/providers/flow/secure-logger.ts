import winston from 'winston'
import { v4 as uuidv4 } from 'uuid'
import { dataSanitizer } from './data-sanitizer'

/**
 * Security-focused logger for Flow Provider
 * Implements structured logging with data masking and correlation IDs
 */

export interface LogContext {
  correlationId?: string
  operation?: string
  provider?: string
  model?: string
  [key: string]: any
}

export interface SecurityEvent {
  eventType: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'token_refresh_failure' | 'api_request' | 'api_response' |
             'credential_validation' | 'retry_success' | 'retry_exhausted' | 'retry_attempt'
  timestamp: number
  correlationId: string
  result: 'success' | 'failure' | 'pending'
  errorCode?: string
  metadata?: Record<string, any>
}

class SecureLogger {
  private logger: winston.Logger
  private readonly isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true'

    this.logger = winston.createLogger({
      level: this.isDevelopment ? 'debug' : 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, correlationId, ...meta }) => {
          const sanitizedMeta = this.sanitizeLogData(meta)
          return JSON.stringify({
            timestamp,
            level,
            message,
            correlationId,
            ...sanitizedMeta
          })
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    })
  }

  /**
   * Generate a new correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return uuidv4()
  }

  /**
   * Sanitize log data to remove sensitive information
   */
  private sanitizeLogData(data: any): any {
    if (!data || typeof data !== 'object') {
      return data
    }

    const sensitiveKeys = [
      'clientId', 'clientSecret', 'access_token', 'token', 'authorization',
      'password', 'secret', 'key', 'credential', 'bearer'
    ]

    const sanitized = { ...data }

    for (const [key, value] of Object.entries(sanitized)) {
      const lowerKey = key.toLowerCase()

      // Mask sensitive keys
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        if (typeof value === 'string') {
          sanitized[key] = this.maskString(value)
        } else {
          sanitized[key] = '[REDACTED]'
        }
      }

      // Recursively sanitize nested objects
      else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeLogData(value)
      }

      // Truncate long strings (potential data leaks)
      else if (typeof value === 'string' && value.length > 500) {
        sanitized[key] = value.substring(0, 500) + '...[TRUNCATED]'
      }
    }

    return sanitized
  }

  /**
   * Mask sensitive string data
   */
  private maskString(value: string): string {
    if (value.length <= 8) {
      return '*'.repeat(value.length)
    }
    return value.substring(0, 4) + '*'.repeat(value.length - 8) + value.substring(value.length - 4)
  }

  /**
   * Sanitize log context using advanced data sanitizer
   */
  private sanitizeContext(context: LogContext): LogContext {
    const sanitizationResult = dataSanitizer.sanitize(context)
    const sanitizedContext = sanitizationResult.sanitized

    // Add sanitization metadata in development mode
    if (this.isDevelopment && sanitizationResult.detectedPatterns.length > 0) {
      sanitizedContext._sanitization = {
        detectedPatterns: sanitizationResult.detectedPatterns,
        sanitizedFields: sanitizationResult.sanitizedFields,
        originalSize: sanitizationResult.originalSize,
        sanitizedSize: sanitizationResult.sanitizedSize
      }
    }

    return sanitizedContext
  }

  /**
   * Log authentication events
   */
  logAuth(event: string, context: LogContext = {}): void {
    const correlationId = context.correlationId ?? this.generateCorrelationId()

    const sanitizedContext = this.sanitizeContext({
      correlationId,
      category: 'authentication',
      ...context
    })

    this.logger.info(`[AUTH] ${event}`, sanitizedContext)
  }

  /**
   * Log API requests
   */
  logRequest(method: string, url: string, context: LogContext = {}): void {
    const correlationId = context.correlationId ?? this.generateCorrelationId()

    // Sanitize URL to remove potential sensitive query parameters
    const sanitizedUrl = this.sanitizeUrl(url)

    const sanitizedContext = this.sanitizeContext({
      correlationId,
      category: 'api_request',
      method,
      url: sanitizedUrl,
      ...context
    })

    this.logger.info(`[REQUEST] ${method} ${sanitizedUrl}`, sanitizedContext)
  }

  /**
   * Log API responses
   */
  logResponse(status: number, context: LogContext = {}): void {
    const level = status >= 400 ? 'error' : 'info'

    const sanitizedContext = this.sanitizeContext({
      category: 'api_response',
      status,
      ...context
    })

    this.logger.log(level, `[RESPONSE] ${status}`, sanitizedContext)
  }

  /**
   * Log security events for audit trail
   */
  logSecurityEvent(event: SecurityEvent): void {
    const sanitizedContext = this.sanitizeContext({
      category: 'security_event',
      ...event
    })

    this.logger.warn('[SECURITY]', sanitizedContext)
  }

  /**
   * Log errors with proper sanitization
   */
  logError(message: string, error?: Error, context: LogContext = {}): void {
    const sanitizedContext = this.sanitizeContext({
      category: 'error',
      error: error ? {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined
      } : undefined,
      ...context
    })

    this.logger.error(message, sanitizedContext)
  }

  /**
   * Debug logging (only in development)
   */
  logDebug(message: string, context: LogContext = {}): void {
    if (this.isDevelopment) {
      const sanitizedContext = this.sanitizeContext({
        category: 'debug',
        ...context
      })

      this.logger.debug(`[DEBUG] ${message}`, sanitizedContext)
    }
  }

  /**
   * Info logging for general information
   */
  logInfo(message: string, context: LogContext = {}): void {
    const sanitizedContext = this.sanitizeContext({
      category: 'info',
      ...context
    })

    this.logger.info(`[INFO] ${message}`, sanitizedContext)
  }

  /**
   * Create a child logger with persistent correlation ID
   */
  createChildLogger(correlationId: string): SecureLogger {
    const childLogger = new SecureLogger()

    // Override the logger to include the correlation ID by default
    const originalLogger = childLogger.logger
    childLogger.logger = {
      ...originalLogger,
      info: (message: string, meta?: any) => originalLogger.info(message, { correlationId, ...meta }),
      error: (message: string, meta?: any) => originalLogger.error(message, { correlationId, ...meta }),
      warn: (message: string, meta?: any) => originalLogger.warn(message, { correlationId, ...meta }),
      debug: (message: string, meta?: any) => originalLogger.debug(message, { correlationId, ...meta }),
      log: (level: string, message: string, meta?: any) => originalLogger.log(level, message, { correlationId, ...meta })
    } as any

    return childLogger
  }

  /**
   * Sanitize URLs to remove sensitive query parameters
   */
  private sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'credential']

      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]')
        }
      }

      return urlObj.toString()
    } catch {
      // If URL parsing fails, just return the original (might not be a full URL)
      return url
    }
  }


}

// Export singleton instance
export const secureLogger = new SecureLogger()

// Export class for testing
export { SecureLogger }
