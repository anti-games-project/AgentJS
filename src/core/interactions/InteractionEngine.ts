/**
 * InteractionEngine - Manages agent-to-agent interactions
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../agents/Agent';
import type { Environment } from '../environment/Environment';
import type { AgentId, PropertyValue } from '../../types/core';
import type { InteractionEvent } from '../../types/events';

/** Interaction type definitions */
export interface InteractionType {
  readonly id: string;
  readonly name: string;
  readonly range: number;
  readonly canInitiate: (initiator: Agent, target: Agent) => boolean;
  readonly execute: (
    initiator: Agent,
    target: Agent,
    context: InteractionContext
  ) => InteractionResult;
  readonly priority: number;
}

/** Interaction context */
export interface InteractionContext {
  readonly environment: Environment;
  readonly distance: number;
  readonly timestamp: number;
  readonly metadata: Record<string, any>;
}

/** Interaction result */
export interface InteractionResult {
  readonly success: boolean;
  readonly effects: InteractionEffect[];
  readonly message?: string;
  readonly metadata: Record<string, any>;
}

/** Interaction effect */
export interface InteractionEffect {
  readonly targetAgent: Agent;
  readonly property: string;
  readonly oldValue: PropertyValue;
  readonly newValue: PropertyValue;
  readonly effectType: 'set' | 'add' | 'multiply' | 'min' | 'max';
}

/** Interaction configuration */
export interface InteractionConfig {
  readonly enableInteractions: boolean;
  readonly maxInteractionsPerStep: number;
  readonly interactionCooldown: number;
  readonly enableCollisionDetection: boolean;
  readonly collisionRadius: number;
}

/**
 * InteractionEngine - Manages all agent interactions
 *
 * Features:
 * - Proximity-based interaction detection
 * - Configurable interaction types
 * - Collision detection and resolution
 * - Interaction cooldowns and rate limiting
 * - Effect application with validation
 *
 * Educational Context: Facilitates communication,
 * resource exchange, and social dynamics between
 * community members in various scenarios.
 */
export class InteractionEngine extends EventEmitter {
  /** Registered interaction types */
  private interactionTypes: Map<string, InteractionType>;

  /** Agent interaction cooldowns */
  private interactionCooldowns: Map<AgentId, number>;

  /** Interaction configuration */
  private config: InteractionConfig;

  /** Interaction statistics */
  private stats: {
    totalInteractions: number;
    successfulInteractions: number;
    failedInteractions: number;
    lastStepInteractions: number;
  };

  constructor(config: Partial<InteractionConfig> = {}) {
    super();

    this.interactionTypes = new Map();
    this.interactionCooldowns = new Map();

    this.config = {
      enableInteractions: true,
      maxInteractionsPerStep: 1000,
      interactionCooldown: 100, // milliseconds
      enableCollisionDetection: true,
      collisionRadius: 1.0,
      ...config,
    };

    this.stats = {
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      lastStepInteractions: 0,
    };

    this.registerBuiltInInteractions();
  }

  /**
   * Register a new interaction type
   */
  registerInteraction(interaction: InteractionType): void {
    this.interactionTypes.set(interaction.id, interaction);
    this.emit('interactionRegistered', { interaction });
  }

  /**
   * Remove an interaction type
   */
  unregisterInteraction(interactionId: string): boolean {
    const removed = this.interactionTypes.delete(interactionId);
    if (removed) {
      this.emit('interactionUnregistered', { interactionId });
    }
    return removed;
  }

  /**
   * Process interactions for all agents in environment
   */
  processInteractions(environment: Environment): void {
    if (!this.config.enableInteractions) {
      return;
    }

    this.stats.lastStepInteractions = 0;
    const allAgents = environment.getAllAgents();
    const agents = [...allAgents]; // Create mutable copy
    const currentTime = Date.now();

    // Clear expired cooldowns
    this.clearExpiredCooldowns(currentTime);

    let interactionCount = 0;

    for (const initiator of agents) {
      if (!initiator.isActive()) continue;
      if (this.isOnCooldown(initiator.id, currentTime)) continue;

      // Find potential interaction targets
      const initiatorPosition = environment.getAgentPosition(initiator);
      if (!initiatorPosition) continue;

      const maxRange = this.getMaxInteractionRange();
      const nearbyAgents = environment.findNeighbors(
        initiatorPosition,
        maxRange,
        { filterFn: agent => agent !== initiator && agent.isActive() }
      );

      // Sort by priority and attempt interactions
      const potentialInteractions = this.findPotentialInteractions(
        initiator,
        [...nearbyAgents.items], // Create mutable copy
        environment
      );

      for (const interaction of potentialInteractions) {
        if (interactionCount >= this.config.maxInteractionsPerStep) {
          break;
        }

        const result = this.executeInteraction(interaction);

        if (result.success) {
          this.stats.successfulInteractions++;
          this.setCooldown(initiator.id, currentTime);
          interactionCount++;
        } else {
          this.stats.failedInteractions++;
        }

        this.stats.totalInteractions++;
        this.stats.lastStepInteractions++;
      }

      if (interactionCount >= this.config.maxInteractionsPerStep) {
        break;
      }
    }

    // Process collisions if enabled
    if (this.config.enableCollisionDetection) {
      this.processCollisions(environment);
    }
  }

