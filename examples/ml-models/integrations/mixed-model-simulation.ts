/**
 * Mixed Model Simulation - Integration example showing multiple ML models working together
 * 
 * This example demonstrates:
 * - Using off-the-shelf models for general behaviors
 * - Applying domain-specific models for specialized agents
 * - Performance comparison between ML and rule-based agents
 * - Real-time model switching and adaptation
 */

import { 
  AgentManager, 
  ContinuousSpace, 
  RandomScheduler,
  MLAgent,
  ModelRegistry,
  MLPerformanceManager
} from '../../../src';

// Import our example models
import { GeneralBehaviorModel } from '../off-the-shelf/GeneralBehaviorModel';
import { StarlingMurmurationModel } from '../domain-specific/bird-flocking/StarlingMurmurationModel';
import { StockTradingModel } from '../domain-specific/economic-modeling/StockTradingModel';

export interface SimulationConfig {
  environmentSize: { width: number; height: number };
  agentCounts: {
    generalAgents: number;
    birdAgents: number;
    traderAgents: number;
    ruleBasedAgents: number;
  };
  simulationSteps: number;
  performanceMonitoring: boolean;
  modelComparison: boolean;
}

export class MixedModelSimulation {
  private agentManager: AgentManager;
  private environment: ContinuousSpace;
  private scheduler: RandomScheduler;
  private modelRegistry: ModelRegistry;
  private performanceManager: MLPerformanceManager;
  private config: SimulationConfig;
  
  // Performance tracking
  private performanceMetrics: Map<string, any[]> = new Map();
  private startTime: number = 0;

  constructor(config: Partial<SimulationConfig> = {}) {
    this.config = {
      environmentSize: { width: 1000, height: 800 },
      agentCounts: {
        generalAgents: 20,
        birdAgents: 30,
        traderAgents: 10,
        ruleBasedAgents: 15
      },
      simulationSteps: 500,
      performanceMonitoring: true,
      modelComparison: true,
      ...config
    };

    // Initialize core components
    this.environment = new ContinuousSpace(
      this.config.environmentSize.width,
      this.config.environmentSize.height,
      'periodic'
    );
    
    this.scheduler = new RandomScheduler();
    this.agentManager = new AgentManager(this.environment, this.scheduler);
    this.modelRegistry = ModelRegistry.getInstance();
    this.performanceManager = MLPerformanceManager.getInstance();

    // Configure performance manager for real-time inference
    this.performanceManager.configure({
      batchSize: 16,
      batchTimeout: 16, // 60 FPS
      maxQueueSize: 500
    });
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Mixed Model Simulation...');

    // Load and register all ML models
    await this.loadModels();

    // Create different types of agents
    await this.createAgents();

    // Set up performance monitoring
    if (this.config.performanceMonitoring) {
      this.setupPerformanceMonitoring();
    }

    console.log('✅ Simulation initialized successfully');
    console.log(`📊 Total agents: ${this.agentManager.getAllAgents().length}`);
  }

  private async loadModels(): Promise<void> {
    console.log('📦 Loading ML models...');

    try {
      // Load general behavior model (simulated - would be actual model file)
      const generalModel = new GeneralBehaviorModel({
        explorationRate: 0.4,
        socialInfluence: 0.6,
        resourceSeeking: 0.8
      });
      await this.modelRegistry.registerModelFromInstance('general-behavior', generalModel);

      // Load starling flocking model
      const starlingModel = new StarlingMurmurationModel({
        separationRadius: 2.0,
        alignmentRadius: 6.0,
        cohesionRadius: 15.0,
        maxSpeed: 12.0,
        predatorAvoidanceRadius: 50.0
      });
      await this.modelRegistry.registerModelFromInstance('starling-flocking', starlingModel);

      // Load stock trading model
      const tradingModel = new StockTradingModel({
        riskTolerance: 0.4,
        technicalWeight: 0.5,
        sentimentWeight: 0.3,
        herding: 0.3
      });
      await this.modelRegistry.registerModelFromInstance('stock-trading', tradingModel);

      console.log('✅ All models loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load models:', error);
      throw error;
    }
  }

