import * as tf from '@tensorflow/tfjs';
import { Position } from '../types/core';
import { Agent } from '../core/agents/Agent';
import { MLAgentState, EnvironmentContext } from './interfaces';

/**
 * Utilities for encoding agent states into vectors for ML models
 */
export class StateEncoder {
  private static readonly MAX_NEIGHBORS = 10;
  private static readonly PROPERTY_KEYS = ['autonomy', 'resources', 'trust', 'energy', 'health'];
  
  /**
   * Encode complete agent state into a fixed-size vector
   * @param state Agent state to encode
   * @returns Tensorflow tensor representing the state
   */
  static encodeState(state: MLAgentState): tf.Tensor {
    const components = [
      this.encodePosition(state.position),
      this.encodeProperties(state.properties),
      this.encodeEnvironment(state.environment),
      this.encodeNeighbors(state.neighbors)
    ];
    
    const flattened = components.flat();
    return tf.tensor1d(flattened);
  }
  
  /**
   * Encode position into normalized coordinates
   * @param pos Position to encode
   * @returns Array of normalized x, y coordinates
   */
  static encodePosition(pos: Position): number[] {
    // Normalize to [0, 1] range assuming 1000x1000 default bounds
    const normalizedX = Math.max(0, Math.min(1, pos.x / 1000));
    const normalizedY = Math.max(0, Math.min(1, pos.y / 1000));
    return [normalizedX, normalizedY];
  }
  
  /**
   * Encode agent properties into fixed-size vector
   * @param props Agent properties map
   * @returns Array of property values, normalized to [0, 1]
   */
  static encodeProperties(props: Record<string, number>): number[] {
    return this.PROPERTY_KEYS.map(key => {
      const value = props[key] || 0;
      // Normalize assuming properties are in [0, 100] range
      return Math.max(0, Math.min(1, value / 100));
    });
  }
  
  /**
   * Encode environmental context
   * @param env Environment context
   * @returns Array of environmental features
   */
  static encodeEnvironment(env: EnvironmentContext): number[] {
    const features: number[] = [];
    
    // Environment bounds (normalized)
    if (env.bounds) {
      features.push(env.bounds.width / 1000, env.bounds.height / 1000);
    } else {
      features.push(1, 1); // Default normalized bounds
    }
    
    // Local density (normalized to [0, 1])
    features.push(Math.max(0, Math.min(1, (env.localDensity || 0) / 50)));
    
    // Boundary distances (normalized)
    if (env.boundaryDistances) {
      const maxDistance = 500; // Assume max reasonable distance
      features.push(
        Math.max(0, Math.min(1, env.boundaryDistances.north / maxDistance)),
        Math.max(0, Math.min(1, env.boundaryDistances.south / maxDistance)),
        Math.max(0, Math.min(1, env.boundaryDistances.east / maxDistance)),
        Math.max(0, Math.min(1, env.boundaryDistances.west / maxDistance))
      );
    } else {
      features.push(0.5, 0.5, 0.5, 0.5); // Default middle distances
    }
    
    // Current step (normalized by assuming max 1000 steps)
    features.push(Math.max(0, Math.min(1, (env.currentStep || 0) / 1000)));
    
    return features;
  }
  
  /**
   * Encode neighboring agents into fixed-size representation
   * @param neighbors Array of neighboring agents
   * @returns Fixed-size array representing neighbor information
   */
  static encodeNeighbors(neighbors: Agent[]): number[] {
    const features: number[] = [];
    const maxNeighbors = this.MAX_NEIGHBORS;
    
    // Neighbor count (normalized)
    features.push(Math.max(0, Math.min(1, neighbors.length / maxNeighbors)));
    
    // For each potential neighbor slot
    for (let i = 0; i < maxNeighbors; i++) {
      if (i < neighbors.length) {
        const neighbor = neighbors[i];
        
        // Relative position (normalized to [-1, 1])
        const relPos = this.encodeRelativePosition(neighbor!.position);
        features.push(...relPos);
        
        // Neighbor properties (normalized)
        const neighborProps = this.encodeProperties(neighbor!.getAllProperties() as Record<string, number>);
        features.push(...neighborProps);
        
        // Distance (normalized, assuming max distance of 100)
        const distance = Math.sqrt(
          Math.pow(neighbor!.position.x, 2) + Math.pow(neighbor!.position.y, 2)
        );
        features.push(Math.max(0, Math.min(1, distance / 100)));
      } else {
        // Padding for empty neighbor slots
        // 2 (relative position) + 5 (properties) + 1 (distance) = 8 values per neighbor
        features.push(...new Array(8).fill(0));
      }
    }
    
    return features;
  }
  
