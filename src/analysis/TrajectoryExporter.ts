import type { Agent } from '../core/agents/Agent';
import type { AgentManager } from '../core/AgentManager';
import type { NetworkManager } from '../core/network/NetworkManager';
import type { Environment } from '../core/environment/Environment';
import type { PropertyValue } from '../types/core';

/**
 * Configuration for trajectory export
 */
export interface TrajectoryExportConfig {
  /** Fields to include in export */
  fields?: string[];
  /** Filter function for agents */
  filter?: (agent: Agent) => boolean;
  /** Include timestamps */
  includeTimestamps?: boolean;
  /** Sample rate (export every N steps) */
  sampleRate?: number;
  /** Maximum records to export */
  maxRecords?: number;
  /** Include position data */
  includePosition?: boolean;
  /** Include velocity data */
  includeVelocity?: boolean;
}

/**
 * Data point for trajectory export
 */
export interface TrajectoryDataPoint {
  step: number;
  timestamp: number;
  agentId: string;
  position?: { x: number; y: number };
  velocity?: { x: number; y: number };
  [key: string]: PropertyValue;
}

/**
 * Network export data structure
 */
export interface NetworkExportData {
  nodes: Array<{
    id: string;
    type: string;
    position?: { x: number; y: number };
    properties: Record<string, PropertyValue>;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
    strength: number;
  }>;
  metrics: {
    nodeCount: number;
    edgeCount: number;
    density: number;
    averageDegree: number;
  };
}

/**
 * Environmental metrics export data
 */
export interface EnvironmentalMetricsData {
  type: string;
  dimensions: { width: number; height: number };
  agentCount: number;
  densityMap?: number[][];
  spatialMetrics: {
    centerOfMass: { x: number; y: number };
    dispersion: number;
    clustering: number;
  };
  resourceDistribution?: Record<string, any>;
}

/**
 * Enhanced trajectory and network exporter for AgentJS
 */
export class TrajectoryExporter {
  private trajectoryData: TrajectoryDataPoint[] = [];
  private config: Required<TrajectoryExportConfig>;

  constructor(config: TrajectoryExportConfig = {}) {
    this.config = {
      fields: config.fields || [],
      filter: config.filter || (() => true),
      includeTimestamps: config.includeTimestamps ?? true,
      sampleRate: config.sampleRate || 1,
      maxRecords: config.maxRecords || Infinity,
      includePosition: config.includePosition ?? true,
      includeVelocity: config.includeVelocity ?? false
    };
  }

