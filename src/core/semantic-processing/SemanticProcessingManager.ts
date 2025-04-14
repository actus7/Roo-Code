import * as vscode from "vscode"
import { HybridAnalysisEngine } from "./hybrid-analysis/HybridAnalysisEngine"
import { TemporalCorrelationEngine } from "./temporal-correlation/TemporalCorrelationEngine"
import { DependencyGraphManager } from "./dependency-graph/DependencyGraphManager"
import { AdaptiveContextWeightingEngine } from "./context-weighting/AdaptiveContextWeightingEngine"
import { SemanticNormalizationService } from "./semantic-normalization/SemanticNormalizationService"
import { BehaviorModelingEngine } from "./behavior-modeling/BehaviorModelingEngine"
import { EcosystemConnectivityManager } from "./ecosystem-connectivity/EcosystemConnectivityManager"
import { ContinuousValidationEngine } from "./validation/ContinuousValidationEngine"
import { SemanticContext, ContextualizedSuggestion } from "./types"
import { EventEmitter } from "events"

/**
 * Gerenciador de Processamento Semântico Unificado
 *
 * Integra todos os componentes da arquitetura unificada de processamento semântico
 * e fornece uma interface unificada para o restante do sistema.
 */
export class SemanticProcessingManager extends EventEmitter {
  private context: vscode.ExtensionContext;
  private hybridAnalysisEngine: HybridAnalysisEngine;
  private temporalCorrelationEngine: TemporalCorrelationEngine;
  private dependencyGraphManager: DependencyGraphManager;
  private adaptiveContextWeightingEngine: AdaptiveContextWeightingEngine;
  private semanticNormalizationService: SemanticNormalizationService;
  private behaviorModelingEngine: BehaviorModelingEngine;
  private ecosystemConnectivityManager: EcosystemConnectivityManager;
  public continuousValidationEngine: ContinuousValidationEngine;

  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;

    // Inicializar componentes
    this.hybridAnalysisEngine = new HybridAnalysisEngine(context);
    this.temporalCorrelationEngine = new TemporalCorrelationEngine(context);
    this.dependencyGraphManager = new DependencyGraphManager(context, this.hybridAnalysisEngine);
    this.semanticNormalizationService = new SemanticNormalizationService(context);
    this.adaptiveContextWeightingEngine = new AdaptiveContextWeightingEngine(
      context,
      this.hybridAnalysisEngine,
      this.temporalCorrelationEngine,
      this.dependencyGraphManager
    );
    this.behaviorModelingEngine = new BehaviorModelingEngine(context);
    this.ecosystemConnectivityManager = new EcosystemConnectivityManager(
      context,
      this.semanticNormalizationService
    );
    this.continuousValidationEngine = new ContinuousValidationEngine(context);

