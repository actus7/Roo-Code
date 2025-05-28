/**
 * Advanced Data Sanitization System
 * Comprehensive removal and masking of sensitive data from logs
 */

export interface SanitizationConfig {
  enableSanitization: boolean
  maskingChar: string
  preserveLength: boolean
  showFirstChars: number
  showLastChars: number
  customPatterns: SensitivePattern[]
  strictMode: boolean
}

export interface SensitivePattern {
  name: string
  pattern: RegExp
  replacement: string | ((match: string) => string)
  description: string
}

export interface SanitizationResult {
  sanitized: any
  detectedPatterns: string[]
  sanitizedFields: string[]
  originalSize: number
  sanitizedSize: number
}

class DataSanitizer {
  private config: SanitizationConfig
  private sensitivePatterns: SensitivePattern[]

  constructor(config: Partial<SanitizationConfig> = {}) {
    this.config = {
      enableSanitization: true,
      maskingChar: '*',
      preserveLength: true,
      showFirstChars: 4,
      showLastChars: 4,
      customPatterns: [],
      strictMode: true,
      ...config
    }

    this.initializeSensitivePatterns()
  }

  /**
   * Initialize comprehensive list of sensitive data patterns
   */
  private initializeSensitivePatterns(): void {
    this.sensitivePatterns = [
      // Authentication & Authorization
      {
        name: 'bearer_token',
        pattern: /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
        replacement: 'Bearer [REDACTED]',
        description: 'Bearer tokens'
      },
      {
        name: 'api_key',
        pattern: /(?:api[_-]?key|apikey|key)["\s]*[:=]["\s]*([a-zA-Z0-9\-._~+/]{16,})/gi,
        replacement: (match) => match.replace(/([a-zA-Z0-9\-._~+/]{16,})/, '[REDACTED]'),
        description: 'API keys'
      },
      {
        name: 'access_token',
        pattern: /(?:access[_-]?token|accesstoken)["\s]*[:=]["\s]*([a-zA-Z0-9\-._~+/]{16,})/gi,
        replacement: (match) => match.replace(/([a-zA-Z0-9\-._~+/]{16,})/, '[REDACTED]'),
        description: 'Access tokens'
      },
      {
        name: 'refresh_token',
        pattern: /(?:refresh[_-]?token|refreshtoken)["\s]*[:=]["\s]*([a-zA-Z0-9\-._~+/]{16,})/gi,
        replacement: (match) => match.replace(/([a-zA-Z0-9\-._~+/]{16,})/, '[REDACTED]'),
        description: 'Refresh tokens'
      },
      {
        name: 'client_secret',
        pattern: /(?:client[_-]?secret|clientsecret)["\s]*[:=]["\s]*([a-zA-Z0-9\-._~+/]{8,})/gi,
        replacement: (match) => match.replace(/([a-zA-Z0-9\-._~+/]{8,})/, '[REDACTED]'),
        description: 'Client secrets'
      },
      {
        name: 'password',
        pattern: /(?:password|passwd|pwd)["\s]*[:=]["\s]*([^\s"',}]{4,})/gi,
        replacement: (match) => match.replace(/([^\s"',}]{4,})/, '[REDACTED]'),
        description: 'Passwords'
      },

      // Personal Information
      {
        name: 'email',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        replacement: (match) => this.maskEmail(match),
        description: 'Email addresses'
      },
      {
        name: 'phone',
        pattern: /(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/g,
        replacement: '+1-XXX-XXX-XXXX',
        description: 'Phone numbers'
      },
      {
        name: 'ssn',
        pattern: /\b\d{3}-?\d{2}-?\d{4}\b/g,
        replacement: 'XXX-XX-XXXX',
        description: 'Social Security Numbers'
      },
      {
        name: 'credit_card',
        pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        replacement: 'XXXX-XXXX-XXXX-XXXX',
        description: 'Credit card numbers'
      },

      // Network & System Information
      {
        name: 'ipv4_private',
        pattern: /\b(?:10\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|172\.(?:1[6-9]|2[0-9]|3[01])\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)|192\.168\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))\b/g,
        replacement: (match) => this.config.strictMode ? 'XXX.XXX.XXX.XXX' : this.maskIP(match),
        description: 'Private IP addresses'
      },
      {
        name: 'mac_address',
        pattern: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g,
        replacement: 'XX:XX:XX:XX:XX:XX',
        description: 'MAC addresses'
      },

      // URLs with sensitive parameters
      {
        name: 'url_with_token',
        pattern: /https?:\/\/[^\s]*[?&](?:token|key|secret|password|credential)=[^&\s]*/gi,
        replacement: (match) => this.sanitizeURL(match),
        description: 'URLs with sensitive parameters'
      },

      // Database connection strings
      {
        name: 'connection_string',
        pattern: /(?:mongodb|mysql|postgresql|redis):\/\/[^\s]*/gi,
        replacement: (match) => this.sanitizeConnectionString(match),
        description: 'Database connection strings'
      },

      // JWT tokens
      {
        name: 'jwt_token',
        pattern: /eyJ[a-zA-Z0-9\-._~+/]+=*/g,
        replacement: 'eyJ[REDACTED]',
        description: 'JWT tokens'
      },

      // Custom patterns from config
      ...this.config.customPatterns
    ]
  }

  /**
   * Sanitize any data structure (object, array, string, etc.)
   */
  sanitize(data: any): SanitizationResult {
    if (!this.config.enableSanitization) {
      return {
        sanitized: data,
        detectedPatterns: [],
        sanitizedFields: [],
        originalSize: JSON.stringify(data).length,
        sanitizedSize: JSON.stringify(data).length
      }
    }

    const result: SanitizationResult = {
      sanitized: null,
      detectedPatterns: [],
      sanitizedFields: [],
      originalSize: 0,
      sanitizedSize: 0
    }

    try {
      const originalStr = JSON.stringify(data)
      result.originalSize = originalStr.length

      result.sanitized = this.sanitizeRecursive(data, '', result)
      
      const sanitizedStr = JSON.stringify(result.sanitized)
      result.sanitizedSize = sanitizedStr.length

      // Remove duplicates
      result.detectedPatterns = [...new Set(result.detectedPatterns)]
      result.sanitizedFields = [...new Set(result.sanitizedFields)]

    } catch (error) {
      // Fallback for non-serializable objects
      result.sanitized = '[SANITIZATION_ERROR]'
      result.sanitizedSize = result.sanitized.length
    }

    return result
  }

  /**
   * Recursively sanitize data structures
   */
  private sanitizeRecursive(data: any, path: string, result: SanitizationResult): any {
    if (data === null || data === undefined) {
      return data
    }

    if (typeof data === 'string') {
      return this.sanitizeString(data, path, result)
    }

    if (typeof data === 'number' || typeof data === 'boolean') {
      return data
    }

    if (Array.isArray(data)) {
      return data.map((item, index) => 
        this.sanitizeRecursive(item, `${path}[${index}]`, result)
      )
    }

    if (typeof data === 'object') {
      const sanitized: any = {}
      
      for (const [key, value] of Object.entries(data)) {
        const fieldPath = path ? `${path}.${key}` : key
        
        // Check if field name itself is sensitive
        if (this.isSensitiveFieldName(key)) {
          sanitized[key] = this.maskValue(value)
          result.sanitizedFields.push(fieldPath)
        } else {
          sanitized[key] = this.sanitizeRecursive(value, fieldPath, result)
        }
      }
      
      return sanitized
    }

    return data
  }

  /**
   * Sanitize string content using all patterns
   */
  private sanitizeString(str: string, path: string, result: SanitizationResult): string {
    let sanitized = str

    for (const pattern of this.sensitivePatterns) {
      const matches = str.match(pattern.pattern)
      if (matches) {
        result.detectedPatterns.push(pattern.name)
        if (path) {
          result.sanitizedFields.push(path)
        }

        if (typeof pattern.replacement === 'function') {
          sanitized = sanitized.replace(pattern.pattern, pattern.replacement)
        } else {
          sanitized = sanitized.replace(pattern.pattern, pattern.replacement)
        }
      }
    }

    return sanitized
  }

  /**
   * Check if field name indicates sensitive data
   */
  private isSensitiveFieldName(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'passwd', 'pwd', 'secret', 'token', 'key', 'credential',
      'authorization', 'auth', 'bearer', 'apikey', 'api_key', 'access_token',
      'refresh_token', 'client_secret', 'private_key', 'session_id', 'cookie',
      'ssn', 'social_security', 'credit_card', 'card_number', 'cvv', 'pin'
    ]

    const lowerField = fieldName.toLowerCase()
    return sensitiveFields.some(sensitive => 
      lowerField.includes(sensitive) || sensitive.includes(lowerField)
    )
  }

  /**
   * Mask a value based on its type and length
   */
  private maskValue(value: any): any {
    if (typeof value === 'string') {
      return this.maskString(value)
    }
    
    if (typeof value === 'number') {
      return '[REDACTED_NUMBER]'
    }
    
    if (typeof value === 'object') {
      return '[REDACTED_OBJECT]'
    }
    
    return '[REDACTED]'
  }

  /**
   * Mask string with configurable options
   */
  private maskString(str: string): string {
    if (!str || str.length === 0) return str

    const { maskingChar, preserveLength, showFirstChars, showLastChars } = this.config

    if (str.length <= (showFirstChars + showLastChars)) {
      return preserveLength ? maskingChar.repeat(str.length) : '[REDACTED]'
    }

    if (preserveLength) {
      const first = str.substring(0, showFirstChars)
      const last = str.substring(str.length - showLastChars)
      const middle = maskingChar.repeat(str.length - showFirstChars - showLastChars)
      return first + middle + last
    }

    return '[REDACTED]'
  }

  /**
   * Mask email addresses
   */
  private maskEmail(email: string): string {
    const [local, domain] = email.split('@')
    if (!domain) return '[REDACTED_EMAIL]'

    const maskedLocal = local.length > 2 
      ? local[0] + '*'.repeat(local.length - 2) + local[local.length - 1]
      : '*'.repeat(local.length)

    return `${maskedLocal}@${domain}`
  }

  /**
   * Mask IP addresses
   */
  private maskIP(ip: string): string {
    const parts = ip.split('.')
    if (parts.length !== 4) return 'XXX.XXX.XXX.XXX'
    
    return `${parts[0]}.XXX.XXX.${parts[3]}`
  }

  /**
   * Sanitize URLs with sensitive parameters
   */
  private sanitizeURL(url: string): string {
    try {
      const urlObj = new URL(url)
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'credential', 'auth']
      
      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]')
        }
      }
      
      return urlObj.toString()
    } catch {
      return '[REDACTED_URL]'
    }
  }

  /**
   * Sanitize database connection strings
   */
  private sanitizeConnectionString(connectionString: string): string {
    return connectionString.replace(
      /:\/\/([^:]+):([^@]+)@/,
      '://[REDACTED]:[REDACTED]@'
    )
  }

  /**
   * Add custom sensitive pattern
   */
  addCustomPattern(pattern: SensitivePattern): void {
    this.sensitivePatterns.push(pattern)
  }

  /**
   * Get sanitization statistics
   */
  getStats(): {
    totalPatterns: number
    enabledPatterns: string[]
    config: SanitizationConfig
  } {
    return {
      totalPatterns: this.sensitivePatterns.length,
      enabledPatterns: this.sensitivePatterns.map(p => p.name),
      config: this.config
    }
  }
}

// Export singleton instance with default configuration
export const dataSanitizer = new DataSanitizer()

// Export class for custom configurations
export { DataSanitizer }
