/**
 * Tipos básicos para o sistema de processamento semântico unificado
 */

/**
 * Representa um nó no grafo de dependências
 */
export interface DependencyNode {
  id: string;
  type: 'file' | 'function' | 'class' | 'variable' | 'import' | 'export' | 'component' | 'module';
  name: string;
  path?: string;
  language?: string;
  metadata?: Record<string, any>;
  relevanceScore?: number;
}

/**
 * Representa uma conexão entre dois nós no grafo de dependências
 */
export interface DependencyEdge {
  source: string; // ID do nó de origem
  target: string; // ID do nó de destino
  type: 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'uses' | 'defines' | 'references';
  weight?: number;
  metadata?: Record<string, any>;
}

/**
 * Representa um grafo de dependências completo
 */
export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: DependencyEdge[];
}

/**
 * Representa um evento de modificação de código
 */
export interface CodeModificationEvent {
  timestamp: number;
  path: string;
  type: 'create' | 'update' | 'delete';
  author?: string;
  commitId?: string;
  diff?: string;
  metadata?: Record<string, any>;
}

/**
 * Representa um padrão de modificação identificado
 */
export interface ModificationPattern {
  id: string;
  name: string;
  description: string;
  frequency: number;
  confidence: number;
  relatedFiles: string[];
  relatedFunctions?: string[];
  metadata?: Record<string, any>;
}

/**
 * Representa um contexto semântico
 */
export interface SemanticContext {
  relevantNodes: DependencyNode[];
  relevantEdges: DependencyEdge[];
  modificationPatterns: ModificationPattern[];
  recentModifications: CodeModificationEvent[];
  metadata?: Record<string, any>;
}

/**
 * Representa um perfil de comportamento do usuário
 */
export interface UserBehaviorProfile {
  id: string;
  codingPatterns: Record<string, number>;
  preferredLanguages: Record<string, number>;
  commonEdits: Record<string, number>;
  testingPatterns: Record<string, number>;
  debugPatterns: Record<string, number>;
  metadata?: Record<string, any>;
}

/**
 * Representa uma sugestão contextualizada
 */
export interface ContextualizedSuggestion {
  id: string;
  type: 'code' | 'refactor' | 'test' | 'documentation' | 'architecture';
  content: string;
  relevanceScore: number;
  confidence: number;
  relatedNodes: DependencyNode[];
  explanation?: string;
  metadata?: Record<string, any>;
}

/**
 * Representa uma métrica de validação
 */
export interface ValidationMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  dimension: 'accuracy' | 'speed' | 'quality' | 'usability';
  metadata?: Record<string, any>;
}

/**
 * Representa um resultado de normalização semântica
 */
export interface NormalizedData {
  sourceType: string;
  originalFormat: string;
  normalizedContent: any;
  metadata?: Record<string, any>;
}
