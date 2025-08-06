// Controls module exports
export { SimulationController, SimulationState } from './SimulationController';
export type { SpeedSettings, ControllerEvents } from './SimulationController';

export { ControlPanel } from './ControlPanel';
export type { ControlPanelConfig } from './ControlPanel';

export { ParameterManager, ParameterType } from './ParameterManager';
export type {
  ParameterValue,
  ParameterDefinition,
  ParameterGroup,
  ParameterChangeEvent,
  ParameterPreset,
  ParameterManagerEvents
} from './ParameterManager';

// Factory functions
export { createSimulationController } from './SimulationController';
export { createControlPanel } from './ControlPanel';
export { createParameterManager } from './ParameterManager';