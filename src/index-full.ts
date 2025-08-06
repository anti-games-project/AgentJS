/**
 * AgentJS Core - Agent-Based Modeling Framework
 *
 * A comprehensive framework for creating agent-based simulations with
 * built-in p5.js visualization support.
 *
 * @packageDocumentation
 */

// Core exports (currently implemented)
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

// Network components
export { NetworkManager } from './core/network/NetworkManager';
export * from './core/network/SocialInfluence';
export * from './core/network/NetworkFormation';

// Behavior tree components
export * from './core/behaviors/BehaviorTree';
export * from './core/behaviors/CommonBehaviors';

// Performance components
export * from './core/performance/PerformanceBenchmark';

// Visualization components (Week 4 - p5.js Integration) - TEMPORARILY DISABLED DUE TO P5 IMPORT ISSUES
// export * from './visualization/Visualizer';
// export * from './visualization/Camera';
// export * from './visualization/InputManager';

// Week 5 - Data Collection & Analysis (COMPLETED) - TEMPORARILY DISABLED DUE TO IMPORT ISSUES
// export * from './analysis';
// export * from './utils';

// Week 5 - UI Controls & Parameter Management (COMPLETED) - TEMPORARILY DISABLED DUE TO IMPORT ISSUES
// export * from './controls';

// Week 5 - Performance Optimization (COMPLETED) - TEMPORARILY DISABLED DUE TO IMPORT ISSUES
// export * from './performance';