  /**
   * Record current simulation state for trajectory export
   */
  recordTrajectoryStep(agentManager: AgentManager, step: number): void {
    
    // Check sample rate
    if (step % this.config.sampleRate !== 0) {
      return;
    }

    const timestamp = Date.now();
    const agents = agentManager.getAllAgents().filter(this.config.filter);

    for (const agent of agents) {
      // Check max records before adding each agent
      if (this.trajectoryData.length >= this.config.maxRecords) {
        break;
      }
      const dataPoint: TrajectoryDataPoint = {
        step,
        timestamp,
        agentId: agent.id
      };

      // Add position if requested and available
      if (this.config.includePosition && 'position' in agent) {
        const pos = (agent as any).position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          dataPoint.position = { x: pos.x, y: pos.y };
        }
      }

      // Add velocity if requested and available
      if (this.config.includeVelocity && 'velocity' in agent) {
        const vel = (agent as any).velocity;
        if (vel && typeof vel.x === 'number' && typeof vel.y === 'number') {
          dataPoint.velocity = { x: vel.x, y: vel.y };
        }
      }

      // Add specified fields or all properties
      if (this.config.fields.length > 0) {
        for (const field of this.config.fields) {
          dataPoint[field] = agent.getProperty(field) ?? null;
        }
      } else {
        // Export all properties except position/velocity (already handled)
        const properties = agent.getProperties();
        for (const [key, value] of Object.entries(properties)) {
          if (key !== 'position' && key !== 'velocity') {
            dataPoint[key] = value;
          }
        }
      }

      this.trajectoryData.push(dataPoint);
    }
  }

  /**
   * Export trajectories as CSV with proper formatting
   */
  exportTrajectoriesCSV(): string {
    if (this.trajectoryData.length === 0) {
      return '';
    }

    // Get all unique fields across all data points
    const fieldSet = new Set<string>();
    for (const point of this.trajectoryData) {
      Object.keys(point).forEach(key => {
        if (key === 'position' || key === 'velocity') {
          // Expand position/velocity into x,y components
          if (key === 'position' && point.position) {
            fieldSet.add('position_x');
            fieldSet.add('position_y');
          }
          if (key === 'velocity' && point.velocity) {
            fieldSet.add('velocity_x');
            fieldSet.add('velocity_y');
          }
        } else {
          fieldSet.add(key);
        }
      });
    }

    // Create ordered header array
    const headers = Array.from(fieldSet).sort((a, b) => {
      // Order: step, timestamp, agentId, position, velocity, then alphabetical
      const order = ['step', 'timestamp', 'agentId', 'position_x', 'position_y', 'velocity_x', 'velocity_y'];
      const aIndex = order.indexOf(a);
      const bIndex = order.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });

    const csvLines = [headers.join(',')];

    // Add data rows
    for (const point of this.trajectoryData) {
      const row = headers.map(header => {
        if (header === 'position_x') return point.position?.x ?? '';
        if (header === 'position_y') return point.position?.y ?? '';
        if (header === 'velocity_x') return point.velocity?.x ?? '';
        if (header === 'velocity_y') return point.velocity?.y ?? '';
        
        const value = point[header];
        return this.formatCSVValue(value ?? '');
      });
      csvLines.push(row.join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Export network data with comprehensive metrics
   */
  exportNetwork(networkManager: NetworkManager, agentManager: AgentManager): NetworkExportData {
    const nodes: NetworkExportData['nodes'] = [];
    const edges: NetworkExportData['edges'] = [];
    const degreeMap = new Map<string, number>();

    // Export nodes (agents)
    const agents = agentManager.getAllAgents();
    for (const agent of agents) {
      const node: NetworkExportData['nodes'][0] = {
        id: agent.id,
        type: agent.constructor.name,
        properties: agent.getProperties()
      };

      // Add position if available
      if ('position' in agent) {
        const pos = (agent as any).position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          node.position = { x: pos.x, y: pos.y };
        }
      }

      nodes.push(node);
      degreeMap.set(agent.id, 0);
    }

    // Export edges (connections)
    for (const agent of agents) {
      const connections = networkManager.getConnections(agent.id);
      for (const connection of connections) {
        edges.push({
          source: agent.id,
          target: connection.target,
          type: connection.type,
          strength: connection.weight
        });
        
        // Update degree counts
        degreeMap.set(agent.id, (degreeMap.get(agent.id) || 0) + 1);
        degreeMap.set(connection.target, (degreeMap.get(connection.target) || 0) + 1);
      }
    }

    // Calculate network metrics
    const nodeCount = nodes.length;
    const edgeCount = edges.length;
    const maxPossibleEdges = (nodeCount * (nodeCount - 1)) / 2;
    const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
    const totalDegree = Array.from(degreeMap.values()).reduce((sum, deg) => sum + deg, 0);
    const averageDegree = nodeCount > 0 ? totalDegree / nodeCount : 0;

    return {
      nodes,
      edges,
      metrics: {
        nodeCount,
        edgeCount,
        density,
        averageDegree
      }
    };
  }

  /**
   * Export network as GraphML format for visualization tools
   */
  exportNetworkGraphML(networkManager: NetworkManager, agentManager: AgentManager): string {
    const networkData = this.exportNetwork(networkManager, agentManager);
    
    let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
    
    // Define attributes
    graphml += '  <key id="type" for="node" attr.name="type" attr.type="string"/>\n';
    graphml += '  <key id="x" for="node" attr.name="x" attr.type="double"/>\n';
    graphml += '  <key id="y" for="node" attr.name="y" attr.type="double"/>\n';
    graphml += '  <key id="connection_type" for="edge" attr.name="type" attr.type="string"/>\n';
    graphml += '  <key id="strength" for="edge" attr.name="strength" attr.type="double"/>\n';
    
    graphml += '  <graph id="G" edgedefault="undirected">\n';
    
    // Add nodes
    for (const node of networkData.nodes) {
      graphml += `    <node id="${node.id}">\n`;
      graphml += `      <data key="type">${node.type}</data>\n`;
      if (node.position) {
        graphml += `      <data key="x">${node.position.x}</data>\n`;
        graphml += `      <data key="y">${node.position.y}</data>\n`;
      }
      graphml += '    </node>\n';
    }
    
    // Add edges
    for (const edge of networkData.edges) {
      graphml += `    <edge source="${edge.source}" target="${edge.target}">\n`;
      graphml += `      <data key="connection_type">${edge.type}</data>\n`;
      graphml += `      <data key="strength">${edge.strength}</data>\n`;
      graphml += '    </edge>\n';
    }
    
    graphml += '  </graph>\n';
    graphml += '</graphml>';
    
    return graphml;
  }

  /**
   * Export environmental metrics with spatial analysis
   */
  exportEnvironmentalMetrics(
    environment: Environment,
    agentManager: AgentManager
  ): EnvironmentalMetricsData {
    const dimensions = environment.getDimensions();
    const agents = agentManager.getAllAgents();
    
    // Calculate center of mass
    let totalX = 0, totalY = 0;
    let spatialAgentCount = 0;
    
    for (const agent of agents) {
      if ('position' in agent) {
        const pos = (agent as any).position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          totalX += pos.x;
          totalY += pos.y;
          spatialAgentCount++;
        }
      }
    }
    
    const centerOfMass = spatialAgentCount > 0
      ? { x: totalX / spatialAgentCount, y: totalY / spatialAgentCount }
      : { x: dimensions.width / 2, y: dimensions.height / 2 };
    
    // Calculate dispersion (average distance from center of mass)
    let totalDistance = 0;
    for (const agent of agents) {
      if ('position' in agent) {
        const pos = (agent as any).position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          const dx = pos.x - centerOfMass.x;
          const dy = pos.y - centerOfMass.y;
          totalDistance += Math.sqrt(dx * dx + dy * dy);
        }
      }
    }
    
    const dispersion = spatialAgentCount > 0 ? totalDistance / spatialAgentCount : 0;
    
    // Calculate clustering coefficient (simplified)
    const gridSize = 50; // Grid cells for density calculation
    const cellWidth = dimensions.width / gridSize;
    const cellHeight = dimensions.height / gridSize;
    const densityGrid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    
    for (const agent of agents) {
      if ('position' in agent) {
        const pos = (agent as any).position;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          const gridX = Math.floor(pos.x / cellWidth);
          const gridY = Math.floor(pos.y / cellHeight);
          if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize && densityGrid[gridY]) {
            densityGrid[gridY]![gridX]++;
          }
        }
      }
    }
    
    // Calculate clustering as variance in density
    const flatDensity = densityGrid.flat();
    const avgDensity = flatDensity.reduce((a, b) => a + b, 0) / flatDensity.length;
    const variance = flatDensity.reduce((sum, val) => sum + Math.pow(val - avgDensity, 2), 0) / flatDensity.length;
    const clustering = Math.sqrt(variance) / (avgDensity + 1); // Normalized clustering coefficient
    
    return {
      type: environment.constructor.name,
      dimensions,
      agentCount: agents.length,
      densityMap: densityGrid,
      spatialMetrics: {
        centerOfMass,
        dispersion,
        clustering
      }
    };
  }

  /**
   * Stream export for memory-efficient large dataset handling
   */
  *streamTrajectoryData(batchSize: number = 1000): Generator<TrajectoryDataPoint[]> {
    for (let i = 0; i < this.trajectoryData.length; i += batchSize) {
      yield this.trajectoryData.slice(i, i + batchSize);
    }
  }

  /**
   * Get summary statistics for the recorded data
   */
  getExportSummary(): {
    totalRecords: number;
    uniqueAgents: number;
    timeRange: { start: number; end: number };
    stepRange: { start: number; end: number };
    averageRecordsPerStep: number;
  } {
    if (this.trajectoryData.length === 0) {
      return {
        totalRecords: 0,
        uniqueAgents: 0,
        timeRange: { start: 0, end: 0 },
        stepRange: { start: 0, end: 0 },
        averageRecordsPerStep: 0
      };
    }

    const uniqueAgents = new Set(this.trajectoryData.map(d => d.agentId));
    const steps = this.trajectoryData.map(d => d.step);
    const timestamps = this.trajectoryData.map(d => d.timestamp);
    
    return {
      totalRecords: this.trajectoryData.length,
      uniqueAgents: uniqueAgents.size,
      timeRange: {
        start: Math.min(...timestamps),
        end: Math.max(...timestamps)
      },
      stepRange: {
        start: Math.min(...steps),
        end: Math.max(...steps)
      },
      averageRecordsPerStep: this.trajectoryData.length / (new Set(steps).size || 1)
    };
  }

  /**
   * Clear recorded trajectory data
   */
  clear(): void {
    this.trajectoryData = [];
  }

  /**
   * Format value for CSV export
   */
  private formatCSVValue(value: PropertyValue): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      // Escape quotes and wrap in quotes if contains comma or newline
      const escaped = value.replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('\n') ? `"${escaped}"` : escaped;
    }
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }
    if (typeof value === 'object') {
      return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
    }
    return String(value);
  }
}

/**
 * Factory function for creating trajectory exporters
 */
export function createTrajectoryExporter(config?: TrajectoryExportConfig): TrajectoryExporter {
  return new TrajectoryExporter(config);
}