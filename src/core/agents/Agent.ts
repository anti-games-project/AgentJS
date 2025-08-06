/**
 * Abstract base Agent class for all agent types in the framework
 */

import { EventEmitter } from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';
import type {
  AgentId,
  Position,
  PropertyValue,
  AgentProperties,
  AgentState,
} from '../../types/core';
import type {
  PropertyChangedEvent,
  PositionChangedEvent,
  AgentLifecycleEvent,
} from '../../types/events';

/**
 * Abstract Agent class - foundation for all agent types
 *
 * Provides core functionality:
 * - Unique identification
 * - Property management with validation
 * - Position tracking with events
 * - Lifecycle management
 * - Event emission for state changes
 *
 * Educational Context: Represents individual community members
 * with properties that can change through interactions and
 * environmental influences.
 */
export abstract class Agent extends EventEmitter {
  /** Unique identifier for this agent */
  public readonly id: AgentId;

  /** Current agent state */
  protected state: AgentState = 'active';

  /** Agent properties with type-safe access */
  protected properties: Map<string, PropertyValue>;

  /** Current position in environment */
  protected _position: Position;

  /** Creation timestamp */
  public readonly createdAt: number;

  /** Last update timestamp */
  protected lastUpdated: number;

  constructor(
    id: string | AgentId = uuidv4(),
    initialProperties: AgentProperties = {},
    initialPosition: Position = { x: 0, y: 0 } as Position
  ) {
    super();

    this.id = id as AgentId;
    this.properties = new Map(Object.entries(initialProperties));
    this._position = initialPosition;
    this.createdAt = Date.now();
    this.lastUpdated = this.createdAt;

    this.validateInitialState();
    this.emitLifecycleEvent('agentCreated');
  }

  /**
   * Abstract step method - must be implemented by subclasses
   * Called once per simulation step to update agent state
   */
  abstract step(): void;

  /**
   * Get agent property with type safety
   */
  getProperty<T extends PropertyValue>(key: string): T | undefined {
    return this.properties.get(key) as T | undefined;
  }

  /**
   * Set agent property with validation and event emission
   */
  setProperty<T extends PropertyValue>(key: string, value: T): void {
    this.validateProperty(key, value);

    const oldValue = this.properties.get(key);
    this.properties.set(key, value);
    this.lastUpdated = Date.now();

    this.emitPropertyChanged(key, oldValue ?? null, value);
  }

  /**
   * Get all agent properties as an object
   */
  getProperties(): Record<string, PropertyValue> {
    return Object.fromEntries(this.properties.entries());
  }

  /**
   * Get all properties as readonly record
   */
  getAllProperties(): Readonly<Record<string, PropertyValue>> {
    return Object.fromEntries(this.properties.entries());
  }

  /**
   * Check if agent has a specific property
   */
  hasProperty(key: string): boolean {
    return this.properties.has(key);
  }

  /**
   * Remove a property from the agent
   */
  removeProperty(key: string): boolean {
    const hadProperty = this.properties.has(key);
    if (hadProperty) {
      const oldValue = this.properties.get(key);
      this.properties.delete(key);
      this.lastUpdated = Date.now();
      this.emitPropertyChanged(key, oldValue ?? null, null);
    }
    return hadProperty;
  }

  /**
   * Get current position
   */
  get position(): Position {
    return this._position;
  }

  /**
   * Get current position (method form for compatibility)
   */
  getPosition(): Position {
    return this._position;
  }

  /**
   * Set position with validation and event emission
   */
  setPosition(newPosition: Position): void {
    this.validatePosition(newPosition);

    const oldPosition = this._position;
    this._position = newPosition;
    this.lastUpdated = Date.now();

    this.emitPositionChanged(oldPosition, newPosition);
  }

  /**
   * Translate position by offset
   */
  translate(dx: number, dy: number): void {
    const newPosition = {
      x: this._position.x + dx,
      y: this._position.y + dy,
    } as Position;

    this.setPosition(newPosition);
  }

  /**
   * Get current agent state
   */
  get currentState(): AgentState {
    return this.state;
  }

  /**
   * Activate agent (make it active in simulation)
   */
  activate(): void {
    if (this.state !== 'active') {
      this.state = 'active';
      this.emitLifecycleEvent('agentActivated');
    }
  }

  /**
   * Deactivate agent (remove from simulation but keep in memory)
   */
  deactivate(): void {
    if (this.state === 'active') {
      this.state = 'dormant';
      this.emitLifecycleEvent('agentDeactivated');
    }
  }

  /**
   * Destroy agent (mark for removal from simulation)
   */
  destroy(): void {
    if (this.state !== 'destroyed') {
      this.state = 'destroyed';
      this.emitLifecycleEvent('agentDestroyed');
      this.removeAllListeners();
    }
  }

  /**
   * Check if agent is active
   */
  isActive(): boolean {
    return this.state === 'active';
  }

  /**
   * Check if agent is destroyed
   */
  isDestroyed(): boolean {
    return this.state === 'destroyed';
  }

  /**
   * Serialize agent to JSON for persistence
   */
  toJSON(): Record<string, any> {
    return {
      id: this.id,
      state: this.state,
      position: this._position,
      properties: Object.fromEntries(this.properties.entries()),
      createdAt: this.createdAt,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Get string representation of agent
   */
  override toString(): string {
    return `Agent(${this.id}, ${this.state}, ${this._position.x}, ${this._position.y})`;
  }

  /**
   * Validate property value before setting
   * Override in subclasses for custom validation
   */
  protected validateProperty(key: string, value: PropertyValue): void {
    if (key === '' || key === null) {
      throw new Error('Property key cannot be empty or null');
    }

    // Basic type validation
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      try {
        JSON.stringify(value);
      } catch {
        throw new Error('Property value must be JSON serializable');
      }
    }
  }

  /**
   * Validate position before setting
   * Override in subclasses for custom validation
   */
  protected validatePosition(position: Position): void {
    if (!isFinite(position.x) || !isFinite(position.y)) {
      throw new Error('Position coordinates must be finite numbers');
    }
  }

  /**
   * Validate initial agent state
   */
  protected validateInitialState(): void {
    if (!this.id || this.id.length === 0) {
      throw new Error('Agent ID cannot be empty');
    }
  }

  /**
   * Emit property changed event
   */
  private emitPropertyChanged(
    property: string,
    oldValue: PropertyValue,
    newValue: PropertyValue
  ): void {
    const event: PropertyChangedEvent = {
      type: 'propertyChanged',
      timestamp: Date.now(),
      agent: this,
      property,
      oldValue,
      newValue,
    };

    this.emit('propertyChanged', event);
  }

  /**
   * Emit position changed event
   */
  private emitPositionChanged(
    oldPosition: Position,
    newPosition: Position
  ): void {
    const event: PositionChangedEvent = {
      type: 'positionChanged',
      timestamp: Date.now(),
      agent: this,
      oldPosition,
      newPosition,
    };

    this.emit('positionChanged', event);
  }

  /**
   * Emit lifecycle event
   */
  private emitLifecycleEvent(type: AgentLifecycleEvent['type']): void {
    const event: AgentLifecycleEvent = {
      type,
      timestamp: Date.now(),
      agent: this,
    };

    this.emit(type, event);
  }
}
