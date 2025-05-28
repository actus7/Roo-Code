/**
 * Security tests for Flow Provider authentication enhancements
 */

import { validateFlowCredentials, CredentialValidationError } from "./credential-validator"
import { SecureTokenManager } from "./secure-token-manager"
import { EncryptionService } from "./encryption-service"
import { EnhancedRetry } from "./enhanced-retry"
import { container, MockServices, ServiceKeys } from "./dependency-injection"
import type { FlowConfig } from "./types"

/**
 * Security test suite for Flow Provider
 */
export class SecurityTestSuite {
	private testResults: Array<{
		test: string
		status: 'PASS' | 'FAIL' | 'WARNING'
		details: string
		recommendation?: string
	}> = []

	/**
	 * Run all security tests
	 */
	async runAllTests(): Promise<void> {
		console.log('🔒 INICIANDO TESTES DE SEGURANÇA - Flow Provider\n')
		console.log('=' .repeat(60))

		await this.testCredentialValidation()
		await this.testTokenEncryption()
		await this.testThreadSafety()
		await this.testRetryLogic()
		await this.testDependencyInjection()
		await this.testSecurityAuditTrail()

		this.printResults()
	}

	/**
	 * Test credential validation
	 */
	private async testCredentialValidation(): Promise<void> {
		console.log('\n1. 🔐 Testando Validação de Credenciais:')

		// Test valid credentials
		try {
			const validConfig: FlowConfig = {
				flowBaseUrl: 'https://api.flow.example.com',
				flowTenant: 'test-tenant',
				flowClientId: 'valid-client-id-123',
				flowClientSecret: 'very-secure-secret-with-enough-entropy-12345678',
				flowAuthBaseUrl: 'https://auth.flow.example.com'
			}

			validateFlowCredentials(validConfig)
			this.addResult('Credential Validation', 'Valid Credentials', 'PASS', 'Credenciais válidas aceitas corretamente')
		} catch (error) {
			this.addResult('Credential Validation', 'Valid Credentials', 'FAIL', `Erro inesperado: ${error}`)
		}

		// Test invalid client ID
		try {
			const invalidConfig: FlowConfig = {
				flowBaseUrl: 'https://api.flow.example.com',
				flowTenant: 'test-tenant',
				flowClientId: 'invalid-client-id-with-sql-injection\'--',
				flowClientSecret: 'very-secure-secret-with-enough-entropy-12345678'
			}

			validateFlowCredentials(invalidConfig)
			this.addResult('Credential Validation', 'SQL Injection Protection', 'FAIL', 'Client ID com SQL injection foi aceito')
		} catch (error) {
			if (error instanceof CredentialValidationError) {
				this.addResult('Credential Validation', 'SQL Injection Protection', 'PASS', 'SQL injection detectado e bloqueado')
			} else {
				this.addResult('Credential Validation', 'SQL Injection Protection', 'WARNING', 'Erro inesperado na validação')
			}
		}

		// Test weak client secret
		try {
			const weakSecretConfig: FlowConfig = {
				flowBaseUrl: 'https://api.flow.example.com',
				flowTenant: 'test-tenant',
				flowClientId: 'valid-client-id',
				flowClientSecret: 'weak'
			}

			validateFlowCredentials(weakSecretConfig)
			this.addResult('Credential Validation', 'Weak Secret Detection', 'FAIL', 'Client secret fraco foi aceito')
		} catch (error) {
			if (error instanceof CredentialValidationError) {
				this.addResult('Credential Validation', 'Weak Secret Detection', 'PASS', 'Client secret fraco detectado e rejeitado')
			}
		}

		console.log('   ✅ Testes de validação de credenciais concluídos')
	}

	/**
	 * Test token encryption
	 */
	private async testTokenEncryption(): Promise<void> {
		console.log('\n2. 🔐 Testando Criptografia de Tokens:')

		const encryptionService = new EncryptionService()
		const testData = 'sensitive-token-data-12345'
		const key = encryptionService.generateKey('test-secret', 'test-salt')

		try {
			// Test encryption
			const encrypted = encryptionService.encrypt(testData, key, 'additional-data')

			if (encrypted.encrypted !== testData) {
				this.addResult('Token Encryption', 'Data Encryption', 'PASS', 'Dados criptografados corretamente')
			} else {
				this.addResult('Token Encryption', 'Data Encryption', 'FAIL', 'Dados não foram criptografados')
			}

			// Test decryption
			const decrypted = encryptionService.decrypt(
				encrypted.encrypted,
				encrypted.iv,
				key,
				encrypted.authTag,
				'additional-data'
			)

			if (decrypted === testData) {
				this.addResult('Token Encryption', 'Data Decryption', 'PASS', 'Dados descriptografados corretamente')
			} else {
				this.addResult('Token Encryption', 'Data Decryption', 'FAIL', 'Falha na descriptografia')
			}

			// Test tamper detection
			try {
				encryptionService.decrypt(
					'tampered-data',
					encrypted.iv,
					key,
					encrypted.authTag,
					'additional-data'
				)
				this.addResult('Token Encryption', 'Tamper Detection', 'FAIL', 'Dados alterados não foram detectados')
			} catch (error) {
				this.addResult('Token Encryption', 'Tamper Detection', 'PASS', 'Alteração de dados detectada')
			}

		} catch (error) {
			this.addResult('Token Encryption', 'Encryption Process', 'FAIL', `Erro na criptografia: ${error}`)
		}

		console.log('   ✅ Testes de criptografia concluídos')
	}

	/**
	 * Test thread safety
	 */
	private async testThreadSafety(): Promise<void> {
		console.log('\n3. 🔄 Testando Thread Safety:')

		// Skip thread safety test for now due to dependency complexity
		this.addResult('Thread Safety', 'Concurrent Token Requests', 'WARNING', 'Teste pulado - requer configuração de mock mais complexa')

		console.log('   ⚠️  Testes de thread safety pulados')
	}

