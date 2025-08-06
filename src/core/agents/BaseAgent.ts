/**
 * BaseAgent - Minimal agent implementation for basic use cases
 */

import { Agent } from './Agent';
import type { AgentId, Position, AgentProperties } from '../../types/core';

/**
 * BaseAgent - Minimal agent with basic functionality
 *
 * Features:
 * - Position management with simple movement
 * - Property management through base class
 * - Lifecycle management
 * - No specialized behaviors
 *
 * Educational Context: Represents basic community members
 * who participate in the environment but don't have complex
 * movement patterns or network relationships.
 */
export class BaseAgent extends Agent {
  constructor(
    id?: string | AgentId,
    initialProperties: AgentProperties = {},
    initialPosition: Position = { x: 0, y: 0 } as Position
  ) {
    super(id, initialProperties, initialPosition);
  }

  /**
   * Basic step implementation - override for custom behavior
   * By default, does nothing (static agent)
   */
  step(): void {
    // Base agents don't perform any automatic actions
    // This can be overridden by subclasses or configured through properties
  }

  /**
   * Simple position update with validation
   */
  moveTo(newPosition: Position): void {
    this.setPosition(newPosition);
  }

  /**
   * Move relative to current position
   */
  moveBy(dx: number, dy: number): void {
    this.translate(dx, dy);
  }

  /**
   * Set agent energy level (common property)
   */
  setEnergy(energy: number): void {
    if (energy < 0) {
      throw new Error('Energy cannot be negative');
    }
    this.setProperty('energy', energy);
  }

  /**
   * Get agent energy level
   */
  getEnergy(): number {
    return this.getProperty<number>('energy') ?? 100;
  }

  /**
   * Set agent activity level (0-1)
   */
  setActivity(activity: number): void {
    if (activity < 0 || activity > 1) {
      throw new Error('Activity must be between 0 and 1');
    }
    this.setProperty('activity', activity);
  }

  /**
   * Get agent activity level
   */
  getActivity(): number {
    return this.getProperty<number>('activity') ?? 0.5;
  }

  /**
   * Check if agent is at a specific position
   */
  isAt(position: Position): boolean {
    return this.position.x === position.x && this.position.y === position.y;
  }

  /**
   * Calculate distance to another position
   */
  distanceTo(position: Position): number {
    const dx = this.position.x - position.x;
    const dy = this.position.y - position.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate distance to another agent
   */
  distanceToAgent(other: Agent): number {
    return this.distanceTo(other.position);
  }

  /**
   * Check if agent is within a certain distance of a position
   */
  isNear(position: Position, radius: number): boolean {
    return this.distanceTo(position) <= radius;
  }

  /**
   * Check if agent is within a certain distance of another agent
   */
  isNearAgent(other: Agent, radius: number): boolean {
    return this.distanceToAgent(other) <= radius;
  }
}
