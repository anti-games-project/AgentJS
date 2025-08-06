/**
 * NetworkManager - Social network management system
 */

import { EventEmitter } from 'eventemitter3';
import type { AgentId } from '../../types/core';

/** Connection types in the social network */
export enum ConnectionType {
  SUPPORTIVE = 'supportive', // Positive influence, mutual benefit
  EXPLOITATIVE = 'exploitative', // One-sided benefit, negative influence
  ECONOMIC = 'economic', // Transactional relationship
}

/** Represents a connection between two agents */
export interface NetworkConnection {
  readonly id: string;
  readonly source: AgentId;
  readonly target: AgentId;
  readonly type: ConnectionType;
  weight: number; // Connection strength (0-1)
  readonly createdAt: number;
  lastInteraction: number;
  metadata: Record<string, any>;
}

/** Network formation configuration */
export interface NetworkConfig {
  readonly maxConnections: number;
  readonly connectionDecayRate: number;
  readonly minConnectionWeight: number;
  readonly enableAutoDecay: boolean;
  readonly proximityRadius: number;
  readonly similarityThreshold: number;
}

/** Network analysis result */
export interface NetworkAnalysis {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly averageDegree: number;
  readonly density: number;
  readonly clustering: number;
  readonly components: number;
}

/** Path finding result */
export interface PathResult {
  readonly found: boolean;
  readonly path: AgentId[];
  readonly distance: number;
  readonly hops: number;
}

/**
 * NetworkManager - Manages social networks between agents
 *
 * Features:
 * - Weighted, directed graph representation
 * - Multiple connection types with different behaviors
 * - Dynamic network formation and dissolution
 * - Social influence propagation
 * - Network analysis and pathfinding
 * - Connection lifecycle management
 *
 * Educational Context: Simulates social dynamics in
 * communities, allowing modeling of support networks,
 * economic relationships, and social influence patterns.
 */
export class NetworkManager extends EventEmitter {
  /** Adjacency list representation of the network */
  private readonly adjacencyList: Map<AgentId, Set<NetworkConnection>>;

  /** Quick lookup for connections by ID */
  private readonly connections: Map<string, NetworkConnection>;

  /** Reverse index for incoming connections */
  private readonly incomingConnections: Map<AgentId, Set<NetworkConnection>>;

  /** Network configuration */
  private config: NetworkConfig;

  /** Connection ID counter */
  private connectionIdCounter: number;

  /** Network statistics cache */
  private statsCache: NetworkAnalysis | null;

  constructor(config: Partial<NetworkConfig> = {}) {
    super();

    this.adjacencyList = new Map();
    this.connections = new Map();
    this.incomingConnections = new Map();
    this.connectionIdCounter = 0;
    this.statsCache = null;

    this.config = {
      maxConnections: 50,
      connectionDecayRate: 0.01,
      minConnectionWeight: 0.1,
      enableAutoDecay: true,
      proximityRadius: 10,
      similarityThreshold: 0.5,
      ...config,
    };
  }

  /**
   * Add a connection between two agents
   */
  addConnection(
    source: AgentId,
    target: AgentId,
    type: ConnectionType,
    weight: number = 0.5,
    metadata: Record<string, any> = {}
  ): NetworkConnection | null {
    // Validate agents are different
    if (source === target) {
      return null;
    }

    // Check connection limit
    const sourceConnections = this.adjacencyList.get(source)?.size ?? 0;
    if (sourceConnections >= this.config.maxConnections) {
      this.emit('connectionLimitReached', {
        agent: source,
        limit: this.config.maxConnections,
      });
      return null;
    }

    // Check if connection already exists
    if (this.hasConnection(source, target)) {
      return null;
    }

    // Create new connection
    const connection: NetworkConnection = {
      id: `conn_${++this.connectionIdCounter}`,
      source,
      target,
      type,
      weight: Math.max(0, Math.min(1, weight)),
      createdAt: Date.now(),
      lastInteraction: Date.now(),
      metadata,
    };

    // Add to adjacency list
    if (!this.adjacencyList.has(source)) {
      this.adjacencyList.set(source, new Set());
    }
    this.adjacencyList.get(source)!.add(connection);

    // Add to reverse index
    if (!this.incomingConnections.has(target)) {
      this.incomingConnections.set(target, new Set());
    }
    this.incomingConnections.get(target)!.add(connection);

    // Add to connections map
    this.connections.set(connection.id, connection);

    // Invalidate cache
    this.statsCache = null;

    // Emit event
    this.emit('connectionAdded', { connection });

    return connection;
  }

