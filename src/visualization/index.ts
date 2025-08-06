/**
 * Visualization Module - p5.js Integration & Real-time Rendering
 *
 * This module provides comprehensive visualization capabilities for AgentJS,
 * including real-time agent rendering, interactive camera controls, and
 * performance-optimized rendering for large simulations.
 *
 * Week 5 Advanced Features:
 * - Animation engine with smooth transitions
 * - Agent trail system for movement history
 * - Heat map visualization for spatial analysis
 * - Particle effects for visual feedback
 */

export * from './Visualizer';
export * from './Camera';
export * from './InputManager';
export * from './AgentDefinitionVisualizer';
export * from './AnimationEngine';
export * from './AgentTrailSystem';
export * from './HeatMapSystem';
export * from './ParticleEffectsSystem';

// Re-export types
export type { VisualizerConfig, AgentVisuals, CameraState } from './Visualizer';
export type { CameraConfig, CameraTransform } from './Camera';
export type { InputConfig, SelectionRect, InputEvents } from './InputManager';
export type {
  DefinitionVisualizerConfig,
  AgentDefinitionState,
  DefinitionVisuals,
} from './AgentDefinitionVisualizer';
export type {
  AnimationConfig,
  AnimationTarget,
  EasingFunction,
} from './AnimationEngine';
export type { TrailConfig, TrailPoint, TrailStyle } from './AgentTrailSystem';
export type { HeatMapConfig, HeatMapLayer, ColorScheme } from './HeatMapSystem';
export type {
  ParticleConfig,
  ParticleEffectType,
  EffectTrigger,
} from './ParticleEffectsSystem';

// Export commonly used utilities
export { Easing } from './AnimationEngine';
