import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, MLAgentState, AgentAction } from '../interfaces';
import { Position } from '../../types/core';

/**
 * Generic flocking behavior ML model
 * Works for birds, fish, crowds, or any swarm behavior
 */
export class FlockingMLModel implements MLBehaviorModel {
  private model?: tf.LayersModel;
  private inputFeatures: string[];
  private outputActions: string[];
  private isLoaded = false;
  private separationWeight = 1.0;
  private alignmentWeight = 1.0;
  private cohesionWeight = 1.0;
  private maxSpeed = 10;

  constructor() {
    this.inputFeatures = [
      'position_x', 'position_y',
      'neighbor_count', 'avg_neighbor_distance',
      'separation_force_x', 'separation_force_y',
      'alignment_force_x', 'alignment_force_y',
      'cohesion_force_x', 'cohesion_force_y',
      'boundary_distance_min'
    ];

    this.outputActions = [
      'velocity_x', 'velocity_y', 'speed_magnitude'
    ];
  }

  async predict(state: MLAgentState): Promise<AgentAction> {
    if (this.model && this.isLoaded) {
      return this.predictWithML(state);
    } else {
      // Fallback to rule-based flocking
      return this.predictWithRules(state);
    }
  }

  /**
   * ML-based prediction
   */
  private async predictWithML(state: MLAgentState): Promise<AgentAction> {
    try {
      const inputTensor = this.encodeFlockingState(state);
      const prediction = this.model!.predict(inputTensor) as tf.Tensor;
      const action = this.decodeFlockingAction(prediction);
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      return action;
    } catch (error) {
      console.warn('ML prediction failed, falling back to rules:', error);
      return this.predictWithRules(state);
    }
  }

  /**
   * Rule-based flocking prediction (fallback and training data generation)
   */
  private predictWithRules(state: MLAgentState): AgentAction {
    const neighbors = state.neighbors;
    
    // Calculate flocking forces
    const separation = this.calculateSeparation(state.position, neighbors);
    const alignment = this.calculateAlignment(neighbors);
    const cohesion = this.calculateCohesion(state.position, neighbors);
    
    // Combine forces
    const totalForceX = 
      separation.x * this.separationWeight +
      alignment.x * this.alignmentWeight +
      cohesion.x * this.cohesionWeight;
      
    const totalForceY = 
      separation.y * this.separationWeight +
      alignment.y * this.alignmentWeight +
      cohesion.y * this.cohesionWeight;

    // Add boundary avoidance
    const boundaryForce = this.calculateBoundaryAvoidance(state);
    const finalForceX = totalForceX + boundaryForce.x;
    const finalForceY = totalForceY + boundaryForce.y;

    // Limit speed
    const magnitude = Math.sqrt(finalForceX ** 2 + finalForceY ** 2);
    const limitedMagnitude = Math.min(magnitude, this.maxSpeed);
    
    const dx = magnitude > 0 ? (finalForceX / magnitude) * limitedMagnitude : 0;
    const dy = magnitude > 0 ? (finalForceY / magnitude) * limitedMagnitude : 0;

    return {
      type: 'MOVE',
      parameters: { dx, dy },
      confidence: 0.8
    };
  }

  /**
   * Calculate separation force (avoid crowding neighbors)
   */
  private calculateSeparation(
    position: Position, 
    neighbors: any[]
  ): { x: number; y: number } {
    if (neighbors.length === 0) return { x: 0, y: 0 };

    let separationX = 0;
    let separationY = 0;
    let count = 0;
    const desiredSeparation = 30; // Minimum desired distance

    for (const neighbor of neighbors) {
      const distance = Math.sqrt(
        (position.x - neighbor.position.x) ** 2 +
        (position.y - neighbor.position.y) ** 2
      );

      if (distance > 0 && distance < desiredSeparation) {
        // Calculate force away from neighbor
        const diffX = position.x - neighbor.position.x;
        const diffY = position.y - neighbor.position.y;
        
        // Normalize and weight by distance
        const normalizedX = diffX / distance;
        const normalizedY = diffY / distance;
        const weight = (desiredSeparation - distance) / desiredSeparation;
        
        separationX += normalizedX * weight;
        separationY += normalizedY * weight;
        count++;
      }
    }

    if (count > 0) {
      separationX /= count;
      separationY /= count;
    }

    return { x: separationX, y: separationY };
  }

