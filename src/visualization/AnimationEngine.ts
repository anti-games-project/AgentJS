/**
 * AnimationEngine - Smooth animation system for visualization
 *
 * Features:
 * - Tweening system for property changes
 * - Multiple easing functions
 * - Animation queue management
 * - Performance-optimized pipeline
 * - Agent position and property animations
 */

import type { AgentId } from '../types/core';

/** Easing function type */
export type EasingFunction = (t: number) => number;

/** Animation target object */
export interface AnimationTarget {
  id: string;
  [key: string]: any;
}

/** Animation configuration */
export interface AnimationConfig {
  target: AnimationTarget;
  property: string;
  from: number;
  to: number;
  duration: number;
  easing: EasingFunction;
  onUpdate?: ((value: number) => void) | undefined;
  onComplete?: (() => void) | undefined;
  delay?: number;
}

/** Animation state */
interface AnimationState {
  config: AnimationConfig;
  startTime: number;
  currentTime: number;
  isComplete: boolean;
  hasStarted: boolean;
}

/**
 * Easing functions for smooth animations
 */
export const Easing = {
  linear: (t: number): number => t,

  easeInQuad: (t: number): number => t * t,
  easeOutQuad: (t: number): number => t * (2 - t),
  easeInOutQuad: (t: number): number =>
    t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

  easeInCubic: (t: number): number => t * t * t,
  easeOutCubic: (t: number): number => --t * t * t + 1,
  easeInOutCubic: (t: number): number =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

  easeInQuart: (t: number): number => t * t * t * t,
  easeOutQuart: (t: number): number => 1 - --t * t * t * t,
  easeInOutQuart: (t: number): number =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,

  easeInBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return c3 * t * t * t - c1 * t * t;
  },
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeInOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c2 = c1 * 1.525;
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
  },

  easeInBounce: (t: number): number => 1 - Easing.easeOutBounce(1 - t),
  easeOutBounce: (t: number): number => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
  easeInOutBounce: (t: number): number =>
    t < 0.5
      ? Easing.easeInBounce(t * 2) * 0.5
      : Easing.easeOutBounce(t * 2 - 1) * 0.5 + 0.5,
};

/**
 * AnimationEngine - Main animation system
 *
 * Educational Context: Provides smooth visual transitions
 * that help users understand agent state changes and
 * movement patterns over time.
 */
export class AnimationEngine {
  /** Active animations map */
  private animations: Map<string, AnimationState> = new Map();

  /** Animation frame ID for cleanup */
  private animationId: number | null = null;

  /** Current time for animations */
  private currentTime: number = 0;

  /** Performance monitoring */
  private readonly stats = {
    activeAnimations: 0,
    completedAnimations: 0,
    lastUpdateTime: 0,
    averageFrameTime: 0,
  };

  /** Whether animation loop is running */
  private isRunning = false;

  constructor() {
    this.startAnimationLoop();
  }

  /**
   * Start the animation loop
   */
  private startAnimationLoop(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentTime = performance.now();

    const animate = (timestamp: number) => {
      this.currentTime = timestamp;
      this.update(timestamp);

      if (this.isRunning) {
        this.animationId = requestAnimationFrame(animate);
      }
    };

    this.animationId = requestAnimationFrame(animate);
  }

