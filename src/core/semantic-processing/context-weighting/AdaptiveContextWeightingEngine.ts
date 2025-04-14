import * as vscode from "vscode"
import * as path from "path"
import { DependencyNode, DependencyEdge, SemanticContext } from "../types"
import { HybridAnalysisEngine } from "../hybrid-analysis/HybridAnalysisEngine"
import { TemporalCorrelationEngine } from "../temporal-correlation/TemporalCorrelationEngine"
import { DependencyGraphManager } from "../dependency-graph/DependencyGraphManager"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"

/**
 * Mecanismo de Ponderação Contextual Adaptativa
 * 
 * Calcula continuamente a relevância de cada elemento do código com base em múltiplas dimensões,
 * incluindo proximidade sintática, frequência de acesso e padrões históricos.
 */
export class AdaptiveContextWeightingEngine {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private hybridAnalysisEngine: HybridAnalysisEngine;
  private temporalCorrelationEngine: TemporalCorrelationEngine;
  private dependencyGraphManager: DependencyGraphManager;
  
  // Rastreamento de acesso a arquivos e elementos
  private fileAccessCounts: Map<string, number> = new Map();
  private nodeAccessCounts: Map<string, number> = new Map();
  private lastAccessTimes: Map<string, number> = new Map();
  
  // Pesos para diferentes dimensões
  private weights = {
    syntacticProximity: 0.3,
    accessFrequency: 0.25,
    temporalCorrelation: 0.2,
    dependencyStrength: 0.25
  };

