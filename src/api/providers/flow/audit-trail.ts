import { secureLogger, SecurityEvent } from './secure-logger'

/**
 * Enhanced Security Audit Trail System
 * Provides comprehensive logging and tracking of security events
 */

export interface AuditEvent extends SecurityEvent {
  sessionId?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  location?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'authentication' | 'authorization' | 'data_access' | 'configuration' | 'system' | 'resilience'
  source: 'flow_provider' | 'token_manager' | 'api_handler' | 'user_action' | 'enhanced_retry'
  details?: Record<string, any>
}

export interface AuditTrailConfig {
  enableFileLogging?: boolean
  logFilePath?: string
  enableRemoteLogging?: boolean
  remoteEndpoint?: string
  retentionDays?: number
  enableRealTimeAlerts?: boolean
  alertThresholds?: {
    failedAuthAttempts: number
    timeWindowMinutes: number
  }
}

class SecurityAuditTrail {
  private config: AuditTrailConfig
  private eventBuffer: AuditEvent[] = []
  private failedAuthAttempts: Map<string, { count: number; firstAttempt: number }> = new Map()

  constructor(config: AuditTrailConfig = {}) {
    this.config = {
      enableFileLogging: true,
      logFilePath: './logs/security-audit.log',
      enableRemoteLogging: false,
      retentionDays: 90,
      enableRealTimeAlerts: true,
      alertThresholds: {
        failedAuthAttempts: 5,
        timeWindowMinutes: 15
      },
      ...config
    }
  }

  /**
   * Log a security event to the audit trail
   */
  async logSecurityEvent(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      ...event,
      timestamp: Date.now()
    }

    // Add to buffer for batch processing
    this.eventBuffer.push(auditEvent)

    // Log immediately to secure logger
    secureLogger.logSecurityEvent({
      eventType: event.eventType,
      timestamp: auditEvent.timestamp,
      correlationId: event.correlationId,
      result: event.result,
      errorCode: event.errorCode,
      metadata: {
        severity: event.severity,
        category: event.category,
        source: event.source,
        sessionId: event.sessionId,
        userId: event.userId,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        location: event.location,
        details: event.details
      }
    })

    // Check for security patterns
    await this.analyzeSecurityPatterns(auditEvent)

