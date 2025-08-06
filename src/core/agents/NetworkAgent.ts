/**
 * NetworkAgent - Agent with connection and relationship management
 */

import { BaseAgent } from './BaseAgent';
import type { Agent } from './Agent';
import type { AgentId, Position, AgentProperties } from '../../types/core';
import type { ConnectionEvent } from '../../types/events';

/** Connection between agents */
export interface Connection {
  readonly target: Agent;
  readonly type: string;
  readonly strength: number;
  readonly createdAt: number;
  readonly lastInteraction: number;
  readonly metadata: Record<string, any>;
}

/** Network statistics */
export interface NetworkStats {
  readonly connectionCount: number;
  readonly strongConnections: number;
  readonly weakConnections: number;
  readonly averageStrength: number;
  readonly mostConnectedAgent: AgentId | null;
  readonly clusteringCoefficient: number;
}

/**
 * NetworkAgent - Agent with social network capabilities
 *
 * Features:
 * - Connection management with other agents
 * - Relationship types and strength tracking
 * - Network topology analysis
 * - Information flow and influence modeling
 *
 * Educational Context: Represents community members who
 * form social networks, influence relationships, and
 * participate in information sharing and collective behaviors.
 */
export class NetworkAgent extends BaseAgent {
  /** Outgoing connections to other agents */
  protected connections: Map<AgentId, Connection>;

  /** Incoming connections from other agents (for efficient lookup) */
  protected incomingConnections: Set<AgentId>;

  /** Network influence value */
  protected influence: number;

  /** Trust values for other agents */
  protected trustLevels: Map<AgentId, number>;

  constructor(
    id?: string | AgentId,
    initialProperties: AgentProperties = {},
    initialPosition: Position = { x: 0, y: 0 } as Position
  ) {
    super(id, initialProperties, initialPosition);

    this.connections = new Map();
    this.incomingConnections = new Set();
    this.influence = 1.0;
    this.trustLevels = new Map();
  }

  /**
   * Basic step - can be overridden for network-specific behaviors
   */
  override step(): void {
    // Decay connection strengths over time
    this.decayConnections();

    // Update influence based on network position
    this.updateInfluence();
  }

  /**
   * Create connection to another agent
   */
  connect(
    target: Agent,
    type: string = 'default',
    strength: number = 1.0,
    metadata: Record<string, any> = {}
  ): void {
    if (target.id === this.id) {
      throw new Error('Agent cannot connect to itself');
    }

    if (strength < 0 || strength > 1) {
      throw new Error('Connection strength must be between 0 and 1');
    }

    const connection: Connection = {
      target,
      type,
      strength,
      createdAt: Date.now(),
      lastInteraction: Date.now(),
      metadata: { ...metadata },
    };

    this.connections.set(target.id, connection);

    // Notify target of incoming connection
    if (target instanceof NetworkAgent) {
      target.addIncomingConnection(this.id);
    }

    this.emitConnectionEvent('connectionFormed', target, type, strength);
  }

  /**
   * Remove connection to another agent
   */
  disconnect(target: Agent): boolean {
    const hadConnection = this.connections.has(target.id);

    if (hadConnection) {
      const connection = this.connections.get(target.id)!;
      this.connections.delete(target.id);

      // Notify target of connection removal
      if (target instanceof NetworkAgent) {
        target.removeIncomingConnection(this.id);
      }

      this.emitConnectionEvent(
        'connectionBroken',
        target,
        connection.type,
        connection.strength
      );
    }

    return hadConnection;
  }

  /**
   * Check if connected to another agent
   */
  isConnectedTo(target: Agent): boolean {
    return this.connections.has(target.id);
  }

  /**
   * Get connection to specific agent
   */
  getConnection(target: Agent): Connection | undefined {
    return this.connections.get(target.id);
  }

  /**
   * Get all connections
   */
  getAllConnections(): ReadonlyArray<Connection> {
    return Array.from(this.connections.values());
  }

