/**
 * Object factory function type
 */
export type ObjectFactory<T> = () => T;

/**
 * Object reset function type
 */
export type ObjectReset<T> = (obj: T) => void;

/**
 * Pool configuration
 */
export interface PoolConfig<T> {
  factory: ObjectFactory<T>;
  reset?: ObjectReset<T>;
  initialSize?: number;
  maxSize?: number;
  growthFactor?: number;
  shrinkThreshold?: number;
  shrinkFactor?: number;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  totalCreated: number;
  totalAcquired: number;
  totalReleased: number;
  currentPoolSize: number;
  currentAcquiredCount: number;
  peakPoolSize: number;
  peakAcquiredCount: number;
  hitRate: number;
  memoryEfficiency: number;
}

/**
 * Generic object pool for memory management
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private acquired: Set<T> = new Set();
  private factory: ObjectFactory<T>;
  private reset?: ObjectReset<T>;
  private maxSize: number;
  private shrinkThreshold: number;
  private shrinkFactor: number;

  private stats: PoolStats = {
    totalCreated: 0,
    totalAcquired: 0,
    totalReleased: 0,
    currentPoolSize: 0,
    currentAcquiredCount: 0,
    peakPoolSize: 0,
    peakAcquiredCount: 0,
    hitRate: 0,
    memoryEfficiency: 0
  };

  constructor(config: PoolConfig<T>) {
    this.factory = config.factory;
    if (config.reset !== undefined) {
      this.reset = config.reset;
    }
    this.maxSize = config.maxSize || 1000;
    this.shrinkThreshold = config.shrinkThreshold || 0.25;
    this.shrinkFactor = config.shrinkFactor || 0.5;

    // Pre-populate pool
    const initialSize = config.initialSize || 10;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createObject());
    }
    this.updateStats();
  }

  /**
   * Acquire an object from the pool
   */
  acquire(): T {
    let obj: T;
    
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else {
      obj = this.createObject();
    }

    this.acquired.add(obj);
    this.stats.totalAcquired++;
    this.updateStats();

    return obj;
  }

  /**
   * Release an object back to the pool
   */
  release(obj: T): boolean {
    if (!this.acquired.has(obj)) {
      console.warn('Object not acquired from this pool');
      return false;
    }

    this.acquired.delete(obj);
    
    // Reset object if reset function provided
    if (this.reset) {
      this.reset(obj);
    }

    // Add back to pool if under max size
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }

    this.stats.totalReleased++;
    this.updateStats();
    
    // Periodic shrinking
    this.maybeShrink();

    return true;
  }

  /**
   * Release multiple objects at once
   */
  releaseAll(objects: T[]): number {
    let released = 0;
    for (const obj of objects) {
      if (this.release(obj)) {
        released++;
      }
    }
    return released;
  }

  /**
   * Get current pool statistics
   */
  getStats(): Readonly<PoolStats> {
    return { ...this.stats };
  }

  /**
   * Get current pool size
   */
  getPoolSize(): number {
    return this.pool.length;
  }

  /**
   * Get number of acquired objects
   */
  getAcquiredCount(): number {
    return this.acquired.size;
  }

  /**
   * Check if pool is empty
   */
  isEmpty(): boolean {
    return this.pool.length === 0;
  }

  /**
   * Check if all objects are acquired
   */
  isFullyAcquired(): boolean {
    return this.pool.length === 0 && this.acquired.size > 0;
  }

  /**
   * Warm up the pool by pre-creating objects
   */
  warmUp(count: number): void {
    const toCreate = Math.min(count, this.maxSize - this.pool.length);
    for (let i = 0; i < toCreate; i++) {
      this.pool.push(this.createObject());
    }
    this.updateStats();
  }

  /**
   * Shrink the pool to target size
   */
  shrink(targetSize?: number): number {
    const target = targetSize || Math.floor(this.pool.length * this.shrinkFactor);
    const toRemove = Math.max(0, this.pool.length - target);
    
    this.pool.splice(0, toRemove);
    this.updateStats();
    
    return toRemove;
  }

  /**
   * Clear the pool and reset statistics
   */
  clear(): void {
    this.pool = [];
    this.acquired.clear();
    this.stats = {
      totalCreated: 0,
      totalAcquired: 0,
      totalReleased: 0,
      currentPoolSize: 0,
      currentAcquiredCount: 0,
      peakPoolSize: 0,
      peakAcquiredCount: 0,
      hitRate: 0,
      memoryEfficiency: 0
    };
  }

  /**
   * Create a new object using the factory
   */
  private createObject(): T {
    const obj = this.factory();
    this.stats.totalCreated++;
    return obj;
  }

  /**
   * Update pool statistics
   */
  private updateStats(): void {
    this.stats.currentPoolSize = this.pool.length;
    this.stats.currentAcquiredCount = this.acquired.size;
    
    // Track peaks
    this.stats.peakPoolSize = Math.max(this.stats.peakPoolSize, this.stats.currentPoolSize);
    this.stats.peakAcquiredCount = Math.max(this.stats.peakAcquiredCount, this.stats.currentAcquiredCount);
    
    // Calculate hit rate (objects served from pool vs created)
    const totalServed = this.stats.totalAcquired;
    const totalHits = totalServed - this.stats.totalCreated + (this.stats.currentPoolSize + this.stats.currentAcquiredCount);
    this.stats.hitRate = totalServed > 0 ? Math.min(1, totalHits / totalServed) : 0;
    
    // Calculate memory efficiency (reused objects vs total created)
    this.stats.memoryEfficiency = this.stats.totalCreated > 0 ? 
      Math.max(0, (this.stats.totalAcquired - this.stats.totalCreated) / this.stats.totalCreated) : 0;
  }

  /**
   * Maybe shrink the pool if utilization is low
   */
  private maybeShrink(): void {
    const utilization = this.acquired.size / (this.pool.length + this.acquired.size);
    if (utilization < this.shrinkThreshold && this.pool.length > 10) {
      this.shrink();
    }
  }
}

