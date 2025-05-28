import type { FlowConfig, AuthResponse } from "./types"

/**
 * Interface for authentication service
 */
export interface IAuthenticationService {
	authenticate(config: FlowConfig): Promise<AuthResponse>
}

/**
 * Interface for credential validation service
 */
export interface ICredentialValidator {
	validateCredentials(config: FlowConfig): FlowConfig
}

/**
 * Interface for secure logger
 */
export interface ISecureLogger {
	generateCorrelationId(): string
	logDebug(message: string, metadata?: any): void
	logError(message: string, error: Error, metadata?: any): void
	logSecurityEvent(event: any): void
}

/**
 * Interface for security audit trail
 */
export interface ISecurityAuditTrail {
	logAuthenticationEvent(
		eventType: string,
		correlationId: string,
		status: string,
		metadata?: any
	): Promise<void>
	logSecurityEvent(event: any): Promise<void>
}

/**
 * Interface for encryption service
 */
export interface IEncryptionService {
	encrypt(data: string, key: Buffer, additionalData?: string): {
		encrypted: string
		iv: string
	}
	decrypt(encryptedData: string, iv: string, key: Buffer, additionalData?: string): string
	generateKey(secret: string, salt: string): Buffer
}

/**
 * Interface for retry service
 */
export interface IRetryService {
	execute<T>(fn: () => Promise<T>, context?: string): Promise<T>
}

/**
 * Interface for token storage
 */
export interface ITokenStorage {
	store(tokenData: any): void
	retrieve(): any | null
	clear(): void
	isValid(): boolean
}

/**
 * Dependency container for managing service instances
 */
export class DependencyContainer {
	private services = new Map<string, any>()
	private singletons = new Map<string, any>()

	/**
	 * Register a service factory
	 */
	register<T>(key: string, factory: () => T, singleton: boolean = false): void {
		if (singleton) {
			this.singletons.set(key, factory)
		} else {
			this.services.set(key, factory)
		}
	}

	/**
	 * Register a service instance
	 */
	registerInstance<T>(key: string, instance: T): void {
		this.singletons.set(key, () => instance)
	}

	/**
	 * Resolve a service
	 */
	resolve<T>(key: string): T {
		// Check singletons first
		if (this.singletons.has(key)) {
			const factory = this.singletons.get(key)
			if (typeof factory === 'function') {
				const instance = factory()
				this.singletons.set(key, () => instance) // Cache the instance
				return instance
			}
			return factory()
		}

		// Check regular services
		if (this.services.has(key)) {
			const factory = this.services.get(key)
			return factory()
		}

		throw new Error(`Service not found: ${key}`)
	}

	/**
	 * Check if service is registered
	 */
	has(key: string): boolean {
		return this.services.has(key) || this.singletons.has(key)
	}

	/**
	 * Clear all services
	 */
	clear(): void {
		this.services.clear()
		this.singletons.clear()
	}
}

/**
 * Service keys for dependency injection
 */
export const ServiceKeys = {
	AUTHENTICATION_SERVICE: 'authenticationService',
	CREDENTIAL_VALIDATOR: 'credentialValidator',
	SECURE_LOGGER: 'secureLogger',
	SECURITY_AUDIT_TRAIL: 'securityAuditTrail',
	ENCRYPTION_SERVICE: 'encryptionService',
	RETRY_SERVICE: 'retryService',
	TOKEN_STORAGE: 'tokenStorage'
} as const

/**
 * Global dependency container instance
 */
export const container = new DependencyContainer()

/**
 * Injectable decorator for classes
 */
export function Injectable(dependencies: string[] = []) {
	return function <T extends new (...args: any[]) => any>(constructor: T) {
		return class extends constructor {
			constructor(...args: any[]) {
				// Resolve dependencies from container
				const resolvedDeps = dependencies.map(dep => container.resolve(dep))
				super(...resolvedDeps, ...args)
			}
		}
	}
}

