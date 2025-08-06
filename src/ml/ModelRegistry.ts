import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, ModelLoadConfig, MLPerformanceMetrics, MLAgentState, AgentAction } from './interfaces';

/**
 * Central registry for managing ML models in the AgentJS framework
 */
export class ModelRegistry {
  private static instance: ModelRegistry;
  private models = new Map<string, MLBehaviorModel>();
  private modelConfigs = new Map<string, ModelLoadConfig>();
  private loadingPromises = new Map<string, Promise<void>>();
  private performanceMetrics = new Map<string, MLPerformanceMetrics>();

  private constructor() {
    // Initialize TensorFlow.js
    this.initializeTensorFlow();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): ModelRegistry {
    if (!ModelRegistry.instance) {
      ModelRegistry.instance = new ModelRegistry();
    }
    return ModelRegistry.instance;
  }

  /**
   * Initialize TensorFlow.js with optimal backend
   */
  private async initializeTensorFlow(): Promise<void> {
    try {
      // Try to use WebGL backend for better performance
      await tf.setBackend('webgl');
      console.log('TensorFlow.js initialized with WebGL backend');
    } catch (error) {
      console.warn('WebGL backend not available, falling back to CPU:', error);
      await tf.setBackend('cpu');
    }
    
    await tf.ready();
    console.log(`TensorFlow.js ready. Backend: ${tf.getBackend()}`);
  }

  /**
   * Register a model in the registry
   * @param name Unique name for the model
   * @param modelPath Path to the model file
   * @param config Optional configuration
   */
  async registerModel(
    name: string, 
    modelPath: string, 
    config?: Partial<ModelLoadConfig>
  ): Promise<void> {
    // Prevent duplicate loading
    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name)!;
    }

    const fullConfig: ModelLoadConfig = {
      modelPath,
      ...(config?.metadata && { metadata: config.metadata }),
      preferences: {
        cachingEnabled: true,
        validationEnabled: true,
        optimizationLevel: 'balanced',
        ...config?.preferences
      }
    };

    const loadingPromise = this.loadModel(name, fullConfig);
    this.loadingPromises.set(name, loadingPromise);

    try {
      await loadingPromise;
    } finally {
      this.loadingPromises.delete(name);
    }
  }

  /**
   * Load a model from path
   */
  private async loadModel(name: string, config: ModelLoadConfig): Promise<void> {
    try {
      console.log(`Loading model "${name}" from ${config.modelPath}`);
      
      // Load the TensorFlow model
      const tfModel = await tf.loadLayersModel(config.modelPath);
      
      // Validate model if enabled
      if (config.preferences?.validationEnabled) {
        this.validateModel(tfModel, name);
      }

      // Create wrapper for the model
      const mlModel = new TensorFlowModelWrapper(tfModel, name);
      
      // Store model and config
      this.models.set(name, mlModel);
      this.modelConfigs.set(name, config);
      
      // Initialize performance metrics
      this.performanceMetrics.set(name, {
        avgPredictionTime: 0,
        memoryUsage: 0,
        predictionCount: 0,
        errorRate: 0,
        batchEfficiency: 1.0
      });
      
      console.log(`Model "${name}" loaded successfully`);
    } catch (error) {
      console.error(`Failed to load model "${name}":`, error);
      throw error;
    }
  }

  /**
   * Get a registered model
   * @param name Model name
   * @returns Model instance or undefined
   */
  getModel(name: string): MLBehaviorModel | undefined {
    return this.models.get(name);
  }

  /**
   * Check if a model is registered
   * @param name Model name
   * @returns True if model exists
   */
  hasModel(name: string): boolean {
    return this.models.has(name);
  }

  /**
   * List all registered model names
   * @returns Array of model names
   */
  listModelNames(): string[] {
    return Array.from(this.models.keys());
  }

  /**
   * Get model configuration
   * @param name Model name
   * @returns Model configuration or undefined
   */
  getModelConfig(name: string): ModelLoadConfig | undefined {
    return this.modelConfigs.get(name);
  }

  /**
   * Get model performance metrics
   * @param name Model name
   * @returns Performance metrics or undefined
   */
  getModelMetrics(name: string): MLPerformanceMetrics | undefined {
    return this.performanceMetrics.get(name);
  }

  /**
   * Update performance metrics for a model
   */
  updateModelMetrics(name: string, update: Partial<MLPerformanceMetrics>): void {
    const current = this.performanceMetrics.get(name);
    if (current) {
      this.performanceMetrics.set(name, { ...current, ...update });
    }
  }

  /**
   * Remove a model from the registry
   * @param name Model name
   */
  removeModel(name: string): boolean {
    const model = this.models.get(name);
    if (model) {
      model.dispose();
      this.models.delete(name);
      this.modelConfigs.delete(name);
      this.performanceMetrics.delete(name);
      console.log(`Model "${name}" removed from registry`);
      return true;
    }
    return false;
  }

  /**
   * Clear all models
   */
  clearAll(): void {
    for (const [name, model] of this.models) {
      console.log(`Disposing model: ${name}`);
      model.dispose();
    }
    
    this.models.clear();
    this.modelConfigs.clear();
    this.performanceMetrics.clear();
    this.loadingPromises.clear();
  }

  /**
   * Validate a loaded TensorFlow model
   */
  private validateModel(model: tf.LayersModel, name: string): void {
    // Check if model has expected structure
    if (!model.layers || model.layers.length === 0) {
      throw new Error(`Model "${name}" has no layers`);
    }

    // Check input shape
    const inputShape = model.inputSpec;
    if (!inputShape) {
      console.warn(`Model "${name}" has undefined input shape`);
    }

    // Check output shape
    const outputShape = model.outputShape;
    if (!outputShape) {
      console.warn(`Model "${name}" has undefined output shape`);
    }

    console.log(`Model "${name}" validation passed`);
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): { numTensors: number; numBytes: number } {
    return tf.memory();
  }

  /**
   * Clean up unused tensors
   */
  cleanupMemory(): void {
    const beforeCleanup = tf.memory();
    tf.disposeVariables();
    const afterCleanup = tf.memory();
    
    console.log('Memory cleanup completed:', {
      before: beforeCleanup,
      after: afterCleanup,
      freed: beforeCleanup.numBytes - afterCleanup.numBytes
    });
  }

  /**
   * Get TensorFlow.js backend information
   */
  getBackendInfo(): { backend: string; ready: boolean } {
    return {
      backend: tf.getBackend(),
      ready: true // TensorFlow.js is initialized in constructor
    };
  }
}

