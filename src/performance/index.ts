// Performance optimization exports
export { ViewportCuller } from './ViewportCuller';
export type {
  ViewportBounds,
  CullingResult,
  LODSettings
} from './ViewportCuller';

export {
  ObjectPool,
  Vector2DPool,
  ArrayPool,
  MapPool,
  SetPool,
  PoolManager
} from './ObjectPool';
export type {
  ObjectFactory,
  ObjectReset,
  PoolConfig,
  PoolStats
} from './ObjectPool';

// Factory functions
export { createViewportCuller } from './ViewportCuller';
export {
  createObjectPool,
  createVector2DPool,
  createArrayPool,
  setupDefaultPools
} from './ObjectPool';