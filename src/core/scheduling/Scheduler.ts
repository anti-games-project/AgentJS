/**
 * Abstract Scheduler class - foundation for agent activation scheduling
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../agents/Agent';

/**
 * Abstract Scheduler class controlling agent activation order
 *
 * Responsibilities:
 * - Determine order of agent updates each simulation step
 * - Manage agent registration/deregistration
 * - Provide scheduling statistics and monitoring
 * - Handle agent lifecycle events
 *
 * Educational Context: Represents different approaches to
 * community organization and decision-making processes,
 * from random consultation to structured hierarchies.
 */
export abstract class Scheduler extends EventEmitter {
  /** Agents managed by this scheduler */
  protected agents: Set<Agent>;

  /** Current step number */
  protected stepNumber: number;

  /** Performance tracking */
  protected lastStepTime: number;
  protected totalSteps: number;

  /** Random seed for deterministic scheduling */
  protected randomSeed: number | undefined;

  constructor(randomSeed?: number) {
    super();

    this.agents = new Set();
    this.stepNumber = 0;
    this.lastStepTime = 0;
    this.totalSteps = 0;
    this.randomSeed = randomSeed;

    if (this.randomSeed !== undefined) {
      this.initializeRandom(this.randomSeed);
    }
  }

  /**
   * Add agent to scheduling
   */
  addAgent(agent: Agent): void {
    if (this.agents.has(agent)) {
      throw new Error(`Agent ${agent.id} is already scheduled`);
    }

    this.agents.add(agent);
    this.onAgentAdded(agent);
    this.emit('agentAdded', { agent, schedulerSize: this.agents.size });
  }

  /**
   * Remove agent from scheduling
   */
  removeAgent(agent: Agent): boolean {
    if (!this.agents.has(agent)) {
      return false;
    }

    this.agents.delete(agent);
    this.onAgentRemoved(agent);
    this.emit('agentRemoved', { agent, schedulerSize: this.agents.size });

    return true;
  }

  /**
   * Get all scheduled agents
   */
  getAgents(): ReadonlyArray<Agent> {
    return Array.from(this.agents);
  }

  /**
   * Get number of scheduled agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Execute one simulation step
   */
  step(): void {
    const stepStart = performance.now();

    // Get activation order from concrete implementation
    const activationOrder = this.getActivationOrder();

    // Filter for active agents only
    const activeAgents = activationOrder.filter(agent => agent.isActive());

    this.emit('stepStarted', {
      stepNumber: this.stepNumber,
      agentCount: activeAgents.length,
    });

    // Execute each agent's step method
    for (const agent of activeAgents) {
      try {
        agent.step();
      } catch (error) {
        this.emit('agentStepError', {
          agent,
          error,
          stepNumber: this.stepNumber,
        });

        // Continue with other agents even if one fails
        console.warn(`Agent ${agent.id} step failed:`, error);
      }
    }

    // Update step tracking
    this.stepNumber++;
    this.totalSteps++;
    this.lastStepTime = performance.now() - stepStart;

    this.emit('stepCompleted', {
      stepNumber: this.stepNumber,
      executionTime: this.lastStepTime,
      agentCount: activeAgents.length,
    });
  }

  /**
   * Reset scheduler state
   */
  reset(): void {
    this.stepNumber = 0;
    this.totalSteps = 0;
    this.lastStepTime = 0;

    if (this.randomSeed !== undefined) {
      this.initializeRandom(this.randomSeed);
    }

    this.emit('schedulerReset');
  }

  /**
   * Get current step number
   */
  getCurrentStep(): number {
    return this.stepNumber;
  }

  /**
   * Get total steps executed
   */
  getTotalSteps(): number {
    return this.totalSteps;
  }

  /**
   * Get last step execution time in milliseconds
   */
  getLastStepTime(): number {
    return this.lastStepTime;
  }

  /**
   * Get scheduling statistics
   */
  getStatistics(): SchedulerStatistics {
    const averageStepTime =
      this.totalSteps > 0 ? this.lastStepTime / this.totalSteps : 0;

    return {
      totalAgents: this.agents.size,
      activeAgents: Array.from(this.agents).filter(a => a.isActive()).length,
      currentStep: this.stepNumber,
      totalSteps: this.totalSteps,
      lastStepTime: this.lastStepTime,
      averageStepTime,
      schedulerType: this.getSchedulerType(),
    };
  }

  /**
   * Abstract method: Get agent activation order
   * Must be implemented by concrete scheduler types
   */
  protected abstract getActivationOrder(): ReadonlyArray<Agent>;

  /**
   * Abstract method: Get scheduler type name
   * Must be implemented by concrete scheduler types
   */
  protected abstract getSchedulerType(): string;

  /**
   * Hook for subclasses when agent is added
   */
  protected onAgentAdded(_agent: Agent): void {
    // Override in subclasses if needed
  }

  /**
   * Hook for subclasses when agent is removed
   */
  protected onAgentRemoved(_agent: Agent): void {
    // Override in subclasses if needed
  }

  /**
   * Initialize random number generator with seed
   */
  private initializeRandom(seed: number): void {
    // Simple seeded random number generator for deterministic scheduling
    let state = seed;
    Math.random = () => {
      state = (state * 1664525 + 1013904223) % 0x100000000;
      return state / 0x100000000;
    };
  }
}

/**
 * Scheduler statistics interface
 */
export interface SchedulerStatistics {
  readonly totalAgents: number;
  readonly activeAgents: number;
  readonly currentStep: number;
  readonly totalSteps: number;
  readonly lastStepTime: number;
  readonly averageStepTime: number;
  readonly schedulerType: string;
}
