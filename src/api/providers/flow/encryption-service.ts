import * as crypto from "crypto"
import { secureLogger } from "./secure-logger"
import type { IEncryptionService } from "./dependency-injection"

/**
 * Encryption service for secure token storage
 */
export class EncryptionService implements IEncryptionService {
	private readonly algorithm = 'aes-256-gcm'
	private readonly keyDerivationIterations = 100000
	private readonly correlationId: string

	constructor() {
		this.correlationId = secureLogger.generateCorrelationId()
		
		secureLogger.logDebug("EncryptionService inicializado", {
			correlationId: this.correlationId,
			algorithm: this.algorithm,
			keyDerivationIterations: this.keyDerivationIterations
		})
	}

	/**
	 * Encrypt data using AES-256-GCM
	 */
	encrypt(data: string, key: Buffer, additionalData?: string): {
		encrypted: string
		iv: string
		authTag: string
	} {
		try {
			const iv = crypto.randomBytes(16)
			const cipher = crypto.createCipher(this.algorithm, key)
			
			if (additionalData) {
				cipher.setAAD(Buffer.from(additionalData))
			}
			
			let encrypted = cipher.update(data, 'utf8', 'hex')
			encrypted += cipher.final('hex')
			
			const authTag = cipher.getAuthTag()
			
			secureLogger.logDebug("Dados criptografados com sucesso", {
				correlationId: this.correlationId,
				operation: "encrypt",
				dataLength: data.length,
				hasAdditionalData: !!additionalData
			})
			
			return {
				encrypted,
				iv: iv.toString('hex'),
				authTag: authTag.toString('hex')
			}
		} catch (error) {
			secureLogger.logError("Erro na criptografia", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "encrypt"
			})
			throw new Error("Falha na criptografia dos dados")
		}
	}

	/**
	 * Decrypt data using AES-256-GCM
	 */
	decrypt(encryptedData: string, iv: string, key: Buffer, authTag: string, additionalData?: string): string {
		try {
			const decipher = crypto.createDecipher(this.algorithm, key)
			decipher.setAuthTag(Buffer.from(authTag, 'hex'))
			
			if (additionalData) {
				decipher.setAAD(Buffer.from(additionalData))
			}
			
			let decrypted = decipher.update(encryptedData, 'hex', 'utf8')
			decrypted += decipher.final('utf8')
			
			secureLogger.logDebug("Dados descriptografados com sucesso", {
				correlationId: this.correlationId,
				operation: "decrypt",
				hasAdditionalData: !!additionalData
			})
			
			return decrypted
		} catch (error) {
			secureLogger.logError("Erro na descriptografia", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "decrypt"
			})
			throw new Error("Falha na descriptografia dos dados")
		}
	}

	/**
	 * Generate encryption key from secret using PBKDF2
	 */
	generateKey(secret: string, salt: string): Buffer {
		try {
			const key = crypto.pbkdf2Sync(
				secret,
				salt,
				this.keyDerivationIterations,
				32, // 256 bits
				'sha512'
			)
			
			secureLogger.logDebug("Chave de criptografia gerada", {
				correlationId: this.correlationId,
				operation: "generate_key",
				keyLength: key.length,
				iterations: this.keyDerivationIterations
			})
			
			return key
		} catch (error) {
			secureLogger.logError("Erro na geração de chave", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "generate_key"
			})
			throw new Error("Falha na geração da chave de criptografia")
		}
	}

	/**
	 * Generate secure random salt
	 */
	generateSalt(length: number = 32): string {
		return crypto.randomBytes(length).toString('hex')
	}

	/**
	 * Hash data using SHA-256
	 */
	hash(data: string, salt?: string): string {
		try {
			const hash = crypto.createHash('sha256')
			hash.update(data)
			if (salt) {
				hash.update(salt)
			}
			
			const result = hash.digest('hex')
			
			secureLogger.logDebug("Hash gerado", {
				correlationId: this.correlationId,
				operation: "hash",
				dataLength: data.length,
				hasSalt: !!salt
			})
			
			return result
		} catch (error) {
			secureLogger.logError("Erro no hash", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "hash"
			})
			throw new Error("Falha na geração do hash")
		}
	}

	/**
	 * Verify hash
	 */
	verifyHash(data: string, hash: string, salt?: string): boolean {
		try {
			const computedHash = this.hash(data, salt)
			const isValid = crypto.timingSafeEqual(
				Buffer.from(hash, 'hex'),
				Buffer.from(computedHash, 'hex')
			)
			
			secureLogger.logDebug("Hash verificado", {
				correlationId: this.correlationId,
				operation: "verify_hash",
				isValid
			})
			
			return isValid
		} catch (error) {
			secureLogger.logError("Erro na verificação de hash", error instanceof Error ? error : new Error(String(error)), {
				correlationId: this.correlationId,
				operation: "verify_hash"
			})
			return false
		}
	}

	/**
	 * Generate secure random token
	 */
	generateSecureToken(length: number = 32): string {
		return crypto.randomBytes(length).toString('hex')
	}

	/**
	 * Secure memory cleanup (overwrite sensitive data)
	 */
	secureCleanup(buffer: Buffer): void {
		if (buffer && buffer.length > 0) {
			crypto.randomFillSync(buffer)
		}
	}

	/**
	 * Validate encryption parameters
	 */
	validateEncryptionParams(data: string, key: Buffer): void {
		if (!data || typeof data !== 'string') {
			throw new Error("Dados para criptografia inválidos")
		}
		
		if (!key || !Buffer.isBuffer(key) || key.length !== 32) {
			throw new Error("Chave de criptografia inválida (deve ter 32 bytes)")
		}
	}

	/**
	 * Get encryption metadata
	 */
	getEncryptionMetadata(): {
		algorithm: string
		keyDerivationIterations: number
		keyLength: number
		ivLength: number
	} {
		return {
			algorithm: this.algorithm,
			keyDerivationIterations: this.keyDerivationIterations,
			keyLength: 32, // 256 bits
			ivLength: 16   // 128 bits
		}
	}
}

/**
 * Utility functions for encryption
 */
export class EncryptionUtils {
	/**
	 * Generate encryption key from password and salt
	 */
	static generateKeyFromPassword(password: string, salt: string, iterations: number = 100000): Buffer {
		return crypto.pbkdf2Sync(password, salt, iterations, 32, 'sha512')
	}

	/**
	 * Encrypt object to JSON string
	 */
	static encryptObject(obj: any, key: Buffer, encryptionService: EncryptionService): {
		encrypted: string
		iv: string
		authTag: string
	} {
		const jsonString = JSON.stringify(obj)
		return encryptionService.encrypt(jsonString, key)
	}

	/**
	 * Decrypt JSON string to object
	 */
	static decryptObject<T>(
		encryptedData: string,
		iv: string,
		key: Buffer,
		authTag: string,
		encryptionService: EncryptionService
	): T {
		const jsonString = encryptionService.decrypt(encryptedData, iv, key, authTag)
		return JSON.parse(jsonString)
	}

	/**
	 * Create secure storage key from configuration
	 */
	static createStorageKey(config: { clientId: string; tenant: string; baseUrl: string }): string {
		const data = `${config.clientId}:${config.tenant}:${config.baseUrl}`
		return crypto.createHash('sha256').update(data).digest('hex')
	}
}