/**
 * Inject decorator for properties
 */
export function Inject(serviceKey: string) {
	return function (target: any, propertyKey: string) {
		Object.defineProperty(target, propertyKey, {
			get: () => container.resolve(serviceKey),
			enumerable: true,
			configurable: true
		})
	}
}

/**
 * Setup default services in container
 */
export function setupDefaultServices(): void {
	// Import services dynamically to avoid circular dependencies
	import('./auth').then(({ authenticate }) => {
		container.register(ServiceKeys.AUTHENTICATION_SERVICE, () => ({
			authenticate
		}), true)
	})

	import('./credential-validator').then(({ validateFlowCredentials }) => {
		container.register(ServiceKeys.CREDENTIAL_VALIDATOR, () => ({
			validateCredentials: validateFlowCredentials
		}), true)
	})

	import('./secure-logger').then(({ secureLogger }) => {
		container.registerInstance(ServiceKeys.SECURE_LOGGER, secureLogger)
	})

	import('./audit-trail').then(({ securityAuditTrail }) => {
		container.registerInstance(ServiceKeys.SECURITY_AUDIT_TRAIL, securityAuditTrail)
	})

	import('./encryption-service').then(({ EncryptionService }) => {
		container.register(ServiceKeys.ENCRYPTION_SERVICE, () => new EncryptionService(), true)
	})

	import('./enhanced-retry').then(({ EnhancedRetry }) => {
		container.register(ServiceKeys.RETRY_SERVICE, () => new EnhancedRetry(), false)
	})
}

/**
 * Mock services for testing (without jest dependency)
 */
export class MockServices {
	static createMockAuthService(): IAuthenticationService {
		return {
			authenticate: async () => ({
				access_token: 'mock-token',
				expires_in: 3600,
				token_type: 'Bearer'
			})
		}
	}

	static createMockCredentialValidator(): ICredentialValidator {
		return {
			validateCredentials: (config) => config
		}
	}

	static createMockLogger(): ISecureLogger {
		return {
			generateCorrelationId: () => 'mock-correlation-id',
			logDebug: () => {},
			logError: () => {},
			logSecurityEvent: () => {}
		}
	}

	static createMockAuditTrail(): ISecurityAuditTrail {
		return {
			logAuthenticationEvent: async () => {},
			logSecurityEvent: async () => {}
		}
	}

	static createMockEncryptionService(): IEncryptionService {
		return {
			encrypt: () => ({
				encrypted: 'mock-encrypted',
				iv: 'mock-iv'
			}),
			decrypt: () => 'mock-decrypted',
			generateKey: () => Buffer.from('mock-key')
		}
	}

	static createMockRetryService(): IRetryService {
		return {
			execute: async (fn) => fn()
		}
	}

	static createMockTokenStorage(): ITokenStorage {
		let data: any = null
		return {
			store: (tokenData) => { data = tokenData },
			retrieve: () => data,
			clear: () => { data = null },
			isValid: () => true
		}
	}

	/**
	 * Setup mock services in container for testing
	 */
	static setupMockServices(): void {
		container.clear()
		container.registerInstance(ServiceKeys.AUTHENTICATION_SERVICE, this.createMockAuthService())
		container.registerInstance(ServiceKeys.CREDENTIAL_VALIDATOR, this.createMockCredentialValidator())
		container.registerInstance(ServiceKeys.SECURE_LOGGER, this.createMockLogger())
		container.registerInstance(ServiceKeys.SECURITY_AUDIT_TRAIL, this.createMockAuditTrail())
		container.registerInstance(ServiceKeys.ENCRYPTION_SERVICE, this.createMockEncryptionService())
		container.registerInstance(ServiceKeys.RETRY_SERVICE, this.createMockRetryService())
		container.registerInstance(ServiceKeys.TOKEN_STORAGE, this.createMockTokenStorage())
	}
}
