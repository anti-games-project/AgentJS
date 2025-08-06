/**
 * PerformanceBenchmark - Comprehensive performance testing suite
 */

import { EventEmitter } from 'eventemitter3';
import { AgentManager } from '../AgentManager';
import { BaseAgent } from '../agents/BaseAgent';
import { MovingAgent } from '../agents/MovingAgent';
import { NetworkAgent } from '../agents/NetworkAgent';
import { ContinuousSpace } from '../environment/ContinuousSpace';
import { RandomScheduler } from '../scheduling/RandomScheduler';
import { InteractionEngine } from '../interactions/InteractionEngine';
import { NetworkManager } from '../network/NetworkManager';
import { BehaviorTree, BehaviorPatterns } from '../behaviors';
import type { Agent } from '../agents/Agent';

/** Benchmark configuration */
export interface BenchmarkConfig {
  agentCounts: number[];
  iterations: number;
  warmupIterations: number;
  environmentSize: { width: number; height: number };
  enableNetworks: boolean;
  enableBehaviors: boolean;
  enableInteractions: boolean;
  targetFPS: number;
}

/** Benchmark result for a single test */
export interface BenchmarkResult {
  agentCount: number;
  avgStepTime: number;
  minStepTime: number;
  maxStepTime: number;
  medianStepTime: number;
  percentile95: number;
  percentile99: number;
  fps: number;
  memoryUsed: number;
  gcTime: number;
}

/** Complete benchmark report */
export interface BenchmarkReport {
  timestamp: number;
  config: BenchmarkConfig;
  results: BenchmarkResult[];
  summary: {
    maxAgentsAt60FPS: number;
    maxAgentsAt30FPS: number;
    scalabilityFactor: number;
    memoryEfficiency: number;
  };
}

/**
 * PerformanceBenchmark - Tests framework performance at scale
 *
 * Features:
 * - Automated performance testing with various agent counts
 * - FPS and step time measurements
 * - Memory usage profiling
 * - Garbage collection impact analysis
 * - Scalability testing
 * - Performance regression detection
 *
 * Educational Context: Validates that the framework can
 * handle realistic simulation sizes while maintaining
 * acceptable performance for interactive use.
 */
export class PerformanceBenchmark extends EventEmitter {
  private config: BenchmarkConfig;
  private results: BenchmarkResult[];

