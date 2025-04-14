import * as vscode from "vscode"
import * as path from "path"
import { NormalizedData } from "../types"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"
import axios from "axios"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"

/**
 * Serviço de Normalização Semântica
 * 
 * Converte dados heterogêneos de ferramentas externas em representações unificadas,
 * permitindo que o sistema opere com uma visão completa do ecossistema de desenvolvimento.
 */
export class SemanticNormalizationService {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private normalizedDataCache: Map<string, NormalizedData> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  }

  /**
   * Normaliza dados de código-fonte
   * 
   * @param filePath Caminho do arquivo
   * @returns Dados normalizados
   */
  public async normalizeSourceCode(filePath: string): Promise<NormalizedData> {
    if (!this.workspacePath) {
      throw new Error("Workspace path is not available");
    }

    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.join(this.workspacePath, filePath);

    if (!await fileExistsAtPath(absolutePath)) {
      throw new Error(`File does not exist: ${absolutePath}`);
    }

    // Verificar cache
    const cacheKey = `source:${absolutePath}`;
    if (this.normalizedDataCache.has(cacheKey)) {
      return this.normalizedDataCache.get(cacheKey)!;
    }

    // Ler conteúdo do arquivo
    const content = await fs.readFile(absolutePath, "utf8");
    
    // Obter definições usando Tree-sitter
    const definitions = await parseSourceCodeDefinitionsForFile(absolutePath);
    
    // Determinar tipo de arquivo
    const fileExt = path.extname(absolutePath).toLowerCase();
    
    // Normalizar com base no tipo de arquivo
    let normalizedContent;
    
    switch (fileExt) {
      case ".ts":
      case ".tsx":
      case ".js":
      case ".jsx":
        normalizedContent = this.normalizeJavaScriptFamily(content, definitions);
        break;
      case ".py":
        normalizedContent = this.normalizePython(content, definitions);
        break;
      case ".java":
        normalizedContent = this.normalizeJava(content, definitions);
        break;
      case ".json":
        normalizedContent = this.normalizeJson(content);
        break;
      case ".md":
      case ".markdown":
        normalizedContent = this.normalizeMarkdown(content);
        break;
      default:
        normalizedContent = this.normalizeGeneric(content, definitions);
    }
    
    // Criar objeto de dados normalizados
    const normalizedData: NormalizedData = {
      sourceType: "source-code",
      originalFormat: fileExt.substring(1), // Remover o ponto
      normalizedContent
    };
    
    // Armazenar no cache
    this.normalizedDataCache.set(cacheKey, normalizedData);
    
    return normalizedData;
  }

  /**
   * Normaliza dados da família JavaScript
   */
  private normalizeJavaScriptFamily(content: string, definitions?: string): any {
    // Extrair importações
    const imports = this.extractJavaScriptImports(content);
    
    // Extrair exportações
    const exports = this.extractJavaScriptExports(content);
    
    // Extrair classes
    const classes = this.extractJavaScriptClasses(content);
    
    // Extrair funções
    const functions = this.extractJavaScriptFunctions(content);
    
    // Extrair componentes React
    const reactComponents = this.extractReactComponents(content);
    
    return {
      imports,
      exports,
      classes,
      functions,
      reactComponents,
      definitions: definitions ? this.parseDefinitions(definitions) : []
    };
  }

  /**
   * Extrai importações de código JavaScript/TypeScript
   */
  private extractJavaScriptImports(content: string): any[] {
    const imports = [];
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const namedImports = match[1] ? match[1].split(',').map(s => s.trim()) : [];
      const namespaceImport = match[2];
      const defaultImport = match[3];
      const source = match[4];
      
      imports.push({
        source,
        defaultImport,
        namespaceImport,
        namedImports
      });
    }
    
    return imports;
  }

  /**
   * Extrai exportações de código JavaScript/TypeScript
   */
  private extractJavaScriptExports(content: string): any[] {
    const exports = [];
    const exportRegex = /export\s+(?:default\s+)?(?:(class|function|const|let|var)\s+([a-zA-Z0-9_$]+)|{([^}]+)})/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      const exportType = match[1];
      const exportName = match[2];
      const namedExports = match[3] ? match[3].split(',').map(s => s.trim()) : [];
      const isDefault = content.substring(match.index, match.index + 20).includes('default');
      
      if (exportName) {
        exports.push({
          name: exportName,
          type: exportType,
          isDefault
        });
      }
      
      for (const namedExport of namedExports) {
        const [originalName, alias] = namedExport.split(' as ').map(s => s.trim());
        
        exports.push({
          name: originalName,
          alias,
          isDefault: false
        });
      }
    }
    
    return exports;
  }

  /**
   * Extrai classes de código JavaScript/TypeScript
   */
  private extractJavaScriptClasses(content: string): any[] {
    const classes = [];
    const classRegex = /class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/g;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];
      
      classes.push({
        name: className,
        extends: extendsClass
      });
    }
    
    return classes;
  }

  /**
   * Extrai funções de código JavaScript/TypeScript
   */
  private extractJavaScriptFunctions(content: string): any[] {
    const functions = [];
    const functionRegex = /(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)\s*(?:=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|\([^)]*\)\s*{)/g;
    let match;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      
      functions.push({
        name: functionName
      });
    }
    
    return functions;
  }

  /**
   * Extrai componentes React de código JavaScript/TypeScript
   */
  private extractReactComponents(content: string): any[] {
    const components = [];
    const componentRegex = /(?:function|const)\s+([A-Z][a-zA-Z0-9_$]*)\s*(?:=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|\([^)]*\)\s*{)/g;
    let match;
    
    while ((match = componentRegex.exec(content)) !== null) {
      const componentName = match[1];
      
      components.push({
        name: componentName
      });
    }
    
    return components;
  }

  /**
   * Normaliza código Python
   */
  private normalizePython(content: string, definitions?: string): any {
    // Extrair importações
    const imports = [];
    const importRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([^#\n]+)|import\s+([^#\n]+))/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      const fromModule = match[1];
      const importedItems = match[2] ? match[2].split(',').map(s => s.trim()) : [];
      const importedModules = match[3] ? match[3].split(',').map(s => s.trim()) : [];
      
      if (fromModule) {
        imports.push({
          from: fromModule,
          imports: importedItems.map(item => {
            const [name, alias] = item.split(' as ').map(s => s.trim());
            return { name, alias };
          })
        });
      } else {
        imports.push({
          modules: importedModules.map(module => {
            const [name, alias] = module.split(' as ').map(s => s.trim());
            return { name, alias };
          })
        });
      }
    }
    
    // Extrair classes
    const classes = [];
    const classRegex = /class\s+([a-zA-Z0-9_]+)(?:\(([^)]*)\))?:/g;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const inheritance = match[2];
      
      classes.push({
        name: className,
        inheritance: inheritance ? inheritance.split(',').map(s => s.trim()) : []
      });
    }
    
    // Extrair funções
    const functions = [];
    const functionRegex = /def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)(?:\s*->\s*([a-zA-Z0-9_[\]., ]+))?:/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      const params = match[2];
      const returnType = match[3];
      
      functions.push({
        name: functionName,
        params: params ? params.split(',').map(s => s.trim()) : [],
        returnType
      });
    }
    
    return {
      imports,
      classes,
      functions,
      definitions: definitions ? this.parseDefinitions(definitions) : []
    };
  }

  /**
   * Normaliza código Java
   */
  private normalizeJava(content: string, definitions?: string): any {
    // Implementação simplificada para Java
    return {
      definitions: definitions ? this.parseDefinitions(definitions) : []
    };
  }

  /**
   * Normaliza JSON
   */
  private normalizeJson(content: string): any {
    try {
      // Tentar analisar como JSON
      const jsonData = JSON.parse(content);
      
      // Extrair estrutura
      return {
        structure: this.extractJsonStructure(jsonData)
      };
    } catch (error) {
      return {
        error: "Invalid JSON",
        content
      };
    }
  }

  /**
   * Extrai estrutura de um objeto JSON
   */
  private extractJsonStructure(json: any, depth: number = 0): any {
    if (depth > 3) {
      // Limitar profundidade para evitar recursão excessiva
      return typeof json;
    }
    
    if (Array.isArray(json)) {
      if (json.length === 0) {
        return "empty_array";
      }
      
      // Analisar o primeiro item como representativo
      return [this.extractJsonStructure(json[0], depth + 1)];
    }
    
    if (json === null) {
      return "null";
    }
    
    if (typeof json === "object") {
      const structure: Record<string, any> = {};
      
      for (const key in json) {
        structure[key] = this.extractJsonStructure(json[key], depth + 1);
      }
      
      return structure;
    }
    
    return typeof json;
  }

  /**
   * Normaliza Markdown
   */
  private normalizeMarkdown(content: string): any {
    // Extrair cabeçalhos
    const headers = [];
    const headerRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;
    
    while ((match = headerRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      
      headers.push({
        level,
        text
      });
    }
    
    // Extrair links
    const links = [];
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    
    while ((match = linkRegex.exec(content)) !== null) {
      const text = match[1];
      const url = match[2];
      
      links.push({
        text,
        url
      });
    }
    
    // Extrair blocos de código
    const codeBlocks = [];
    const codeBlockRegex = /```([a-zA-Z]*)\n([\s\S]*?)```/g;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      const language = match[1];
      const code = match[2];
      
      codeBlocks.push({
        language,
        code
      });
    }
    
    return {
      headers,
      links,
      codeBlocks
    };
  }

  /**
   * Normaliza código genérico
   */
  private normalizeGeneric(content: string, definitions?: string): any {
    return {
      content,
      definitions: definitions ? this.parseDefinitions(definitions) : []
    };
  }

  /**
   * Analisa definições do Tree-sitter
   */
  private parseDefinitions(definitions: string): any[] {
    const result = [];
    const lines = definitions.split('\n');
    
    for (const line of lines) {
      // Formato esperado: "linha--linha | conteúdo"
      const match = line.match(/(\d+)--(\d+) \| (.+)/);
      
      if (match) {
        const startLine = parseInt(match[1]);
        const endLine = parseInt(match[2]);
        const content = match[3];
        
        result.push({
          startLine,
          endLine,
          content
        });
      }
    }
    
    return result;
  }

  /**
   * Normaliza dados de CI/CD
   * 
   * @param cicdData Dados de CI/CD
   * @returns Dados normalizados
   */
  public normalizeCI_CDData(cicdData: any): NormalizedData {
    // Verificar cache
    const cacheKey = `cicd:${JSON.stringify(cicdData).substring(0, 100)}`;
    if (this.normalizedDataCache.has(cacheKey)) {
      return this.normalizedDataCache.get(cacheKey)!;
    }

    // Determinar o tipo de CI/CD
    let cicdType = "unknown";
    let normalizedContent: any = {};
    
    if (cicdData.jobs || cicdData.stages) {
      if (cicdData.jobs && cicdData.on) {
        cicdType = "github-actions";
        normalizedContent = this.normalizeGitHubActions(cicdData);
      } else if (cicdData.stages) {
        cicdType = "gitlab-ci";
        normalizedContent = this.normalizeGitLabCI(cicdData);
      } else {
        cicdType = "jenkins";
        normalizedContent = this.normalizeJenkins(cicdData);
      }
    }
    
    // Criar objeto de dados normalizados
    const normalizedData: NormalizedData = {
      sourceType: "ci-cd",
      originalFormat: cicdType,
      normalizedContent
    };
    
    // Armazenar no cache
    this.normalizedDataCache.set(cacheKey, normalizedData);
    
    return normalizedData;
  }

  /**
   * Normaliza dados do GitHub Actions
   */
  private normalizeGitHubActions(data: any): any {
    const triggers = data.on ? (Array.isArray(data.on) ? data.on : [data.on]) : [];
    const jobs = [];
    
    for (const jobName in data.jobs || {}) {
      const job = data.jobs[jobName];
      const steps = (job.steps || []).map((step: any) => ({
        name: step.name,
        uses: step.uses,
        run: step.run
      }));
      
      jobs.push({
        name: jobName,
        runsOn: job.runs_on || job["runs-on"],
        steps
      });
    }
    
    return {
      triggers,
      jobs
    };
  }

  /**
   * Normaliza dados do GitLab CI
   */
  private normalizeGitLabCI(data: any): any {
    const stages = data.stages || [];
    const jobs = [];
    
    for (const jobName in data) {
      if (jobName === "stages" || jobName.startsWith(".")) {
        continue;
      }
      
      const job = data[jobName];
      
      if (typeof job === "object") {
        jobs.push({
          name: jobName,
          stage: job.stage,
          script: job.script,
          image: job.image
        });
      }
    }
    
    return {
      stages,
      jobs
    };
  }

  /**
   * Normaliza dados do Jenkins
   */
  private normalizeJenkins(data: any): any {
    // Implementação simplificada para Jenkins
    return data;
  }

  /**
   * Normaliza dados de monitoramento de performance
   * 
   * @param performanceData Dados de performance
   * @returns Dados normalizados
   */
  public normalizePerformanceData(performanceData: any): NormalizedData {
    // Verificar cache
    const cacheKey = `performance:${JSON.stringify(performanceData).substring(0, 100)}`;
    if (this.normalizedDataCache.has(cacheKey)) {
      return this.normalizedDataCache.get(cacheKey)!;
    }

    // Determinar o tipo de dados de performance
    let performanceType = "unknown";
    let normalizedContent: any = {};
    
    if (performanceData.metrics) {
      performanceType = "metrics";
      normalizedContent = this.normalizeMetricsData(performanceData);
    } else if (performanceData.traces || performanceData.spans) {
      performanceType = "tracing";
      normalizedContent = this.normalizeTracingData(performanceData);
    } else if (performanceData.logs) {
      performanceType = "logs";
      normalizedContent = this.normalizeLogsData(performanceData);
    }
    
    // Criar objeto de dados normalizados
    const normalizedData: NormalizedData = {
      sourceType: "performance",
      originalFormat: performanceType,
      normalizedContent
    };
    
    // Armazenar no cache
    this.normalizedDataCache.set(cacheKey, normalizedData);
    
    return normalizedData;
  }

  /**
   * Normaliza dados de métricas
   */
  private normalizeMetricsData(data: any): any {
    const metrics = [];
    
    for (const metric of data.metrics || []) {
      metrics.push({
        name: metric.name,
        value: metric.value,
        timestamp: metric.timestamp,
        tags: metric.tags || {}
      });
    }
    
    return {
      metrics
    };
  }

  /**
   * Normaliza dados de tracing
   */
  private normalizeTracingData(data: any): any {
    const traces = [];
    
    for (const trace of data.traces || []) {
      const spans = (trace.spans || []).map((span: any) => ({
        name: span.name,
        startTime: span.startTime,
        endTime: span.endTime,
        tags: span.tags || {}
      }));
      
      traces.push({
        id: trace.id,
        name: trace.name,
        spans
      });
    }
    
    return {
      traces
    };
  }

  /**
   * Normaliza dados de logs
   */
  private normalizeLogsData(data: any): any {
    const logs = [];
    
    for (const log of data.logs || []) {
      logs.push({
        timestamp: log.timestamp,
        level: log.level,
        message: log.message,
        context: log.context || {}
      });
    }
    
    return {
      logs
    };
  }

  /**
   * Normaliza dados de API externa
   * 
   * @param url URL da API
   * @returns Dados normalizados
   */
  public async normalizeExternalAPI(url: string): Promise<NormalizedData> {
    // Verificar cache
    const cacheKey = `api:${url}`;
    if (this.normalizedDataCache.has(cacheKey)) {
      return this.normalizedDataCache.get(cacheKey)!;
    }

    try {
      // Fazer requisição à API
      const response = await axios.get(url);
      const data = response.data;
      
      // Normalizar com base no tipo de dados
      let apiType = "unknown";
      let normalizedContent: any = {};
      
      if (Array.isArray(data)) {
        apiType = "collection";
        normalizedContent = this.normalizeCollection(data);
      } else if (typeof data === "object") {
        apiType = "object";
        normalizedContent = this.normalizeObject(data);
      } else {
        apiType = typeof data;
        normalizedContent = data;
      }
      
      // Criar objeto de dados normalizados
      const normalizedData: NormalizedData = {
        sourceType: "api",
        originalFormat: apiType,
        normalizedContent
      };
      
      // Armazenar no cache
      this.normalizedDataCache.set(cacheKey, normalizedData);
      
      return normalizedData;
    } catch (error) {
      // Criar objeto de erro
      const normalizedData: NormalizedData = {
        sourceType: "api",
        originalFormat: "error",
        normalizedContent: {
          error: error instanceof Error ? error.message : String(error)
        }
      };
      
      return normalizedData;
    }
  }

  /**
   * Normaliza uma coleção de dados
   */
  private normalizeCollection(data: any[]): any {
    if (data.length === 0) {
      return { type: "empty_collection" };
    }
    
    // Analisar o primeiro item como representativo
    const sampleItem = data[0];
    const structure = this.extractJsonStructure(sampleItem);
    
    return {
      type: "collection",
      count: data.length,
      structure
    };
  }

  /**
   * Normaliza um objeto
   */
  private normalizeObject(data: any): any {
    return {
      type: "object",
      structure: this.extractJsonStructure(data)
    };
  }

  /**
   * Limpa o cache de dados normalizados
   */
  public clearCache(): void {
    this.normalizedDataCache.clear();
  }
}
