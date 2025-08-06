import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, MLAgentState, AgentAction } from '../interfaces';
import type { Position } from '../../types/core';

/**
 * Generic network formation ML model for social connections
 * Works for friendship networks, collaboration networks, or any social structure
 */
export class NetworkFormationModel implements MLBehaviorModel {
  private model?: tf.LayersModel;
  private inputFeatures: string[];
  private outputActions: string[];
  private isLoaded = false;
  private homophilyStrength = 0.7; // Tendency to connect with similar agents
  private proximityWeight = 0.5;   // Importance of geographic proximity
  private popularityBias = 0.3;    // Tendency to connect with popular agents

  constructor() {
    this.inputFeatures = [
      'similarity_score', 'geographic_distance', 'mutual_connections',
      'target_popularity', 'target_activity_level', 'connection_capacity',
      'social_energy', 'trust_level', 'interaction_history'
    ];

    this.outputActions = [
      'connect_probability', 'disconnect_probability', 'strengthen_probability',
      'connection_type', 'interaction_intensity'
    ];
  }

  async predict(state: MLAgentState): Promise<AgentAction> {
    if (this.model && this.isLoaded) {
      return this.predictWithML(state);
    } else {
      // Fallback to rule-based network formation
      return this.predictWithRules(state);
    }
  }

  /**
   * ML-based prediction
   */
  private async predictWithML(state: MLAgentState): Promise<AgentAction> {
    try {
      // Find potential connection targets
      const candidates = this.findConnectionCandidates(state);
      if (candidates.length === 0) {
        return this.createNoActionResponse();
      }

      // Evaluate each candidate
      const bestCandidate = await this.evaluateCandidatesWithML(state, candidates);
      return this.createNetworkAction(bestCandidate, state);
    } catch (error) {
      console.warn('ML prediction failed, falling back to rules:', error);
      return this.predictWithRules(state);
    }
  }

  /**
   * Rule-based network formation prediction
   */
  private predictWithRules(state: MLAgentState): AgentAction {
    const myConnections = this.getCurrentConnections(state);
    const potentialTargets = this.findConnectionCandidates(state);
    
    if (potentialTargets.length === 0) {
      return this.createNoActionResponse();
    }

    // Evaluate each potential target
    const evaluations = potentialTargets.map(target => ({
      agent: target,
      score: this.evaluateConnectionCandidate(state, target, myConnections)
    }));

    // Sort by score and take the best
    evaluations.sort((a, b) => b.score.totalScore - a.score.totalScore);
    const bestCandidate = evaluations[0];

    // Decide on action based on score
    if (bestCandidate && bestCandidate.score.totalScore > 0.6) {
      return this.createConnectionAction(bestCandidate, state);
    } else if (bestCandidate && bestCandidate.score.totalScore < 0.2 && myConnections.length > 0) {
      return this.createDisconnectionAction(state, myConnections);
    } else {
      return this.createMaintenanceAction(state, myConnections);
    }
  }

  /**
   * Find potential agents to connect with
   */
  private findConnectionCandidates(state: MLAgentState): any[] {
    const neighbors = state.neighbors;
    const maxConnections = this.getMaxConnections(state);
    const currentConnections = this.getCurrentConnections(state);
    
    if (currentConnections.length >= maxConnections) {
      return []; // At capacity
    }

    // Filter out already connected agents
    const connectedIds = new Set(currentConnections.map(c => c.id));
    const candidates = neighbors.filter((n: any) => !connectedIds.has(n.id));
    
    // Limit to reasonable number for evaluation
    return candidates.slice(0, 10);
  }

  /**
   * Get current connections of the agent
   */
  private getCurrentConnections(state: MLAgentState): any[] {
    // In a real implementation, this would come from the network manager
    // For now, estimate from agent properties
    const connectionCount = state.properties.connectionCount || 0;
    const connections = state.neighbors.slice(0, connectionCount);
    return connections;
  }

  /**
   * Get maximum number of connections this agent can maintain
   */
  private getMaxConnections(state: MLAgentState): number {
    const socialCapacity = state.properties.socialCapacity || 10;
    const socialEnergy = state.properties.socialEnergy || 50;
    
    // Dynamic capacity based on energy
    return Math.floor(socialCapacity * (socialEnergy / 100));
  }