  constructor(
    context: vscode.ExtensionContext,
    hybridAnalysisEngine: HybridAnalysisEngine,
    temporalCorrelationEngine: TemporalCorrelationEngine,
    dependencyGraphManager: DependencyGraphManager
  ) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.hybridAnalysisEngine = hybridAnalysisEngine;
    this.temporalCorrelationEngine = temporalCorrelationEngine;
    this.dependencyGraphManager = dependencyGraphManager;
    this.initialize();
  }

  /**
   * Inicializa o mecanismo de ponderação contextual
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Configurar monitoramento de acesso a arquivos
    this.setupAccessTracking();
    
    // Carregar dados históricos de acesso, se disponíveis
    await this.loadAccessHistory();
  }

  /**
   * Configura o monitoramento de acesso a arquivos
   */
  private setupAccessTracking(): void {
    // Monitorar abertura de arquivos
    vscode.workspace.onDidOpenTextDocument(document => {
      this.recordFileAccess(document.uri.fsPath);
    });
    
    // Monitorar mudança de editor ativo
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor) {
        this.recordFileAccess(editor.document.uri.fsPath);
      }
    });
    
    // Monitorar seleção de texto para rastrear acesso a elementos específicos
    vscode.window.onDidChangeTextEditorSelection(event => {
      this.handleSelectionChange(event);
    });
  }

  /**
   * Carrega o histórico de acesso a arquivos e elementos
   */
  private async loadAccessHistory(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    try {
      const historyPath = path.join(this.context.globalStorageUri.fsPath, 'access-history.json');
      
      if (await fileExistsAtPath(historyPath)) {
        const historyData = JSON.parse(await fs.readFile(historyPath, 'utf8'));
        
        if (historyData.fileAccessCounts) {
          this.fileAccessCounts = new Map(Object.entries(historyData.fileAccessCounts));
        }
        
        if (historyData.nodeAccessCounts) {
          this.nodeAccessCounts = new Map(Object.entries(historyData.nodeAccessCounts));
        }
        
        if (historyData.lastAccessTimes) {
          this.lastAccessTimes = new Map(Object.entries(historyData.lastAccessTimes));
        }
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de acesso:', error);
    }
  }

  /**
   * Salva o histórico de acesso a arquivos e elementos
   */
  private async saveAccessHistory(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    try {
      const historyPath = path.join(this.context.globalStorageUri.fsPath, 'access-history.json');
      
      const historyData = {
        fileAccessCounts: Object.fromEntries(this.fileAccessCounts),
        nodeAccessCounts: Object.fromEntries(this.nodeAccessCounts),
        lastAccessTimes: Object.fromEntries(this.lastAccessTimes)
      };
      
      await fs.writeFile(historyPath, JSON.stringify(historyData, null, 2));
    } catch (error) {
      console.error('Erro ao salvar histórico de acesso:', error);
    }
  }

  /**
   * Registra acesso a um arquivo
   * 
   * @param filePath Caminho do arquivo
   */
  public recordFileAccess(filePath: string): void {
    if (!this.workspacePath) {
      return;
    }

    const relativePath = path.relative(this.workspacePath, filePath);
    
    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }
    
    // Incrementar contador de acesso
    const count = this.fileAccessCounts.get(relativePath) || 0;
    this.fileAccessCounts.set(relativePath, count + 1);
    
    // Atualizar timestamp de último acesso
    this.lastAccessTimes.set(relativePath, Date.now());
    
    // Salvar histórico periodicamente (debounce)
    this.debouncedSaveHistory();
  }

  /**
   * Manipula mudanças de seleção para rastrear acesso a elementos específicos
   * 
   * @param event Evento de mudança de seleção
   */
  private async handleSelectionChange(event: vscode.TextEditorSelectionChangeEvent): Promise<void> {
    if (!this.workspacePath || !event.textEditor) {
      return;
    }

    const filePath = event.textEditor.document.uri.fsPath;
    const relativePath = path.relative(this.workspacePath, filePath);
    
    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }
    
    // Obter nós para o arquivo
    const nodes = this.dependencyGraphManager.getNodesForFile(filePath);
    
    // Para cada seleção, verificar se corresponde a algum nó
    for (const selection of event.selections) {
      const startLine = selection.start.line;
      const endLine = selection.end.line;
      
      // Encontrar nós que correspondem à seleção
      for (const node of nodes) {
        const metadata = node.metadata || {};
        
        if (
          metadata.startLine !== undefined && 
          metadata.endLine !== undefined &&
          metadata.startLine <= startLine && 
          metadata.endLine >= endLine
        ) {
          // Incrementar contador de acesso para o nó
          const count = this.nodeAccessCounts.get(node.id) || 0;
          this.nodeAccessCounts.set(node.id, count + 1);
          
          // Atualizar timestamp de último acesso
          this.lastAccessTimes.set(node.id, Date.now());
        }
      }
    }
  }

  /**
   * Versão com debounce para salvar o histórico de acesso
   */
  private debouncedSaveHistory = (() => {
    let timeout: NodeJS.Timeout | undefined;
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        this.saveAccessHistory();
      }, 5000); // Salvar após 5 segundos de inatividade
    };
  })();

  /**
   * Calcula a proximidade sintática entre dois nós
   * 
   * @param nodeA Primeiro nó
   * @param nodeB Segundo nó
   * @returns Valor de proximidade entre 0 e 1
   */
  private calculateSyntacticProximity(nodeA: DependencyNode, nodeB: DependencyNode): number {
    // Se os nós estão no mesmo arquivo, a proximidade é maior
    if (nodeA.path && nodeB.path && nodeA.path === nodeB.path) {
      // Se temos informações de linha, podemos calcular a proximidade com base na distância
      const metadataA = nodeA.metadata || {};
      const metadataB = nodeB.metadata || {};
      
      if (
        metadataA.startLine !== undefined && 
        metadataA.endLine !== undefined &&
        metadataB.startLine !== undefined && 
        metadataB.endLine !== undefined
      ) {
        // Calcular distância entre os nós em linhas
        const startA = metadataA.startLine as number;
        const endA = metadataA.endLine as number;
        const startB = metadataB.startLine as number;
        const endB = metadataB.endLine as number;
        
        // Verificar se os nós se sobrepõem
        if (startA <= endB && startB <= endA) {
          return 1.0; // Sobreposição completa
        }
        
        // Calcular distância entre os nós
        const distance = Math.min(
          Math.abs(endA - startB),
          Math.abs(endB - startA)
        );
        
        // Normalizar distância (quanto menor a distância, maior a proximidade)
        return Math.max(0, 1 - distance / 100); // Assumindo que 100 linhas é a distância máxima relevante
      }
      
      return 0.8; // Mesmo arquivo, mas sem informações de linha
    }
    
    // Nós em arquivos diferentes
    // Verificar se há um caminho direto entre os nós no grafo de dependências
    const path = this.dependencyGraphManager.getShortestPath(nodeA.id, nodeB.id);
    
    if (path) {
      // Quanto menor o caminho, maior a proximidade
      return Math.max(0, 1 - (path.length - 2) * 0.2); // -2 porque o caminho inclui os nós de origem e destino
    }
    
    return 0.1; // Proximidade mínima para nós sem conexão direta
  }

  /**
   * Calcula a frequência de acesso normalizada para um nó
   * 
   * @param node Nó
   * @returns Valor de frequência entre 0 e 1
   */
  private calculateAccessFrequency(node: DependencyNode): number {
    // Obter contagem de acesso para o nó
    const nodeCount = this.nodeAccessCounts.get(node.id) || 0;
    
    // Obter contagem de acesso para o arquivo
    const fileCount = node.path ? (this.fileAccessCounts.get(node.path) || 0) : 0;
    
    // Combinar contagens com pesos diferentes
    const combinedCount = nodeCount * 0.7 + fileCount * 0.3;
    
    // Normalizar (assumindo que 100 acessos é o máximo relevante)
    return Math.min(1, combinedCount / 100);
  }

  /**
   * Calcula a correlação temporal para um nó
   * 
   * @param node Nó
   * @returns Valor de correlação entre 0 e 1
   */
  private calculateTemporalCorrelation(node: DependencyNode): number {
    if (!node.path) {
      return 0;
    }
    
    // Obter padrões relacionados ao arquivo do nó
    const patterns = this.temporalCorrelationEngine.getRelatedPatterns(node.path);
    
    if (patterns.length === 0) {
      return 0;
    }
    
    // Calcular média ponderada das confianças dos padrões
    let totalConfidence = 0;
    let totalWeight = 0;
    
    for (const pattern of patterns) {
      totalConfidence += pattern.confidence * pattern.frequency;
      totalWeight += pattern.frequency;
    }
    
    return totalWeight > 0 ? totalConfidence / totalWeight : 0;
  }

  /**
   * Calcula a força de dependência para um nó
   * 
   * @param node Nó
   * @returns Valor de força entre 0 e 1
   */
  private calculateDependencyStrength(node: DependencyNode): number {
    // Calcular com base na centralidade do nó no grafo
    const centrality = this.dependencyGraphManager.calculateNodeCentrality();
    const value = centrality.get(node.id) || 0;
    
    // Normalizar (assumindo que 20 conexões é o máximo relevante)
    return Math.min(1, value / 20);
  }

  /**
   * Calcula a relevância geral de um nó
   * 
   * @param node Nó
   * @param currentNode Nó atual (opcional)
   * @returns Valor de relevância entre 0 e 1
   */
  public calculateNodeRelevance(node: DependencyNode, currentNode?: DependencyNode): number {
    // Calcular cada dimensão
    const accessFrequency = this.calculateAccessFrequency(node);
    const temporalCorrelation = this.calculateTemporalCorrelation(node);
    const dependencyStrength = this.calculateDependencyStrength(node);
    
    // Calcular proximidade sintática se temos um nó atual
    const syntacticProximity = currentNode 
      ? this.calculateSyntacticProximity(node, currentNode)
      : 0.5; // Valor médio se não temos um nó atual
    
    // Calcular relevância ponderada
    const relevance = 
      syntacticProximity * this.weights.syntacticProximity +
      accessFrequency * this.weights.accessFrequency +
      temporalCorrelation * this.weights.temporalCorrelation +
      dependencyStrength * this.weights.dependencyStrength;
    
    return relevance;
  }

  /**
   * Obtém o contexto semântico ponderado para um arquivo
   * 
   * @param filePath Caminho do arquivo
   * @returns Contexto semântico com nós e arestas relevantes
   */
  public async getWeightedContext(filePath: string): Promise<SemanticContext> {
    if (!this.workspacePath) {
      throw new Error("Workspace path is not available");
    }

    // Registrar acesso ao arquivo
    this.recordFileAccess(filePath);
    
    // Obter nós para o arquivo
    const fileNodes = this.dependencyGraphManager.getNodesForFile(filePath);
    
    if (fileNodes.length === 0) {
      // Se o arquivo ainda não está no grafo, analisá-lo primeiro
      await this.hybridAnalysisEngine.analyzeFile(filePath);
      fileNodes.push(...this.dependencyGraphManager.getNodesForFile(filePath));
    }
    
    // Encontrar nó principal (arquivo)
    const fileNode = fileNodes.find(node => node.type === 'file');
    
    if (!fileNode) {
      throw new Error(`Não foi possível encontrar nó para o arquivo ${filePath}`);
    }
    
    // Obter nós relacionados
    const relatedNodes = this.dependencyGraphManager.getRelatedNodes(fileNode.id);
    
    // Calcular relevância para cada nó
    const nodesWithRelevance = relatedNodes.map(node => ({
      node,
      relevance: this.calculateNodeRelevance(node, fileNode)
    }));
    
    // Ordenar por relevância e pegar os mais relevantes
    const topNodes = nodesWithRelevance
      .sort((a, b) => b.relevance - a.relevance)
      .slice(0, 50) // Limitar a 50 nós para evitar sobrecarga
      .map(item => {
        // Atualizar score de relevância no nó
        const updatedNode = { ...item.node, relevanceScore: item.relevance };
        return updatedNode;
      });
    
    // Incluir o nó do arquivo atual
    const updatedFileNode = { 
      ...fileNode, 
      relevanceScore: 1.0 // O arquivo atual sempre tem relevância máxima
    };
    
    // Obter arestas relevantes
    const relevantEdges: DependencyEdge[] = [];
    const relevantNodeIds = new Set([updatedFileNode.id, ...topNodes.map(node => node.id)]);
    
    for (const edge of this.dependencyGraphManager.getGraph().edges) {
      if (relevantNodeIds.has(edge.source) && relevantNodeIds.has(edge.target)) {
        relevantEdges.push(edge);
      }
    }
    
    // Obter padrões de modificação relacionados
    const modificationPatterns = this.temporalCorrelationEngine.getRelatedPatterns(filePath);
    
    // Obter eventos de modificação recentes
    const recentModifications = this.temporalCorrelationEngine.getModificationEvents(filePath)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10); // Limitar aos 10 mais recentes
    
    return {
      relevantNodes: [updatedFileNode, ...topNodes],
      relevantEdges,
      modificationPatterns,
      recentModifications
    };
  }

  /**
   * Obtém sugestões de arquivos relacionados com base no contexto atual
   * 
   * @param filePath Caminho do arquivo atual
   * @returns Lista de sugestões de arquivos com scores de relevância
   */
  public async getRelatedFileSuggestions(filePath: string): Promise<{ file: string; relevance: number }[]> {
    if (!this.workspacePath) {
      return [];
    }

    // Obter arquivos dependentes do grafo de dependências
    const dependentFiles = this.dependencyGraphManager.getDependentFiles(filePath);
    const dependencyFiles = this.dependencyGraphManager.getDependencyFiles(filePath);
    
    // Obter sugestões do motor de correlação temporal
    const temporalSuggestions = this.temporalCorrelationEngine.getSuggestions(filePath);
    
    // Combinar todas as sugestões
    const allFiles = new Set([...dependentFiles, ...dependencyFiles, ...temporalSuggestions.map(s => s.file)]);
    const suggestions: { file: string; relevance: number }[] = [];
    
    for (const file of allFiles) {
      // Calcular relevância combinada
      let relevance = 0;
      
      // Componente de dependência
      if (dependentFiles.includes(file)) {
        relevance += 0.4; // Arquivos que dependem deste são mais relevantes
      }
      
      if (dependencyFiles.includes(file)) {
        relevance += 0.3; // Arquivos dos quais este depende são relevantes
      }
      
      // Componente temporal
      const temporalSuggestion = temporalSuggestions.find(s => s.file === file);
      if (temporalSuggestion) {
        relevance += temporalSuggestion.confidence * 0.3;
      }
      
      // Componente de frequência de acesso
      const accessCount = this.fileAccessCounts.get(file) || 0;
      relevance += Math.min(1, accessCount / 100) * 0.2;
      
      // Componente de recência de acesso
      const lastAccess = this.lastAccessTimes.get(file) || 0;
      const timeSinceLastAccess = Date.now() - lastAccess;
      const recencyFactor = Math.max(0, 1 - timeSinceLastAccess / (7 * 24 * 60 * 60 * 1000)); // 7 dias
      relevance += recencyFactor * 0.1;
      
      suggestions.push({ file, relevance });
    }
    
    // Ordenar por relevância
    return suggestions.sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Libera recursos utilizados pelo mecanismo
   */
  public async dispose(): Promise<void> {
    // Salvar histórico de acesso antes de liberar recursos
    await this.saveAccessHistory();
  }
}
