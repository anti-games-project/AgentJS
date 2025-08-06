import type { Agent } from '../core/agents/Agent';
import type { NetworkManager } from '../core/network/NetworkManager';
import type { Environment } from '../core/environment/Environment';
import type { AgentManager } from '../core/AgentManager';
import { EventEmitter } from 'eventemitter3';

/**
 * Advanced network metrics
 */
export interface NetworkMetrics {
  clustering: number;
  avgPathLength: number;
  diameter: number;
  density: number;
  components: number;
  largestComponentSize: number;
  degreeDistribution: Map<number, number>;
  centralityScores: Map<string, number>;
  modularity: number;
  assortativity: number;
}

/**
 * Advanced spatial metrics
 */
export interface SpatialMetrics {
  dispersion: number;
  clustering: number;
  nearestNeighborIndex: number;
  ripleyK: number[];
  moranI: number;
  giniCoefficient: number;
  quadratCounts: number[][];
  hotspots: Array<{ x: number; y: number; intensity: number }>;
  convexHullArea: number;
  spatialAutocorrelation: number;
}

/**
 * Time window configuration
 */
export interface TimeWindowConfig {
  windowSize: number; // Number of steps
  overlapSize: number; // Overlap between windows
  updateInterval: number; // Steps between updates
}

/**
 * Enhanced metrics collector with advanced network and spatial analysis
 */
export class EnhancedMetrics extends EventEmitter {
  private timeSeriesBuffer: Map<string, Array<{ step: number; value: number; timestamp: number }>> = new Map();
  private windowConfig: TimeWindowConfig;
  // Removed unused lastUpdateStep property
  private circularBuffers: Map<string, number[]> = new Map();
  private bufferSize: number;

  constructor(windowConfig: TimeWindowConfig = { windowSize: 100, overlapSize: 50, updateInterval: 10 }, bufferSize: number = 10000) {
    super();
    this.windowConfig = windowConfig;
    this.bufferSize = bufferSize;
  }

  /**
   * Calculate comprehensive network metrics
   */
  calculateNetworkMetrics(networkManager: NetworkManager, agentManager: AgentManager): NetworkMetrics {
    const agents = agentManager.getAllAgents();
    // Removed unused agentIds variable
    
    // Build adjacency list
    const adjacencyList = new Map<string, Set<string>>();
    for (const agent of agents) {
      const connections = networkManager.getConnections(agent.id);
      adjacencyList.set(agent.id, new Set(connections.map(conn => conn.target)));
    }

    // Calculate degree distribution
    const degreeDistribution = new Map<number, number>();
    const degrees = new Map<string, number>();
    
    for (const [agentId, neighbors] of adjacencyList) {
      const degree = neighbors.size;
      degrees.set(agentId, degree);
      degreeDistribution.set(degree, (degreeDistribution.get(degree) || 0) + 1);
    }

    // Calculate clustering coefficient
    const clustering = this.calculateClusteringCoefficient(adjacencyList);
    
    // Calculate density
    const n = agents.length;
    const totalEdges = Array.from(adjacencyList.values()).reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
    const density = n > 1 ? (2 * totalEdges) / (n * (n - 1)) : 0;

    // Find connected components
    const components = this.findConnectedComponents(adjacencyList);
    const largestComponentSize = Math.max(...components.map(c => c.size), 0);

    // Calculate centrality scores (betweenness centrality)
    const centralityScores = this.calculateBetweennessCentrality(adjacencyList);

    // Calculate average path length and diameter
    const { avgPathLength, diameter } = this.calculatePathMetrics(adjacencyList);

    // Calculate modularity (simplified)
    const modularity = this.calculateModularity(adjacencyList, components);

    // Calculate assortativity (degree correlation)
    const assortativity = this.calculateAssortativity(adjacencyList, degrees);

    return {
      clustering,
      avgPathLength,
      diameter,
      density,
      components: components.length,
      largestComponentSize,
      degreeDistribution,
      centralityScores,
      modularity,
      assortativity
    };
  }