    // Inicializar gerenciador
    this.initializationPromise = this.initialize();
  }

  /**
   * Inicializa o gerenciador de processamento semântico
   */
  private async initialize(): Promise<void> {
    try {
      // Configurar manipuladores de eventos
      this.setupEventHandlers();

      // Não registramos comandos aqui, pois isso é feito no arquivo commands.ts
      // para evitar registros duplicados

      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      console.error('Erro ao inicializar gerenciador de processamento semântico:', error);
      throw error;
    }
  }

  /**
   * Configura manipuladores de eventos
   */
  private setupEventHandlers(): void {
    // Conectar eventos entre componentes

    // Eventos do motor de validação contínua
    this.continuousValidationEngine.on('alert', (alert) => {
      this.emit('validation:alert', alert);
    });

    this.continuousValidationEngine.on('metric', (metric) => {
      this.emit('validation:metric', metric);
    });

    // Eventos do gerenciador de conectividade ecossistêmica
    this.ecosystemConnectivityManager.on('data', (data) => {
      this.emit('ecosystem:data', data);
    });
  }

  // O método registerCommands foi removido para evitar registros duplicados
  // Os comandos agora são registrados no arquivo commands.ts

  /**
   * Verifica se o gerenciador está inicializado
   *
   * @returns Promise que resolve quando o gerenciador estiver inicializado
   */
  private async ensureInitialized(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  /**
   * Analisa um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Contexto semântico do arquivo
   */
  public async analyzeFile(filePath: string): Promise<SemanticContext> {
    await this.ensureInitialized();

    // Analisar arquivo com o motor de análise híbrida
    await this.hybridAnalysisEngine.analyzeFile(filePath);

    // Obter contexto ponderado
    return await this.adaptiveContextWeightingEngine.getWeightedContext(filePath);
  }

  /**
   * Gera sugestões contextualizadas para um arquivo
   *
   * @param filePath Caminho do arquivo
   * @param fileContent Conteúdo do arquivo
   * @returns Lista de sugestões contextualizadas
   */
  public async generateContextualizedSuggestions(
    filePath: string,
    fileContent: string
  ): Promise<ContextualizedSuggestion[]> {
    await this.ensureInitialized();

    // Analisar arquivo
    await this.analyzeFile(filePath);

    // Gerar sugestões com base no perfil de comportamento
    return this.behaviorModelingEngine.generateContextualizedSuggestions(filePath, fileContent);
  }

  /**
   * Obtém arquivos relacionados a um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de arquivos relacionados com scores de relevância
   */
  public async getRelatedFiles(filePath: string): Promise<{ file: string; relevance: number }[]> {
    await this.ensureInitialized();

    // Analisar arquivo se ainda não foi analisado
    await this.analyzeFile(filePath);

    // Obter padrões de modificação do motor de correlação temporal
    const patterns = await this.temporalCorrelationEngine.getModificationPatterns(filePath);

    // Mapear padrões para arquivos relacionados
    const relatedFiles = patterns.flatMap(pattern =>
      pattern.relatedFiles.map(file => ({
        file,
        relevance: pattern.confidence
      }))
    );

    // Obter sugestões de arquivos do motor de ponderação contextual
    const contextualSuggestions = await this.adaptiveContextWeightingEngine.getRelatedFileSuggestions(filePath);

    // Combinar resultados
    const allRelatedFiles = [...relatedFiles, ...contextualSuggestions];

    // Remover duplicatas e ordenar por relevância
    const uniqueFiles = new Map<string, number>();

    for (const { file, relevance } of allRelatedFiles) {
      if (!uniqueFiles.has(file) || uniqueFiles.get(file)! < relevance) {
        uniqueFiles.set(file, relevance);
      }
    }

    return Array.from(uniqueFiles.entries())
      .map(([file, relevance]) => ({ file, relevance }))
      .sort((a, b) => b.relevance - a.relevance);
  }

  /**
   * Normaliza dados de uma fonte externa
   *
   * @param data Dados a serem normalizados
   * @param sourceType Tipo de fonte
   * @returns Dados normalizados
   */
  public async normalizeExternalData(data: any, sourceType: string): Promise<any> {
    await this.ensureInitialized();

    // Normalizar dados com base no tipo de fonte
    switch (sourceType) {
      case 'source-code':
        return await this.semanticNormalizationService.normalizeSourceCode(data);
      case 'ci-cd':
        return this.semanticNormalizationService.normalizeCI_CDData(data);
      case 'performance':
        return this.semanticNormalizationService.normalizePerformanceData(data);
      case 'api':
        return await this.semanticNormalizationService.normalizeExternalAPI(data);
      default:
        throw new Error(`Tipo de fonte não suportado: ${sourceType}`);
    }
  }

  /**
   * Registra feedback para uma sugestão
   *
   * @param suggestionId ID da sugestão
   * @param accepted Se a sugestão foi aceita
   * @param suggestionType Tipo de sugestão
   */
  public recordSuggestionFeedback(suggestionId: string, accepted: boolean, suggestionType: string): void {
    // Registrar feedback no motor de modelagem de comportamento
    this.behaviorModelingEngine.recordSuggestionFeedback(suggestionId, accepted);

    // Registrar feedback no motor de validação contínua
    this.continuousValidationEngine.recordSuggestionFeedback(accepted, suggestionType);
  }

  /**
   * Registra feedback de usabilidade
   *
   * @param type Tipo de feedback
   */
  public recordUsabilityFeedback(type: 'positive' | 'negative' | 'neutral'): void {
    this.continuousValidationEngine.recordUsabilityFeedback(type);
  }

  /**
   * Obtém convenções de equipe detectadas
   *
   * @returns Lista de convenções detectadas
   */
  public getTeamConventions(): { name: string; confidence: number; description: string }[] {
    return this.behaviorModelingEngine.detectTeamConventions();
  }

  /**
   * Busca dados de uma ferramenta externa
   *
   * @param connectorId ID do conector
   * @param query Consulta opcional
   * @returns Dados normalizados
   */
  public async fetchExternalData(connectorId: string, query?: any): Promise<any> {
    await this.ensureInitialized();

    return await this.ecosystemConnectivityManager.fetchExternalData(connectorId, query);
  }

  /**
   * Libera recursos utilizados pelo gerenciador
   */
  public async dispose(): Promise<void> {
    // Aguardar inicialização antes de liberar recursos
    await this.ensureInitialized();

    // Liberar recursos de cada componente
    await this.adaptiveContextWeightingEngine.dispose();
    this.dependencyGraphManager.dispose();
    await this.behaviorModelingEngine.dispose();
    await this.ecosystemConnectivityManager.dispose();
    await this.continuousValidationEngine.dispose();
  }
}
