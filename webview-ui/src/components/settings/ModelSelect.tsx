import React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

export interface ModelOption {
	value: string
	label: string
	description?: string
}

interface ModelSelectProps {
	value?: string
	onChange: (value: string) => void
	options: ModelOption[]
}

export const ModelSelect: React.FC<ModelSelectProps> = ({ value, onChange, options }) => {
	return (
		<Select value={value || ""} onValueChange={onChange}>
			<SelectTrigger>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{options.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						<div className="flex flex-col">
							<span className="font-medium">{option.label}</span>
							{option.description && (
								<span className="text-sm text-vscode-descriptionForeground">{option.description}</span>
							)}
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
