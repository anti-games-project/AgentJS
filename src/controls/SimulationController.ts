import { EventEmitter } from 'eventemitter3';
import type { AgentManager } from '../core/AgentManager';
import type { Scheduler } from '../core/scheduling/Scheduler';

/**
 * Simulation state enum
 */
export enum SimulationState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  STEPPING = 'stepping'
}

/**
 * Simulation speed settings
 */
export interface SpeedSettings {
  targetFPS: number;
  speedMultiplier: number;
  maxStepsPerFrame: number;
}

/**
 * Controller events
 */
export interface ControllerEvents {
  'state:changed': (state: SimulationState, previousState: SimulationState) => void;
  'speed:changed': (settings: SpeedSettings) => void;
  'step:complete': (step: number) => void;
  'reset:complete': () => void;
  'error': (error: Error) => void;
}

/**
 * Comprehensive simulation control system
 */
export class SimulationController extends EventEmitter<ControllerEvents> {
  private agentManager: AgentManager;
  private scheduler: Scheduler;
  private state: SimulationState = SimulationState.IDLE;
  private currentStep: number = 0;
  private animationFrameId: number | null = null;
  private lastFrameTime: number = 0;
  private frameAccumulator: number = 0;
  
  private speedSettings: SpeedSettings = {
    targetFPS: 60,
    speedMultiplier: 1,
    maxStepsPerFrame: 5
  };

  private performanceStats = {
    actualFPS: 0,
    stepsPerSecond: 0,
    frameTime: 0,
    stepTime: 0,
    lastUpdateTime: 0,
    frameCount: 0,
    stepCount: 0
  };

  constructor(agentManager: AgentManager, scheduler: Scheduler) {
    super();
    this.agentManager = agentManager;
    this.scheduler = scheduler;
  }

  /**
   * Start or resume the simulation
   */
  play(): void {
    if (this.state === SimulationState.RUNNING) {
      return;
    }

    const previousState = this.state;
    this.state = SimulationState.RUNNING;
    this.lastFrameTime = performance.now();
    this.performanceStats.lastUpdateTime = this.lastFrameTime;
    
    this.emit('state:changed', this.state, previousState);
    this.runSimulation();
  }

  /**
   * Pause the simulation
   */
  pause(): void {
    if (this.state !== SimulationState.RUNNING) {
      return;
    }

    const previousState = this.state;
    this.state = SimulationState.PAUSED;
    
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.emit('state:changed', this.state, previousState);
  }

  /**
   * Stop and reset the simulation
   */
  reset(): void {
    const previousState = this.state;
    
    // Stop animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Reset state
    this.state = SimulationState.IDLE;
    this.currentStep = 0;
    this.frameAccumulator = 0;
    
    // Reset performance stats
    this.performanceStats = {
      actualFPS: 0,
      stepsPerSecond: 0,
      frameTime: 0,
      stepTime: 0,
      lastUpdateTime: 0,
      frameCount: 0,
      stepCount: 0
    };
    
    // Reset simulation components
    try {
      this.agentManager.reset();
      this.scheduler.reset();
      
      this.emit('state:changed', this.state, previousState);
      this.emit('reset:complete');
    } catch (error) {
      this.emit('error', error as Error);
    }
  }

  /**
   * Execute a single simulation step
   */
  step(): void {
    if (this.state === SimulationState.RUNNING) {
      return; // Can't step while running
    }

    const previousState = this.state;
    this.state = SimulationState.STEPPING;
    this.emit('state:changed', this.state, previousState);
    
    try {
      const stepStartTime = performance.now();
      
      // Execute one simulation step
      this.scheduler.step();
      this.currentStep++;
      
      const stepEndTime = performance.now();
      this.performanceStats.stepTime = stepEndTime - stepStartTime;
      
      this.emit('step:complete', this.currentStep);
    } catch (error) {
      this.emit('error', error as Error);
    } finally {
      // Return to previous state (can only be IDLE or PAUSED since we return early if RUNNING)
      this.state = previousState;
      this.emit('state:changed', this.state, SimulationState.STEPPING);
    }
  }

