/**
 * AgentJS Core - MINIMAL EXPORT for browser compatibility
 * Only exports core components without p5.js dependencies
 */

// Core exports (guaranteed to work in browser)
export * from './core/agents/Agent';
export * from './core/agents/BaseAgent';
export * from './core/agents/MovingAgent';
export * from './core/agents/NetworkAgent';
export * from './core/environment/Environment';
export * from './core/environment/ContinuousSpace';
export * from './core/environment/Grid2D';
export * from './core/scheduling/Scheduler';
export * from './core/scheduling/RandomScheduler';
export * from './core/scheduling/SequentialScheduler';
export * from './core/interactions/InteractionEngine';
export * from './core/AgentManager';

// Type exports
export * from './types/core';
export * from './types/events';
export * from './types/spatial';

// Re-export the SpatialQueryResult interface
export type { SpatialQueryResult } from './core/environment/Environment';

// Network components - All network features including NetworkManager
export { NetworkManager, ConnectionType } from './core/network/NetworkManager';
export type { NetworkConnection, NetworkConfig } from './core/network/NetworkManager';
export * from './core/network/SocialInfluence';
export * from './core/network/NetworkFormation';

// Behavior tree components
export * from './core/behaviors/BehaviorTree';
export * from './core/behaviors/CommonBehaviors';

// Performance components
export * from './core/performance/PerformanceBenchmark';

// Analysis components (Week 7)
export * from './analysis';

// Utility components (Week 7)
export * from './utils';

// ML Infrastructure (Week 6) - explicit exports to avoid conflicts
export type { MLBehaviorModel, MLAgentState, AgentAction, EnvironmentContext } from './ml/interfaces';
export * from './ml/MLAgent';
export * from './ml/StateEncoder';
export * from './ml/ModelRegistry';
export * from './ml/GenericDataCollector';
export * from './ml/MLPerformanceManager';

// Example ML Models
export * from './ml/models/FlockingMLModel';
export * from './ml/models/EconomicMLModel';
export * from './ml/models/NetworkFormationModel';

// Visualization System (Week 5) - p5.js integration with advanced features
export * from './visualization';