/**
 * Foundation Features Demo
 * 
 * This example demonstrates all the foundation features implemented in Week 5:
 * - Data Export & Trajectory Tracking
 * - Enhanced Metrics Collection
 * - UI Controls & Parameter Management
 * - Performance Optimization (Viewport Culling & Object Pooling)
 */

import {
  // Core framework
  BaseAgent,
  MovingAgent,
  AgentManager,
  RandomScheduler,
  
  // Analysis & Export
  TrajectoryExporter,
  EnhancedMetrics,
  DataCollector,
  DataExporter,
  
  // Controls
  SimulationController,
  ControlPanel,
  ParameterManager,
  ParameterType,
  
  // Performance
  ViewportCuller,
  setupDefaultPools,
  
  // Visualization
  Visualizer,
  Camera,
  
  // Network
  NetworkManager
} from '../src/index';

/**
 * Demo class showcasing all foundation features
 */
export class FoundationFeaturesDemo {
  private agentManager: AgentManager;
  private scheduler: RandomScheduler;
  private networkManager: NetworkManager;
  private simulationController: SimulationController;
  private parameterManager: ParameterManager;
  private trajectoryExporter: TrajectoryExporter;
  private enhancedMetrics: EnhancedMetrics;
  private viewportCuller: ViewportCuller;
  private controlPanel: ControlPanel | null = null;
  
  constructor() {
    // Initialize core systems
    this.agentManager = new AgentManager({
      maxAgents: 200,
      enablePerformanceMonitoring: true
    });
    
    this.scheduler = new RandomScheduler();
    this.networkManager = new NetworkManager();
    
    // Initialize simulation controller
    this.simulationController = new SimulationController(this.agentManager, this.scheduler);
    
    // Initialize data collection and export systems
    this.trajectoryExporter = new TrajectoryExporter({
      includePosition: true,
      includeVelocity: true,
      sampleRate: 2 // Record every 2nd step
    });
    
    this.enhancedMetrics = new EnhancedMetrics({
      windowSize: 100,
      overlapSize: 50,
      updateInterval: 10
    });
    
    // Initialize performance optimization
    this.viewportCuller = new ViewportCuller(50, {
      enabled: true,
      nearDistance: 100,
      midDistance: 300,
      farDistance: 600
    });
    
    // Setup object pools
    setupDefaultPools();
    
    // Initialize parameter management
    this.setupParameterManager();
    
    // Setup event listeners
    this.setupEventListeners();
  }

  /**
   * Setup parameter management system
   */
  private setupParameterManager(): void {
    this.parameterManager = new ParameterManager();
    
    // Register simulation parameters
    this.parameterManager.registerParameters([
      {
        key: 'agentCount',
        label: 'Number of Agents',
        type: ParameterType.NUMBER,
        defaultValue: 50,
        min: 10,
        max: 200,
        description: 'Total number of agents in the simulation'
      },
      {
        key: 'connectionProbability',
        label: 'Connection Probability',
        type: ParameterType.NUMBER,
        defaultValue: 0.3,
        min: 0,
        max: 1,
        step: 0.01,
        description: 'Probability of agents forming connections'
      },
      {
        key: 'enableNetworks',
        label: 'Enable Social Networks',
        type: ParameterType.BOOLEAN,
        defaultValue: true,
        description: 'Allow agents to form social connections'
      },
      {
        key: 'movementMode',
        label: 'Movement Pattern',
        type: ParameterType.ENUM,
        defaultValue: 'random',
        options: ['random', 'flocking', 'seeking'],
        description: 'Agent movement behavior pattern'
      }
    ]);
    
    // Register parameter change callbacks
    this.parameterManager.onChange('agentCount', (value) => {
      this.updateAgentCount(value as number);
    });
    
    this.parameterManager.onChange('connectionProbability', (value) => {
      this.updateConnectionProbability(value as number);
    });
  }

  /**
   * Setup event listeners for various systems
   */
  private setupEventListeners(): void {
    // Simulation controller events
    this.simulationController.on('step:complete', (step) => {
      this.recordSimulationStep(step);
    });
    
    this.simulationController.on('state:changed', (newState, oldState) => {
      console.log(`Simulation state changed: ${oldState} → ${newState}`);
    });
    
    // Enhanced metrics events
    this.enhancedMetrics.on('metric:added', ({ metric, value, step }) => {
      // Update real-time displays
      this.updateMetricsDisplay(metric, value, step);
    });
    
    // Parameter manager events
    this.parameterManager.on('parameter:changed', (event) => {
      console.log(`Parameter ${event.key} changed: ${event.oldValue} → ${event.newValue}`);
    });
  }