  /**
   * Stop the animation loop
   */
  private stopAnimationLoop(): void {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Update all active animations
   */
  update(timestamp: number): void {
    const startTime = performance.now();

    this.stats.activeAnimations = this.animations.size;

    // Update all animations
    const completedAnimations: string[] = [];

    for (const [key, animation] of this.animations) {
      if (this.updateAnimation(animation, timestamp)) {
        completedAnimations.push(key);
      }
    }

    // Remove completed animations
    for (const key of completedAnimations) {
      this.animations.delete(key);
      this.stats.completedAnimations++;
    }

    // Update performance stats
    const frameTime = performance.now() - startTime;
    this.stats.averageFrameTime = (this.stats.averageFrameTime + frameTime) / 2;
    this.stats.lastUpdateTime = timestamp;

    // Auto-stop if no animations are active
    if (this.animations.size === 0 && this.isRunning) {
      this.stopAnimationLoop();
    }
  }

  /**
   * Update a single animation
   */
  private updateAnimation(
    animation: AnimationState,
    timestamp: number
  ): boolean {
    const { config } = animation;

    // Check if animation should start (delay)
    if (!animation.hasStarted) {
      if (config.delay && timestamp - animation.startTime < config.delay) {
        return false; // Not ready to start
      }
      animation.hasStarted = true;
      animation.startTime = timestamp - (config.delay || 0);
    }

    // Calculate progress
    const elapsed = timestamp - animation.startTime;
    const progress = Math.min(elapsed / config.duration, 1);

    // Apply easing
    const easedProgress = config.easing(progress);

    // Calculate current value
    const currentValue =
      config.from + (config.to - config.from) * easedProgress;

    // Update target property
    if (config.target && typeof config.target === 'object') {
      (config.target as any)[config.property] = currentValue;
    }

    // Call update callback
    if (config.onUpdate) {
      config.onUpdate(currentValue);
    }

    // Check if animation is complete
    if (progress >= 1) {
      animation.isComplete = true;
      if (config.onComplete) {
        config.onComplete();
      }
      return true;
    }

    return false;
  }

  /**
   * Animate a property of a target object
   */
  animateProperty(
    target: AnimationTarget,
    property: string,
    to: number,
    duration: number,
    easing: EasingFunction = Easing.easeOutQuad,
    delay: number = 0
  ): string {
    const from = ((target as any)[property] as number) || 0;
    const animationId = `${target.id}_${property}_${Date.now()}`;

    const config: AnimationConfig = {
      target,
      property,
      from,
      to,
      duration,
      easing,
      delay,
    };

    const animation: AnimationState = {
      config,
      startTime: this.currentTime,
      currentTime: this.currentTime,
      isComplete: false,
      hasStarted: delay === 0,
    };

    this.animations.set(animationId, animation);

    // Start animation loop if not running
    if (!this.isRunning) {
      this.startAnimationLoop();
    }

    return animationId;
  }

  /**
   * Animate agent position smoothly
   */
  animateAgentPosition(
    agentId: AgentId,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    duration: number,
    easing: EasingFunction = Easing.easeOutQuad,
    onUpdate?: (x: number, y: number) => void,
    onComplete?: () => void
  ): string[] {
    const target = { id: agentId, x: fromX, y: fromY };

    const animationIds: string[] = [];

    // Animate X position
    const xAnimationId = this.animateProperty(
      target,
      'x',
      toX,
      duration,
      easing
    );
    animationIds.push(xAnimationId);

    // Animate Y position
    const yAnimationId = this.animateProperty(
      target,
      'y',
      toY,
      duration,
      easing
    );
    animationIds.push(yAnimationId);

    // Set up update callback
    if (onUpdate) {
      const xAnimation = this.animations.get(xAnimationId);
      const yAnimation = this.animations.get(yAnimationId);

      if (xAnimation && yAnimation) {
        xAnimation.config.onUpdate = onUpdate ? () => onUpdate(target.x, target.y) : undefined;
        yAnimation.config.onComplete = onComplete || undefined;
      }
    }

    return animationIds;
  }

  /**
   * Animate agent property with visual feedback
   */
  animateAgentProperty(
    agentId: AgentId,
    property: string,
    from: number,
    to: number,
    duration: number,
    easing: EasingFunction = Easing.easeOutQuad,
    onUpdate?: (value: number) => void,
    onComplete?: () => void
  ): string {
    const target = { id: agentId, [property]: from };

    const config: AnimationConfig = {
      target,
      property,
      from,
      to,
      duration,
      easing,
      onUpdate: onUpdate || undefined,
      onComplete: onComplete || undefined,
    };

    const animationId = `${agentId}_${property}_${Date.now()}`;

    const animation: AnimationState = {
      config,
      startTime: this.currentTime,
      currentTime: this.currentTime,
      isComplete: false,
      hasStarted: true,
    };

    this.animations.set(animationId, animation);

    if (!this.isRunning) {
      this.startAnimationLoop();
    }

    return animationId;
  }

  /**
   * Create animation sequence
   */
  sequence(animations: (() => string)[]): string {
    const sequenceId = `sequence_${Date.now()}`;
    let currentIndex = 0;

    const runNext = () => {
      if (currentIndex < animations.length) {
        const animationId = animations[currentIndex]?.();
        currentIndex++;

        // Wait for current animation to complete
        if (animationId) {
          const checkComplete = () => {
            if (!this.animations.has(animationId)) {
              runNext();
            } else {
              setTimeout(checkComplete, 16); // Check every frame
            }
          };
          checkComplete();
        }
      }
    };

    runNext();
    return sequenceId;
  }

  /**
   * Create parallel animations
   */
  parallel(animations: (() => string)[]): string[] {
    return animations.map(anim => anim());
  }

  /**
   * Stop animation by ID
   */
  stopAnimation(animationId: string): boolean {
    return this.animations.delete(animationId);
  }

  /**
   * Stop all animations for a target
   */
  stopAnimationsForTarget(targetId: string): number {
    let stopped = 0;

    for (const [key, animation] of this.animations) {
      if (animation.config.target.id === targetId) {
        this.animations.delete(key);
        stopped++;
      }
    }

    return stopped;
  }

  /**
   * Check if animation is running
   */
  isAnimationRunning(animationId: string): boolean {
    return this.animations.has(animationId);
  }

  /**
   * Get animation progress (0-1)
   */
  getAnimationProgress(animationId: string): number {
    const animation = this.animations.get(animationId);
    if (!animation) return 0;

    const elapsed = this.currentTime - animation.startTime;
    return Math.min(elapsed / animation.config.duration, 1);
  }

  /**
   * Get performance statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Clear all animations
   */
  clear(): void {
    this.animations.clear();
    this.stopAnimationLoop();
  }

  /**
   * Destroy the animation engine
   */
  destroy(): void {
    this.clear();
    this.stopAnimationLoop();
  }
}
