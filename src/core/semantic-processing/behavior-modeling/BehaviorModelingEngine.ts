import * as vscode from "vscode"
import * as path from "path"
import { UserBehaviorProfile, ContextualizedSuggestion } from "../types"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"

/**
 * Motor de Modelagem Integrada de Comportamento
 * 
 * Aprende simultaneamente perfis individuais e coletivos através da análise contínua
 * de hábitos de codificação, padrões de teste e estratégias de debug.
 */
export class BehaviorModelingEngine {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private userProfile: UserBehaviorProfile;
  private teamProfiles: Map<string, UserBehaviorProfile> = new Map();
  private suggestionFeedback: Map<string, { accepted: number; rejected: number }> = new Map();
  private editHistory: { timestamp: number; file: string; type: string }[] = [];
  private lastSaveTime: number = 0;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    
    // Inicializar perfil do usuário
    this.userProfile = {
      id: "current-user",
      codingPatterns: {},
      preferredLanguages: {},
      commonEdits: {},
      testingPatterns: {},
      debugPatterns: {},
      metadata: {}
    };
    
    this.initialize();
  }

  /**
   * Inicializa o motor de modelagem de comportamento
   */
  private async initialize(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    // Carregar perfil do usuário
    await this.loadUserProfile();
    
    // Carregar perfis de equipe
    await this.loadTeamProfiles();
    
    // Configurar monitoramento de comportamento
    this.setupBehaviorTracking();
    
    // Configurar salvamento periódico
    setInterval(() => this.saveProfiles(), 5 * 60 * 1000); // Salvar a cada 5 minutos
  }

  /**
   * Carrega o perfil do usuário
   */
  private async loadUserProfile(): Promise<void> {
    try {
      const profilePath = path.join(this.context.globalStorageUri.fsPath, 'user-behavior-profile.json');
      
      if (await fileExistsAtPath(profilePath)) {
        const profileData = JSON.parse(await fs.readFile(profilePath, 'utf8'));
        this.userProfile = profileData;
      }
    } catch (error) {
      console.error('Erro ao carregar perfil do usuário:', error);
    }
  }

  /**
   * Carrega perfis de equipe
   */
  private async loadTeamProfiles(): Promise<void> {
    try {
      const teamProfilesPath = path.join(this.context.globalStorageUri.fsPath, 'team-behavior-profiles.json');
      
      if (await fileExistsAtPath(teamProfilesPath)) {
        const profilesData = JSON.parse(await fs.readFile(teamProfilesPath, 'utf8'));
        
        for (const [id, profile] of Object.entries(profilesData)) {
          this.teamProfiles.set(id, profile as UserBehaviorProfile);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfis de equipe:', error);
    }
  }

  /**
   * Configura o monitoramento de comportamento
   */
  private setupBehaviorTracking(): void {
    // Monitorar edições de texto
    vscode.workspace.onDidChangeTextDocument(event => {
      this.trackEdit(event);
    });
    
    // Monitorar salvamento de arquivos
    vscode.workspace.onDidSaveTextDocument(document => {
      this.trackSave(document);
    });
    
    // Monitorar abertura de arquivos
    vscode.workspace.onDidOpenTextDocument(document => {
      this.trackFileOpen(document);
    });
    
    // Monitorar execução de testes
    vscode.debug.onDidStartDebugSession(session => {
      if (session.type.includes('test')) {
        this.trackTestExecution(session);
      }
    });
    
    // Monitorar sessões de debug
    vscode.debug.onDidStartDebugSession(session => {
      if (!session.type.includes('test')) {
        this.trackDebugSession(session);
      }
    });
  }

  /**
   * Rastreia uma edição de texto
   */
  private trackEdit(event: vscode.TextDocumentChangeEvent): void {
    if (!this.workspacePath) {
      return;
    }

    const document = event.document;
    const filePath = document.uri.fsPath;
    const relativePath = path.relative(this.workspacePath, filePath);
    
    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }
    
    // Obter extensão do arquivo
    const fileExt = path.extname(filePath).substring(1); // Remover o ponto
    
    // Atualizar preferência de linguagem
    this.updateCounterMap(this.userProfile.preferredLanguages, fileExt);
    
    // Analisar tipo de edição
    for (const change of event.contentChanges) {
      let editType = "unknown";
      
      if (change.text === '') {
        editType = "delete";
      } else if (change.rangeLength === 0) {
        editType = "insert";
      } else {
        editType = "replace";
      }
      
      // Atualizar padrões de edição
      this.updateCounterMap(this.userProfile.commonEdits, editType);
      
      // Registrar no histórico de edições
      this.editHistory.push({
        timestamp: Date.now(),
        file: relativePath,
        type: editType
      });
      
      // Limitar tamanho do histórico
      if (this.editHistory.length > 1000) {
        this.editHistory.shift();
      }
      
      // Analisar padrões específicos de linguagem
      this.analyzeLanguageSpecificPatterns(document, change, fileExt);
    }
  }

  /**
   * Analisa padrões específicos de linguagem em uma edição
   */
  private analyzeLanguageSpecificPatterns(
    document: vscode.TextDocument,
    change: vscode.TextDocumentContentChangeEvent,
    language: string
  ): void {
    const text = change.text;
    
    // Detectar padrões comuns
    if (text.includes('if ') || text.includes('else ')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'conditional');
    }
    
    if (text.includes('for ') || text.includes('while ')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'loop');
    }
    
    if (text.includes('function ') || text.includes('def ') || text.includes('=> ')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'function_definition');
    }
    
    if (text.includes('class ')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'class_definition');
    }
    
    // Padrões específicos de linguagem
    switch (language) {
      case 'ts':
      case 'tsx':
        if (text.includes('interface ')) {
          this.updateCounterMap(this.userProfile.codingPatterns, 'typescript_interface');
        }
        if (text.includes('<') && text.includes('>')) {
          this.updateCounterMap(this.userProfile.codingPatterns, 'typescript_generics');
        }
        break;
        
      case 'js':
      case 'jsx':
        if (text.includes('async ')) {
          this.updateCounterMap(this.userProfile.codingPatterns, 'javascript_async');
        }
        if (text.includes('await ')) {
          this.updateCounterMap(this.userProfile.codingPatterns, 'javascript_await');
        }
        break;
        
      case 'py':
        if (text.includes('def test_')) {
          this.updateCounterMap(this.userProfile.testingPatterns, 'python_test_function');
        }
        if (text.includes('with ')) {
          this.updateCounterMap(this.userProfile.codingPatterns, 'python_context_manager');
        }
        break;
    }
    
    // Detectar padrões de teste
    if (
      text.includes('test') || 
      text.includes('assert') || 
      text.includes('expect(') ||
      text.includes('should')
    ) {
      this.updateCounterMap(this.userProfile.testingPatterns, 'test_code');
    }
    
    // Detectar padrões de debug
    if (
      text.includes('console.log') || 
      text.includes('print(') || 
      text.includes('debug(')
    ) {
      this.updateCounterMap(this.userProfile.debugPatterns, 'debug_print');
    }
  }

  /**
   * Rastreia o salvamento de um arquivo
   */
  private trackSave(document: vscode.TextDocument): void {
    if (!this.workspacePath) {
      return;
    }

    const filePath = document.uri.fsPath;
    const relativePath = path.relative(this.workspacePath, filePath);
    
    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }
    
    // Calcular tempo desde o último salvamento
    const now = Date.now();
    const timeSinceLastSave = now - this.lastSaveTime;
    this.lastSaveTime = now;
    
    // Analisar frequência de salvamento
    if (timeSinceLastSave < 10000) { // Menos de 10 segundos
      this.updateCounterMap(this.userProfile.codingPatterns, 'frequent_save');
    } else if (timeSinceLastSave > 300000) { // Mais de 5 minutos
      this.updateCounterMap(this.userProfile.codingPatterns, 'infrequent_save');
    } else {
      this.updateCounterMap(this.userProfile.codingPatterns, 'normal_save');
    }
  }

  /**
   * Rastreia a abertura de um arquivo
   */
  private trackFileOpen(document: vscode.TextDocument): void {
    if (!this.workspacePath) {
      return;
    }

    const filePath = document.uri.fsPath;
    const relativePath = path.relative(this.workspacePath, filePath);
    
    // Ignorar arquivos fora do workspace
    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
      return;
    }
    
    // Obter extensão do arquivo
    const fileExt = path.extname(filePath).substring(1); // Remover o ponto
    
    // Atualizar preferência de linguagem
    this.updateCounterMap(this.userProfile.preferredLanguages, fileExt);
    
    // Detectar tipo de arquivo
    if (filePath.includes('test') || filePath.includes('spec')) {
      this.updateCounterMap(this.userProfile.testingPatterns, 'open_test_file');
    } else if (filePath.endsWith('.json')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'open_config_file');
    } else if (filePath.endsWith('.md')) {
      this.updateCounterMap(this.userProfile.codingPatterns, 'open_documentation');
    }
  }

  /**
   * Rastreia a execução de testes
   */
  private trackTestExecution(session: vscode.DebugSession): void {
    // Identificar tipo de teste
    let testType = 'unknown';
    
    if (session.type.includes('jest')) {
      testType = 'jest';
    } else if (session.type.includes('mocha')) {
      testType = 'mocha';
    } else if (session.type.includes('pytest')) {
      testType = 'pytest';
    } else if (session.type.includes('unittest')) {
      testType = 'unittest';
    }
    
    // Atualizar padrões de teste
    this.updateCounterMap(this.userProfile.testingPatterns, `run_${testType}`);
  }

  /**
   * Rastreia uma sessão de debug
   */
  private trackDebugSession(session: vscode.DebugSession): void {
    // Identificar tipo de debug
    let debugType = session.type;
    
    // Atualizar padrões de debug
    this.updateCounterMap(this.userProfile.debugPatterns, `debug_${debugType}`);
    
    // Monitorar eventos de debug
    vscode.debug.onDidReceiveDebugSessionCustomEvent(event => {
      if (event.session.id === session.id) {
        this.trackDebugEvent(event);
      }
    });
  }

  /**
   * Rastreia um evento de debug
   */
  private trackDebugEvent(event: vscode.DebugSessionCustomEvent): void {
    // Atualizar padrões de debug com base no evento
    this.updateCounterMap(this.userProfile.debugPatterns, `debug_event_${event.event}`);
  }

  /**
   * Atualiza um mapa de contadores
   */
  private updateCounterMap(map: Record<string, number>, key: string): void {
    map[key] = (map[key] || 0) + 1;
  }

  /**
   * Salva os perfis de comportamento
   */
  private async saveProfiles(): Promise<void> {
    if (!this.workspacePath) {
      return;
    }

    try {
      // Salvar perfil do usuário
      const userProfilePath = path.join(this.context.globalStorageUri.fsPath, 'user-behavior-profile.json');
      await fs.writeFile(userProfilePath, JSON.stringify(this.userProfile, null, 2));
      
      // Salvar perfis de equipe
      const teamProfilesPath = path.join(this.context.globalStorageUri.fsPath, 'team-behavior-profiles.json');
      const teamProfilesData = Object.fromEntries(this.teamProfiles.entries());
      await fs.writeFile(teamProfilesPath, JSON.stringify(teamProfilesData, null, 2));
      
      // Salvar feedback de sugestões
      const feedbackPath = path.join(this.context.globalStorageUri.fsPath, 'suggestion-feedback.json');
      await fs.writeFile(feedbackPath, JSON.stringify(Object.fromEntries(this.suggestionFeedback.entries()), null, 2));
    } catch (error) {
      console.error('Erro ao salvar perfis de comportamento:', error);
    }
  }

  /**
   * Registra feedback para uma sugestão
   * 
   * @param suggestionId ID da sugestão
   * @param accepted Se a sugestão foi aceita
   */
  public recordSuggestionFeedback(suggestionId: string, accepted: boolean): void {
    const feedback = this.suggestionFeedback.get(suggestionId) || { accepted: 0, rejected: 0 };
    
    if (accepted) {
      feedback.accepted += 1;
    } else {
      feedback.rejected += 1;
    }
    
    this.suggestionFeedback.set(suggestionId, feedback);
    
    // Salvar feedback periodicamente
    this.debouncedSaveProfiles();
  }

  /**
   * Versão com debounce para salvar perfis
   */
  private debouncedSaveProfiles = (() => {
    let timeout: NodeJS.Timeout | undefined;
    
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        this.saveProfiles();
      }, 5000); // Salvar após 5 segundos de inatividade
    };
  })();

  /**
   * Obtém o perfil de comportamento do usuário
   * 
   * @returns Perfil de comportamento do usuário
   */
  public getUserProfile(): UserBehaviorProfile {
    return this.userProfile;
  }

  /**
   * Obtém perfis de comportamento da equipe
   * 
   * @returns Mapa de perfis de comportamento da equipe
   */
  public getTeamProfiles(): Map<string, UserBehaviorProfile> {
    return this.teamProfiles;
  }

  /**
   * Detecta convenções de equipe com base nos perfis
   * 
   * @returns Lista de convenções detectadas
   */
  public detectTeamConventions(): { name: string; confidence: number; description: string }[] {
    const conventions = [];
    
    // Analisar padrões comuns entre perfis de equipe
    const allProfiles = [this.userProfile, ...this.teamProfiles.values()];
    
    // Convenções de codificação
    const codingPatterns = this.aggregatePatterns(allProfiles, 'codingPatterns');
    for (const [pattern, count] of Object.entries(codingPatterns)) {
      if (count >= allProfiles.length * 0.7) { // Pelo menos 70% dos perfis têm este padrão
        conventions.push({
          name: `coding_convention_${pattern}`,
          confidence: count / allProfiles.length,
          description: `A equipe frequentemente usa o padrão de codificação: ${pattern}`
        });
      }
    }
    
    // Convenções de teste
    const testingPatterns = this.aggregatePatterns(allProfiles, 'testingPatterns');
    for (const [pattern, count] of Object.entries(testingPatterns)) {
      if (count >= allProfiles.length * 0.7) {
        conventions.push({
          name: `testing_convention_${pattern}`,
          confidence: count / allProfiles.length,
          description: `A equipe frequentemente usa o padrão de teste: ${pattern}`
        });
      }
    }
    
    // Convenções de linguagem
    const preferredLanguages = this.aggregatePatterns(allProfiles, 'preferredLanguages');
    const topLanguage = Object.entries(preferredLanguages)
      .sort((a, b) => b[1] - a[1])
      .shift();
    
    if (topLanguage && topLanguage[1] >= allProfiles.length * 0.8) {
      conventions.push({
        name: `language_convention_${topLanguage[0]}`,
        confidence: topLanguage[1] / allProfiles.length,
        description: `A equipe predominantemente usa a linguagem: ${topLanguage[0]}`
      });
    }
    
    return conventions;
  }

  /**
   * Agrega padrões de vários perfis
   */
  private aggregatePatterns(profiles: UserBehaviorProfile[], patternType: keyof UserBehaviorProfile): Record<string, number> {
    const aggregated: Record<string, number> = {};
    
    for (const profile of profiles) {
      const patterns = profile[patternType] as Record<string, number>;
      
      for (const [pattern, count] of Object.entries(patterns)) {
        if (count > 5) { // Ignorar padrões raros
          aggregated[pattern] = (aggregated[pattern] || 0) + 1;
        }
      }
    }
    
    return aggregated;
  }

  /**
   * Gera sugestões contextualizadas com base no perfil do usuário
   * 
   * @param filePath Caminho do arquivo atual
   * @param fileContent Conteúdo do arquivo
   * @returns Lista de sugestões contextualizadas
   */
  public generateContextualizedSuggestions(
    filePath: string,
    fileContent: string
  ): ContextualizedSuggestion[] {
    if (!this.workspacePath) {
      return [];
    }

    const suggestions: ContextualizedSuggestion[] = [];
    const fileExt = path.extname(filePath).substring(1);
    
    // Detectar convenções de equipe
    const teamConventions = this.detectTeamConventions();
    
    // Gerar sugestões com base no tipo de arquivo
    switch (fileExt) {
      case 'ts':
      case 'tsx':
        this.generateTypeScriptSuggestions(filePath, fileContent, suggestions, teamConventions);
        break;
        
      case 'js':
      case 'jsx':
        this.generateJavaScriptSuggestions(filePath, fileContent, suggestions, teamConventions);
        break;
        
      case 'py':
        this.generatePythonSuggestions(filePath, fileContent, suggestions, teamConventions);
        break;
        
      case 'java':
        this.generateJavaSuggestions(filePath, fileContent, suggestions, teamConventions);
        break;
    }
    
    // Gerar sugestões genéricas
    this.generateGenericSuggestions(filePath, fileContent, suggestions, teamConventions);
    
    return suggestions;
  }

  /**
   * Gera sugestões para arquivos TypeScript
   */
  private generateTypeScriptSuggestions(
    filePath: string,
    fileContent: string,
    suggestions: ContextualizedSuggestion[],
    teamConventions: { name: string; confidence: number; description: string }[]
  ): void {
    // Verificar se o arquivo tem interfaces
    if (!fileContent.includes('interface ') && this.userProfile.codingPatterns['typescript_interface'] > 5) {
      suggestions.push({
        id: `ts_interface_${Date.now()}`,
        type: 'code',
        content: 'Considere definir interfaces para os tipos principais neste arquivo.',
        relevanceScore: 0.8,
        confidence: 0.7,
        relatedNodes: [],
        explanation: 'Você frequentemente usa interfaces TypeScript em outros arquivos.'
      });
    }
    
    // Verificar uso de tipos
    if (!fileContent.includes(': ') && !fileContent.includes('as ')) {
      suggestions.push({
        id: `ts_types_${Date.now()}`,
        type: 'code',
        content: 'Adicione anotações de tipo para melhorar a segurança de tipo.',
        relevanceScore: 0.7,
        confidence: 0.6,
        relatedNodes: [],
        explanation: 'Anotações de tipo melhoram a manutenibilidade do código.'
      });
    }
  }

  /**
   * Gera sugestões para arquivos JavaScript
   */
  private generateJavaScriptSuggestions(
    filePath: string,
    fileContent: string,
    suggestions: ContextualizedSuggestion[],
    teamConventions: { name: string; confidence: number; description: string }[]
  ): void {
    // Verificar uso de async/await
    if (
      fileContent.includes('then(') && 
      !fileContent.includes('async ') && 
      this.userProfile.codingPatterns['javascript_async'] > 5
    ) {
      suggestions.push({
        id: `js_async_${Date.now()}`,
        type: 'refactor',
        content: 'Considere refatorar as promessas para usar async/await.',
        relevanceScore: 0.8,
        confidence: 0.7,
        relatedNodes: [],
        explanation: 'Você frequentemente usa async/await em outros arquivos.'
      });
    }
  }

  /**
   * Gera sugestões para arquivos Python
   */
  private generatePythonSuggestions(
    filePath: string,
    fileContent: string,
    suggestions: ContextualizedSuggestion[],
    teamConventions: { name: string; confidence: number; description: string }[]
  ): void {
    // Verificar se é um arquivo de teste
    if (
      filePath.includes('test') && 
      !fileContent.includes('def test_') && 
      this.userProfile.testingPatterns['python_test_function'] > 3
    ) {
      suggestions.push({
        id: `py_test_${Date.now()}`,
        type: 'test',
        content: 'Adicione funções de teste com o prefixo "test_".',
        relevanceScore: 0.9,
        confidence: 0.8,
        relatedNodes: [],
        explanation: 'Você normalmente usa o prefixo "test_" em funções de teste Python.'
      });
    }
  }

  /**
   * Gera sugestões para arquivos Java
   */
  private generateJavaSuggestions(
    filePath: string,
    fileContent: string,
    suggestions: ContextualizedSuggestion[],
    teamConventions: { name: string; confidence: number; description: string }[]
  ): void {
    // Implementação simplificada para Java
  }

  /**
   * Gera sugestões genéricas
   */
  private generateGenericSuggestions(
    filePath: string,
    fileContent: string,
    suggestions: ContextualizedSuggestion[],
    teamConventions: { name: string; confidence: number; description: string }[]
  ): void {
    // Verificar se o arquivo tem testes
    if (
      filePath.includes('src') && 
      !filePath.includes('test') && 
      this.userProfile.testingPatterns['test_code'] > 10
    ) {
      const testFilePath = filePath.replace('src', 'test').replace(/\.\w+$/, '.test$&');
      
      suggestions.push({
        id: `generic_test_${Date.now()}`,
        type: 'test',
        content: `Considere criar testes para este arquivo em ${testFilePath}`,
        relevanceScore: 0.7,
        confidence: 0.6,
        relatedNodes: [],
        explanation: 'Você frequentemente escreve testes para seus arquivos de código.'
      });
    }
    
    // Sugerir com base em convenções de equipe
    for (const convention of teamConventions) {
      if (convention.confidence > 0.8) {
        suggestions.push({
          id: `convention_${convention.name}_${Date.now()}`,
          type: 'code',
          content: `Considere seguir a convenção da equipe: ${convention.description}`,
          relevanceScore: 0.6,
          confidence: convention.confidence,
          relatedNodes: [],
          explanation: convention.description
        });
      }
    }
  }

  /**
   * Libera recursos utilizados pelo motor
   */
  public async dispose(): Promise<void> {
    // Salvar perfis antes de liberar recursos
    await this.saveProfiles();
  }
}
