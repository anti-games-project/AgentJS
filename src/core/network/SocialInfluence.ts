/**
 * SocialInfluence - Social influence propagation system
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../agents/Agent';
import type { AgentId, PropertyValue } from '../../types/core';
import {
  NetworkManager,
  ConnectionType,
  NetworkConnection,
} from './NetworkManager';

/** Influence propagation configuration */
export interface InfluenceConfig {
  readonly propagationRate: number; // Base rate of influence spread
  readonly resistanceFactor: number; // Agent resistance to influence
  readonly connectionTypeWeights: {
    [ConnectionType.SUPPORTIVE]: number;
    [ConnectionType.EXPLOITATIVE]: number;
    [ConnectionType.ECONOMIC]: number;
  };
  readonly minInfluenceThreshold: number;
  readonly maxInfluenceDistance: number;
}

/** Influence event data */
export interface InfluenceEvent {
  readonly source: AgentId;
  readonly target: AgentId;
  readonly property: string;
  readonly oldValue: PropertyValue;
  readonly newValue: PropertyValue;
  readonly influenceStrength: number;
  readonly connectionType: ConnectionType;
}

/** Property influence rule */
export interface InfluenceRule {
  readonly property: string;
  readonly influenceType: 'average' | 'majority' | 'strongest' | 'custom';
  readonly customFunction?: (
    current: PropertyValue,
    influences: Array<{ value: PropertyValue; weight: number }>
  ) => PropertyValue;
  readonly resistance?: number; // Override default resistance
}

/**
 * SocialInfluence - Manages property propagation through social networks
 *
 * Features:
 * - Property value propagation through connections
 * - Different influence patterns based on connection type
 * - Configurable resistance to change
 * - Multiple influence aggregation methods
 * - Cascade detection and limits
 *
 * Educational Context: Models how ideas, behaviors, and
 * resources spread through social networks, enabling
 * simulation of opinion dynamics, resource distribution,
 * and social contagion phenomena.
 */
export class SocialInfluence extends EventEmitter {
  /** Reference to network manager */
  private readonly network: NetworkManager;

  /** Influence configuration */
  private config: InfluenceConfig;

  /** Registered influence rules by property */
  private readonly influenceRules: Map<string, InfluenceRule>;

  /** Track current influence cascade to prevent infinite loops */
  private currentCascade: Set<string>;

  /** Influence statistics */
  private stats: {
    totalPropagations: number;
    successfulInfluences: number;
    blockedByResistance: number;
    cascadesTriggered: number;
  };

  constructor(network: NetworkManager, config: Partial<InfluenceConfig> = {}) {
    super();

    this.network = network;
    this.influenceRules = new Map();
    this.currentCascade = new Set();

    this.config = {
      propagationRate: 0.5,
      resistanceFactor: 0.3,
      connectionTypeWeights: {
        [ConnectionType.SUPPORTIVE]: 1.0,
        [ConnectionType.EXPLOITATIVE]: -0.5,
        [ConnectionType.ECONOMIC]: 0.3,
      },
      minInfluenceThreshold: 0.1,
      maxInfluenceDistance: 3,
      ...config,
    };

    this.stats = {
      totalPropagations: 0,
      successfulInfluences: 0,
      blockedByResistance: 0,
      cascadesTriggered: 0,
    };
  }

  /**
   * Register an influence rule for a property
   */
  registerInfluenceRule(rule: InfluenceRule): void {
    this.influenceRules.set(rule.property, rule);
    this.emit('ruleRegistered', { rule });
  }

  /**
   * Remove influence rule
   */
  removeInfluenceRule(property: string): boolean {
    const removed = this.influenceRules.delete(property);
    if (removed) {
      this.emit('ruleRemoved', { property });
    }
    return removed;
  }

