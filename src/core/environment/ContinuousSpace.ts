/**
 * ContinuousSpace - Continuous 2D spatial environment implementation
 */

import { Environment, SpatialQueryResult } from './Environment';
import type { Agent } from '../agents/Agent';
import type { Position } from '../../types/core';
import type {
  ContinuousSpaceConfig,
  NeighborQueryOptions,
  DistanceFunction,
} from '../../types/spatial';

/**
 * Quadtree node for spatial partitioning
 */
interface QuadtreeNode {
  bounds: { x: number; y: number; width: number; height: number };
  agents: Agent[];
  children: QuadtreeNode[] | null;
  level: number;
}

/**
 * ContinuousSpace - 2D environment with floating-point coordinates
 *
 * Features:
 * - Floating-point position precision
 * - Spatial indexing with quadtree for performance
 * - Efficient neighbor queries within radius
 * - Multiple distance calculation methods
 * - Boundary condition handling
 *
 * Educational Context: Represents physical spaces where
 * community members can move freely with precise positioning,
 * such as geographic areas, meeting spaces, or virtual worlds.
 */
export class ContinuousSpace extends Environment {
  /** Spatial configuration */
  private readonly config: ContinuousSpaceConfig;

  /** Quadtree root for spatial indexing */
  private quadtree: QuadtreeNode | null;

  /** Distance calculation function */
  private distanceFunction: DistanceFunction;

  constructor(configOrWidth: ContinuousSpaceConfig | number, height?: number) {
    let config: ContinuousSpaceConfig;
    
    // Support both config object and simple width/height parameters
    if (typeof configOrWidth === 'number' && height !== undefined) {
      config = {
        width: configOrWidth,
        height: height,
        boundaryType: 'absorbing' as any,
        enableSpatialIndex: true,
        maxObjectsPerNode: 10,
        maxTreeDepth: 6
      };
    } else {
      config = configOrWidth as ContinuousSpaceConfig;
    }

    super(config);

    this.config = { ...config };
    this.quadtree = null;

    // Default Euclidean distance function
    this.distanceFunction = (a: Position, b: Position) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };

