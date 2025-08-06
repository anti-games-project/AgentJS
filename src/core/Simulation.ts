import { EventEmitter } from 'eventemitter3';
import type { Agent } from './agents/Agent';
import type { Environment } from './environment/Environment';
import type { Scheduler } from './scheduling/Scheduler';
import type { NetworkManager } from './network/NetworkManager';
import type { AgentId } from '../types/core';
import { AgentManager } from './AgentManager';

export interface SimulationRunConfig {
  maxSteps?: number;
  stepInterval?: number;
  autoStart?: boolean;
}

export class Simulation extends EventEmitter {
  private agentManager: AgentManager;
  private environment: Environment;
  private scheduler: Scheduler;
  private networkManager: NetworkManager | undefined;
  private config: SimulationRunConfig;

  private currentStep: number = 0;
  private isRunning: boolean = false;
  private stepTimer: NodeJS.Timeout | undefined;

  constructor(
    environment: Environment,
    scheduler: Scheduler,
    networkManager?: NetworkManager,
    config: SimulationRunConfig = {}
  ) {
    super();
    this.environment = environment;
    this.scheduler = scheduler;
    this.networkManager = networkManager;
    this.agentManager = new AgentManager();

    this.config = {
      maxSteps: 1000,
      stepInterval: 100,
      autoStart: false,
      ...config,
    };
  }

  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.emit('simulation:started');

    if (this.config.stepInterval && this.config.stepInterval > 0) {
      this.stepTimer = setInterval(() => {
        this.step();
      }, this.config.stepInterval);
    }
  }

  public stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.stepTimer) {
      clearInterval(this.stepTimer);
      this.stepTimer = undefined;
    }

    this.emit('simulation:stopped');
  }

  public step(): void {
    if (this.config.maxSteps && this.currentStep >= this.config.maxSteps) {
      this.stop();
      return;
    }

    this.emit('step:start', this.currentStep);

    // Execute scheduler step (which handles all agents)
    this.scheduler.step();

    // Update network if present
    if (this.networkManager) {
      this.networkManager.applyDecay();
    }

    this.currentStep++;
    this.emit('step:complete', this.currentStep - 1);
  }

  public reset(): void {
    this.stop();
    this.currentStep = 0;
    this.agentManager.clear();
    this.emit('simulation:reset');
  }

  // Agent management
  public addAgent(agent: Agent): void {
    this.agentManager.addAgent(agent);
    this.environment.addAgent(agent);
    this.scheduler.addAgent(agent);
    this.emit('agent:added', agent);
  }

  public removeAgent(agent: Agent): void {
    this.agentManager.removeAgent(agent.id);
    this.environment.removeAgent(agent);
    this.scheduler.removeAgent(agent);
    this.emit('agent:removed', agent);
  }

  public getAllAgents(): readonly Agent[] {
    return this.agentManager.getAllAgents();
  }

  public getAgent(id: string): Agent | undefined {
    return this.agentManager.getAgent(id as AgentId);
  }

  // Getters
  public getCurrentStep(): number {
    return this.currentStep;
  }

  public getEnvironment(): Environment {
    return this.environment;
  }

  public getScheduler(): Scheduler {
    return this.scheduler;
  }

  public getNetworkManager(): NetworkManager | undefined {
    return this.networkManager;
  }

  public getAgentManager(): AgentManager {
    return this.agentManager;
  }

  public isSimulationRunning(): boolean {
    return this.isRunning;
  }

  public getConfig(): SimulationRunConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SimulationRunConfig>): void {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning) {
      this.start();
    }

    this.emit('config:updated', this.config);
  }
}