  /**
   * Get interaction statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Get current configuration
   */
  getConfig(): InteractionConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<InteractionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get all registered interaction types
   */
  getInteractionTypes(): ReadonlyArray<InteractionType> {
    return Array.from(this.interactionTypes.values());
  }

  /**
   * Get interaction type by ID
   */
  getInteractionType(id: string): InteractionType | undefined {
    return this.interactionTypes.get(id);
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalInteractions: 0,
      successfulInteractions: 0,
      failedInteractions: 0,
      lastStepInteractions: 0,
    };
  }

  /**
   * Find potential interactions for an agent
   */
  private findPotentialInteractions(
    initiator: Agent,
    nearbyAgents: Agent[],
    environment: Environment
  ): Array<{
    type: InteractionType;
    initiator: Agent;
    target: Agent;
    context: InteractionContext;
  }> {
    const interactions: Array<{
      type: InteractionType;
      initiator: Agent;
      target: Agent;
      context: InteractionContext;
    }> = [];

    const initiatorPosition = environment.getAgentPosition(initiator);
    if (!initiatorPosition) return interactions;

    for (const target of nearbyAgents) {
      const targetPosition = environment.getAgentPosition(target);
      if (!targetPosition) continue;

      const distance = environment.distance(initiatorPosition, targetPosition);

      for (const interactionType of this.interactionTypes.values()) {
        if (
          distance <= interactionType.range &&
          interactionType.canInitiate(initiator, target)
        ) {
          const context: InteractionContext = {
            environment,
            distance,
            timestamp: Date.now(),
            metadata: {},
          };

          interactions.push({
            type: interactionType,
            initiator,
            target,
            context,
          });
        }
      }
    }

    // Sort by priority (higher priority first)
    interactions.sort((a, b) => b.type.priority - a.type.priority);

    return interactions;
  }

  /**
   * Execute a specific interaction
   */
  private executeInteraction(interaction: {
    type: InteractionType;
    initiator: Agent;
    target: Agent;
    context: InteractionContext;
  }): InteractionResult {
    try {
      const result = interaction.type.execute(
        interaction.initiator,
        interaction.target,
        interaction.context
      );

      // Apply effects
      if (result.success) {
        this.applyInteractionEffects(result.effects);
      }

      // Emit interaction event
      const event: InteractionEvent = {
        type: 'interaction',
        timestamp: Date.now(),
        initiator: interaction.initiator,
        target: interaction.target,
        interactionType: interaction.type.id,
        result: {
          success: result.success,
          message: result.message,
          ...result.metadata,
        },
      };

      this.emit('interaction', event);

      return result;
    } catch (error) {
      const failureResult: InteractionResult = {
        success: false,
        effects: [],
        message: `Interaction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata: {},
      };

      return failureResult;
    }
  }

  /**
   * Apply interaction effects to agents
   */
  private applyInteractionEffects(effects: InteractionEffect[]): void {
    for (const effect of effects) {
      this.applyEffect(effect);
    }
  }

  /**
   * Apply a single effect to an agent
   */
  private applyEffect(effect: InteractionEffect): void {
    const { targetAgent, property, newValue, effectType } = effect;

    try {
      switch (effectType) {
        case 'set':
          targetAgent.setProperty(property, newValue);
          break;

        case 'add':
          if (
            typeof effect.oldValue === 'number' &&
            typeof newValue === 'number'
          ) {
            targetAgent.setProperty(property, effect.oldValue + newValue);
          }
          break;

        case 'multiply':
          if (
            typeof effect.oldValue === 'number' &&
            typeof newValue === 'number'
          ) {
            targetAgent.setProperty(property, effect.oldValue * newValue);
          }
          break;

        case 'min':
          if (
            typeof effect.oldValue === 'number' &&
            typeof newValue === 'number'
          ) {
            targetAgent.setProperty(
              property,
              Math.min(effect.oldValue, newValue)
            );
          }
          break;

        case 'max':
          if (
            typeof effect.oldValue === 'number' &&
            typeof newValue === 'number'
          ) {
            targetAgent.setProperty(
              property,
              Math.max(effect.oldValue, newValue)
            );
          }
          break;
      }
    } catch (error) {
      console.warn(`Failed to apply interaction effect: ${error}`);
    }
  }

  /**
   * Process collision detection and resolution
   */
  private processCollisions(environment: Environment): void {
    const allAgents = environment.getAllAgents();
    const agents = [...allAgents].filter(agent => agent.isActive());

    for (let i = 0; i < agents.length; i++) {
      for (let j = i + 1; j < agents.length; j++) {
        const agent1 = agents[i];
        const agent2 = agents[j];
        if (!agent1 || !agent2) continue;

        const pos1 = environment.getAgentPosition(agent1);
        const pos2 = environment.getAgentPosition(agent2);

        if (!pos1 || !pos2) continue;

        const distance = environment.distance(pos1, pos2);

        if (distance < this.config.collisionRadius) {
          this.resolveCollision(agent1, agent2, environment);
        }
      }
    }
  }

  /**
   * Resolve collision between two agents
   */
  private resolveCollision(
    agent1: Agent,
    agent2: Agent,
    environment: Environment
  ): void {
    // Simple collision resolution: emit collision event
    // More sophisticated resolution can be implemented as needed

    this.emit('collision', {
      type: 'collision',
      timestamp: Date.now(),
      agent1,
      agent2,
      environment,
    });
  }

  /**
   * Check if agent is on interaction cooldown
   */
  private isOnCooldown(agentId: AgentId, currentTime: number): boolean {
    const cooldownEnd = this.interactionCooldowns.get(agentId);
    return cooldownEnd ? currentTime < cooldownEnd : false;
  }

  /**
   * Set interaction cooldown for agent
   */
  private setCooldown(agentId: AgentId, currentTime: number): void {
    this.interactionCooldowns.set(
      agentId,
      currentTime + this.config.interactionCooldown
    );
  }

  /**
   * Clear expired cooldowns
   */
  private clearExpiredCooldowns(currentTime: number): void {
    for (const [agentId, cooldownEnd] of this.interactionCooldowns.entries()) {
      if (currentTime >= cooldownEnd) {
        this.interactionCooldowns.delete(agentId);
      }
    }
  }

  /**
   * Get maximum interaction range from all registered types
   */
  private getMaxInteractionRange(): number {
    let maxRange = 0;
    for (const interaction of this.interactionTypes.values()) {
      maxRange = Math.max(maxRange, interaction.range);
    }
    return maxRange || 10; // Default range if no interactions registered
  }

  /**
   * Register built-in interaction types
   */
  private registerBuiltInInteractions(): void {
    // Energy transfer interaction
    this.registerInteraction({
      id: 'energy_transfer',
      name: 'Energy Transfer',
      range: 2.0,
      priority: 5,
      canInitiate: (initiator, target) => {
        const initiatorEnergy = initiator.getProperty<number>('energy') ?? 0;
        const targetEnergy = target.getProperty<number>('energy') ?? 0;
        return initiatorEnergy > 50 && targetEnergy < 50;
      },
      execute: (initiator, target, _context) => {
        const initiatorEnergy = initiator.getProperty<number>('energy') ?? 0;
        const targetEnergy = target.getProperty<number>('energy') ?? 0;
        const transferAmount = Math.min(20, initiatorEnergy - 50);

        return {
          success: transferAmount > 0,
          effects: [
            {
              targetAgent: initiator,
              property: 'energy',
              oldValue: initiatorEnergy,
              newValue: initiatorEnergy - transferAmount,
              effectType: 'set',
            },
            {
              targetAgent: target,
              property: 'energy',
              oldValue: targetEnergy,
              newValue: targetEnergy + transferAmount,
              effectType: 'set',
            },
          ],
          message: `Transferred ${transferAmount} energy`,
          metadata: { transferAmount },
        };
      },
    });

    // Information sharing interaction
    this.registerInteraction({
      id: 'information_share',
      name: 'Information Sharing',
      range: 3.0,
      priority: 3,
      canInitiate: (initiator, target) => {
        const initiatorInfo = initiator.getProperty<number>('information') ?? 0;
        const targetInfo = target.getProperty<number>('information') ?? 0;
        return Math.abs(initiatorInfo - targetInfo) > 10;
      },
      execute: (initiator, target, _context) => {
        const initiatorInfo = initiator.getProperty<number>('information') ?? 0;
        const targetInfo = target.getProperty<number>('information') ?? 0;
        const avgInfo = (initiatorInfo + targetInfo) / 2;

        return {
          success: true,
          effects: [
            {
              targetAgent: initiator,
              property: 'information',
              oldValue: initiatorInfo,
              newValue: avgInfo,
              effectType: 'set',
            },
            {
              targetAgent: target,
              property: 'information',
              oldValue: targetInfo,
              newValue: avgInfo,
              effectType: 'set',
            },
          ],
          message: 'Shared information',
          metadata: { averageInfo: avgInfo },
        };
      },
    });
  }
}
