import * as vscode from "vscode"
import * as path from "path"
import { ValidationMetric } from "../types"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"
import { EventEmitter } from "events"

/**
 * Motor de Validação Contínua
 * 
 * Monitora continuamente a eficácia do sistema através de indicadores como
 * precisão de sugestões, impacto na velocidade de desenvolvimento e melhoria
 * objetiva na qualidade do código.
 */
export class ContinuousValidationEngine extends EventEmitter {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private metrics: ValidationMetric[] = [];
  private benchmarks: Map<string, number> = new Map();
  private testResults: Map<string, { passed: number; failed: number; total: number }> = new Map();
  private usabilityFeedback: { positive: number; negative: number; neutral: number } = { 
    positive: 0, 
    negative: 0, 
    neutral: 0 
  };
  private lastSaveTime: number = 0;

  constructor(context: vscode.ExtensionContext) {
    super();
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.initialize();
  }

  /**
   * Inicializa o motor de validação contínua
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Carregar métricas existentes
    await this.loadMetrics();
    
    // Carregar benchmarks
    await this.loadBenchmarks();
    
    // Configurar monitoramento
    this.setupMonitoring();
    
    // Configurar salvamento periódico
    setInterval(() => this.saveMetrics(), 5 * 60 * 1000); // Salvar a cada 5 minutos
  }

  /**
   * Carrega métricas existentes
   */
  private async loadMetrics(): Promise<void> {
    try {
      const metricsPath = path.join(this.context.globalStorageUri.fsPath, 'validation-metrics.json');
      
      if (await fileExistsAtPath(metricsPath)) {
        const metricsData = JSON.parse(await fs.readFile(metricsPath, 'utf8'));
        this.metrics = metricsData.metrics || [];
        this.usabilityFeedback = metricsData.usabilityFeedback || { 
          positive: 0, 
          negative: 0, 
          neutral: 0 
        };
      }
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    }
  }

  /**
   * Carrega benchmarks
   */
  private async loadBenchmarks(): Promise<void> {
    try {
      const benchmarksPath = path.join(this.context.globalStorageUri.fsPath, 'validation-benchmarks.json');
      
      if (await fileExistsAtPath(benchmarksPath)) {
        const benchmarksData = JSON.parse(await fs.readFile(benchmarksPath, 'utf8'));
        this.benchmarks = new Map(Object.entries(benchmarksData));
      } else {
        // Configurar benchmarks padrão
        this.benchmarks.set('suggestion_acceptance_rate', 0.7); // 70% de aceitação
        this.benchmarks.set('code_quality_improvement', 0.1); // 10% de melhoria
        this.benchmarks.set('development_speed_improvement', 0.15); // 15% de melhoria
        this.benchmarks.set('test_pass_rate', 0.9); // 90% de testes passando
        
        // Salvar benchmarks padrão
        await this.saveBenchmarks();
      }
    } catch (error) {
      console.error('Erro ao carregar benchmarks:', error);
      
      // Configurar benchmarks padrão em caso de erro
      this.benchmarks.set('suggestion_acceptance_rate', 0.7);
      this.benchmarks.set('code_quality_improvement', 0.1);
      this.benchmarks.set('development_speed_improvement', 0.15);
      this.benchmarks.set('test_pass_rate', 0.9);
    }
  }

  /**
   * Configura monitoramento
   */
  private setupMonitoring(): void {
    // Monitorar execução de testes
    vscode.debug.onDidStartDebugSession(session => {
      if (session.type.includes('test')) {
        this.monitorTestSession(session);
      }
    });
    
    // Monitorar edições de código
    vscode.workspace.onDidChangeTextDocument(event => {
      this.trackCodeEdit(event);
    });
  }

