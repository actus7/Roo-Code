import * as vscode from "vscode"
import * as path from "path"
import { NormalizedData } from "../types"
import { SemanticNormalizationService } from "../semantic-normalization/SemanticNormalizationService"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"
import axios from "axios"
import { EventEmitter } from "events"

/**
 * Interface para um conector de ferramenta externa
 */
interface ExternalToolConnector {
  id: string;
  name: string;
  description: string;
  connect(): Promise<boolean>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  fetchData(query?: any): Promise<any>;
  sendData(data: any): Promise<any>;
}

/**
 * Evento de dados do ecossistema
 */
interface EcosystemDataEvent {
  source: string;
  eventType: string;
  timestamp: number;
  data: any;
}

/**
 * Gerenciador de Conectividade Ecossistêmica
 *
 * Implementa conectores especializados para integração bidirecional simultânea
 * com ferramentas críticas do ecossistema de desenvolvimento.
 */
export class EcosystemConnectivityManager extends EventEmitter {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private normalizationService: SemanticNormalizationService;
  private connectors: Map<string, ExternalToolConnector> = new Map();
  private eventQueue: EcosystemDataEvent[] = [];
  private isProcessingQueue: boolean = false;
  private priorityThresholds: Map<string, number> = new Map();

  constructor(context: vscode.ExtensionContext, normalizationService: SemanticNormalizationService) {
    super();
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.normalizationService = normalizationService;
    this.initialize();
  }

  /**
   * Inicializa o gerenciador de conectividade
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Inicializar conectores padrão
    await this.initializeDefaultConnectors();

    // Carregar configurações de prioridade
    await this.loadPrioritySettings();

    // Iniciar processamento de fila de eventos
    setInterval(() => this.processEventQueue(), 1000);
  }

  /**
   * Inicializa conectores padrão
   */
  private async initializeDefaultConnectors(): Promise<void> {
    if (this.workspacePath) {
      // Adicionar conector de Git
      this.registerConnector(new GitConnector(this.workspacePath));

      // Adicionar conector de CI/CD (se disponível)
      if (await this.detectCISystem()) {
        this.registerConnector(new CICDConnector(this.workspacePath));
      }

      // Adicionar conector de sistema de tickets (se disponível)
      if (await this.detectTicketSystem()) {
        this.registerConnector(new TicketSystemConnector(this.workspacePath));
      }

      // Adicionar conector de monitoramento (se disponível)
      if (await this.detectMonitoringSystem()) {
        this.registerConnector(new MonitoringConnector(this.workspacePath));
      }
    }
  }

