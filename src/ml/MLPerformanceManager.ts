import * as tf from '@tensorflow/tfjs';
import { MLAgent } from './MLAgent';
import { AgentAction, InferenceRequest, MLPerformanceMetrics, MLAgentState } from './interfaces';
import { ModelRegistry } from './ModelRegistry';

/**
 * Performance manager for ML inference optimization
 */
export class MLPerformanceManager {
  private static instance: MLPerformanceManager;
  private inferenceQueue: InferenceRequest[] = [];
  private processingBatch = false;
  private batchSize = 32;
  private maxQueueSize = 1000;
  private batchTimeout = 16; // ~60 FPS
  private timeoutId?: NodeJS.Timeout;
  
  private metrics: MLPerformanceMetrics = {
    avgPredictionTime: 0,
    memoryUsage: 0,
    predictionCount: 0,
    errorRate: 0,
    batchEfficiency: 1.0
  };

  private pendingPromises = new Map<string, {
    resolve: (action: AgentAction) => void;
    reject: (error: Error) => void;
  }>();

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MLPerformanceManager {
    if (!MLPerformanceManager.instance) {
      MLPerformanceManager.instance = new MLPerformanceManager();
    }
    return MLPerformanceManager.instance;
  }

  /**
   * Queue a prediction request for batch processing
   * @param agent Agent requesting prediction
   * @param modelName Model to use for prediction
   * @param priority Request priority
   * @returns Promise resolving to predicted action
   */
  async queuePrediction(
    agent: MLAgent, 
    modelName: string, 
    priority: 'high' | 'normal' | 'low' = 'normal'
  ): Promise<AgentAction> {
    return new Promise((resolve, reject) => {
      // Check queue size limit
      if (this.inferenceQueue.length >= this.maxQueueSize) {
        reject(new Error('Inference queue is full'));
        return;
      }

      const request: InferenceRequest = {
        agentId: agent.id,
        state: this.getAgentState(agent),
        modelName,
        timestamp: Date.now(),
        priority
      };

      // Store promise handlers
      this.pendingPromises.set(agent.id, { resolve, reject });

      // Add to queue with priority sorting
      this.addToQueue(request);

      // Schedule batch processing
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Process a single prediction immediately (bypassing queue)
   * @param agent Agent requesting prediction
   * @param modelName Model to use
   * @returns Predicted action
   */
  async processImmediatePrediction(agent: MLAgent, modelName: string): Promise<AgentAction> {
    const startTime = performance.now();
    
    try {
      const model = ModelRegistry.getInstance().getModel(modelName);
      if (!model) {
        throw new Error(`Model "${modelName}" not found`);
      }

      const state = this.getAgentState(agent);
      const action = await model.predict(state);
      
      // Update metrics
      const predictionTime = performance.now() - startTime;
      this.updateMetrics(predictionTime, true);
      
      return action;
    } catch (error) {
      const predictionTime = performance.now() - startTime;
      this.updateMetrics(predictionTime, false);
      throw error;
    }
  }

  /**
   * Add request to queue with priority ordering
   */
  private addToQueue(request: InferenceRequest): void {
    const priorityValues = { high: 3, normal: 2, low: 1 };
    const requestPriority = priorityValues[request.priority];

    // Find insertion point to maintain priority order
    let insertIndex = this.inferenceQueue.length;
    for (let i = 0; i < this.inferenceQueue.length; i++) {
      const queuePriority = priorityValues[this.inferenceQueue[i]!.priority];
      if (requestPriority > queuePriority) {
        insertIndex = i;
        break;
      }
    }

    this.inferenceQueue.splice(insertIndex, 0, request);
  }

  /**
   * Schedule batch processing with timeout
   */
  private scheduleBatchProcessing(): void {
    if (this.processingBatch) return;

    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Process immediately if batch is full
    if (this.inferenceQueue.length >= this.batchSize) {
      this.processBatch();
      return;
    }

    // Otherwise, schedule with timeout
    this.timeoutId = setTimeout(() => {
      if (this.inferenceQueue.length > 0) {
        this.processBatch();
      }
    }, this.batchTimeout);
  }

  /**
   * Process a batch of inference requests
   */
  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.inferenceQueue.length === 0) {
      return;
    }

    this.processingBatch = true;
    const startTime = performance.now();

    try {
      // Take batch from queue
      const batchSize = Math.min(this.batchSize, this.inferenceQueue.length);
      const batch = this.inferenceQueue.splice(0, batchSize);

      // Group by model for efficient processing
      const modelGroups = this.groupByModel(batch);

      // Process each model group
      const results = new Map<string, AgentAction>();
      
      for (const [modelName, requests] of modelGroups) {
        try {
          const batchResults = await this.processBatchForModel(modelName, requests);
          
          // Store results
          requests.forEach((request, index) => {
            results.set(request.agentId, batchResults[index]!);
          });
        } catch (error) {
          console.error(`Batch processing failed for model ${modelName}:`, error);
          
          // Mark all requests in this group as failed
          requests.forEach(request => {
            const handlers = this.pendingPromises.get(request.agentId);
            if (handlers) {
              handlers.reject(error as Error);
              this.pendingPromises.delete(request.agentId);
            }
          });
        }
      }

      // Resolve successful predictions
      for (const [agentId, action] of results) {
        const handlers = this.pendingPromises.get(agentId);
        if (handlers) {
          handlers.resolve(action);
          this.pendingPromises.delete(agentId);
        }
      }

      // Update performance metrics
      const batchTime = performance.now() - startTime;
      const avgTimePerPrediction = batchTime / batch.length;
      this.updateMetrics(avgTimePerPrediction, true);
      
      // Update batch efficiency
      const efficiency = batchSize / this.batchSize;
      this.metrics.batchEfficiency = (this.metrics.batchEfficiency * 0.9) + (efficiency * 0.1);

    } catch (error) {
      console.error('Batch processing error:', error);
      
      // Reject all pending promises in this batch
      for (const [agentId] of this.pendingPromises) {
        const handlers = this.pendingPromises.get(agentId);
        if (handlers) {
          handlers.reject(error as Error);
          this.pendingPromises.delete(agentId);
        }
      }
    } finally {
      this.processingBatch = false;
      
      // Schedule next batch if queue is not empty
      if (this.inferenceQueue.length > 0) {
        this.scheduleBatchProcessing();
      }
    }
  }

  /**
   * Group requests by model name for batch processing
   */
  private groupByModel(requests: InferenceRequest[]): Map<string, InferenceRequest[]> {
    const groups = new Map<string, InferenceRequest[]>();
    
    for (const request of requests) {
      if (!groups.has(request.modelName)) {
        groups.set(request.modelName, []);
      }
      groups.get(request.modelName)!.push(request);
    }
    
    return groups;
  }

  /**
   * Process a batch of requests for a specific model
   */
  private async processBatchForModel(
    modelName: string, 
    requests: InferenceRequest[]
  ): Promise<AgentAction[]> {
    const model = ModelRegistry.getInstance().getModel(modelName);
    if (!model) {
      throw new Error(`Model "${modelName}" not found`);
    }

    // For now, process sequentially (can be optimized for true batch processing)
    const results: AgentAction[] = [];
    
    for (const request of requests) {
      try {
        const action = await model.predict(request.state);
        results.push(action);
      } catch (error) {
        console.error(`Prediction failed for agent ${request.agentId}:`, error);
        
        // Use fallback action
        results.push({
          type: 'MOVE',
          parameters: { dx: 0, dy: 0 },
          confidence: 0
        });
      }
    }
    
    return results;
  }

  /**
   * Get agent state for prediction
   */
  private getAgentState(agent: MLAgent): MLAgentState {
    // This would use the agent's getCurrentState method
    // For now, create a basic state representation
    return {
      position: agent.position,
      properties: agent.getAllProperties(),
      environment: {
        currentStep: (agent.getProperty('step') as number) || 0,
        bounds: { width: 1000, height: 1000 },
        localDensity: 0
      },
      neighbors: []
    } as MLAgentState;
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(predictionTime: number, success: boolean): void {
    this.metrics.predictionCount++;
    
    // Update average prediction time
    const count = this.metrics.predictionCount;
    this.metrics.avgPredictionTime = 
      (this.metrics.avgPredictionTime * (count - 1) + predictionTime) / count;
    
    // Update error rate
    if (!success) {
      const errorCount = this.metrics.errorRate * (count - 1) + 1;
      this.metrics.errorRate = errorCount / count;
    } else {
      this.metrics.errorRate = this.metrics.errorRate * (count - 1) / count;
    }
    
    // Update memory usage
    const memInfo = tf.memory();
    this.metrics.memoryUsage = memInfo.numBytes / (1024 * 1024); // MB
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): MLPerformanceMetrics {
    return { ...this.metrics };
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    processing: boolean;
    batchSize: number;
    pendingPromises: number;
  } {
    return {
      queueLength: this.inferenceQueue.length,
      processing: this.processingBatch,
      batchSize: this.batchSize,
      pendingPromises: this.pendingPromises.size
    };
  }

  /**
   * Configure batch processing parameters
   */
  configure(options: {
    batchSize?: number;
    maxQueueSize?: number;
    batchTimeout?: number;
  }): void {
    if (options.batchSize) {
      this.batchSize = Math.max(1, Math.min(128, options.batchSize));
    }
    
    if (options.maxQueueSize) {
      this.maxQueueSize = Math.max(10, options.maxQueueSize);
    }
    
    if (options.batchTimeout) {
      this.batchTimeout = Math.max(1, Math.min(100, options.batchTimeout));
    }
  }

  /**
   * Clear the inference queue
   */
  clearQueue(): void {
    // Reject all pending promises
    for (const [, handlers] of this.pendingPromises) {
      handlers.reject(new Error('Queue cleared'));
    }
    
    this.inferenceQueue = [];
    this.pendingPromises.clear();
    
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined as any;
    }
  }

  /**
   * Get memory usage information
   */
  getMemoryInfo(): { framework: any; tensorflow: any } {
    return {
      framework: {
        queueSize: this.inferenceQueue.length,
        pendingPromises: this.pendingPromises.size,
        processingBatch: this.processingBatch
      },
      tensorflow: tf.memory()
    };
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.clearQueue();
    this.processingBatch = false;
    
    // Reset metrics
    this.metrics = {
      avgPredictionTime: 0,
      memoryUsage: 0,
      predictionCount: 0,
      errorRate: 0,
      batchEfficiency: 1.0
    };
  }
}