/**
 * Specialized pools for common AgentJS objects
 */

/**
 * Vector2D pool for position/velocity objects
 */
export class Vector2DPool extends ObjectPool<{ x: number; y: number }> {
  constructor(initialSize: number = 50, maxSize: number = 500) {
    super({
      factory: () => ({ x: 0, y: 0 }),
      reset: (vec) => {
        vec.x = 0;
        vec.y = 0;
      },
      initialSize,
      maxSize
    });
  }

  /**
   * Acquire vector with initial values
   */
  acquireVector(x: number = 0, y: number = 0): { x: number; y: number } {
    const vec = this.acquire();
    vec.x = x;
    vec.y = y;
    return vec;
  }
}

/**
 * Array pool for temporary collections
 */
export class ArrayPool<T> extends ObjectPool<T[]> {
  constructor(initialSize: number = 20, maxSize: number = 200) {
    super({
      factory: () => [],
      reset: (arr) => {
        arr.length = 0; // Clear array efficiently
      },
      initialSize,
      maxSize
    });
  }
}

/**
 * Map pool for temporary key-value storage
 */
export class MapPool<K, V> extends ObjectPool<Map<K, V>> {
  constructor(initialSize: number = 10, maxSize: number = 100) {
    super({
      factory: () => new Map<K, V>(),
      reset: (map) => {
        map.clear();
      },
      initialSize,
      maxSize
    });
  }
}

/**
 * Set pool for temporary collections
 */
export class SetPool<T> extends ObjectPool<Set<T>> {
  constructor(initialSize: number = 10, maxSize: number = 100) {
    super({
      factory: () => new Set<T>(),
      reset: (set) => {
        set.clear();
      },
      initialSize,
      maxSize
    });
  }
}

/**
 * Global object pool manager
 */
export class PoolManager {
  private pools: Map<string, ObjectPool<any>> = new Map();
  private static instance: PoolManager | null = null;

  /**
   * Get singleton instance
   */
  static getInstance(): PoolManager {
    if (!PoolManager.instance) {
      PoolManager.instance = new PoolManager();
    }
    return PoolManager.instance;
  }

  /**
   * Register a pool
   */
  registerPool<T>(name: string, pool: ObjectPool<T>): void {
    this.pools.set(name, pool);
  }

  /**
   * Get a registered pool
   */
  getPool<T>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name);
  }

  /**
   * Create and register a standard pool
   */
  createPool<T>(name: string, config: PoolConfig<T>): ObjectPool<T> {
    const pool = new ObjectPool(config);
    this.registerPool(name, pool);
    return pool;
  }

  /**
   * Get all pool statistics
   */
  getAllStats(): Record<string, PoolStats> {
    const stats: Record<string, PoolStats> = {};
    for (const [name, pool] of this.pools) {
      stats[name] = pool.getStats();
    }
    return stats;
  }

  /**
   * Warm up all pools
   */
  warmUpAll(count: number = 10): void {
    for (const pool of this.pools.values()) {
      pool.warmUp(count);
    }
  }

  /**
   * Shrink all pools
   */
  shrinkAll(): number {
    let totalRemoved = 0;
    for (const pool of this.pools.values()) {
      totalRemoved += pool.shrink();
    }
    return totalRemoved;
  }

  /**
   * Clear all pools
   */
  clearAll(): void {
    for (const pool of this.pools.values()) {
      pool.clear();
    }
    this.pools.clear();
  }
}

/**
 * Default pools setup for AgentJS
 */
export function setupDefaultPools(): {
  vectors: Vector2DPool;
  arrays: ArrayPool<any>;
  maps: MapPool<any, any>;
  sets: SetPool<any>;
} {
  const manager = PoolManager.getInstance();
  
  const vectors = new Vector2DPool(100, 1000);
  const arrays = new ArrayPool(50, 500);
  const maps = new MapPool(20, 200);
  const sets = new SetPool(20, 200);
  
  manager.registerPool('vectors', vectors);
  manager.registerPool('arrays', arrays);
  manager.registerPool('maps', maps);
  manager.registerPool('sets', sets);
  
  return { vectors, arrays, maps, sets };
}

/**
 * Factory functions
 */
export function createObjectPool<T>(config: PoolConfig<T>): ObjectPool<T> {
  return new ObjectPool(config);
}

export function createVector2DPool(initialSize?: number, maxSize?: number): Vector2DPool {
  return new Vector2DPool(initialSize, maxSize);
}

export function createArrayPool<T>(initialSize?: number, maxSize?: number): ArrayPool<T> {
  return new ArrayPool<T>(initialSize, maxSize);
}