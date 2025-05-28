/**
 * Logging System Monitoring and Performance Metrics
 * Provides real-time monitoring, health checks, and performance analytics
 */

import { secureLogger } from './secure-logger'
import { securityAuditTrail } from './audit-trail'
import { dataSanitizer } from './data-sanitizer'

export interface LoggingMetrics {
  totalLogs: number
  logsByLevel: Record<string, number>
  logsByCategory: Record<string, number>
  sanitizationStats: {
    totalSanitized: number
    patternsDetected: Record<string, number>
    averageSanitizationTime: number
  }
  auditTrailStats: {
    totalEvents: number
    criticalEvents: number
    failedAuthAttempts: number
    bruteForceAlerts: number
  }
  performance: {
    averageLogTime: number
    peakLogTime: number
    logsPerSecond: number
    memoryUsage: number
  }
  errors: {
    totalErrors: number
    recentErrors: Array<{
      timestamp: number
      error: string
      correlationId: string
    }>
  }
  healthStatus: 'healthy' | 'warning' | 'critical'
  uptime: number
  lastHealthCheck: number
}

export interface HealthCheckResult {
  status: 'healthy' | 'warning' | 'critical'
  checks: Array<{
    name: string
    status: 'pass' | 'fail' | 'warning'
    message: string
    responseTime?: number
  }>
  timestamp: number
  correlationId: string
}

class LoggingMonitor {
  private metrics: LoggingMetrics
  private startTime: number
  private logTimes: number[] = []
  private recentErrors: Array<{ timestamp: number; error: string; correlationId: string }> = []
  private isMonitoring: boolean = false
  private monitoringInterval?: NodeJS.Timeout

  constructor() {
    this.startTime = Date.now()
    this.metrics = this.initializeMetrics()
  }

