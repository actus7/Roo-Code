import React, { useState, useEffect } from "react"
import { VSCodeTextField, VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import type { ProviderSettings } from "@roo-code/types"
import { vscode } from "@src/utils/vscode"
import { FlowModelSelector } from "./FlowModelSelector"

interface FlowProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
}

export const Flow: React.FC<FlowProps> = ({ apiConfiguration, setApiConfigurationField }) => {
	const { t } = useAppTranslation()
	const [isTestingConnection, setIsTestingConnection] = useState(false)
	const [connectionTestResult, setConnectionTestResult] = useState<string | null>(null)
	const [hideOptionalFields, setHideOptionalFields] = useState(true)

	// Listener para resposta do teste de conexão do backend
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "flowConnectionTestResult") {
				setIsTestingConnection(false)
				if (message.success) {
					setConnectionTestResult("✅ Conexão bem-sucedida! Credenciais válidas.")
				} else {
					setConnectionTestResult(`❌ Falha na conexão: ${message.error || "Erro desconhecido"}`)
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	const handleTestConnection = async () => {
		setIsTestingConnection(true)
		setConnectionTestResult("🔄 Testando conexão via Flow Provider...")

		try {
			// Preparar configuração para teste
			const testConfig = {
				flowBaseUrl: apiConfiguration.flowBaseUrl || "https://flow.ciandt.com",
				flowAuthBaseUrl: apiConfiguration.flowAuthBaseUrl,
				flowTenant: apiConfiguration.flowTenant,
				flowClientId: apiConfiguration.flowClientId,
				flowClientSecret: apiConfiguration.flowClientSecret,
				flowAppToAccess: apiConfiguration.flowAppToAccess || "llm-api"
			}

			console.log("🔍 Testando conexão Flow via backend:", {
				baseUrl: testConfig.flowBaseUrl,
				tenant: testConfig.flowTenant,
				clientId: testConfig.flowClientId,
				appToAccess: testConfig.flowAppToAccess
			})

			// Enviar mensagem para o backend testar a conexão usando FlowProvider
			vscode.postMessage({
				type: "testFlowConnection",
				config: testConfig
			})

		} catch (error) {
			console.error("❌ Erro ao enviar teste para backend:", error)
			setConnectionTestResult(`❌ Erro interno: ${error instanceof Error ? error.message : "Erro desconhecido"}`)
			setIsTestingConnection(false)
		}
	}

	const isConfigurationComplete = () => {
		return !!(
			apiConfiguration.flowTenant &&
			apiConfiguration.flowClientId &&
			apiConfiguration.flowClientSecret
		)
	}

	return (
		<div className="space-y-4">
			{/* Seleção de Modelo */}
			<FlowModelSelector
				selectedModel={apiConfiguration.apiModelId}
				onModelChange={(modelId) => setApiConfigurationField("apiModelId", modelId)}
				flowConfig={{
					flowBaseUrl: apiConfiguration.flowBaseUrl,
					flowTenant: apiConfiguration.flowTenant,
					flowClientId: apiConfiguration.flowClientId,
					flowClientSecret: apiConfiguration.flowClientSecret,
					flowAuthBaseUrl: apiConfiguration.flowAuthBaseUrl,
					flowAppToAccess: apiConfiguration.flowAppToAccess
				}}
			/>

			{/* Checkbox para ocultar campos opcionais */}
			<div className="border-b pb-4">
				<VSCodeCheckbox
					checked={hideOptionalFields}
					onChange={(e: any) => setHideOptionalFields(e.target.checked)}>
					<span className="font-medium">Ocultar campos opcionais</span>
				</VSCodeCheckbox>
				<div className="text-vscode-descriptionForeground text-sm mt-1">
					Marque esta opção para mostrar apenas os campos obrigatórios (Tenant, Client ID, Client Secret)
				</div>
			</div>

			{/* Flow Base URL */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Flow Base URL
						<span className="text-xs text-gray-500 ml-2">(Opcional - padrão: https://flow.ciandt.com)</span>
					</label>
					<VSCodeTextField
						value={apiConfiguration.flowBaseUrl || ""}
						placeholder="https://flow.ciandt.com"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							setApiConfigurationField("flowBaseUrl", target.value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Flow Auth Base URL */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Flow Auth Base URL
						<span className="text-xs text-gray-500 ml-2">(Opcional - padrão: mesmo que Base URL)</span>
					</label>
					<VSCodeTextField
						value={apiConfiguration.flowAuthBaseUrl || ""}
						placeholder="https://flow.ciandt.com"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							setApiConfigurationField("flowAuthBaseUrl", target.value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Flow Tenant - Required */}
			<div>
				<label className="block text-sm font-medium mb-2">
					Flow Tenant <span className="text-red-500">*</span>
				</label>
				<VSCodeTextField
					value={apiConfiguration.flowTenant || ""}
					placeholder="cit"
					onInput={(e) => {
						const target = e.target as HTMLInputElement
						setApiConfigurationField("flowTenant", target.value)
					}}
					style={{ width: "100%" }}
				/>
			</div>

			{/* Flow Client ID - Required */}
			<div>
				<label className="block text-sm font-medium mb-2">
					Flow Client ID <span className="text-red-500">*</span>
				</label>
				<VSCodeTextField
					value={apiConfiguration.flowClientId || ""}
					placeholder="seu-client-id"
					onInput={(e) => {
						const target = e.target as HTMLInputElement
						setApiConfigurationField("flowClientId", target.value)
					}}
					style={{ width: "100%" }}
				/>
			</div>

			{/* Flow Client Secret - Required */}
			<div>
				<label className="block text-sm font-medium mb-2">
					Flow Client Secret <span className="text-red-500">*</span>
				</label>
				<VSCodeTextField
					type="password"
					value={apiConfiguration.flowClientSecret || ""}
					placeholder="seu-client-secret"
					onInput={(e) => {
						const target = e.target as HTMLInputElement
						setApiConfigurationField("flowClientSecret", target.value)
					}}
					style={{ width: "100%" }}
				/>
			</div>

			{/* Flow App to Access */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Flow App to Access
						<span className="text-xs text-gray-500 ml-2">(Opcional - padrão: llm-api)</span>
					</label>
					<VSCodeTextField
						value={apiConfiguration.flowAppToAccess || ""}
						placeholder="llm-api"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							setApiConfigurationField("flowAppToAccess", target.value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Flow Agent */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Flow Agent
						<span className="text-xs text-gray-500 ml-2">(Opcional - padrão: chat)</span>
					</label>
					<VSCodeTextField
						value={apiConfiguration.flowAgent || ""}
						placeholder="chat"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							setApiConfigurationField("flowAgent", target.value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Model Temperature */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Model Temperature
						<span className="text-xs text-gray-500 ml-2">(0.0 - 1.0, padrão: 0.7)</span>
					</label>
					<VSCodeTextField
						type="text"
						value={apiConfiguration.modelTemperature?.toString() || ""}
						placeholder="0.7"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							const value = parseFloat(target.value)
							setApiConfigurationField("modelTemperature", isNaN(value) ? undefined : value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Model Max Tokens */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Model Max Tokens
						<span className="text-xs text-gray-500 ml-2">(Opcional)</span>
					</label>
					<VSCodeTextField
						type="text"
						value={apiConfiguration.modelMaxTokens?.toString() || ""}
						placeholder="4000"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							const value = parseInt(target.value)
							setApiConfigurationField("modelMaxTokens", isNaN(value) ? undefined : value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Flow Request Timeout */}
			{!hideOptionalFields && (
				<div>
					<label className="block text-sm font-medium mb-2">
						Request Timeout (ms)
						<span className="text-xs text-gray-500 ml-2">(Padrão: 30000)</span>
					</label>
					<VSCodeTextField
						type="text"
						value={apiConfiguration.flowRequestTimeout?.toString() || ""}
						placeholder="30000"
						onInput={(e) => {
							const target = e.target as HTMLInputElement
							const value = parseInt(target.value)
							setApiConfigurationField("flowRequestTimeout", isNaN(value) ? undefined : value)
						}}
						style={{ width: "100%" }}
					/>
				</div>
			)}

			{/* Connection Test */}
			<div className="border-t pt-4">
				<div className="flex items-center gap-4 mb-2">
					<VSCodeButton
						onClick={handleTestConnection}
						disabled={!isConfigurationComplete() || isTestingConnection}
					>
						{isTestingConnection ? "Testando..." : "Testar Conexão"}
					</VSCodeButton>
				</div>

				{connectionTestResult && (
					<div className="mt-2 p-2 rounded text-sm">
						{connectionTestResult}
					</div>
				)}

				{!isConfigurationComplete() && (
					<div className="mt-2 text-sm text-yellow-600">
						⚠️ Preencha os campos obrigatórios (Tenant, Client ID, Client Secret) para testar a conexão.
					</div>
				)}
			</div>
		</div>
	)
}
