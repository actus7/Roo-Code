export function getAskFollowupQuestionDescription(): string {
	return `## ask_followup_question
Description: Ask the user a question to gather additional information needed to complete the task. This tool should be used when you encounter ambiguities, need clarification, or require more details to proceed effectively. It allows for interactive problem-solving by enabling direct communication with the user. Use this tool judiciously to maintain a balance between gathering necessary information and avoiding excessive back-and-forth.
Parameters:
- question: (required) The question to ask the user. This should be a clear, specific question that addresses the information you need.
- follow_up: (required) A list of 2-4 suggested answers that logically follow from the question, ordered by priority or logical sequence. Each suggestion must:
  1. Be provided in its own <suggest> tag
  2. Be specific, actionable, and directly related to the completed task
  3. Be a complete answer to the question - the user should not need to provide additional information or fill in any missing details. DO NOT include placeholders with brackets or parentheses.
Usage:
<ask_followup_question>
<question>Your question here</question>
<follow_up>
<suggest>
Your suggested answer here
</suggest>
</follow_up>
</ask_followup_question>

Example: Requesting to ask the user for the path to the frontend-config.json file
<ask_followup_question>
<question>What is the path to the frontend-config.json file?</question>
<follow_up>
<suggest>./src/frontend-config.json</suggest>
<suggest>./config/frontend-config.json</suggest>
<suggest>./frontend-config.json</suggest>
</follow_up>
</ask_followup_question>`
}

const formatFollowUpQuestion = (question: string, suggestions: string[]) => {
	return `<ask_followup_question>
<question>${question}</question>
<follow_up>
${suggestions.map((suggestion) => `<suggest>${suggestion}</suggest>`).join("\n")}
</follow_up>
</ask_followup_question>`
}

// Exemplo de uso:
const question = "Qual tarefa específica gostaria que eu realizasse?"
const suggestions = [
	"Editar um arquivo específico no projeto",
	"Adicionar uma nova funcionalidade ao código existente",
	"Corrigir um bug ou problema",
	"Realizar testes ou garantir cobertura de código",
]

const formattedQuestion = formatFollowUpQuestion(question, suggestions)