  /**
   * Propagate influence from one agent to its network
   */
  propagateInfluence(
    source: Agent,
    property: string,
    agents: Map<AgentId, Agent>
  ): number {
    // Prevent cascade loops
    const cascadeKey = `${source.id}-${property}`;
    if (this.currentCascade.has(cascadeKey)) {
      return 0;
    }

    this.currentCascade.add(cascadeKey);
    this.stats.totalPropagations++;

    const sourceValue = source.getProperty(property);
    if (sourceValue === undefined) {
      this.currentCascade.delete(cascadeKey);
      return 0;
    }

    const connections = this.network.getConnections(source.id);
    let influencedCount = 0;

    for (const connection of connections) {
      const target = agents.get(connection.target);
      if (!target) continue;

      const influenced = this.influenceAgent(
        source,
        target,
        property,
        sourceValue,
        connection
      );

      if (influenced) {
        influencedCount++;
        this.stats.successfulInfluences++;

        // Trigger cascade if configured
        if (this.shouldCascade(property)) {
          this.stats.cascadesTriggered++;
          influencedCount += this.propagateInfluence(target, property, agents);
        }
      }
    }

    this.currentCascade.delete(cascadeKey);
    return influencedCount;
  }

  /**
   * Propagate all registered properties through network
   */
  propagateAll(agents: Map<AgentId, Agent>): void {
    // Clear cascade tracking between full propagations
    this.currentCascade.clear();

    for (const [property] of this.influenceRules) {
      for (const agent of agents.values()) {
        this.propagateInfluence(agent, property, agents);
      }
    }
  }

  /**
   * Calculate aggregate influence on an agent
   */
  calculateAggregateInfluence(
    target: Agent,
    property: string,
    agents: Map<AgentId, Agent>
  ): PropertyValue | null {
    const rule = this.influenceRules.get(property);
    if (!rule) return null;

    const incomingConnections = this.network.getIncomingConnections(target.id);
    if (incomingConnections.length === 0) return null;

    const influences: Array<{ value: PropertyValue; weight: number }> = [];

    for (const connection of incomingConnections) {
      const source = agents.get(connection.source);
      if (!source) continue;

      const value = source.getProperty(property);
      if (value === undefined) continue;

      const weight = this.calculateInfluenceWeight(connection);
      if (weight > this.config.minInfluenceThreshold) {
        influences.push({ value, weight });
      }
    }

    if (influences.length === 0) return null;

    // Apply influence aggregation based on rule type
    const currentValue = target.getProperty(property);
    if (currentValue === undefined) return null;
    return this.aggregateInfluences(currentValue, influences, rule);
  }

  /**
   * Influence a single agent
   */
  private influenceAgent(
    source: Agent,
    target: Agent,
    property: string,
    sourceValue: PropertyValue,
    connection: NetworkConnection
  ): boolean {
    const rule = this.influenceRules.get(property);
    if (!rule) return false;

    const currentValue = target.getProperty(property);
    if (currentValue === undefined) return false;

    // Calculate influence weight
    const influenceWeight = this.calculateInfluenceWeight(connection);
    if (influenceWeight < this.config.minInfluenceThreshold) {
      return false;
    }

    // Check resistance
    const resistance = rule.resistance ?? this.config.resistanceFactor;
    if (Math.random() < resistance) {
      this.stats.blockedByResistance++;
      return false;
    }

    // Calculate new value based on influence
    const newValue = this.calculateInfluencedValue(
      currentValue,
      sourceValue,
      influenceWeight,
      rule
    );

    if (newValue !== currentValue) {
      target.setProperty(property, newValue);

      const event: InfluenceEvent = {
        source: source.id,
        target: target.id,
        property,
        oldValue: currentValue,
        newValue,
        influenceStrength: influenceWeight,
        connectionType: connection.type,
      };

      this.emit('agentInfluenced', event);
      return true;
    }

    return false;
  }

  /**
   * Calculate influence weight based on connection
   */
  private calculateInfluenceWeight(connection: NetworkConnection): number {
    const typeWeight = this.config.connectionTypeWeights[connection.type];
    const timeFactor = this.calculateTimeFactor(connection.lastInteraction);

    return Math.abs(
      connection.weight * typeWeight * this.config.propagationRate * timeFactor
    );
  }