  /**
   * Calculate comprehensive spatial metrics
   */
  calculateSpatialMetrics(agents: Agent[], environment: Environment): SpatialMetrics {
    const positions = agents.map(agent => {
      if ('position' in agent) {
        const pos = (agent as any).position;
        return { x: pos.x, y: pos.y };
      }
      return { x: 0, y: 0 };
    });

    if (positions.length === 0) {
      return this.getEmptySpatialMetrics();
    }

    // Calculate basic spatial statistics
    const dispersion = this.calculateDispersion(positions);
    const clustering = this.calculateSpatialClustering(positions);
    
    // Nearest neighbor analysis
    const nearestNeighborIndex = this.calculateNearestNeighborIndex(positions, environment);
    
    // Ripley's K function
    const ripleyK = this.calculateRipleyK(positions, environment);
    
    // Moran's I (spatial autocorrelation)
    const moranI = this.calculateMoranI(positions, agents);
    
    // Gini coefficient for spatial inequality
    const giniCoefficient = this.calculateSpatialGini(positions, environment);
    
    // Quadrat analysis
    const quadratCounts = this.calculateQuadratCounts(positions, environment, 10);
    
    // Hotspot detection
    const hotspots = this.detectHotspots(positions, environment);
    
    // Convex hull area
    const convexHullArea = this.calculateConvexHullArea(positions);
    
    // Spatial autocorrelation
    const spatialAutocorrelation = this.calculateSpatialAutocorrelation(positions, agents);

    return {
      dispersion,
      clustering,
      nearestNeighborIndex,
      ripleyK,
      moranI,
      giniCoefficient,
      quadratCounts,
      hotspots,
      convexHullArea,
      spatialAutocorrelation
    };
  }

  /**
   * Add time-series data point with circular buffer management
   */
  addTimeSeriesPoint(metric: string, value: number, step: number): void {
    if (!this.circularBuffers.has(metric)) {
      this.circularBuffers.set(metric, []);
    }
    
    const buffer = this.circularBuffers.get(metric)!;
    buffer.push(value);
    
    // Maintain circular buffer size
    if (buffer.length > this.bufferSize) {
      buffer.shift();
    }

    // Also maintain windowed buffer for analysis
    if (!this.timeSeriesBuffer.has(metric)) {
      this.timeSeriesBuffer.set(metric, []);
    }
    
    const series = this.timeSeriesBuffer.get(metric)!;
    series.push({ step, value, timestamp: Date.now() });
    
    // Clean old data outside window
    const minStep = step - this.windowConfig.windowSize;
    const cleanIndex = series.findIndex(point => point.step >= minStep);
    if (cleanIndex > 0) {
      series.splice(0, cleanIndex);
    }

    this.emit('metric:added', { metric, value, step });
  }

  /**
   * Get moving statistics for a metric
   */
  getMovingStatistics(metric: string, windowSize?: number): {
    mean: number;
    std: number;
    min: number;
    max: number;
    trend: number;
  } | null {
    const buffer = this.circularBuffers.get(metric);
    if (!buffer || buffer.length === 0) return null;

    const window = windowSize || this.windowConfig.windowSize;
    const data = buffer.slice(-window);
    
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    const std = Math.sqrt(variance);
    const min = Math.min(...data);
    const max = Math.max(...data);
    
    // Simple linear trend
    const trend = this.calculateTrend(data);

    return { mean, std, min, max, trend };
  }

  /**
   * Calculate network clustering coefficient
   */
  private calculateClusteringCoefficient(adjacencyList: Map<string, Set<string>>): number {
    let totalClustering = 0;
    let validNodes = 0;

    for (const [, neighbors] of adjacencyList) {
      const k = neighbors.size;
      if (k < 2) continue;

      let triangles = 0;
      const neighborArray = Array.from(neighbors);
      
      for (let i = 0; i < neighborArray.length; i++) {
        for (let j = i + 1; j < neighborArray.length; j++) {
          const neighbor1 = neighborArray[i];
          const neighbor2 = neighborArray[j];
          if (neighbor1 && neighbor2 && adjacencyList.get(neighbor1)?.has(neighbor2)) {
            triangles++;
          }
        }
      }

      const possibleTriangles = (k * (k - 1)) / 2;
      totalClustering += triangles / possibleTriangles;
      validNodes++;
    }

    return validNodes > 0 ? totalClustering / validNodes : 0;
  }

  /**
   * Find connected components using DFS
   */
  private findConnectedComponents(adjacencyList: Map<string, Set<string>>): Set<string>[] {
    const visited = new Set<string>();
    const components: Set<string>[] = [];

    for (const node of adjacencyList.keys()) {
      if (!visited.has(node)) {
        const component = new Set<string>();
        this.dfs(node, adjacencyList, visited, component);
        components.push(component);
      }
    }

    return components;
  }

