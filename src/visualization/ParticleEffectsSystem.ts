/**
 * ParticleEffectsSystem - Visual feedback through particle effects
 *
 * Features:
 * - Interaction effect particles
 * - Network formation visual feedback
 * - State change celebration effects
 * - Agent movement indicators
 * - Efficient particle system implementation
 * - Multiple effect types and customization
 */

/// <reference path="../types/p5-global.d.ts" />
import type { Agent } from '../core/agents/Agent';
import type { Position } from '../types/core';

/** Create a mutable position object from coordinates */
const createPosition = (x: number, y: number): { x: number; y: number } =>
  ({ x, y });

/** Particle effect types */
export type ParticleEffectType =
  | 'interaction'
  | 'network_formation'
  | 'state_change'
  | 'movement'
  | 'celebration'
  | 'warning'
  | 'resource_transfer'
  | 'explosion'
  | 'sparkle'
  | 'trail'
  | 'custom';

/** Particle configuration */
export interface ParticleConfig {
  type: ParticleEffectType;
  count: number;
  lifetime: number;
  size: number;
  speed: number;
  spread: number;
  gravity: number;
  color: Color | string;
  fadeOut: boolean;
  fadeIn: boolean;
  bounce: boolean;
  trail: boolean;
  blendMode?: BLEND_MODE;
}

/** Individual particle */
interface Particle {
  id: string;
  type: ParticleEffectType;
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  size: number;
  maxSize: number;
  color: Color;
  alpha: number;
  maxAlpha: number;
  age: number;
  lifetime: number;
  isDead: boolean;
  properties: Record<string, any>;
  trail: { x: number; y: number }[];
}

/** Particle effect instance */
interface ParticleEffect {
  id: string;
  type: ParticleEffectType;
  position: { x: number; y: number };
  particles: Particle[];
  config: ParticleConfig;
  startTime: number;
  duration: number;
  isComplete: boolean;
  onComplete?: () => void;
}

/** Effect trigger data */
export interface EffectTrigger {
  type: ParticleEffectType;
  position: { x: number; y: number };
  config?: Partial<ParticleConfig>;
  data?: any;
}

/**
 * ParticleEffectsSystem - Advanced particle effects manager
 *
 * Educational Context: Provides visual feedback for agent
 * interactions and system events, making complex behaviors
 * more observable and engaging for users.
 */
export class ParticleEffectsSystem {
  /** Active particle effects */
  private effects: Map<string, ParticleEffect> = new Map();

  /** Default configurations for different effect types */
  private defaultConfigs: Map<ParticleEffectType, ParticleConfig> = new Map();

  /** p5 instance for rendering */
  private p5Instance: p5Instance | null = null;

  /** Current timestamp */
  private currentTime: number = 0;

  /** Performance statistics */
  private readonly stats = {
    activeEffects: 0,
    totalParticles: 0,
    aliveParticles: 0,
    updateTime: 0,
    renderTime: 0,
  };

  /** Particle pool for performance */
  private particlePool: Particle[] = [];
  private poolSize = 1000;

  /** Effect queue for batch processing */
  private effectQueue: EffectTrigger[] = [];

  constructor() {
    this.initializeDefaultConfigs();
    this.initializeParticlePool();
  }