  /**
   * Encode relative position between agents
   * @param neighborPos Position of the neighbor
   * @param referencePos Reference position (default origin)
   * @returns Normalized relative position [-1, 1]
   */
  static encodeRelativePosition(
    neighborPos: Position, 
    referencePos: Position = { x: 0, y: 0 } as Position
  ): number[] {
    const dx = neighborPos.x - referencePos.x;
    const dy = neighborPos.y - referencePos.y;
    
    // Normalize to [-1, 1] assuming max reasonable distance of 200
    const maxDistance = 200;
    return [
      Math.max(-1, Math.min(1, dx / maxDistance)),
      Math.max(-1, Math.min(1, dy / maxDistance))
    ];
  }
  
  /**
   * Calculate the total size of the encoded state vector
   * @returns Number of features in encoded state
   */
  static getStateVectorSize(): number {
    const positionSize = 2; // x, y
    const propertiesSize = this.PROPERTY_KEYS.length; // 5 properties
    const environmentSize = 8; // bounds(2) + density(1) + boundaries(4) + step(1)
    const neighborsSize = 1 + (this.MAX_NEIGHBORS * 8); // count + (pos(2) + props(5) + dist(1)) * max_neighbors
    
    return positionSize + propertiesSize + environmentSize + neighborsSize;
  }
  
  /**
   * Decode action tensor back to AgentAction interface
   * @param actionTensor Output tensor from ML model
   * @returns Decoded agent action
   */
  static decodeAction(actionTensor: tf.Tensor): any {
    const values = actionTensor.dataSync() as Float32Array;
    
    // Simple decoding - can be extended for more complex action spaces
    if (values.length >= 3) {
      // Interpret as movement action
      const dx = (values[0]! - 0.5) * 20; // Scale to [-10, 10]
      const dy = (values[1]! - 0.5) * 20; // Scale to [-10, 10]
      const interact = values[2]! > 0.5; // Threshold for interaction
      
      if (interact && values.length > 3) {
        return {
          type: 'INTERACT' as const,
          parameters: {
            targetType: values[3]! > 0.5 ? 'help' : 'resource',
            intensity: Math.max(0, Math.min(1, values[4] || 0.5))
          },
          confidence: Math.max(...values)
        };
      } else {
        return {
          type: 'MOVE' as const,
          parameters: { dx, dy },
          confidence: Math.max(values[0]!, values[1]!)
        };
      }
    }
    
    // Default action if decoding fails
    return {
      type: 'MOVE' as const,
      parameters: { dx: 0, dy: 0 },
      confidence: 0
    };
  }
  
  /**
   * Create a batch of state encodings for efficient processing
   * @param states Array of agent states
   * @returns Batched tensor for all states
   */
  static encodeBatch(states: MLAgentState[]): tf.Tensor {
    const encodedStates = states.map(state => this.encodeState(state));
    const stacked = tf.stack(encodedStates);
    
    // Clean up individual tensors
    encodedStates.forEach(tensor => tensor.dispose());
    
    return stacked;
  }
  
  /**
   * Validate that state contains required fields for encoding
   * @param state State to validate
   * @returns True if state is valid for encoding
   */
  static validateState(state: MLAgentState): boolean {
    return !!(
      state.position &&
      typeof state.position.x === 'number' &&
      typeof state.position.y === 'number' &&
      state.properties &&
      typeof state.properties === 'object' &&
      state.environment &&
      Array.isArray(state.neighbors)
    );
  }
}