  /**
   * Calculate alignment force (steer towards average heading of neighbors)
   */
  private calculateAlignment(neighbors: any[]): { x: number; y: number } {
    if (neighbors.length === 0) return { x: 0, y: 0 };

    let alignmentX = 0;
    let alignmentY = 0;

    for (const neighbor of neighbors) {
      // Use velocity if available, otherwise estimate from recent movement
      const vx = (neighbor.getProperty?.('velocityX') as number) || 0;
      const vy = (neighbor.getProperty?.('velocityY') as number) || 0;
      
      alignmentX += vx;
      alignmentY += vy;
    }

    // Average the alignment
    alignmentX /= neighbors.length;
    alignmentY /= neighbors.length;

    // Normalize
    const magnitude = Math.sqrt(alignmentX ** 2 + alignmentY ** 2);
    if (magnitude > 0) {
      alignmentX /= magnitude;
      alignmentY /= magnitude;
    }

    return { x: alignmentX, y: alignmentY };
  }

  /**
   * Calculate cohesion force (steer towards center of neighbors)
   */
  private calculateCohesion(
    position: Position, 
    neighbors: any[]
  ): { x: number; y: number } {
    if (neighbors.length === 0) return { x: 0, y: 0 };

    // Calculate center of mass of neighbors
    let centerX = 0;
    let centerY = 0;

    for (const neighbor of neighbors) {
      centerX += neighbor.position.x;
      centerY += neighbor.position.y;
    }

    centerX /= neighbors.length;
    centerY /= neighbors.length;

    // Calculate force towards center
    const cohesionX = centerX - position.x;
    const cohesionY = centerY - position.y;

    // Normalize
    const magnitude = Math.sqrt(cohesionX ** 2 + cohesionY ** 2);
    if (magnitude > 0) {
      return {
        x: cohesionX / magnitude,
        y: cohesionY / magnitude
      };
    }

    return { x: 0, y: 0 };
  }

  /**
   * Calculate boundary avoidance force
   */
  private calculateBoundaryAvoidance(state: MLAgentState): { x: number; y: number } {
    const bounds = state.environment.bounds || { width: 1000, height: 1000 };
    const position = state.position;
    const margin = 50; // Distance from boundary to start avoiding
    
    let forceX = 0;
    let forceY = 0;

    // Left boundary
    if (position.x < margin) {
      forceX += (margin - position.x) / margin;
    }
    
    // Right boundary
    if (position.x > bounds.width - margin) {
      forceX -= (position.x - (bounds.width - margin)) / margin;
    }
    
    // Top boundary
    if (position.y < margin) {
      forceY += (margin - position.y) / margin;
    }
    
    // Bottom boundary
    if (position.y > bounds.height - margin) {
      forceY -= (position.y - (bounds.height - margin)) / margin;
    }

    return { x: forceX, y: forceY };
  }

  /**
   * Encode agent state for ML model input
   */
  private encodeFlockingState(state: MLAgentState): tf.Tensor {
    const neighbors = state.neighbors;
    const position = state.position;
    
    // Calculate flocking-specific features
    const avgDistance = neighbors.length > 0 
      ? neighbors.reduce((sum, n) => sum + Math.sqrt(
          (position.x - n.position.x) ** 2 + (position.y - n.position.y) ** 2
        ), 0) / neighbors.length
      : 0;

    const separation = this.calculateSeparation(position, neighbors);
    const alignment = this.calculateAlignment(neighbors);
    const cohesion = this.calculateCohesion(position, neighbors);
    // const boundary = this.calculateBoundaryAvoidance(state); // Boundary force not used in encoding

    const minBoundaryDistance = Math.min(
      position.x,
      position.y,
      (state.environment.bounds?.width || 1000) - position.x,
      (state.environment.bounds?.height || 1000) - position.y
    );

    const features = [
      position.x / 1000, // Normalized position
      position.y / 1000,
      Math.min(neighbors.length / 10, 1), // Normalized neighbor count
      avgDistance / 100, // Normalized average distance
      separation.x, // Separation force
      separation.y,
      alignment.x, // Alignment force
      alignment.y,
      cohesion.x, // Cohesion force
      cohesion.y,
      minBoundaryDistance / 100 // Normalized boundary distance
    ];

    return tf.tensor2d([features]);
  }