  /**
   * Initialize default configurations for effect types
   */
  private initializeDefaultConfigs(): void {
    // Interaction effects
    this.defaultConfigs.set('interaction', {
      type: 'interaction',
      count: 8,
      lifetime: 1000,
      size: 3,
      speed: 2,
      spread: 360,
      gravity: 0,
      color: '#4CAF50',
      fadeOut: true,
      fadeIn: false,
      bounce: false,
      trail: false,
    });

    // Network formation effects
    this.defaultConfigs.set('network_formation', {
      type: 'network_formation',
      count: 12,
      lifetime: 2000,
      size: 4,
      speed: 1.5,
      spread: 180,
      gravity: 0,
      color: '#2196F3',
      fadeOut: true,
      fadeIn: true,
      bounce: false,
      trail: true,
    });

    // State change effects
    this.defaultConfigs.set('state_change', {
      type: 'state_change',
      count: 15,
      lifetime: 1500,
      size: 5,
      speed: 3,
      spread: 360,
      gravity: -0.1,
      color: '#FF9800',
      fadeOut: true,
      fadeIn: true,
      bounce: false,
      trail: false,
    });

    // Movement effects
    this.defaultConfigs.set('movement', {
      type: 'movement',
      count: 6,
      lifetime: 800,
      size: 2,
      speed: 1,
      spread: 120,
      gravity: 0,
      color: '#9C27B0',
      fadeOut: true,
      fadeIn: false,
      bounce: false,
      trail: true,
    });

    // Celebration effects
    this.defaultConfigs.set('celebration', {
      type: 'celebration',
      count: 20,
      lifetime: 3000,
      size: 6,
      speed: 4,
      spread: 360,
      gravity: 0.2,
      color: '#FFD700',
      fadeOut: true,
      fadeIn: false,
      bounce: true,
      trail: false,
    });

    // Warning effects
    this.defaultConfigs.set('warning', {
      type: 'warning',
      count: 10,
      lifetime: 1200,
      size: 4,
      speed: 2.5,
      spread: 360,
      gravity: 0,
      color: '#F44336',
      fadeOut: true,
      fadeIn: true,
      bounce: false,
      trail: false,
    });

    // Resource transfer effects
    this.defaultConfigs.set('resource_transfer', {
      type: 'resource_transfer',
      count: 8,
      lifetime: 2500,
      size: 3,
      speed: 1.5,
      spread: 60,
      gravity: 0,
      color: '#4CAF50',
      fadeOut: true,
      fadeIn: true,
      bounce: false,
      trail: true,
    });

    // Explosion effects
    this.defaultConfigs.set('explosion', {
      type: 'explosion',
      count: 25,
      lifetime: 2000,
      size: 8,
      speed: 5,
      spread: 360,
      gravity: 0.3,
      color: '#FF5722',
      fadeOut: true,
      fadeIn: false,
      bounce: true,
      trail: false,
    });

    // Sparkle effects
    this.defaultConfigs.set('sparkle', {
      type: 'sparkle',
      count: 12,
      lifetime: 1800,
      size: 2,
      speed: 0.5,
      spread: 360,
      gravity: 0,
      color: '#FFEB3B',
      fadeOut: true,
      fadeIn: true,
      bounce: false,
      trail: false,
    });
  }

  /**
   * Initialize particle pool for performance
   */
  private initializeParticlePool(): void {
    for (let i = 0; i < this.poolSize; i++) {
      this.particlePool.push(this.createEmptyParticle());
    }
  }

  /**
   * Create empty particle for pool
   */
  private createEmptyParticle(): Particle {
    return {
      id: '',
      type: 'custom',
      position: createPosition(0, 0),
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      size: 0,
      maxSize: 0,
      color: null as any,
      alpha: 0,
      maxAlpha: 255,
      age: 0,
      lifetime: 0,
      isDead: true,
      properties: {},
      trail: [],
    };
  }

  /**
   * Set p5 instance for rendering
   */
  setP5Instance(p5Instance: p5Instance): void {
    this.p5Instance = p5Instance;
    this.initializeColors();
  }

  /**
   * Initialize colors with p5 instance
   */
  private initializeColors(): void {
    if (!this.p5Instance) return;

    // Update default configs with p5 colors
    for (const [_type, config] of this.defaultConfigs) {
      if (typeof config.color === 'string') {
        config.color = this.p5Instance.color(config.color);
      }
    }
  }

  /**
   * Update all particle effects
   */
  update(deltaTime: number): void {
    this.currentTime += deltaTime;
    const startTime = performance.now();

    // Process effect queue
    this.processEffectQueue();

    // Update all active effects
    const completedEffects: string[] = [];
    let totalParticles = 0;
    let aliveParticles = 0;

    for (const [effectId, effect] of this.effects) {
      if (this.updateEffect(effect, deltaTime)) {
        completedEffects.push(effectId);
      }

      totalParticles += effect.particles.length;
      aliveParticles += effect.particles.filter(p => !p.isDead).length;
    }

    // Remove completed effects
    for (const effectId of completedEffects) {
      const effect = this.effects.get(effectId);
      if (effect?.onComplete) {
        effect.onComplete();
      }
      this.effects.delete(effectId);
    }

    // Update statistics
    this.stats.activeEffects = this.effects.size;
    this.stats.totalParticles = totalParticles;
    this.stats.aliveParticles = aliveParticles;
    this.stats.updateTime = performance.now() - startTime;
  }