  /**
   * Get connections of specific type
   */
  getConnectionsByType(type: string): ReadonlyArray<Connection> {
    return Array.from(this.connections.values()).filter(
      conn => conn.type === type
    );
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get strong connections (strength > 0.7)
   */
  getStrongConnections(): ReadonlyArray<Connection> {
    return Array.from(this.connections.values()).filter(
      conn => conn.strength > 0.7
    );
  }

  /**
   * Get weak connections (strength <= 0.3)
   */
  getWeakConnections(): ReadonlyArray<Connection> {
    return Array.from(this.connections.values()).filter(
      conn => conn.strength <= 0.3
    );
  }

  /**
   * Update connection strength
   */
  updateConnectionStrength(target: Agent, newStrength: number): void {
    if (newStrength < 0 || newStrength > 1) {
      throw new Error('Connection strength must be between 0 and 1');
    }

    const connection = this.connections.get(target.id);
    if (!connection) {
      throw new Error(`No connection to agent ${target.id}`);
    }

    const updatedConnection: Connection = {
      ...connection,
      strength: newStrength,
      lastInteraction: Date.now(),
    };

    this.connections.set(target.id, updatedConnection);
    this.emitConnectionEvent(
      'connectionModified',
      target,
      connection.type,
      newStrength
    );
  }

  /**
   * Strengthen connection through interaction
   */
  strengthenConnection(target: Agent, amount: number = 0.1): void {
    const connection = this.connections.get(target.id);
    if (connection) {
      const newStrength = Math.min(1.0, connection.strength + amount);
      this.updateConnectionStrength(target, newStrength);
    }
  }

  /**
   * Weaken connection
   */
  weakenConnection(target: Agent, amount: number = 0.1): void {
    const connection = this.connections.get(target.id);
    if (connection) {
      const newStrength = Math.max(0, connection.strength - amount);
      if (newStrength === 0) {
        this.disconnect(target);
      } else {
        this.updateConnectionStrength(target, newStrength);
      }
    }
  }

  /**
   * Set trust level for another agent
   */
  setTrust(target: Agent, trust: number): void {
    if (trust < 0 || trust > 1) {
      throw new Error('Trust level must be between 0 and 1');
    }
    this.trustLevels.set(target.id, trust);
  }

  /**
   * Get trust level for another agent
   */
  getTrust(target: Agent): number {
    return this.trustLevels.get(target.id) ?? 0.5; // Default neutral trust
  }

  /**
   * Get network influence
   */
  getInfluence(): number {
    return this.influence;
  }

  /**
   * Set network influence
   */
  setInfluence(influence: number): void {
    if (influence < 0) {
      throw new Error('Influence cannot be negative');
    }
    this.influence = influence;
  }

  /**
   * Get network neighbors (connected agents)
   */
  getNeighbors(): ReadonlyArray<Agent> {
    return Array.from(this.connections.values()).map(conn => conn.target);
  }

  /**
   * Get neighbors within a certain trust threshold
   */
  getTrustedNeighbors(minTrust: number = 0.7): ReadonlyArray<Agent> {
    return this.getNeighbors().filter(
      agent => this.getTrust(agent) >= minTrust
    );
  }

  /**
   * Calculate network statistics
   */
  getNetworkStats(): NetworkStats {
    const connections = Array.from(this.connections.values());
    const strongConnections = connections.filter(conn => conn.strength > 0.7);
    const weakConnections = connections.filter(conn => conn.strength <= 0.3);

    const averageStrength =
      connections.length > 0
        ? connections.reduce((sum, conn) => sum + conn.strength, 0) /
          connections.length
        : 0;

    // Simple clustering coefficient (requires more complex calculation for accuracy)
    const clusteringCoefficient = this.calculateClusteringCoefficient();

    return {
      connectionCount: connections.length,
      strongConnections: strongConnections.length,
      weakConnections: weakConnections.length,
      averageStrength,
      mostConnectedAgent: this.findMostConnectedNeighbor(),
      clusteringCoefficient,
    };
  }

  /**
   * Add incoming connection reference
   */
  addIncomingConnection(fromAgent: AgentId): void {
    this.incomingConnections.add(fromAgent);
  }

  /**
   * Remove incoming connection reference
   */
  removeIncomingConnection(fromAgent: AgentId): void {
    this.incomingConnections.delete(fromAgent);
  }

  /**
   * Get incoming connection count
   */
  getIncomingConnectionCount(): number {
    return this.incomingConnections.size;
  }

  /**
   * Calculate degree centrality (total connections)
   */
  getDegreeCentrality(): number {
    return this.connections.size + this.incomingConnections.size;
  }

  /**
   * Decay connection strengths over time
   */
  private decayConnections(): void {
    const decayRate = 0.001; // Configurable decay rate
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    for (const [agentId, connection] of this.connections.entries()) {
      const age = now - connection.lastInteraction;
      if (age > maxAge) {
        const decay = Math.min((decayRate * age) / maxAge, 0.1);
        const newStrength = Math.max(0, connection.strength - decay);

        if (newStrength === 0) {
          this.connections.delete(agentId);
          this.emitConnectionEvent(
            'connectionBroken',
            connection.target,
            connection.type,
            0
          );
        } else {
          const updatedConnection: Connection = {
            ...connection,
            strength: newStrength,
          };
          this.connections.set(agentId, updatedConnection);
        }
      }
    }
  }

  /**
   * Update influence based on network position
   */
  private updateInfluence(): void {
    // Simple influence calculation based on degree centrality and connection strength
    const totalStrength = Array.from(this.connections.values()).reduce(
      (sum, conn) => sum + conn.strength,
      0
    );

    const incomingInfluence = this.incomingConnections.size * 0.5;
    this.influence = Math.max(
      0.1,
      1.0 + totalStrength * 0.1 + incomingInfluence * 0.1
    );
  }

  /**
   * Calculate clustering coefficient
   */
  private calculateClusteringCoefficient(): number {
    const neighbors = this.getNeighbors();
    if (neighbors.length < 2) {
      return 0;
    }

    let triangles = 0;
    let possibleTriangles = 0;

    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        possibleTriangles++;

        const neighbor1 = neighbors[i];
        const neighbor2 = neighbors[j];

        if (
          neighbor1 instanceof NetworkAgent &&
          neighbor2 &&
          neighbor1.isConnectedTo(neighbor2)
        ) {
          triangles++;
        }
      }
    }

    return possibleTriangles > 0 ? triangles / possibleTriangles : 0;
  }

  /**
   * Find the most connected neighbor
   */
  private findMostConnectedNeighbor(): AgentId | null {
    let maxConnections = -1;
    let mostConnected: AgentId | null = null;

    for (const neighbor of this.getNeighbors()) {
      if (neighbor instanceof NetworkAgent) {
        const connectionCount = neighbor.getConnectionCount();
        if (connectionCount > maxConnections) {
          maxConnections = connectionCount;
          mostConnected = neighbor.id;
        }
      }
    }

    return mostConnected;
  }

  /**
   * Emit connection event
   */
  private emitConnectionEvent(
    type: ConnectionEvent['type'],
    target: Agent,
    connectionType: string,
    strength: number
  ): void {
    const event: ConnectionEvent = {
      type,
      timestamp: Date.now(),
      source: this,
      target,
      connectionType,
      strength,
    };

    this.emit(type, event);
  }
}
