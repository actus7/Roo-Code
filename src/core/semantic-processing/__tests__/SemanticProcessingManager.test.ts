import * as vscode from "vscode"
import { SemanticProcessingManager } from "../SemanticProcessingManager"
import { HybridAnalysisEngine } from "../hybrid-analysis/HybridAnalysisEngine"
import { TemporalCorrelationEngine } from "../temporal-correlation/TemporalCorrelationEngine"
import { DependencyGraphManager } from "../dependency-graph/DependencyGraphManager"
import { AdaptiveContextWeightingEngine } from "../context-weighting/AdaptiveContextWeightingEngine"
import { SemanticNormalizationService } from "../semantic-normalization/SemanticNormalizationService"
import { BehaviorModelingEngine } from "../behavior-modeling/BehaviorModelingEngine"
import { EcosystemConnectivityManager } from "../ecosystem-connectivity/EcosystemConnectivityManager"
import { ContinuousValidationEngine } from "../validation/ContinuousValidationEngine"

// Mock das dependências
jest.mock("../hybrid-analysis/HybridAnalysisEngine")
jest.mock("../temporal-correlation/TemporalCorrelationEngine")
jest.mock("../dependency-graph/DependencyGraphManager")
jest.mock("../context-weighting/AdaptiveContextWeightingEngine")
jest.mock("../semantic-normalization/SemanticNormalizationService")
jest.mock("../behavior-modeling/BehaviorModelingEngine")
jest.mock("../ecosystem-connectivity/EcosystemConnectivityManager")
jest.mock("../validation/ContinuousValidationEngine")

describe("SemanticProcessingManager", () => {
  let context: vscode.ExtensionContext
  let manager: SemanticProcessingManager

  beforeEach(() => {
    // Mock do contexto da extensão
    context = {
      subscriptions: [],
      workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
      },
      globalState: {
        get: jest.fn(),
        update: jest.fn(),
        setKeysForSync: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
      },
      extensionUri: {} as vscode.Uri,
      extensionPath: "",
      asAbsolutePath: jest.fn().mockImplementation((relativePath) => relativePath),
      storagePath: "",
      globalStoragePath: "",
      logPath: "",
      extensionMode: vscode.ExtensionMode.Development,
      globalStorageUri: {} as vscode.Uri,
      logUri: {} as vscode.Uri,
      storageUri: {} as vscode.Uri,
      environmentVariableCollection: {} as any,
      secrets: {} as vscode.SecretStorage,
      extension: {} as any,
      languageModelAccessInformation: {} as any,
    }

    // Inicializar o gerenciador
    manager = new SemanticProcessingManager(context)
  })

  test("deve inicializar todos os componentes", async () => {
    // Verificar se todos os componentes foram inicializados
    expect(HybridAnalysisEngine).toHaveBeenCalledWith(context)
    expect(TemporalCorrelationEngine).toHaveBeenCalledWith(context)
    expect(DependencyGraphManager).toHaveBeenCalled()
    expect(AdaptiveContextWeightingEngine).toHaveBeenCalled()
    expect(SemanticNormalizationService).toHaveBeenCalledWith(context)
    expect(BehaviorModelingEngine).toHaveBeenCalledWith(context)
    expect(EcosystemConnectivityManager).toHaveBeenCalled()
    expect(ContinuousValidationEngine).toHaveBeenCalledWith(context)
  })

  test("deve analisar um arquivo", async () => {
    // Mock do método analyzeFile do AdaptiveContextWeightingEngine
    const mockGetWeightedContext = jest.fn().mockResolvedValue({
      relevantNodes: [],
      relevantEdges: [],
      modificationPatterns: [],
      recentModifications: []
    })

    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["adaptiveContextWeightingEngine"].getWeightedContext = mockGetWeightedContext

    // Mock do método analyzeFile do HybridAnalysisEngine
    const mockAnalyzeFile = jest.fn().mockResolvedValue({
      nodes: [],
      edges: []
    })

    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["hybridAnalysisEngine"].analyzeFile = mockAnalyzeFile

    // Chamar o método
    await manager.analyzeFile("test.ts")

    // Verificar se o método foi chamado
    expect(mockAnalyzeFile).toHaveBeenCalledWith("test.ts")
    expect(mockGetWeightedContext).toHaveBeenCalledWith("test.ts")
  })

  test("deve gerar sugestões contextualizadas", async () => {
    // Mock do método analyzeFile
    manager.analyzeFile = jest.fn().mockResolvedValue({
      relevantNodes: [],
      relevantEdges: [],
      modificationPatterns: [],
      recentModifications: []
    })

    // Mock do método generateContextualizedSuggestions do BehaviorModelingEngine
    const mockGenerateSuggestions = jest.fn().mockReturnValue([
      {
        id: "suggestion1",
        type: "code",
        content: "Sugestão 1",
        relevanceScore: 0.8,
        confidence: 0.7,
        relatedNodes: []
      }
    ])

    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["behaviorModelingEngine"].generateContextualizedSuggestions = mockGenerateSuggestions

    // Chamar o método
    const suggestions = await manager.generateContextualizedSuggestions("test.ts", "conteúdo")

    // Verificar se os métodos foram chamados
    expect(manager.analyzeFile).toHaveBeenCalledWith("test.ts")
    expect(mockGenerateSuggestions).toHaveBeenCalledWith("test.ts", "conteúdo")

    // Verificar o resultado
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0].id).toBe("suggestion1")
  })

  test("deve registrar feedback de sugestão", () => {
    // Mock dos métodos
    const mockRecordSuggestionFeedback1 = jest.fn()
    const mockRecordSuggestionFeedback2 = jest.fn()

    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["behaviorModelingEngine"].recordSuggestionFeedback = mockRecordSuggestionFeedback1
    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["continuousValidationEngine"].recordSuggestionFeedback = mockRecordSuggestionFeedback2

    // Chamar o método
    manager.recordSuggestionFeedback("suggestion1", true, "code")

    // Verificar se os métodos foram chamados
    expect(mockRecordSuggestionFeedback1).toHaveBeenCalledWith("suggestion1", true)
    expect(mockRecordSuggestionFeedback2).toHaveBeenCalledWith(true, "code")
  })

  test("deve liberar recursos ao ser descartado", async () => {
    // Mock dos métodos dispose
    const mockDispose1 = jest.fn().mockResolvedValue(undefined)
    const mockDispose2 = jest.fn().mockResolvedValue(undefined)
    const mockDispose3 = jest.fn().mockResolvedValue(undefined)
    const mockDispose4 = jest.fn().mockResolvedValue(undefined)
    const mockDispose5 = jest.fn().mockResolvedValue(undefined)

    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["adaptiveContextWeightingEngine"].dispose = mockDispose1
    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["dependencyGraphManager"].dispose = mockDispose2
    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["behaviorModelingEngine"].dispose = mockDispose3
    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["ecosystemConnectivityManager"].dispose = mockDispose4
    // @ts-ignore - Ignorar verificação de tipo para o mock
    manager["continuousValidationEngine"].dispose = mockDispose5

    // Chamar o método
    await manager.dispose()

    // Verificar se os métodos foram chamados
    expect(mockDispose1).toHaveBeenCalled()
    expect(mockDispose2).toHaveBeenCalled()
    expect(mockDispose3).toHaveBeenCalled()
    expect(mockDispose4).toHaveBeenCalled()
    expect(mockDispose5).toHaveBeenCalled()
  })
})