  /**
   * Process queued effects
   */
  private processEffectQueue(): void {
    for (const trigger of this.effectQueue) {
      this.createEffectFromTrigger(trigger);
    }
    this.effectQueue = [];
  }

  /**
   * Create effect from trigger
   */
  private createEffectFromTrigger(trigger: EffectTrigger): void {
    const defaultConfig = this.defaultConfigs.get(trigger.type);
    if (!defaultConfig) return;

    const config = { ...defaultConfig, ...trigger.config };
    this.createEffect(trigger.type, trigger.position as Position, config, trigger.data);
  }

  /**
   * Update single effect
   */
  private updateEffect(effect: ParticleEffect, deltaTime: number): boolean {
    let aliveParticles = 0;

    for (const particle of effect.particles) {
      if (!particle.isDead) {
        this.updateParticle(particle, deltaTime);
        if (!particle.isDead) {
          aliveParticles++;
        }
      }
    }

    // Check if effect is complete
    const effectAge = this.currentTime - effect.startTime;
    effect.isComplete = aliveParticles === 0 && effectAge > effect.duration;

    return effect.isComplete;
  }

  /**
   * Update single particle
   */
  private updateParticle(particle: Particle, deltaTime: number): void {
    particle.age += deltaTime;

    // Check if particle should die
    if (particle.age >= particle.lifetime) {
      this.killParticle(particle);
      return;
    }

    // Update physics
    particle.velocity.x += particle.acceleration.x * deltaTime;
    particle.velocity.y += particle.acceleration.y * deltaTime;
    particle.position.x += particle.velocity.x * deltaTime;
    particle.position.y += particle.velocity.y * deltaTime;

    // Update visual properties
    const lifeProgress = particle.age / particle.lifetime;

    // Size animation
    particle.size =
      particle.maxSize * this.getLifetimeMultiplier(lifeProgress, 'size');

    // Alpha animation
    particle.alpha =
      particle.maxAlpha * this.getLifetimeMultiplier(lifeProgress, 'alpha');

    // Update trail
    if (particle.trail.length > 0) {
      particle.trail.push(
        createPosition(particle.position.x, particle.position.y)
      );
      if (particle.trail.length > 10) {
        particle.trail.shift();
      }
    }

    // Apply bounce
    if (particle.properties.bounce) {
      this.applyBounce(particle);
    }
  }

  /**
   * Get lifetime multiplier for property animation
   */
  private getLifetimeMultiplier(
    lifeProgress: number,
    property: string
  ): number {
    switch (property) {
      case 'size':
        return Math.sin(lifeProgress * Math.PI); // Grow then shrink
      case 'alpha':
        return 1 - lifeProgress; // Fade out
      default:
        return 1;
    }
  }

  /**
   * Apply bounce physics
   */
  private applyBounce(particle: Particle): void {
    const bounds = this.getBounds();

    if (
      particle.position.x < bounds.minX ||
      particle.position.x > bounds.maxX
    ) {
      particle.velocity.x *= -0.8;
      particle.position.x = Math.max(
        bounds.minX,
        Math.min(bounds.maxX, particle.position.x)
      );
    }

    if (
      particle.position.y < bounds.minY ||
      particle.position.y > bounds.maxY
    ) {
      particle.velocity.y *= -0.8;
      particle.position.y = Math.max(
        bounds.minY,
        Math.min(bounds.maxY, particle.position.y)
      );
    }
  }

