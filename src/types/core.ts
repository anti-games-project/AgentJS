/**
 * Core type definitions for the AgentJS framework
 */

/** Unique identifier for agents */
export type AgentId = string & { readonly brand: unique symbol };

/** 2D coordinate position */
export type Position = {
  readonly x: number;
  readonly y: number;
} & { readonly brand: unique symbol };

/** 2D vector for movement and direction */
export type Vector2D = {
  readonly x: number;
  readonly y: number;
} & { readonly brand: unique symbol };

/** Agent property value types */
export type PropertyValue = string | number | boolean | object | null;

/** Agent properties map */
export type AgentProperties = Record<string, PropertyValue>;

/** Environment boundary types */
export type BoundaryType = 'periodic' | 'reflective' | 'absorbing';

/** Neighborhood types for grid environments */
export type NeighborhoodType = 'moore' | 'von_neumann';

/** Connection types for network relationships */
export type ConnectionType =
  | 'supportive'
  | 'exploitative'
  | 'economic'
  | 'neutral';

/** Agent state in simulation */
export type AgentState = 'active' | 'dormant' | 'destroyed';

/** Performance metrics for visualization */
export interface RenderPerformanceMetrics {
  readonly frameRate: number;
  readonly agentCount: number;
  readonly memoryUsage: number;
  readonly updateTime: number;
  readonly renderTime: number;
}

/** Simulation configuration */
export interface SimulationConfig {
  readonly maxAgents: number;
  readonly timeStep: number;
  readonly randomSeed?: number;
  readonly performanceMonitoring: boolean;
}

/** Spatial query result */
export interface SpatialQueryResult<T> {
  readonly items: ReadonlyArray<T>;
  readonly distances: ReadonlyArray<number>;
  readonly queryTime: number;
}