  /**
   * Initialize metrics structure
   */
  private initializeMetrics(): LoggingMetrics {
    return {
      totalLogs: 0,
      logsByLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0
      },
      logsByCategory: {
        authentication: 0,
        api_request: 0,
        api_response: 0,
        security_event: 0,
        error: 0,
        debug: 0
      },
      sanitizationStats: {
        totalSanitized: 0,
        patternsDetected: {},
        averageSanitizationTime: 0
      },
      auditTrailStats: {
        totalEvents: 0,
        criticalEvents: 0,
        failedAuthAttempts: 0,
        bruteForceAlerts: 0
      },
      performance: {
        averageLogTime: 0,
        peakLogTime: 0,
        logsPerSecond: 0,
        memoryUsage: 0
      },
      errors: {
        totalErrors: 0,
        recentErrors: []
      },
      healthStatus: 'healthy',
      uptime: 0,
      lastHealthCheck: Date.now()
    }
  }

  /**
   * Start monitoring the logging system
   */
  startMonitoring(intervalMs: number = 30000): void {
    if (this.isMonitoring) {
      secureLogger.logDebug('Monitoring already started', {
        correlationId: secureLogger.generateCorrelationId()
      })
      return
    }

    this.isMonitoring = true
    
    secureLogger.logAuth('Logging monitoring started', {
      correlationId: secureLogger.generateCorrelationId(),
      intervalMs,
      startTime: this.startTime
    })

    this.monitoringInterval = setInterval(() => {
      this.updateMetrics()
      this.performHealthCheck()
    }, intervalMs)
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return

    this.isMonitoring = false
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
      this.monitoringInterval = undefined
    }

    secureLogger.logAuth('Logging monitoring stopped', {
      correlationId: secureLogger.generateCorrelationId(),
      uptime: Date.now() - this.startTime
    })
  }

  /**
   * Update metrics from various logging components
   */
  private updateMetrics(): void {
    try {
      // Update uptime
      this.metrics.uptime = Date.now() - this.startTime

      // Update memory usage
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage()
        this.metrics.performance.memoryUsage = memUsage.heapUsed / 1024 / 1024 // MB
      }

      // Update audit trail stats
      const auditStats = securityAuditTrail.getAuditStats()
      this.metrics.auditTrailStats = {
        totalEvents: auditStats.totalEvents,
        criticalEvents: auditStats.criticalEvents,
        failedAuthAttempts: auditStats.failedAuthAttempts,
        bruteForceAlerts: 0 // Would be tracked separately in a real implementation
      }

      // Update sanitization stats
      const sanitizerStats = dataSanitizer.getStats()
      this.metrics.sanitizationStats.patternsDetected = sanitizerStats.enabledPatterns.reduce((acc, pattern) => {
        acc[pattern] = (acc[pattern] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      // Calculate performance metrics
      if (this.logTimes.length > 0) {
        this.metrics.performance.averageLogTime = 
          this.logTimes.reduce((sum, time) => sum + time, 0) / this.logTimes.length
        this.metrics.performance.peakLogTime = Math.max(...this.logTimes)
        
        // Calculate logs per second (last minute)
        const oneMinuteAgo = Date.now() - 60000
        const recentLogs = this.logTimes.filter(time => time > oneMinuteAgo)
        this.metrics.performance.logsPerSecond = recentLogs.length / 60
      }

      // Update recent errors
      this.metrics.errors.recentErrors = this.recentErrors.slice(-10) // Keep last 10 errors

      // Determine health status
      this.metrics.healthStatus = this.calculateHealthStatus()
      this.metrics.lastHealthCheck = Date.now()

    } catch (error) {
      this.recordError('Failed to update metrics', error)
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheckResult> {
    const correlationId = secureLogger.generateCorrelationId()
    const checks: HealthCheckResult['checks'] = []

    try {
      // Check secure logger functionality
      const loggerStart = Date.now()
      secureLogger.logDebug('Health check test log', { correlationId })
      const loggerTime = Date.now() - loggerStart
      
      checks.push({
        name: 'Secure Logger',
        status: loggerTime < 100 ? 'pass' : 'warning',
        message: `Logger responding in ${loggerTime}ms`,
        responseTime: loggerTime
      })

      // Check data sanitizer functionality
      const sanitizerStart = Date.now()
      const testData = { password: 'test123', correlationId }
      const sanitizationResult = dataSanitizer.sanitize(testData)
      const sanitizerTime = Date.now() - sanitizerStart
      
      const sanitizerWorking = sanitizationResult.sanitized.password !== 'test123'
      checks.push({
        name: 'Data Sanitizer',
        status: sanitizerWorking ? 'pass' : 'fail',
        message: sanitizerWorking ? 
          `Sanitizer working, ${sanitizationResult.detectedPatterns.length} patterns detected in ${sanitizerTime}ms` :
          'Sanitizer not working properly',
        responseTime: sanitizerTime
      })

      // Check audit trail functionality
      const auditStart = Date.now()
      await securityAuditTrail.logAuthenticationEvent(
        'auth_attempt',
        correlationId,
        'pending',
        { clientId: 'health-check' }
      )
      const auditTime = Date.now() - auditStart
      
      checks.push({
        name: 'Audit Trail',
        status: auditTime < 200 ? 'pass' : 'warning',
        message: `Audit trail responding in ${auditTime}ms`,
        responseTime: auditTime
      })

      // Check memory usage
      const memoryUsage = this.metrics.performance.memoryUsage
      checks.push({
        name: 'Memory Usage',
        status: memoryUsage < 100 ? 'pass' : memoryUsage < 200 ? 'warning' : 'fail',
        message: `Memory usage: ${memoryUsage.toFixed(2)} MB`
      })

      // Check error rate
      const recentErrorCount = this.recentErrors.filter(
        error => error.timestamp > Date.now() - 300000 // Last 5 minutes
      ).length
      
      checks.push({
        name: 'Error Rate',
        status: recentErrorCount === 0 ? 'pass' : recentErrorCount < 5 ? 'warning' : 'fail',
        message: `${recentErrorCount} errors in last 5 minutes`
      })

      // Determine overall status
      const failedChecks = checks.filter(check => check.status === 'fail').length
      const warningChecks = checks.filter(check => check.status === 'warning').length
      
      let overallStatus: 'healthy' | 'warning' | 'critical'
      if (failedChecks > 0) {
        overallStatus = 'critical'
      } else if (warningChecks > 2) {
        overallStatus = 'warning'
      } else {
        overallStatus = 'healthy'
      }

      const result: HealthCheckResult = {
        status: overallStatus,
        checks,
        timestamp: Date.now(),
        correlationId
      }

      // Log health check result
      if (overallStatus === 'critical') {
        secureLogger.logError('Critical health check failure', undefined, {
          correlationId,
          healthCheck: result
        })
      } else if (overallStatus === 'warning') {
        secureLogger.logAuth('Health check warning', {
          correlationId,
          healthCheck: result
        })
      } else {
        secureLogger.logDebug('Health check passed', {
          correlationId,
          healthCheck: result
        })
      }

      return result

    } catch (error) {
      this.recordError('Health check failed', error)
      
      return {
        status: 'critical',
        checks: [{
          name: 'Health Check System',
          status: 'fail',
          message: `Health check system error: ${error}`
        }],
        timestamp: Date.now(),
        correlationId
      }
    }
  }

  /**
   * Record a log operation for performance tracking
   */
  recordLogOperation(duration: number): void {
    this.logTimes.push(duration)
    this.metrics.totalLogs++
    
    // Keep only last 1000 log times for performance
    if (this.logTimes.length > 1000) {
      this.logTimes = this.logTimes.slice(-1000)
    }
  }

  /**
   * Record an error for monitoring
   */
  recordError(message: string, error: any): void {
    const correlationId = secureLogger.generateCorrelationId()
    
    this.recentErrors.push({
      timestamp: Date.now(),
      error: message,
      correlationId
    })
    
    this.metrics.errors.totalErrors++
    
    // Keep only last 50 errors
    if (this.recentErrors.length > 50) {
      this.recentErrors = this.recentErrors.slice(-50)
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const recentErrorCount = this.recentErrors.filter(
      error => error.timestamp > Date.now() - 300000 // Last 5 minutes
    ).length
    
    const memoryUsage = this.metrics.performance.memoryUsage
    const averageLogTime = this.metrics.performance.averageLogTime
    
    if (recentErrorCount > 10 || memoryUsage > 500 || averageLogTime > 1000) {
      return 'critical'
    }
    
    if (recentErrorCount > 5 || memoryUsage > 200 || averageLogTime > 500) {
      return 'warning'
    }
    
    return 'healthy'
  }

  /**
   * Get current metrics
   */
  getMetrics(): LoggingMetrics {
    this.updateMetrics()
    return { ...this.metrics }
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    isMonitoring: boolean
    uptime: number
    healthStatus: string
    totalLogs: number
    totalErrors: number
  } {
    return {
      isMonitoring: this.isMonitoring,
      uptime: Date.now() - this.startTime,
      healthStatus: this.metrics.healthStatus,
      totalLogs: this.metrics.totalLogs,
      totalErrors: this.metrics.errors.totalErrors
    }
  }
}

// Export singleton instance
export const loggingMonitor = new LoggingMonitor()

// Export class for testing
export { LoggingMonitor }