    // Process buffer if it's getting full
    if (this.eventBuffer.length >= 100) {
      await this.flushEventBuffer()
    }
  }

  /**
   * Log authentication events with enhanced tracking
   */
  async logAuthenticationEvent(
    eventType: 'auth_attempt' | 'auth_success' | 'auth_failure' | 'token_refresh' | 'token_refresh_failure',
    correlationId: string,
    result: 'success' | 'failure' | 'pending',
    metadata: {
      clientId?: string
      userId?: string
      ipAddress?: string
      userAgent?: string
      errorCode?: string
      sessionId?: string
      refreshDuration?: number
      attempt?: number
      consecutiveFailures?: number
      errorMessage?: string
    } = {}
  ): Promise<void> {
    const severity = this.determineSeverity(eventType, result)

    await this.logSecurityEvent({
      eventType,
      correlationId,
      result,
      severity,
      category: 'authentication',
      source: 'flow_provider',
      errorCode: metadata.errorCode,
      sessionId: metadata.sessionId,
      userId: metadata.userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        clientId: metadata.clientId ? this.maskSensitiveData(metadata.clientId) : undefined
      }
    })

    // Track failed authentication attempts
    if (eventType === 'auth_failure' && metadata.ipAddress) {
      await this.trackFailedAuthAttempt(metadata.ipAddress, correlationId)
    }
  }

  /**
   * Log API access events
   */
  async logApiAccessEvent(
    method: string,
    endpoint: string,
    correlationId: string,
    result: 'success' | 'failure',
    metadata: {
      statusCode?: number
      responseTime?: number
      userId?: string
      ipAddress?: string
      userAgent?: string
      sessionId?: string
    } = {}
  ): Promise<void> {
    const severity = metadata.statusCode && metadata.statusCode >= 400 ? 'medium' : 'low'

    await this.logSecurityEvent({
      eventType: 'api_request',
      correlationId,
      result,
      severity,
      category: 'data_access',
      source: 'api_handler',
      sessionId: metadata.sessionId,
      userId: metadata.userId,
      ipAddress: metadata.ipAddress,
      userAgent: metadata.userAgent,
      details: {
        method,
        endpoint: this.sanitizeEndpoint(endpoint),
        statusCode: metadata.statusCode,
        responseTime: metadata.responseTime
      }
    })
  }

  /**
   * Log configuration changes
   */
  async logConfigurationEvent(
    action: string,
    correlationId: string,
    metadata: {
      configKey?: string
      oldValue?: any
      newValue?: any
      userId?: string
      sessionId?: string
    } = {}
  ): Promise<void> {
    await this.logSecurityEvent({
      eventType: 'auth_attempt', // Using existing type, could be extended
      correlationId,
      result: 'success',
      severity: 'medium',
      category: 'configuration',
      source: 'user_action',
      sessionId: metadata.sessionId,
      userId: metadata.userId,
      details: {
        action,
        configKey: metadata.configKey,
        oldValue: this.maskSensitiveData(metadata.oldValue),
        newValue: this.maskSensitiveData(metadata.newValue)
      }
    })
  }

  /**
   * Analyze security patterns and trigger alerts
   */
  private async analyzeSecurityPatterns(event: AuditEvent): Promise<void> {
    if (!this.config.enableRealTimeAlerts) return

    // Check for suspicious patterns
    if (event.category === 'authentication' && event.result === 'failure') {
      await this.checkBruteForcePattern(event)
    }

    // Check for high severity events
    if (event.severity === 'critical') {
      await this.triggerCriticalAlert(event)
    }
  }

  /**
   * Track failed authentication attempts for brute force detection
   */
  private async trackFailedAuthAttempt(ipAddress: string, correlationId: string): Promise<void> {
    const now = Date.now()
    const windowMs = (this.config.alertThresholds?.timeWindowMinutes || 15) * 60 * 1000

    const existing = this.failedAuthAttempts.get(ipAddress)

    if (existing && (now - existing.firstAttempt) < windowMs) {
      existing.count++

      if (existing.count >= (this.config.alertThresholds?.failedAuthAttempts || 5)) {
        await this.triggerBruteForceAlert(ipAddress, existing.count, correlationId)
        this.failedAuthAttempts.delete(ipAddress) // Reset after alert
      }
    } else {
      this.failedAuthAttempts.set(ipAddress, { count: 1, firstAttempt: now })
    }

    // Clean up old entries
    for (const [ip, data] of this.failedAuthAttempts.entries()) {
      if ((now - data.firstAttempt) > windowMs) {
        this.failedAuthAttempts.delete(ip)
      }
    }
  }

  /**
   * Check for brute force attack patterns
   */
  private async checkBruteForcePattern(event: AuditEvent): Promise<void> {
    // Implementation would check for rapid failed attempts
    secureLogger.logDebug('Checking brute force pattern', {
      correlationId: event.correlationId,
      ipAddress: event.ipAddress,
      category: 'security_analysis'
    })
  }

  /**
   * Trigger critical security alert
   */
  private async triggerCriticalAlert(event: AuditEvent): Promise<void> {
    secureLogger.logError('CRITICAL SECURITY EVENT DETECTED', undefined, {
      correlationId: event.correlationId,
      category: 'critical_alert',
      eventType: event.eventType,
      severity: event.severity,
      source: event.source
    })
  }

  /**
   * Trigger brute force attack alert
   */
  private async triggerBruteForceAlert(ipAddress: string, attemptCount: number, correlationId: string): Promise<void> {
    secureLogger.logError('POTENTIAL BRUTE FORCE ATTACK DETECTED', undefined, {
      correlationId,
      category: 'brute_force_alert',
      ipAddress,
      attemptCount,
      severity: 'high'
    })
  }

  /**
   * Determine event severity based on type and result
   */
  private determineSeverity(eventType: string, result: string): AuditEvent['severity'] {
    if (result === 'failure') {
      switch (eventType) {
        case 'auth_failure':
          return 'medium'
        default:
          return 'low'
      }
    }
    return 'low'
  }

  /**
   * Mask sensitive data in logs
   */
  private maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      if (data.length <= 8) return '*'.repeat(data.length)
      return data.substring(0, 4) + '*'.repeat(data.length - 8) + data.substring(data.length - 4)
    }
    return data
  }

  /**
   * Sanitize endpoint URLs to remove sensitive parameters
   */
  private sanitizeEndpoint(endpoint: string): string {
    try {
      const url = new URL(endpoint)
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'credential']

      for (const param of sensitiveParams) {
        if (url.searchParams.has(param)) {
          url.searchParams.set(param, '[REDACTED]')
        }
      }

      return url.toString()
    } catch {
      return endpoint
    }
  }

  /**
   * Flush event buffer to persistent storage
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    secureLogger.logDebug('Flushing audit event buffer', {
      category: 'audit_trail',
      eventCount: this.eventBuffer.length
    })

    // In a real implementation, this would write to file or send to remote service
    this.eventBuffer = []
  }

  /**
   * Get audit trail statistics
   */
  getAuditStats(): {
    totalEvents: number
    failedAuthAttempts: number
    criticalEvents: number
  } {
    return {
      totalEvents: this.eventBuffer.length,
      failedAuthAttempts: this.failedAuthAttempts.size,
      criticalEvents: this.eventBuffer.filter(e => e.severity === 'critical').length
    }
  }
}

// Export singleton instance
export const securityAuditTrail = new SecurityAuditTrail()

// Export class for testing and custom configurations
export { SecurityAuditTrail }
