import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../core/agents/Agent';
import type { Simulation } from '../core/Simulation';

export interface DataPoint {
  timestamp: number;
  step: number;
  value: number;
  metadata?: Record<string, any>;
}

export interface AgentMetrics {
  agentId: string;
  agentType: string;
  properties: Record<string, number>;
  position: { x: number; y: number };
  connections: number;
  timestamp: number;
}

export interface SimulationMetrics {
  timestamp: number;
  step: number;
  totalAgents: number;
  averageAutonomy: number;
  averageResources: number;
  totalConnections: number;
  networkDensity: number;
  populationByType: Record<string, number>;
  spatialDistribution: {
    centerOfMass: { x: number; y: number };
    spread: number;
  };
}

export interface DataCollectorConfig {
  collectInterval: number; // milliseconds
  maxDataPoints: number;
  enableAgentTracking: boolean;
  enableNetworkMetrics: boolean;
  enableSpatialMetrics: boolean;
  customMetrics: string[];
}

export class DataCollector extends EventEmitter {
  private simulation: Simulation;
  private config: DataCollectorConfig;
  private isCollecting: boolean = false;
  private lastCollectionTime: number = 0;
  private _cachedAgents?: Agent[];

  // Data storage
  private timeSeriesData: Map<string, DataPoint[]> = new Map();
  private agentHistory: Map<string, AgentMetrics[]> = new Map();
  private simulationHistory: SimulationMetrics[] = [];
  private customData: Map<string, any[]> = new Map();

  constructor(
    simulation?: Simulation,
    config: Partial<DataCollectorConfig> = {}
  ) {
    super();
    this.simulation = simulation as Simulation;
    this.config = {
      collectInterval: 100, // 10 FPS data collection
      maxDataPoints: 10000,
      enableAgentTracking: true,
      enableNetworkMetrics: true,
      enableSpatialMetrics: true,
      customMetrics: [],
      ...config,
    };

    this.initializeDataSeries();
    if (simulation) {
      this.setupEventListeners();
    }
  }

  private initializeDataSeries(): void {
    // Initialize standard time series
    const standardSeries = [
      'totalAgents',
      'averageAutonomy',
      'averageResources',
      'totalConnections',
      'networkDensity',
    ];

    standardSeries.forEach(series => {
      this.timeSeriesData.set(series, []);
    });

    // Initialize custom metrics
    this.config.customMetrics.forEach(metric => {
      this.timeSeriesData.set(metric, []);
    });
  }

  private setupEventListeners(): void {
    this.simulation.on('step:complete', () => {
      if (this.shouldCollectData()) {
        this.collectData();
      }
    });

    this.simulation.on('agent:created', (agent: Agent) => {
      if (this.config.enableAgentTracking) {
        this.trackAgentCreation(agent);
      }
    });

    this.simulation.on('agent:destroyed', (agent: Agent) => {
      if (this.config.enableAgentTracking) {
        this.trackAgentDestruction(agent);
      }
    });
  }

  private shouldCollectData(): boolean {
    if (!this.isCollecting) return false;

    const now = Date.now();
    return now - this.lastCollectionTime >= this.config.collectInterval;
  }

  private collectData(): void {
    const now = Date.now();
    const step = this.simulation.getCurrentStep();

    // Collect simulation-level metrics
    const simMetrics = this.collectSimulationMetrics(now, step);
    this.simulationHistory.push(simMetrics);

    // Update time series
    this.updateTimeSeries('totalAgents', simMetrics.totalAgents, now, step);
    this.updateTimeSeries(
      'averageAutonomy',
      simMetrics.averageAutonomy,
      now,
      step
    );
    this.updateTimeSeries(
      'averageResources',
      simMetrics.averageResources,
      now,
      step
    );
    this.updateTimeSeries(
      'totalConnections',
      simMetrics.totalConnections,
      now,
      step
    );
    this.updateTimeSeries(
      'networkDensity',
      simMetrics.networkDensity,
      now,
      step
    );

    // Collect agent-level data if enabled
    if (this.config.enableAgentTracking) {
      this.collectAgentMetrics(now);
    }

    // Collect custom metrics
    this.collectCustomMetrics(now, step);

    // Cleanup old data if necessary
    this.cleanupOldData();

    this.lastCollectionTime = now;
    this.emit('data:collected', { timestamp: now, step, metrics: simMetrics });
  }

