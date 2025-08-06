import { Agent } from '../core/agents/Agent';
import { Simulation } from '../core/Simulation';
import { TrainingDataset, MLAgentState, AgentAction } from './interfaces';

/**
 * Generic data collector for ML training datasets
 */
export class GenericDataCollector {
  private collectedData: TrainingDataset['stateActionPairs'] = [];
  private isCollecting = false;
  private scenarioMetadata: TrainingDataset['metadata'] | null = null;
  private collectionStartTime = 0;
  // private episodeCount = 0; // Reserved for future use

  /**
   * Start collecting training data from a simulation
   * @param simulation Simulation to collect from
   * @param scenarioType Type of scenario being collected
   * @param episodes Number of episodes to collect
   */
  startCollection(
    _simulation: Simulation, 
    scenarioType: string, 
    episodes: number = 100
  ): void {
    if (this.isCollecting) {
      console.warn('Data collection already in progress');
      return;
    }

    this.isCollecting = true;
    this.collectedData = [];
    // this.episodeCount = episodes; // Reserved for future use
    this.collectionStartTime = Date.now();
    this.scenarioMetadata = {
      scenarioType,
      agentCount: 0, // Will be updated during collection
      episodeLength: 0, // Will be calculated
      collectionTimestamp: this.collectionStartTime
    };

    console.log(`Started data collection for scenario: ${scenarioType}`);
    console.log(`Target episodes: ${episodes}`);
  }

  /**
   * Stop data collection
   */
  stopCollection(): void {
    if (!this.isCollecting) {
      console.warn('No data collection in progress');
      return;
    }

    this.isCollecting = false;
    
    if (this.scenarioMetadata) {
      this.scenarioMetadata.episodeLength = 
        Math.floor((Date.now() - this.collectionStartTime) / 1000);
    }

    console.log('Data collection stopped');
    console.log(`Collected ${this.collectedData.length} state-action pairs`);
  }

  /**
   * Record a single step of the simulation
   * @param simulation Current simulation state
   * @param stepNumber Current step number
   */
  recordStep(simulation: Simulation, _stepNumber: number): void {
    if (!this.isCollecting) return;

    const agents = simulation.getAgentManager().getAllAgents();
    
    // Update agent count in metadata
    if (this.scenarioMetadata && agents.length > this.scenarioMetadata.agentCount) {
      this.scenarioMetadata.agentCount = agents.length;
    }

    // Collect state-action pairs for each agent
    for (const agent of agents) {
      try {
        const stateActionPair = this.extractStateActionPair(agent, _stepNumber);
        if (stateActionPair) {
          this.collectedData.push(stateActionPair);
        }
      } catch (error) {
        console.warn(`Failed to extract data for agent ${agent.id}:`, error);
      }
    }
  }

  /**
   * Extract state-action pair from an agent
   */
  private extractStateActionPair(agent: Agent, _stepNumber: number): TrainingDataset['stateActionPairs'][0] | null {
    try {
      // Get current state
      const state = this.captureAgentState(agent);
      
      // Get recent action (if available)
      const action = this.inferAgentAction(agent);
      
      // Calculate reward (generic approach)
      const reward = this.calculateGenericReward(agent, state);

      return {
        state,
        action,
        reward,
        // nextState will be filled in subsequent calls
      };
    } catch (error) {
      console.warn(`Failed to extract state-action pair:`, error);
      return null;
    }
  }

  /**
   * Capture current agent state
   */
  private captureAgentState(agent: Agent): MLAgentState {
    // Get neighboring agents
    const neighbors = this.getAgentNeighbors(agent);
    
    // Build environment context
    const environmentContext = {
      bounds: { width: 1000, height: 1000 }, // Default bounds
      currentStep: (agent.getProperty('step') as number) || 0,
      localDensity: neighbors.length,
      boundaryDistances: { north: 500, south: 500, east: 500, west: 500 }
    };

    // Convert properties to Record<string, number>
    const properties: Record<string, number> = {};
    const allProps = agent.getAllProperties();
    for (const [key, value] of Object.entries(allProps)) {
      if (typeof value === 'number') {
        properties[key] = value;
      }
    }

    return {
      position: agent.position,
      properties,
      environment: environmentContext,
      neighbors: neighbors.slice(0, 10) // Limit to 10 neighbors
    };
  }