  /**
   * Initialize the simulation with agents
   */
  createSimulation(): void {
    const agentCount = this.parameterManager.getNumber('agentCount');
    const enableNetworks = this.parameterManager.getBoolean('enableNetworks');
    
    // Clear existing agents
    this.agentManager.clear();
    this.scheduler.clear();
    
    // Create agents based on parameters
    for (let i = 0; i < agentCount; i++) {
      const agent = new MovingAgent();
      
      // Set random properties
      agent.setProperty('autonomy', Math.random());
      agent.setProperty('resources', Math.random() * 100);
      agent.setProperty('energy', 50 + Math.random() * 50);
      agent.setProperty('type', this.getRandomAgentType());
      
      // Set random position
      if ('position' in agent) {
        (agent as any).position = {
          x: Math.random() * 800,
          y: Math.random() * 600
        };
      }
      
      // Add to systems
      this.agentManager.addAgent(agent);
      this.scheduler.addAgent(agent);
      
      // Create network connections if enabled
      if (enableNetworks && i > 0) {
        this.createRandomConnections(agent);
      }
    }
    
    console.log(`Created simulation with ${agentCount} agents`);
    this.updateSpatialIndex();
  }

  /**
   * Get random agent type for diversity
   */
  private getRandomAgentType(): string {
    const types = ['community_member', 'support_worker', 'educator', 'leader'];
    return types[Math.floor(Math.random() * types.length)];
  }

  /**
   * Create random network connections for an agent
   */
  private createRandomConnections(agent: BaseAgent): void {
    const connectionProb = this.parameterManager.getNumber('connectionProbability');
    const existingAgents = this.agentManager.getAllAgents();
    
    for (const otherAgent of existingAgents) {
      if (otherAgent.id !== agent.id && Math.random() < connectionProb) {
        const connectionType = Math.random() > 0.7 ? 'supportive' : 'neutral';
        const strength = 0.3 + Math.random() * 0.7;
        
        this.networkManager.addConnection(
          agent.id,
          otherAgent.id,
          connectionType as any,
          strength
        );
      }
    }
  }

  /**
   * Update spatial index for performance optimization
   */
  private updateSpatialIndex(): void {
    const agents = this.agentManager.getAllAgents();
    this.viewportCuller.updateSpatialIndex(agents);
  }

  /**
   * Record simulation step data
   */
  private recordSimulationStep(step: number): void {
    // Record trajectory data
    this.trajectoryExporter.recordTrajectoryStep(this.agentManager, step);
    
    // Calculate and record enhanced metrics
    const agents = this.agentManager.getAllAgents();
    
    // Network metrics
    const networkMetrics = this.enhancedMetrics.calculateNetworkMetrics(
      this.networkManager,
      this.agentManager
    );
    
    // Spatial metrics
    const spatialMetrics = this.enhancedMetrics.calculateSpatialMetrics(
      agents,
      { getDimensions: () => ({ width: 800, height: 600 }) } as any
    );
    
    // Record time-series metrics
    this.enhancedMetrics.addTimeSeriesPoint('networkDensity', networkMetrics.density, step);
    this.enhancedMetrics.addTimeSeriesPoint('spatialDispersion', spatialMetrics.dispersion, step);
    this.enhancedMetrics.addTimeSeriesPoint('agentCount', agents.length, step);
    
    // Average autonomy across all agents
    const avgAutonomy = agents.reduce((sum, agent) => 
      sum + (agent.getProperty('autonomy') as number || 0), 0) / agents.length;
    this.enhancedMetrics.addTimeSeriesPoint('averageAutonomy', avgAutonomy, step);
  }

  /**
   * Create UI control panel
   */
  createControlPanel(container: HTMLElement): void {
    this.controlPanel = new ControlPanel(this.simulationController, {
      container,
      position: 'top-right',
      theme: 'dark',
      showPerformanceStats: true,
      showParameterControls: true
    });
    
    // Connect parameter manager to control panel
    this.controlPanel.setParameterManager(this.parameterManager);
  }

  /**
   * Export simulation data in various formats
   */
  exportData(): {
    trajectories: string;
    network: any;
    environmentalMetrics: any;
    enhancedStats: any;
  } {
    const agents = this.agentManager.getAllAgents();
    const environment = { getDimensions: () => ({ width: 800, height: 600 }) } as any;
    
    return {
      // Export trajectory data as CSV
      trajectories: this.trajectoryExporter.exportTrajectoriesCSV(),
      
      // Export network structure
      network: this.trajectoryExporter.exportNetwork(this.networkManager, this.agentManager),
      
      // Export environmental metrics
      environmentalMetrics: this.trajectoryExporter.exportEnvironmentalMetrics(
        environment,
        this.agentManager
      ),
      
      // Export enhanced metrics statistics
      enhancedStats: {
        autonomy: this.enhancedMetrics.getMovingStatistics('averageAutonomy'),
        networkDensity: this.enhancedMetrics.getMovingStatistics('networkDensity'),
        spatialDispersion: this.enhancedMetrics.getMovingStatistics('spatialDispersion')
      }
    };
  }