  /**
   * Monitora uma sessão de teste
   */
  private monitorTestSession(session: vscode.DebugSession): void {
    // Registrar início de sessão de teste
    const testSessionId = `test_${Date.now()}`;
    this.testResults.set(testSessionId, { passed: 0, failed: 0, total: 0 });
    
    // Monitorar eventos de teste
    vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
      if (event.session.id === session.id) {
        this.processTestEvent(testSessionId, event);
      }
    });
    
    // Monitorar término da sessão
    vscode.debug.onDidTerminateDebugSession(terminatedSession => {
      if (terminatedSession.id === session.id) {
        this.finalizeTestSession(testSessionId);
      }
    });
  }

  /**
   * Processa um evento de teste
   */
  private processTestEvent(sessionId: string, event: vscode.DebugSessionCustomEvent): void {
    const results = this.testResults.get(sessionId);
    
    if (!results) {
      return;
    }
    
    // Analisar evento com base no tipo
    if (event.event.includes('test') || event.event.includes('spec')) {
      const body = event.body || {};
      
      if (body.passed) {
        results.passed += 1;
      } else if (body.failed) {
        results.failed += 1;
      }
      
      results.total += 1;
      
      this.testResults.set(sessionId, results);
    }
  }

  /**
   * Finaliza uma sessão de teste
   */
  private finalizeTestSession(sessionId: string): void {
    const results = this.testResults.get(sessionId);
    
    if (!results) {
      return;
    }
    
    // Calcular taxa de sucesso
    const passRate = results.total > 0 ? results.passed / results.total : 0;
    
    // Registrar métrica
    this.recordMetric({
      id: `test_pass_rate_${Date.now()}`,
      name: 'Test Pass Rate',
      value: passRate,
      timestamp: Date.now(),
      dimension: 'quality',
      metadata: {
        passed: results.passed,
        failed: results.failed,
        total: results.total
      }
    });
    
    // Comparar com benchmark
    const benchmark = this.benchmarks.get('test_pass_rate') || 0.9;
    
    if (passRate < benchmark) {
      // Emitir evento de alerta
      this.emit('alert', {
        type: 'test_failure',
        message: `Taxa de sucesso de testes (${(passRate * 100).toFixed(1)}%) abaixo do benchmark (${(benchmark * 100).toFixed(1)}%)`,
        data: results
      });
    }
    
    // Limpar resultados
    this.testResults.delete(sessionId);
  }

  /**
   * Rastreia uma edição de código
   */
  private trackCodeEdit(event: vscode.TextDocumentChangeEvent): void {
    // Implementação simplificada para rastreamento de edições
  }

  /**
   * Registra uma métrica de validação
   * 
   * @param metric Métrica a ser registrada
   */
  public recordMetric(metric: ValidationMetric): void {
    this.metrics.push(metric);
    
    // Emitir evento de métrica
    this.emit('metric', metric);
    
    // Salvar métricas periodicamente
    this.debouncedSaveMetrics();
  }

  /**
   * Registra feedback de usabilidade
   * 
   * @param type Tipo de feedback
   */
  public recordUsabilityFeedback(type: 'positive' | 'negative' | 'neutral'): void {
    this.usabilityFeedback[type] += 1;
    
    // Registrar métrica
    this.recordMetric({
      id: `usability_feedback_${Date.now()}`,
      name: 'Usability Feedback',
      value: type === 'positive' ? 1 : (type === 'negative' ? -1 : 0),
      timestamp: Date.now(),
      dimension: 'usability'
    });
    
    // Salvar métricas periodicamente
    this.debouncedSaveMetrics();
  }

  /**
   * Registra aceitação ou rejeição de sugestão
   * 
   * @param accepted Se a sugestão foi aceita
   * @param suggestionType Tipo de sugestão
   */
  public recordSuggestionFeedback(accepted: boolean, suggestionType: string): void {
    // Registrar métrica
    this.recordMetric({
      id: `suggestion_feedback_${Date.now()}`,
      name: 'Suggestion Feedback',
      value: accepted ? 1 : 0,
      timestamp: Date.now(),
      dimension: 'accuracy',
      metadata: {
        suggestionType
      }
    });
    
    // Calcular taxa de aceitação
    const recentSuggestions = this.metrics
      .filter(m => m.name === 'Suggestion Feedback' && Date.now() - m.timestamp < 7 * 24 * 60 * 60 * 1000); // Últimos 7 dias
    
    const acceptedCount = recentSuggestions.filter(m => m.value === 1).length;
    const acceptanceRate = recentSuggestions.length > 0 ? acceptedCount / recentSuggestions.length : 0;
    
    // Comparar com benchmark
    const benchmark = this.benchmarks.get('suggestion_acceptance_rate') || 0.7;
    
    if (acceptanceRate < benchmark && recentSuggestions.length >= 10) {
      // Emitir evento de alerta
      this.emit('alert', {
        type: 'low_acceptance_rate',
        message: `Taxa de aceitação de sugestões (${(acceptanceRate * 100).toFixed(1)}%) abaixo do benchmark (${(benchmark * 100).toFixed(1)}%)`,
        data: { acceptanceRate, benchmark, sampleSize: recentSuggestions.length }
      });
    }
  }

  /**
   * Registra tempo de desenvolvimento
   * 
   * @param taskId ID da tarefa
   * @param timeInSeconds Tempo em segundos
   * @param isCompleted Se a tarefa foi concluída
   */
  public recordDevelopmentTime(taskId: string, timeInSeconds: number, isCompleted: boolean): void {
    // Registrar métrica
    this.recordMetric({
      id: `development_time_${Date.now()}`,
      name: 'Development Time',
      value: timeInSeconds,
      timestamp: Date.now(),
      dimension: 'speed',
      metadata: {
        taskId,
        isCompleted
      }
    });
  }

  /**
   * Registra qualidade de código
   * 
   * @param filePath Caminho do arquivo
   * @param metrics Métricas de qualidade
   */
  public recordCodeQuality(filePath: string, metrics: {
    complexity?: number;
    lintErrors?: number;
    testCoverage?: number;
  }): void {
    // Registrar métrica
    this.recordMetric({
      id: `code_quality_${Date.now()}`,
      name: 'Code Quality',
      value: metrics.lintErrors !== undefined ? 1 - Math.min(1, metrics.lintErrors / 10) : 0.5,
      timestamp: Date.now(),
      dimension: 'quality',
      metadata: {
        filePath,
        ...metrics
      }
    });
  }

  /**
   * Versão com debounce para salvar métricas
   */
  private debouncedSaveMetrics = (() => {
    let timeout: NodeJS.Timeout | undefined;
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        this.saveMetrics();
      }, 5000); // Salvar após 5 segundos de inatividade
    };
  })();

  /**
   * Salva métricas
   */
  private async saveMetrics(): Promise<void> {
    try {
      const metricsPath = path.join(this.context.globalStorageUri.fsPath, 'validation-metrics.json');
      
      const metricsData = {
        metrics: this.metrics,
        usabilityFeedback: this.usabilityFeedback
      };
      
      await fs.writeFile(metricsPath, JSON.stringify(metricsData, null, 2));
      this.lastSaveTime = Date.now();
    } catch (error) {
      console.error('Erro ao salvar métricas:', error);
    }
  }

  /**
   * Salva benchmarks
   */
  private async saveBenchmarks(): Promise<void> {
    try {
      const benchmarksPath = path.join(this.context.globalStorageUri.fsPath, 'validation-benchmarks.json');
      await fs.writeFile(benchmarksPath, JSON.stringify(Object.fromEntries(this.benchmarks), null, 2));
    } catch (error) {
      console.error('Erro ao salvar benchmarks:', error);
    }
  }

  /**
   * Atualiza um benchmark
   * 
   * @param name Nome do benchmark
   * @param value Valor do benchmark
   */
  public updateBenchmark(name: string, value: number): void {
    this.benchmarks.set(name, value);
    this.saveBenchmarks();
  }

  /**
   * Obtém métricas por dimensão
   * 
   * @param dimension Dimensão das métricas
   * @param days Número de dias para filtrar (opcional)
   * @returns Lista de métricas filtradas
   */
  public getMetricsByDimension(dimension: 'accuracy' | 'speed' | 'quality' | 'usability', days?: number): ValidationMetric[] {
    let filteredMetrics = this.metrics.filter(m => m.dimension === dimension);
    
    if (days) {
      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
      filteredMetrics = filteredMetrics.filter(m => m.timestamp >= cutoffTime);
    }
    
    return filteredMetrics;
  }

  /**
   * Calcula estatísticas para uma dimensão
   * 
   * @param dimension Dimensão das métricas
   * @param days Número de dias para filtrar (opcional)
   * @returns Estatísticas calculadas
   */
  public calculateStats(dimension: 'accuracy' | 'speed' | 'quality' | 'usability', days?: number): {
    count: number;
    average: number;
    min: number;
    max: number;
    trend: 'up' | 'down' | 'stable';
  } {
    const metrics = this.getMetricsByDimension(dimension, days);
    
    if (metrics.length === 0) {
      return {
        count: 0,
        average: 0,
        min: 0,
        max: 0,
        trend: 'stable'
      };
    }
    
    // Calcular estatísticas básicas
    const values = metrics.map(m => m.value);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calcular tendência
    const sortedByTime = [...metrics].sort((a, b) => a.timestamp - b.timestamp);
    const firstHalf = sortedByTime.slice(0, Math.floor(sortedByTime.length / 2));
    const secondHalf = sortedByTime.slice(Math.floor(sortedByTime.length / 2));
    
    const firstHalfAvg = firstHalf.length > 0 
      ? firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length 
      : 0;
    
    const secondHalfAvg = secondHalf.length > 0 
      ? secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length 
      : 0;
    
    let trend: 'up' | 'down' | 'stable';
    
    if (secondHalfAvg > firstHalfAvg * 1.05) {
      trend = 'up';
    } else if (secondHalfAvg < firstHalfAvg * 0.95) {
      trend = 'down';
    } else {
      trend = 'stable';
    }
    
    return {
      count: metrics.length,
      average,
      min,
      max,
      trend
    };
  }

  /**
   * Executa testes A/B automatizados
   * 
   * @param testId ID do teste
   * @param variantA Variante A
   * @param variantB Variante B
   * @param metricName Nome da métrica para comparação
   * @param durationDays Duração do teste em dias
   * @returns Promise que resolve para o resultado do teste
   */
  public async runABTest(
    testId: string,
    variantA: string,
    variantB: string,
    metricName: string,
    durationDays: number
  ): Promise<{
    winner: string | null;
    confidence: number;
    variantAMetrics: ValidationMetric[];
    variantBMetrics: ValidationMetric[];
  }> {
    // Registrar início do teste
    const startTime = Date.now();
    const endTime = startTime + durationDays * 24 * 60 * 60 * 1000;
    
    // Registrar métrica de início de teste
    this.recordMetric({
      id: `ab_test_start_${testId}`,
      name: 'A/B Test Start',
      value: 1,
      timestamp: startTime,
      dimension: 'quality',
      metadata: {
        testId,
        variantA,
        variantB,
        metricName,
        durationDays
      }
    });
    
    // Aguardar conclusão do teste
    await new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (Date.now() >= endTime) {
          clearInterval(checkInterval);
          resolve(null);
        }
      }, 60 * 60 * 1000); // Verificar a cada hora
    });
    
    // Coletar métricas para cada variante
    const variantAMetrics = this.metrics.filter(m => 
      m.name === metricName && 
      m.timestamp >= startTime && 
      m.timestamp <= endTime &&
      m.metadata?.variant === variantA
    );
    
    const variantBMetrics = this.metrics.filter(m => 
      m.name === metricName && 
      m.timestamp >= startTime && 
      m.timestamp <= endTime &&
      m.metadata?.variant === variantB
    );
    
    // Calcular médias
    const variantAAvg = variantAMetrics.length > 0 
      ? variantAMetrics.reduce((sum, m) => sum + m.value, 0) / variantAMetrics.length 
      : 0;
    
    const variantBAvg = variantBMetrics.length > 0 
      ? variantBMetrics.reduce((sum, m) => sum + m.value, 0) / variantBMetrics.length 
      : 0;
    
    // Determinar vencedor
    let winner: string | null = null;
    let confidence = 0;
    
    if (variantAMetrics.length >= 10 && variantBMetrics.length >= 10) {
      if (variantAAvg > variantBAvg * 1.1) {
        winner = variantA;
        confidence = 0.9;
      } else if (variantBAvg > variantAAvg * 1.1) {
        winner = variantB;
        confidence = 0.9;
      } else if (variantAAvg > variantBAvg) {
        winner = variantA;
        confidence = 0.6;
      } else if (variantBAvg > variantAAvg) {
        winner = variantB;
        confidence = 0.6;
      }
    }
    
    // Registrar resultado do teste
    this.recordMetric({
      id: `ab_test_result_${testId}`,
      name: 'A/B Test Result',
      value: confidence,
      timestamp: Date.now(),
      dimension: 'quality',
      metadata: {
        testId,
        variantA,
        variantAAvg,
        variantACount: variantAMetrics.length,
        variantB,
        variantBAvg,
        variantBCount: variantBMetrics.length,
        winner
      }
    });
    
    return {
      winner,
      confidence,
      variantAMetrics,
      variantBMetrics
    };
  }

  /**
   * Gera um relatório de validação
   * 
   * @param days Número de dias para incluir no relatório
   * @returns Relatório de validação
   */
  public generateValidationReport(days: number = 30): {
    accuracy: { stats: any; metrics: ValidationMetric[] };
    speed: { stats: any; metrics: ValidationMetric[] };
    quality: { stats: any; metrics: ValidationMetric[] };
    usability: { stats: any; metrics: ValidationMetric[] };
    benchmarks: Record<string, number>;
    usabilityFeedback: { positive: number; negative: number; neutral: number };
  } {
    return {
      accuracy: {
        stats: this.calculateStats('accuracy', days),
        metrics: this.getMetricsByDimension('accuracy', days)
      },
      speed: {
        stats: this.calculateStats('speed', days),
        metrics: this.getMetricsByDimension('speed', days)
      },
      quality: {
        stats: this.calculateStats('quality', days),
        metrics: this.getMetricsByDimension('quality', days)
      },
      usability: {
        stats: this.calculateStats('usability', days),
        metrics: this.getMetricsByDimension('usability', days)
      },
      benchmarks: Object.fromEntries(this.benchmarks),
      usabilityFeedback: this.usabilityFeedback
    };
  }

  /**
   * Libera recursos utilizados pelo motor
   */
  public async dispose(): Promise<void> {
    // Salvar métricas antes de liberar recursos
    await this.saveMetrics();
    await this.saveBenchmarks();
  }
}
