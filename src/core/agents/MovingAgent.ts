/**
 * MovingAgent - Agent with velocity and movement mechanics
 */

import { BaseAgent } from './BaseAgent';
import type { AgentId, Position, AgentProperties } from '../../types/core';

/** Velocity vector interface */
export interface Velocity {
  readonly vx: number;
  readonly vy: number;
}

/** Movement configuration */
export interface MovementConfig {
  readonly maxSpeed: number;
  readonly acceleration: number;
  readonly friction: number;
  readonly bounceOnBoundary: boolean;
}

/**
 * MovingAgent - Agent with velocity-based movement
 *
 * Features:
 * - Velocity vector (vx, vy) for realistic movement
 * - Speed limits and acceleration control
 * - Boundary collision detection and response
 * - Momentum and friction simulation
 *
 * Educational Context: Represents community members who
 * move through the environment with realistic physics,
 * such as people walking, vehicles, or flowing resources.
 */
export class MovingAgent extends BaseAgent {
  /** Current velocity vector */
  protected velocity: Velocity;

  /** Movement configuration */
  protected movementConfig: MovementConfig;

  /** Previous position for collision detection */
  protected previousPosition: Position;

  constructor(
    id?: string | AgentId,
    initialProperties: AgentProperties = {},
    initialPosition: Position = { x: 0, y: 0 } as Position,
    movementConfig: Partial<MovementConfig> = {}
  ) {
    super(id, initialProperties, initialPosition);

    this.velocity = { vx: 0, vy: 0 };
    this.previousPosition = initialPosition;

    // Initialize position properties if provided
    if (initialProperties.x !== undefined) {
      initialPosition = { ...initialPosition, x: initialProperties.x as number } as Position;
    }
    if (initialProperties.y !== undefined) {
      initialPosition = { ...initialPosition, y: initialProperties.y as number } as Position;
    }

    // Set initial position properties
    this.setProperty('x', initialPosition.x);
    this.setProperty('y', initialPosition.y);

    // Default movement configuration
    this.movementConfig = {
      maxSpeed: 5.0,
      acceleration: 1.0,
      friction: 0.95,
      bounceOnBoundary: true,
      ...movementConfig,
    };
  }

  /**
   * Update agent position based on velocity
   */
  override step(): void {
    // Store previous position for collision detection
    this.previousPosition = this.position;

    // Check for property-based velocity (for compatibility)
    const propVelX = this.getProperty<number>('velocityX');
    const propVelY = this.getProperty<number>('velocityY');
    
    if (propVelX !== undefined && propVelY !== undefined) {
      this.velocity = { vx: propVelX, vy: propVelY };
    }

    // Apply friction to velocity
    this.velocity = this.applyFriction(this.velocity);

    // Limit velocity to max speed
    this.velocity = this.limitSpeed(this.velocity);

    // Calculate new position
    const newPosition = {
      x: this.position.x + this.velocity.vx,
      y: this.position.y + this.velocity.vy,
    } as Position;

    // Update position (this will trigger validation and events)
    this.setPosition(newPosition);
    
    // Update position properties for compatibility
    this.setProperty('x', newPosition.x);
    this.setProperty('y', newPosition.y);
  }

  /**
   * Set velocity directly
   */
  setVelocity(vx: number, vy: number): void {
    this.velocity = { vx, vy };
  }

  /**
   * Get current velocity
   */
  getVelocity(): Velocity {
    return { ...this.velocity };
  }

  /**
   * Add force to velocity (acceleration)
   */
  addForce(fx: number, fy: number): void {
    const acceleration = this.movementConfig.acceleration;
    this.velocity = {
      vx: this.velocity.vx + fx * acceleration,
      vy: this.velocity.vy + fy * acceleration,
    };
  }

  /**
   * Apply impulse (instant velocity change)
   */
  applyImpulse(ix: number, iy: number): void {
    this.velocity = {
      vx: this.velocity.vx + ix,
      vy: this.velocity.vy + iy,
    };
  }

  /**
   * Stop agent movement
   */
  stop(): void {
    this.velocity = { vx: 0, vy: 0 };
  }

  /**
   * Set target speed in current direction
   */
  setSpeed(speed: number): void {
    const currentSpeed = this.getSpeed();
    if (currentSpeed > 0) {
      const ratio = speed / currentSpeed;
      this.velocity = {
        vx: this.velocity.vx * ratio,
        vy: this.velocity.vy * ratio,
      };
    }
  }

  /**
   * Get current speed (magnitude of velocity)
   */
  getSpeed(): number {
    return Math.sqrt(
      this.velocity.vx * this.velocity.vx + this.velocity.vy * this.velocity.vy
    );
  }

  /**
   * Get movement direction in radians
   */
  getDirection(): number {
    return Math.atan2(this.velocity.vy, this.velocity.vx);
  }

  /**
   * Move towards a target position
   */
  moveToward(target: Position, force: number = 1.0): void {
    const dx = target.x - this.position.x;
    const dy = target.y - this.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      this.addForce(fx, fy);
    }
  }

  /**
   * Move away from a position
   */
  moveAway(from: Position, force: number = 1.0): void {
    const dx = this.position.x - from.x;
    const dy = this.position.y - from.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      this.addForce(fx, fy);
    }
  }

  /**
   * Apply random movement (wandering behavior)
   */
  wander(strength: number = 0.5): void {
    const randomAngle = Math.random() * 2 * Math.PI;
    const fx = Math.cos(randomAngle) * strength;
    const fy = Math.sin(randomAngle) * strength;
    this.addForce(fx, fy);
  }

  /**
   * Get movement configuration
   */
  getMovementConfig(): MovementConfig {
    return { ...this.movementConfig };
  }

  /**
   * Update movement configuration
   */
  updateMovementConfig(config: Partial<MovementConfig>): void {
    this.movementConfig = { ...this.movementConfig, ...config };
  }

  /**
   * Check if agent is moving
   */
  isMoving(): boolean {
    return this.getSpeed() > 0.001; // Small threshold for floating point precision
  }

  /**
   * Handle boundary collision with environment
   */
  handleBoundaryCollision(bounds: { width: number; height: number }): void {
    let { vx, vy } = this.velocity;

    // Check horizontal boundaries
    if (this.position.x <= 0 || this.position.x >= bounds.width) {
      if (this.movementConfig.bounceOnBoundary) {
        vx = -vx * 0.8; // Some energy loss on bounce
      } else {
        vx = 0;
      }
    }

    // Check vertical boundaries
    if (this.position.y <= 0 || this.position.y >= bounds.height) {
      if (this.movementConfig.bounceOnBoundary) {
        vy = -vy * 0.8; // Some energy loss on bounce
      } else {
        vy = 0;
      }
    }

    this.velocity = { vx, vy };
  }

  /**
   * Apply friction to velocity
   */
  private applyFriction(velocity: Velocity): Velocity {
    const friction = this.movementConfig.friction;
    return {
      vx: velocity.vx * friction,
      vy: velocity.vy * friction,
    };
  }

  /**
   * Limit velocity to maximum speed
   */
  private limitSpeed(velocity: Velocity): Velocity {
    const speed = Math.sqrt(
      velocity.vx * velocity.vx + velocity.vy * velocity.vy
    );
    const maxSpeed = this.movementConfig.maxSpeed;

    if (speed > maxSpeed) {
      const ratio = maxSpeed / speed;
      return {
        vx: velocity.vx * ratio,
        vy: velocity.vy * ratio,
      };
    }

    return velocity;
  }
}
