import { Position } from '../types/core';
import { Agent } from '../core/agents/Agent';

/**
 * Core ML behavior model interface for any domain
 */
export interface MLBehaviorModel {
  /**
   * Predict next action based on current agent state
   * @param state Current state of the agent
   * @returns Promise resolving to the predicted action
   */
  predict(state: MLAgentState): Promise<AgentAction>;
  
  /**
   * Load model from specified path or URL
   * @param modelPath Path to the model file
   */
  load(modelPath: string): Promise<void>;
  
  /**
   * Get list of required input features for this model
   * @returns Array of required input field names
   */
  getRequiredInputs(): string[];
  
  /**
   * Get list of possible output actions this model can produce
   * @returns Array of possible action types
   */
  getOutputActions(): string[];
  
  /**
   * Dispose of model and free memory
   */
  dispose(): void;
}

/**
 * Agent state representation for ML models
 */
export interface MLAgentState {
  /** Current position of the agent */
  position: Position;
  
  /** Agent properties as key-value pairs */
  properties: Record<string, number>;
  
  /** Environmental context information */
  environment: EnvironmentContext;
  
  /** Neighboring agents within detection radius */
  neighbors: Agent[];
  
  /** Optional: Previous actions taken by this agent */
  actionHistory?: AgentAction[];
}

/**
 * Agent action that can be executed
 */
export interface AgentAction {
  /** Type of action to perform */
  type: 'MOVE' | 'INTERACT' | 'CHANGE_PROPERTY' | 'CUSTOM';
  
  /** Parameters specific to the action type */
  parameters: Record<string, any>;
  
  /** Optional: Confidence score from ML prediction */
  confidence?: number;
  
  /** Optional: Action priority for execution ordering */
  priority?: number;
}

/**
 * Environmental context for agent decision making
 */
export interface EnvironmentContext {
  /** Environment bounds */
  bounds?: { width: number; height: number };
  
  /** Global environment properties */
  globalProperties?: Record<string, number>;
  
  /** Current simulation step/time */
  currentStep?: number;
  
  /** Agent density in local area */
  localDensity?: number;
  
  /** Distance to environment boundaries */
  boundaryDistances?: { north: number; south: number; east: number; west: number };
}

/**
 * Training dataset structure for generic data collection
 */
export interface TrainingDataset {
  /** State-action pairs for supervised learning */
  stateActionPairs: Array<{
    state: MLAgentState;
    action: AgentAction;
    reward?: number;
    nextState?: MLAgentState;
  }>;
  
  /** Metadata about the dataset */
  metadata: {
    scenarioType: string;
    agentCount: number;
    episodeLength: number;
    collectionTimestamp: number;
  };
}

/**
 * Performance metrics for ML inference
 */
export interface MLPerformanceMetrics {
  /** Average prediction time in milliseconds */
  avgPredictionTime: number;
  
  /** Memory usage in MB */
  memoryUsage: number;
  
  /** Number of predictions made */
  predictionCount: number;
  
  /** Error rate (failed predictions) */
  errorRate: number;
  
  /** Batch processing efficiency */
  batchEfficiency: number;
}

/**
 * Model loading configuration
 */
export interface ModelLoadConfig {
  /** Path to model file */
  modelPath: string;
  
  /** Optional model metadata */
  metadata?: {
    version: string;
    trainingDate: string;
    domain: string;
    performance: Record<string, number>;
  };
  
  /** Loading preferences */
  preferences?: {
    cachingEnabled: boolean;
    validationEnabled: boolean;
    optimizationLevel: 'fast' | 'balanced' | 'memory';
  };
}

/**
 * Inference request for batch processing
 */
export interface InferenceRequest {
  /** Agent requesting prediction */
  agentId: string;
  
  /** Current state */
  state: MLAgentState;
  
  /** Model to use for prediction */
  modelName: string;
  
  /** Request timestamp */
  timestamp: number;
  
  /** Priority level */
  priority: 'high' | 'normal' | 'low';
}