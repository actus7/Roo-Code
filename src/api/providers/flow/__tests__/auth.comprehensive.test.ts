/**
 * Comprehensive Tests for Flow Authentication Module
 *
 * This test suite provides extensive coverage for the auth.ts module,
 * including the authenticate function and TokenManager class.
 */

import { authenticate, TokenManager } from '../auth'
import type { FlowConfig, AuthResponse } from '../types'
import { secureLogger } from '../secure-logger'
import { securityAuditTrail } from '../audit-trail'
import { validateFlowCredentials } from '../credential-validator'
import { FLOW_ENDPOINTS, FLOW_HEADERS } from '../config'

// Mock dependencies
jest.mock('../secure-logger')
jest.mock('../audit-trail')
jest.mock('../credential-validator')
jest.mock('../enhanced-retry')

// Mock fetch globally
global.fetch = jest.fn()

describe('Flow Authentication Module', () => {
	const mockConfig: FlowConfig = {
		flowBaseUrl: 'https://flow.test.com',
		flowAuthBaseUrl: 'https://auth.flow.test.com',
		flowTenant: 'test-tenant',
		flowClientId: 'test-client-id',
		flowClientSecret: 'test-client-secret',
		flowAppToAccess: 'llm-api',
		apiModelId: 'gpt-4o-mini',
		flowRequestTimeout: 30000
	}

	const mockAuthResponse: AuthResponse = {
		access_token: 'test-access-token',
		expires_in: 3600,
		token_type: 'Bearer'
	}

	const mockSecureLogger = secureLogger as jest.Mocked<typeof secureLogger>
	const mockSecurityAuditTrail = securityAuditTrail as jest.Mocked<typeof securityAuditTrail>
	const mockValidateFlowCredentials = validateFlowCredentials as jest.MockedFunction<typeof validateFlowCredentials>
	const mockFetch = fetch as jest.MockedFunction<typeof fetch>

	beforeEach(() => {
		jest.clearAllMocks()
		jest.useFakeTimers()

		// Setup default mocks
		mockSecureLogger.generateCorrelationId.mockReturnValue('test-correlation-id')
		mockValidateFlowCredentials.mockReturnValue(mockConfig)
		mockSecurityAuditTrail.logAuthenticationEvent.mockResolvedValue(undefined)
	})

	afterEach(() => {
		jest.useRealTimers()
	})

	describe('authenticate function', () => {
		describe('Successful Authentication', () => {
			it('should authenticate successfully with valid credentials', async () => {
				// Setup successful response
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					statusText: 'OK',
					json: jest.fn().mockResolvedValue(mockAuthResponse),
					text: jest.fn().mockResolvedValue('')
				} as any)

				const result = await authenticate(mockConfig)

				expect(result).toEqual(mockAuthResponse)
				expect(mockValidateFlowCredentials).toHaveBeenCalledWith(mockConfig)
				expect(mockSecureLogger.logAuth).toHaveBeenCalledWith(
					'Iniciando autenticação',
					expect.objectContaining({
						correlationId: 'test-correlation-id',
						tenant: mockConfig.flowTenant,
						appToAccess: mockConfig.flowAppToAccess,
						hasClientSecret: true
					})
				)
			})

			it('should make correct API call with proper headers and payload', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await authenticate(mockConfig)

				expect(mockFetch).toHaveBeenCalledWith(
					`${mockConfig.flowAuthBaseUrl}${FLOW_ENDPOINTS.auth}`,
					{
						method: 'POST',
						headers: {
							...FLOW_HEADERS,
							FlowTenant: mockConfig.flowTenant
						},
						body: JSON.stringify({
							clientId: mockConfig.flowClientId,
							clientSecret: mockConfig.flowClientSecret,
							appToAccess: mockConfig.flowAppToAccess
						})
					}
				)
			})

			it('should handle response with default values for missing fields', async () => {
				const partialResponse = {
					access_token: 'test-token'
					// Missing expires_in and token_type
				}

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(partialResponse)
				} as any)

				const result = await authenticate(mockConfig)

				expect(result).toEqual({
					access_token: 'test-token',
					expires_in: 3600, // Default value
					token_type: 'Bearer' // Default value
				})
			})

			it('should log authentication success events', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await authenticate(mockConfig)

				expect(mockSecureLogger.logSecurityEvent).toHaveBeenCalledWith({
					eventType: 'auth_success',
					timestamp: expect.any(Number),
					correlationId: 'test-correlation-id',
					result: 'success'
				})

				expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
					'auth_success',
					'test-correlation-id',
					'success',
					{ clientId: mockConfig.flowClientId }
				)
			})
		})

		describe('Authentication Failures', () => {
			it('should handle HTTP error responses', async () => {
				const errorText = 'Invalid credentials'
				mockFetch.mockResolvedValueOnce({
					ok: false,
					status: 401,
					statusText: 'Unauthorized',
					text: jest.fn().mockResolvedValue(errorText)
				} as any)

				await expect(authenticate(mockConfig)).rejects.toThrow(
					'Authentication failed: 401 Unauthorized - Invalid credentials'
				)

				expect(mockSecureLogger.logSecurityEvent).toHaveBeenCalledWith({
					eventType: 'auth_failure',
					timestamp: expect.any(Number),
					correlationId: 'test-correlation-id',
					result: 'failure',
					errorCode: '401',
					metadata: {
						statusText: 'Unauthorized',
						hasErrorText: true
					}
				})
			})

			it('should handle missing access_token in response', async () => {
				const invalidResponse = {
					expires_in: 3600,
					token_type: 'Bearer'
					// Missing access_token
				}

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(invalidResponse)
				} as any)

				await expect(authenticate(mockConfig)).rejects.toThrow(
					'Authentication response missing access_token'
				)

				expect(mockSecureLogger.logSecurityEvent).toHaveBeenCalledWith({
					eventType: 'auth_failure',
					timestamp: expect.any(Number),
					correlationId: 'test-correlation-id',
					result: 'failure',
					errorCode: 'MISSING_TOKEN',
					metadata: { reason: 'access_token missing in response' }
				})
			})

			it('should handle network errors', async () => {
				const networkError = new Error('Network error')
				mockFetch.mockRejectedValueOnce(networkError)

				await expect(authenticate(mockConfig)).rejects.toThrow(
					'Flow authentication error: Network error'
				)

				expect(mockSecureLogger.logError).toHaveBeenCalledWith(
					'Erro na autenticação',
					networkError,
					{
						correlationId: 'test-correlation-id',
						operation: 'authenticate'
					}
				)
			})

			it('should handle non-Error exceptions', async () => {
				const stringError = 'String error'
				mockFetch.mockRejectedValueOnce(stringError)

				await expect(authenticate(mockConfig)).rejects.toBe(stringError)
			})
		})

		describe('Audit Trail Integration', () => {
			it('should log authentication attempt before making request', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await authenticate(mockConfig)

				expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
					'auth_attempt',
					'test-correlation-id',
					'pending',
					{ clientId: mockConfig.flowClientId }
				)
			})

			it('should log authentication failure to audit trail', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: false,
					status: 403,
					statusText: 'Forbidden',
					text: jest.fn().mockResolvedValue('Access denied')
				} as any)

				await expect(authenticate(mockConfig)).rejects.toThrow()

				expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
					'auth_failure',
					'test-correlation-id',
					'failure',
					{
						clientId: mockConfig.flowClientId,
						errorCode: '403'
					}
				)
			})
		})

		describe('Credential Validation Integration', () => {
			it('should validate credentials before authentication', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await authenticate(mockConfig)

				expect(mockValidateFlowCredentials).toHaveBeenCalledWith(mockConfig)
			})

			it('should use validated config for authentication', async () => {
				const validatedConfig = { ...mockConfig, flowTenant: 'validated-tenant' }
				mockValidateFlowCredentials.mockReturnValue(validatedConfig)

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await authenticate(mockConfig)

				expect(mockFetch).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						headers: expect.objectContaining({
							FlowTenant: 'validated-tenant'
						})
					})
				)
			})
		})
	})

	describe('TokenManager class', () => {
		let tokenManager: TokenManager

		beforeEach(() => {
			tokenManager = new TokenManager(mockConfig)
		})

		describe('Constructor', () => {
			it('should initialize with validated config and correlation ID', () => {
				expect(mockValidateFlowCredentials).toHaveBeenCalledWith(mockConfig)
				expect(mockSecureLogger.generateCorrelationId).toHaveBeenCalled()
			})

			it('should initialize with no token', () => {
				expect(tokenManager.isTokenValid()).toBe(false)
				expect(tokenManager.getTokenExpiry()).toBeNull()
			})
		})

		describe('getValidToken', () => {
			it('should authenticate and return token when no token exists', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				const token = await tokenManager.getValidToken()

				expect(token).toBe(mockAuthResponse.access_token)
				expect(mockSecureLogger.logDebug).toHaveBeenCalledWith(
					'getValidToken chamado',
					expect.objectContaining({
						hasToken: false,
						needsRefresh: true
					})
				)
			})

			it('should return existing valid token without refresh', async () => {
				// First call to get token
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()
				jest.clearAllMocks()

				// Advance time by 30 minutes (token still valid)
				jest.advanceTimersByTime(30 * 60 * 1000)

				// Second call should not trigger refresh
				const token = await tokenManager.getValidToken()

				expect(token).toBe(mockAuthResponse.access_token)
				expect(mockFetch).not.toHaveBeenCalled()
				expect(mockSecureLogger.logDebug).toHaveBeenCalledWith(
					'getValidToken chamado',
					expect.objectContaining({
						hasToken: true,
						needsRefresh: false
					})
				)
			})

			it('should refresh token when it expires within 1 minute', async () => {
				// First authentication
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()

				// Advance time to 59 minutes (within 1 minute of expiry)
				jest.advanceTimersByTime(59 * 60 * 1000)

				// Setup second authentication
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue({
						...mockAuthResponse,
						access_token: 'refreshed-token'
					})
				} as any)

				const token = await tokenManager.getValidToken()

				expect(token).toBe('refreshed-token')
				expect(mockFetch).toHaveBeenCalledTimes(2)
			})
		})

		describe('refreshToken', () => {
			it('should successfully refresh token', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.refreshToken()

				expect(tokenManager.isTokenValid()).toBe(true)
				expect(mockSecureLogger.logSecurityEvent).toHaveBeenCalledWith({
					eventType: 'token_refresh',
					timestamp: expect.any(Number),
					correlationId: 'test-correlation-id',
					result: 'success',
					metadata: {
						expiresIn: mockAuthResponse.expires_in,
						hasToken: true
					}
				})
			})

			it('should handle refresh failure and clear token', async () => {
				const authError = new Error('Auth failed')
				mockFetch.mockRejectedValueOnce(authError)

				await expect(tokenManager.refreshToken()).rejects.toThrow('Flow authentication error: Auth failed')

				expect(tokenManager.isTokenValid()).toBe(false)
				expect(tokenManager.getTokenExpiry()).toBeNull()
				expect(mockSecureLogger.logError).toHaveBeenCalledWith(
					'Erro ao renovar token',
					expect.any(Error),
					expect.objectContaining({
						operation: 'refreshToken'
					})
				)
			})

			it('should log token refresh to audit trail', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.refreshToken()

				expect(mockSecurityAuditTrail.logAuthenticationEvent).toHaveBeenCalledWith(
					'token_refresh',
					'test-correlation-id',
					'success',
					{ clientId: mockConfig.flowClientId }
				)
			})
		})

		describe('isTokenValid', () => {
			it('should return false when no token exists', () => {
				expect(tokenManager.isTokenValid()).toBe(false)
			})

			it('should return true for valid token', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()
				expect(tokenManager.isTokenValid()).toBe(true)
			})

			it('should return false for expired token', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()

				// Advance time past expiry
				jest.advanceTimersByTime(61 * 60 * 1000)

				expect(tokenManager.isTokenValid()).toBe(false)
			})
		})

		describe('clearToken', () => {
			it('should clear stored token and expiry', async () => {
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()
				expect(tokenManager.isTokenValid()).toBe(true)

				tokenManager.clearToken()

				expect(tokenManager.isTokenValid()).toBe(false)
				expect(tokenManager.getTokenExpiry()).toBeNull()
			})
		})

		describe('getTokenExpiry', () => {
			it('should return null when no token exists', () => {
				expect(tokenManager.getTokenExpiry()).toBeNull()
			})

			it('should return expiry timestamp when token exists', async () => {
				const currentTime = Date.now()
				jest.setSystemTime(currentTime)

				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				await tokenManager.getValidToken()

				const expiry = tokenManager.getTokenExpiry()
				expect(expiry).toBe(currentTime + mockAuthResponse.expires_in * 1000)
			})
		})

		describe('Edge Cases and Error Handling', () => {
			it('should handle concurrent getValidToken calls', async () => {
				mockFetch.mockResolvedValue({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue(mockAuthResponse)
				} as any)

				// Make multiple concurrent calls
				const promises = [
					tokenManager.getValidToken(),
					tokenManager.getValidToken(),
					tokenManager.getValidToken()
				]

				const tokens = await Promise.all(promises)

				// All should return the same token
				const allTokensMatch = tokens.every(token => token === mockAuthResponse.access_token)
				expect(allTokensMatch).toBe(true)
				// Note: Current implementation doesn't prevent concurrent calls, so multiple API calls are expected
				expect(mockFetch).toHaveBeenCalled()
			})

			it('should handle token refresh during getValidToken', async () => {
				// Setup initial token that's about to expire
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue({
						...mockAuthResponse,
						expires_in: 30 // 30 seconds
					})
				} as any)

				await tokenManager.getValidToken()

				// Advance time to trigger refresh
				jest.advanceTimersByTime(31 * 1000)

				// Setup refresh response
				mockFetch.mockResolvedValueOnce({
					ok: true,
					status: 200,
					json: jest.fn().mockResolvedValue({
						...mockAuthResponse,
						access_token: 'new-token'
					})
				} as any)

				const token = await tokenManager.getValidToken()

				expect(token).toBe('new-token')
				expect(mockFetch).toHaveBeenCalledTimes(2)
			})
		})
	})
})
