/**
 * RandomScheduler - Random activation order scheduler
 */

import { Scheduler } from './Scheduler';
import type { Agent } from '../agents/Agent';

/**
 * RandomScheduler - Activates agents in random order each step
 *
 * Features:
 * - True randomization with configurable seed
 * - Fisher-Yates shuffle algorithm for unbiased ordering
 * - Performance optimized for large agent populations
 * - Reproducible results when seed is set
 *
 * Educational Context: Simulates unpredictable real-world
 * activation patterns where community members act in
 * random order, reducing systematic biases in simulations.
 */
export class RandomScheduler extends Scheduler {
  /** Random number generator seed */
  private seed: number | undefined;

  /** Current RNG state for reproducible randomness */
  private rngState: number;

  constructor(seed?: number) {
    super();

    this.seed = seed;
    this.rngState = seed ?? Date.now();
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
   * Schedule agents in random order
   */
  schedule(agents: ReadonlyArray<Agent>): ReadonlyArray<Agent> {
    // Filter active agents
    const activeAgents = agents.filter(agent => agent.isActive());

    if (activeAgents.length === 0) {
      // Performance tracking handled by base class
      return [];
    }

    // Create a copy and shuffle
    const shuffledAgents = [...activeAgents];
    this.shuffleArray(shuffledAgents);

    // Performance tracking handled by base class

    return shuffledAgents;
  }

  /**
   * Set random seed for reproducible results
   */
  setSeed(seed: number): void {
    this.seed = seed;
    this.rngState = seed;
  }

  /**
   * Get current seed
   */
  getSeed(): number | undefined {
    return this.seed;
  }

  /**
   * Reset RNG state to original seed
   */
  resetSeed(): void {
    this.rngState = this.seed ?? Date.now();
  }

  /**
   * Get scheduler type
   */
  getType(): string {
    return 'random';
  }

  /**
   * Get scheduler configuration
   */
  getConfiguration(): Record<string, any> {
    return {
      type: this.getType(),
      seed: this.seed,
      currentRngState: this.rngState,
      reproducible: this.seed !== undefined,
    };
  }

  /**
   * Shuffle array using Fisher-Yates algorithm with seeded RNG
   */
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(this.seededRandom() * (i + 1));
      const temp = array[i];
      const elementJ = array[j];
      if (temp !== undefined && elementJ !== undefined) {
        array[i] = elementJ;
        array[j] = temp;
      }
    }
  }

  /**
   * Seeded random number generator (Linear Congruential Generator)
   * Returns value between 0 and 1
   */
  private seededRandom(): number {
    if (this.seed === undefined) {
      return Math.random();
    }

    // LCG parameters (same as used in Numerical Recipes)
    const a = 1664525;
    const c = 1013904223;
    const m = Math.pow(2, 32);

    this.rngState = (a * this.rngState + c) % m;
    return this.rngState / m;
  }
}
