/**
 * ML-Enhanced Agent Simulation Example
 * 
 * This example demonstrates how to use the AgentJS ML infrastructure
 * with different types of intelligent agent behaviors.
 */

import {
  AgentManager,
  ContinuousSpace,
  RandomScheduler,
  MLAgent,
  ModelRegistry,
  MLPerformanceManager,
  FlockingMLModel,
  EconomicMLModel,
  NetworkFormationModel,
  GenericDataCollector
} from '../src/index';

/**
 * Example 1: Basic ML Agent Setup
 */
async function basicMLAgentExample() {
  console.log('=== Basic ML Agent Example ===');
  
  // Set up environment
  const environment = new ContinuousSpace({
    width: 800,
    height: 600,
    boundaryType: 'periodic'
  });
  
  const scheduler = new RandomScheduler();
  const agentManager = new AgentManager(environment, scheduler);
  
  // Create ML-enhanced agent
  const mlAgent = new MLAgent('ml-agent-1', {
    energy: 100,
    autonomy: 75,
    mlEnabled: true,
    fallbackEnabled: true
  });
  
  // Set up flocking model
  const flockingModel = new FlockingMLModel();
  flockingModel.configure({
    separationWeight: 1.2,
    alignmentWeight: 1.0,
    cohesionWeight: 0.8,
    maxSpeed: 8
  });
  
  // Register and assign model
  const registry = ModelRegistry.getInstance();
  await registry.registerCustomModel('flocking', flockingModel);
  await mlAgent.setMLModel('flocking');
  
  // Add to simulation
  await agentManager.addAgent(mlAgent);
  
  // Test prediction
  const action = await mlAgent.step();
  console.log('Agent action:', action);
  console.log('Prediction stats:', mlAgent.getPredictionStats());
}

/**
 * Example 2: Multi-Model Simulation
 */
async function multiModelSimulationExample() {
  console.log('\n=== Multi-Model Simulation Example ===');
  
  const environment = new ContinuousSpace({
    width: 1000,
    height: 800,
    boundaryType: 'reflective'
  });
  
  const scheduler = new RandomScheduler();
  const agentManager = new AgentManager(environment, scheduler);
  const registry = ModelRegistry.getInstance();
  
  // Register different models
  const flockingModel = new FlockingMLModel();
  const economicModel = new EconomicMLModel();
  const networkModel = new NetworkFormationModel();
  
  await registry.registerCustomModel('flocking', flockingModel);
  await registry.registerCustomModel('economic', economicModel);
  await registry.registerCustomModel('network', networkModel);
  
  // Create agents with different behaviors
  const agents = [];
  
  // Flocking agents (birds/swarm behavior)
  for (let i = 0; i < 15; i++) {
    const agent = new MLAgent(`flock-${i}`, {
      energy: 80 + Math.random() * 40,
      velocityX: (Math.random() - 0.5) * 10,
      velocityY: (Math.random() - 0.5) * 10,
      mlEnabled: true
    });
    
    agent.position = {
      x: 200 + Math.random() * 200,
      y: 200 + Math.random() * 200
    };
    
    await agent.setMLModel('flocking');
    agents.push(agent);
  }
  
  // Economic agents (traders)
  for (let i = 0; i < 10; i++) {
    const agent = new MLAgent(`trader-${i}`, {
      wealth: 100 + Math.random() * 200,
      resources: 20 + Math.random() * 60,
      riskTolerance: Math.random(),
      mlEnabled: true
    });
    
    agent.position = {
      x: 600 + Math.random() * 200,
      y: 300 + Math.random() * 200
    };
    
    await agent.setMLModel('economic');
    agents.push(agent);
  }
  
  // Social agents (network builders)
  for (let i = 0; i < 8; i++) {
    const agent = new MLAgent(`social-${i}`, {
      socialEnergy: 60 + Math.random() * 40,
      trust: 40 + Math.random() * 60,
      socialCapacity: 5 + Math.floor(Math.random() * 10),
      mlEnabled: true
    });
    
    agent.position = {
      x: 400 + Math.random() * 200,
      y: 500 + Math.random() * 200
    };
    
    await agent.setMLModel('network');
    agents.push(agent);
  }
  
  // Add all agents to manager
  for (const agent of agents) {
    await agentManager.addAgent(agent);
  }
  
  console.log(`Created ${agents.length} agents with different ML models`);
  console.log('Available models:', registry.listModels());
}