  /**
   * Evaluate a potential connection candidate
   */
  private evaluateConnectionCandidate(
    state: MLAgentState, 
    candidate: any, 
    myConnections: any[]
  ): {
    similarity: number;
    proximity: number;
    mutualConnections: number;
    popularity: number;
    totalScore: number;
  } {
    // Calculate similarity
    const similarity = this.calculateSimilarity(state, candidate);
    
    // Calculate proximity
    const distance = Math.sqrt(
      (state.position.x - candidate.position.x) ** 2 +
      (state.position.y - candidate.position.y) ** 2
    );
    const maxDistance = 200; // Maximum meaningful distance
    const proximity = Math.max(0, 1 - distance / maxDistance);
    
    // Calculate mutual connections
    const candidateConnections = this.getCurrentConnections({
      ...state,
      neighbors: [candidate] as any[]
    });
    const mutualCount = this.countMutualConnections(myConnections, candidateConnections);
    const mutualConnections = Math.min(mutualCount / 5, 1); // Normalize
    
    // Calculate popularity (how many connections the candidate has)
    const candidateConnectionCount = candidate.getProperty?.('connectionCount') || 0;
    const popularity = Math.min(candidateConnectionCount / 20, 1); // Normalize
    
    // Combine scores
    const totalScore = 
      similarity * this.homophilyStrength +
      proximity * this.proximityWeight +
      mutualConnections * 0.4 +
      popularity * this.popularityBias;
    
    return {
      similarity,
      proximity,
      mutualConnections,
      popularity,
      totalScore: Math.min(totalScore, 1)
    };
  }

  /**
   * Calculate similarity between two agents
   */
  private calculateSimilarity(state: MLAgentState, candidate: any): number {
    const myProps = state.properties;
    const theirProps = {
      energy: candidate.getProperty?.('energy') || 50,
      resources: candidate.getProperty?.('resources') || 50,
      autonomy: candidate.getProperty?.('autonomy') || 50,
      trust: candidate.getProperty?.('trust') || 50
    };
    
    let similarity = 0;
    let count = 0;
    
    for (const [key, myValue] of Object.entries(myProps)) {
      const theirValue = theirProps[key as keyof typeof theirProps];
      if (typeof myValue === 'number' && typeof theirValue === 'number') {
        // Calculate normalized difference
        const diff = Math.abs(myValue - theirValue) / 100; // Assuming 0-100 range
        similarity += 1 - diff;
        count++;
      }
    }
    
    return count > 0 ? similarity / count : 0.5;
  }

  /**
   * Count mutual connections between two agents
   */
  private countMutualConnections(myConnections: any[], theirConnections: any[]): number {
    const myIds = new Set(myConnections.map(c => c.id));
    return theirConnections.filter(c => myIds.has(c.id)).length;
  }

  /**
   * Create connection action
   */
  private createConnectionAction(
    candidate: { agent: any; score: any }, 
    _state: MLAgentState
  ): AgentAction {
    const connectionType = this.determineConnectionType(candidate.score);
    const intensity = Math.min(candidate.score.totalScore + 0.2, 1);
    
    return {
      type: 'CUSTOM',
      parameters: {
        networkAction: 'connect',
        targetId: candidate.agent.id,
        connectionType,
        intensity,
        reason: 'similarity_proximity'
      },
      confidence: candidate.score.totalScore
    };
  }

  /**
   * Create disconnection action
   */
  private createDisconnectionAction(_state: MLAgentState, connections: any[]): AgentAction {
    if (connections.length === 0) {
      return this.createNoActionResponse();
    }

    // Find weakest connection to potentially remove
    const weakestConnection = connections.reduce((weakest, conn) => {
      const strength = conn.getProperty?.('connectionStrength') || 0.5;
      const weakestStrength = weakest.getProperty?.('connectionStrength') || 0.5;
      return strength < weakestStrength ? conn : weakest;
    });

    return {
      type: 'CUSTOM',
      parameters: {
        networkAction: 'disconnect',
        targetId: weakestConnection.id,
        reason: 'low_value'
      },
      confidence: 0.4
    };
  }

