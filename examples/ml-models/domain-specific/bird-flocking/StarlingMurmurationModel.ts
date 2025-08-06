/**
 * Starling Murmuration Model - Domain-specific ML model for starling flocking behavior
 * 
 * This model is trained specifically on starling murmuration data and captures
 * the unique characteristics of starling flocks including density waves, 
 * predator evasion patterns, and the famous "black sun" formations.
 * 
 * Based on research from:
 * - Cavagna et al. (2010) - Scale-free correlations in starling flocks
 * - Ballerini et al. (2008) - Interaction ruling animal collective behavior
 * - Reynolds (1987) - Flocks, herds and schools: A distributed behavioral model
 */

import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, AgentState, AgentAction } from '../../../../src/ml/interfaces';

export interface StarlingFlockingConfig {
  separationRadius: number;        // Distance for separation behavior (typical: 0.5-2m)
  alignmentRadius: number;         // Distance for alignment behavior (typical: 2-7m) 
  cohesionRadius: number;          // Distance for cohesion behavior (typical: 10-20m)
  maxSpeed: number;                // Maximum flight speed (typical: 10-20 m/s)
  maxAcceleration: number;         // Maximum acceleration (typical: 15-25 m/s²)
  predatorAvoidanceRadius: number; // Distance to avoid predators (typical: 50-100m)
  densityWaveStrength: number;     // Strength of density wave propagation (0-1)
  noiseLevel: number;              // Random noise in movement (0-0.1)
  topologicalNeighbors: number;    // Number of topological neighbors (typical: 6-7)
}

export interface FlockingEnvironment {
  predators?: Array<{
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    threatLevel: number; // 0-1
  }>;
  obstacles?: Array<{
    position: { x: number; y: number };
    radius: number;
  }>;
  windVelocity?: { x: number; y: number };
  terrainHeight?: number;
  lightLevel?: number; // 0-1, affects visibility
}

export class StarlingMurmurationModel implements MLBehaviorModel {
  private model?: tf.LayersModel;
  private config: StarlingFlockingConfig;
  private isLoaded: boolean = false;
  private predictionHistory: AgentAction[] = [];
  private readonly maxHistorySize = 10;

  constructor(config: Partial<StarlingFlockingConfig> = {}) {
    this.config = {
      separationRadius: 1.0,
      alignmentRadius: 4.0,
      cohesionRadius: 15.0,
      maxSpeed: 15.0,
      maxAcceleration: 20.0,
      predatorAvoidanceRadius: 75.0,
      densityWaveStrength: 0.8,
      noiseLevel: 0.05,
      topologicalNeighbors: 7,
      ...config
    };
  }