    this.initializeQuadtree();
  }

  /**
   * Find agents within radius of position
   */
  findNeighbors(
    position: Position,
    radius: number,
    options: NeighborQueryOptions = {}
  ): SpatialQueryResult<Agent> {
    const startTime = performance.now();
    const maxResults = options.maxResults ?? Number.MAX_SAFE_INTEGER;
    const includeDistance = options.includeDistance ?? false;

    // Get potential neighbors from quadtree
    const candidates =
      this.config.enableSpatialIndex && this.quadtree
        ? this.queryQuadtree(position, radius)
        : Array.from(this.agents);

    const neighbors: Agent[] = [];
    const distances: number[] = [];

    for (const agent of candidates) {
      if (neighbors.length >= maxResults) break;

      const agentPosition = this.agentPositions.get(agent);
      if (!agentPosition) continue;

      const distance = this.distanceFunction(position, agentPosition);

      if (distance <= radius) {
        // Apply filter if provided
        if (options.filterFn && !options.filterFn(agent)) {
          continue;
        }

        neighbors.push(agent);
        if (includeDistance) {
          distances.push(distance);
        }
      }
    }

    // Sort by distance if distances are included
    if (includeDistance && distances.length > 0) {
      const combined = neighbors.map((agent, i) => ({
        agent,
        distance: distances[i] ?? 0,
      }));
      combined.sort((a, b) => a.distance - b.distance);

      neighbors.length = 0;
      distances.length = 0;

      for (const item of combined) {
        neighbors.push(item.agent);
        distances.push(item.distance);
      }
    }

    return {
      items: neighbors,
      distances: includeDistance ? distances : [],
      queryTime: performance.now() - startTime,
    };
  }

  /**
   * Get agents at specific position (within small tolerance)
   */
  getAgentsAt(position: Position): ReadonlyArray<Agent> {
    const tolerance = 0.001; // Small tolerance for floating-point comparison
    return this.findNeighbors(position, tolerance).items;
  }

  /**
   * Set custom distance function
   */
  setDistanceFunction(fn: DistanceFunction): void {
    this.distanceFunction = fn;
  }

  /**
   * Get Manhattan distance function
   */
  static getManhattanDistance(): DistanceFunction {
    return (a: Position, b: Position) =>
      Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Get Euclidean distance function (default)
   */
  static getEuclideanDistance(): DistanceFunction {
    return (a: Position, b: Position) => {
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    };
  }

  /**
   * Get Chebyshev distance function (max of x,y differences)
   */
  static getChebyshevDistance(): DistanceFunction {
    return (a: Position, b: Position) =>
      Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  /**
   * Get current configuration
   */
  getConfig(): ContinuousSpaceConfig {
    return { ...this.config };
  }

  /**
   * Update spatial configuration
   */
  updateConfig(newConfig: Partial<ContinuousSpaceConfig>): void {
    Object.assign(this.config, newConfig);

    if (
      'enableSpatialIndex' in newConfig ||
      'maxObjectsPerNode' in newConfig ||
      'maxTreeDepth' in newConfig
    ) {
      this.rebuildQuadtree();
    }
  }

  /**
   * Get quadtree statistics
   */
  getQuadtreeStats(): {
    nodeCount: number;
    maxDepth: number;
    agentCount: number;
  } {
    if (!this.quadtree) {
      return { nodeCount: 0, maxDepth: 0, agentCount: 0 };
    }

    return this.calculateQuadtreeStats(this.quadtree);
  }

  /**
   * Force rebuild of spatial index
   */
  rebuildQuadtree(): void {
    if (this.config.enableSpatialIndex) {
      this.initializeQuadtree();

      // Re-insert all agents
      for (const [agent, position] of this.agentPositions.entries()) {
        this.insertIntoQuadtree(agent, position);
      }
    }
  }

  /**
   * Check if quadtree needs rebalancing
   */
  needsRebalancing(): boolean {
    if (!this.quadtree || !this.config.enableSpatialIndex) {
      return false;
    }

    const stats = this.getQuadtreeStats();
    const avgAgentsPerNode = stats.agentCount / stats.nodeCount;

    // Rebalance if tree is too deep or unbalanced
    return (
      stats.maxDepth > this.config.maxTreeDepth * 1.5 ||
      avgAgentsPerNode < this.config.maxObjectsPerNode * 0.2
    );
  }

  /**
   * Rebalance quadtree for optimal performance
   */
  rebalanceQuadtree(): void {
    if (!this.needsRebalancing()) {
      return;
    }

    // Collect all agents and rebuild
    const agents: Array<{ agent: Agent; position: Position }> = [];
    for (const [agent, position] of this.agentPositions.entries()) {
      agents.push({ agent, position });
    }

    // Clear and rebuild
    this.initializeQuadtree();

    // Use optimized insertion order (space-filling curve)
    const sorted = this.sortByMortonCode(agents);
    for (const { agent, position } of sorted) {
      this.insertIntoQuadtree(agent, position);
    }
  }

  /**
   * Sort agents by Morton code (Z-order) for better spatial locality
   */
  private sortByMortonCode(
    agents: Array<{ agent: Agent; position: Position }>
  ): Array<{ agent: Agent; position: Position }> {
    return agents.sort((a, b) => {
      const mortonA = this.calculateMortonCode(a.position);
      const mortonB = this.calculateMortonCode(b.position);
      return mortonA - mortonB;
    });
  }

  /**
   * Calculate Morton code (Z-order) for a position
   */
  private calculateMortonCode(position: Position): number {
    // Normalize to 16-bit integers
    const x = Math.floor((position.x / this.dimensions.width) * 65535);
    const y = Math.floor((position.y / this.dimensions.height) * 65535);

    // Interleave bits for Z-order
    let morton = 0;
    for (let i = 0; i < 16; i++) {
      morton |= ((x & (1 << i)) << i) | ((y & (1 << i)) << (i + 1));
    }

    return morton;
  }

  /**
   * Merge quadtree nodes if they're underutilized
   */
  private tryMergeNode(node: QuadtreeNode): boolean {
    if (!node.children) {
      return false;
    }

    // Count total agents in children
    let totalAgents = 0;
    for (const child of node.children) {
      if (child.children) {
        // Can't merge if any child has children
        return false;
      }
      totalAgents += child.agents.length;
    }

    // Merge if under threshold
    if (totalAgents <= this.config.maxObjectsPerNode) {
      // Collect all agents from children
      node.agents = [];
      for (const child of node.children) {
        node.agents.push(...child.agents);
      }

      // Remove children
      node.children = null;
      return true;
    }

    return false;
  }

  /**
   * Optimize quadtree by merging underutilized nodes
   */
  optimizeQuadtree(): void {
    if (!this.quadtree || !this.config.enableSpatialIndex) {
      return;
    }

    this.optimizeNode(this.quadtree);
  }

  /**
   * Recursively optimize quadtree nodes
   */
  private optimizeNode(node: QuadtreeNode): void {
    if (!node.children) {
      return;
    }

    // Optimize children first (bottom-up)
    for (const child of node.children) {
      this.optimizeNode(child);
    }

    // Try to merge this node
    this.tryMergeNode(node);
  }

  /**
   * Hook: Handle agent addition
   */
  protected override onAgentAdded(agent: Agent, position: Position): void {
    if (this.config.enableSpatialIndex && this.quadtree) {
      this.insertIntoQuadtree(agent, position);
    }
  }

  /**
   * Hook: Handle agent removal
   */
  protected override onAgentRemoved(agent: Agent): void {
    if (this.config.enableSpatialIndex && this.quadtree) {
      this.removeFromQuadtree(agent);
    }
  }

  /**
   * Hook: Handle agent movement
   */
  protected override onAgentMoved(
    agent: Agent,
    _oldPosition: Position,
    newPosition: Position
  ): void {
    if (this.config.enableSpatialIndex && this.quadtree) {
      this.removeFromQuadtree(agent);
      this.insertIntoQuadtree(agent, newPosition);
    }
  }

  /**
   * Initialize quadtree structure
   */
  private initializeQuadtree(): void {
    if (!this.config.enableSpatialIndex) {
      this.quadtree = null;
      return;
    }

    this.quadtree = {
      bounds: {
        x: 0,
        y: 0,
        width: this.dimensions.width,
        height: this.dimensions.height,
      },
      agents: [],
      children: null,
      level: 0,
    };
  }

  /**
   * Insert agent into quadtree
   */
  private insertIntoQuadtree(agent: Agent, position: Position): void {
    if (!this.quadtree) return;

    this.insertIntoNode(this.quadtree, agent, position);
  }

  /**
   * Remove agent from quadtree
   */
  private removeFromQuadtree(agent: Agent): void {
    if (!this.quadtree) return;

    this.removeFromNode(this.quadtree, agent);
  }

  /**
   * Insert agent into specific quadtree node
   */
  private insertIntoNode(
    node: QuadtreeNode,
    agent: Agent,
    position: Position
  ): void {
    // Check if position is within node bounds
    if (!this.pointInBounds(position, node.bounds)) {
      return;
    }

    // If node has children, insert into appropriate child
    if (node.children) {
      for (const child of node.children) {
        this.insertIntoNode(child, agent, position);
      }
      return;
    }

    // Add to current node
    node.agents.push(agent);

    // Split if necessary
    if (
      node.agents.length > this.config.maxObjectsPerNode &&
      node.level < this.config.maxTreeDepth
    ) {
      this.splitNode(node);
    }
  }

  /**
   * Remove agent from quadtree node
   */
  private removeFromNode(node: QuadtreeNode, agent: Agent): boolean {
    // Remove from current node
    const index = node.agents.indexOf(agent);
    if (index >= 0) {
      node.agents.splice(index, 1);
      return true;
    }

    // Remove from children
    if (node.children) {
      for (const child of node.children) {
        if (this.removeFromNode(child, agent)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Split quadtree node into four children
   */
  private splitNode(node: QuadtreeNode): void {
    const { x, y, width, height } = node.bounds;
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    node.children = [
      // Top-left
      {
        bounds: { x, y, width: halfWidth, height: halfHeight },
        agents: [],
        children: null,
        level: node.level + 1,
      },
      // Top-right
      {
        bounds: { x: x + halfWidth, y, width: halfWidth, height: halfHeight },
        agents: [],
        children: null,
        level: node.level + 1,
      },
      // Bottom-left
      {
        bounds: { x, y: y + halfHeight, width: halfWidth, height: halfHeight },
        agents: [],
        children: null,
        level: node.level + 1,
      },
      // Bottom-right
      {
        bounds: {
          x: x + halfWidth,
          y: y + halfHeight,
          width: halfWidth,
          height: halfHeight,
        },
        agents: [],
        children: null,
        level: node.level + 1,
      },
    ];

    // Redistribute agents to children
    for (const agent of node.agents) {
      const position = this.agentPositions.get(agent);
      if (position) {
        for (const child of node.children) {
          if (this.pointInBounds(position, child.bounds)) {
            this.insertIntoNode(child, agent, position);
            break; // Agent only goes into one quadrant
          }
        }
      }
    }

    // Clear agents from parent node
    node.agents = [];
  }

  /**
   * Query quadtree for agents within radius
   */
  private queryQuadtree(position: Position, radius: number): Agent[] {
    if (!this.quadtree) return [];

    const result: Agent[] = [];
    this.queryNode(this.quadtree, position, radius, result);
    return result;
  }

  /**
   * Query specific quadtree node
   */
  private queryNode(
    node: QuadtreeNode,
    position: Position,
    radius: number,
    result: Agent[]
  ): void {
    // Check if search circle intersects with node bounds
    if (!this.circleIntersectsBounds(position, radius, node.bounds)) {
      return;
    }

    // Add agents from current node
    result.push(...node.agents);

    // Query children
    if (node.children) {
      for (const child of node.children) {
        this.queryNode(child, position, radius, result);
      }
    }
  }

  /**
   * Check if point is within bounds
   */
  private pointInBounds(
    point: Position,
    bounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    return (
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y < bounds.y + bounds.height
    );
  }

  /**
   * Check if circle intersects with bounds
   */
  private circleIntersectsBounds(
    center: Position,
    radius: number,
    bounds: { x: number; y: number; width: number; height: number }
  ): boolean {
    const closestX = Math.max(
      bounds.x,
      Math.min(center.x, bounds.x + bounds.width)
    );
    const closestY = Math.max(
      bounds.y,
      Math.min(center.y, bounds.y + bounds.height)
    );

    const dx = center.x - closestX;
    const dy = center.y - closestY;

    return dx * dx + dy * dy <= radius * radius;
  }

  /**
   * Calculate quadtree statistics
   */
  private calculateQuadtreeStats(node: QuadtreeNode): {
    nodeCount: number;
    maxDepth: number;
    agentCount: number;
  } {
    let nodeCount = 1;
    let maxDepth = node.level;
    let agentCount = node.agents.length;

    if (node.children) {
      for (const child of node.children) {
        const childStats = this.calculateQuadtreeStats(child);
        nodeCount += childStats.nodeCount;
        maxDepth = Math.max(maxDepth, childStats.maxDepth);
        agentCount += childStats.agentCount;
      }
    }

    return { nodeCount, maxDepth, agentCount };
  }
}