  private async createAgents(): Promise<void> {
    console.log('👥 Creating agents...');

    const agents = [];

    // Create general behavior agents
    for (let i = 0; i < this.config.agentCounts.generalAgents; i++) {
      const agent = new MLAgent(`general-${i}`, {
        type: 'general',
        energy: 50 + Math.random() * 50,
        age: Math.random() * 100,
        speed: 1 + Math.random() * 3,
        mlEnabled: true,
        fallbackEnabled: true
      });

      agent.position = {
        x: Math.random() * this.config.environmentSize.width,
        y: Math.random() * this.config.environmentSize.height
      };

      await agent.setMLModel('general-behavior');
      agents.push(agent);
    }

    // Create bird flocking agents
    for (let i = 0; i < this.config.agentCounts.birdAgents; i++) {
      const agent = new MLAgent(`bird-${i}`, {
        type: 'starling',
        energy: 80 + Math.random() * 20,
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10
        },
        mlEnabled: true,
        fallbackEnabled: true
      });

      // Start birds in flocking formation
      const flockCenter = {
        x: this.config.environmentSize.width * 0.3,
        y: this.config.environmentSize.height * 0.5
      };
      
      agent.position = {
        x: flockCenter.x + (Math.random() - 0.5) * 100,
        y: flockCenter.y + (Math.random() - 0.5) * 100
      };

      await agent.setMLModel('starling-flocking');
      agents.push(agent);
    }

    // Create trading agents
    for (let i = 0; i < this.config.agentCounts.traderAgents; i++) {
      const agent = new MLAgent(`trader-${i}`, {
        type: 'trader',
        cash: 50000 + Math.random() * 100000,
        position: 0,
        portfolioValue: 50000 + Math.random() * 100000,
        unrealizedPnL: 0,
        realizedPnL: 0,
        mlEnabled: true,
        fallbackEnabled: true
      });

      agent.position = {
        x: this.config.environmentSize.width * 0.7 + Math.random() * 200,
        y: this.config.environmentSize.height * 0.3 + Math.random() * 200
      };

      await agent.setMLModel('stock-trading');
      agents.push(agent);
    }

    // Create rule-based agents for comparison
    for (let i = 0; i < this.config.agentCounts.ruleBasedAgents; i++) {
      const agent = new MLAgent(`rule-${i}`, {
        type: 'rule-based',
        energy: 50 + Math.random() * 50,
        mlEnabled: false, // Pure rule-based behavior
        fallbackEnabled: true
      });

      agent.position = {
        x: Math.random() * this.config.environmentSize.width,
        y: Math.random() * this.config.environmentSize.height
      };

      agents.push(agent);
    }

    // Add all agents to the manager
    for (const agent of agents) {
      await this.agentManager.addAgent(agent);
    }

