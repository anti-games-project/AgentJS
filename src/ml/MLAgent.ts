import { Agent } from '../core/agents/Agent';
import { AgentId, AgentProperties, Position } from '../types/core';
import { MLBehaviorModel, MLAgentState, AgentAction, EnvironmentContext } from './interfaces';
import { StateEncoder } from './StateEncoder';

/**
 * ML-enhanced agent that uses machine learning models for decision making
 */
export class MLAgent extends Agent {
  private behaviorModel?: MLBehaviorModel;
  private predictionHistory: AgentAction[] = [];
  private maxHistoryLength: number = 50;
  private fallbackEnabled: boolean = true;
  private performanceMetrics = {
    predictionCount: 0,
    avgPredictionTime: 0,
    errorCount: 0,
    lastPredictionTime: 0
  };

  constructor(id?: AgentId, properties?: AgentProperties) {
    super(id, properties);
    
    // Set default properties for ML agents
    this.setProperty('mlEnabled', 1);
    this.setProperty('predictionConfidence', 0);
    this.setProperty('fallbackMode', 0);
  }

  /**
   * Load a behavior model for this agent
   * @param model ML behavior model to use
   */
  async loadBehaviorModel(model: MLBehaviorModel): Promise<void> {
    try {
      if (this.behaviorModel) {
        this.behaviorModel.dispose();
      }
      
      this.behaviorModel = model;
      this.setProperty('mlEnabled', 1);
      this.setProperty('fallbackMode', 0);
      
      this.emit('modelLoaded', { agentId: this.id, modelLoaded: true });
    } catch (error) {
      console.warn(`Failed to load ML model for agent ${this.id}:`, error);
      this.setProperty('mlEnabled', 0);
      this.setProperty('fallbackMode', 1);
      throw error;
    }
  }

  /**
   * Remove the current behavior model
   */
  removeBehaviorModel(): void {
    if (this.behaviorModel) {
      this.behaviorModel.dispose();
      this.behaviorModel = null as any;
    }
    
    this.setProperty('mlEnabled', 0);
    this.setProperty('fallbackMode', 1);
    this.predictionHistory = [];
    
    this.emit('modelRemoved', { agentId: this.id });
  }

  /**
   * Main step function with ML prediction
   */
  async step(): Promise<void> {
    if (this.behaviorModel && this.getProperty('mlEnabled')) {
      try {
        await this.stepWithML();
      } catch (error) {
        console.warn(`ML prediction failed for agent ${this.id}:`, error);
        this.performanceMetrics.errorCount++;
        
        if (this.fallbackEnabled) {
          this.setProperty('fallbackMode', 1);
          this.stepWithoutML();
        }
      }
    } else {
      this.stepWithoutML();
    }
    
    // Update performance metrics
    this.setProperty('predictionConfidence', this.getLastPredictionConfidence());
    this.setProperty('errorRate', this.getErrorRate());
  }

  /**
   * Execute step using ML model
   */
  private async stepWithML(): Promise<void> {
    const startTime = performance.now();
    
    // Get current state
    const state = this.getCurrentState();
    
    // Validate state before prediction
    if (!StateEncoder.validateState(state)) {
      throw new Error('Invalid state for ML prediction');
    }
    
    // Make prediction
    const action = await this.behaviorModel!.predict(state);
    
    // Record timing
    const predictionTime = performance.now() - startTime;
    this.updatePerformanceMetrics(predictionTime);
    
    // Execute the predicted action
    await this.executeAction(action);
    
    // Store in history
    this.addToHistory(action);
    
    this.setProperty('fallbackMode', 0);
    this.emit('mlPrediction', {
      agentId: this.id,
      action,
      predictionTime,
      confidence: action.confidence || 0
    });
  }

  /**
   * Execute step without ML (fallback behavior)
   */
  private stepWithoutML(): void {
    // Simple random movement as fallback
    const dx = (Math.random() - 0.5) * 10;
    const dy = (Math.random() - 0.5) * 10;
    
    const fallbackAction: AgentAction = {
      type: 'MOVE',
      parameters: { dx, dy },
      confidence: 0.1
    };
    
    this.executeAction(fallbackAction);
    this.addToHistory(fallbackAction);
    
    this.emit('fallbackUsed', { agentId: this.id, action: fallbackAction });
  }

  /**
   * Get current state for ML prediction
   */
  private getCurrentState(): MLAgentState {
    const environmentContext: EnvironmentContext = {
      bounds: { width: 1000, height: 1000 }, // Default bounds
      currentStep: (this.getProperty('step') as number) || 0,
      localDensity: this.getLocalDensity(),
      boundaryDistances: this.getBoundaryDistances()
    };

    // Convert properties to Record<string, number>
    const properties: Record<string, number> = {};
    const allProps = this.getAllProperties();
    for (const [key, value] of Object.entries(allProps)) {
      if (typeof value === 'number') {
        properties[key] = value;
      }
    }

    return {
      position: this.position,
      properties,
      environment: environmentContext,
      neighbors: this.getNeighbors(),
      actionHistory: this.predictionHistory.slice(-5) // Last 5 actions
    };
  }

  /**
   * Execute a predicted action
   */
  private async executeAction(action: AgentAction): Promise<void> {
    try {
      switch (action.type) {
        case 'MOVE':
          this.executeMovement(action);
          break;
        case 'INTERACT':
          this.executeInteraction(action);
          break;
        case 'CHANGE_PROPERTY':
          this.executePropertyChange(action);
          break;
        case 'CUSTOM':
          this.executeCustomAction(action);
          break;
        default:
          console.warn(`Unknown action type: ${action.type}`);
      }
    } catch (error) {
      console.warn(`Failed to execute action for agent ${this.id}:`, error);
      throw error;
    }
  }

