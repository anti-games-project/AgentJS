/**
 * NetworkFormation - Dynamic network formation system
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../agents/Agent';
import type { Environment } from '../environment/Environment';
import type { AgentId } from '../../types/core';
import { NetworkManager, ConnectionType } from './NetworkManager';

/** Network formation strategy configuration */
export interface FormationConfig {
  readonly proximityRadius: number; // Max distance for proximity connections
  readonly similarityThreshold: number; // Min similarity for property-based connections
  readonly interactionMemory: number; // Number of interactions to remember
  readonly connectionProbability: {
    proximity: number;
    similarity: number;
    interaction: number;
  };
  readonly connectionTypeRules: {
    supportiveThreshold: number; // Positive interaction ratio for supportive
    exploitativeThreshold: number; // Negative interaction ratio for exploitative
  };
}

/** Interaction history entry */
interface InteractionHistory {
  readonly agentId: AgentId;
  readonly timestamp: number;
  readonly outcome: 'positive' | 'negative' | 'neutral';
  readonly strength: number;
}

/** Formation statistics */
export interface FormationStats {
  connectionsFormed: number;
  connectionsFailed: number;
  proximityTriggers: number;
  similarityTriggers: number;
  interactionTriggers: number;
}

/**
 * NetworkFormation - Manages dynamic network creation and evolution
 *
 * Features:
 * - Proximity-based connection formation
 * - Property similarity matching
 * - Interaction history tracking
 * - Dynamic connection type determination
 * - Connection lifecycle management
 *
 * Educational Context: Simulates how social networks
 * form naturally through physical proximity, shared
 * characteristics, and repeated interactions.
 */
export class NetworkFormation extends EventEmitter {
  /** Reference to network manager */
  private readonly network: NetworkManager;

  /** Formation configuration */
  private config: FormationConfig;

  /** Interaction history by agent */
  private readonly interactionHistory: Map<AgentId, InteractionHistory[]>;

  /** Properties to consider for similarity */
  private similarityProperties: string[];

  /** Formation statistics */
  private stats: FormationStats;

  constructor(network: NetworkManager, config: Partial<FormationConfig> = {}) {
    super();

    this.network = network;
    this.interactionHistory = new Map();
    this.similarityProperties = ['type', 'energy', 'information'];

    this.config = {
      proximityRadius: 5.0,
      similarityThreshold: 0.7,
      interactionMemory: 10,
      connectionProbability: {
        proximity: 0.3,
        similarity: 0.5,
        interaction: 0.7,
      },
      connectionTypeRules: {
        supportiveThreshold: 0.6,
        exploitativeThreshold: 0.3,
      },
      ...config,
    };

    this.stats = {
      connectionsFormed: 0,
      connectionsFailed: 0,
      proximityTriggers: 0,
      similarityTriggers: 0,
      interactionTriggers: 0,
    };
  }

  /**
   * Process network formation for all agents
   */
  processFormation(
    agentsMap: Map<AgentId, Agent>,
    environment: Environment
  ): void {
    const agentArray = Array.from(agentsMap.values());

    // Process each agent
    for (const agent of agentArray) {
      this.processAgentConnections(agent, agentsMap, environment);
    }

    // Apply connection decay
    this.network.applyDecay();

    // Clean old interaction history
    this.cleanInteractionHistory();
  }

  /**
   * Process connections for a single agent
   */
  private processAgentConnections(
    agent: Agent,
    agentsMap: Map<AgentId, Agent>,
    environment: Environment
  ): void {
    const position = environment.getAgentPosition(agent);
    if (!position) return;

    // Check proximity-based connections
    this.checkProximityConnections(agent, agentsMap, environment);

    // Check similarity-based connections
    this.checkSimilarityConnections(agent, agentsMap);

    // Process interaction-based connections
    this.processInteractionConnections(agent);
  }

  /**
   * Check for proximity-based connections
   */
  private checkProximityConnections(
    agent: Agent,
    _agents: Map<AgentId, Agent>,
    environment: Environment
  ): void {
    const position = environment.getAgentPosition(agent);
    if (!position) return;

    const nearbyAgents = environment.findNeighbors(
      position,
      this.config.proximityRadius,
      { filterFn: other => other.id !== agent.id }
    );

    for (const nearbyAgent of nearbyAgents.items) {
      // Skip if already connected
      if (this.network.hasConnection(agent.id, nearbyAgent.id)) {
        continue;
      }

      // Probabilistic connection formation
      if (Math.random() < this.config.connectionProbability.proximity) {
        this.stats.proximityTriggers++;

        const connectionType = this.determineConnectionType(agent, nearbyAgent);
        const connection = this.network.addConnection(
          agent.id,
          nearbyAgent.id,
          connectionType,
          0.3, // Initial weak connection
          { trigger: 'proximity' }
        );

        if (connection) {
          this.stats.connectionsFormed++;
          this.emit('connectionFormed', {
            connection,
            trigger: 'proximity',
            agents: { source: agent, target: nearbyAgent },
          });
        } else {
          this.stats.connectionsFailed++;
        }
      }
    }
  }

