/**
 * AgentManager - Centralized management system for agents
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from './agents/Agent';
import type { AgentId, AgentState } from '../types/core';
import type {
  AgentLifecycleEvent,
  PerformanceWarningEvent,
} from '../types/events';

/** Agent collection configuration */
export interface AgentManagerConfig {
  readonly maxAgents: number;
  readonly enablePerformanceMonitoring: boolean;
  readonly performanceWarningThreshold: number;
  readonly enableObjectPooling: boolean;
  readonly poolSize: number;
}

/** Agent query options */
export interface AgentQueryOptions {
  readonly state?: AgentState;
  readonly property?: string;
  readonly propertyValue?: any;
  readonly limit?: number;
  readonly offset?: number;
}

/** Performance metrics */
export interface PerformanceMetrics {
  readonly agentCount: number;
  readonly activeAgents: number;
  readonly lastStepTime: number;
  readonly averageStepTime: number;
  readonly memoryUsage: number;
  readonly operationsPerSecond: number;
}

/** Bulk operation result */
export interface BulkOperationResult {
  successful: number;
  failed: number;
  errors: Array<{ agentId: AgentId; error: string }>;
}

/**
 * AgentManager - Centralized agent management system
 *
 * Features:
 * - O(1) agent lookup by ID
 * - Bulk operations for efficiency
 * - Performance monitoring and warnings
 * - Memory management with object pooling preparation
 * - Iterator patterns for efficient processing
 * - State-based filtering and queries
 *
 * Educational Context: Manages the community population,
 * allowing efficient operations on large groups while
 * maintaining individual agent tracking and performance.
 */
export class AgentManager extends EventEmitter {
  /** Agent storage with O(1) lookup */
  private agents: Map<AgentId, Agent>;

  /** Agents indexed by state for efficient filtering */
  private agentsByState: Map<AgentState, Set<AgentId>>;

  /** Manager configuration */
  private config: AgentManagerConfig;

  /** Performance tracking */
  private performanceMetrics: PerformanceMetrics;
  private stepTimes: number[];
  private lastStepStart: number;

  /** Object pool for reuse (preparation for future optimization) */
  private _objectPool: Agent[];

  constructor(config: Partial<AgentManagerConfig> = {}) {
    super();

    this.agents = new Map();
    this.agentsByState = new Map();
    this._objectPool = [];

    // Initialize state maps
    this.agentsByState.set('active', new Set());
    this.agentsByState.set('dormant', new Set());
    this.agentsByState.set('destroyed', new Set());

    this.config = {
      maxAgents: 10000,
      enablePerformanceMonitoring: true,
      performanceWarningThreshold: 100, // milliseconds
      enableObjectPooling: false,
      poolSize: 100,
      ...config,
    };

    this.performanceMetrics = {
      agentCount: 0,
      activeAgents: 0,
      lastStepTime: 0,
      averageStepTime: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
    };

    this.stepTimes = [];
    this.lastStepStart = 0;
  }