  private collectSimulationMetrics(
    timestamp: number,
    step: number
  ): SimulationMetrics {
    const agents = this.simulation.getAllAgents();
    const networkManager = this.simulation.getNetworkManager();

    // Basic counts
    const totalAgents = agents.length;
    const totalConnections = networkManager
      ? networkManager.getConnectionCount()
      : 0;

    // Agent property averages
    let totalAutonomy = 0;
    let totalResources = 0;
    const populationByType: Record<string, number> = {};

    agents.forEach(agent => {
      const autonomy = (agent.getProperty('autonomy') as number) || 0;
      const resources = (agent.getProperty('resources') as number) || 0;
      const agentType = (agent.getProperty('type') as string) || 'default';

      totalAutonomy += autonomy;
      totalResources += resources;
      populationByType[agentType] = (populationByType[agentType] || 0) + 1;
    });

    const averageAutonomy = totalAgents > 0 ? totalAutonomy / totalAgents : 0;
    const averageResources = totalAgents > 0 ? totalResources / totalAgents : 0;

    // Network density
    const maxPossibleConnections = (totalAgents * (totalAgents - 1)) / 2;
    const networkDensity =
      maxPossibleConnections > 0
        ? totalConnections / maxPossibleConnections
        : 0;

    // Spatial distribution
    const spatialDistribution = this.calculateSpatialDistribution([...agents]);

    return {
      timestamp,
      step,
      totalAgents,
      averageAutonomy,
      averageResources,
      totalConnections,
      networkDensity,
      populationByType,
      spatialDistribution,
    };
  }

  private calculateSpatialDistribution(agents: Agent[]): {
    centerOfMass: { x: number; y: number };
    spread: number;
  } {
    if (agents.length === 0) {
      return { centerOfMass: { x: 0, y: 0 }, spread: 0 };
    }

    // Calculate center of mass
    let totalX = 0;
    let totalY = 0;

    agents.forEach(agent => {
      const pos = agent.getPosition();
      totalX += pos.x;
      totalY += pos.y;
    });

    const centerOfMass = {
      x: totalX / agents.length,
      y: totalY / agents.length,
    };

    // Calculate spread (average distance from center)
    let totalDistance = 0;
    agents.forEach(agent => {
      const pos = agent.getPosition();
      const distance = Math.sqrt(
        Math.pow(pos.x - centerOfMass.x, 2) +
          Math.pow(pos.y - centerOfMass.y, 2)
      );
      totalDistance += distance;
    });

    const spread = totalDistance / agents.length;

    return { centerOfMass, spread };
  }

  private collectAgentMetrics(timestamp: number): void {
    const agents = this.simulation.getAllAgents();

    agents.forEach(agent => {
      const metrics: AgentMetrics = {
        agentId: agent.id,
        agentType: (agent.getProperty('type') as string) || 'default',
        properties: this.extractNumericProperties(agent),
        position: agent.getPosition(),
        connections: this.getAgentConnectionCount(agent),
        timestamp,
      };

      if (!this.agentHistory.has(agent.id)) {
        this.agentHistory.set(agent.id, []);
      }

      this.agentHistory.get(agent.id)!.push(metrics);
    });
  }

  private extractNumericProperties(agent: Agent): Record<string, number> {
    const properties: Record<string, number> = {};
    const allProps = agent.getAllProperties();

    Object.entries(allProps).forEach(([key, value]) => {
      if (typeof value === 'number') {
        properties[key] = value;
      }
    });

    return properties;
  }

  private getAgentConnectionCount(agent: Agent): number {
    const networkManager = this.simulation.getNetworkManager();
    return networkManager ? networkManager.getConnections(agent.id).length : 0;
  }

  private collectCustomMetrics(timestamp: number, step: number): void {
    this.config.customMetrics.forEach(metricName => {
      const value = this.calculateCustomMetric(metricName);
      if (value !== null) {
        this.updateTimeSeries(metricName, value, timestamp, step);
      }
    });
  }