  async load(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(modelPath);
      this.isLoaded = true;
      console.log('Starling Murmuration Model loaded successfully');
    } catch (error) {
      console.error('Failed to load Starling Murmuration Model:', error);
      this.isLoaded = false;
      throw error;
    }
  }

  async predict(state: AgentState): Promise<AgentAction> {
    if (this.model && this.isLoaded) {
      try {
        const action = await this.predictWithML(state);
        this.addToHistory(action);
        return action;
      } catch (error) {
        console.warn('ML prediction failed, using biological rules:', error);
        return this.predictWithBiologicalRules(state);
      }
    } else {
      return this.predictWithBiologicalRules(state);
    }
  }

  private async predictWithML(state: AgentState): Promise<AgentAction> {
    if (!this.model) throw new Error('Model not loaded');

    const inputTensor = this.encodeStarlingState(state);
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const predictionData = await prediction.data();

    // Clean up tensors
    inputTensor.dispose();
    prediction.dispose();

    return this.decodeStarlingAction(predictionData, state);
  }

  private predictWithBiologicalRules(state: AgentState): AgentAction {
    // Implement research-based starling flocking rules
    const neighbors = this.getTopologicalNeighbors(state);
    const environment = state.environment as FlockingEnvironment;
    
    // Core flocking forces
    const separation = this.calculateSeparation(state, neighbors);
    const alignment = this.calculateAlignment(state, neighbors);
    const cohesion = this.calculateCohesion(state, neighbors);
    
    // Starling-specific behaviors
    const predatorAvoidance = this.calculatePredatorAvoidance(state, environment);
    const densityWave = this.calculateDensityWaveResponse(state, neighbors);
    
    // Environmental factors
    const windResponse = this.calculateWindResponse(state, environment);
    const obstacleAvoidance = this.calculateObstacleAvoidance(state, environment);
    
    // Combine forces with biologically-realistic weighting
    const totalForce = this.combineForces({
      separation,
      alignment,
      cohesion,
      predatorAvoidance,
      densityWave,
      windResponse,
      obstacleAvoidance
    });

    // Add noise for realistic behavior
    const noise = {
      x: (Math.random() - 0.5) * this.config.noiseLevel,
      y: (Math.random() - 0.5) * this.config.noiseLevel
    };

    return {
      type: 'FLOCK_MOVE',
      parameters: {
        acceleration: {
          x: totalForce.x + noise.x,
          y: totalForce.y + noise.y
        },
        behaviorWeights: {
          separation: 2.0,    // High priority for collision avoidance
          alignment: 1.0,     // Medium priority for group coordination
          cohesion: 0.5,      // Lower priority, starlings are less cohesive than other birds
          predatorAvoidance: 5.0, // Highest priority for survival
          densityWave: 1.5    // Important for murmuration dynamics
        },
        confidence: this.calculateConfidence(neighbors, environment)
      }
    };
  }

  private getTopologicalNeighbors(state: AgentState): any[] {
    // Starlings interact with topological neighbors (closest N birds) not metric neighbors
    const allNeighbors = state.neighbors || [];
    
    if (allNeighbors.length <= this.config.topologicalNeighbors) {
      return allNeighbors;
    }

    // Sort by distance and take closest N
    const distances = allNeighbors.map(neighbor => ({
      neighbor,
      distance: this.distance(state.position, neighbor.position)
    }));

    distances.sort((a, b) => a.distance - b.distance);
    return distances.slice(0, this.config.topologicalNeighbors).map(d => d.neighbor);
  }

  private calculateSeparation(state: AgentState, neighbors: any[]): { x: number; y: number } {
    let separationForce = { x: 0, y: 0 };
    let count = 0;

    neighbors.forEach(neighbor => {
      const distance = this.distance(state.position, neighbor.position);
      if (distance < this.config.separationRadius && distance > 0) {
        // Force proportional to 1/distance²
        const force = 1.0 / (distance * distance);
        const direction = {
          x: (state.position.x - neighbor.position.x) / distance,
          y: (state.position.y - neighbor.position.y) / distance
        };
        
        separationForce.x += direction.x * force;
        separationForce.y += direction.y * force;
        count++;
      }
    });

    if (count > 0) {
      separationForce.x /= count;
      separationForce.y /= count;
    }

    return separationForce;
  }

  private calculateAlignment(state: AgentState, neighbors: any[]): { x: number; y: number } {
    let avgVelocity = { x: 0, y: 0 };
    let count = 0;

    neighbors.forEach(neighbor => {
      const distance = this.distance(state.position, neighbor.position);
      if (distance < this.config.alignmentRadius) {
        avgVelocity.x += neighbor.velocity?.x || 0;
        avgVelocity.y += neighbor.velocity?.y || 0;
        count++;
      }
    });

    if (count > 0) {
      avgVelocity.x /= count;
      avgVelocity.y /= count;
      
      // Subtract current velocity to get alignment force
      const currentVel = state.properties.velocity || { x: 0, y: 0 };
      return {
        x: avgVelocity.x - currentVel.x,
        y: avgVelocity.y - currentVel.y
      };
    }

    return { x: 0, y: 0 };
  }

  private calculateCohesion(state: AgentState, neighbors: any[]): { x: number; y: number } {
    let centerOfMass = { x: 0, y: 0 };
    let count = 0;

    neighbors.forEach(neighbor => {
      const distance = this.distance(state.position, neighbor.position);
      if (distance < this.config.cohesionRadius) {
        centerOfMass.x += neighbor.position.x;
        centerOfMass.y += neighbor.position.y;
        count++;
      }
    });

    if (count > 0) {
      centerOfMass.x /= count;
      centerOfMass.y /= count;

      // Force toward center of mass
      return {
        x: centerOfMass.x - state.position.x,
        y: centerOfMass.y - state.position.y
      };
    }

    return { x: 0, y: 0 };
  }

  private calculatePredatorAvoidance(state: AgentState, environment?: FlockingEnvironment): { x: number; y: number } {
    if (!environment?.predators) return { x: 0, y: 0 };

    let avoidanceForce = { x: 0, y: 0 };

    environment.predators.forEach(predator => {
      const distance = this.distance(state.position, predator.position);
      if (distance < this.config.predatorAvoidanceRadius) {
        // Very strong force, inversely proportional to distance
        const force = (predator.threatLevel * 100) / (distance + 1);
        const direction = {
          x: (state.position.x - predator.position.x) / distance,
          y: (state.position.y - predator.position.y) / distance
        };

        avoidanceForce.x += direction.x * force;
        avoidanceForce.y += direction.y * force;
      }
    });

    return avoidanceForce;
  }

  private calculateDensityWaveResponse(state: AgentState, neighbors: any[]): { x: number; y: number } {
    // Starling murmurations exhibit density waves that propagate through the flock
    if (neighbors.length < 3) return { x: 0, y: 0 };

    // Calculate local density gradient
    const localDensity = neighbors.length / (Math.PI * this.config.alignmentRadius * this.config.alignmentRadius);
    
    // Find direction of density gradient
    let densityGradient = { x: 0, y: 0 };
    neighbors.forEach(neighbor => {
      const neighborDensity = (neighbor.neighbors?.length || 0) / (Math.PI * this.config.alignmentRadius * this.config.alignmentRadius);
      const densityDiff = neighborDensity - localDensity;
      const direction = {
        x: neighbor.position.x - state.position.x,
        y: neighbor.position.y - state.position.y
      };
      const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
      
      if (distance > 0) {
        densityGradient.x += (direction.x / distance) * densityDiff;
        densityGradient.y += (direction.y / distance) * densityDiff;
      }
    });

    return {
      x: densityGradient.x * this.config.densityWaveStrength,
      y: densityGradient.y * this.config.densityWaveStrength
    };
  }

  private calculateWindResponse(state: AgentState, environment?: FlockingEnvironment): { x: number; y: number } {
    if (!environment?.windVelocity) return { x: 0, y: 0 };
    
    // Starlings adjust their flight to wind conditions
    const windStrength = Math.sqrt(
      environment.windVelocity.x * environment.windVelocity.x + 
      environment.windVelocity.y * environment.windVelocity.y
    );
    
    if (windStrength > 5) { // Strong wind (>5 m/s)
      return {
        x: environment.windVelocity.x * 0.3,
        y: environment.windVelocity.y * 0.3
      };
    }

    return { x: 0, y: 0 };
  }

  private calculateObstacleAvoidance(state: AgentState, environment?: FlockingEnvironment): { x: number; y: number } {
    if (!environment?.obstacles) return { x: 0, y: 0 };

    let avoidanceForce = { x: 0, y: 0 };

    environment.obstacles.forEach(obstacle => {
      const distance = this.distance(state.position, obstacle.position);
      const minDistance = obstacle.radius + 5; // 5m safety margin

      if (distance < minDistance) {
        const force = (minDistance - distance) / minDistance;
        const direction = {
          x: (state.position.x - obstacle.position.x) / distance,
          y: (state.position.y - obstacle.position.y) / distance
        };

        avoidanceForce.x += direction.x * force * 10;
        avoidanceForce.y += direction.y * force * 10;
      }
    });

    return avoidanceForce;
  }

  private combineForces(forces: any): { x: number; y: number } {
    const combined = {
      x: forces.separation.x * 2.0 +
         forces.alignment.x * 1.0 +
         forces.cohesion.x * 0.5 +
         forces.predatorAvoidance.x * 5.0 +
         forces.densityWave.x * 1.5 +
         forces.windResponse.x * 0.3 +
         forces.obstacleAvoidance.x * 3.0,
      y: forces.separation.y * 2.0 +
         forces.alignment.y * 1.0 +
         forces.cohesion.y * 0.5 +
         forces.predatorAvoidance.y * 5.0 +
         forces.densityWave.y * 1.5 +
         forces.windResponse.y * 0.3 +
         forces.obstacleAvoidance.y * 3.0
    };

    // Limit acceleration
    const magnitude = Math.sqrt(combined.x * combined.x + combined.y * combined.y);
    if (magnitude > this.config.maxAcceleration) {
      combined.x = (combined.x / magnitude) * this.config.maxAcceleration;
      combined.y = (combined.y / magnitude) * this.config.maxAcceleration;
    }

    return combined;
  }

  private calculateConfidence(neighbors: any[], environment?: FlockingEnvironment): number {
    let confidence = 0.7; // Base confidence

    // Increase confidence with more neighbors (up to optimal flock size)
    const optimalFlockSize = 50;
    if (neighbors.length > 0 && neighbors.length <= optimalFlockSize) {
      confidence += (neighbors.length / optimalFlockSize) * 0.2;
    }

    // Decrease confidence with predator presence
    if (environment?.predators && environment.predators.length > 0) {
      const maxThreat = Math.max(...environment.predators.map(p => p.threatLevel));
      confidence -= maxThreat * 0.3;
    }

    // Decrease confidence in low light (starlings are diurnal)
    if (environment?.lightLevel !== undefined && environment.lightLevel < 0.3) {
      confidence -= (0.3 - environment.lightLevel) * 0.4;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  private encodeStarlingState(state: AgentState): tf.Tensor {
    // Encode state specifically for starling behavior prediction
    const neighbors = this.getTopologicalNeighbors(state);
    const environment = state.environment as FlockingEnvironment || {};
    
    const features = [
      // Position (normalized to local coordinate system)
      state.position.x / 1000,
      state.position.y / 1000,
      
      // Velocity
      (state.properties.velocity?.x || 0) / this.config.maxSpeed,
      (state.properties.velocity?.y || 0) / this.config.maxSpeed,
      
      // Neighbor information
      neighbors.length / 20, // Normalize by typical flock size
      this.calculateLocalDensity(state, neighbors),
      this.calculateAlignmentFactor(state, neighbors),
      
      // Environmental factors
      environment.lightLevel || 0.8,
      (environment.windVelocity?.x || 0) / 20,
      (environment.windVelocity?.y || 0) / 20,
      
      // Threat assessment
      this.calculateThreatLevel(state, environment),
      
      // Configuration parameters
      this.config.separationRadius / 10,
      this.config.alignmentRadius / 10,
      this.config.cohesionRadius / 50,
      this.config.densityWaveStrength
    ];

    return tf.tensor2d([features], [1, features.length]);
  }

  private decodeStarlingAction(prediction: Float32Array, state: AgentState): AgentAction {
    // Decode ML prediction to starling action
    // Expected output format: [accel_x, accel_y, turn_rate, speed_change, confidence]
    
    return {
      type: 'FLOCK_MOVE',
      parameters: {
        acceleration: {
          x: prediction[0] * this.config.maxAcceleration,
          y: prediction[1] * this.config.maxAcceleration
        },
        turnRate: prediction[2] * Math.PI, // Radians per step
        speedChange: prediction[3] * 5, // m/s change
        source: 'ml_prediction'
      },
      confidence: Math.min(Math.max(prediction[4], 0.1), 1.0)
    };
  }

  private calculateLocalDensity(state: AgentState, neighbors: any[]): number {
    if (neighbors.length === 0) return 0;
    
    const area = Math.PI * this.config.alignmentRadius * this.config.alignmentRadius;
    return neighbors.length / area;
  }

  private calculateAlignmentFactor(state: AgentState, neighbors: any[]): number {
    if (neighbors.length === 0) return 0;
    
    const currentVel = state.properties.velocity || { x: 0, y: 0 };
    let alignmentSum = 0;
    
    neighbors.forEach(neighbor => {
      const neighborVel = neighbor.velocity || { x: 0, y: 0 };
      const dot = currentVel.x * neighborVel.x + currentVel.y * neighborVel.y;
      const currentMag = Math.sqrt(currentVel.x ** 2 + currentVel.y ** 2);
      const neighborMag = Math.sqrt(neighborVel.x ** 2 + neighborVel.y ** 2);
      
      if (currentMag > 0 && neighborMag > 0) {
        alignmentSum += dot / (currentMag * neighborMag);
      }
    });
    
    return alignmentSum / neighbors.length;
  }

  private calculateThreatLevel(state: AgentState, environment: FlockingEnvironment): number {
    if (!environment.predators) return 0;
    
    let maxThreat = 0;
    environment.predators.forEach(predator => {
      const distance = this.distance(state.position, predator.position);
      const normalizedDistance = Math.min(distance / this.config.predatorAvoidanceRadius, 1);
      const threat = predator.threatLevel * (1 - normalizedDistance);
      maxThreat = Math.max(maxThreat, threat);
    });
    
    return maxThreat;
  }

  private distance(a: any, b: any): number {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private addToHistory(action: AgentAction): void {
    this.predictionHistory.push(action);
    if (this.predictionHistory.length > this.maxHistorySize) {
      this.predictionHistory.shift();
    }
  }

  getRequiredInputs(): string[] {
    return [
      'position.x', 'position.y',
      'properties.velocity.x', 'properties.velocity.y',
      'neighbors',
      'environment.lightLevel',
      'environment.windVelocity',
      'environment.predators'
    ];
  }

  getOutputActions(): string[] {
    return ['FLOCK_MOVE'];
  }

  configure(config: Partial<StarlingFlockingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getModelInfo(): any {
    return {
      name: 'Starling Murmuration Model',
      version: '2.1.0',
      type: 'domain-specific',
      domain: 'bird-flocking',
      species: 'Sturnus vulgaris',
      isLoaded: this.isLoaded,
      configuration: this.config,
      predictionHistory: this.predictionHistory.length
    };
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = undefined;
    }
    this.isLoaded = false;
    this.predictionHistory = [];
  }
}