	/**
	 * Test retry logic
	 */
	private async testRetryLogic(): Promise<void> {
		console.log('\n4. 🔄 Testando Retry Logic:')

		const retry = new EnhancedRetry({
			maxRetries: 3,
			baseDelay: 100, // Fast for testing
			maxDelay: 1000,
			backoffMultiplier: 2,
			jitter: false // Disable for predictable testing
		})

		// Test successful retry after failures
		let attempts = 0
		try {
			await retry.execute(async () => {
				attempts++
				if (attempts < 3) {
					throw new Error('NETWORK_ERROR: Temporary failure')
				}
				return 'success'
			}, 'test_operation')

			if (attempts === 3) {
				this.addResult('Retry Logic', 'Successful Retry', 'PASS', 'Operação bem-sucedida após 2 tentativas')
			} else {
				this.addResult('Retry Logic', 'Successful Retry', 'WARNING', `Tentativas inesperadas: ${attempts}`)
			}
		} catch (error) {
			this.addResult('Retry Logic', 'Successful Retry', 'FAIL', `Falha no retry: ${error}`)
		}

		// Test non-retryable error
		try {
			await retry.execute(async () => {
				throw new Error('VALIDATION_ERROR: Non-retryable')
			}, 'test_non_retryable')

			this.addResult('Retry Logic', 'Non-retryable Error', 'FAIL', 'Erro não-retryable foi retentado')
		} catch (error) {
			this.addResult('Retry Logic', 'Non-retryable Error', 'PASS', 'Erro não-retryable não foi retentado')
		}

		console.log('   ✅ Testes de retry logic concluídos')
	}

	/**
	 * Test dependency injection
	 */
	private async testDependencyInjection(): Promise<void> {
		console.log('\n5. 🔧 Testando Dependency Injection:')

		try {
			// Test service registration and resolution
			container.clear()
			container.register('testService', () => ({ test: 'value' }), true)

			const service = container.resolve('testService') as any
			if (service && service.test === 'value') {
				this.addResult('Dependency Injection', 'Service Registration', 'PASS', 'Serviço registrado e resolvido corretamente')
			} else {
				this.addResult('Dependency Injection', 'Service Registration', 'FAIL', 'Falha na resolução do serviço')
			}

			// Test singleton behavior
			const service1 = container.resolve('testService')
			const service2 = container.resolve('testService')

			if (service1 === service2) {
				this.addResult('Dependency Injection', 'Singleton Behavior', 'PASS', 'Comportamento singleton funcionando')
			} else {
				this.addResult('Dependency Injection', 'Singleton Behavior', 'FAIL', 'Singleton retornando instâncias diferentes')
			}

		} catch (error) {
			this.addResult('Dependency Injection', 'DI Container', 'FAIL', `Erro no container: ${error}`)
		}

		console.log('   ✅ Testes de dependency injection concluídos')
	}

	/**
	 * Test security audit trail
	 */
	private async testSecurityAuditTrail(): Promise<void> {
		console.log('\n6. 📊 Testando Security Audit Trail:')

		try {
			// Import audit trail
			const { securityAuditTrail } = await import('./audit-trail')

			// Test event logging
			await securityAuditTrail.logAuthenticationEvent(
				'auth_success',
				'test-correlation-id',
				'success',
				{ clientId: 'test-client' }
			)

			const stats = securityAuditTrail.getAuditStats()
			if (stats.totalEvents > 0) {
				this.addResult('Security Audit', 'Event Logging', 'PASS', `${stats.totalEvents} eventos registrados`)
			} else {
				this.addResult('Security Audit', 'Event Logging', 'FAIL', 'Nenhum evento registrado')
			}

		} catch (error) {
			this.addResult('Security Audit', 'Audit Trail', 'FAIL', `Erro no audit trail: ${error}`)
		}

		console.log('   ✅ Testes de security audit trail concluídos')
	}

	/**
	 * Add test result
	 */
	private addResult(category: string, test: string, status: 'PASS' | 'FAIL' | 'WARNING', details: string, recommendation?: string): void {
		this.testResults.push({
			test: `${category} - ${test}`,
			status,
			details,
			recommendation
		})
	}

	/**
	 * Print test results
	 */
	private printResults(): void {
		console.log('\n' + '=' .repeat(60))
		console.log('📊 RESULTADOS DOS TESTES DE SEGURANÇA')
		console.log('=' .repeat(60))

		const passed = this.testResults.filter(r => r.status === 'PASS').length
		const failed = this.testResults.filter(r => r.status === 'FAIL').length
		const warnings = this.testResults.filter(r => r.status === 'WARNING').length

		console.log(`\n✅ Passou: ${passed}`)
		console.log(`❌ Falhou: ${failed}`)
		console.log(`⚠️  Avisos: ${warnings}`)
		console.log(`📊 Total: ${this.testResults.length}`)

		console.log('\nDetalhes dos Testes:')
		this.testResults.forEach((result, index) => {
			const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️'
			console.log(`\n${index + 1}. ${icon} ${result.test}`)
			console.log(`   ${result.details}`)
			if (result.recommendation) {
				console.log(`   💡 Recomendação: ${result.recommendation}`)
			}
		})

		console.log('\n' + '=' .repeat(60))
		console.log('🔒 TESTES DE SEGURANÇA CONCLUÍDOS')
		console.log('=' .repeat(60))
	}
}

/**
 * Run security tests
 */
export async function runSecurityTests(): Promise<void> {
	const testSuite = new SecurityTestSuite()
	await testSuite.runAllTests()
}