  /**
   * Set simulation speed
   */
  setSpeed(speedMultiplier: number): void {
    this.speedSettings.speedMultiplier = Math.max(0.1, Math.min(10, speedMultiplier));
    this.emit('speed:changed', { ...this.speedSettings });
  }

  /**
   * Set target FPS
   */
  setTargetFPS(fps: number): void {
    this.speedSettings.targetFPS = Math.max(1, Math.min(120, fps));
    this.emit('speed:changed', { ...this.speedSettings });
  }

  /**
   * Set maximum steps per frame
   */
  setMaxStepsPerFrame(steps: number): void {
    this.speedSettings.maxStepsPerFrame = Math.max(1, Math.min(20, steps));
    this.emit('speed:changed', { ...this.speedSettings });
  }

  /**
   * Get current simulation state
   */
  getState(): SimulationState {
    return this.state;
  }

  /**
   * Get current step count
   */
  getCurrentStep(): number {
    return this.currentStep;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Readonly<typeof this.performanceStats> {
    return { ...this.performanceStats };
  }

  /**
   * Get speed settings
   */
  getSpeedSettings(): Readonly<SpeedSettings> {
    return { ...this.speedSettings };
  }

  /**
   * Main simulation loop
   */
  private runSimulation(): void {
    if (this.state !== SimulationState.RUNNING) {
      return;
    }

    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;
    
    // Update performance stats
    this.updatePerformanceStats(currentTime, deltaTime);
    
    // Calculate target frame time based on FPS
    const targetFrameTime = 1000 / this.speedSettings.targetFPS;
    
    // Accumulate time for smooth simulation
    this.frameAccumulator += deltaTime * this.speedSettings.speedMultiplier;
    
    // Execute steps based on accumulated time
    let stepsExecuted = 0;
    const stepStartTime = performance.now();
    
    while (this.frameAccumulator >= targetFrameTime && stepsExecuted < this.speedSettings.maxStepsPerFrame) {
      try {
        this.scheduler.step();
        this.currentStep++;
        stepsExecuted++;
        this.performanceStats.stepCount++;
        this.frameAccumulator -= targetFrameTime;
        
        this.emit('step:complete', this.currentStep);
      } catch (error) {
        this.emit('error', error as Error);
        this.pause();
        return;
      }
    }
    
    const stepEndTime = performance.now();
    if (stepsExecuted > 0) {
      this.performanceStats.stepTime = (stepEndTime - stepStartTime) / stepsExecuted;
    }
    
    // Schedule next frame
    this.animationFrameId = requestAnimationFrame(() => this.runSimulation());
  }

  /**
   * Update performance statistics
   */
  private updatePerformanceStats(currentTime: number, deltaTime: number): void {
    this.performanceStats.frameCount++;
    this.performanceStats.frameTime = deltaTime;
    
    // Update FPS and steps per second every second
    const timeSinceLastUpdate = currentTime - this.performanceStats.lastUpdateTime;
    if (timeSinceLastUpdate >= 1000) {
      this.performanceStats.actualFPS = (this.performanceStats.frameCount * 1000) / timeSinceLastUpdate;
      this.performanceStats.stepsPerSecond = (this.performanceStats.stepCount * 1000) / timeSinceLastUpdate;
      
      // Reset counters
      this.performanceStats.frameCount = 0;
      this.performanceStats.stepCount = 0;
      this.performanceStats.lastUpdateTime = currentTime;
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    this.removeAllListeners();
  }
}

/**
 * Factory function for creating simulation controllers
 */
export function createSimulationController(
  agentManager: AgentManager,
  scheduler: Scheduler
): SimulationController {
  return new SimulationController(agentManager, scheduler);
}