    console.log(`✅ Created ${agents.length} agents of different types`);
  }

  private setupPerformanceMonitoring(): void {
    console.log('📈 Setting up performance monitoring...');

    // Initialize metrics tracking
    this.performanceMetrics.set('ml_inference_times', []);
    this.performanceMetrics.set('rule_based_times', []);
    this.performanceMetrics.set('agent_behaviors', []);
    this.performanceMetrics.set('model_accuracy', []);
    this.performanceMetrics.set('memory_usage', []);

    // Set up periodic metrics collection
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 1000); // Collect metrics every second
  }

  private collectPerformanceMetrics(): void {
    const mlMetrics = this.performanceManager.getPerformanceMetrics();
    const agentMetrics = this.agentManager.getPerformanceMetrics();

    // ML inference performance
    this.performanceMetrics.get('ml_inference_times')?.push({
      timestamp: Date.now(),
      avgTime: mlMetrics.avgPredictionTime,
      totalPredictions: mlMetrics.totalPredictions,
      errorRate: mlMetrics.errorRate
    });

    // Memory usage
    this.performanceMetrics.get('memory_usage')?.push({
      timestamp: Date.now(),
      tensorflow: mlMetrics.memoryUsage,
      total: (performance as any).memory?.usedJSHeapSize / 1024 / 1024 || 0
    });

    // Agent behavior analysis
    const agents = this.agentManager.getAllAgents() as MLAgent[];
    const behaviorStats = this.analyzeBehaviorPatterns(agents);
    this.performanceMetrics.get('agent_behaviors')?.push({
      timestamp: Date.now(),
      ...behaviorStats
    });
  }

  private analyzeBehaviorPatterns(agents: MLAgent[]): any {
    const stats = {
      mlAgents: 0,
      ruleBasedAgents: 0,
      totalActions: 0,
      actionTypes: {} as Record<string, number>,
      avgConfidence: 0
    };

    let totalConfidence = 0;
    let confidenceCount = 0;

    agents.forEach(agent => {
      const isMLEnabled = agent.getProperty('mlEnabled');
      if (isMLEnabled) {
        stats.mlAgents++;
        const predictionStats = agent.getPredictionStats();
        if (predictionStats) {
          totalConfidence += predictionStats.avgConfidence || 0;
          confidenceCount++;
        }
      } else {
        stats.ruleBasedAgents++;
      }

      const lastAction = agent.getProperty('lastAction');
      if (lastAction) {
        stats.totalActions++;
        stats.actionTypes[lastAction.type] = (stats.actionTypes[lastAction.type] || 0) + 1;
      }
    });

    stats.avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

    return stats;
  }

  async run(): Promise<void> {
    console.log('🎮 Starting Mixed Model Simulation...');
    this.startTime = Date.now();

    for (let step = 0; step < this.config.simulationSteps; step++) {
      await this.stepSimulation(step);

      // Log progress every 100 steps
      if (step % 100 === 0) {
        const elapsed = (Date.now() - this.startTime) / 1000;
        const stepsPerSecond = step / elapsed;
        console.log(`📊 Step ${step}/${this.config.simulationSteps} (${stepsPerSecond.toFixed(1)} steps/sec)`);
      }

      // Adaptive model switching demo
      if (step === 200) {
        await this.demonstrateModelSwitching();
      }

      // Performance comparison at midpoint
      if (step === Math.floor(this.config.simulationSteps / 2)) {
        this.generatePerformanceReport();
      }
    }

    console.log('✅ Simulation completed');
    this.generateFinalReport();
  }

  private async stepSimulation(step: number): Promise<void> {
    // Update environment state
    this.updateEnvironment(step);

    // Execute agent steps (this will use ML models automatically)
    await this.agentManager.step();

    // Update model performance tracking
    if (this.config.performanceMonitoring && step % 10 === 0) {
      this.collectPerformanceMetrics();
    }
  }

  private updateEnvironment(step: number): void {
    // Add dynamic environmental factors for different agent types

    // For bird agents - simulate predators occasionally
    if (step % 150 === 0) {
      this.addTemporaryPredator();
    }

    // For trading agents - update market conditions
    this.updateMarketConditions(step);

    // General environmental updates
    const agents = this.agentManager.getAllAgents();
    agents.forEach(agent => {
      agent.setProperty('environment', {
        currentStep: step,
        temperature: 0.5 + 0.3 * Math.sin(step / 100), // Simulate temperature cycles
        lightLevel: 0.3 + 0.7 * Math.abs(Math.sin(step / 200)), // Day/night cycles
        nearbyResources: this.generateNearbyResources(agent.position)
      });
    });
  }

  private addTemporaryPredator(): void {
    const birdAgents = this.agentManager.getAllAgents().filter(agent => 
      agent.getProperty('type') === 'starling'
    );

    if (birdAgents.length > 0) {
      const randomBird = birdAgents[Math.floor(Math.random() * birdAgents.length)];
      const predatorPos = {
        x: randomBird.position.x + (Math.random() - 0.5) * 200,
        y: randomBird.position.y + (Math.random() - 0.5) * 200
      };

      // Add predator to environment for all bird agents
      birdAgents.forEach(bird => {
        const currentEnv = bird.getProperty('environment') || {};
        bird.setProperty('environment', {
          ...currentEnv,
          predators: [{
            position: predatorPos,
            velocity: { x: (Math.random() - 0.5) * 20, y: (Math.random() - 0.5) * 20 },
            threatLevel: 0.8 + Math.random() * 0.2
          }]
        });
      });

      // Remove predator after 20 steps
      setTimeout(() => {
        birdAgents.forEach(bird => {
          const currentEnv = bird.getProperty('environment') || {};
          bird.setProperty('environment', {
            ...currentEnv,
            predators: []
          });
        });
      }, 20 * 100); // Assuming 100ms per step
    }
  }

  private updateMarketConditions(step: number): void {
    const traderAgents = this.agentManager.getAllAgents().filter(agent => 
      agent.getProperty('type') === 'trader'
    );

    if (traderAgents.length > 0) {
      // Simulate market price movements
      const basePrice = 100;
      const currentPrice = basePrice + 20 * Math.sin(step / 50) + 5 * Math.sin(step / 10);
      const volatility = 0.1 + 0.05 * Math.abs(Math.sin(step / 75));
      
      const marketEnv = {
        currentPrice,
        priceHistory: this.generatePriceHistory(currentPrice, step),
        volume: 1000000 + Math.random() * 500000,
        volatility,
        marketSentiment: Math.sin(step / 100) * 0.5,
        interestRate: 0.03,
        marketCap: currentPrice * 1000000,
        orderBook: {
          bids: [{ price: currentPrice - 0.1, volume: 1000 }],
          asks: [{ price: currentPrice + 0.1, volume: 1000 }]
        }
      };

      traderAgents.forEach(trader => {
        const currentEnv = trader.getProperty('environment') || {};
        trader.setProperty('environment', {
          ...currentEnv,
          ...marketEnv
        });
      });
    }
  }

  private generatePriceHistory(currentPrice: number, step: number): number[] {
    const history = [];
    for (let i = Math.max(0, step - 50); i <= step; i++) {
      const basePrice = 100;
      const price = basePrice + 20 * Math.sin(i / 50) + 5 * Math.sin(i / 10) + (Math.random() - 0.5) * 2;
      history.push(price);
    }
    return history;
  }

  private generateNearbyResources(position: any): any[] {
    const resources = [];
    for (let i = 0; i < Math.random() * 3; i++) {
      resources.push({
        position: {
          x: position.x + (Math.random() - 0.5) * 100,
          y: position.y + (Math.random() - 0.5) * 100
        },
        value: Math.random() * 10,
        type: 'energy'
      });
    }
    return resources;
  }

  private async demonstrateModelSwitching(): Promise<void> {
    console.log('🔄 Demonstrating adaptive model switching...');

    const generalAgents = this.agentManager.getAllAgents().filter(agent => 
      agent.getProperty('type') === 'general'
    ) as MLAgent[];

    // Switch some general agents to use rule-based behavior
    const agentsToSwitch = generalAgents.slice(0, Math.floor(generalAgents.length / 2));
    
    for (const agent of agentsToSwitch) {
      agent.enableML(false); // Switch to rule-based
      agent.setProperty('switchTime', Date.now());
    }

    console.log(`🔄 Switched ${agentsToSwitch.length} agents to rule-based behavior`);

    // Switch them back after 50 steps
    setTimeout(async () => {
      for (const agent of agentsToSwitch) {
        agent.enableML(true); // Switch back to ML
        agent.setProperty('switchBackTime', Date.now());
      }
      console.log(`🔄 Switched ${agentsToSwitch.length} agents back to ML behavior`);
    }, 50 * 100);
  }

  private generatePerformanceReport(): void {
    console.log('\n📊 === MIDPOINT PERFORMANCE REPORT ===');

    const mlMetrics = this.performanceManager.getPerformanceMetrics();
    const agents = this.agentManager.getAllAgents() as MLAgent[];

    // ML Performance
    console.log('🤖 ML Model Performance:');
    console.log(`   Average inference time: ${mlMetrics.avgPredictionTime.toFixed(2)}ms`);
    console.log(`   Total predictions: ${mlMetrics.totalPredictions}`);
    console.log(`   Error rate: ${(mlMetrics.errorRate * 100).toFixed(1)}%`);
    console.log(`   Memory usage: ${mlMetrics.memoryUsage.toFixed(1)}MB`);

    // Agent Behavior Analysis
    const mlAgents = agents.filter(a => a.getProperty('mlEnabled'));
    const ruleAgents = agents.filter(a => !a.getProperty('mlEnabled'));

    console.log('\n👥 Agent Behavior Analysis:');
    console.log(`   ML-enabled agents: ${mlAgents.length}`);
    console.log(`   Rule-based agents: ${ruleAgents.length}`);

    // Model-specific performance
    const modelPerformance = new Map();
    mlAgents.forEach(agent => {
      const modelName = agent.getProperty('currentModel');
      const stats = agent.getPredictionStats();
      if (modelName && stats) {
        if (!modelPerformance.has(modelName)) {
          modelPerformance.set(modelName, { agents: 0, avgConfidence: 0, successRate: 0 });
        }
        const perf = modelPerformance.get(modelName);
        perf.agents++;
        perf.avgConfidence += stats.avgConfidence || 0;
        perf.successRate += stats.successRate || 0;
      }
    });

    console.log('\n🎯 Model-Specific Performance:');
    modelPerformance.forEach((perf, modelName) => {
      console.log(`   ${modelName}:`);
      console.log(`     Agents: ${perf.agents}`);
      console.log(`     Avg Confidence: ${(perf.avgConfidence / perf.agents).toFixed(2)}`);
      console.log(`     Success Rate: ${(perf.successRate / perf.agents * 100).toFixed(1)}%`);
    });

    console.log('=================================\n');
  }

  private generateFinalReport(): void {
    const totalTime = (Date.now() - this.startTime) / 1000;
    const stepsPerSecond = this.config.simulationSteps / totalTime;

    console.log('\n🎯 === FINAL SIMULATION REPORT ===');
    console.log(`⏱️  Total simulation time: ${totalTime.toFixed(2)}s`);
    console.log(`🏃 Average steps per second: ${stepsPerSecond.toFixed(2)}`);

    // Performance metrics summary
    const mlMetrics = this.performanceManager.getPerformanceMetrics();
    console.log('\n📈 Overall Performance:');
    console.log(`   Total ML predictions: ${mlMetrics.totalPredictions}`);
    console.log(`   Average inference time: ${mlMetrics.avgPredictionTime.toFixed(2)}ms`);
    console.log(`   Peak memory usage: ${mlMetrics.memoryUsage.toFixed(1)}MB`);
    console.log(`   Final error rate: ${(mlMetrics.errorRate * 100).toFixed(1)}%`);

    // Generate performance comparison chart data
    if (this.config.modelComparison) {
      this.generateModelComparisonData();
    }

    console.log('=================================\n');
  }

  private generateModelComparisonData(): void {
    console.log('📊 Model Comparison Data:');
    
    const agents = this.agentManager.getAllAgents() as MLAgent[];
    const modelStats = new Map();

    agents.forEach(agent => {
      const type = agent.getProperty('type');
      const isMLEnabled = agent.getProperty('mlEnabled');
      const category = isMLEnabled ? `${type}_ml` : `${type}_rule`;

      if (!modelStats.has(category)) {
        modelStats.set(category, {
          agentCount: 0,
          totalSteps: 0,
          avgPerformance: 0
        });
      }

      const stats = modelStats.get(category);
      stats.agentCount++;
      
      // Add more detailed performance metrics here
      const predictionStats = agent.getPredictionStats();
      if (predictionStats) {
        stats.avgPerformance += predictionStats.successRate || 0;
      }
    });

    modelStats.forEach((stats, category) => {
      stats.avgPerformance /= stats.agentCount;
      console.log(`   ${category}: ${stats.agentCount} agents, ${(stats.avgPerformance * 100).toFixed(1)}% performance`);
    });
  }

  // Public methods for external control
  public getPerformanceMetrics(): Map<string, any[]> {
    return this.performanceMetrics;
  }

  public getAgentManager(): AgentManager {
    return this.agentManager;
  }

  public getModelRegistry(): ModelRegistry {
    return this.modelRegistry;
  }

  public async addAgent(agent: MLAgent, modelName?: string): Promise<void> {
    if (modelName) {
      await agent.setMLModel(modelName);
    }
    await this.agentManager.addAgent(agent);
  }

  public dispose(): void {
    this.performanceManager.dispose();
    this.modelRegistry.dispose();
    this.performanceMetrics.clear();
  }
}

// Example usage
export async function runMixedModelExample(): Promise<void> {
  const simulation = new MixedModelSimulation({
    agentCounts: {
      generalAgents: 15,
      birdAgents: 25,
      traderAgents: 8,
      ruleBasedAgents: 12
    },
    simulationSteps: 300,
    performanceMonitoring: true,
    modelComparison: true
  });

  try {
    await simulation.initialize();
    await simulation.run();
  } catch (error) {
    console.error('❌ Simulation failed:', error);
  } finally {
    simulation.dispose();
  }
}

// Auto-run if this file is executed directly
if (typeof window === 'undefined' && require.main === module) {
  runMixedModelExample().catch(console.error);
}