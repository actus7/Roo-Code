import * as vscode from "vscode"
import * as path from "path"
import { ContextualizedSuggestion } from "../types"

/**
 * Classe responsável por criar e gerenciar a visualização de sugestões contextualizadas
 */
export class SuggestionsView {
  /**
   * Cria e exibe uma visualização de sugestões contextualizadas
   * 
   * @param filePath Caminho do arquivo
   * @param suggestions Lista de sugestões contextualizadas
   * @param onAccept Callback para quando uma sugestão é aceita
   */
  public static show(
    filePath: string, 
    suggestions: ContextualizedSuggestion[],
    onAccept: (suggestion: ContextualizedSuggestion) => void
  ): void {
    // Criar um painel webview para exibir as sugestões
    const panel = vscode.window.createWebviewPanel(
      'contextualizedSuggestions',
      `Sugestões para: ${path.basename(filePath)}`,
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );
    
    // Ordenar sugestões por relevância
    const sortedSuggestions = [...suggestions].sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Criar HTML para as sugestões
    panel.webview.html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Sugestões Contextualizadas</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
          }
          .suggestion {
            margin-bottom: 20px;
            padding: 15px;
            border-radius: 5px;
            border: 1px solid var(--vscode-panel-border);
            background-color: var(--vscode-editor-background);
          }
          .suggestion-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
          }
          .suggestion-title {
            font-size: 16px;
            font-weight: bold;
            color: var(--vscode-editor-foreground);
          }
          .suggestion-type {
            font-size: 12px;
            padding: 3px 8px;
            border-radius: 10px;
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
          }
          .suggestion-content {
            background-color: var(--vscode-textCodeBlock-background);
            padding: 10px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
            font-size: var(--vscode-editor-font-size);
            white-space: pre-wrap;
            overflow-x: auto;
            margin-bottom: 10px;
          }
          .suggestion-explanation {
            font-size: 14px;
            margin-bottom: 10px;
            color: var(--vscode-descriptionForeground);
          }
          .suggestion-metrics {
            display: flex;
            gap: 15px;
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
          .suggestion-metric {
            display: flex;
            align-items: center;
          }
          .suggestion-actions {
            margin-top: 10px;
            display: flex;
            gap: 10px;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .secondary {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .secondary:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
          }
          .filter-bar {
            margin-bottom: 20px;
            display: flex;
            gap: 10px;
          }
          .filter-button {
            background-color: transparent;
            border: 1px solid var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-radius: 15px;
            padding: 4px 10px;
            font-size: 12px;
            cursor: pointer;
          }
          .filter-button.active {
            background-color: var(--vscode-button-background);
          }
          .no-suggestions {
            text-align: center;
            padding: 30px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <h1>Sugestões Contextualizadas</h1>
        <p>Arquivo: ${path.basename(filePath)}</p>
        
        <div class="filter-bar">
          <button class="filter-button active" data-filter="all">Todas (${suggestions.length})</button>
          <button class="filter-button" data-filter="code">Código (${suggestions.filter(s => s.type === 'code').length})</button>
          <button class="filter-button" data-filter="refactor">Refatoração (${suggestions.filter(s => s.type === 'refactor').length})</button>
          <button class="filter-button" data-filter="test">Testes (${suggestions.filter(s => s.type === 'test').length})</button>
          <button class="filter-button" data-filter="documentation">Documentação (${suggestions.filter(s => s.type === 'documentation').length})</button>
          <button class="filter-button" data-filter="architecture">Arquitetura (${suggestions.filter(s => s.type === 'architecture').length})</button>
        </div>
        
        <div id="suggestions-container">
          ${sortedSuggestions.length > 0 ? sortedSuggestions.map((suggestion, index) => `
            <div class="suggestion" data-type="${suggestion.type}">
              <div class="suggestion-header">
                <div class="suggestion-title">Sugestão ${index + 1}</div>
                <div class="suggestion-type">${getTypeLabel(suggestion.type)}</div>
              </div>
              <div class="suggestion-content">${escapeHtml(suggestion.content)}</div>
              ${suggestion.explanation ? `<div class="suggestion-explanation">${suggestion.explanation}</div>` : ''}
              <div class="suggestion-metrics">
                <div class="suggestion-metric">Relevância: ${Math.round(suggestion.relevanceScore * 100)}%</div>
                <div class="suggestion-metric">Confiança: ${Math.round(suggestion.confidence * 100)}%</div>
              </div>
              <div class="suggestion-actions">
                <button class="apply-button" data-id="${suggestion.id}">Aplicar</button>
                <button class="secondary feedback-button" data-id="${suggestion.id}" data-accepted="true">Útil</button>
                <button class="secondary feedback-button" data-id="${suggestion.id}" data-accepted="false">Não Útil</button>
              </div>
            </div>
          `).join('') : '<div class="no-suggestions">Nenhuma sugestão disponível para este arquivo.</div>'}
        </div>
        
        <script>
          // Mapeamento de sugestões por ID
          const suggestionsMap = ${JSON.stringify(suggestions.reduce((map, suggestion) => {
            map[suggestion.id] = suggestion;
            return map;
          }, {} as Record<string, ContextualizedSuggestion>))};
          
          // Configurar botões de filtro
          document.querySelectorAll('.filter-button').forEach(button => {
            button.addEventListener('click', () => {
              // Atualizar estado ativo
              document.querySelectorAll('.filter-button').forEach(b => b.classList.remove('active'));
              button.classList.add('active');
              
              // Aplicar filtro
              const filter = button.getAttribute('data-filter');
              const suggestions = document.querySelectorAll('.suggestion');
              
              suggestions.forEach(suggestion => {
                if (filter === 'all' || suggestion.getAttribute('data-type') === filter) {
                  suggestion.style.display = 'block';
                } else {
                  suggestion.style.display = 'none';
                }
              });
            });
          });
          
          // Configurar botões de aplicar
          document.querySelectorAll('.apply-button').forEach(button => {
            button.addEventListener('click', () => {
              const suggestionId = button.getAttribute('data-id');
              const vscode = acquireVsCodeApi();
              vscode.postMessage({
                command: 'applySuggestion',
                suggestionId: suggestionId
              });
            });
          });
          
          // Configurar botões de feedback
          document.querySelectorAll('.feedback-button').forEach(button => {
            button.addEventListener('click', () => {
              const suggestionId = button.getAttribute('data-id');
              const accepted = button.getAttribute('data-accepted') === 'true';
              const vscode = acquireVsCodeApi();
              vscode.postMessage({
                command: 'suggestionFeedback',
                suggestionId: suggestionId,
                accepted: accepted
              });
              
              // Desabilitar botões de feedback para esta sugestão
              const suggestionElement = button.closest('.suggestion');
              suggestionElement.querySelectorAll('.feedback-button').forEach(b => {
                b.disabled = true;
                b.style.opacity = '0.5';
              });
              
              // Destacar o botão clicado
              button.style.backgroundColor = accepted ? 'var(--vscode-testing-iconPassed)' : 'var(--vscode-testing-iconFailed)';
              button.style.color = 'white';
            });
          });
        </script>
      </body>
      </html>
    `;
    
    // Manipular mensagens da webview
    panel.webview.onDidReceiveMessage(
      message => {
        switch (message.command) {
          case 'applySuggestion':
            const suggestion = suggestions.find(s => s.id === message.suggestionId);
            if (suggestion) {
              onAccept(suggestion);
            }
            return;
          case 'suggestionFeedback':
            const feedbackSuggestion = suggestions.find(s => s.id === message.suggestionId);
            if (feedbackSuggestion) {
              // Emitir evento de feedback
              vscode.commands.executeCommand(
                'roo-code.recordSuggestionFeedback', 
                message.suggestionId, 
                message.accepted, 
                feedbackSuggestion.type
              );
            }
            return;
        }
      },
      undefined,
      []
    );
  }
}

/**
 * Obtém o rótulo para um tipo de sugestão
 */
function getTypeLabel(type: string): string {
  switch (type) {
    case 'code': return 'Código';
    case 'refactor': return 'Refatoração';
    case 'test': return 'Teste';
    case 'documentation': return 'Documentação';
    case 'architecture': return 'Arquitetura';
    default: return type;
  }
}

/**
 * Escapa HTML para evitar injeção de código
 */
function escapeHtml(html: string): string {
  return html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