/**
 * Example 3: Performance Optimization with Batch Processing
 */
async function performanceOptimizedExample() {
  console.log('\n=== Performance Optimized Simulation ===');
  
  const performanceManager = MLPerformanceManager.getInstance();
  
  // Configure for optimal performance
  performanceManager.configure({
    batchSize: 32,        // Process 32 agents at once
    batchTimeout: 16,     // ~60 FPS
    maxQueueSize: 1000    // Allow up to 1000 queued predictions
  });
  
  // Create many agents to test batching
  const environment = new ContinuousSpace({
    width: 1500,
    height: 1200,
    boundaryType: 'periodic'
  });
  
  const scheduler = new RandomScheduler();
  const agentManager = new AgentManager(environment, scheduler);
  const registry = ModelRegistry.getInstance();
  
  // Register flocking model
  const flockingModel = new FlockingMLModel();
  await registry.registerCustomModel('flocking', flockingModel);
  
  // Create 100 agents for performance testing
  const agents = [];
  for (let i = 0; i < 100; i++) {
    const agent = new MLAgent(`perf-agent-${i}`, {
      energy: 50 + Math.random() * 50,
      velocityX: (Math.random() - 0.5) * 8,
      velocityY: (Math.random() - 0.5) * 8,
      mlEnabled: true
    });
    
    agent.position = {
      x: Math.random() * 1500,
      y: Math.random() * 1200
    };
    
    await agent.setMLModel('flocking');
    agents.push(agent);
  }
  
  // Add agents to manager
  for (const agent of agents) {
    await agentManager.addAgent(agent);
  }
  
  // Simulate batch processing
  console.log('Testing batch processing performance...');
  const startTime = performance.now();
  
  // Queue predictions for all agents
  const promises = agents.map(agent => 
    performanceManager.queuePrediction(agent, 'flocking', 'normal')
  );
  
  // Wait for all predictions
  const actions = await Promise.all(promises);
  
  const endTime = performance.now();
  const totalTime = endTime - startTime;
  
  console.log(`Processed ${agents.length} predictions in ${totalTime.toFixed(2)}ms`);
  console.log(`Average per prediction: ${(totalTime / agents.length).toFixed(2)}ms`);
  
  // Get performance metrics
  const metrics = performanceManager.getPerformanceMetrics();
  console.log('Performance metrics:', {
    avgPredictionTime: `${metrics.avgPredictionTime.toFixed(2)}ms`,
    memoryUsage: `${metrics.memoryUsage.toFixed(2)}MB`,
    predictionCount: metrics.predictionCount,
    errorRate: `${(metrics.errorRate * 100).toFixed(1)}%`,
    batchEfficiency: `${(metrics.batchEfficiency * 100).toFixed(1)}%`
  });
  
  // Get queue status
  const queueStatus = performanceManager.getQueueStatus();
  console.log('Queue status:', queueStatus);
}

/**
 * Example 4: Training Data Collection
 */
