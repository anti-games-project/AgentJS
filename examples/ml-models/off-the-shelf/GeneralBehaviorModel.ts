/**
 * General Behavior Model - Off-the-shelf ML model for basic agent behaviors
 * 
 * This model provides general-purpose agent behaviors that can be applied
 * to any domain. It combines movement, social interaction, and resource
 * management patterns learned from diverse training scenarios.
 */

import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, AgentState, AgentAction } from '../../../src/ml/interfaces';
import { StateEncoder } from '../../../src/ml/StateEncoder';

export interface GeneralBehaviorConfig {
  explorationRate: number;     // 0-1, higher = more random behavior
  socialInfluence: number;     // 0-1, how much neighbors affect decisions
  resourceSeeking: number;     // 0-1, priority of resource acquisition
  riskTolerance: number;       // 0-1, willingness to take risks
}

export class GeneralBehaviorModel implements MLBehaviorModel {
  private model?: tf.LayersModel;
  private config: GeneralBehaviorConfig;
  private isLoaded: boolean = false;
  private modelMetadata: any = null;

  constructor(config: Partial<GeneralBehaviorConfig> = {}) {
    this.config = {
      explorationRate: 0.3,
      socialInfluence: 0.5,
      resourceSeeking: 0.7,
      riskTolerance: 0.4,
      ...config
    };
  }

  async load(modelPath: string): Promise<void> {
    try {
      // Load the TensorFlow.js model
      this.model = await tf.loadLayersModel(modelPath);
      
      // Load metadata if available
      try {
        const metadataPath = modelPath.replace('.json', '-metadata.json');
        const response = await fetch(metadataPath);
        if (response.ok) {
          this.modelMetadata = await response.json();
        }
      } catch (e) {
        console.warn('Model metadata not found, using defaults');
      }

      this.isLoaded = true;
      console.log('General Behavior Model loaded successfully');
    } catch (error) {
      console.error('Failed to load General Behavior Model:', error);
      this.isLoaded = false;
      throw error;
    }
  }

  async predict(state: AgentState): Promise<AgentAction> {
    if (this.model && this.isLoaded) {
      try {
        return await this.predictWithML(state);
      } catch (error) {
        console.warn('ML prediction failed, using fallback:', error);
        return this.predictWithRules(state);
      }
    } else {
      return this.predictWithRules(state);
    }
  }

  private async predictWithML(state: AgentState): Promise<AgentAction> {
    if (!this.model) throw new Error('Model not loaded');

    // Encode the current state
    const inputTensor = this.encodeStateForModel(state);
    
    // Get prediction from model
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await prediction.data();
    
    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    // Decode prediction to action
    return this.decodeAction(predictionData, state);
  }

  private predictWithRules(state: AgentState): AgentAction {
    // Rule-based fallback behavior combining multiple strategies
    
    const actions: any[] = [];
    
    // 1. Movement behavior
    const movementAction = this.calculateMovement(state);
    if (movementAction) actions.push(movementAction);
    
    // 2. Social behavior
    const socialAction = this.calculateSocialBehavior(state);
    if (socialAction) actions.push(socialAction);
    
    // 3. Resource behavior
    const resourceAction = this.calculateResourceBehavior(state);
    if (resourceAction) actions.push(resourceAction);

    // Combine actions or pick the most important one
    return this.combineActions(actions, state);
  }

  private calculateMovement(state: AgentState): any {
    const currentEnergy = state.properties.energy || 50;
    const position = state.position;
    const neighbors = state.neighbors || [];

    // Energy-based movement decisions
    if (currentEnergy < 30) {
      // Low energy - conservative movement
      return {
        type: 'MOVE',
        parameters: {
          direction: this.findSafeDirection(position, neighbors),
          speed: 0.3,
          reason: 'energy_conservation'
        }
      };
    } else if (currentEnergy > 80) {
      // High energy - exploration
      return {
        type: 'MOVE',
        parameters: {
          direction: this.exploreDirection(position),
          speed: 0.8 * this.config.explorationRate,
          reason: 'exploration'
        }
      };
    }

    // Medium energy - balanced behavior
    return {
      type: 'MOVE',
      parameters: {
        direction: this.balancedMovement(position, neighbors),
        speed: 0.5,
        reason: 'balanced'
      }
    };
  }

