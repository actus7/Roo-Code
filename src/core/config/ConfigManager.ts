import { ExtensionContext } from "vscode"
import { ApiConfiguration } from "../../shared/api"
import { Mode } from "../../shared/modes"
import { ApiConfigMeta } from "../../shared/ExtensionMessage"

export interface ApiConfigData {
	currentApiConfigName: string
	apiConfigs: {
		[key: string]: ApiConfiguration
	}
	modeApiConfigs?: Partial<Record<Mode, string>>
}

export class ConfigManager {
	private readonly defaultConfig: ApiConfigData = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: {
				id: this.generateId(),
			},
		},
	}

	private readonly SCOPE_PREFIX = "roo_cline_config_"
	private readonly context: ExtensionContext

	constructor(context: ExtensionContext) {
		this.context = context
		this.initConfig().catch(console.error)
	}

	private generateId(): string {
		return Math.random().toString(36).substring(2, 15)
	}

	// Synchronize readConfig/writeConfig operations to avoid data loss.
	private _lock = Promise.resolve()
	private lock<T>(cb: () => Promise<T>) {
		const next = this._lock.then(cb)
		this._lock = next.catch(() => {}) as Promise<void>
		return next
	}
	/**
	 * Initialize config if it doesn't exist
	 */
	async initConfig(): Promise<void> {
		try {
			return await this.lock(async () => {
				console.log("[ConfigManager] Initializing configuration")
				const config = await this.readConfig()
				if (!config) {
					console.log("[ConfigManager] No configuration found, using default")
					await this.writeConfig(this.defaultConfig)
					return
				}

				let needsMigration = false

				// Migrate: ensure all configs have IDs and validate Flow configurations
				for (const [name, apiConfig] of Object.entries(config.apiConfigs)) {
					console.log(`[ConfigManager] Checking config '${name}'`, {
						provider: apiConfig.apiProvider,
						hasId: !!apiConfig.id,
						isFlow: apiConfig.apiProvider === "flow",
					})

					if (!apiConfig.id) {
						apiConfig.id = this.generateId()
						needsMigration = true
					}

					// Special handling for Flow configurations
					if (apiConfig.apiProvider === "flow") {
						console.log(`[ConfigManager] Validating Flow config '${name}'`, {
							hasFlowTenant: "flowTenant" in apiConfig,
							flowTenant: apiConfig.flowTenant,
						})

						// Ensure Flow configuration is preserved
						if (!apiConfig.flowTenant) {
							console.warn(`[ConfigManager] Flow config '${name}' is missing tenant`)
						}
					}
				}

				if (needsMigration) {
					console.log("[ConfigManager] Configuration requires migration")
					await this.writeConfig(config)
				}
			})
		} catch (error) {
			console.error("[ConfigManager] Error initializing config:", error)
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	/**
	 * List all available configs with metadata
	 */
	async listConfig(): Promise<ApiConfigMeta[]> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return Object.entries(config.apiConfigs).map(([name, apiConfig]) => ({
					name,
					id: apiConfig.id || "",
					apiProvider: apiConfig.apiProvider,
				}))
			})
		} catch (error) {
			throw new Error(`Failed to list configs: ${error}`)
		}
	}

	/**
	 * Save a config with the given name
	 */
	async saveConfig(name: string, config: ApiConfiguration): Promise<void> {
		return await this.lock(async () => {
			const currentConfig = await this.readConfig()
			const existingConfig = currentConfig.apiConfigs[name]

			// Preserve existing config properties and merge with new ones
			currentConfig.apiConfigs[name] = {
				...(existingConfig || {}),
				...config,
				id: existingConfig?.id || this.generateId(),
				// Flow-specific properties with correct defaults
				...(config.apiProvider === "flow" && {
					flowBaseUrl: config.flowBaseUrl || "https://flow.ciandt.com",
					flowAppToAccess: "llm-api", // Corrigido para o valor correto
					flowTenant: config.flowTenant || "cit",
				}),
			}

			await this.writeConfig(currentConfig)
		})
	}

	/**
	 * Load a config by name
	 */
	async loadConfig(name: string): Promise<ApiConfiguration> {
		try {
			return await this.lock(async () => {
				console.log(`[ConfigManager] Loading config: ${name}`)
				const config = await this.readConfig()
				const apiConfig = config.apiConfigs[name]

				if (!apiConfig) {
					console.error(`[ConfigManager] Config '${name}' not found`)
					throw new Error(`Config '${name}' not found`)
				}

				// Ensure default values for Flow configuration
				if (apiConfig.apiProvider === "flow") {
					console.log("[ConfigManager] Processing Flow configuration:", {
						name,
						hasFlowTenant: !!apiConfig.flowTenant,
						hasBaseUrl: !!apiConfig.flowBaseUrl,
						hasAppToAccess: !!apiConfig.flowAppToAccess,
					})

					apiConfig.flowBaseUrl = apiConfig.flowBaseUrl || "https://flow.ciandt.com"
					apiConfig.flowAppToAccess = apiConfig.flowAppToAccess || "llm-api" // Changed from "default" to "llm-api"

					if (!apiConfig.flowTenant) {
						console.warn(`[ConfigManager] Flow config '${name}' is missing flowTenant`)
					}
				}

				config.currentApiConfigName = name
				await this.writeConfig(config)

				console.log(`[ConfigManager] Successfully loaded config:`, {
					name,
					provider: apiConfig.apiProvider,
					hasFlowBaseUrl: !!apiConfig.flowBaseUrl,
					hasFlowAppToAccess: !!apiConfig.flowAppToAccess,
				})

				return apiConfig
			})
		} catch (error) {
			console.error("[ConfigManager] Error loading config:", error)
			throw new Error(`Failed to load config: ${error}`)
		}
	}

	/**
	 * Delete a config by name
	 */
	async deleteConfig(name: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				// Don't allow deleting the default config
				if (Object.keys(currentConfig.apiConfigs).length === 1) {
					throw new Error(`Cannot delete the last remaining configuration.`)
				}

				delete currentConfig.apiConfigs[name]
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to delete config: ${error}`)
		}
	}

	/**
	 * Set the current active API configuration
	 */
	async setCurrentConfig(name: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				currentConfig.currentApiConfigName = name
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to set current config: ${error}`)
		}
	}

	/**
	 * Check if a config exists by name
	 */
	async hasConfig(name: string): Promise<boolean> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return name in config.apiConfigs
			})
		} catch (error) {
			throw new Error(`Failed to check config existence: ${error}`)
		}
	}

	/**
	 * Set the API config for a specific mode
	 */
	async setModeConfig(mode: Mode, configId: string): Promise<void> {
		try {
			return await this.lock(async () => {
				const currentConfig = await this.readConfig()
				if (!currentConfig.modeApiConfigs) {
					currentConfig.modeApiConfigs = {}
				}
				currentConfig.modeApiConfigs[mode] = configId
				await this.writeConfig(currentConfig)
			})
		} catch (error) {
			throw new Error(`Failed to set mode config: ${error}`)
		}
	}

	/**
	 * Get the API config ID for a specific mode
	 */
	async getModeConfigId(mode: Mode): Promise<string | undefined> {
		try {
			return await this.lock(async () => {
				const config = await this.readConfig()
				return config.modeApiConfigs?.[mode]
			})
		} catch (error) {
			throw new Error(`Failed to get mode config: ${error}`)
		}
	}

	/**
	 * Get the key used for storing config in secrets
	 */
	private getConfigKey(): string {
		return `${this.SCOPE_PREFIX}api_config`
	}

	/**
	 * Reset all configuration by deleting the stored config from secrets
	 */
	public async resetAllConfigs(): Promise<void> {
		return await this.lock(async () => {
			await this.context.secrets.delete(this.getConfigKey())
		})
	}

	private async readConfig(): Promise<ApiConfigData> {
		try {
			console.log("[ConfigManager] Starting readConfig")
			const content = await this.context.secrets.get(this.getConfigKey())
			console.log("[DEBUG] Raw content from secrets:", content)

			if (!content) {
				console.log("[ConfigManager] No config found, returning default config")
				return this.defaultConfig
			}

			console.log("[ConfigManager] Config found in secrets, length:", content.length)
			const parsedConfig = JSON.parse(content)

			// Validate and fix Flow configurations
			if (parsedConfig.apiConfigs) {
				Object.entries(parsedConfig.apiConfigs).forEach(([name, config]: [string, any]) => {
					if (config.apiProvider === "flow") {
						console.log(`[ConfigManager] Found Flow config '${name}':`, {
							hasFlowTenant: "flowTenant" in config,
							flowTenant: config.flowTenant,
							baseUrl: config.flowBaseUrl,
						})

						// Ensure Flow configuration is complete
						if (!config.flowTenant) {
							console.warn(`[ConfigManager] Flow config '${name}' is missing flowTenant`)
						}
					}
				})
			}

			const configDetails = {
				currentConfigName: parsedConfig.currentApiConfigName,
				configNames: Object.keys(parsedConfig.apiConfigs || {}),
				hasFlowConfigs: parsedConfig.apiConfigs
					? Object.values(parsedConfig.apiConfigs).some(
							(cfg) => typeof cfg === "object" && cfg !== null && "flowTenant" in cfg,
						)
					: false,
			}

			console.log("[ConfigManager] Parsed config details:", configDetails)

			// Validate the structure of loaded config
			if (!parsedConfig.apiConfigs) {
				console.error("[ConfigManager] Invalid config structure - missing apiConfigs")
				return this.defaultConfig
			}

			return parsedConfig
		} catch (error) {
			console.error("[ConfigManager] Error reading config:", error)
			throw new Error(`Failed to read config from secrets: ${error}`)
		}
	}

	private async writeConfig(config: ApiConfigData): Promise<void> {
		try {
			console.log("[ConfigManager] Starting writeConfig", {
				currentConfigName: config.currentApiConfigName,
				configNames: Object.keys(config.apiConfigs),
				hasFlowConfig: Object.values(config.apiConfigs).some((cfg) => "flowTenant" in cfg),
			})

			// Log each config's critical fields (excluding sensitive data)
			Object.entries(config.apiConfigs).forEach(([name, cfg]) => {
				console.log(`[ConfigManager] Config '${name}' details:`, {
					id: cfg.id,
					provider: cfg.apiProvider,
					hasFlowTenant: "flowTenant" in cfg,
					flowTenant: cfg.flowTenant,
					hasBaseUrl: "flowBaseUrl" in cfg,
					hasAuthBaseUrl: "flowAuthBaseUrl" in cfg,
				})
			})

			const content = JSON.stringify(config, null, 2)
			console.log("[ConfigManager] Serialized config length:", content.length)

			console.log("[ConfigManager] Attempting to store config in secrets")
			await this.context.secrets.store(this.getConfigKey(), content)
			console.log("[ConfigManager] Config written to secrets successfully")

			// Verify the stored config
			const storedContent = await this.context.secrets.get(this.getConfigKey())
			if (storedContent === content) {
				console.log("[ConfigManager] Stored config verified successfully")
			} else {
				console.error("[ConfigManager] Stored config verification failed")
				throw new Error("Config verification failed after storage")
			}
		} catch (error) {
			console.error("[ConfigManager] Error writing config:", error)
			throw new Error(`Failed to write config to secrets: ${error}`)
		}
	}
}
