import * as vscode from "vscode"
import { Cline } from "../../Cline"
import { SemanticProcessingManager } from "../SemanticProcessingManager"
import { ContextualizedSuggestion, SemanticContext } from "../types"
import { FileContextTracker } from "../../context-tracking/FileContextTracker"
import { RecordSource } from "../../context-tracking/FileContextTrackerTypes"
import { outputChannel } from "../../../extension"

/**
 * Classe responsável por integrar o sistema de processamento semântico com o Cline
 */
export class ClineSemanticIntegration {
  private static instance: ClineSemanticIntegration
  private semanticProcessingManager: SemanticProcessingManager
  private fileContextCache: Map<string, SemanticContext> = new Map()
  private suggestionCache: Map<string, ContextualizedSuggestion[]> = new Map()

  private constructor(semanticProcessingManager: SemanticProcessingManager) {
    this.semanticProcessingManager = semanticProcessingManager
  }

  /**
   * Obtém a instância única da integração semântica
   */
  public static getInstance(semanticProcessingManager?: SemanticProcessingManager): ClineSemanticIntegration {
    if (!ClineSemanticIntegration.instance && semanticProcessingManager) {
      ClineSemanticIntegration.instance = new ClineSemanticIntegration(semanticProcessingManager)
    }
    return ClineSemanticIntegration.instance
  }

  /**
   * Integra o sistema de processamento semântico com o Cline
   * 
   * @param cline Instância do Cline
   */
  public integrateCline(cline: Cline): void {
    // Estender o FileContextTracker do Cline para usar o sistema de processamento semântico
    this.extendFileContextTracker(cline.getFileContextTracker())

    // Adicionar métodos ao Cline para acessar o sistema de processamento semântico
    this.extendCline(cline)

    outputChannel.appendLine(`[ClineSemanticIntegration] Integração semântica configurada para o Cline ${cline.taskId}`)
  }

  /**
   * Estende o FileContextTracker para usar o sistema de processamento semântico
   * 
   * @param fileContextTracker Instância do FileContextTracker
   */
  private extendFileContextTracker(fileContextTracker: FileContextTracker): void {
    // Sobrescrever o método trackFileContext para adicionar análise semântica
    const originalTrackFileContext = fileContextTracker.trackFileContext.bind(fileContextTracker)
    
    fileContextTracker.trackFileContext = async (filePath: string, operation: RecordSource) => {
      // Chamar o método original primeiro
      await originalTrackFileContext(filePath, operation)
      
      try {
        // Adicionar análise semântica
        const semanticContext = await this.semanticProcessingManager.analyzeFile(filePath)
        this.fileContextCache.set(filePath, semanticContext)
        
        // Gerar sugestões contextualizadas se for uma operação de leitura ou edição
        if (operation === 'read_tool' || operation === 'file_mentioned' || operation === 'roo_edited') {
          // Obter o conteúdo do arquivo
          const fileUri = vscode.Uri.file(filePath)
          const fileContent = await vscode.workspace.fs.readFile(fileUri)
          const content = Buffer.from(fileContent).toString('utf8')
          
          // Gerar sugestões
          const suggestions = await this.semanticProcessingManager.generateContextualizedSuggestions(filePath, content)
          this.suggestionCache.set(filePath, suggestions)
          
          outputChannel.appendLine(`[ClineSemanticIntegration] Geradas ${suggestions.length} sugestões para ${filePath}`)
        }
      } catch (error) {
        outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao processar análise semântica: ${error}`)
      }
    }
  }

  /**
   * Estende o Cline para acessar o sistema de processamento semântico
   * 
   * @param cline Instância do Cline
   */
  private extendCline(cline: Cline): void {
    // Adicionar método para obter o contexto semântico
    (cline as any).getSemanticContext = async (filePath: string): Promise<SemanticContext> => {
      if (this.fileContextCache.has(filePath)) {
        return this.fileContextCache.get(filePath)!
      }
      
      try {
        const semanticContext = await this.semanticProcessingManager.analyzeFile(filePath)
        this.fileContextCache.set(filePath, semanticContext)
        return semanticContext
      } catch (error) {
        outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao obter contexto semântico: ${error}`)
        throw error
      }
    }
    
    // Adicionar método para obter sugestões contextualizadas
    (cline as any).getContextualizedSuggestions = async (filePath: string, fileContent: string): Promise<ContextualizedSuggestion[]> => {
      try {
        const suggestions = await this.semanticProcessingManager.generateContextualizedSuggestions(filePath, fileContent)
        this.suggestionCache.set(filePath, suggestions)
        return suggestions
      } catch (error) {
        outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao gerar sugestões contextualizadas: ${error}`)
        throw error
      }
    }
    
    // Adicionar método para obter arquivos relacionados
    (cline as any).getRelatedFiles = async (filePath: string): Promise<{ file: string; relevance: number }[]> => {
      try {
        return await this.semanticProcessingManager.getRelatedFiles(filePath)
      } catch (error) {
        outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao obter arquivos relacionados: ${error}`)
        throw error
      }
    }
    
    // Adicionar método para registrar feedback de sugestão
    (cline as any).recordSuggestionFeedback = (suggestionId: string, accepted: boolean, suggestionType: string): void => {
      try {
        this.semanticProcessingManager.recordSuggestionFeedback(suggestionId, accepted, suggestionType)
      } catch (error) {
        outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao registrar feedback de sugestão: ${error}`)
      }
    }
  }

  /**
   * Obtém o contexto semântico para um arquivo
   * 
   * @param filePath Caminho do arquivo
   * @returns Contexto semântico
   */
  public async getSemanticContext(filePath: string): Promise<SemanticContext> {
    if (this.fileContextCache.has(filePath)) {
      return this.fileContextCache.get(filePath)!
    }
    
    try {
      const semanticContext = await this.semanticProcessingManager.analyzeFile(filePath)
      this.fileContextCache.set(filePath, semanticContext)
      return semanticContext
    } catch (error) {
      outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao obter contexto semântico: ${error}`)
      throw error
    }
  }

  /**
   * Obtém sugestões contextualizadas para um arquivo
   * 
   * @param filePath Caminho do arquivo
   * @param fileContent Conteúdo do arquivo
   * @returns Lista de sugestões contextualizadas
   */
  public async getContextualizedSuggestions(filePath: string, fileContent: string): Promise<ContextualizedSuggestion[]> {
    try {
      const suggestions = await this.semanticProcessingManager.generateContextualizedSuggestions(filePath, fileContent)
      this.suggestionCache.set(filePath, suggestions)
      return suggestions
    } catch (error) {
      outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao gerar sugestões contextualizadas: ${error}`)
      throw error
    }
  }

  /**
   * Obtém arquivos relacionados a um arquivo
   * 
   * @param filePath Caminho do arquivo
   * @returns Lista de arquivos relacionados com scores de relevância
   */
  public async getRelatedFiles(filePath: string): Promise<{ file: string; relevance: number }[]> {
    try {
      return await this.semanticProcessingManager.getRelatedFiles(filePath)
    } catch (error) {
      outputChannel.appendLine(`[ClineSemanticIntegration] Erro ao obter arquivos relacionados: ${error}`)
      throw error
    }
  }

  /**
   * Limpa o cache de contexto semântico
   */
  public clearCache(): void {
    this.fileContextCache.clear()
    this.suggestionCache.clear()
  }
}
