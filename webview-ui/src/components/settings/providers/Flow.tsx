import { useCallback } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { ApiConfiguration, flowDefaultModelId, flowModels } from "@roo/shared/api"

import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type FlowProps = {
	apiConfiguration: ApiConfiguration
	setApiConfigurationField: (field: keyof ApiConfiguration, value: ApiConfiguration[keyof ApiConfiguration]) => void
}

export const Flow = ({ apiConfiguration, setApiConfigurationField }: FlowProps) => {

	const handleInputChange = useCallback(
		<K extends keyof ApiConfiguration, E>(
			field: K,
			transform: (event: E) => ApiConfiguration[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.flowClientId || ""}
				type="password"
				onInput={handleInputChange("flowClientId")}
				placeholder="Digite o Client ID..."
				className="w-full">
				<span className="font-medium">Flow Client ID</span>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.flowClientSecret || ""}
				type="password"
				onInput={handleInputChange("flowClientSecret")}
				placeholder="Digite o Client Secret..."
				className="w-full">
				<span className="font-medium">Flow Client Secret</span>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.flowTenant || ""}
				onInput={handleInputChange("flowTenant")}
				placeholder="Digite o Tenant..."
				className="w-full">
				<span className="font-medium">Flow Tenant</span>
			</VSCodeTextField>
			<VSCodeTextField
				value={apiConfiguration?.flowBaseUrl || ""}
				type="url"
				onInput={handleInputChange("flowBaseUrl")}
				placeholder="Padrão: https://flow.ciandt.com"
				className="w-full">
				<span className="font-medium">Flow Base URL (Opcional)</span>
			</VSCodeTextField>
			{apiConfiguration?.flowClientId && apiConfiguration?.flowClientSecret ? (
				<>
					{Object.keys(flowModels).length > 0 ? (
						<ModelPicker
							apiConfiguration={apiConfiguration}
							setApiConfigurationField={setApiConfigurationField}
							defaultModelId={flowDefaultModelId}
							defaultModelInfo={flowModels[flowDefaultModelId]}
							models={flowModels}
							modelIdKey="flowModelId"
							modelInfoKey="flowModelInfo"
							serviceName="Flow"
							serviceUrl="https://flow.ciandt.com"
						/>
					) : (
						<div className="text-sm text-vscode-warningForeground">Carregando modelos disponíveis...</div>
					)}
				</>
			) : (
				<div className="text-sm text-vscode-descriptionForeground">
					Para selecionar um modelo, insira suas credenciais Flow primeiro.
				</div>
			)}
			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				Essas credenciais são armazenadas localmente e usadas apenas para fazer requisições de API desta
				extensão.
			</div>
			{!apiConfiguration?.flowClientId && (
				<VSCodeButtonLink href="https://flow.ciandt.com/settings/api-keys" appearance="secondary">
					Obter Credenciais do Flow
				</VSCodeButtonLink>
			)}
		</>
	)
}