  /**
   * Infer agent action from property changes
   */
  private inferAgentAction(agent: Agent): AgentAction {
    // Simple action inference based on property changes
    // In a real implementation, this would track actual actions
    
    const recentMovement = this.estimateMovement(agent);
    const recentInteraction = this.estimateInteraction(agent);

    if (recentInteraction.occurred) {
      return {
        type: 'INTERACT',
        parameters: {
          targetType: recentInteraction.type,
          intensity: recentInteraction.intensity
        },
        confidence: 0.7
      };
    } else if (recentMovement.occurred) {
      return {
        type: 'MOVE',
        parameters: {
          dx: recentMovement.dx,
          dy: recentMovement.dy
        },
        confidence: 0.8
      };
    } else {
      // Check for property changes
      return {
        type: 'CHANGE_PROPERTY',
        parameters: {
          property: 'energy',
          delta: (Math.random() - 0.5) * 2 // Random small change
        },
        confidence: 0.3
      };
    }
  }

  /**
   * Estimate movement from agent state
   */
  private estimateMovement(agent: Agent): { occurred: boolean; dx: number; dy: number } {
    // This would ideally track position history
    // For now, generate plausible movement
    const velocity = (agent.getProperty('velocity') as number) || 0;
    const direction = (agent.getProperty('direction') as number) || 0;
    
    if (velocity > 0) {
      return {
        occurred: true,
        dx: Math.cos(direction) * velocity,
        dy: Math.sin(direction) * velocity
      };
    }

    return { occurred: false, dx: 0, dy: 0 };
  }

  /**
   * Estimate interaction from agent state
   */
  private estimateInteraction(agent: Agent): { occurred: boolean; type: string; intensity: number } {
    const socialEnergy = (agent.getProperty('socialEnergy') as number) || 50;
    const neighbors = this.getAgentNeighbors(agent);
    
    if (neighbors.length > 0 && socialEnergy > 70) {
      return {
        occurred: true,
        type: 'social',
        intensity: socialEnergy / 100
      };
    }

    return { occurred: false, type: '', intensity: 0 };
  }

  /**
   * Calculate generic reward signal
   */
  private calculateGenericReward(agent: Agent, state: MLAgentState): number {
    let reward = 0;

    // Survival reward
    const health = (agent.getProperty('health') as number) || 50;
    reward += (health - 50) / 50; // Normalize to [-1, 1]

    // Social reward
    const neighborCount = state.neighbors.length;
    reward += Math.min(neighborCount / 5, 1); // Reward for having neighbors

    // Movement efficiency reward
    const energy = (agent.getProperty('energy') as number) || 50;
    if (energy > 30) {
      reward += 0.1; // Small reward for maintaining energy
    }

    // Boundary avoidance reward
    const bounds = state.environment.bounds || { width: 1000, height: 1000 };
    const distanceFromEdge = Math.min(
      state.position.x,
      state.position.y,
      bounds.width - state.position.x,
      bounds.height - state.position.y
    );
    
    if (distanceFromEdge > 50) {
      reward += 0.05; // Small reward for staying away from edges
    }

    return Math.max(-1, Math.min(1, reward)); // Clamp to [-1, 1]
  }

  /**
   * Get neighboring agents
   */
  private getAgentNeighbors(_agent: Agent): Agent[] {
    // In a real implementation, this would get neighbors from the environment
    // For now, return empty array as agents don't have direct environment access
    return [];
  }

  /**
   * Export collected data as training dataset
   */
  exportData(): TrainingDataset {
    if (!this.scenarioMetadata) {
      throw new Error('No data collection metadata available');
    }

    return {
      stateActionPairs: [...this.collectedData],
      metadata: { ...this.scenarioMetadata }
    };
  }

