import type { Agent } from '../core/agents/Agent';
import type { Camera } from '../visualization/Camera';

/**
 * Viewport bounds for culling calculations
 */
export interface ViewportBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Culling result information
 */
export interface CullingResult {
  visibleAgents: Agent[];
  culledAgents: Agent[];
  totalAgents: number;
  visibleCount: number;
  culledCount: number;
  cullRatio: number;
}

/**
 * Level of detail settings
 */
export interface LODSettings {
  enabled: boolean;
  nearDistance: number;
  midDistance: number;
  farDistance: number;
  nearDetail: 'full' | 'medium' | 'low';
  midDetail: 'full' | 'medium' | 'low';
  farDetail: 'full' | 'medium' | 'low';
}

/**
 * Spatial indexing for efficient culling
 */
class SpatialGrid {
  private cellSize: number;
  private grid: Map<string, Set<Agent>> = new Map();
  private agentCells: Map<string, string[]> = new Map();

  constructor(cellSize: number = 50) {
    this.cellSize = cellSize;
  }

  /**
   * Clear the grid
   */
  clear(): void {
    this.grid.clear();
    this.agentCells.clear();
  }

  /**
   * Add agent to grid
   */
  addAgent(agent: Agent): void {
    const position = this.getAgentPosition(agent);
    if (!position) return;

    const cells = this.getCellsForAgent(position.x, position.y);
    this.agentCells.set(agent.id, cells);

    for (const cellKey of cells) {
      if (!this.grid.has(cellKey)) {
        this.grid.set(cellKey, new Set());
      }
      this.grid.get(cellKey)!.add(agent);
    }
  }

  /**
   * Remove agent from grid
   */
  removeAgent(agent: Agent): void {
    const cells = this.agentCells.get(agent.id);
    if (!cells) return;

    for (const cellKey of cells) {
      const cell = this.grid.get(cellKey);
      if (cell) {
        cell.delete(agent);
        if (cell.size === 0) {
          this.grid.delete(cellKey);
        }
      }
    }

    this.agentCells.delete(agent.id);
  }

  /**
   * Get agents in viewport bounds
   */
  getAgentsInBounds(bounds: ViewportBounds): Set<Agent> {
    const result = new Set<Agent>();
    
    const minCellX = Math.floor(bounds.left / this.cellSize);
    const maxCellX = Math.floor(bounds.right / this.cellSize);
    const minCellY = Math.floor(bounds.top / this.cellSize);
    const maxCellY = Math.floor(bounds.bottom / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let y = minCellY; y <= maxCellY; y++) {
        const cellKey = `${x},${y}`;
        const cell = this.grid.get(cellKey);
        if (cell) {
          for (const agent of cell) {
            result.add(agent);
          }
        }
      }
    }