  constructor(config: Partial<BenchmarkConfig> = {}) {
    super();

    this.config = {
      agentCounts: [10, 50, 100, 500, 1000],
      iterations: 100,
      warmupIterations: 10,
      environmentSize: { width: 1000, height: 1000 },
      enableNetworks: true,
      enableBehaviors: true,
      enableInteractions: true,
      targetFPS: 60,
      ...config,
    };

    this.results = [];
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmark(): Promise<BenchmarkReport> {
    this.results = [];
    const startTime = Date.now();

    this.emit('benchmarkStarted', { config: this.config });

    for (const agentCount of this.config.agentCounts) {
      this.emit('testStarted', { agentCount });

      const result = await this.benchmarkAgentCount(agentCount);
      this.results.push(result);

      this.emit('testCompleted', { agentCount, result });

      // Cool down between tests
      await this.coolDown();
    }

    const report = this.generateReport();

    this.emit('benchmarkCompleted', {
      report,
      duration: Date.now() - startTime,
    });

    return report;
  }

  /**
   * Benchmark specific agent count
   */
  private async benchmarkAgentCount(
    agentCount: number
  ): Promise<BenchmarkResult> {
    // Setup simulation
    const { manager, environment, scheduler, network, behaviors } =
      this.setupSimulation(agentCount);

    // Warmup
    for (let i = 0; i < this.config.warmupIterations; i++) {
      this.stepSimulation(manager, environment, scheduler, network, behaviors);
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }

    // Measure performance
    const stepTimes: number[] = [];
    const memorySnapshots: number[] = [];
    let gcTime = 0;

    for (let i = 0; i < this.config.iterations; i++) {
      const gcStart = Date.now();
      if (global.gc && i % 10 === 0) {
        global.gc();
        gcTime += Date.now() - gcStart;
      }

      const stepStart = performance.now();
      this.stepSimulation(manager, environment, scheduler, network, behaviors);
      const stepTime = performance.now() - stepStart;

      stepTimes.push(stepTime);

      if (i % 10 === 0) {
        const memUsage = process.memoryUsage();
        memorySnapshots.push(memUsage.heapUsed);
      }
    }

    // Calculate statistics
    stepTimes.sort((a, b) => a - b);

    const result: BenchmarkResult = {
      agentCount,
      avgStepTime: this.average(stepTimes),
      minStepTime: stepTimes[0]!,
      maxStepTime: stepTimes[stepTimes.length - 1]!,
      medianStepTime: this.median(stepTimes),
      percentile95: this.percentile(stepTimes, 0.95),
      percentile99: this.percentile(stepTimes, 0.99),
      fps: 1000 / this.average(stepTimes),
      memoryUsed: this.average(memorySnapshots),
      gcTime: gcTime / this.config.iterations,
    };

    // Cleanup
    this.cleanupSimulation(manager, environment, network);

    return result;
  }

  /**
   * Setup simulation with specified agent count
   */
  private setupSimulation(agentCount: number): {
    manager: AgentManager;
    environment: ContinuousSpace;
    scheduler: RandomScheduler;
    network: NetworkManager | null;
    behaviors: Map<string, BehaviorTree> | null;
  } {
    // Create core components
    const manager = new AgentManager({ maxAgents: agentCount * 2 });
    const environment = new ContinuousSpace({
      ...this.config.environmentSize,
      boundaryType: 'periodic',
      enableSpatialIndex: true,
      maxObjectsPerNode: 10,
      maxTreeDepth: 8,
    });
    const scheduler = new RandomScheduler(42); // Fixed seed for reproducibility

    // Create optional components
    let network: NetworkManager | null = null;
    let behaviors: Map<string, BehaviorTree> | null = null;

    if (this.config.enableNetworks) {
      network = new NetworkManager({
        maxConnections: 10,
        enableAutoDecay: false, // Disable for consistent benchmarking
      });
    }

    if (this.config.enableBehaviors) {
      behaviors = new Map();
    }

    // Create agents
    for (let i = 0; i < agentCount; i++) {
      const agentType = i % 3; // Mix of agent types
      let agent: Agent;

      switch (agentType) {
        case 0:
          agent = new BaseAgent(`agent_${i}`, {
            energy: 50 + Math.random() * 50,
            type: 'basic',
          });
          break;

        case 1:
          agent = new MovingAgent(`agent_${i}`, {
            energy: 50 + Math.random() * 50,
            type: 'moving',
          });
          break;

        case 2:
          agent = new NetworkAgent(`agent_${i}`, {
            energy: 50 + Math.random() * 50,
            type: 'network',
          });
          break;

        default:
          agent = new BaseAgent(`agent_${i}`, { type: 'basic' });
      }

      // Random position
      const position = {
        x: Math.random() * this.config.environmentSize.width,
        y: Math.random() * this.config.environmentSize.height,
      } as any; // Type assertion for benchmark purposes

      manager.addAgent(agent);
      environment.addAgent(agent, position);

      // Add behavior if enabled
      if (behaviors && agentType === 1) {
        const tree = new BehaviorTree();
        tree.setRoot(BehaviorPatterns.createBalancedBehavior(environment));
        behaviors.set(agent.id, tree);
      }
    }

    return { manager, environment, scheduler, network, behaviors };
  }

  /**
   * Step simulation once
   */
  private stepSimulation(
    manager: AgentManager,
    environment: ContinuousSpace,
    scheduler: RandomScheduler,
    network: NetworkManager | null,
    behaviors: Map<string, BehaviorTree> | null
  ): void {
    // Get scheduled agents
    const agents = scheduler.schedule(manager.getAllAgents());

    // Execute behaviors
    if (behaviors) {
      for (const agent of agents) {
        const tree = behaviors.get(agent.id);
        if (tree) {
          tree.execute(agent, 16); // ~60 FPS delta time
        }
      }
    }

    // Step agents
    for (const agent of agents) {
      agent.step();
    }

    // Process interactions
    if (this.config.enableInteractions) {
      const interactionEngine = new InteractionEngine();
      interactionEngine.processInteractions(environment);
    }

    // Update network
    if (network && Math.random() < 0.1) {
      // 10% chance per step
      network.applyDecay();
    }

    // Periodic quadtree optimization
    if (Math.random() < 0.05) {
      // 5% chance
      environment.optimizeQuadtree();
    }
  }

  /**
   * Cleanup simulation
   */
  private cleanupSimulation(
    manager: AgentManager,
    _environment: ContinuousSpace,
    network: NetworkManager | null
  ): void {
    manager.clear();
    // Note: Environment clear method will be added in future versions
    network?.clear();
  }

  /**
   * Cool down between tests
   */
  private async coolDown(): Promise<void> {
    return new Promise(resolve => {
      setTimeout(() => {
        if (global.gc) {
          global.gc();
        }
        resolve();
      }, 1000);
    });
  }

  /**
   * Generate benchmark report
   */
  private generateReport(): BenchmarkReport {
    // Find max agents at target FPS
    const maxAgentsAt60FPS = this.findMaxAgentsAtFPS(60);
    const maxAgentsAt30FPS = this.findMaxAgentsAtFPS(30);

    // Calculate scalability factor
    const scalabilityFactor = this.calculateScalabilityFactor();

    // Calculate memory efficiency
    const memoryEfficiency = this.calculateMemoryEfficiency();

    return {
      timestamp: Date.now(),
      config: this.config,
      results: this.results,
      summary: {
        maxAgentsAt60FPS,
        maxAgentsAt30FPS,
        scalabilityFactor,
        memoryEfficiency,
      },
    };
  }

  /**
   * Find maximum agents that maintain target FPS
   */
  private findMaxAgentsAtFPS(targetFPS: number): number {
    for (let i = this.results.length - 1; i >= 0; i--) {
      if (this.results[i]!.fps >= targetFPS) {
        return this.results[i]!.agentCount;
      }
    }
    return 0;
  }

  /**
   * Calculate scalability factor (sublinear is good)
   */
  private calculateScalabilityFactor(): number {
    if (this.results.length < 2) return 1;

    const first = this.results[0]!;
    const last = this.results[this.results.length - 1]!;

    const agentRatio = last.agentCount / first.agentCount;
    const timeRatio = last.avgStepTime / first.avgStepTime;

    return timeRatio / agentRatio; // < 1 means sublinear scaling
  }

  /**
   * Calculate memory efficiency (bytes per agent)
   */
  private calculateMemoryEfficiency(): number {
    if (this.results.length === 0) return 0;

    const efficiencies = this.results.map(r => r.memoryUsed / r.agentCount);
    return this.average(efficiencies);
  }

  /**
   * Statistical helpers
   */
  private average(values: number[]): number {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  private median(values: number[]): number {
    const mid = Math.floor(values.length / 2);
    return values.length % 2
      ? values[mid]!
      : (values[mid - 1]! + values[mid]!) / 2;
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil(values.length * p) - 1;
    return values[Math.max(0, Math.min(index, values.length - 1))]!;
  }

  /**
   * Get configuration
   */
  getConfig(): BenchmarkConfig {
    return { ...this.config };
  }

  /**
   * Get last results
   */
  getLastResults(): BenchmarkResult[] {
    return [...this.results];
  }
}
