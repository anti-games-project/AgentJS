// Core module exports

// Main simulation components
export { AgentManager } from './AgentManager';
export { Simulation } from './Simulation';

// Agent system
export * from './agents';

// Behaviors
export * from './behaviors';

// Environment system
export { Environment } from './environment/Environment';
export { ContinuousSpace } from './environment/ContinuousSpace';
export { Grid2D } from './environment/Grid2D';

// Interaction system
export { InteractionEngine } from './interactions/InteractionEngine';

// Network system
export { NetworkManager } from './network/NetworkManager';
export { NetworkFormation } from './network/NetworkFormation';
export { SocialInfluence } from './network/SocialInfluence';

// Performance monitoring
export * from './performance';

// Scheduling system
export { Scheduler } from './scheduling/Scheduler';
export { RandomScheduler } from './scheduling/RandomScheduler';
export { SequentialScheduler } from './scheduling/SequentialScheduler';