async function dataCollectionExample() {
  console.log('\n=== Training Data Collection Example ===');
  
  const environment = new ContinuousSpace({
    width: 800,
    height: 600,
    boundaryType: 'reflective'
  });
  
  const scheduler = new RandomScheduler();
  const agentManager = new AgentManager(environment, scheduler);
  const collector = new GenericDataCollector();
  
  // Create agents for data collection
  for (let i = 0; i < 20; i++) {
    const agent = new MLAgent(`data-agent-${i}`, {
      energy: 60 + Math.random() * 40,
      health: 70 + Math.random() * 30,
      autonomy: 50 + Math.random() * 50
    });
    
    agent.position = {
      x: Math.random() * 800,
      y: Math.random() * 600
    };
    
    await agentManager.addAgent(agent);
  }
  
  // Start data collection
  collector.startCollection(
    { getAgentManager: () => agentManager } as any,
    'mixed-behavior-scenario',
    50 // episodes
  );
  
  // Simulate some steps
  console.log('Collecting training data...');
  for (let step = 0; step < 100; step++) {
    await agentManager.step();
    collector.recordStep(
      { getAgentManager: () => agentManager } as any,
      step
    );
    
    if (step % 20 === 0) {
      const stats = collector.getCollectionStats();
      console.log(`Step ${step}: Collected ${stats.dataPointsCollected} data points`);
    }
  }
  
  // Stop collection and export data
  collector.stopCollection();
  const dataset = collector.exportData();
  
  console.log(`Collected ${dataset.stateActionPairs.length} state-action pairs`);
  console.log('Dataset metadata:', dataset.metadata);
  
  // Export in different formats
  try {
    const csvData = collector.exportForTraining('csv');
    console.log(`CSV export: ${csvData.split('\n').length} lines`);
    
    const tensorflowData = collector.exportForTraining('tensorflow');
    const tfDataObj = JSON.parse(tensorflowData);
    console.log(`TensorFlow format: ${tfDataObj.features.length} feature vectors`);
    
  } catch (error) {
    console.error('Export error:', error);
  }
}

/**
 * Example 5: Synthetic Training Data Generation
 */
async function syntheticDataExample() {
  console.log('\n=== Synthetic Training Data Generation ===');
  
  // Generate training data for different models
  const flockingModel = new FlockingMLModel();
  const economicModel = new EconomicMLModel();
  const networkModel = new NetworkFormationModel();
  
  // Flocking training data
  const flockingScenarios = [
    { agentCount: 10, bounds: { width: 400, height: 300 } },
    { agentCount: 25, bounds: { width: 600, height: 400 } },
    { agentCount: 50, bounds: { width: 800, height: 600 } }
  ];
  
  const flockingData = flockingModel.generateTrainingData(flockingScenarios, 150);
  console.log(`Generated ${flockingData.length} flocking training examples`);
  
  // Economic training data
  const economicScenarios = [
    { 
      agentCount: 20, 
      marketConditions: 'bull' as const, 
      initialWealth: { min: 100, max: 300 } 
    },
    { 
      agentCount: 30, 
      marketConditions: 'bear' as const, 
      initialWealth: { min: 50, max: 200 } 
    },
    { 
      agentCount: 25, 
      marketConditions: 'volatile' as const, 
      initialWealth: { min: 75, max: 250 } 
    }
  ];
  
  const economicData = economicModel.generateTrainingData(economicScenarios, 200);
  console.log(`Generated ${economicData.length} economic training examples`);
  
  // Network formation training data
  const networkScenarios = [
    { 
      agentCount: 15, 
      networkDensity: 'sparse' as const, 
      homophilyLevel: 'low' as const 
    },
    { 
      agentCount: 25, 
      networkDensity: 'medium' as const, 
      homophilyLevel: 'medium' as const 
    },
    { 
      agentCount: 35, 
      networkDensity: 'dense' as const, 
      homophilyLevel: 'high' as const 
    }
  ];
  
  const networkData = networkModel.generateTrainingData(networkScenarios, 150);
  console.log(`Generated ${networkData.length} network formation training examples`);
  
  // Show sample data structure
  console.log('\nSample flocking training data:');
  console.log('Input features:', flockingData[0].input);
  console.log('Output action:', flockingData[0].output);
}

/**
 * Main example runner
 */
async function runAllExamples() {
  console.log('AgentJS ML Infrastructure Examples\n');
  
  try {
    await basicMLAgentExample();
    await multiModelSimulationExample();
    await performanceOptimizedExample();
    await dataCollectionExample();
    await syntheticDataExample();
    
    console.log('\n=== All Examples Completed Successfully ===');
    
  } catch (error) {
    console.error('Example execution error:', error);
  } finally {
    // Clean up resources
    const performanceManager = MLPerformanceManager.getInstance();
    performanceManager.dispose();
    console.log('Resources cleaned up');
  }
}

// Run examples if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment
  (window as any).runMLExamples = runAllExamples;
  console.log('ML examples loaded. Call runMLExamples() to start.');
} else if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  module.exports = { runAllExamples };
}

export { runAllExamples };