  /**
   * Calculate time-based influence factor
   */
  private calculateTimeFactor(lastInteraction: number): number {
    const hoursSinceInteraction =
      (Date.now() - lastInteraction) / (1000 * 60 * 60);
    return Math.exp(-hoursSinceInteraction / 24); // Decay over 24 hours
  }

  /**
   * Calculate influenced value based on rule type
   */
  private calculateInfluencedValue(
    currentValue: PropertyValue,
    sourceValue: PropertyValue,
    weight: number,
    rule: InfluenceRule
  ): PropertyValue {
    // For simple numeric values
    if (typeof currentValue === 'number' && typeof sourceValue === 'number') {
      const difference = sourceValue - currentValue;
      return currentValue + difference * weight;
    }

    // For boolean values
    if (typeof currentValue === 'boolean' && typeof sourceValue === 'boolean') {
      return weight > 0.5 ? sourceValue : currentValue;
    }

    // For string values (categories)
    if (typeof currentValue === 'string' && typeof sourceValue === 'string') {
      return weight > 0.5 ? sourceValue : currentValue;
    }

    // Custom function if provided
    if (rule.customFunction) {
      return rule.customFunction(currentValue, [
        { value: sourceValue, weight },
      ]);
    }

    return currentValue;
  }

  /**
   * Aggregate multiple influences
   */
  private aggregateInfluences(
    currentValue: PropertyValue,
    influences: Array<{ value: PropertyValue; weight: number }>,
    rule: InfluenceRule
  ): PropertyValue {
    if (rule.customFunction) {
      return rule.customFunction(currentValue, influences);
    }

    switch (rule.influenceType) {
      case 'average':
        return this.averageInfluence(currentValue, influences);

      case 'majority':
        return this.majorityInfluence(currentValue, influences);

      case 'strongest':
        return this.strongestInfluence(currentValue, influences);

      default:
        return currentValue;
    }
  }

  /**
   * Average influence aggregation
   */
  private averageInfluence(
    current: PropertyValue,
    influences: Array<{ value: PropertyValue; weight: number }>
  ): PropertyValue {
    if (typeof current === 'number') {
      let sum = 0;
      let totalWeight = 0;

      for (const inf of influences) {
        if (typeof inf.value === 'number') {
          sum += inf.value * inf.weight;
          totalWeight += inf.weight;
        }
      }

      return totalWeight > 0 ? sum / totalWeight : current;
    }

    return this.strongestInfluence(current, influences);
  }

  /**
   * Majority vote influence
   */
  private majorityInfluence(
    current: PropertyValue,
    influences: Array<{ value: PropertyValue; weight: number }>
  ): PropertyValue {
    const votes = new Map<PropertyValue, number>();

    for (const inf of influences) {
      const currentVotes = votes.get(inf.value) ?? 0;
      votes.set(inf.value, currentVotes + inf.weight);
    }

    let maxVotes = 0;
    let winner = current;

    for (const [value, voteWeight] of votes) {
      if (voteWeight > maxVotes) {
        maxVotes = voteWeight;
        winner = value;
      }
    }

    return winner;
  }

  /**
   * Strongest influence wins
   */
  private strongestInfluence(
    current: PropertyValue,
    influences: Array<{ value: PropertyValue; weight: number }>
  ): PropertyValue {
    let maxWeight = 0;
    let strongestValue = current;

    for (const inf of influences) {
      if (inf.weight > maxWeight) {
        maxWeight = inf.weight;
        strongestValue = inf.value;
      }
    }

    return strongestValue;
  }

  /**
   * Check if property should cascade
   */
  private shouldCascade(property: string): boolean {
    const rule = this.influenceRules.get(property);
    return rule?.influenceType !== 'custom';
  }

  /**
   * Get influence statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalPropagations: 0,
      successfulInfluences: 0,
      blockedByResistance: 0,
      cascadesTriggered: 0,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): InfluenceConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InfluenceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configurationChanged', { config: this.config });
  }
}
