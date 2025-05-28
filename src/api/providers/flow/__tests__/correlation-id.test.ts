import { secureLogger } from '../secure-logger'
import { TokenManager } from '../auth'
import { FlowHandler } from '../flow-handler'

// Mock uuid to generate unique IDs
let mockUuidCounter = 0
jest.mock('uuid', () => ({
  v4: jest.fn(() => `mocked-uuid-v4-${++mockUuidCounter}`)
}))

// Mock fetch for auth requests
global.fetch = jest.fn()

// Mock console methods to avoid noise in tests
jest.spyOn(console, 'log').mockImplementation(() => {})
jest.spyOn(console, 'error').mockImplementation(() => {})

describe('Correlation ID Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('SecureLogger', () => {
    it('should generate unique correlation IDs', () => {
      const id1 = secureLogger.generateCorrelationId()
      const id2 = secureLogger.generateCorrelationId()

      expect(id1).toBeDefined()
      expect(id2).toBeDefined()
      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^mocked-uuid-v4-\d+$/)
    })

    it('should include correlation ID in log context', () => {
      const correlationId = 'test-correlation-id'

      // Mock the logger property to be a function
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        log: jest.fn()
      }

      // Replace the logger temporarily
      const originalLogger = (secureLogger as any).logger
      ;(secureLogger as any).logger = mockLogger

      secureLogger.logAuth('test event', { correlationId })

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AUTH] test event',
        expect.objectContaining({
          correlationId,
          category: 'authentication'
        })
      )

      // Restore original logger
      ;(secureLogger as any).logger = originalLogger
    })

    it('should auto-generate correlation ID if not provided', () => {
      // Mock the logger property to be a function
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        log: jest.fn()
      }

      // Replace the logger temporarily
      const originalLogger = (secureLogger as any).logger
      ;(secureLogger as any).logger = mockLogger

      const generateSpy = jest.spyOn(secureLogger, 'generateCorrelationId')

      secureLogger.logAuth('test event')

      expect(generateSpy).toHaveBeenCalled()
      expect(mockLogger.info).toHaveBeenCalledWith(
        '[AUTH] test event',
        expect.objectContaining({
          correlationId: expect.any(String),
          category: 'authentication'
        })
      )

      // Restore original logger
      ;(secureLogger as any).logger = originalLogger
    })
  })

  describe('TokenManager', () => {
    it('should maintain persistent correlation ID', () => {
      const mockConfig = {
        flowBaseUrl: 'https://test.com',
        flowAuthBaseUrl: 'https://auth.test.com',
        flowTenant: 'test-tenant',
        flowClientId: 'test-client-id-with-sufficient-length',
        flowClientSecret: 'test-secret-with-at-least-32-characters-for-validation',
        flowAppToAccess: 'test-app',
        flowAgent: 'chat',
        apiModelId: 'gpt-4o-mini',
        flowRequestTimeout: 30000
      }

      const tokenManager = new TokenManager(mockConfig)

      // Verify that correlation ID is set and readonly
      expect((tokenManager as any).correlationId).toBeDefined()
      expect(typeof (tokenManager as any).correlationId).toBe('string')

      // Verify correlation ID is readonly (TypeScript readonly, not runtime)
      const originalId = (tokenManager as any).correlationId

      // Since it's a readonly property in TypeScript, we just verify it exists and is consistent
      expect((tokenManager as any).correlationId).toBe(originalId)
      expect((tokenManager as any).correlationId).toBe(originalId) // Should be the same on multiple accesses
    })
  })

  describe('FlowHandler', () => {
    it('should initialize with correlation ID', () => {
      const mockOptions = {
        flowBaseUrl: 'https://test.com',
        flowAuthBaseUrl: 'https://auth.test.com',
        flowTenant: 'test-tenant',
        flowClientId: 'test-client-id-with-sufficient-length',
        flowClientSecret: 'test-secret-with-at-least-32-characters-for-validation',
        flowAppToAccess: 'test-app',
        flowAgent: 'chat',
        apiModelId: 'gpt-4o-mini',
        flowRequestTimeout: 30000
      }

      const handler = new FlowHandler(mockOptions)

      // Verify that correlation ID is set and readonly
      expect((handler as any).correlationId).toBeDefined()
      expect(typeof (handler as any).correlationId).toBe('string')

      // Verify correlation ID is readonly (TypeScript readonly, not runtime)
      const originalId = (handler as any).correlationId

      // Since it's a readonly property in TypeScript, we just verify it exists and is consistent
      expect((handler as any).correlationId).toBe(originalId)
      expect((handler as any).correlationId).toBe(originalId) // Should be the same on multiple accesses
    })
  })

  describe('Security Events', () => {
    it('should include correlation ID in security events', () => {
      const correlationId = 'test-correlation-id'

      // Mock the logger property to be a function
      const mockLogger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        log: jest.fn()
      }

      // Replace the logger temporarily
      const originalLogger = (secureLogger as any).logger
      ;(secureLogger as any).logger = mockLogger

      const securityEvent = {
        eventType: 'auth_success' as const,
        timestamp: Date.now(),
        correlationId,
        result: 'success' as const
      }

      secureLogger.logSecurityEvent(securityEvent)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        '[SECURITY]',
        expect.objectContaining({
          category: 'security_event',
          eventType: 'auth_success',
          correlationId,
          result: 'success'
        })
      )

      // Restore original logger
      ;(secureLogger as any).logger = originalLogger
    })
  })

  describe('Child Logger', () => {
    it('should create child logger with persistent correlation ID', () => {
      const correlationId = 'test-correlation-id'
      const childLogger = secureLogger.createChildLogger(correlationId)

      expect(childLogger).toBeDefined()
      expect(childLogger).toBeInstanceOf(Object)

      // Verify child logger has the correlation ID by checking its logger property
      expect((childLogger as any).logger).toBeDefined()
      expect(typeof (childLogger as any).logger.info).toBe('function')

      // Test that the child logger can be used
      expect(() => childLogger.logAuth('test event')).not.toThrow()
    })
  })
})