  /**
   * Remove a connection
   */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    // Remove from adjacency list
    const sourceConnections = this.adjacencyList.get(connection.source);
    sourceConnections?.delete(connection);

    // Remove from reverse index
    const targetConnections = this.incomingConnections.get(connection.target);
    targetConnections?.delete(connection);

    // Remove from connections map
    this.connections.delete(connectionId);

    // Invalidate cache
    this.statsCache = null;

    // Emit event
    this.emit('connectionRemoved', { connection });

    return true;
  }

  /**
   * Get all connections for an agent
   */
  getConnections(agentId: AgentId): ReadonlyArray<NetworkConnection> {
    return Array.from(this.adjacencyList.get(agentId) ?? []);
  }

  /**
   * Get incoming connections for an agent
   */
  getIncomingConnections(agentId: AgentId): ReadonlyArray<NetworkConnection> {
    return Array.from(this.incomingConnections.get(agentId) ?? []);
  }

  /**
   * Check if connection exists between agents
   */
  hasConnection(source: AgentId, target: AgentId): boolean {
    const connections = this.adjacencyList.get(source);
    if (!connections) return false;

    for (const conn of connections) {
      if (conn.target === target) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get connection between two agents
   */
  getConnection(
    source: AgentId,
    target: AgentId
  ): NetworkConnection | undefined {
    const connections = this.adjacencyList.get(source);
    if (!connections) return undefined;

    for (const conn of connections) {
      if (conn.target === target) {
        return conn;
      }
    }

    return undefined;
  }

  /**
   * Update connection weight
   */
  updateConnectionWeight(connectionId: string, delta: number): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return false;
    }

    const oldWeight = connection.weight;
    connection.weight = Math.max(0, Math.min(1, connection.weight + delta));
    connection.lastInteraction = Date.now();

    // Check if connection should be removed
    if (connection.weight < this.config.minConnectionWeight) {
      this.removeConnection(connectionId);
      return true;
    }

    // Emit event
    this.emit('connectionWeightChanged', {
      connection,
      oldWeight,
      newWeight: connection.weight,
    });

    return true;
  }

  /**
   * Strengthen connection based on interaction
   */
  strengthenConnection(
    source: AgentId,
    target: AgentId,
    amount: number = 0.1
  ): boolean {
    const connection = this.getConnection(source, target);
    if (!connection) {
      return false;
    }

    return this.updateConnectionWeight(connection.id, Math.abs(amount));
  }

  /**
   * Weaken connection
   */
  weakenConnection(
    source: AgentId,
    target: AgentId,
    amount: number = 0.1
  ): boolean {
    const connection = this.getConnection(source, target);
    if (!connection) {
      return false;
    }

    return this.updateConnectionWeight(connection.id, -Math.abs(amount));
  }

  /**
   * Apply decay to all connections
   */
  applyDecay(): void {
    if (!this.config.enableAutoDecay) {
      return;
    }

    const toRemove: string[] = [];

    for (const [id, connection] of this.connections) {
      const timeSinceInteraction = Date.now() - connection.lastInteraction;
      const decayFactor = timeSinceInteraction / (1000 * 60 * 60); // Hours
      const decay = this.config.connectionDecayRate * decayFactor;

      connection.weight = Math.max(0, connection.weight - decay);

      if (connection.weight < this.config.minConnectionWeight) {
        toRemove.push(id);
      }
    }

    // Remove dead connections
    for (const id of toRemove) {
      this.removeConnection(id);
    }
  }

  /**
   * Get agent degree (number of connections)
   */
  getDegree(agentId: AgentId): { in: number; out: number; total: number } {
    const outDegree = this.adjacencyList.get(agentId)?.size ?? 0;
    const inDegree = this.incomingConnections.get(agentId)?.size ?? 0;

    return {
      in: inDegree,
      out: outDegree,
      total: inDegree + outDegree,
    };
  }

  /**
   * Find shortest path between agents (BFS)
   */
  findPath(source: AgentId, target: AgentId): PathResult {
    if (source === target) {
      return { found: true, path: [source], distance: 0, hops: 0 };
    }

    const visited = new Set<AgentId>();
    const queue: Array<{ agent: AgentId; path: AgentId[]; distance: number }> =
      [{ agent: source, path: [source], distance: 0 }];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.agent)) {
        continue;
      }

      visited.add(current.agent);

      const connections = this.adjacencyList.get(current.agent) ?? [];

      for (const conn of connections) {
        if (conn.target === target) {
          const path = [...current.path, target];
          return {
            found: true,
            path,
            distance: current.distance + conn.weight,
            hops: path.length - 1,
          };
        }

        if (!visited.has(conn.target)) {
          queue.push({
            agent: conn.target,
            path: [...current.path, conn.target],
            distance: current.distance + conn.weight,
          });
        }
      }
    }

    return { found: false, path: [], distance: Infinity, hops: -1 };
  }

  /**
   * Get network statistics
   */
  getNetworkAnalysis(): NetworkAnalysis {
    if (this.statsCache) {
      return this.statsCache;
    }

    const nodes = new Set<AgentId>();
    let totalDegree = 0;

    // Count nodes and edges
    for (const [agent, connections] of this.adjacencyList) {
      nodes.add(agent);
      totalDegree += connections.size;
    }

    for (const [agent] of this.incomingConnections) {
      nodes.add(agent);
    }

    const nodeCount = nodes.size;
    const edgeCount = this.connections.size;
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;
    const maxPossibleEdges = nodeCount * (nodeCount - 1);
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;

    // Calculate clustering coefficient (simplified)
    let triangles = 0;
    let triples = 0;

    for (const agent of nodes) {
      const neighbors = this.getConnections(agent).map(c => c.target);
      const degree = neighbors.length;

      if (degree >= 2) {
        triples += (degree * (degree - 1)) / 2;

        // Count triangles
        for (let i = 0; i < neighbors.length; i++) {
          for (let j = i + 1; j < neighbors.length; j++) {
            if (this.hasConnection(neighbors[i]!, neighbors[j]!)) {
              triangles++;
            }
          }
        }
      }
    }

    const clustering = triples > 0 ? (3 * triangles) / triples : 0;

    // Count components (simplified - counts weakly connected)
    const components = this.countComponents(nodes);

    this.statsCache = {
      nodeCount,
      edgeCount,
      averageDegree,
      density,
      clustering,
      components,
    };

    return this.statsCache;
  }

  /**
   * Get total number of connections in the network
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Count connected components
   */
  private countComponents(nodes: Set<AgentId>): number {
    const visited = new Set<AgentId>();
    let components = 0;

    for (const node of nodes) {
      if (!visited.has(node)) {
        components++;
        this.dfsVisit(node, visited);
      }
    }

    return components;
  }

  /**
   * DFS visit for component counting
   */
  private dfsVisit(node: AgentId, visited: Set<AgentId>): void {
    visited.add(node);

    const connections = this.adjacencyList.get(node) ?? [];
    for (const conn of connections) {
      if (!visited.has(conn.target)) {
        this.dfsVisit(conn.target, visited);
      }
    }

    const incoming = this.incomingConnections.get(node) ?? [];
    for (const conn of incoming) {
      if (!visited.has(conn.source)) {
        this.dfsVisit(conn.source, visited);
      }
    }
  }

  /**
   * Clear all connections
   */
  clear(): void {
    this.adjacencyList.clear();
    this.connections.clear();
    this.incomingConnections.clear();
    this.connectionIdCounter = 0;
    this.statsCache = null;

    this.emit('networkCleared');
  }

  /**
   * Get current configuration
   */
  getConfig(): NetworkConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NetworkConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configurationChanged', { config: this.config });
  }

  /**
   * Get all connections in the network
   */
  getAllConnections(): ReadonlyArray<NetworkConnection> {
    return Array.from(this.connections.values());
  }

  /**
   * Get connection by ID
   */
  getConnectionById(id: string): NetworkConnection | undefined {
    return this.connections.get(id);
  }
}