  /**
   * Check for similarity-based connections
   */
  private checkSimilarityConnections(
    agent: Agent,
    agentsMap: Map<AgentId, Agent>
  ): void {
    const candidates: Array<{ agent: Agent; similarity: number }> = [];

    for (const other of agentsMap.values()) {
      if (other.id === agent.id) continue;
      if (this.network.hasConnection(agent.id, other.id)) continue;

      const similarity = this.calculateSimilarity(agent, other);
      if (similarity >= this.config.similarityThreshold) {
        candidates.push({ agent: other, similarity });
      }
    }

    // Sort by similarity and consider top candidates
    candidates.sort((a, b) => b.similarity - a.similarity);

    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      const candidate = candidates[i]!;

      if (Math.random() < this.config.connectionProbability.similarity) {
        this.stats.similarityTriggers++;

        const connectionType = this.determineConnectionType(
          agent,
          candidate.agent
        );
        const connection = this.network.addConnection(
          agent.id,
          candidate.agent.id,
          connectionType,
          candidate.similarity * 0.5, // Weight based on similarity
          { trigger: 'similarity', similarity: candidate.similarity }
        );

        if (connection) {
          this.stats.connectionsFormed++;
          this.emit('connectionFormed', {
            connection,
            trigger: 'similarity',
            agents: { source: agent, target: candidate.agent },
          });
        } else {
          this.stats.connectionsFailed++;
        }
      }
    }
  }

  /**
   * Process interaction-based connections
   */
  private processInteractionConnections(agent: Agent): void {
    const history = this.interactionHistory.get(agent.id);
    if (!history || history.length === 0) return;

    // Group interactions by agent
    const interactionCounts = new Map<
      AgentId,
      {
        positive: number;
        negative: number;
        total: number;
        avgStrength: number;
      }
    >();

    for (const interaction of history) {
      const counts = interactionCounts.get(interaction.agentId) ?? {
        positive: 0,
        negative: 0,
        total: 0,
        avgStrength: 0,
      };

      counts.total++;
      if (interaction.outcome === 'positive') counts.positive++;
      if (interaction.outcome === 'negative') counts.negative++;
      counts.avgStrength =
        (counts.avgStrength * (counts.total - 1) + interaction.strength) /
        counts.total;

      interactionCounts.set(interaction.agentId, counts);
    }

    // Form connections based on interaction patterns
    for (const [targetId, counts] of interactionCounts) {
      if (this.network.hasConnection(agent.id, targetId)) {
        // Strengthen or weaken existing connection
        const positiveRatio = counts.positive / counts.total;
        if (positiveRatio > 0.5) {
          this.network.strengthenConnection(
            agent.id,
            targetId,
            0.1 * counts.avgStrength
          );
        } else {
          this.network.weakenConnection(
            agent.id,
            targetId,
            0.1 * counts.avgStrength
          );
        }
      } else if (counts.total >= 3) {
        // Form new connection after sufficient interactions
        if (Math.random() < this.config.connectionProbability.interaction) {
          this.stats.interactionTriggers++;

          const connectionType =
            this.determineConnectionTypeFromHistory(counts);
          const connection = this.network.addConnection(
            agent.id,
            targetId,
            connectionType,
            counts.avgStrength,
            {
              trigger: 'interaction',
              positiveRatio: counts.positive / counts.total,
              interactions: counts.total,
            }
          );

          if (connection) {
            this.stats.connectionsFormed++;
            this.emit('connectionFormed', {
              connection,
              trigger: 'interaction',
              interactionData: counts,
            });
          } else {
            this.stats.connectionsFailed++;
          }
        }
      }
    }
  }

  /**
   * Record an interaction between agents
   */
  recordInteraction(
    source: AgentId,
    target: AgentId,
    outcome: 'positive' | 'negative' | 'neutral',
    strength: number = 1.0
  ): void {
    // Record for source agent
    if (!this.interactionHistory.has(source)) {
      this.interactionHistory.set(source, []);
    }

    const sourceHistory = this.interactionHistory.get(source)!;
    sourceHistory.push({
      agentId: target,
      timestamp: Date.now(),
      outcome,
      strength: Math.max(0, Math.min(1, strength)),
    });

    // Keep only recent interactions
    if (sourceHistory.length > this.config.interactionMemory) {
      sourceHistory.shift();
    }

    // Also record reverse interaction for bidirectional tracking
    if (!this.interactionHistory.has(target)) {
      this.interactionHistory.set(target, []);
    }

    const targetHistory = this.interactionHistory.get(target)!;
    targetHistory.push({
      agentId: source,
      timestamp: Date.now(),
      outcome,
      strength: Math.max(0, Math.min(1, strength)),
    });

    if (targetHistory.length > this.config.interactionMemory) {
      targetHistory.shift();
    }

    this.emit('interactionRecorded', {
      source,
      target,
      outcome,
      strength,
    });
  }

  /**
   * Calculate similarity between two agents
   */
  private calculateSimilarity(agent1: Agent, agent2: Agent): number {
    let totalSimilarity = 0;
    let validProperties = 0;

    for (const prop of this.similarityProperties) {
      const value1 = agent1.getProperty(prop);
      const value2 = agent2.getProperty(prop);

      if (value1 !== undefined && value2 !== undefined) {
        validProperties++;

        if (typeof value1 === 'number' && typeof value2 === 'number') {
          // Numeric similarity (normalized)
          const max = Math.max(Math.abs(value1), Math.abs(value2));
          if (max > 0) {
            totalSimilarity += 1 - Math.abs(value1 - value2) / max;
          } else {
            totalSimilarity += 1;
          }
        } else if (value1 === value2) {
          // Exact match for non-numeric
          totalSimilarity += 1;
        }
      }
    }

    return validProperties > 0 ? totalSimilarity / validProperties : 0;
  }

  /**
   * Determine connection type based on agent properties
   */
  private determineConnectionType(
    source: Agent,
    target: Agent
  ): ConnectionType {
    // Check energy levels for potential exploitation
    const sourceEnergy = source.getProperty<number>('energy') ?? 50;
    const targetEnergy = target.getProperty<number>('energy') ?? 50;

    if (sourceEnergy < 30 && targetEnergy > 70) {
      return ConnectionType.EXPLOITATIVE;
    }

    // Check for economic potential
    const sourceWealth = source.getProperty<number>('wealth') ?? 0;
    const targetWealth = target.getProperty<number>('wealth') ?? 0;

    if (sourceWealth > 0 && targetWealth > 0) {
      return ConnectionType.ECONOMIC;
    }

    // Default to supportive
    return ConnectionType.SUPPORTIVE;
  }

  /**
   * Determine connection type from interaction history
   */
  private determineConnectionTypeFromHistory(counts: {
    positive: number;
    negative: number;
    total: number;
  }): ConnectionType {
    const positiveRatio = counts.positive / counts.total;

    if (positiveRatio >= this.config.connectionTypeRules.supportiveThreshold) {
      return ConnectionType.SUPPORTIVE;
    } else if (
      positiveRatio <= this.config.connectionTypeRules.exploitativeThreshold
    ) {
      return ConnectionType.EXPLOITATIVE;
    } else {
      return ConnectionType.ECONOMIC;
    }
  }

  /**
   * Clean old interaction history
   */
  private cleanInteractionHistory(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [agentId, history] of this.interactionHistory) {
      const filtered = history.filter(
        interaction => now - interaction.timestamp < maxAge
      );

      if (filtered.length === 0) {
        this.interactionHistory.delete(agentId);
      } else if (filtered.length < history.length) {
        this.interactionHistory.set(agentId, filtered);
      }
    }
  }

  /**
   * Set properties to consider for similarity
   */
  setSimilarityProperties(properties: string[]): void {
    this.similarityProperties = [...properties];
    this.emit('similarityPropertiesChanged', { properties });
  }

  /**
   * Get current statistics
   */
  getStats(): FormationStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      connectionsFormed: 0,
      connectionsFailed: 0,
      proximityTriggers: 0,
      similarityTriggers: 0,
      interactionTriggers: 0,
    };
  }

  /**
   * Get configuration
   */
  getConfig(): FormationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FormationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configurationChanged', { config: this.config });
  }

  /**
   * Clear all interaction history
   */
  clearHistory(): void {
    this.interactionHistory.clear();
    this.emit('historyCleared');
  }
}