  /**
   * Depth-first search helper
   */
  private dfs(node: string, adjacencyList: Map<string, Set<string>>, visited: Set<string>, component: Set<string>): void {
    visited.add(node);
    component.add(node);
    
    const neighbors = adjacencyList.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        this.dfs(neighbor, adjacencyList, visited, component);
      }
    }
  }

  /**
   * Calculate betweenness centrality
   */
  private calculateBetweennessCentrality(adjacencyList: Map<string, Set<string>>): Map<string, number> {
    const centrality = new Map<string, number>();
    const nodes = Array.from(adjacencyList.keys());
    
    // Initialize all centralities to 0
    for (const node of nodes) {
      centrality.set(node, 0);
    }

    // Simplified betweenness calculation
    for (const source of nodes) {
      const distances = this.bfs(source, adjacencyList);
      
      for (const [node, distance] of distances) {
        if (distance > 0 && distance < Infinity) {
          centrality.set(node, (centrality.get(node) || 0) + 1 / distance);
        }
      }
    }

    // Normalize
    const n = nodes.length;
    const normFactor = n > 2 ? 1 / ((n - 1) * (n - 2)) : 1;
    for (const [node, value] of centrality) {
      centrality.set(node, value * normFactor);
    }

    return centrality;
  }

  /**
   * Breadth-first search for distances
   */
  private bfs(source: string, adjacencyList: Map<string, Set<string>>): Map<string, number> {
    const distances = new Map<string, number>();
    const queue: string[] = [source];
    distances.set(source, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentDist = distances.get(current)!;
      
      const neighbors = adjacencyList.get(current) || new Set();
      for (const neighbor of neighbors) {
        if (!distances.has(neighbor)) {
          distances.set(neighbor, currentDist + 1);
          queue.push(neighbor);
        }
      }
    }

    return distances;
  }

  /**
   * Calculate path metrics
   */
  private calculatePathMetrics(adjacencyList: Map<string, Set<string>>): { avgPathLength: number; diameter: number } {
    const nodes = Array.from(adjacencyList.keys());
    let totalDistance = 0;
    let pathCount = 0;
    let diameter = 0;

    for (const source of nodes) {
      const distances = this.bfs(source, adjacencyList);
      
      for (const [target, distance] of distances) {
        if (source !== target && distance < Infinity) {
          totalDistance += distance;
          pathCount++;
          diameter = Math.max(diameter, distance);
        }
      }
    }

    const avgPathLength = pathCount > 0 ? totalDistance / pathCount : 0;
    return { avgPathLength, diameter };
  }

  /**
   * Calculate modularity (simplified)
   */
  private calculateModularity(adjacencyList: Map<string, Set<string>>, components: Set<string>[]): number {
    const totalEdges = Array.from(adjacencyList.values()).reduce((sum, neighbors) => sum + neighbors.size, 0) / 2;
    if (totalEdges === 0) return 0;

    let modularity = 0;
    
    for (const component of components) {
      let internalEdges = 0;
      let totalDegree = 0;
      
      for (const node of component) {
        const neighbors = adjacencyList.get(node) || new Set();
        totalDegree += neighbors.size;
        
        for (const neighbor of neighbors) {
          if (component.has(neighbor)) {
            internalEdges++;
          }
        }
      }
      
      internalEdges /= 2; // Each edge counted twice
      const expected = (totalDegree * totalDegree) / (4 * totalEdges);
      modularity += (internalEdges / totalEdges) - expected / totalEdges;
    }

    return modularity;
  }

  /**
   * Calculate assortativity coefficient
   */
  private calculateAssortativity(adjacencyList: Map<string, Set<string>>, degrees: Map<string, number>): number {
    let sum1 = 0, sum2 = 0, sum3 = 0;
    let edgeCount = 0;

    for (const [node, neighbors] of adjacencyList) {
      const deg1 = degrees.get(node) || 0;
      
      for (const neighbor of neighbors) {
        const deg2 = degrees.get(neighbor) || 0;
        sum1 += deg1 * deg2;
        sum2 += deg1 + deg2;
        sum3 += deg1 * deg1 + deg2 * deg2;
        edgeCount++;
      }
    }

    if (edgeCount === 0) return 0;

    const avgDegree = sum2 / (2 * edgeCount);
    const numerator = (sum1 / edgeCount) - avgDegree * avgDegree;
    const denominator = (sum3 / (2 * edgeCount)) - avgDegree * avgDegree;

    return denominator !== 0 ? numerator / denominator : 0;
  }

  /**
   * Calculate spatial dispersion
   */
  private calculateDispersion(positions: Array<{ x: number; y: number }>): number {
    if (positions.length === 0) return 0;

    const centerX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
    const centerY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;

    const avgDistance = positions.reduce((sum, p) => {
      const dx = p.x - centerX;
      const dy = p.y - centerY;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / positions.length;

    return avgDistance;
  }

  /**
   * Calculate spatial clustering using nearest neighbor distances
   */
  private calculateSpatialClustering(positions: Array<{ x: number; y: number }>): number {
    if (positions.length < 2) return 0;

    const nearestDistances: number[] = [];
    
    for (let i = 0; i < positions.length; i++) {
      let minDist = Infinity;
      
      for (let j = 0; j < positions.length; j++) {
        if (i !== j && positions[i] && positions[j]) {
          const dx = positions[i]!.x - positions[j]!.x;
          const dy = positions[i]!.y - positions[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }
      }
      
      if (minDist < Infinity) {
        nearestDistances.push(minDist);
      }
    }

    const avgNearestDist = nearestDistances.reduce((a, b) => a + b, 0) / nearestDistances.length;
    const variance = nearestDistances.reduce((sum, d) => sum + Math.pow(d - avgNearestDist, 2), 0) / nearestDistances.length;
    
    return Math.sqrt(variance) / avgNearestDist; // Coefficient of variation
  }

  /**
   * Calculate nearest neighbor index
   */
  private calculateNearestNeighborIndex(positions: Array<{ x: number; y: number }>, environment: Environment): number {
    if (positions.length < 2) return 0;

    const observedMeanDistance = this.calculateMeanNearestNeighborDistance(positions);
    const area = environment.getDimensions().width * environment.getDimensions().height;
    const density = positions.length / area;
    const expectedMeanDistance = 1 / (2 * Math.sqrt(density));

    return observedMeanDistance / expectedMeanDistance;
  }

  /**
   * Calculate mean nearest neighbor distance
   */
  private calculateMeanNearestNeighborDistance(positions: Array<{ x: number; y: number }>): number {
    if (positions.length < 2) return 0;

    let totalDistance = 0;
    
    for (let i = 0; i < positions.length; i++) {
      let minDist = Infinity;
      
      for (let j = 0; j < positions.length; j++) {
        if (i !== j && positions[i] && positions[j]) {
          const dx = positions[i]!.x - positions[j]!.x;
          const dy = positions[i]!.y - positions[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          minDist = Math.min(minDist, dist);
        }
      }
      
      if (minDist < Infinity) {
        totalDistance += minDist;
      }
    }

    return totalDistance / positions.length;
  }

  /**
   * Calculate Ripley's K function
   */
  private calculateRipleyK(positions: Array<{ x: number; y: number }>, environment: Environment): number[] {
    const radii = [10, 20, 30, 40, 50];
    const area = environment.getDimensions().width * environment.getDimensions().height;
    const n = positions.length;
    // Removed unused density variable
    
    return radii.map(r => {
      let count = 0;
      
      for (let i = 0; i < positions.length; i++) {
        for (let j = 0; j < positions.length; j++) {
          if (i !== j && positions[i] && positions[j]) {
            const dx = positions[i]!.x - positions[j]!.x;
            const dy = positions[i]!.y - positions[j]!.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= r) count++;
          }
        }
      }
      
      const K = (area * count) / (n * n);
      const L = Math.sqrt(K / Math.PI) - r; // L-function transformation
      return L;
    });
  }

  /**
   * Calculate Moran's I for spatial autocorrelation
   */
  private calculateMoranI(positions: Array<{ x: number; y: number }>, agents: Agent[]): number {
    if (positions.length < 2) return 0;

    // Use autonomy as the variable of interest
    const values = agents.map(agent => (agent.getProperty('autonomy') as number) || 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;
    let weightSum = 0;

    for (let i = 0; i < positions.length; i++) {
      for (let j = 0; j < positions.length; j++) {
        if (i !== j && positions[i] && positions[j] && values[i] !== undefined && values[j] !== undefined) {
          const dx = positions[i]!.x - positions[j]!.x;
          const dy = positions[i]!.y - positions[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const weight = dist > 0 ? 1 / dist : 0; // Inverse distance weighting
          
          numerator += weight * (values[i]! - mean) * (values[j]! - mean);
          weightSum += weight;
        }
      }
      
      if (values[i] !== undefined) {
        denominator += Math.pow(values[i]! - mean, 2);
      }
    }

    return (positions.length / weightSum) * (numerator / denominator);
  }

  /**
   * Calculate spatial Gini coefficient
   */
  private calculateSpatialGini(positions: Array<{ x: number; y: number }>, environment: Environment): number {
    const gridSize = 10;
    const dims = environment.getDimensions();
    const cellWidth = dims.width / gridSize;
    const cellHeight = dims.height / gridSize;
    
    const counts = Array(gridSize * gridSize).fill(0);
    
    for (const pos of positions) {
      const gridX = Math.floor(pos.x / cellWidth);
      const gridY = Math.floor(pos.y / cellHeight);
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize) {
        counts[gridY * gridSize + gridX]++;
      }
    }
    
    // Calculate Gini coefficient
    counts.sort((a, b) => a - b);
    const n = counts.length;
    let sum = 0;
    
    for (let i = 0; i < n; i++) {
      sum += (2 * (i + 1) - n - 1) * counts[i];
    }
    
    const totalCount = counts.reduce((a, b) => a + b, 0);
    return totalCount > 0 ? sum / (n * totalCount) : 0;
  }

  /**
   * Calculate quadrat counts
   */
  private calculateQuadratCounts(positions: Array<{ x: number; y: number }>, environment: Environment, gridSize: number): number[][] {
    const dims = environment.getDimensions();
    const cellWidth = dims.width / gridSize;
    const cellHeight = dims.height / gridSize;
    
    const counts: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    
    for (const pos of positions) {
      const gridX = Math.floor(pos.x / cellWidth);
      const gridY = Math.floor(pos.y / cellHeight);
      if (gridX >= 0 && gridX < gridSize && gridY >= 0 && gridY < gridSize && counts[gridY]) {
        counts[gridY]![gridX]++;
      }
    }
    
    return counts;
  }

  /**
   * Detect spatial hotspots
   */
  private detectHotspots(positions: Array<{ x: number; y: number }>, environment: Environment): Array<{ x: number; y: number; intensity: number }> {
    const kernelSize = 30;
    const gridSize = 20;
    const dims = environment.getDimensions();
    const cellWidth = dims.width / gridSize;
    const cellHeight = dims.height / gridSize;
    
    const densityGrid: number[][] = Array(gridSize).fill(0).map(() => Array(gridSize).fill(0));
    
    // Calculate kernel density estimation
    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const cellX = (gx + 0.5) * cellWidth;
        const cellY = (gy + 0.5) * cellHeight;
        let density = 0;
        
        for (const pos of positions) {
          const dx = pos.x - cellX;
          const dy = pos.y - cellY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < kernelSize) {
            // Gaussian kernel
            density += Math.exp(-(dist * dist) / (2 * kernelSize * kernelSize));
          }
        }
        
        if (densityGrid[gy]) {
          densityGrid[gy]![gx] = density;
        }
      }
    }
    
    // Find local maxima as hotspots
    const hotspots: Array<{ x: number; y: number; intensity: number }> = [];
    
    for (let gy = 1; gy < gridSize - 1; gy++) {
      for (let gx = 1; gx < gridSize - 1; gx++) {
        const value = densityGrid[gy]?.[gx] ?? 0;
        let isMaxima = true;
        
        // Check 8-neighborhood
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx !== 0 || dy !== 0) {
              const neighborValue = densityGrid[gy + dy]?.[gx + dx] ?? 0;
              if (neighborValue >= value) {
                isMaxima = false;
                break;
              }
            }
          }
          if (!isMaxima) break;
        }
        
        if (isMaxima && value > 0.5) { // Threshold for significance
          hotspots.push({
            x: (gx + 0.5) * cellWidth,
            y: (gy + 0.5) * cellHeight,
            intensity: value
          });
        }
      }
    }
    
    return hotspots.sort((a, b) => b.intensity - a.intensity).slice(0, 5); // Top 5 hotspots
  }

  /**
   * Calculate convex hull area
   */
  private calculateConvexHullArea(positions: Array<{ x: number; y: number }>): number {
    if (positions.length < 3) return 0;
    
    // Graham scan algorithm
    const hull = this.convexHull(positions);
    
    // Calculate area using shoelace formula
    let area = 0;
    for (let i = 0; i < hull.length; i++) {
      const j = (i + 1) % hull.length;
      const pointI = hull[i];
      const pointJ = hull[j];
      if (pointI && pointJ) {
        area += pointI.x * pointJ.y - pointJ.x * pointI.y;
      }
    }
    
    return Math.abs(area) / 2;
  }

  /**
   * Convex hull using Graham scan
   */
  private convexHull(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    // Sort points lexicographically
    const sorted = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
    
    // Build lower hull
    const lower: Array<{ x: number; y: number }> = [];
    for (const p of sorted) {
      while (lower.length >= 2) {
        const p1 = lower[lower.length - 2];
        const p2 = lower[lower.length - 1];
        if (p1 && p2 && this.cross(p1, p2, p) <= 0) {
          lower.pop();
        } else {
          break;
        }
      }
      lower.push(p);
    }
    
    // Build upper hull
    const upper: Array<{ x: number; y: number }> = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      const p = sorted[i];
      if (!p) continue;
      
      while (upper.length >= 2) {
        const p1 = upper[upper.length - 2];
        const p2 = upper[upper.length - 1];
        if (p1 && p2 && this.cross(p1, p2, p) <= 0) {
          upper.pop();
        } else {
          break;
        }
      }
      upper.push(p);
    }
    
    // Remove last point of each half because it's repeated
    lower.pop();
    upper.pop();
    
    return lower.concat(upper);
  }

  /**
   * Cross product for convex hull
   */
  private cross(o: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
    return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  }

  /**
   * Calculate spatial autocorrelation
   */
  private calculateSpatialAutocorrelation(positions: Array<{ x: number; y: number }>, agents: Agent[]): number {
    // Similar to Moran's I but for multiple variables
    if (positions.length < 2) return 0;
    
    const properties = ['autonomy', 'resources', 'energy'];
    let totalCorrelation = 0;
    
    for (const prop of properties) {
      const values = agents.map(agent => (agent.getProperty(prop) as number) || 0);
      const moranI = this.calculatePropertyMoranI(positions, values);
      totalCorrelation += Math.abs(moranI);
    }
    
    return totalCorrelation / properties.length;
  }

  /**
   * Calculate Moran's I for a specific property
   */
  private calculatePropertyMoranI(positions: Array<{ x: number; y: number }>, values: number[]): number {
    const n = positions.length;
    if (n < 2) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / n;
    let numerator = 0;
    let denominator = 0;
    let weightSum = 0;
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (positions[i] && positions[j] && values[i] !== undefined && values[j] !== undefined) {
          const dx = positions[i]!.x - positions[j]!.x;
          const dy = positions[i]!.y - positions[j]!.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const weight = dist > 0 ? 1 / dist : 0;
          
          numerator += weight * (values[i]! - mean) * (values[j]! - mean);
          weightSum += weight;
        }
      }
      
      if (values[i] !== undefined) {
        denominator += Math.pow(values[i]! - mean, 2);
      }
    }
    
    return denominator > 0 ? (n / weightSum) * (numerator / denominator) : 0;
  }

  /**
   * Calculate trend from time series data
   */
  private calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    
    const n = data.length;
    
    const meanX = (n - 1) / 2;
    const meanY = data.reduce((a, b) => a + b, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - meanX) * ((data[i] ?? 0) - meanY);
      denominator += Math.pow(i - meanX, 2);
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Get empty spatial metrics
   */
  private getEmptySpatialMetrics(): SpatialMetrics {
    return {
      dispersion: 0,
      clustering: 0,
      nearestNeighborIndex: 0,
      ripleyK: [],
      moranI: 0,
      giniCoefficient: 0,
      quadratCounts: [],
      hotspots: [],
      convexHullArea: 0,
      spatialAutocorrelation: 0
    };
  }
}

/**
 * Factory function for creating enhanced metrics collector
 */
export function createEnhancedMetrics(windowConfig?: TimeWindowConfig, bufferSize?: number): EnhancedMetrics {
  return new EnhancedMetrics(windowConfig, bufferSize);
}