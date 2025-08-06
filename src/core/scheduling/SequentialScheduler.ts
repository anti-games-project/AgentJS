/**
 * SequentialScheduler - Sequential activation order scheduler
 */

import { Scheduler } from './Scheduler';
import type { Agent } from '../agents/Agent';
import type { AgentId } from '../../types/core';

/** Sequential scheduling modes */
export type SequentialMode = 'creation' | 'id' | 'custom';

/** Custom ordering function type */
export type AgentOrderingFunction = (a: Agent, b: Agent) => number;

/**
 * SequentialScheduler - Activates agents in deterministic order
 *
 * Features:
 * - Multiple ordering modes (creation time, ID, custom)
 * - Consistent activation order for reproducible simulations
 * - Custom sorting functions for specialized ordering
 * - Reverse order support
 * - Performance optimized sorting
 *
 * Educational Context: Simulates structured environments
 * where community members follow predictable patterns,
 * such as hierarchical organizations or systematic processes.
 */
export class SequentialScheduler extends Scheduler {
  /** Scheduling mode */
  private mode: SequentialMode;

  /** Custom ordering function */
  private orderingFunction: AgentOrderingFunction | undefined;

  /** Whether to reverse the order */
  private reversed: boolean;

  /** Cached agent creation order */
  private creationOrderCache: Map<AgentId, number>;

  constructor(
    mode: SequentialMode = 'creation',
    orderingFunction?: AgentOrderingFunction,
    reversed: boolean = false
  ) {
    super();

    this.mode = mode;
    this.orderingFunction = orderingFunction;
    this.reversed = reversed;
    this.creationOrderCache = new Map();
  }

  /**
   * Get agent activation order (implementing abstract method)
   */
  protected getActivationOrder(): ReadonlyArray<Agent> {
    return this.schedule(this.getAgents());
  }

  /**
   * Get scheduler type (implementing abstract method)
   */
  protected getSchedulerType(): string {
    return this.getType();
  }

  /**
   * Schedule agents in sequential order
   */
  schedule(agents: ReadonlyArray<Agent>): ReadonlyArray<Agent> {
    // Filter active agents
    const activeAgents = agents.filter(agent => agent.isActive());

    if (activeAgents.length === 0) {
      // Performance tracking handled by base class
      return [];
    }

    // Sort agents based on mode
    const sortedAgents = this.sortAgents([...activeAgents]);

    // Performance tracking handled by base class

    return sortedAgents;
  }

  /**
   * Set scheduling mode
   */
  setMode(
    mode: SequentialMode,
    orderingFunction?: AgentOrderingFunction
  ): void {
    this.mode = mode;
    this.orderingFunction = orderingFunction;
  }

  /**
   * Get current mode
   */
  getMode(): SequentialMode {
    return this.mode;
  }

  /**
   * Set reverse order
   */
  setReversed(reversed: boolean): void {
    this.reversed = reversed;
  }

  /**
   * Check if order is reversed
   */
  isReversed(): boolean {
    return this.reversed;
  }

  /**
   * Set custom ordering function
   */
  setOrderingFunction(fn: AgentOrderingFunction): void {
    this.mode = 'custom';
    this.orderingFunction = fn;
  }

  /**
   * Get scheduler type
   */
  getType(): string {
    return 'sequential';
  }

  /**
   * Get scheduler configuration
   */
  getConfiguration(): Record<string, any> {
    return {
      type: this.getType(),
      mode: this.mode,
      reversed: this.reversed,
      hasCustomFunction: this.orderingFunction !== undefined,
    };
  }

  /**
   * Cache agent creation order
   */
  cacheCreationOrder(agents: ReadonlyArray<Agent>): void {
    for (let i = 0; i < agents.length; i++) {
      const agent = agents[i];
      if (agent && !this.creationOrderCache.has(agent.id)) {
        this.creationOrderCache.set(agent.id, i);
      }
    }
  }

  /**
   * Clear creation order cache
   */
  clearCreationOrderCache(): void {
    this.creationOrderCache.clear();
  }

  /**
   * Sort agents based on current mode
   */
  private sortAgents(agents: Agent[]): Agent[] {
    let sortFunction: (a: Agent, b: Agent) => number;

    switch (this.mode) {
      case 'creation':
        sortFunction = (a, b) => this.compareByCreationOrder(a, b);
        break;

      case 'id':
        sortFunction = (a, b) => this.compareById(a, b);
        break;

      case 'custom':
        if (!this.orderingFunction) {
          throw new Error('Custom ordering function not provided');
        }
        sortFunction = this.orderingFunction;
        break;

      default:
        throw new Error(`Unknown scheduling mode: ${this.mode}`);
    }

    agents.sort(sortFunction);

    if (this.reversed) {
      agents.reverse();
    }

    return agents;
  }

  /**
   * Compare agents by creation order
   */
  private compareByCreationOrder(a: Agent, b: Agent): number {
    const orderA = this.creationOrderCache.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const orderB = this.creationOrderCache.get(b.id) ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    // Fallback to creation timestamp if cache miss
    const aCreated = a.hasOwnProperty('createdAt') ? (a as any).createdAt : 0;
    const bCreated = b.hasOwnProperty('createdAt') ? (b as any).createdAt : 0;
    return aCreated - bCreated;
  }

  /**
   * Compare agents by ID (lexicographic)
   */
  private compareById(a: Agent, b: Agent): number {
    return a.id.localeCompare(b.id);
  }

  /**
   * Create common ordering functions
   */
  static createOrderingFunctions() {
    return {
      /**
       * Order by energy level (highest first)
       */
      byEnergyDesc: (a: Agent, b: Agent): number => {
        const energyA = a.getProperty<number>('energy') ?? 0;
        const energyB = b.getProperty<number>('energy') ?? 0;
        return energyB - energyA;
      },

      /**
       * Order by energy level (lowest first)
       */
      byEnergyAsc: (a: Agent, b: Agent): number => {
        const energyA = a.getProperty<number>('energy') ?? 0;
        const energyB = b.getProperty<number>('energy') ?? 0;
        return energyA - energyB;
      },

      /**
       * Order by distance from origin
       */
      byDistanceFromOrigin: (a: Agent, b: Agent): number => {
        const distA = Math.sqrt(
          a.position.x * a.position.x + a.position.y * a.position.y
        );
        const distB = Math.sqrt(
          b.position.x * b.position.x + b.position.y * b.position.y
        );
        return distA - distB;
      },

      /**
       * Order by agent type (if agents have type property)
       */
      byType: (a: Agent, b: Agent): number => {
        const typeA = a.getProperty<string>('type') ?? '';
        const typeB = b.getProperty<string>('type') ?? '';
        return typeA.localeCompare(typeB);
      },

      /**
       * Order by creation time
       */
      byCreationTime: (a: Agent, b: Agent): number => {
        const aCreated = a.hasOwnProperty('createdAt')
          ? (a as any).createdAt
          : 0;
        const bCreated = b.hasOwnProperty('createdAt')
          ? (b as any).createdAt
          : 0;
        return aCreated - bCreated;
      },

      /**
       * Random ordering (for sequential scheduler with random element)
       */
      byRandom: (): number => {
        return Math.random() - 0.5;
      },
    };
  }
}