  private calculateSocialBehavior(state: AgentState): any {
    const neighbors = state.neighbors || [];
    if (neighbors.length === 0) return null;

    const neighborCount = neighbors.length;
    const socialStrength = this.config.socialInfluence;

    if (neighborCount > 5) {
      // Too crowded - seek space
      return {
        type: 'SOCIAL',
        parameters: {
          behavior: 'avoid_crowding',
          intensity: socialStrength,
          target_distance: 20
        }
      };
    } else if (neighborCount < 2) {
      // Too isolated - seek company
      return {
        type: 'SOCIAL',
        parameters: {
          behavior: 'seek_company',
          intensity: socialStrength,
          target_distance: 15
        }
      };
    }

    // Good social balance - maintain connections
    return {
      type: 'SOCIAL',
      parameters: {
        behavior: 'maintain_connections',
        intensity: socialStrength * 0.5
      }
    };
  }

  private calculateResourceBehavior(state: AgentState): any {
    const currentEnergy = state.properties.energy || 50;
    const resources = state.environment?.nearbyResources || [];

    if (currentEnergy < 40 && resources.length > 0) {
      // Need resources urgently
      return {
        type: 'RESOURCE',
        parameters: {
          behavior: 'seek_urgent',
          target: this.findClosestResource(resources, state.position),
          priority: 'high'
        }
      };
    } else if (currentEnergy > 70 && this.config.resourceSeeking > 0.5) {
      // Opportunistic resource gathering
      return {
        type: 'RESOURCE',
        parameters: {
          behavior: 'opportunistic',
          target: this.findBestResource(resources, state.position),
          priority: 'low'
        }
      };
    }

    return null;
  }

  private combineActions(actions: any[], state: AgentState): AgentAction {
    if (actions.length === 0) {
      // Default idle action
      return {
        type: 'IDLE',
        parameters: {},
        confidence: 0.5
      };
    }

    if (actions.length === 1) {
      return {
        ...actions[0],
        confidence: 0.8
      };
    }

    // Multiple actions - prioritize based on current needs
    const currentEnergy = state.properties.energy || 50;
    
    if (currentEnergy < 30) {
      // Prioritize resource actions when low energy
      const resourceAction = actions.find(a => a.type === 'RESOURCE');
      if (resourceAction) {
        return { ...resourceAction, confidence: 0.9 };
      }
    }

    // Otherwise, prioritize movement
    const movementAction = actions.find(a => a.type === 'MOVE');
    if (movementAction) {
      return { ...movementAction, confidence: 0.7 };
    }

    return {
      ...actions[0],
      confidence: 0.6
    };
  }

  private encodeStateForModel(state: AgentState): tf.Tensor {
    // Create a standardized input vector for the general behavior model
    const features = [
      // Position (normalized)
      (state.position.x % 1000) / 1000,
      (state.position.y % 1000) / 1000,
      
      // Agent properties
      (state.properties.energy || 50) / 100,
      (state.properties.age || 0) / 1000,
      Math.min((state.properties.speed || 1), 10) / 10,
      
      // Social context
      Math.min(state.neighbors?.length || 0, 10) / 10,
      
      // Environment context
      (state.environment?.currentStep || 0) % 1000 / 1000,
      state.environment?.temperature || 0.5,
      
      // Configuration parameters
      this.config.explorationRate,
      this.config.socialInfluence,
      this.config.resourceSeeking,
      this.config.riskTolerance
    ];

    return tf.tensor2d([features], [1, features.length]);
  }