  /**
   * Decode ML output to agent action
   */
  private decodeFlockingAction(prediction: tf.Tensor): AgentAction {
    const values = prediction.dataSync() as Float32Array;
    
    if (values.length >= 2) {
      const dx = values[0]! * this.maxSpeed;
      const dy = values[1]! * this.maxSpeed;
      const speed = values.length > 2 ? values[2]! : Math.sqrt(dx ** 2 + dy ** 2);
      
      return {
        type: 'MOVE',
        parameters: { dx, dy, speed },
        confidence: Math.min(...Array.from(values).map(v => Math.abs(v)))
      };
    }

    return {
      type: 'MOVE',
      parameters: { dx: 0, dy: 0 },
      confidence: 0
    };
  }

  async load(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(modelPath);
      this.isLoaded = true;
      console.log('FlockingMLModel loaded successfully');
    } catch (error) {
      console.warn('Failed to load FlockingMLModel, using rule-based fallback:', error);
      this.isLoaded = false;
    }
  }

  getRequiredInputs(): string[] {
    return [...this.inputFeatures];
  }

  getOutputActions(): string[] {
    return [...this.outputActions];
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = undefined as any;
    }
    this.isLoaded = false;
  }

  /**
   * Configure flocking behavior parameters
   */
  configure(options: {
    separationWeight?: number;
    alignmentWeight?: number;
    cohesionWeight?: number;
    maxSpeed?: number;
  }): void {
    if (options.separationWeight !== undefined) {
      this.separationWeight = Math.max(0, options.separationWeight);
    }
    if (options.alignmentWeight !== undefined) {
      this.alignmentWeight = Math.max(0, options.alignmentWeight);
    }
    if (options.cohesionWeight !== undefined) {
      this.cohesionWeight = Math.max(0, options.cohesionWeight);
    }
    if (options.maxSpeed !== undefined) {
      this.maxSpeed = Math.max(1, options.maxSpeed);
    }
  }

  /**
   * Generate training data for this model
   */
  generateTrainingData(
    scenarios: Array<{ agentCount: number; bounds: { width: number; height: number } }>,
    stepsPerScenario: number = 100
  ): Array<{ input: number[]; output: number[] }> {
    const trainingData: Array<{ input: number[]; output: number[] }> = [];

    for (const scenario of scenarios) {
      // This would ideally run actual simulations
      // For now, generate synthetic data based on flocking rules
      for (let step = 0; step < stepsPerScenario; step++) {
        const mockState = this.generateMockState(scenario);
        const action = this.predictWithRules(mockState);
        
        const input = this.encodeFlockingState(mockState).dataSync() as Float32Array;
        const output = [
          action.parameters.dx / this.maxSpeed,
          action.parameters.dy / this.maxSpeed,
          Math.sqrt(action.parameters.dx ** 2 + action.parameters.dy ** 2) / this.maxSpeed
        ];

        trainingData.push({
          input: Array.from(input),
          output
        });
      }
    }

    return trainingData;
  }

  /**
   * Generate mock agent state for training data
   */
  private generateMockState(scenario: { agentCount: number; bounds: { width: number; height: number } }): MLAgentState {
    const position: Position = {
      x: Math.random() * scenario.bounds.width,
      y: Math.random() * scenario.bounds.height
    } as Position;

    // Generate mock neighbors
    const neighborCount = Math.floor(Math.random() * Math.min(10, scenario.agentCount - 1));
    const neighbors = Array.from({ length: neighborCount }, () => ({
      id: Math.random().toString(),
      position: {
        x: position.x + (Math.random() - 0.5) * 200,
        y: position.y + (Math.random() - 0.5) * 200
      } as Position,
      getProperty: (_key: string) => Math.random() * 10 - 5 // Mock velocity
    }));

    return {
      position,
      properties: {
        velocityX: Math.random() * 10 - 5,
        velocityY: Math.random() * 10 - 5,
        energy: 50 + Math.random() * 50
      },
      environment: {
        bounds: scenario.bounds,
        currentStep: Math.floor(Math.random() * 1000),
        localDensity: neighborCount
      },
      neighbors: neighbors as any[]
    };
  }
}