  /**
   * Get bounds for particle physics
   */
  private getBounds(): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    return {
      minX: -400,
      maxX: 400,
      minY: -300,
      maxY: 300,
    };
  }

  /**
   * Kill particle and return to pool
   */
  private killParticle(particle: Particle): void {
    particle.isDead = true;

    // Return to pool if space available
    if (this.particlePool.length < this.poolSize) {
      this.resetParticle(particle);
      this.particlePool.push(particle);
    }
  }

  /**
   * Reset particle for pool reuse
   */
  private resetParticle(particle: Particle): void {
    particle.id = '';
    particle.age = 0;
    particle.isDead = true;
    particle.position = createPosition(0, 0);
    particle.velocity = { x: 0, y: 0 };
    particle.acceleration = { x: 0, y: 0 };
    particle.trail = [];
    particle.properties = {};
  }

  /**
   * Get particle from pool or create new one
   */
  private getParticle(): Particle {
    const particle = this.particlePool.pop() || this.createEmptyParticle();
    particle.isDead = false;
    return particle;
  }

  /**
   * Create particle effect
   */
  createEffect(
    type: ParticleEffectType,
    position: Position,
    config?: Partial<ParticleConfig>,
    data?: any
  ): string {
    const defaultConfig = this.defaultConfigs.get(type);
    if (!defaultConfig) return '';

    const finalConfig = { ...defaultConfig, ...config };
    const effectId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const effect: ParticleEffect = {
      id: effectId,
      type,
      position: { ...position },
      particles: [],
      config: finalConfig,
      startTime: this.currentTime,
      duration: finalConfig.lifetime * 1.5,
      isComplete: false,
    };

    // Create particles
    for (let i = 0; i < finalConfig.count; i++) {
      const particle = this.createParticle(effect, i, data);
      effect.particles.push(particle);
    }

    this.effects.set(effectId, effect);
    return effectId;
  }

  /**
   * Create individual particle
   */
  private createParticle(
    effect: ParticleEffect,
    index: number,
    data?: any
  ): Particle {
    const particle = this.getParticle();
    const config = effect.config;

    particle.id = `${effect.id}_${index}`;
    particle.type = effect.type;
    particle.position = createPosition(effect.position.x, effect.position.y);
    particle.lifetime =
      config.lifetime + (Math.random() - 0.5) * config.lifetime * 0.3;
    particle.age = 0;
    particle.maxSize = config.size + (Math.random() - 0.5) * config.size * 0.5;
    particle.size = config.fadeIn ? 0 : particle.maxSize;
    particle.maxAlpha = 255;
    particle.alpha = config.fadeIn ? 0 : 255;
    particle.isDead = false;

    // Set color
    if (this.p5Instance) {
      if (typeof config.color === 'string') {
        particle.color = this.p5Instance.color(config.color);
      } else {
        particle.color = config.color;
      }
    }

    // Set velocity
    const angle = (config.spread / config.count) * index - config.spread / 2;
    const radians = (angle * Math.PI) / 180;
    const speed = config.speed + (Math.random() - 0.5) * config.speed * 0.5;

    particle.velocity = {
      x: Math.cos(radians) * speed,
      y: Math.sin(radians) * speed,
    };

    // Set acceleration (gravity)
    particle.acceleration = {
      x: 0,
      y: config.gravity,
    };

    // Set properties
    particle.properties = {
      bounce: config.bounce,
      trail: config.trail,
      fadeOut: config.fadeOut,
      fadeIn: config.fadeIn,
      ...data,
    };

    // Initialize trail
    if (config.trail) {
      particle.trail = [
        createPosition(particle.position.x, particle.position.y),
      ];
    }

    return particle;
  }

  /**
   * Queue effect for next update
   */
  queueEffect(trigger: EffectTrigger): void {
    this.effectQueue.push(trigger);
  }

  /**
   * Create interaction effect
   */
  createInteractionEffect(
    position: Position,
    interactionType: string = 'default'
  ): string {
    const config: Partial<ParticleConfig> = {};

    switch (interactionType) {
      case 'supportive':
        config.color = '#4CAF50';
        config.count = 8;
        break;
      case 'exploitative':
        config.color = '#F44336';
        config.count = 12;
        break;
      case 'economic':
        config.color = '#FF9800';
        config.count = 10;
        break;
    }

    return this.createEffect('interaction', position, config);
  }

  /**
   * Create network formation effect
   */
  createNetworkFormationEffect(
    sourcePos: Position,
    targetPos: Position
  ): string {
    // Calculate midpoint between connected agents
    const midpoint = createPosition(
      (sourcePos.x + targetPos.x) / 2,
      (sourcePos.y + targetPos.y) / 2
    );

    const config: Partial<ParticleConfig> = {
      spread: 180,
      speed: 2,
    };

    return this.createEffect('network_formation', midpoint as Position, config);
  }

  /**
   * Create state change effect
   */
  createStateChangeEffect(agent: Agent, changeType: string): string {
    const position = agent.position;
    if (!position) return '';

    const config: Partial<ParticleConfig> = {};

    switch (changeType) {
      case 'autonomy_gain':
        config.color = '#4CAF50';
        config.gravity = -0.2;
        break;
      case 'autonomy_loss':
        config.color = '#F44336';
        config.gravity = 0.2;
        break;
      case 'energy_gain':
        config.color = '#FFEB3B';
        config.count = 20;
        break;
      case 'energy_loss':
        config.color = '#FF9800';
        config.count = 15;
        break;
    }

    return this.createEffect('state_change', position, config);
  }

  /**
   * Render all particle effects
   */
  render(sketch: p5Instance): void {
    if (!this.p5Instance) {
      this.p5Instance = sketch;
      this.initializeColors();
    }

    const startTime = performance.now();

    sketch.push();

    for (const effect of this.effects.values()) {
      this.renderEffect(sketch, effect);
    }

    sketch.pop();

    this.stats.renderTime = performance.now() - startTime;
  }

  /**
   * Render single effect
   */
  private renderEffect(sketch: p5Instance, effect: ParticleEffect): void {
    sketch.push();

    // Set blend mode if specified
    if (effect.config.blendMode) {
      sketch.blendMode(effect.config.blendMode);
    }

    for (const particle of effect.particles) {
      if (!particle.isDead) {
        this.renderParticle(sketch, particle);
      }
    }

    sketch.pop();
  }

  /**
   * Render single particle
   */
  private renderParticle(sketch: p5Instance, particle: Particle): void {
    sketch.push();

    // Set color with alpha
    sketch.fill(
      sketch.red(particle.color),
      sketch.green(particle.color),
      sketch.blue(particle.color),
      particle.alpha
    );
    sketch.noStroke();

    // Render trail if enabled
    if (particle.properties.trail && particle.trail.length > 1) {
      sketch.strokeWeight(1);
      sketch.stroke(
        sketch.red(particle.color),
        sketch.green(particle.color),
        sketch.blue(particle.color),
        particle.alpha * 0.3
      );

      for (let i = 0; i < particle.trail.length - 1; i++) {
        const alpha = (i / particle.trail.length) * particle.alpha * 0.5;
        sketch.stroke(
          sketch.red(particle.color),
          sketch.green(particle.color),
          sketch.blue(particle.color),
          alpha
        );
        const point1 = particle.trail[i];
        const point2 = particle.trail[i + 1];
        if (point1 && point2) {
          sketch.line(
            point1.x,
            point1.y,
            point2.x,
            point2.y
          );
        }
      }
    }

    // Render particle
    sketch.noStroke();
    sketch.circle(particle.position.x, particle.position.y, particle.size);

    sketch.pop();
  }

  /**
   * Get effect configuration
   */
  getEffectConfig(type: ParticleEffectType): ParticleConfig | undefined {
    return this.defaultConfigs.get(type);
  }

  /**
   * Update effect configuration
   */
  updateEffectConfig(
    type: ParticleEffectType,
    config: Partial<ParticleConfig>
  ): void {
    const currentConfig = this.defaultConfigs.get(type);
    if (currentConfig) {
      this.defaultConfigs.set(type, { ...currentConfig, ...config });
    }
  }

  /**
   * Stop effect by ID
   */
  stopEffect(effectId: string): boolean {
    const effect = this.effects.get(effectId);
    if (effect) {
      effect.isComplete = true;
      return true;
    }
    return false;
  }

  /**
   * Stop all effects of type
   */
  stopEffectsOfType(type: ParticleEffectType): number {
    let stopped = 0;
    for (const effect of this.effects.values()) {
      if (effect.type === type) {
        effect.isComplete = true;
        stopped++;
      }
    }
    return stopped;
  }

  /**
   * Get performance statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Clear all effects
   */
  clear(): void {
    this.effects.clear();
    this.effectQueue = [];
  }

  /**
   * Destroy the particle system
   */
  destroy(): void {
    this.clear();
    this.particlePool = [];
    this.defaultConfigs.clear();
    this.p5Instance = null;
  }
}
