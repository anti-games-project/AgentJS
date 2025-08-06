/**
 * Abstract Environment class - foundation for all spatial environments
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../agents/Agent';
import type { Position } from '../../types/core';
import type {
  EnvironmentDimensions,
  NeighborQueryOptions,
} from '../../types/spatial';

export interface SpatialQueryResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly distances: ReadonlyArray<number>;
  readonly queryTime: number;
}

/**
 * Abstract Environment class providing spatial context for agents
 *
 * Handles:
 * - Agent placement and movement
 * - Boundary conditions and wrapping
 * - Spatial queries and neighbor finding
 * - Distance calculations
 *
 * Educational Context: Represents the physical or social space
 * where community members interact, with different boundary
 * conditions affecting movement and interaction patterns.
 */
export abstract class Environment extends EventEmitter {
  /** Environment dimensions */
  protected readonly dimensions: EnvironmentDimensions;

  /** Agents currently in this environment */
  protected agents: Set<Agent>;

  /** Agent position tracking */
  protected agentPositions: Map<Agent, Position>;

  constructor(dimensions: EnvironmentDimensions) {
    super();

    this.validateDimensions(dimensions);
    this.dimensions = { ...dimensions };
    this.agents = new Set();
    this.agentPositions = new Map();
  }

  /**
   * Add agent to environment at specified position
   */
  addAgent(agent: Agent, position?: Position): void {
    if (this.agents.has(agent)) {
      throw new Error(`Agent ${agent.id} is already in this environment`);
    }

    const finalPosition = position ?? agent.position;
    this.validatePosition(finalPosition);

    this.agents.add(agent);
    this.agentPositions.set(agent, finalPosition);

    // Update agent's position to match environment
    if (position) {
      agent.setPosition(finalPosition);
    }

    this.onAgentAdded(agent, finalPosition);
    this.emit('agentAdded', { agent, position: finalPosition });
  }

  /**
   * Remove agent from environment
   */
  removeAgent(agent: Agent): boolean {
    if (!this.agents.has(agent)) {
      return false;
    }

    this.agents.delete(agent);
    this.agentPositions.delete(agent);

    this.onAgentRemoved(agent);
    this.emit('agentRemoved', { agent });

    return true;
  }

  /**
   * Move agent to new position within environment
   */
  moveAgent(agent: Agent, newPosition: Position): void {
    if (!this.agents.has(agent)) {
      throw new Error(`Agent ${agent.id} is not in this environment`);
    }

    const adjustedPosition = this.applyBoundaryConditions(newPosition);
    const oldPosition = this.agentPositions.get(agent)!;

    this.agentPositions.set(agent, adjustedPosition);
    agent.setPosition(adjustedPosition);

    this.onAgentMoved(agent, oldPosition, adjustedPosition);
    this.emit('agentMoved', {
      agent,
      oldPosition,
      newPosition: adjustedPosition,
    });
  }

  /**
   * Get agent's current position in environment
   */
  getAgentPosition(agent: Agent): Position | undefined {
    return this.agentPositions.get(agent);
  }

  /**
   * Get all agents in environment
   */
  getAllAgents(): ReadonlyArray<Agent> {
    return Array.from(this.agents);
  }

  /**
   * Get number of agents in environment
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Check if position is within environment bounds
   */
  isValidPosition(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x <= this.dimensions.width &&
      position.y >= 0 &&
      position.y <= this.dimensions.height
    );
  }

  /**
   * Apply boundary conditions to position
   */
  applyBoundaryConditions(position: Position): Position {
    switch (this.dimensions.boundaryType) {
      case 'periodic':
        return this.applyPeriodicBoundary(position);
      case 'reflective':
        return this.applyReflectiveBoundary(position);
      case 'absorbing':
        return this.applyAbsorbingBoundary(position);
      default:
        throw new Error(
          `Unknown boundary type: ${this.dimensions.boundaryType}`
        );
    }
  }

  /**
   * Calculate distance between two positions
   */
  distance(pos1: Position, pos2: Position): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get environment dimensions
   */
  getDimensions(): EnvironmentDimensions {
    return { ...this.dimensions };
  }

  /**
   * Abstract method: Find neighbors within radius
   * Must be implemented by concrete environment types
   */
  abstract findNeighbors(
    _position: Position,
    _radius: number,
    _options?: NeighborQueryOptions
  ): SpatialQueryResult<Agent>;

  /**
   * Abstract method: Get agents at specific position
   * Must be implemented by concrete environment types
   */
  abstract getAgentsAt(_position: Position): ReadonlyArray<Agent>;

  /**
   * Hook for subclasses when agent is added
   */
  protected onAgentAdded(_agent: Agent, _position: Position): void {
    // Override in subclasses
  }

  /**
   * Hook for subclasses when agent is removed
   */
  protected onAgentRemoved(_agent: Agent): void {
    // Override in subclasses
  }

  /**
   * Hook for subclasses when agent is moved
   */
  protected onAgentMoved(
    _agent: Agent,
    _oldPosition: Position,
    _newPosition: Position
  ): void {
    // Override in subclasses
  }

  /**
   * Validate environment dimensions
   */
  private validateDimensions(dimensions: EnvironmentDimensions): void {
    if (dimensions.width <= 0 || dimensions.height <= 0) {
      throw new Error('Environment dimensions must be positive');
    }

    if (!isFinite(dimensions.width) || !isFinite(dimensions.height)) {
      throw new Error('Environment dimensions must be finite');
    }
  }

  /**
   * Validate position coordinates
   */
  private validatePosition(position: Position): void {
    if (!isFinite(position.x) || !isFinite(position.y)) {
      throw new Error('Position coordinates must be finite numbers');
    }
  }

  /**
   * Apply periodic boundary conditions (wrap around)
   */
  private applyPeriodicBoundary(position: Position): Position {
    const x =
      ((position.x % this.dimensions.width) + this.dimensions.width) %
      this.dimensions.width;
    const y =
      ((position.y % this.dimensions.height) + this.dimensions.height) %
      this.dimensions.height;

    return { x, y } as Position;
  }

  /**
   * Apply reflective boundary conditions (bounce back)
   */
  private applyReflectiveBoundary(position: Position): Position {
    let x = position.x;
    let y = position.y;

    if (x < 0) x = -x;
    if (x > this.dimensions.width) x = 2 * this.dimensions.width - x;
    if (y < 0) y = -y;
    if (y > this.dimensions.height) y = 2 * this.dimensions.height - y;

    return { x, y } as Position;
  }

  /**
   * Apply absorbing boundary conditions (clamp to bounds)
   */
  private applyAbsorbingBoundary(position: Position): Position {
    const x = Math.max(0, Math.min(this.dimensions.width, position.x));
    const y = Math.max(0, Math.min(this.dimensions.height, position.y));

    return { x, y } as Position;
  }
}