  private decodeAction(prediction: Float32Array, state: AgentState): AgentAction {
    // Interpret the model output
    // Assuming output format: [move_x, move_y, social_intensity, resource_seek, confidence]
    
    const moveX = prediction[0];
    const moveY = prediction[1];
    const socialIntensity = prediction[2];
    const resourceSeek = prediction[3];
    const confidence = prediction[4] || 0.5;

    // Determine primary action based on strongest signal
    const moveStrength = Math.sqrt(moveX * moveX + moveY * moveY);
    
    if (moveStrength > 0.3) {
      return {
        type: 'MOVE',
        parameters: {
          direction: { x: moveX, y: moveY },
          speed: Math.min(moveStrength, 1.0),
          reason: 'ml_prediction'
        },
        confidence: Math.min(confidence, 1.0)
      };
    } else if (socialIntensity > 0.4) {
      return {
        type: 'SOCIAL',
        parameters: {
          behavior: socialIntensity > 0.7 ? 'engage' : 'maintain',
          intensity: socialIntensity
        },
        confidence: Math.min(confidence, 1.0)
      };
    } else if (resourceSeek > 0.5) {
      return {
        type: 'RESOURCE',
        parameters: {
          behavior: 'seek',
          priority: resourceSeek > 0.8 ? 'high' : 'medium'
        },
        confidence: Math.min(confidence, 1.0)
      };
    }

    return {
      type: 'IDLE',
      parameters: {},
      confidence: Math.min(confidence, 1.0)
    };
  }

  // Helper methods for rule-based behavior
  private findSafeDirection(position: any, neighbors: any[]): any {
    // Find direction away from crowded areas
    if (neighbors.length === 0) {
      return { x: Math.random() - 0.5, y: Math.random() - 0.5 };
    }

    let avgX = 0, avgY = 0;
    neighbors.forEach(neighbor => {
      avgX += neighbor.position.x;
      avgY += neighbor.position.y;
    });
    avgX /= neighbors.length;
    avgY /= neighbors.length;

    // Move away from neighbor center
    return {
      x: position.x - avgX,
      y: position.y - avgY
    };
  }

  private exploreDirection(position: any): any {
    // Random exploration with some bias toward unvisited areas
    return {
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2
    };
  }

  private balancedMovement(position: any, neighbors: any[]): any {
    // Balanced movement considering both exploration and social factors
    const exploration = this.exploreDirection(position);
    const social = neighbors.length > 0 ? this.findSafeDirection(position, neighbors) : { x: 0, y: 0 };
    
    return {
      x: exploration.x * (1 - this.config.socialInfluence) + social.x * this.config.socialInfluence,
      y: exploration.y * (1 - this.config.socialInfluence) + social.y * this.config.socialInfluence
    };
  }

  private findClosestResource(resources: any[], position: any): any {
    if (resources.length === 0) return null;
    
    let closest = resources[0];
    let minDistance = this.distance(position, closest.position);
    
    resources.forEach(resource => {
      const dist = this.distance(position, resource.position);
      if (dist < minDistance) {
        minDistance = dist;
        closest = resource;
      }
    });
    
    return closest;
  }

  private findBestResource(resources: any[], position: any): any {
    if (resources.length === 0) return null;
    
    // Find resource with best value/distance ratio
    let bestResource = resources[0];
    let bestScore = (bestResource.value || 1) / (this.distance(position, bestResource.position) + 1);
    
    resources.forEach(resource => {
      const distance = this.distance(position, resource.position);
      const score = (resource.value || 1) / (distance + 1);
      if (score > bestScore) {
        bestScore = score;
        bestResource = resource;
      }
    });
    
    return bestResource;
  }

  private distance(a: any, b: any): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getRequiredInputs(): string[] {
    return [
      'position.x', 'position.y',
      'properties.energy', 'properties.age', 'properties.speed',
      'neighbors.length',
      'environment.currentStep', 'environment.temperature'
    ];
  }

  getOutputActions(): string[] {
    return ['MOVE', 'SOCIAL', 'RESOURCE', 'IDLE'];
  }

  configure(config: Partial<GeneralBehaviorConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfiguration(): GeneralBehaviorConfig {
    return { ...this.config };
  }

  getModelInfo(): any {
    return {
      name: 'General Behavior Model',
      version: '1.0.0',
      type: 'off-the-shelf',
      domain: 'general',
      isLoaded: this.isLoaded,
      metadata: this.modelMetadata,
      configuration: this.config
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = undefined;
    }
    this.isLoaded = false;
  }
}