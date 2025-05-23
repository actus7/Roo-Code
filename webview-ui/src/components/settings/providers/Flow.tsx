import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { ProviderSettings } from "@roo/exports/types"
import { ModelSelect } from "../ModelSelect"
import { Input } from "../../../components/ui"
import { flowModels } from "@roo/shared/api/models"
import { useFlowModels } from "@/components/ui/hooks/useFlowModels"

interface FlowProviderProps {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: <K extends keyof ProviderSettings>(field: K, value: ProviderSettings[K]) => void
	showModelSelector?: boolean
}

export const Flow: React.FC<FlowProviderProps> = ({
	apiConfiguration,
	setApiConfigurationField,
	showModelSelector = true,
}) => {
	const { t } = useTranslation()
	const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

	// Definindo valores padrão
	const defaultBaseUrl = "https://flow.ciandt.com"
	const defaultAppToAccess = "llm-api"
	const defaultAgent = "chat"

	// Buscar modelos dinamicamente quando as credenciais estiverem configuradas
	const {
		data: dynamicModels,
		isLoading,
		error,
	} = useFlowModels(
		apiConfiguration.flowTenant,
		apiConfiguration.flowClientId,
		apiConfiguration.flowClientSecret,
		apiConfiguration.flowAuthBaseUrl || defaultBaseUrl,
	)

	// Usar modelos dinâmicos se disponíveis, caso contrário usar os estáticos como fallback
	const allModels = React.useMemo(() => {
		// Se temos modelos dinâmicos e há pelo menos um modelo, use apenas os modelos dinâmicos
		if (dynamicModels && Object.keys(dynamicModels).length > 0) {
			return dynamicModels
		}
		// Caso contrário, use os modelos estáticos como fallback
		return flowModels
	}, [dynamicModels])

	// Atualizar o modelo selecionado se necessário
	useEffect(() => {
		if (dynamicModels && Object.keys(dynamicModels).length > 0) {
			if (!apiConfiguration.apiModelId) {
				// Selecionar o primeiro modelo disponível como padrão se não houver um selecionado
				const firstModelId = Object.keys(dynamicModels)[0]
				if (firstModelId) {
					setApiConfigurationField("apiModelId", firstModelId)
					setErrorMessage(null)
				}
			} else {
				// Verificar se o modelo selecionado existe na lista de modelos disponíveis
				if (!Object.keys(allModels).includes(apiConfiguration.apiModelId)) {
					setErrorMessage("O modelo selecionado não está disponível. Por favor, selecione outro modelo.")
				} else {
					setErrorMessage(null)
				}
			}
		}
	}, [dynamicModels, apiConfiguration.apiModelId, setApiConfigurationField, allModels])

	// Verificar se há credenciais configuradas
	const hasCredentials = !!(
		apiConfiguration.flowTenant &&
		apiConfiguration.flowClientId &&
		apiConfiguration.flowClientSecret
	)

	return (
		<div className="space-y-4">
			{showModelSelector && (
				<div>
					<label className="block font-medium mb-1">{t("settings:providers.model")}</label>
					<ModelSelect
						value={apiConfiguration.apiModelId}
						onChange={(value) => setApiConfigurationField("apiModelId", value)}
						options={Object.entries(allModels).map(([id, model]) => ({
							value: id,
							label: id,
							description: model.contextWindow
								? `${model.contextWindow / 1000}k contexto${model.supportsImages ? ", suporta imagens" : ""}`
								: undefined,
						}))}
					/>
					{isLoading && hasCredentials && (
						<div className="text-sm text-vscode-descriptionForeground mt-1">
							{t("settings:common.loading")}
						</div>
					)}
					{error && hasCredentials && (
						<div className="text-sm text-red-500 mt-1">Erro ao carregar modelos: {error.message}</div>
					)}
					{errorMessage && <div className="text-sm text-red-500 mt-1">{errorMessage}</div>}
					{!hasCredentials && (
						<div className="text-sm text-vscode-descriptionForeground mt-1">
							Configure as credenciais do Flow para carregar os modelos disponíveis
						</div>
					)}
					{!isLoading && !error && hasCredentials && Object.keys(allModels).length === 0 && (
						<div className="text-sm text-yellow-500 mt-1">
							Nenhum modelo encontrado. Verifique suas credenciais.
						</div>
					)}
					{hasCredentials && Object.keys(allModels).length > 0 && (
						<div className="text-sm text-green-500 mt-1">
							{Object.keys(allModels).length} modelos disponíveis
						</div>
					)}
				</div>
			)}

			<div>
				<label className="block font-medium mb-1">Base URL</label>
				<Input
					placeholder={defaultBaseUrl}
					value={apiConfiguration.flowAuthBaseUrl || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowAuthBaseUrl", e.target.value || defaultBaseUrl)
					}
				/>
			</div>

			<div>
				<label className="block font-medium mb-1">
					Tenant <span className="text-red-500">*</span>
				</label>
				<Input
					placeholder="cit"
					value={apiConfiguration.flowTenant || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowTenant", e.target.value)
					}
				/>
			</div>

			<div>
				<label className="block font-medium mb-1">
					Cliente ID <span className="text-red-500">*</span>
				</label>
				<Input
					value={apiConfiguration.flowClientId || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowClientId", e.target.value)
					}
				/>
			</div>

			<div>
				<label className="block font-medium mb-1">
					Cliente Secret <span className="text-red-500">*</span>
				</label>
				<Input
					type="password"
					value={apiConfiguration.flowClientSecret || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowClientSecret", e.target.value)
					}
				/>
			</div>

			<div>
				<label className="block font-medium mb-1">App To Access</label>
				<Input
					placeholder={defaultAppToAccess}
					value={apiConfiguration.flowAppToAccess || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowAppToAccess", e.target.value || defaultAppToAccess)
					}
				/>
			</div>

			<div>
				<label className="block font-medium mb-1">Agent</label>
				<Input
					placeholder={defaultAgent}
					value={apiConfiguration.flowAgent || ""}
					onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
						setApiConfigurationField("flowAgent", e.target.value || defaultAgent)
					}
				/>
			</div>
		</div>
	)
}

export default Flow
