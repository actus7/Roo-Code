import { useCallback } from "react"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

interface FollowUpSuggestProps {
	suggestions?: string[]
	onSuggestionClick?: (answer: string) => void
	ts: number
}

const FollowUpSuggest = ({ suggestions = [], onSuggestionClick, ts = 1 }: FollowUpSuggestProps) => {
	const handleSuggestionClick = useCallback(
		(suggestion: string) => {
			if (!suggestion.trim()) return // Ignora sugestões vazias
			onSuggestionClick?.(suggestion)
		},
		[onSuggestionClick],
	)

	// Filtra sugestões vazias ou malformadas
	const validSuggestions = suggestions.filter((s) => s && typeof s === "string" && s.trim())

	if (!validSuggestions?.length || !onSuggestionClick) {
		return null
	}

	return (
		<div className="flex flex-col gap-2">
			{validSuggestions.map((suggestion, index) => (
				<Button
					key={`${suggestion}-${ts}-${index}`}
					variant="outline"
					className={cn("text-left")}
					onClick={() => handleSuggestionClick(suggestion)}>
					{suggestion}
				</Button>
			))}
		</div>
	)
}

export default FollowUpSuggest
