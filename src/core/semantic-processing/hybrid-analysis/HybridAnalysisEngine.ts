import * as vscode from "vscode"
import * as path from "path"
import { DependencyNode, DependencyEdge, SemanticContext } from "../types"
import { parseSourceCodeDefinitionsForFile } from "../../../services/tree-sitter"
import { fileExistsAtPath } from "../../../utils/fs"
import fs from "fs/promises"

/**
 * Motor de Análise Híbrida
 *
 * Combina técnicas de parsing estático com inferência dinâmica para analisar
 * código-fonte e extrair informações semânticas.
 */
export class HybridAnalysisEngine {
  private context: vscode.ExtensionContext;
  private workspacePath: string | undefined;
  private languageMap: Map<string, string> = new Map();
  private nodeCache: Map<string, DependencyNode> = new Map();
  private edgeCache: Map<string, DependencyEdge> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    this.initializeLanguageMap();
  }

  /**
   * Inicializa o mapeamento de extensões de arquivo para linguagens
   */
  private initializeLanguageMap(): void {
    this.languageMap.set(".ts", "typescript");
    this.languageMap.set(".tsx", "typescript");
    this.languageMap.set(".js", "javascript");
    this.languageMap.set(".jsx", "javascript");
    this.languageMap.set(".py", "python");
    this.languageMap.set(".java", "java");
    this.languageMap.set(".go", "go");
    this.languageMap.set(".rb", "ruby");
    this.languageMap.set(".php", "php");
    this.languageMap.set(".cs", "csharp");
    this.languageMap.set(".cpp", "cpp");
    this.languageMap.set(".c", "c");
    this.languageMap.set(".rs", "rust");
    this.languageMap.set(".swift", "swift");
    this.languageMap.set(".kt", "kotlin");
    this.languageMap.set(".scala", "scala");
    this.languageMap.set(".html", "html");
    this.languageMap.set(".css", "css");
    this.languageMap.set(".scss", "scss");
    this.languageMap.set(".less", "less");
    this.languageMap.set(".json", "json");
    this.languageMap.set(".md", "markdown");
  }

  /**
   * Analisa um arquivo e extrai nós e arestas de dependência
   *
   * @param filePath Caminho do arquivo a ser analisado
   * @returns Objeto contendo nós e arestas extraídos
   */
  public async analyzeFile(filePath: string): Promise<{ nodes: DependencyNode[], edges: DependencyEdge[] }> {
    try {
      if (!this.workspacePath) {
        console.warn("Workspace path is not available, using fallback");
        // Criar um nó básico para o arquivo
        const fileNode = this.createBasicFileNode(filePath);
        return { nodes: [fileNode], edges: [] };
      }

      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(this.workspacePath, filePath);

      if (!await fileExistsAtPath(absolutePath)) {
        console.warn(`File does not exist: ${absolutePath}, using fallback`);
        // Criar um nó básico para o arquivo
        const fileNode = this.createBasicFileNode(filePath);
        return { nodes: [fileNode], edges: [] };
      }

      const fileExt = path.extname(absolutePath);
      const language = this.languageMap.get(fileExt) || "unknown";

      try {
        // Usar Tree-sitter para análise estática
        const definitions = await parseSourceCodeDefinitionsForFile(absolutePath);

        // Extrair conteúdo do arquivo
        const fileContent = await fs.readFile(absolutePath, "utf8");

        // Analisar o arquivo com base na linguagem
        const result = await this.analyzeByLanguage(absolutePath, fileContent, language, definitions);

        // Armazenar nós e arestas no cache
        result.nodes.forEach(node => this.nodeCache.set(node.id, node));
        result.edges.forEach(edge => this.edgeCache.set(`${edge.source}-${edge.target}-${edge.type}`, edge));

        return result;
      } catch (innerError) {
        console.warn(`Error analyzing file ${absolutePath}: ${innerError}`);
        // Criar um nó básico para o arquivo
        const fileNode = this.createBasicFileNode(filePath);
        return { nodes: [fileNode], edges: [] };
      }
    } catch (error) {
      console.error(`Critical error analyzing file ${filePath}: ${error}`);
      // Criar um nó básico para o arquivo
      const fileNode = this.createBasicFileNode(filePath);
      return { nodes: [fileNode], edges: [] };
    }
  }

  /**
   * Cria um nó básico para um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Nó básico para o arquivo
   */
  private createBasicFileNode(filePath: string): DependencyNode {
    const fileName = path.basename(filePath);
    const fileExt = path.extname(filePath);
    const language = this.languageMap.get(fileExt) || "unknown";

    return {
      id: `file:${filePath}`,
      type: 'file',
      name: fileName,
      path: filePath,
      language,
      metadata: {
        createdAt: Date.now(),
        isBasicNode: true
      }
    };
  }

  /**
   * Analisa um arquivo com base na linguagem
   *
   * @param filePath Caminho do arquivo
   * @param content Conteúdo do arquivo
   * @param language Linguagem do arquivo
   * @param definitions Definições extraídas pelo Tree-sitter
   * @returns Objeto contendo nós e arestas extraídos
   */
  private async analyzeByLanguage(
    filePath: string,
    content: string,
    language: string,
    definitions?: string
  ): Promise<{ nodes: DependencyNode[], edges: DependencyEdge[] }> {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    // Criar nó para o arquivo
    const fileNode: DependencyNode = {
      id: `file:${filePath}`,
      type: 'file',
      name: path.basename(filePath),
      path: filePath,
      language,
      metadata: {
        size: content.length,
        lineCount: content.split('\n').length
      }
    };

    nodes.push(fileNode);

    // Analisar com base na linguagem
    switch (language) {
      case 'typescript':
      case 'javascript':
        return this.analyzeJavaScriptFamily(filePath, content, fileNode, definitions, nodes, edges);
      case 'python':
        return this.analyzePython(filePath, content, fileNode, definitions, nodes, edges);
      default:
        // Análise genérica para outras linguagens
        return this.analyzeGeneric(filePath, content, fileNode, definitions, nodes, edges);
    }
  }

  /**
   * Analisa arquivos da família JavaScript (JS, TS, JSX, TSX)
   */
  private async analyzeJavaScriptFamily(
    filePath: string,
    content: string,
    fileNode: DependencyNode,
    definitions: string | undefined,
    nodes: DependencyNode[],
    edges: DependencyEdge[]
  ): Promise<{ nodes: DependencyNode[], edges: DependencyEdge[] }> {
    // Extrair importações
    const importRegex = /import\s+(?:{([^}]+)}|\*\s+as\s+([a-zA-Z0-9_$]+)|([a-zA-Z0-9_$]+))\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const importedItems = match[1] ? match[1].split(',').map(s => s.trim()) : [];
      const namespaceImport = match[2];
      const defaultImport = match[3];
      const sourcePath = match[4];

      // Criar nó para o módulo importado
      const moduleNode: DependencyNode = {
        id: `module:${sourcePath}`,
        type: 'module',
        name: sourcePath,
        metadata: {
          isExternal: !sourcePath.startsWith('.')
        }
      };

      nodes.push(moduleNode);

      // Criar aresta de importação
      edges.push({
        source: fileNode.id,
        target: moduleNode.id,
        type: 'imports'
      });

      // Processar itens importados
      if (defaultImport) {
        const importNode: DependencyNode = {
          id: `import:${filePath}:${defaultImport}`,
          type: 'import',
          name: defaultImport,
          path: filePath,
          metadata: {
            isDefault: true,
            source: sourcePath
          }
        };

        nodes.push(importNode);

        edges.push({
          source: fileNode.id,
          target: importNode.id,
          type: 'imports'
        });
      }

      if (namespaceImport) {
        const importNode: DependencyNode = {
          id: `import:${filePath}:${namespaceImport}`,
          type: 'import',
          name: namespaceImport,
          path: filePath,
          metadata: {
            isNamespace: true,
            source: sourcePath
          }
        };

        nodes.push(importNode);

        edges.push({
          source: fileNode.id,
          target: importNode.id,
          type: 'imports'
        });
      }

      for (const item of importedItems) {
        const [originalName, alias] = item.split(' as ').map(s => s.trim());
        const name = alias || originalName;

        if (name) {
          const importNode: DependencyNode = {
            id: `import:${filePath}:${name}`,
            type: 'import',
            name,
            path: filePath,
            metadata: {
              originalName: originalName !== name ? originalName : undefined,
              source: sourcePath
            }
          };

          nodes.push(importNode);

          edges.push({
            source: fileNode.id,
            target: importNode.id,
            type: 'imports'
          });
        }
      }
    }

    // Extrair exportações
    const exportRegex = /export\s+(?:default\s+)?(?:(class|function|const|let|var)\s+([a-zA-Z0-9_$]+)|{([^}]+)})/g;

    while ((match = exportRegex.exec(content)) !== null) {
      const exportType = match[1];
      const exportName = match[2];
      const exportedItems = match[3] ? match[3].split(',').map(s => s.trim()) : [];

      if (exportName) {
        const exportNode: DependencyNode = {
          id: `export:${filePath}:${exportName}`,
          type: 'export',
          name: exportName,
          path: filePath,
          metadata: {
            exportType,
            isDefault: content.substring(match.index, match.index + 20).includes('default')
          }
        };

        nodes.push(exportNode);

        edges.push({
          source: fileNode.id,
          target: exportNode.id,
          type: 'exports'
        });
      }

      for (const item of exportedItems) {
        const [originalName, alias] = item.split(' as ').map(s => s.trim());
        const name = alias || originalName;

        if (name) {
          const exportNode: DependencyNode = {
            id: `export:${filePath}:${name}`,
            type: 'export',
            name,
            path: filePath,
            metadata: {
              originalName: originalName !== name ? originalName : undefined
            }
          };

          nodes.push(exportNode);

          edges.push({
            source: fileNode.id,
            target: exportNode.id,
            type: 'exports'
          });
        }
      }
    }

    // Extrair classes, funções e componentes React
    // Isso é uma análise simplificada, uma análise completa exigiria um parser completo

    // Classes
    const classRegex = /class\s+([a-zA-Z0-9_$]+)(?:\s+extends\s+([a-zA-Z0-9_$]+))?/g;

    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const extendsClass = match[2];

      const classNode: DependencyNode = {
        id: `class:${filePath}:${className}`,
        type: 'class',
        name: className,
        path: filePath,
        metadata: {
          extendsClass
        }
      };

      nodes.push(classNode);

      edges.push({
        source: fileNode.id,
        target: classNode.id,
        type: 'defines'
      });

      if (extendsClass) {
        // Tentar encontrar a classe estendida no cache
        const extendsNodeId = `class:${filePath}:${extendsClass}`;
        const importNodeId = `import:${filePath}:${extendsClass}`;

        if (this.nodeCache.has(extendsNodeId)) {
          edges.push({
            source: classNode.id,
            target: extendsNodeId,
            type: 'extends'
          });
        } else if (this.nodeCache.has(importNodeId)) {
          edges.push({
            source: classNode.id,
            target: importNodeId,
            type: 'extends'
          });
        }
      }
    }

    // Funções
    const functionRegex = /(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)\s*(?:=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|\([^)]*\)\s*{)/g;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];

      const functionNode: DependencyNode = {
        id: `function:${filePath}:${functionName}`,
        type: 'function',
        name: functionName,
        path: filePath
      };

      nodes.push(functionNode);

      edges.push({
        source: fileNode.id,
        target: functionNode.id,
        type: 'defines'
      });
    }

    // Componentes React (heurística simples)
    const reactComponentRegex = /(?:function|const)\s+([A-Z][a-zA-Z0-9_$]*)\s*(?:=\s*(?:\([^)]*\)|[a-zA-Z0-9_$]+)\s*=>|\([^)]*\)\s*{)/g;

    while ((match = reactComponentRegex.exec(content)) !== null) {
      const componentName = match[1];

      const componentNode: DependencyNode = {
        id: `component:${filePath}:${componentName}`,
        type: 'component',
        name: componentName,
        path: filePath,
        metadata: {
          isReactComponent: true
        }
      };

      nodes.push(componentNode);

      edges.push({
        source: fileNode.id,
        target: componentNode.id,
        type: 'defines'
      });
    }

    return { nodes, edges };
  }

  /**
   * Analisa arquivos Python
   */
  private async analyzePython(
    filePath: string,
    content: string,
    fileNode: DependencyNode,
    definitions: string | undefined,
    nodes: DependencyNode[],
    edges: DependencyEdge[]
  ): Promise<{ nodes: DependencyNode[], edges: DependencyEdge[] }> {
    // Extrair importações
    const importRegex = /(?:from\s+([a-zA-Z0-9_.]+)\s+import\s+([^#\n]+)|import\s+([^#\n]+))/g;
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      const fromModule = match[1];
      const importedItems = match[2] ? match[2].split(',').map(s => s.trim()) : [];
      const importedModules = match[3] ? match[3].split(',').map(s => s.trim()) : [];

      if (fromModule) {
        const moduleNode: DependencyNode = {
          id: `module:${fromModule}`,
          type: 'module',
          name: fromModule,
          metadata: {
            isExternal: !fromModule.startsWith('.')
          }
        };

        nodes.push(moduleNode);

        edges.push({
          source: fileNode.id,
          target: moduleNode.id,
          type: 'imports'
        });

        for (const item of importedItems) {
          const [originalName, alias] = item.split(' as ').map(s => s.trim());
          const name = alias || originalName;

          if (name) {
            const importNode: DependencyNode = {
              id: `import:${filePath}:${name}`,
              type: 'import',
              name,
              path: filePath,
              metadata: {
                originalName: originalName !== name ? originalName : undefined,
                source: fromModule
              }
            };

            nodes.push(importNode);

            edges.push({
              source: fileNode.id,
              target: importNode.id,
              type: 'imports'
            });
          }
        }
      }

      for (const module of importedModules) {
        const [originalName, alias] = module.split(' as ').map(s => s.trim());
        const name = alias || originalName;

        if (name) {
          const moduleNode: DependencyNode = {
            id: `module:${originalName}`,
            type: 'module',
            name: originalName,
            metadata: {
              alias: alias,
              isExternal: !originalName.startsWith('.')
            }
          };

          nodes.push(moduleNode);

          edges.push({
            source: fileNode.id,
            target: moduleNode.id,
            type: 'imports'
          });
        }
      }
    }

    // Extrair classes
    const classRegex = /class\s+([a-zA-Z0-9_]+)(?:\([^)]*\))?:/g;

    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];

      const classNode: DependencyNode = {
        id: `class:${filePath}:${className}`,
        type: 'class',
        name: className,
        path: filePath
      };

      nodes.push(classNode);

      edges.push({
        source: fileNode.id,
        target: classNode.id,
        type: 'defines'
      });
    }

    // Extrair funções
    const functionRegex = /def\s+([a-zA-Z0-9_]+)\s*\(/g;

    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];

      const functionNode: DependencyNode = {
        id: `function:${filePath}:${functionName}`,
        type: 'function',
        name: functionName,
        path: filePath
      };

      nodes.push(functionNode);

      edges.push({
        source: fileNode.id,
        target: functionNode.id,
        type: 'defines'
      });
    }

    return { nodes, edges };
  }

  /**
   * Análise genérica para outras linguagens
   */
  private async analyzeGeneric(
    filePath: string,
    content: string,
    fileNode: DependencyNode,
    definitions: string | undefined,
    nodes: DependencyNode[],
    edges: DependencyEdge[]
  ): Promise<{ nodes: DependencyNode[], edges: DependencyEdge[] }> {
    // Usar as definições do Tree-sitter se disponíveis
    if (definitions) {
      const lines = definitions.split('\n');

      for (const line of lines) {
        // Formato esperado: "linha--linha | conteúdo"
        const match = line.match(/(\d+)--(\d+) \| (.+)/);

        if (match) {
          const startLine = parseInt(match[1]);
          const endLine = parseInt(match[2]);
          const content = match[3];

          // Tentar identificar o tipo de definição
          let type: 'function' | 'class' | 'variable' = 'variable';
          let name = content.trim();

          if (content.includes('class ')) {
            type = 'class';
            const classMatch = content.match(/class\s+([a-zA-Z0-9_$]+)/);
            if (classMatch) name = classMatch[1];
          } else if (content.includes('function ') || content.includes('def ')) {
            type = 'function';
            const funcMatch = content.match(/(?:function|def)\s+([a-zA-Z0-9_$]+)/);
            if (funcMatch) name = funcMatch[1];
          }

          const node: DependencyNode = {
            id: `${type}:${filePath}:${name}`,
            type: type,
            name: name,
            path: filePath,
            metadata: {
              startLine,
              endLine
            }
          };

          nodes.push(node);

          edges.push({
            source: fileNode.id,
            target: node.id,
            type: 'defines'
          });
        }
      }
    }

    return { nodes, edges };
  }

  /**
   * Obtém o contexto semântico para um arquivo
   *
   * @param filePath Caminho do arquivo
   * @returns Contexto semântico
   */
  public async getSemanticContext(filePath: string): Promise<SemanticContext> {
    const { nodes, edges } = await this.analyzeFile(filePath);

    // Implementação simplificada - em uma implementação completa,
    // buscaríamos também arquivos relacionados, padrões de modificação, etc.

    return {
      relevantNodes: nodes,
      relevantEdges: edges,
      modificationPatterns: [],
      recentModifications: []
    };
  }

  /**
   * Detecta construções idiomáticas e violações de padrões
   *
   * @param filePath Caminho do arquivo
   * @returns Lista de construções e violações detectadas
   */
  public async detectPatterns(filePath: string): Promise<{
    idiomaticConstructs: string[],
    patternViolations: string[]
  }> {
    // Implementação simplificada - em uma implementação completa,
    // analisaríamos o código em busca de padrões específicos da linguagem

    return {
      idiomaticConstructs: [],
      patternViolations: []
    };
  }
}