  /**
   * Demonstrate viewport culling for performance
   */
  demonstrateViewportCulling(camera: Camera): {
    cullingResult: any;
    performanceStats: any;
  } {
    const agents = this.agentManager.getAllAgents();
    
    // Perform viewport culling
    const cullingResult = this.viewportCuller.cullAgents(agents, camera);
    
    return {
      cullingResult: {
        totalAgents: cullingResult.totalAgents,
        visibleAgents: cullingResult.visibleCount,
        culledAgents: cullingResult.culledCount,
        cullRatio: cullingResult.cullRatio
      },
      performanceStats: this.viewportCuller.getPerformanceStats()
    };
  }

  /**
   * Update metrics display (placeholder for UI integration)
   */
  private updateMetricsDisplay(metric: string, value: number, step: number): void {
    // This would update real-time charts/displays in a full implementation
    if (step % 50 === 0) { // Log every 50 steps to avoid spam
      console.log(`Step ${step}: ${metric} = ${value.toFixed(3)}`);
    }
  }

  /**
   * Update agent count based on parameter change
   */
  private updateAgentCount(newCount: number): void {
    const currentCount = this.agentManager.getAllAgents().length;
    
    if (newCount > currentCount) {
      // Add agents
      for (let i = 0; i < newCount - currentCount; i++) {
        const agent = new MovingAgent();
        agent.setProperty('autonomy', Math.random());
        agent.setProperty('resources', Math.random() * 100);
        this.agentManager.addAgent(agent);
        this.scheduler.addAgent(agent);
      }
    } else if (newCount < currentCount) {
      // Remove agents
      const agents = this.agentManager.getAllAgents();
      for (let i = 0; i < currentCount - newCount; i++) {
        const agent = agents[agents.length - 1 - i];
        this.agentManager.removeAgent(agent.id);
        this.scheduler.removeAgent(agent.id);
      }
    }
    
    this.updateSpatialIndex();
  }

  /**
   * Update connection probability and rebuild network
   */
  private updateConnectionProbability(newProb: number): void {
    // Clear existing connections
    this.networkManager.clear();
    
    // Rebuild network with new probability
    const agents = this.agentManager.getAllAgents();
    for (const agent of agents) {
      this.createRandomConnections(agent);
    }
  }

  /**
   * Get comprehensive performance report
   */
  getPerformanceReport(): any {
    return {
      simulation: this.simulationController.getPerformanceStats(),
      viewport: this.viewportCuller.getPerformanceStats(),
      trajectory: this.trajectoryExporter.getExportSummary(),
      agentManager: this.agentManager.getPerformanceMetrics()
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.simulationController.destroy();
    this.controlPanel?.destroy();
    this.trajectoryExporter.clear();
    this.enhancedMetrics.removeAllListeners();
    this.parameterManager.removeAllListeners();
  }
}

/**
 * Usage example
 */
export function runFoundationDemo(): void {
  console.log('🚀 Starting AgentJS Foundation Features Demo');
  
  // Create demo instance
  const demo = new FoundationFeaturesDemo();
  
  // Create simulation
  demo.createSimulation();
  
  // If running in browser, create control panel
  if (typeof document !== 'undefined') {
    const container = document.body;
    demo.createControlPanel(container);
  }
  
  // Run simulation for 100 steps
  console.log('▶️ Running simulation...');
  
  let stepCount = 0;
  const maxSteps = 100;
  
  const runStep = () => {
    if (stepCount < maxSteps) {
      demo.simulationController.step();
      stepCount++;
      
      // Log progress every 25 steps
      if (stepCount % 25 === 0) {
        console.log(`Progress: ${stepCount}/${maxSteps} steps completed`);
        
        // Show performance stats
        const perfReport = demo.getPerformanceReport();
        console.log('Performance:', perfReport);
      }
      
      // Continue simulation
      setTimeout(runStep, 50);
    } else {
      // Simulation complete - export data
      console.log('✅ Simulation complete! Exporting data...');
      
      const exportedData = demo.exportData();
      console.log('📊 Exported data summary:');
      console.log(`- Trajectory records: ${exportedData.trajectories.split('\n').length - 1}`);
      console.log(`- Network nodes: ${exportedData.network.nodes.length}`);
      console.log(`- Network edges: ${exportedData.network.edges.length}`);
      console.log(`- Environmental metrics: ${Object.keys(exportedData.environmentalMetrics).length} properties`);
      
      // Clean up
      demo.destroy();
      console.log('🏁 Demo completed successfully!');
    }
  };
  
  runStep();
}

// Export for use in other examples
export default FoundationFeaturesDemo;