    return result;
  }

  /**
   * Update agent position in grid
   */
  updateAgent(agent: Agent): void {
    this.removeAgent(agent);
    this.addAgent(agent);
  }

  /**
   * Get agent position
   */
  private getAgentPosition(agent: Agent): { x: number; y: number } | null {
    if ('position' in agent) {
      const pos = (agent as any).position;
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        return { x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  /**
   * Get cells that contain an agent at given position
   */
  private getCellsForAgent(x: number, y: number): string[] {
    // Agent might span multiple cells if it has size
    const cellX = Math.floor(x / this.cellSize);
    const cellY = Math.floor(y / this.cellSize);
    return [`${cellX},${cellY}`];
  }
}

/**
 * Viewport culling system for performance optimization
 */
export class ViewportCuller {
  private spatialGrid: SpatialGrid;
  private lodSettings: LODSettings;
  private lastCullingResult: CullingResult | null = null;
  private performanceStats = {
    cullTime: 0,
    updateTime: 0,
    totalCulls: 0,
    averageCullTime: 0
  };

  constructor(cellSize: number = 50, lodSettings?: Partial<LODSettings>) {
    this.spatialGrid = new SpatialGrid(cellSize);
    this.lodSettings = {
      enabled: lodSettings?.enabled ?? true,
      nearDistance: lodSettings?.nearDistance ?? 100,
      midDistance: lodSettings?.midDistance ?? 300,
      farDistance: lodSettings?.farDistance ?? 600,
      nearDetail: lodSettings?.nearDetail ?? 'full',
      midDetail: lodSettings?.midDetail ?? 'medium',
      farDetail: lodSettings?.farDetail ?? 'low'
    };
  }

  /**
   * Update spatial index with current agents
   */
  updateSpatialIndex(agents: Agent[]): void {
    const startTime = performance.now();
    
    this.spatialGrid.clear();
    
    for (const agent of agents) {
      this.spatialGrid.addAgent(agent);
    }
    
    const endTime = performance.now();
    this.performanceStats.updateTime = endTime - startTime;
  }

  /**
   * Perform viewport culling
   */
  cullAgents(agents: Agent[], camera: Camera): CullingResult {
    const startTime = performance.now();
    
    // Get viewport bounds in world coordinates
    const bounds = this.getViewportBounds(camera);
    
    // Use spatial grid for initial culling
    const candidateAgents = this.spatialGrid.getAgentsInBounds(bounds);
    
    // Fine-grained culling and LOD calculation
    const visibleAgents: Agent[] = [];
    const culledAgents: Agent[] = [];
    
    for (const agent of agents) {
      if (candidateAgents.has(agent)) {
        const position = this.getAgentPosition(agent);
        if (position && this.isInViewport(position, bounds)) {
          // Apply LOD if enabled
          if (this.lodSettings.enabled) {
            const distance = this.getDistanceToCamera(position, camera);
            const lodLevel = this.getLODLevel(distance);
            (agent as any)._lodLevel = lodLevel;
          }
          visibleAgents.push(agent);
        } else {
          culledAgents.push(agent);
        }
      } else {
        culledAgents.push(agent);
      }
    }
    
    const endTime = performance.now();
    const cullTime = endTime - startTime;
    
    // Update performance stats
    this.performanceStats.cullTime = cullTime;
    this.performanceStats.totalCulls++;
    this.performanceStats.averageCullTime = 
      (this.performanceStats.averageCullTime * (this.performanceStats.totalCulls - 1) + cullTime) / 
      this.performanceStats.totalCulls;
    
    const result: CullingResult = {
      visibleAgents,
      culledAgents,
      totalAgents: agents.length,
      visibleCount: visibleAgents.length,
      culledCount: culledAgents.length,
      cullRatio: agents.length > 0 ? culledAgents.length / agents.length : 0
    };
    
    this.lastCullingResult = result;
    return result;
  }

  /**
   * Get viewport bounds in world coordinates
   */
  private getViewportBounds(camera: Camera): ViewportBounds {
    const position = camera.getPosition();
    const zoom = camera.getZoom();
    const width = camera.getViewportWidth() / zoom;
    const height = camera.getViewportHeight() / zoom;
    
    // Add margin for smooth transitions
    const margin = Math.max(width, height) * 0.1;
    
    return {
      left: position.x - width / 2 - margin,
      right: position.x + width / 2 + margin,
      top: position.y - height / 2 - margin,
      bottom: position.y + height / 2 + margin,
      width: width + 2 * margin,
      height: height + 2 * margin
    };
  }

  /**
   * Check if position is within viewport bounds
   */
  private isInViewport(position: { x: number; y: number }, bounds: ViewportBounds): boolean {
    return position.x >= bounds.left &&
           position.x <= bounds.right &&
           position.y >= bounds.top &&
           position.y <= bounds.bottom;
  }

  /**
   * Get agent position
   */
  private getAgentPosition(agent: Agent): { x: number; y: number } | null {
    if ('position' in agent) {
      const pos = (agent as any).position;
      if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
        return { x: pos.x, y: pos.y };
      }
    }
    return null;
  }

  /**
   * Calculate distance from position to camera
   */
  private getDistanceToCamera(position: { x: number; y: number }, camera: Camera): number {
    const cameraPos = camera.getPosition();
    const dx = position.x - cameraPos.x;
    const dy = position.y - cameraPos.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Get LOD level based on distance
   */
  private getLODLevel(distance: number): 'full' | 'medium' | 'low' {
    if (distance <= this.lodSettings.nearDistance) {
      return this.lodSettings.nearDetail;
    } else if (distance <= this.lodSettings.midDistance) {
      return this.lodSettings.midDetail;
    } else {
      return this.lodSettings.farDetail;
    }
  }

  /**
   * Update LOD settings
   */
  updateLODSettings(settings: Partial<LODSettings>): void {
    this.lodSettings = { ...this.lodSettings, ...settings };
  }

  /**
   * Get LOD settings
   */
  getLODSettings(): Readonly<LODSettings> {
    return { ...this.lodSettings };
  }

  /**
   * Get last culling result
   */
  getLastCullingResult(): CullingResult | null {
    return this.lastCullingResult;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): Readonly<typeof this.performanceStats> {
    return { ...this.performanceStats };
  }

  /**
   * Check if an agent should be rendered based on LOD
   */
  shouldRenderAgent(agent: Agent, renderLevel: 'full' | 'medium' | 'low' = 'full'): boolean {
    if (!this.lodSettings.enabled) {
      return true;
    }

    const agentLOD = (agent as any)._lodLevel as 'full' | 'medium' | 'low' | undefined;
    if (!agentLOD) {
      return true; // Render if no LOD information
    }

    // Define rendering priorities
    const lodPriority = { full: 3, medium: 2, low: 1 };
    const renderPriority = lodPriority[renderLevel];
    const agentPriority = lodPriority[agentLOD];

    return agentPriority >= renderPriority;
  }

  /**
   * Get visible agents by LOD level
   */
  getVisibleAgentsByLOD(lodLevel: 'full' | 'medium' | 'low'): Agent[] {
    if (!this.lastCullingResult) {
      return [];
    }

    return this.lastCullingResult.visibleAgents.filter(agent => {
      const agentLOD = (agent as any)._lodLevel as 'full' | 'medium' | 'low' | undefined;
      return agentLOD === lodLevel;
    });
  }

  /**
   * Reset performance statistics
   */
  resetPerformanceStats(): void {
    this.performanceStats = {
      cullTime: 0,
      updateTime: 0,
      totalCulls: 0,
      averageCullTime: 0
    };
  }
}

/**
 * Factory function for creating viewport cullers
 */
export function createViewportCuller(
  cellSize?: number,
  lodSettings?: Partial<LODSettings>
): ViewportCuller {
  return new ViewportCuller(cellSize, lodSettings);
}