  /**
   * Add agent to manager
   */
  addAgent(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with ID ${agent.id} already exists`);
    }

    if (this.agents.size >= this.config.maxAgents) {
      throw new Error(`Maximum agent limit (${this.config.maxAgents}) reached`);
    }

    this.agents.set(agent.id, agent);
    this.addToStateIndex(agent);

    // Listen for agent state changes
    agent.on('agentActivated', this.handleAgentStateChange.bind(this));
    agent.on('agentDeactivated', this.handleAgentStateChange.bind(this));
    agent.on('agentDestroyed', this.handleAgentStateChange.bind(this));

    this.updateMetrics();
    this.emit('agentAdded', { agent });
  }

  /**
   * Remove agent from manager
   */
  removeAgent(agentId: AgentId): boolean {
    const agent = this.agents.get(agentId);
    if (!agent) {
      return false;
    }

    this.agents.delete(agentId);
    this.removeFromStateIndex(agent);

    // Remove event listeners
    agent.removeAllListeners();

    this.updateMetrics();
    this.emit('agentRemoved', { agent });

    return true;
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: AgentId): Agent | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Check if agent exists
   */
  hasAgent(agentId: AgentId): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Get all agents
   */
  getAllAgents(): ReadonlyArray<Agent> {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by state
   */
  getAgentsByState(state: AgentState): ReadonlyArray<Agent> {
    const agentIds = this.agentsByState.get(state);
    if (!agentIds) {
      return [];
    }

    return Array.from(agentIds)
      .map(id => this.agents.get(id))
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Get active agents only
   */
  getActiveAgents(): ReadonlyArray<Agent> {
    return this.getAgentsByState('active');
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Get active agent count
   */
  getActiveAgentCount(): number {
    return this.agentsByState.get('active')?.size ?? 0;
  }

  /**
   * Query agents with filters
   */
  queryAgents(options: AgentQueryOptions = {}): ReadonlyArray<Agent> {
    let agents = this.getAllAgents();

    // Filter by state
    if (options.state) {
      agents = this.getAgentsByState(options.state);
    }

    // Filter by property
    if (options.property !== undefined) {
      agents = agents.filter(agent => {
        const value = agent.getProperty(options.property!);
        return options.propertyValue !== undefined
          ? value === options.propertyValue
          : value !== undefined;
      });
    }

    // Apply pagination
    const offset = options.offset ?? 0;
    const limit = options.limit ?? agents.length;

    return agents.slice(offset, offset + limit);
  }

  /**
   * Add multiple agents efficiently
   */
  addAgents(agents: Agent[]): BulkOperationResult {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const agent of agents) {
      try {
        this.addAgent(agent);
        result.successful++;
      } catch (error) {
        result.failed++;
        result.errors.push({
          agentId: agent.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Remove multiple agents efficiently
   */
  removeAgents(agentIds: AgentId[]): BulkOperationResult {
    const result: BulkOperationResult = {
      successful: 0,
      failed: 0,
      errors: [],
    };

    for (const agentId of agentIds) {
      try {
        if (this.removeAgent(agentId)) {
          result.successful++;
        } else {
          result.failed++;
          result.errors.push({
            agentId,
            error: 'Agent not found',
          });
        }
      } catch (error) {
        result.failed++;
        result.errors.push({
          agentId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return result;
  }

  /**
   * Step all active agents
   */
  stepAll(): void {
    if (this.config.enablePerformanceMonitoring) {
      this.lastStepStart = performance.now();
    }

    const activeAgents = this.getActiveAgents();

    for (const agent of activeAgents) {
      try {
        agent.step();
      } catch (error) {
        console.error(`Error stepping agent ${agent.id}:`, error);
        // Continue with other agents even if one fails
      }
    }

    if (this.config.enablePerformanceMonitoring) {
      this.recordStepTime();
    }
  }

  /**
   * Clear all agents
   */
  clear(): void {
    const agentIds = Array.from(this.agents.keys());
    this.removeAgents(agentIds);
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get manager configuration
   */
  getConfig(): AgentManagerConfig {
    return { ...this.config };
  }

  /**
   * Get object pool size (for future optimization)
   */
  getObjectPoolSize(): number {
    return this._objectPool.length;
  }

  /**
   * Update manager configuration
   */
  updateConfig(newConfig: Partial<AgentManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Create iterator for efficient processing
   */
  *iterateAgents(state?: AgentState): Generator<Agent, void, unknown> {
    const agents = state ? this.getAgentsByState(state) : this.getAllAgents();

    for (const agent of agents) {
      yield agent;
    }
  }

  /**
   * Create async iterator for non-blocking processing
   */
  async *iterateAgentsAsync(
    state?: AgentState,
    batchSize: number = 100,
    delayMs: number = 0
  ): AsyncGenerator<Agent[], void, unknown> {
    const agents = state ? this.getAgentsByState(state) : this.getAllAgents();

    for (let i = 0; i < agents.length; i += batchSize) {
      const batch = agents.slice(i, i + batchSize);
      yield batch;

      if (delayMs > 0 && i + batchSize < agents.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Handle agent state changes
   */
  private handleAgentStateChange(event: AgentLifecycleEvent): void {
    const agent = event.agent;

    // Remove from old state index
    this.removeFromStateIndex(agent);

    // Add to new state index
    this.addToStateIndex(agent);

    this.updateMetrics();
  }

  /**
   * Add agent to state index
   */
  private addToStateIndex(agent: Agent): void {
    const state = agent.currentState;
    const stateSet = this.agentsByState.get(state);

    if (stateSet) {
      stateSet.add(agent.id);
    }
  }

  /**
   * Remove agent from state index
   */
  private removeFromStateIndex(agent: Agent): void {
    for (const stateSet of this.agentsByState.values()) {
      stateSet.delete(agent.id);
    }
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(): void {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      agentCount: this.agents.size,
      activeAgents: this.getActiveAgentCount(),
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  /**
   * Record step execution time
   */
  private recordStepTime(): void {
    const stepTime = performance.now() - this.lastStepStart;

    this.stepTimes.push(stepTime);
    if (this.stepTimes.length > 100) {
      this.stepTimes.shift(); // Keep only recent measurements
    }

    const averageStepTime =
      this.stepTimes.reduce((sum, time) => sum + time, 0) /
      this.stepTimes.length;

    this.performanceMetrics = {
      ...this.performanceMetrics,
      lastStepTime: stepTime,
      averageStepTime,
      operationsPerSecond: stepTime > 0 ? 1000 / stepTime : 0,
    };

    // Emit performance warning if needed
    if (stepTime > this.config.performanceWarningThreshold) {
      this.emitPerformanceWarning(
        'stepTime',
        stepTime,
        this.config.performanceWarningThreshold
      );
    }
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    // Rough estimation - in a real implementation, you might use more sophisticated methods
    const baseAgentSize = 1024; // bytes per agent (rough estimate)
    return this.agents.size * baseAgentSize;
  }

  /**
   * Emit performance warning
   */
  private emitPerformanceWarning(
    metric: string,
    value: number,
    threshold: number
  ): void {
    const event: PerformanceWarningEvent = {
      type: 'performanceWarning',
      timestamp: Date.now(),
      metric,
      value,
      threshold,
      message: `Performance warning: ${metric} (${value.toFixed(2)}) exceeded threshold (${threshold})`,
    };

    this.emit('performanceWarning', event);
  }

  /**
   * Reset the agent manager to initial state
   */
  reset(): void {
    // Clear all agents
    this.agents.clear();
    
    // Clear state indices
    for (const stateSet of this.agentsByState.values()) {
      stateSet.clear();
    }
    
    // Reset performance metrics
    this.performanceMetrics = {
      agentCount: 0,
      activeAgents: 0,
      lastStepTime: 0,
      averageStepTime: 0,
      memoryUsage: 0,
      operationsPerSecond: 0,
    };
    
    this.stepTimes = [];
    this.lastStepStart = 0;
    
    // Clear object pool
    this._objectPool = [];
  }
}
