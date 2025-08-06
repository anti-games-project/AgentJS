/**
 * EmptyAddress Network Autonomy Game - Trafficking Simulation Example
 * 
 * This example demonstrates how to use AgentJS to model trafficking dynamics
 * and community empowerment for the EmptyAddress project.
 */

import {
  AgentManager,
  NetworkAgent,
  ContinuousSpace,
  RandomScheduler,
  NetworkManager,
  ConnectionType,
  Visualizer,
  DataCollector,
  TrajectoryExporter
} from '../src';

// Define agent types for EmptyAddress
enum AgentType {
  VULNERABLE = 'vulnerable',
  TRAFFICKER = 'trafficker',
  SUPPORT_WORKER = 'support_worker',
  COMMUNITY_LEADER = 'community_leader'
}

// Define custom connection types
enum EmptyAddressConnectionType {
  EXPLOITATION = 'exploitation',
  SUPPORT = 'support',
  COMMUNITY = 'community',
  FAMILY = 'family'
}

// Custom agent class for EmptyAddress
class EmptyAddressAgent extends NetworkAgent {
  constructor(id: string, type: AgentType, x: number, y: number) {
    super(id, {
      type,
      autonomy: type === AgentType.VULNERABLE ? 20 : 80,
      resources: type === AgentType.VULNERABLE ? 30 : 70,
      awareness: type === AgentType.VULNERABLE ? 10 : 50,
      trust: 50,
      resilience: type === AgentType.VULNERABLE ? 30 : 60
    });
    this.position = { x, y };
  }

  step(): void {
    super.step();
    
    // Update autonomy based on connections
    const connections = this.networkManager?.getConnections(this.id);
    if (connections) {
      let autonomyChange = 0;
      
      for (const conn of connections) {
        switch (conn.type) {
          case EmptyAddressConnectionType.EXPLOITATION:
            autonomyChange -= 2;
            break;
          case EmptyAddressConnectionType.SUPPORT:
            autonomyChange += 1;
            break;
          case EmptyAddressConnectionType.COMMUNITY:
            autonomyChange += 0.5;
            break;
        }
      }
      
      const currentAutonomy = this.getProperty('autonomy') as number;
      this.setProperty('autonomy', Math.max(0, Math.min(100, currentAutonomy + autonomyChange)));
    }
    
    // Move based on nearby agents
    this.moveBasedOnNearbyAgents();
  }
  
  private moveBasedOnNearbyAgents(): void {
    const nearbyAgents = this.environment?.getNeighbors(this.position, 50);
    if (!nearbyAgents) return;
    
    let moveX = 0;
    let moveY = 0;
    
    for (const neighbor of nearbyAgents.agents) {
      const neighborType = neighbor.getProperty('type');
      const distance = Math.sqrt(
        Math.pow(neighbor.position.x - this.position.x, 2) +
        Math.pow(neighbor.position.y - this.position.y, 2)
      );
      
      if (neighborType === AgentType.TRAFFICKER && this.getProperty('type') === AgentType.VULNERABLE) {
        // Move away from traffickers
        moveX -= (neighbor.position.x - this.position.x) / distance;
        moveY -= (neighbor.position.y - this.position.y) / distance;
      } else if (neighborType === AgentType.SUPPORT_WORKER) {
        // Move toward support workers
        moveX += (neighbor.position.x - this.position.x) / distance * 0.5;
        moveY += (neighbor.position.y - this.position.y) / distance * 0.5;
      }
    }
    
    // Apply movement
    this.position = {
      x: this.position.x + moveX * 2,
      y: this.position.y + moveY * 2
    };
  }
}

