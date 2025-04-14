import * as vscode from "vscode"
import * as path from "path"
import { DependencyNode, DependencyEdge, DependencyGraph } from "../types"
import { HybridAnalysisEngine } from "../hybrid-analysis/HybridAnalysisEngine"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"

/**
 * Gerenciador de Grafo de Dependências
 *
 * Mantém um grafo de dependências vivo que é atualizado em tempo real
 * à medida que o código é editado.
 */
export class DependencyGraphManager {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private hybridAnalysisEngine: HybridAnalysisEngine;
  private graph: DependencyGraph = { nodes: new Map(), edges: [] };
  private fileWatchers: Map<string, vscode.FileSystemWatcher> = new Map();
  private pendingUpdates: Set<string> = new Set();
  private updateDebounceTimeout: NodeJS.Timeout | undefined;
  private isUpdating: boolean = false;

  constructor(context: vscode.ExtensionContext, hybridAnalysisEngine: HybridAnalysisEngine) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.hybridAnalysisEngine = hybridAnalysisEngine;
    this.initialize();
  }

  /**
   * Inicializa o gerenciador de grafo de dependências
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Configurar watcher para monitorar mudanças em arquivos
    this.setupFileWatcher();

    // Iniciar construção do grafo
    await this.buildInitialGraph();
  }

  /**
   * Configura um watcher para monitorar mudanças em arquivos
   */
  private setupFileWatcher(): void {
    // Monitorar todos os arquivos de código-fonte
    const patterns = [
      "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx",
      "**/*.py", "**/*.java", "**/*.go", "**/*.rb",
      "**/*.php", "**/*.cs", "**/*.cpp", "**/*.c",
      "**/*.rs", "**/*.swift", "**/*.kt", "**/*.scala"
    ];

    for (const pattern of patterns) {
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      watcher.onDidChange(uri => {
        this.queueFileUpdate(uri.fsPath);
      });

      watcher.onDidCreate(uri => {
        this.queueFileUpdate(uri.fsPath);
      });

      watcher.onDidDelete(uri => {
        this.removeFileFromGraph(uri.fsPath);
      });

      this.fileWatchers.set(pattern, watcher);
    }
  }

  /**
   * Constrói o grafo inicial analisando os arquivos do workspace
   */
  private async buildInitialGraph(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Limitar a construção inicial a um número razoável de arquivos
    // para evitar sobrecarga no carregamento
    const MAX_INITIAL_FILES = 100;

    try {
      // Encontrar arquivos de código-fonte
      const files = await vscode.workspace.findFiles(
        "{**/*.ts,**/*.tsx,**/*.js,**/*.jsx,**/*.py}",
        "**/node_modules/**",
        MAX_INITIAL_FILES
      );

      // Analisar cada arquivo e adicionar ao grafo
      for (const file of files) {
        await this.updateFileInGraph(file.fsPath);
      }

      console.log(`Grafo de dependências inicial construído com ${this.graph.nodes.size} nós e ${this.graph.edges.length} arestas`);
    } catch (error) {
      console.error('Erro ao construir grafo inicial:', error);
    }
  }

  /**
   * Adiciona um arquivo à fila de atualização
   *
   * @param filePath Caminho do arquivo
   */
  private queueFileUpdate(filePath: string): void {
    if (!this.workspacePath) {
      return;
    }

    const relativePath = path.relative(this.workspacePath, filePath);

    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }

    // Adicionar à fila de atualizações pendentes
    this.pendingUpdates.add(filePath);

    // Debounce para evitar múltiplas atualizações simultâneas
    if (this.updateDebounceTimeout) {
      clearTimeout(this.updateDebounceTimeout);
    }

    this.updateDebounceTimeout = setTimeout(() => {
      this.processUpdateQueue();
    }, 1000); // Aguardar 1 segundo após a última modificação
  }

  /**
   * Processa a fila de atualizações pendentes
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isUpdating || this.pendingUpdates.size === 0) {
      return;
    }

    this.isUpdating = true;

    try {
      const filesToUpdate = Array.from(this.pendingUpdates);
      this.pendingUpdates.clear();

      for (const filePath of filesToUpdate) {
        await this.updateFileInGraph(filePath);
      }
    } catch (error) {
      console.error('Erro ao processar fila de atualizações:', error);
    } finally {
      this.isUpdating = false;

      // Verificar se novas atualizações foram adicionadas durante o processamento
      if (this.pendingUpdates.size > 0) {
        this.processUpdateQueue();
      }
    }
  }

  /**
   * Atualiza um arquivo no grafo de dependências
   *
   * @param filePath Caminho do arquivo
   */
  private async updateFileInGraph(filePath: string): Promise<void> {
    if (!this.workspacePath || !await fileExistsAtPath(filePath)) {
      return;
    }

    try {
      // Remover nós e arestas existentes para este arquivo
      this.removeFileFromGraph(filePath);

      // Analisar o arquivo
      const { nodes, edges } = await this.hybridAnalysisEngine.analyzeFile(filePath);

      // Adicionar novos nós e arestas ao grafo
      for (const node of nodes) {
        this.graph.nodes.set(node.id, node);
      }

      this.graph.edges.push(...edges);

      // Emitir evento de atualização
      this.onGraphUpdated();
    } catch (error) {
      console.error(`Erro ao atualizar arquivo ${filePath} no grafo:`, error);
    }
  }

  /**
   * Remove um arquivo do grafo de dependências
   *
   * @param filePath Caminho do arquivo
   */
  private removeFileFromGraph(filePath: string): void {
    if (!this.workspacePath) {
      return;
    }

    // Remover nós associados ao arquivo
    for (const [id, node] of this.graph.nodes.entries()) {
      if (node.path === filePath) {
        this.graph.nodes.delete(id);
      }
    }

    // Remover arestas associadas aos nós removidos
    this.graph.edges = this.graph.edges.filter(edge => {
      const sourceNode = this.graph.nodes.get(edge.source);
      const targetNode = this.graph.nodes.get(edge.target);
      return sourceNode !== undefined && targetNode !== undefined;
    });

    // Emitir evento de atualização
    this.onGraphUpdated();
  }

  /**
   * Manipulador de evento de atualização do grafo
   */
  private onGraphUpdated(): void {
    // Aqui poderíamos emitir eventos para notificar outros componentes
    // sobre a atualização do grafo
  }

  /**
   * Obtém o grafo de dependências completo
   *
   * @returns Grafo de dependências
   */
  public getGraph(): DependencyGraph {
    return this.graph;
  }

  /**
   * Obtém nós relacionados a um nó específico
   *
   * @param nodeId ID do nó
   * @returns Lista de nós relacionados
   */
  public getRelatedNodes(nodeId: string): DependencyNode[] {
    const relatedNodeIds = new Set<string>();

    // Encontrar nós conectados por arestas
    for (const edge of this.graph.edges) {
      if (edge.source === nodeId) {
        relatedNodeIds.add(edge.target);
      } else if (edge.target === nodeId) {
        relatedNodeIds.add(edge.source);
      }
    }

    // Converter IDs em nós
    const relatedNodes: DependencyNode[] = [];

    for (const id of relatedNodeIds) {
      const node = this.graph.nodes.get(id);
      if (node) {
        relatedNodes.push(node);
      }
    }

    return relatedNodes;
  }

  /**
   * Obtém nós relacionados a um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de nós relacionados
   */
  public getNodesForFile(filePath: string): DependencyNode[] {
    const nodes: DependencyNode[] = [];

    for (const node of this.graph.nodes.values()) {
      if (node.path === filePath) {
        nodes.push(node);
      }
    }

    // Se não encontrou nenhum nó, criar um nó básico para o arquivo
    if (nodes.length === 0 && filePath) {
      const fileName = path.basename(filePath);
      const fileExt = path.extname(filePath);

      const fileNode: DependencyNode = {
        id: `file:${filePath}`,
        type: 'file',
        name: fileName,
        path: filePath,
        language: fileExt.substring(1) || "unknown",
        metadata: {
          createdAt: Date.now(),
          isBasicNode: true
        }
      };

      // Adicionar o nó ao grafo
      this.graph.nodes.set(fileNode.id, fileNode);
      nodes.push(fileNode);
    }

    return nodes;
  }

  /**
   * Obtém arquivos que dependem de um arquivo específico
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de caminhos de arquivos dependentes
   */
  public getDependentFiles(filePath: string): string[] {
    const fileNodes = this.getNodesForFile(filePath);
    const dependentFiles = new Set<string>();

    // Para cada nó do arquivo, encontrar nós que o referenciam
    for (const fileNode of fileNodes) {
      for (const edge of this.graph.edges) {
        if (edge.target === fileNode.id) {
          const sourceNode = this.graph.nodes.get(edge.source);
          if (sourceNode && sourceNode.path && sourceNode.path !== filePath) {
            dependentFiles.add(sourceNode.path);
          }
        }
      }
    }

    return Array.from(dependentFiles);
  }

  /**
   * Obtém arquivos dos quais um arquivo específico depende
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de caminhos de arquivos dependências
   */
  public getDependencyFiles(filePath: string): string[] {
    const fileNodes = this.getNodesForFile(filePath);
    const dependencyFiles = new Set<string>();

    // Para cada nó do arquivo, encontrar nós que ele referencia
    for (const fileNode of fileNodes) {
      for (const edge of this.graph.edges) {
        if (edge.source === fileNode.id) {
          const targetNode = this.graph.nodes.get(edge.target);
          if (targetNode && targetNode.path && targetNode.path !== filePath) {
            dependencyFiles.add(targetNode.path);
          }
        }
      }
    }

    return Array.from(dependencyFiles);
  }

  /**
   * Obtém o caminho mais curto entre dois nós
   *
   * @param sourceId ID do nó de origem
   * @param targetId ID do nó de destino
   * @returns Caminho como lista de IDs de nós, ou undefined se não houver caminho
   */
  public getShortestPath(sourceId: string, targetId: string): string[] | undefined {
    // Implementação do algoritmo de busca em largura (BFS)
    const queue: { id: string; path: string[] }[] = [{ id: sourceId, path: [sourceId] }];
    const visited = new Set<string>([sourceId]);

    while (queue.length > 0) {
      const { id, path } = queue.shift()!;

      // Encontrar nós adjacentes
      const adjacentNodes: string[] = [];

      for (const edge of this.graph.edges) {
        if (edge.source === id && !visited.has(edge.target)) {
          adjacentNodes.push(edge.target);
        } else if (edge.target === id && !visited.has(edge.source)) {
          adjacentNodes.push(edge.source);
        }
      }

      // Processar nós adjacentes
      for (const adjacentId of adjacentNodes) {
        if (adjacentId === targetId) {
          return [...path, adjacentId];
        }

        visited.add(adjacentId);
        queue.push({ id: adjacentId, path: [...path, adjacentId] });
      }
    }

    return undefined; // Não há caminho
  }

  /**
   * Calcula a centralidade dos nós no grafo
   *
   * @returns Mapa de IDs de nós para valores de centralidade
   */
  public calculateNodeCentrality(): Map<string, number> {
    const centrality = new Map<string, number>();

    // Inicializar centralidade com zero para todos os nós
    for (const nodeId of this.graph.nodes.keys()) {
      centrality.set(nodeId, 0);
    }

    // Contar número de conexões para cada nó
    for (const edge of this.graph.edges) {
      const sourceValue = centrality.get(edge.source) || 0;
      centrality.set(edge.source, sourceValue + 1);

      const targetValue = centrality.get(edge.target) || 0;
      centrality.set(edge.target, targetValue + 1);
    }

    return centrality;
  }

  /**
   * Identifica componentes fortemente conectados no grafo
   *
   * @returns Lista de componentes como conjuntos de IDs de nós
   */
  public identifyConnectedComponents(): Set<string>[] {
    const visited = new Set<string>();
    const components: Set<string>[] = [];

    // Função de busca em profundidade (DFS)
    const dfs = (nodeId: string, component: Set<string>) => {
      visited.add(nodeId);
      component.add(nodeId);

      // Encontrar nós adjacentes
      for (const edge of this.graph.edges) {
        if (edge.source === nodeId && !visited.has(edge.target)) {
          dfs(edge.target, component);
        } else if (edge.target === nodeId && !visited.has(edge.source)) {
          dfs(edge.source, component);
        }
      }
    };

    // Executar DFS para cada nó não visitado
    for (const nodeId of this.graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        const component = new Set<string>();
        dfs(nodeId, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Libera recursos utilizados pelo gerenciador
   */
  public dispose(): void {
    // Limpar timeout de debounce
    if (this.updateDebounceTimeout) {
      clearTimeout(this.updateDebounceTimeout);
    }

    // Liberar watchers de arquivos
    for (const watcher of this.fileWatchers.values()) {
      watcher.dispose();
    }

    this.fileWatchers.clear();
  }
}