  /**
   * Export data in specific format
   * @param format Export format
   * @returns Formatted data string
   */
  exportForTraining(format: 'tensorflow' | 'pytorch' | 'csv'): string {
    const dataset = this.exportData();

    switch (format) {
      case 'csv':
        return this.exportToCSV(dataset);
      case 'tensorflow':
        return this.exportToTensorFlow(dataset);
      case 'pytorch':
        return this.exportToPyTorch(dataset);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(dataset: TrainingDataset): string {
    const headers = [
      'pos_x', 'pos_y', 'energy', 'health', 'autonomy', 'neighbors_count',
      'action_type', 'action_dx', 'action_dy', 'reward'
    ];

    const rows = [headers.join(',')];

    for (const pair of dataset.stateActionPairs) {
      const row = [
        pair.state.position.x,
        pair.state.position.y,
        pair.state.properties.energy || 0,
        pair.state.properties.health || 0,
        pair.state.properties.autonomy || 0,
        pair.state.neighbors.length,
        pair.action.type,
        pair.action.parameters.dx || 0,
        pair.action.parameters.dy || 0,
        pair.reward || 0
      ];
      rows.push(row.join(','));
    }

    return rows.join('\n');
  }

  /**
   * Export to TensorFlow format (JSON)
   */
  private exportToTensorFlow(dataset: TrainingDataset): string {
    const features: number[][] = [];
    const labels: number[][] = [];

    for (const pair of dataset.stateActionPairs) {
      // Create feature vector
      const feature = [
        pair.state.position.x / 1000, // Normalize
        pair.state.position.y / 1000,
        (pair.state.properties.energy || 0) / 100,
        (pair.state.properties.health || 0) / 100,
        (pair.state.properties.autonomy || 0) / 100,
        Math.min(pair.state.neighbors.length / 10, 1) // Normalize neighbor count
      ];

      // Create label vector (action + reward)
      const label = [
        pair.action.parameters.dx || 0,
        pair.action.parameters.dy || 0,
        pair.reward || 0
      ];

      features.push(feature);
      labels.push(label);
    }

    return JSON.stringify({
      features,
      labels,
      metadata: dataset.metadata
    }, null, 2);
  }

  /**
   * Export to PyTorch format (JSON)
   */
  private exportToPyTorch(dataset: TrainingDataset): string {
    // Similar to TensorFlow format but with PyTorch conventions
    const data = JSON.parse(this.exportToTensorFlow(dataset));
    
    return JSON.stringify({
      inputs: data.features,
      targets: data.labels,
      metadata: data.metadata
    }, null, 2);
  }

  /**
   * Get collection statistics
   */
  getCollectionStats(): {
    isCollecting: boolean;
    dataPointsCollected: number;
    collectionDuration: number;
    averageDataPointsPerSecond: number;
    metadata: TrainingDataset['metadata'] | null;
  } {
    const duration = this.isCollecting 
      ? (Date.now() - this.collectionStartTime) / 1000
      : (this.scenarioMetadata?.episodeLength || 0);

    return {
      isCollecting: this.isCollecting,
      dataPointsCollected: this.collectedData.length,
      collectionDuration: duration,
      averageDataPointsPerSecond: duration > 0 ? this.collectedData.length / duration : 0,
      metadata: this.scenarioMetadata
    };
  }

  /**
   * Clear collected data
   */
  clearData(): void {
    this.collectedData = [];
    this.scenarioMetadata = null;
    this.isCollecting = false;
    console.log('Training data cleared');
  }

  /**
   * Save data to file (browser download)
   */
  saveToFile(filename: string, format: 'tensorflow' | 'pytorch' | 'csv' = 'csv'): void {
    try {
      const data = this.exportForTraining(format);
      const blob = new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
      console.log(`Training data saved to ${filename}`);
    } catch (error) {
      console.error('Failed to save training data:', error);
    }
  }
}