/**
 * Spatial type definitions for environments and positioning
 */

import type { Agent } from '../core/agents/Agent';
import type { BoundaryType, NeighborhoodType, Position } from './core';

/** Rectangle bounds for spatial regions */
export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Circle for radial queries */
export interface Circle {
  readonly center: Position;
  readonly radius: number;
}

/** Grid cell coordinates */
export interface GridCoordinate {
  readonly row: number;
  readonly col: number;
}

/** Spatial index node for quadtree */
export interface SpatialNode {
  readonly bounds: Bounds;
  readonly agents: ReadonlyArray<Agent>;
  readonly children: ReadonlyArray<SpatialNode>;
  readonly level: number;
}

/** Environment dimensions */
export interface EnvironmentDimensions {
  readonly width: number;
  readonly height: number;
  readonly boundaryType: BoundaryType;
}

/** Grid environment configuration */
export interface GridConfig extends EnvironmentDimensions {
  readonly rows: number;
  readonly cols: number;
  readonly neighborhoodType: NeighborhoodType;
  readonly allowMultipleOccupancy: boolean;
}

/** Continuous space configuration */
export interface ContinuousSpaceConfig extends EnvironmentDimensions {
  readonly enableSpatialIndex: boolean;
  readonly maxObjectsPerNode: number;
  readonly maxTreeDepth: number;
}

/** Neighbor query options */
export interface NeighborQueryOptions {
  readonly radius?: number;
  readonly maxResults?: number;
  readonly includeDistance?: boolean;
  readonly filterFn?: (_agent: Agent) => boolean;
}

/** Path finding result */
export interface PathResult {
  readonly path: ReadonlyArray<Position>;
  readonly distance: number;
  readonly found: boolean;
}

/** Distance calculation function type */
export type DistanceFunction = (_a: Position, _b: Position) => number;

/** Spatial query function type */
export type SpatialQueryFunction<T> = (
  _position: Position,
  _radius: number,
  _options?: NeighborQueryOptions
) => ReadonlyArray<T>;