  /**
   * Create maintenance action for existing connections
   */
  private createMaintenanceAction(_state: MLAgentState, connections: any[]): AgentAction {
    if (connections.length === 0) {
      return this.createNoActionResponse();
    }

    // Choose a random connection to strengthen
    const targetConnection = connections[Math.floor(Math.random() * connections.length)];
    
    return {
      type: 'INTERACT',
      parameters: {
        targetType: 'social',
        targetId: targetConnection.id,
        intensity: 0.3 + Math.random() * 0.4
      },
      confidence: 0.6
    };
  }

  /**
   * Create no-action response
   */
  private createNoActionResponse(): AgentAction {
    return {
      type: 'CHANGE_PROPERTY',
      parameters: {
        property: 'socialEnergy',
        delta: 1 // Small recovery
      },
      confidence: 0.3
    };
  }

  /**
   * Determine type of connection to form
   */
  private determineConnectionType(score: any): string {
    if (score.similarity > 0.8) {
      return 'close_friend';
    } else if (score.proximity > 0.7) {
      return 'neighbor';
    } else if (score.mutualConnections > 0.5) {
      return 'mutual_friend';
    } else {
      return 'acquaintance';
    }
  }

  /**
   * Evaluate candidates using ML model
   */
  private async evaluateCandidatesWithML(state: MLAgentState, candidates: any[]): Promise<any> {
    const evaluations = await Promise.all(
      candidates.map(async candidate => {
        const inputTensor = this.encodeNetworkState(state, candidate);
        const prediction = this.model!.predict(inputTensor) as tf.Tensor;
        const score = (prediction.dataSync() as Float32Array)[0];
        
        inputTensor.dispose();
        prediction.dispose();
        
        return { agent: candidate, score: { totalScore: score } };
      })
    );

    return evaluations.reduce((best, current) => {
      const currentScore = current.score?.totalScore ?? 0;
      const bestScore = best.score?.totalScore ?? 0;
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Create network action from ML evaluation
   */
  private createNetworkAction(candidate: any, state: MLAgentState): AgentAction {
    if (candidate.score.totalScore > 0.7) {
      return this.createConnectionAction(candidate, state);
    } else {
      return this.createMaintenanceAction(state, this.getCurrentConnections(state));
    }
  }

  /**
   * Encode agent state and candidate for ML model
   */
  private encodeNetworkState(state: MLAgentState, candidate: any): tf.Tensor {
    const myConnections = this.getCurrentConnections(state);
    const evaluation = this.evaluateConnectionCandidate(state, candidate, myConnections);
    
    const mutualConnections = this.countMutualConnections(myConnections, [candidate]);
    const targetPopularity = Math.min((candidate.getProperty?.('connectionCount') || 0) / 20, 1);
    const targetActivity = Math.min((candidate.getProperty?.('activityLevel') || 50) / 100, 1);
    const connectionCapacity = Math.max(0, this.getMaxConnections(state) - myConnections.length) / 10;
    const socialEnergy = (state.properties.socialEnergy || 50) / 100;
    const trustLevel = (state.properties.trust || 50) / 100;
    const interactionHistory = Math.min((state.properties.interactionHistory || 0) / 100, 1);
    
    const features = [
      evaluation.similarity,      // Similarity score [0-1]
      1 - evaluation.proximity,   // Geographic distance (inverted) [0-1]
      mutualConnections / 5,      // Mutual connections [0-1]
      targetPopularity,           // Target popularity [0-1]
      targetActivity,             // Target activity level [0-1]
      connectionCapacity,         // Available connection capacity [0-1]
      socialEnergy,              // Social energy [0-1]
      trustLevel,                // Trust level [0-1]
      interactionHistory         // Interaction history [0-1]
    ];

    return tf.tensor2d([features]);
  }

  async load(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(modelPath);
      this.isLoaded = true;
      console.log('NetworkFormationModel loaded successfully');
    } catch (error) {
      console.warn('Failed to load NetworkFormationModel, using rule-based fallback:', error);
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
   * Configure network formation parameters
   */
  configure(options: {
    homophilyStrength?: number;
    proximityWeight?: number;
    popularityBias?: number;
  }): void {
    if (options.homophilyStrength !== undefined) {
      this.homophilyStrength = Math.max(0, Math.min(1, options.homophilyStrength));
    }
    if (options.proximityWeight !== undefined) {
      this.proximityWeight = Math.max(0, Math.min(1, options.proximityWeight));
    }
    if (options.popularityBias !== undefined) {
      this.popularityBias = Math.max(0, Math.min(1, options.popularityBias));
    }
  }

  /**
   * Generate training data for network formation model
   */
  generateTrainingData(
    scenarios: Array<{
      agentCount: number;
      networkDensity: 'sparse' | 'medium' | 'dense';
      homophilyLevel: 'low' | 'medium' | 'high';
    }>,
    stepsPerScenario: number = 150
  ): Array<{ input: number[]; output: number[] }> {
    const trainingData: Array<{ input: number[]; output: number[] }> = [];

    for (const scenario of scenarios) {
      for (let step = 0; step < stepsPerScenario; step++) {
        const { state, candidate } = this.generateMockNetworkState(scenario, step);
        const action = this.predictWithRules(state);
        
        const input = this.encodeNetworkState(state, candidate).dataSync() as Float32Array;
        
        // Convert action to output format
        let output: number[];
        if (action.parameters.networkAction === 'connect') {
          output = [0.8, 0.1, 0.6, 0.7, action.parameters.intensity || 0.5];
        } else if (action.parameters.networkAction === 'disconnect') {
          output = [0.1, 0.8, 0.2, 0.3, 0.2];
        } else {
          output = [0.3, 0.2, 0.8, 0.5, 0.4];
        }

        trainingData.push({
          input: Array.from(input),
          output
        });
      }
    }

    return trainingData;
  }

  /**
   * Generate mock network state for training
   */
  private generateMockNetworkState(
    scenario: {
      agentCount: number;
      networkDensity: string;
      homophilyLevel: string;
    },
    step: number
  ): { state: MLAgentState; candidate: any } {
    
    // Determine connection counts based on density
    let avgConnections: number;
    switch (scenario.networkDensity) {
      case 'sparse': avgConnections = 2; break;
      case 'medium': avgConnections = 5; break;
      case 'dense': avgConnections = 8; break;
      default: avgConnections = 5;
    }
    
    const myConnections = Math.floor(avgConnections * (0.5 + Math.random()));
    
    // Agent properties
    const socialEnergy = 30 + Math.random() * 40;
    const trust = 30 + Math.random() * 40;
    const autonomy = 30 + Math.random() * 40;
    
    // Create mock candidate
    const similarity = scenario.homophilyLevel === 'high' ? 0.7 + Math.random() * 0.3 :
                      scenario.homophilyLevel === 'medium' ? 0.4 + Math.random() * 0.4 :
                      Math.random() * 0.6;
    
    const candidate = {
      id: 'candidate_' + Math.random(),
      position: {
        x: Math.random() * 1000,
        y: Math.random() * 1000
      },
      getProperty: (key: string) => {
        switch (key) {
          case 'energy': return similarity * 70 + Math.random() * 30;
          case 'trust': return similarity * trust + Math.random() * 20;
          case 'autonomy': return similarity * autonomy + Math.random() * 20;
          case 'connectionCount': return Math.floor(avgConnections * (0.5 + Math.random()));
          case 'activityLevel': return 30 + Math.random() * 40;
          default: return Math.random() * 100;
        }
      }
    };

    const state: MLAgentState = {
      position: { x: Math.random() * 1000, y: Math.random() * 1000 } as Position,
      properties: {
        socialEnergy,
        trust,
        autonomy,
        connectionCount: myConnections,
        socialCapacity: 8 + Math.floor(Math.random() * 7),
        interactionHistory: Math.random() * 50
      },
      environment: {
        bounds: { width: 1000, height: 1000 },
        currentStep: step,
        localDensity: avgConnections
      },
      neighbors: [candidate] as any[]
    };

    return { state, candidate };
  }
}