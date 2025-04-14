import * as vscode from "vscode"
import * as path from "path"
import { SemanticProcessingManager } from "./SemanticProcessingManager"
import { DependencyGraphView, SuggestionsView, ValidationReportView } from "./views"
import { outputChannel } from "../../extension"

/**
 * Registra os comandos do sistema de processamento semântico
 *
 * @param context Contexto da extensão
 * @param semanticProcessingManager Gerenciador de processamento semântico
 */
export async function registerSemanticCommands(
  context: vscode.ExtensionContext,
  semanticProcessingManager: SemanticProcessingManager
): Promise<void> {
  // Obter comandos existentes
  const existingCommands = await vscode.commands.getCommands(true);

  // Registrar comandos já existentes para depuração
  const semanticCommands = [
    'roo-code.analyzeCurrentFile',
    'roo-code.viewDependencyGraph',
    'roo-code.generateSuggestions',
    'roo-code.recordSuggestionFeedback',
    'roo-code.generateValidationReport',
    'roo-code.showRelatedFiles'
  ];

  for (const command of semanticCommands) {
    if (existingCommands.includes(command)) {
      outputChannel.appendLine(`Comando já existente: ${command}`);
    }
  }

  // Comando para analisar o arquivo atual
  if (!existingCommands.includes('roo-code.analyzeCurrentFile')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.analyzeCurrentFile', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const filePath = editor.document.uri.fsPath;
          try {
            const semanticContext = await semanticProcessingManager.analyzeFile(filePath);
            outputChannel.appendLine(`Arquivo analisado: ${filePath}`);
            outputChannel.appendLine(`Nós relevantes: ${semanticContext.relevantNodes.length}`);
            vscode.window.showInformationMessage(`Arquivo analisado: ${filePath}`);
          } catch (error) {
            outputChannel.appendLine(`Erro ao analisar arquivo: ${error}`);
            vscode.window.showErrorMessage(`Erro ao analisar arquivo: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          vscode.window.showWarningMessage('Nenhum arquivo aberto para análise');
        }
      })
    );
  }

  // Comando para visualizar o grafo de dependências
  if (!existingCommands.includes('roo-code.viewDependencyGraph')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.viewDependencyGraph', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const filePath = editor.document.uri.fsPath;
          try {
            // Analisar o arquivo para obter o grafo
            const semanticContext = await semanticProcessingManager.analyzeFile(filePath);
            const nodes = semanticContext.relevantNodes;
            const edges = semanticContext.relevantEdges;

            // Exibir o grafo
            DependencyGraphView.show(filePath, nodes, edges);

            outputChannel.appendLine(`Grafo de dependências gerado para ${filePath}`);
          } catch (error) {
            outputChannel.appendLine(`Erro ao gerar grafo de dependências: ${error}`);
            vscode.window.showErrorMessage(`Erro ao gerar grafo de dependências: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          vscode.window.showWarningMessage('Nenhum arquivo aberto para visualização');
        }
      })
    );
  }

  // Comando para gerar sugestões contextualizadas
  if (!existingCommands.includes('roo-code.generateSuggestions')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.generateSuggestions', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const filePath = editor.document.uri.fsPath;
          const fileContent = editor.document.getText();

          try {
            // Gerar sugestões
            const suggestions = await semanticProcessingManager.generateContextualizedSuggestions(filePath, fileContent);

            if (suggestions.length > 0) {
              // Exibir sugestões
              SuggestionsView.show(filePath, suggestions, async (suggestion) => {
                // Callback para quando uma sugestão é aceita
                try {
                  // Aplicar a sugestão (inserir no editor)
                  const edit = new vscode.WorkspaceEdit();

                  // Substituir todo o conteúdo do arquivo (simplificado)
                  // Em uma implementação real, seria melhor aplicar apenas as alterações necessárias
                  edit.replace(
                    editor.document.uri,
                    new vscode.Range(0, 0, editor.document.lineCount, 0),
                    suggestion.content
                  );

                  await vscode.workspace.applyEdit(edit);

                  // Registrar feedback positivo
                  semanticProcessingManager.recordSuggestionFeedback(suggestion.id, true, suggestion.type);

                  vscode.window.showInformationMessage(`Sugestão aplicada com sucesso`);
                } catch (error) {
                  outputChannel.appendLine(`Erro ao aplicar sugestão: ${error}`);
                  vscode.window.showErrorMessage(`Erro ao aplicar sugestão: ${error instanceof Error ? error.message : String(error)}`);
                }
              });

              outputChannel.appendLine(`${suggestions.length} sugestões geradas para ${filePath}`);
            } else {
              vscode.window.showInformationMessage('Nenhuma sugestão disponível para este arquivo');
            }
          } catch (error) {
            outputChannel.appendLine(`Erro ao gerar sugestões: ${error}`);
            vscode.window.showErrorMessage(`Erro ao gerar sugestões: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          vscode.window.showWarningMessage('Nenhum arquivo aberto para gerar sugestões');
        }
      })
    );
  }

  // Comando para registrar feedback de sugestão
  if (!existingCommands.includes('roo-code.recordSuggestionFeedback')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.recordSuggestionFeedback',
        (suggestionId: string, accepted: boolean, suggestionType: string) => {
          try {
            semanticProcessingManager.recordSuggestionFeedback(suggestionId, accepted, suggestionType);
            outputChannel.appendLine(`Feedback registrado para sugestão ${suggestionId}: ${accepted ? 'aceita' : 'rejeitada'}`);
          } catch (error) {
            outputChannel.appendLine(`Erro ao registrar feedback: ${error}`);
          }
        }
      )
    );
  }

  // Comando para gerar relatório de validação
  if (!existingCommands.includes('roo-code.generateValidationReport')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.generateValidationReport', async () => {
        try {
          const report = semanticProcessingManager.continuousValidationEngine.generateValidationReport();

          // Extrair métricas de todas as dimensões
          const allMetrics = [
            ...report.accuracy.metrics,
            ...report.speed.metrics,
            ...report.quality.metrics,
            ...report.usability.metrics
          ];

          // Exibir relatório
          ValidationReportView.show(allMetrics);

          outputChannel.appendLine('Relatório de validação gerado');
        } catch (error) {
          outputChannel.appendLine(`Erro ao gerar relatório de validação: ${error}`);
          vscode.window.showErrorMessage(`Erro ao gerar relatório de validação: ${error instanceof Error ? error.message : String(error)}`);
        }
      })
    );
  }

  // Comando para mostrar arquivos relacionados
  if (!existingCommands.includes('roo-code.showRelatedFiles')) {
    context.subscriptions.push(
      vscode.commands.registerCommand('roo-code.showRelatedFiles', async () => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
          const filePath = editor.document.uri.fsPath;
          try {
            // Obter arquivos relacionados
            const relatedFiles = await semanticProcessingManager.getRelatedFiles(filePath);

            if (relatedFiles.length > 0) {
              // Mostrar arquivos relacionados em um QuickPick
              const items = relatedFiles.map(({ file, relevance }) => ({
                label: path.basename(file),
                description: `${Math.round(relevance * 100)}% relevante`,
                detail: file,
                relevance
              }));

              const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Selecione um arquivo relacionado para abrir',
                matchOnDescription: true,
                matchOnDetail: true
              });

              if (selected) {
                // Abrir o arquivo selecionado
                const document = await vscode.workspace.openTextDocument(selected.detail);
                await vscode.window.showTextDocument(document);
              }
            } else {
              vscode.window.showInformationMessage('Nenhum arquivo relacionado encontrado');
            }
          } catch (error) {
            outputChannel.appendLine(`Erro ao obter arquivos relacionados: ${error}`);
            vscode.window.showErrorMessage(`Erro ao obter arquivos relacionados: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          vscode.window.showWarningMessage('Nenhum arquivo aberto para análise');
        }
      })
    );
  }
}