  /**
   * Detecta sistema de CI
   */
  private async detectCISystem(): Promise<boolean> {
    if (!this.workspacePath) {
      return false;
    }

    // Verificar arquivos comuns de CI
    const ciFiles = [
      '.github/workflows',
      '.gitlab-ci.yml',
      'Jenkinsfile',
      '.travis.yml',
      'azure-pipelines.yml',
      '.circleci/config.yml'
    ];

    for (const file of ciFiles) {
      if (await fileExistsAtPath(path.join(this.workspacePath, file))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detecta sistema de tickets
   */
  private async detectTicketSystem(): Promise<boolean> {
    if (!this.workspacePath) {
      return false;
    }

    // Verificar arquivos de configuração comuns
    const configFiles = [
      '.jira-config.json',
      '.github/ISSUE_TEMPLATE',
      '.gitlab/issue_templates'
    ];

    for (const file of configFiles) {
      if (await fileExistsAtPath(path.join(this.workspacePath, file))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Detecta sistema de monitoramento
   */
  private async detectMonitoringSystem(): Promise<boolean> {
    if (!this.workspacePath) {
      return false;
    }

    // Verificar arquivos de configuração comuns
    const monitoringFiles = [
      'prometheus.yml',
      'grafana.ini',
      'datadog.yml',
      'newrelic.yml',
      'sentry.properties'
    ];

    for (const file of monitoringFiles) {
      if (await fileExistsAtPath(path.join(this.workspacePath, file))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Carrega configurações de prioridade
   */
  private async loadPrioritySettings(): Promise<void> {
    try {
      const settingsPath = path.join(this.context.globalStorageUri.fsPath, 'ecosystem-priority.json');

      if (await fileExistsAtPath(settingsPath)) {
        const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8'));

        if (settings.priorities) {
          this.priorityThresholds = new Map(Object.entries(settings.priorities));
        }
      } else {
        // Configurar prioridades padrão
        this.priorityThresholds.set('git', 80);
        this.priorityThresholds.set('cicd', 60);
        this.priorityThresholds.set('tickets', 70);
        this.priorityThresholds.set('monitoring', 50);

        // Salvar configurações padrão
        await this.savePrioritySettings();
      }
    } catch (error) {
      console.error('Erro ao carregar configurações de prioridade:', error);

      // Configurar prioridades padrão em caso de erro
      this.priorityThresholds.set('git', 80);
      this.priorityThresholds.set('cicd', 60);
      this.priorityThresholds.set('tickets', 70);
      this.priorityThresholds.set('monitoring', 50);
    }
  }

  /**
   * Salva configurações de prioridade
   */
  private async savePrioritySettings(): Promise<void> {
    try {
      const settingsPath = path.join(this.context.globalStorageUri.fsPath, 'ecosystem-priority.json');

      const settings = {
        priorities: Object.fromEntries(this.priorityThresholds)
      };

      await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error('Erro ao salvar configurações de prioridade:', error);
    }
  }

  /**
   * Registra um conector de ferramenta externa
   *
   * @param connector Conector a ser registrado
   */
  public registerConnector(connector: ExternalToolConnector): void {
    this.connectors.set(connector.id, connector);

    // Tentar conectar automaticamente
    connector.connect().catch(error => {
      console.error(`Erro ao conectar ${connector.name}:`, error);
    });
  }

  /**
   * Remove um conector de ferramenta externa
   *
   * @param connectorId ID do conector a ser removido
   */
  public async removeConnector(connectorId: string): Promise<void> {
    const connector = this.connectors.get(connectorId);

    if (connector) {
      await connector.disconnect();
      this.connectors.delete(connectorId);
    }
  }

  /**
   * Obtém um conector pelo ID
   *
   * @param connectorId ID do conector
   * @returns Conector ou undefined se não encontrado
   */
  public getConnector(connectorId: string): ExternalToolConnector | undefined {
    return this.connectors.get(connectorId);
  }

  /**
   * Obtém todos os conectores registrados
   *
   * @returns Lista de conectores
   */
  public getAllConnectors(): ExternalToolConnector[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Adiciona um evento à fila de processamento
   *
   * @param event Evento a ser adicionado
   */
  public queueEvent(event: EcosystemDataEvent): void {
    this.eventQueue.push(event);
  }

  /**
   * Processa a fila de eventos
   */
  private async processEventQueue(): Promise<void> {
    if (this.isProcessingQueue || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      // Ordenar eventos por prioridade
      const sortedEvents = this.prioritizeEvents([...this.eventQueue]);

      // Limpar fila
      this.eventQueue = [];

      // Processar eventos
      for (const event of sortedEvents) {
        await this.processEvent(event);
      }
    } catch (error) {
      console.error('Erro ao processar fila de eventos:', error);
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Prioriza eventos com base nas configurações
   *
   * @param events Lista de eventos a serem priorizados
   * @returns Lista de eventos ordenada por prioridade
   */
  private prioritizeEvents(events: EcosystemDataEvent[]): EcosystemDataEvent[] {
    return events.sort((a, b) => {
      const priorityA = this.calculateEventPriority(a);
      const priorityB = this.calculateEventPriority(b);
      return priorityB - priorityA; // Ordem decrescente
    });
  }

  /**
   * Calcula a prioridade de um evento
   *
   * @param event Evento
   * @returns Valor de prioridade
   */
  private calculateEventPriority(event: EcosystemDataEvent): number {
    // Obter limiar de prioridade para a fonte
    const threshold = this.priorityThresholds.get(event.source) || 50;

    // Calcular prioridade base
    let priority = threshold;

    // Ajustar com base no tipo de evento
    switch (event.eventType) {
      case 'error':
        priority += 30;
        break;
      case 'warning':
        priority += 20;
        break;
      case 'update':
        priority += 10;
        break;
      case 'info':
        // Prioridade padrão
        break;
    }

    // Ajustar com base na idade do evento (eventos mais recentes têm prioridade)
    const ageInSeconds = (Date.now() - event.timestamp) / 1000;
    if (ageInSeconds < 60) {
      priority += 10; // Evento dos últimos 60 segundos
    } else if (ageInSeconds < 300) {
      priority += 5; // Evento dos últimos 5 minutos
    }

    return Math.min(100, priority); // Limitar a 100
  }

  /**
   * Processa um evento
   *
   * @param event Evento a ser processado
   */
  private async processEvent(event: EcosystemDataEvent): Promise<void> {
    try {
      // Normalizar dados do evento
      const normalizedData: NormalizedData = {
        sourceType: event.source,
        originalFormat: event.eventType,
        normalizedContent: event.data
      };

      // Emitir evento normalizado
      this.emit('data', normalizedData);

      // Processar com base no tipo de evento
      switch (event.eventType) {
        case 'git_commit':
          await this.processGitCommit(event.data);
          break;
        case 'ci_build':
          await this.processCIBuild(event.data);
          break;
        case 'ticket_update':
          await this.processTicketUpdate(event.data);
          break;
        case 'monitoring_alert':
          await this.processMonitoringAlert(event.data);
          break;
      }
    } catch (error) {
      console.error('Erro ao processar evento:', error);
    }
  }

  /**
   * Processa um evento de commit do Git
   */
  private async processGitCommit(data: any): Promise<void> {
    // Implementação específica para processamento de commits
  }

  /**
   * Processa um evento de build de CI
   */
  private async processCIBuild(data: any): Promise<void> {
    // Implementação específica para processamento de builds
  }

  /**
   * Processa um evento de atualização de ticket
   */
  private async processTicketUpdate(data: any): Promise<void> {
    // Implementação específica para processamento de tickets
  }

  /**
   * Processa um evento de alerta de monitoramento
   */
  private async processMonitoringAlert(data: any): Promise<void> {
    // Implementação específica para processamento de alertas
  }

  /**
   * Busca dados de uma ferramenta externa
   *
   * @param connectorId ID do conector
   * @param query Consulta opcional
   * @returns Dados normalizados
   */
  public async fetchExternalData(connectorId: string, query?: any): Promise<NormalizedData | undefined> {
    const connector = this.connectors.get(connectorId);

    if (!connector) {
      throw new Error(`Conector não encontrado: ${connectorId}`);
    }

    if (!connector.isConnected()) {
      await connector.connect();
    }

    const data = await connector.fetchData(query);

    // Normalizar dados com base no tipo de conector
    let normalizedData: NormalizedData;

    switch (connectorId) {
      case 'git':
        normalizedData = {
          sourceType: 'git',
          originalFormat: 'git_data',
          normalizedContent: data
        };
        break;
      case 'cicd':
        normalizedData = this.normalizationService.normalizeCI_CDData(data);
        break;
      case 'tickets':
        normalizedData = {
          sourceType: 'ticket_system',
          originalFormat: 'ticket_data',
          normalizedContent: data
        };
        break;
      case 'monitoring':
        normalizedData = this.normalizationService.normalizePerformanceData(data);
        break;
      default:
        normalizedData = {
          sourceType: connectorId,
          originalFormat: 'unknown',
          normalizedContent: data
        };
    }

    return normalizedData;
  }

  /**
   * Envia dados para uma ferramenta externa
   *
   * @param connectorId ID do conector
   * @param data Dados a serem enviados
   * @returns Resposta da ferramenta
   */
  public async sendExternalData(connectorId: string, data: any): Promise<any> {
    const connector = this.connectors.get(connectorId);

    if (!connector) {
      throw new Error(`Conector não encontrado: ${connectorId}`);
    }

    if (!connector.isConnected()) {
      await connector.connect();
    }

    return await connector.sendData(data);
  }

  /**
   * Libera recursos utilizados pelo gerenciador
   */
  public async dispose(): Promise<void> {
    // Desconectar todos os conectores
    for (const connector of this.connectors.values()) {
      await connector.disconnect();
    }

    // Limpar conectores
    this.connectors.clear();

    // Salvar configurações
    await this.savePrioritySettings();
  }
}

/**
 * Conector para Git
 */
class GitConnector implements ExternalToolConnector {
  id: string = 'git';
  name: string = 'Git';
  description: string = 'Conector para o sistema de controle de versão Git';
  private workspacePath: string;
  private connected: boolean = false;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async connect(): Promise<boolean> {
    try {
      // Verificar se o diretório é um repositório Git
      const { execSync } = require('child_process');
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: this.workspacePath,
        stdio: 'ignore'
      });

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchData(query?: any): Promise<any> {
    if (!this.connected) {
      throw new Error('Git connector is not connected');
    }

    try {
      const { execSync } = require('child_process');

      if (!query || !query.command) {
        // Comando padrão: obter informações do repositório
        const output = execSync('git remote -v && git branch -v && git log -1', {
          cwd: this.workspacePath,
          encoding: 'utf8'
        });

        return { output };
      }

      // Executar comando específico
      // Filtrar comandos permitidos por segurança
      const allowedCommands = [
        'log', 'status', 'branch', 'remote', 'show', 'diff', 'blame'
      ];

      const command = query.command.split(' ')[0];

      if (!allowedCommands.includes(command)) {
        throw new Error(`Comando Git não permitido: ${command}`);
      }

      const output = execSync(`git ${query.command}`, {
        cwd: this.workspacePath,
        encoding: 'utf8'
      });

      return { output };
    } catch (error) {
      throw new Error(`Erro ao executar comando Git: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async sendData(data: any): Promise<any> {
    throw new Error('Operação não suportada: Git connector é somente leitura');
  }
}

/**
 * Conector para sistemas de CI/CD
 */
class CICDConnector implements ExternalToolConnector {
  id: string = 'cicd';
  name: string = 'CI/CD';
  description: string = 'Conector para sistemas de integração contínua e entrega contínua';
  private workspacePath: string;
  private connected: boolean = false;
  private ciSystem: string | undefined;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async connect(): Promise<boolean> {
    try {
      // Detectar sistema de CI
      if (await fileExistsAtPath(path.join(this.workspacePath, '.github/workflows'))) {
        this.ciSystem = 'github';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, '.gitlab-ci.yml'))) {
        this.ciSystem = 'gitlab';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'Jenkinsfile'))) {
        this.ciSystem = 'jenkins';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, '.travis.yml'))) {
        this.ciSystem = 'travis';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'azure-pipelines.yml'))) {
        this.ciSystem = 'azure';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, '.circleci/config.yml'))) {
        this.ciSystem = 'circleci';
      } else {
        return false;
      }

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchData(query?: any): Promise<any> {
    if (!this.connected || !this.ciSystem) {
      throw new Error('CI/CD connector is not connected');
    }

    // Implementação simplificada: retornar informações sobre o sistema de CI
    return {
      system: this.ciSystem,
      configFile: this.getConfigFilePath()
    };
  }

  private getConfigFilePath(): string {
    switch (this.ciSystem) {
      case 'github':
        return '.github/workflows';
      case 'gitlab':
        return '.gitlab-ci.yml';
      case 'jenkins':
        return 'Jenkinsfile';
      case 'travis':
        return '.travis.yml';
      case 'azure':
        return 'azure-pipelines.yml';
      case 'circleci':
        return '.circleci/config.yml';
      default:
        return '';
    }
  }

  async sendData(data: any): Promise<any> {
    throw new Error('Operação não suportada: CI/CD connector é somente leitura');
  }
}

/**
 * Conector para sistemas de tickets
 */
class TicketSystemConnector implements ExternalToolConnector {
  id: string = 'tickets';
  name: string = 'Ticket System';
  description: string = 'Conector para sistemas de gerenciamento de tickets';
  private workspacePath: string;
  private connected: boolean = false;
  private ticketSystem: string | undefined;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async connect(): Promise<boolean> {
    try {
      // Detectar sistema de tickets
      if (await fileExistsAtPath(path.join(this.workspacePath, '.jira-config.json'))) {
        this.ticketSystem = 'jira';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, '.github/ISSUE_TEMPLATE'))) {
        this.ticketSystem = 'github';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, '.gitlab/issue_templates'))) {
        this.ticketSystem = 'gitlab';
      } else {
        return false;
      }

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchData(query?: any): Promise<any> {
    if (!this.connected || !this.ticketSystem) {
      throw new Error('Ticket system connector is not connected');
    }

    // Implementação simplificada: retornar informações sobre o sistema de tickets
    return {
      system: this.ticketSystem
    };
  }

  async sendData(data: any): Promise<any> {
    throw new Error('Operação não suportada: Ticket system connector é somente leitura');
  }
}

/**
 * Conector para sistemas de monitoramento
 */
class MonitoringConnector implements ExternalToolConnector {
  id: string = 'monitoring';
  name: string = 'Monitoring';
  description: string = 'Conector para sistemas de monitoramento';
  private workspacePath: string;
  private connected: boolean = false;
  private monitoringSystem: string | undefined;

  constructor(workspacePath: string) {
    this.workspacePath = workspacePath;
  }

  async connect(): Promise<boolean> {
    try {
      // Detectar sistema de monitoramento
      if (await fileExistsAtPath(path.join(this.workspacePath, 'prometheus.yml'))) {
        this.monitoringSystem = 'prometheus';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'grafana.ini'))) {
        this.monitoringSystem = 'grafana';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'datadog.yml'))) {
        this.monitoringSystem = 'datadog';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'newrelic.yml'))) {
        this.monitoringSystem = 'newrelic';
      } else if (await fileExistsAtPath(path.join(this.workspacePath, 'sentry.properties'))) {
        this.monitoringSystem = 'sentry';
      } else {
        return false;
      }

      this.connected = true;
      return true;
    } catch (error) {
      this.connected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async fetchData(query?: any): Promise<any> {
    if (!this.connected || !this.monitoringSystem) {
      throw new Error('Monitoring connector is not connected');
    }

    // Implementação simplificada: retornar informações sobre o sistema de monitoramento
    return {
      system: this.monitoringSystem
    };
  }

  async sendData(data: any): Promise<any> {
    throw new Error('Operação não suportada: Monitoring connector é somente leitura');
  }
}