/**
 * Wrapper class for TensorFlow.js models to implement MLBehaviorModel interface
 */
class TensorFlowModelWrapper implements MLBehaviorModel {
  private model: tf.LayersModel;
  private name: string;
  private inputFeatures: string[];
  private outputActions: string[];

  constructor(model: tf.LayersModel, name: string) {
    this.model = model;
    this.name = name;
    
    // Default feature and action names (can be customized)
    this.inputFeatures = this.generateInputFeatureNames();
    this.outputActions = this.generateOutputActionNames();
  }

  async predict(state: MLAgentState): Promise<AgentAction> {
    const startTime = performance.now();
    
    try {
      // Convert state to tensor (this would be customized per model)
      const inputTensor = this.preprocessState(state);
      
      // Make prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      
      // Convert prediction to action
      const action = this.postprocessPrediction(prediction);
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      // Update performance metrics
      const predictionTime = performance.now() - startTime;
      this.updateMetrics(predictionTime, true);
      
      return action;
    } catch (error) {
      const predictionTime = performance.now() - startTime;
      this.updateMetrics(predictionTime, false);
      throw error;
    }
  }

  async load(_modelPath: string): Promise<void> {
    // This is handled by ModelRegistry
    throw new Error('Use ModelRegistry.registerModel() instead of direct load()');
  }

  getRequiredInputs(): string[] {
    return [...this.inputFeatures];
  }

  getOutputActions(): string[] {
    return [...this.outputActions];
  }

  dispose(): void {
    this.model.dispose();
  }

  /**
   * Preprocess agent state into model input tensor
   */
  private preprocessState(state: MLAgentState): tf.Tensor {
    // This is a generic implementation - would be customized per model
    // For now, create a simple encoding
    const features = [
      state.position?.x || 0,
      state.position?.y || 0,
      (state.properties?.energy as number) || 50,
      (state.properties?.autonomy as number) || 50,
      state.neighbors?.length || 0
    ];
    
    return tf.tensor2d([features]);
  }

  /**
   * Postprocess model output into agent action
   */
  private postprocessPrediction(prediction: tf.Tensor): AgentAction {
    const values = prediction.dataSync();
    
    // Simple action decoding - would be customized per model
    return {
      type: 'MOVE',
      parameters: {
        dx: ((values[0] as number) - 0.5) * 20,
        dy: ((values[1] as number) - 0.5) * 20
      },
      confidence: Math.max(...Array.from(values))
    };
  }

  /**
   * Generate default input feature names
   */
  private generateInputFeatureNames(): string[] {
    const inputShape = (this.model.inputSpec?.[0]?.shape || []) as (number | null)[];
    const featureCount = (inputShape[inputShape.length - 1] as number) || 5;
    
    return Array.from({ length: featureCount }, (_, i) => `feature_${i}`);
  }

  /**
   * Generate default output action names
   */
  private generateOutputActionNames(): string[] {
    const outputShape = this.model.outputShape as (number | null)[];
    const actionCount = (outputShape[outputShape.length - 1] as number) || 2;
    
    return Array.from({ length: actionCount }, (_, i) => `action_${i}`);
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(predictionTime: number, success: boolean): void {
    const registry = ModelRegistry.getInstance();
    const current = registry.getModelMetrics(this.name);
    
    if (current) {
      const newCount = current.predictionCount + 1;
      const newAvgTime = (current.avgPredictionTime * current.predictionCount + predictionTime) / newCount;
      const newErrorRate = success 
        ? (current.errorRate * current.predictionCount) / newCount
        : (current.errorRate * current.predictionCount + 1) / newCount;
      
      registry.updateModelMetrics(this.name, {
        avgPredictionTime: newAvgTime,
        predictionCount: newCount,
        errorRate: newErrorRate
      });
    }
  }
}