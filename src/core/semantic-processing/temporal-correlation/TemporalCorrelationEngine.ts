import * as vscode from "vscode"
import * as path from "path"
import { CodeModificationEvent, ModificationPattern } from "../types"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"
import { execSync } from "child_process"

/**
 * Motor de Correlação Temporal
 *
 * Processa em paralelo o histórico de commits, tickets relacionados e padrões de modificação
 * para identificar correlações temporais entre mudanças no código.
 */
export class TemporalCorrelationEngine {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private modificationEvents: Map<string, CodeModificationEvent[]> = new Map();
  private patterns: ModificationPattern[] = [];
  private isGitRepository: boolean = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.initialize();
  }

  /**
   * Inicializa o motor de correlação temporal
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Verificar se o diretório é um repositório Git
    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.workspacePath,
        stdio: 'ignore'
      });
      this.isGitRepository = true;
    } catch (error) {
      this.isGitRepository = false;
    }

    // Se for um repositório Git, carregar histórico de commits
    if (this.isGitRepository) {
      await this.loadCommitHistory();
    }

    // Configurar watcher para monitorar mudanças em arquivos
    this.setupFileWatcher();
  }

  /**
   * Configura um watcher para monitorar mudanças em arquivos
   */
  private setupFileWatcher(): void {
    const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");

    fileWatcher.onDidChange(uri => {
      this.recordModificationEvent(uri.fsPath, 'update');
    });

    fileWatcher.onDidCreate(uri => {
      this.recordModificationEvent(uri.fsPath, 'create');
    });

    fileWatcher.onDidDelete(uri => {
      this.recordModificationEvent(uri.fsPath, 'delete');
    });
  }

  /**
   * Registra um evento de modificação de arquivo
   *
   * @param filePath Caminho do arquivo
   * @param type Tipo de modificação
   */
  private async recordModificationEvent(filePath: string, type: 'create' | 'update' | 'delete'): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    const relativePath = path.relative(this.workspacePath, filePath);

    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }

    const event: CodeModificationEvent = {
      timestamp: Date.now(),
      path: relativePath,
      type
    };

    // Adicionar evento à lista de eventos para este arquivo
    const events = this.modificationEvents.get(relativePath) || [];
    events.push(event);
    this.modificationEvents.set(relativePath, events);

    // Analisar padrões após cada modificação
    await this.analyzePatterns();
  }

  /**
   * Carrega o histórico de commits do repositório Git
   */
  private async loadCommitHistory(): Promise<void> {
    if (!this.workspacePath || !this.isGitRepository) {
      return;
    }

    try {
      // Obter histórico de commits dos últimos 30 dias
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateString = thirtyDaysAgo.toISOString().split('T')[0];

      const command = `git log --since="${dateString}" --name-status --pretty=format:"%h|%an|%at|%s"`;
      const output = execSync(command, { cwd: this.workspacePath }).toString();

      let currentCommit: {
        hash: string;
        author: string;
        timestamp: number;
        message: string;
        files: { path: string; type: 'create' | 'update' | 'delete' }[];
      } | null = null;

      // Processar saída do comando git log
      for (const line of output.split('\n')) {
        if (line.includes('|')) {
          // Nova linha de commit
          const [hash, author, timestampStr, message] = line.split('|');
          const timestamp = parseInt(timestampStr) * 1000; // Converter para milissegundos

          if (currentCommit) {
            // Processar commit anterior
            this.processCommit(currentCommit);
          }

          currentCommit = {
            hash,
            author,
            timestamp,
            message,
            files: []
          };
        } else if (line.trim() && currentCommit) {
          // Linha de arquivo modificado
          const statusMatch = line.match(/^([AMD])\s+(.+)$/);

          if (statusMatch) {
            const status = statusMatch[1];
            const filePath = statusMatch[2];

            let type: 'create' | 'update' | 'delete';

            switch (status) {
              case 'A':
                type = 'create';
                break;
              case 'M':
                type = 'update';
                break;
              case 'D':
                type = 'delete';
                break;
              default:
                continue; // Ignorar outros status
            }

            currentCommit.files.push({
              path: filePath,
              type
            });
          }
        }
      }

      // Processar último commit
      if (currentCommit) {
        this.processCommit(currentCommit);
      }
    } catch (error) {
      console.error('Erro ao carregar histórico de commits:', error);
    }
  }

  /**
   * Processa um commit e registra eventos de modificação
   */
  private processCommit(commit: {
    hash: string;
    author: string;
    timestamp: number;
    message: string;
    files: { path: string; type: 'create' | 'update' | 'delete' }[];
  }): void {
    for (const file of commit.files) {
      const event: CodeModificationEvent = {
        timestamp: commit.timestamp,
        path: file.path,
        type: file.type,
        author: commit.author,
        commitId: commit.hash,
        metadata: {
          commitMessage: commit.message
        }
      };

      // Adicionar evento à lista de eventos para este arquivo
      const events = this.modificationEvents.get(file.path) || [];
      events.push(event);
      this.modificationEvents.set(file.path, events);
    }
  }

  /**
   * Analisa padrões de modificação com base nos eventos registrados
   */
  private async analyzePatterns(): Promise<void> {
    // Limpar padrões anteriores
    this.patterns = [];

    // Identificar arquivos frequentemente modificados juntos
    const coModifiedFiles = this.identifyCoModifiedFiles();

    // Identificar padrões de modificação sequencial
    const sequentialPatterns = this.identifySequentialPatterns();

    // Combinar padrões
    this.patterns = [...coModifiedFiles, ...sequentialPatterns];
  }

  /**
   * Identifica arquivos que são frequentemente modificados juntos
   */
  private identifyCoModifiedFiles(): ModificationPattern[] {
    const patterns: ModificationPattern[] = [];
    const commitMap = new Map<string, Set<string>>();

    // Agrupar arquivos por commit
    for (const [filePath, events] of this.modificationEvents.entries()) {
      for (const event of events) {
        if (event.commitId) {
          const files = commitMap.get(event.commitId) || new Set<string>();
          files.add(filePath);
          commitMap.set(event.commitId, files);
        }
      }
    }

    // Contar co-ocorrências
    const coOccurrences = new Map<string, Map<string, number>>();

    for (const files of commitMap.values()) {
      const fileArray = Array.from(files);

      for (let i = 0; i < fileArray.length; i++) {
        for (let j = i + 1; j < fileArray.length; j++) {
          const fileA = fileArray[i];
          const fileB = fileArray[j];

          // Garantir ordem consistente
          const [file1, file2] = [fileA, fileB].sort();

          const fileMap = coOccurrences.get(file1) || new Map<string, number>();
          const count = fileMap.get(file2) || 0;
          fileMap.set(file2, count + 1);
          coOccurrences.set(file1, fileMap);
        }
      }
    }

    // Criar padrões para arquivos frequentemente modificados juntos
    for (const [file1, fileMap] of coOccurrences.entries()) {
      for (const [file2, count] of fileMap.entries()) {
        if (count >= 3) { // Limiar arbitrário
          patterns.push({
            id: `co-modified:${file1}:${file2}`,
            name: `Co-modificação frequente`,
            description: `Os arquivos ${file1} e ${file2} são frequentemente modificados juntos (${count} vezes)`,
            frequency: count,
            confidence: Math.min(1.0, count / 10), // Normalizar confiança
            relatedFiles: [file1, file2]
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Identifica padrões de modificação sequencial
   */
  private identifySequentialPatterns(): ModificationPattern[] {
    const patterns: ModificationPattern[] = [];
    const sequenceMap = new Map<string, Map<string, number>>();

    // Para cada arquivo, analisar modificações que ocorrem logo após
    for (const [filePath, events] of this.modificationEvents.entries()) {
      // Ordenar eventos por timestamp
      const sortedEvents = [...events].sort((a, b) => a.timestamp - b.timestamp);

      for (let i = 0; i < sortedEvents.length - 1; i++) {
        const currentEvent = sortedEvents[i];

        // Procurar eventos em outros arquivos que ocorreram logo após
        for (const [otherPath, otherEvents] of this.modificationEvents.entries()) {
          if (otherPath === filePath) continue;

          for (const otherEvent of otherEvents) {
            // Verificar se o evento ocorreu dentro de um intervalo de tempo (30 minutos)
            const timeDiff = otherEvent.timestamp - currentEvent.timestamp;
            if (timeDiff > 0 && timeDiff < 30 * 60 * 1000) {
              const fileMap = sequenceMap.get(filePath) || new Map<string, number>();
              const count = fileMap.get(otherPath) || 0;
              fileMap.set(otherPath, count + 1);
              sequenceMap.set(filePath, fileMap);
              break; // Considerar apenas o primeiro evento subsequente
            }
          }
        }
      }
    }

    // Criar padrões para sequências frequentes
    for (const [file1, fileMap] of sequenceMap.entries()) {
      for (const [file2, count] of fileMap.entries()) {
        if (count >= 2) { // Limiar arbitrário
          patterns.push({
            id: `sequential:${file1}:${file2}`,
            name: `Modificação sequencial`,
            description: `Modificações em ${file1} são frequentemente seguidas por modificações em ${file2} (${count} vezes)`,
            frequency: count,
            confidence: Math.min(1.0, count / 5), // Normalizar confiança
            relatedFiles: [file1, file2]
          });
        }
      }
    }

    return patterns;
  }

  /**
   * Obtém eventos de modificação para um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de eventos de modificação
   */
  public getModificationEvents(filePath: string): CodeModificationEvent[] {
    if (!this.workspacePath) {
      return [];
    }

    const relativePath = path.relative(this.workspacePath, filePath);
    return this.modificationEvents.get(relativePath) || [];
  }

  /**
   * Obtém padrões de modificação relacionados a um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de padrões de modificação
   */
  public getRelatedPatterns(filePath: string): ModificationPattern[] {
    if (!this.workspacePath) {
      return [];
    }

    const relativePath = path.relative(this.workspacePath, filePath);
    return this.patterns.filter(pattern => pattern.relatedFiles.includes(relativePath));
  }

  /**
   * Obtém arquivos relacionados a um arquivo com base em padrões de modificação
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de caminhos de arquivos relacionados
   */
  public getRelatedFiles(filePath: string): string[] {
    if (!this.workspacePath) {
      return [];
    }

    const relativePath = path.relative(this.workspacePath, filePath);
    const relatedFiles = new Set<string>();

    // Adicionar arquivos de padrões relacionados
    for (const pattern of this.getRelatedPatterns(filePath)) {
      for (const file of pattern.relatedFiles) {
        if (file !== relativePath) {
          relatedFiles.add(file);
        }
      }
    }

    return Array.from(relatedFiles);
  }

  /**
   * Obtém padrões de modificação relacionados a um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de padrões de modificação
   */
  public async getModificationPatterns(filePath: string): Promise<ModificationPattern[]> {
    if (!this.workspacePath) {
      return [];
    }

    // Obter padrões relacionados ao arquivo
    const relatedPatterns = this.getRelatedPatterns(filePath);

    // Se não houver padrões e for um repositório Git, tentar analisar o histórico recente
    if (relatedPatterns.length === 0 && this.isGitRepository) {
      await this.analyzeRecentCommits(filePath);
      return this.getRelatedPatterns(filePath);
    }

    return relatedPatterns;
  }

  /**
   * Obtém sugestões de arquivos que podem precisar ser modificados
   * com base em uma modificação atual
   *
   * @param filePath Caminho do arquivo modificado
   * @returns Lista de sugestões de arquivos
   */
  public getSuggestions(filePath: string): { file: string; confidence: number }[] {
    if (!this.workspacePath) {
      return [];
    }

    const relativePath = path.relative(this.workspacePath, filePath);
    const suggestions: { file: string; confidence: number }[] = [];

    // Adicionar sugestões com base em padrões
    for (const pattern of this.getRelatedPatterns(filePath)) {
      for (const file of pattern.relatedFiles) {
        if (file !== relativePath) {
          suggestions.push({
            file,
            confidence: pattern.confidence
          });
        }
      }
    }

    // Remover duplicatas e ordenar por confiança
    const uniqueSuggestions = new Map<string, number>();

    for (const suggestion of suggestions) {
      const currentConfidence = uniqueSuggestions.get(suggestion.file) || 0;
      uniqueSuggestions.set(suggestion.file, Math.max(currentConfidence, suggestion.confidence));
    }

    return Array.from(uniqueSuggestions.entries())
      .map(([file, confidence]) => ({ file, confidence }))
      .sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analisa commits recentes para identificar padrões de modificação
   *
   * @param filePath Caminho do arquivo
   */
  private async analyzeRecentCommits(filePath: string): Promise<void> {
    if (!this.workspacePath || !this.isGitRepository) {
      return;
    }

    try {
      // Obter commits recentes que modificaram o arquivo
      const relativePath = path.relative(this.workspacePath, filePath);
      const command = `git log --pretty=format:"%h" -n 10 -- "${relativePath}"`;

      const output = execSync(command, { cwd: this.workspacePath }).toString().trim();
      const commits = output.split('\n').filter(Boolean);

      // Para cada commit, obter arquivos modificados juntos
      for (const commit of commits) {
        const filesCommand = `git show --name-only --pretty="" ${commit}`;
        const filesOutput = execSync(filesCommand, { cwd: this.workspacePath }).toString().trim();
        const files = filesOutput.split('\n').filter(Boolean);

        // Se houver mais de um arquivo modificado, criar um padrão
        if (files.length > 1) {
          const pattern: ModificationPattern = {
            id: `commit-${commit}`,
            name: `Commit ${commit}`,
            description: `Arquivos modificados no commit ${commit}`,
            frequency: 1,
            confidence: 0.8, // Alta confiança para commits recentes
            relatedFiles: files,
            metadata: { source: 'git-history' }
          };

          this.patterns.push(pattern);
        }
      }
    } catch (error) {
      console.error('Erro ao analisar commits recentes:', error);
    }
  }
}