  private calculateCustomMetric(metricName: string): number | null {
    // Override this method or use events to provide custom metrics
    this.emit('metric:calculate', metricName);
    return null;
  }

  private updateTimeSeries(
    seriesName: string,
    value: number,
    timestamp: number,
    step: number
  ): void {
    if (!this.timeSeriesData.has(seriesName)) {
      this.timeSeriesData.set(seriesName, []);
    }

    const series = this.timeSeriesData.get(seriesName)!;
    series.push({
      timestamp,
      step,
      value,
      metadata: {},
    });
  }

  private trackAgentCreation(agent: Agent): void {
    this.emit('agent:tracked', {
      event: 'created',
      agentId: agent.id,
      timestamp: Date.now(),
    });
  }

  private trackAgentDestruction(agent: Agent): void {
    this.emit('agent:tracked', {
      event: 'destroyed',
      agentId: agent.id,
      timestamp: Date.now(),
    });
  }

  private cleanupOldData(): void {
    // Cleanup time series data
    this.timeSeriesData.forEach((series, _key) => {
      if (series.length > this.config.maxDataPoints) {
        const excess = series.length - this.config.maxDataPoints;
        series.splice(0, excess);
      }
    });

    // Cleanup simulation history
    if (this.simulationHistory.length > this.config.maxDataPoints) {
      const excess = this.simulationHistory.length - this.config.maxDataPoints;
      this.simulationHistory.splice(0, excess);
    }

    // Cleanup agent history
    this.agentHistory.forEach((history, _agentId) => {
      if (history.length > this.config.maxDataPoints) {
        const excess = history.length - this.config.maxDataPoints;
        history.splice(0, excess);
      }
    });
  }

  // Public API methods
  public startCollection(agents?: Agent[]): void {
    this.isCollecting = true;
    this.lastCollectionTime = Date.now();
    this.emit('collection:started');
    
    // If agents are provided, store them for later use
    if (agents) {
      this._cachedAgents = agents;
    }
  }

  public stopCollection(): void {
    this.isCollecting = false;
    this.emit('collection:stopped');
  }

  public getCachedAgents(): Agent[] | undefined {
    return this._cachedAgents;
  }

  public reset(): void {
    this.timeSeriesData.clear();
    this.agentHistory.clear();
    this.simulationHistory = [];
    this.customData.clear();
    this.initializeDataSeries();
    this.emit('data:reset');
  }

  public getTimeSeries(seriesName: string): DataPoint[] {
    return this.timeSeriesData.get(seriesName) || [];
  }

  public getAgentHistory(agentId: string): AgentMetrics[] {
    return this.agentHistory.get(agentId) || [];
  }

  public getSimulationHistory(): SimulationMetrics[] {
    return [...this.simulationHistory];
  }

  public getCurrentMetrics(): SimulationMetrics | null {
    return this.simulationHistory.length > 0
      ? this.simulationHistory[this.simulationHistory.length - 1]!
      : null;
  }

  public getAvailableTimeSeries(): string[] {
    return Array.from(this.timeSeriesData.keys());
  }

  public addCustomMetric(name: string, calculator: () => number): void {
    this.config.customMetrics.push(name);
    this.timeSeriesData.set(name, []);
    this.on('metric:calculate', (metricName: string) => {
      if (metricName === name) {
        const value = calculator();
        this.updateTimeSeries(
          name,
          value,
          Date.now(),
          this.simulation.getCurrentStep()
        );
      }
    });
  }

  public getDataSummary(): {
    timeSeriesCount: number;
    totalDataPoints: number;
    trackedAgents: number;
    collectionActive: boolean;
    lastCollection: number;
  } {
    let totalDataPoints = 0;
    this.timeSeriesData.forEach(series => {
      totalDataPoints += series.length;
    });

    return {
      timeSeriesCount: this.timeSeriesData.size,
      totalDataPoints,
      trackedAgents: this.agentHistory.size,
      collectionActive: this.isCollecting,
      lastCollection: this.lastCollectionTime,
    };
  }
}