// Main simulation setup
export async function runEmptyAddressSimulation() {
  console.log('Starting EmptyAddress Trafficking Dynamics Simulation...\n');
  
  // Create environment
  const environment = new ContinuousSpace({
    width: 800,
    height: 600,
    boundaryType: 'reflective'
  });
  
  // Create scheduler
  const scheduler = new RandomScheduler();
  
  // Create agent manager
  const agentManager = new AgentManager();
  
  // Create network manager
  const networkManager = new NetworkManager();
  
  // Create data collector
  const dataCollector = new DataCollector({
    collectInterval: 10,
    enableAgentTracking: true,
    enableNetworkMetrics: true
  });
  
  // Create trajectory exporter
  const trajectoryExporter = new TrajectoryExporter({
    sampleRate: 5,
    includeProperties: ['autonomy', 'resources', 'awareness']
  });
  
  // Initialize agents
  console.log('Creating agents...');
  
  // Create vulnerable population
  for (let i = 0; i < 20; i++) {
    const agent = new EmptyAddressAgent(
      `vulnerable_${i}`,
      AgentType.VULNERABLE,
      Math.random() * 800,
      Math.random() * 600
    );
    agent.environment = environment;
    agent.networkManager = networkManager;
    agentManager.add(agent);
    scheduler.add(agent);
    environment.addAgent(agent);
  }
  
  // Create traffickers
  for (let i = 0; i < 3; i++) {
    const agent = new EmptyAddressAgent(
      `trafficker_${i}`,
      AgentType.TRAFFICKER,
      Math.random() * 800,
      Math.random() * 600
    );
    agent.environment = environment;
    agent.networkManager = networkManager;
    agentManager.add(agent);
    scheduler.add(agent);
    environment.addAgent(agent);
  }
  
  // Create support workers
  for (let i = 0; i < 5; i++) {
    const agent = new EmptyAddressAgent(
      `support_${i}`,
      AgentType.SUPPORT_WORKER,
      Math.random() * 800,
      Math.random() * 600
    );
    agent.environment = environment;
    agent.networkManager = networkManager;
    agentManager.add(agent);
    scheduler.add(agent);
    environment.addAgent(agent);
  }
  
  // Create community leaders
  for (let i = 0; i < 2; i++) {
    const agent = new EmptyAddressAgent(
      `leader_${i}`,
      AgentType.COMMUNITY_LEADER,
      400 + Math.random() * 100 - 50,
      300 + Math.random() * 100 - 50
    );
    agent.environment = environment;
    agent.networkManager = networkManager;
    agentManager.add(agent);
    scheduler.add(agent);
    environment.addAgent(agent);
  }
  
  console.log(`Created ${agentManager.getAgentCount()} agents\n`);
  
  // Form initial networks
  console.log('Forming initial networks...');
  
  // Traffickers target vulnerable agents
  const vulnerableAgents = agentManager.queryAgents({ property: 'type', propertyValue: AgentType.VULNERABLE });
  const traffickers = agentManager.queryAgents({ property: 'type', propertyValue: AgentType.TRAFFICKER });
  
  for (const trafficker of traffickers) {
    // Each trafficker targets 2-3 vulnerable agents
    const targets = vulnerableAgents
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 2);
      
    for (const target of targets) {
      networkManager.addConnection(
        trafficker.id,
        target.id,
        EmptyAddressConnectionType.EXPLOITATION as any,
        0.8
      );
    }
  }
  
  // Support workers connect to vulnerable agents
  const supportWorkers = agentManager.queryAgents({ property: 'type', propertyValue: AgentType.SUPPORT_WORKER });
  
  for (const worker of supportWorkers) {
    // Each support worker helps 3-4 vulnerable agents
    const helped = vulnerableAgents
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 2) + 3);
      
    for (const agent of helped) {
      networkManager.addConnection(
        worker.id,
        agent.id,
        EmptyAddressConnectionType.SUPPORT as any,
        0.6
      );
    }
  }
  
  // Community leaders form community networks
  const leaders = agentManager.queryAgents({ property: 'type', propertyValue: AgentType.COMMUNITY_LEADER });
  
  for (const leader of leaders) {
    // Connect to support workers
    for (const worker of supportWorkers) {
      networkManager.addConnection(
        leader.id,
        worker.id,
        EmptyAddressConnectionType.COMMUNITY as any,
        0.7
      );
    }
  }
  
  console.log(`Formed ${networkManager.getConnectionCount()} connections\n`);
  
  // Run simulation
  console.log('Running simulation for 100 steps...\n');
  
  for (let step = 0; step < 100; step++) {
    // Step simulation
    scheduler.step();
    
    // Collect data
    dataCollector.collect(agentManager, step);
    trajectoryExporter.recordTrajectoryStep(agentManager, step);
    
    // Print status every 20 steps
    if (step % 20 === 0) {
      const avgAutonomy = vulnerableAgents.reduce((sum, agent) => 
        sum + (agent.getProperty('autonomy') as number), 0
      ) / vulnerableAgents.length;
      
      const exploitationCount = Array.from(networkManager.getAllConnections())
        .filter(conn => conn.type === EmptyAddressConnectionType.EXPLOITATION).length;
        
      const supportCount = Array.from(networkManager.getAllConnections())
        .filter(conn => conn.type === EmptyAddressConnectionType.SUPPORT).length;
      
      console.log(`Step ${step}:`);
      console.log(`  Average vulnerable autonomy: ${avgAutonomy.toFixed(1)}`);
      console.log(`  Exploitation connections: ${exploitationCount}`);
      console.log(`  Support connections: ${supportCount}`);
      console.log('');
    }
  }
  
  // Export results
  console.log('\nExporting simulation data...');
  
  // Export trajectories
  const trajectoryCSV = trajectoryExporter.exportToCSV();
  console.log('Trajectory data preview:');
  console.log(trajectoryCSV.split('\n').slice(0, 5).join('\n'));
  console.log('...\n');
  
  // Export network
  const networkData = trajectoryExporter.exportNetworkStructure();
  console.log(`Network has ${networkData.nodes.length} nodes and ${networkData.edges.length} edges\n`);
  
  // Get final statistics
  const finalStats = dataCollector.getAgentPropertyStats('autonomy');
  console.log('Final autonomy statistics:');
  console.log(`  Mean: ${finalStats.mean.toFixed(2)}`);
  console.log(`  Std Dev: ${finalStats.stdDev.toFixed(2)}`);
  console.log(`  Min: ${finalStats.min.toFixed(2)}`);
  console.log(`  Max: ${finalStats.max.toFixed(2)}`);
  
  // Check intervention success
  const finalAvgAutonomy = vulnerableAgents.reduce((sum, agent) => 
    sum + (agent.getProperty('autonomy') as number), 0
  ) / vulnerableAgents.length;
  
  console.log('\n=== Simulation Complete ===');
  console.log(`Initial average autonomy: 20`);
  console.log(`Final average autonomy: ${finalAvgAutonomy.toFixed(1)}`);
  console.log(`Improvement: ${((finalAvgAutonomy - 20) / 20 * 100).toFixed(1)}%`);
  
  return {
    dataCollector,
    trajectoryExporter,
    finalStats,
    agentManager,
    networkManager
  };
}

// Run the simulation if this file is executed directly
if (require.main === module) {
  runEmptyAddressSimulation().catch(console.error);
}