  /**
   * Execute movement action
   */
  private executeMovement(action: AgentAction): void {
    const { dx = 0, dy = 0 } = action.parameters;
    const newX = this.position.x + dx;
    const newY = this.position.y + dy;
    
    // Basic boundary checking
    const maxX = 1000; // Default bounds
    const maxY = 1000; // Default bounds
    
    // Use a helper method to set position since it's readonly
    const newPosition = {
      x: Math.max(0, Math.min(maxX, newX)),
      y: Math.max(0, Math.min(maxY, newY))
    } as Position;
    
    // Update position through property system
    this.setProperty('x', newPosition.x);
    this.setProperty('y', newPosition.y);
  }

  /**
   * Execute interaction action
   */
  private executeInteraction(action: AgentAction): void {
    const { targetType, intensity = 0.5 } = action.parameters;
    
    // Find appropriate target
    const neighbors = this.getNeighbors();
    if (neighbors.length > 0) {
      const target = neighbors[0]; // Simple selection
      
      if (target) {
        // Emit interaction event
        this.emit('agentInteraction', {
          source: this.id,
          target: target.id,
          type: targetType,
          intensity
        });
      }
      
      // Update properties based on interaction
      const currentEnergy = (this.getProperty('energy') as number) || 50;
      this.setProperty('energy', Math.max(0, currentEnergy - (intensity * 5)));
    }
  }

  /**
   * Execute property change action
   */
  private executePropertyChange(action: AgentAction): void {
    const { property, delta = 0, absolute } = action.parameters;
    
    if (absolute !== undefined) {
      this.setProperty(property, absolute);
    } else {
      const currentValue = (this.getProperty(property) as number) || 0;
      this.setProperty(property, currentValue + delta);
    }
  }

  /**
   * Execute custom action (for domain-specific extensions)
   */
  private executeCustomAction(action: AgentAction): void {
    // Emit event for custom handling
    this.emit('customAction', {
      agentId: this.id,
      action: action.parameters,
      confidence: action.confidence
    });
  }

  /**
   * Add action to prediction history
   */
  private addToHistory(action: AgentAction): void {
    this.predictionHistory.push(action);
    
    if (this.predictionHistory.length > this.maxHistoryLength) {
      this.predictionHistory.shift();
    }
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(predictionTime: number): void {
    this.performanceMetrics.predictionCount++;
    this.performanceMetrics.lastPredictionTime = predictionTime;
    
    // Update rolling average
    const count = this.performanceMetrics.predictionCount;
    const oldAvg = this.performanceMetrics.avgPredictionTime;
    this.performanceMetrics.avgPredictionTime = 
      (oldAvg * (count - 1) + predictionTime) / count;
  }

  /**
   * Get neighbors from environment
   */
  private getNeighbors(): Agent[] {
    // ML agents don't have direct environment access
    return [];
  }

  /**
   * Calculate local agent density
   */
  private getLocalDensity(): number {
    const neighbors = this.getNeighbors();
    const area = Math.PI * 50 * 50; // Circle with radius 50
    return neighbors.length / area * 10000; // Normalize to per 10,000 units
  }

  /**
   * Calculate distances to environment boundaries
   */
  private getBoundaryDistances(): { north: number; south: number; east: number; west: number } {
    // Use default bounds for ML agents
    const bounds = { width: 1000, height: 1000 };
    return {
      north: bounds.height - this.position.y,
      south: this.position.y,
      east: bounds.width - this.position.x,
      west: this.position.x
    };
  }

  /**
   * Get confidence of last prediction
   */
  private getLastPredictionConfidence(): number {
    if (this.predictionHistory.length === 0) return 0;
    const lastAction = this.predictionHistory[this.predictionHistory.length - 1];
    return lastAction?.confidence || 0;
  }

  /**
   * Calculate error rate
   */
  private getErrorRate(): number {
    const total = this.performanceMetrics.predictionCount + this.performanceMetrics.errorCount;
    return total > 0 ? this.performanceMetrics.errorCount / total : 0;
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return {
      ...this.performanceMetrics,
      errorRate: this.getErrorRate(),
      historyLength: this.predictionHistory.length,
      hasModel: !!this.behaviorModel,
      mlEnabled: !!this.getProperty('mlEnabled')
    };
  }

  /**
   * Get prediction history
   */
  getPredictionHistory(): AgentAction[] {
    return [...this.predictionHistory]; // Return copy
  }

  /**
   * Clear prediction history
   */
  clearHistory(): void {
    this.predictionHistory = [];
    this.performanceMetrics = {
      predictionCount: 0,
      avgPredictionTime: 0,
      errorCount: 0,
      lastPredictionTime: 0
    };
  }

  /**
   * Enable or disable fallback behavior
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
  }

  /**
   * Check if agent is using ML predictions
   */
  isUsingML(): boolean {
    return !!(this.behaviorModel && this.getProperty('mlEnabled'));
  }

  /**
   * Check if agent is in fallback mode
   */
  isInFallbackMode(): boolean {
    return !!this.getProperty('fallbackMode');
  }

  /**
   * Override destroy to clean up ML resources
   */
  override destroy(): void {
    if (this.behaviorModel) {
      this.behaviorModel.dispose();
    }
    this.predictionHistory = [];
    super.destroy();
  }
}