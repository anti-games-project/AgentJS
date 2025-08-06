/**
 * Grid2D - 2D grid-based environment implementation
 */

import { Environment, SpatialQueryResult } from './Environment';
import type { Agent } from '../agents/Agent';
import type { Position } from '../../types/core';
import type {
  GridConfig,
  GridCoordinate,
  NeighborQueryOptions,
} from '../../types/spatial';

/**
 * Grid cell containing agents
 */
interface GridCell {
  readonly coordinate: GridCoordinate;
  readonly agents: Set<Agent>;
  readonly maxOccupancy: number;
}

/**
 * Grid2D - Discrete grid-based 2D environment
 *
 * Features:
 * - Discrete cell-based positioning
 * - Moore and Von Neumann neighborhood types
 * - Configurable occupancy limits per cell
 * - Efficient neighbor queries using grid structure
 * - Grid-based pathfinding support
 *
 * Educational Context: Represents structured environments
 * like seating arrangements, organizational charts,
 * board games, or cellular automata simulations.
 */
export class Grid2D extends Environment {
  /** Grid configuration */
  private readonly config: GridConfig;

  /** 2D grid of cells */
  private readonly grid: GridCell[][];

  /** Agent to grid coordinate mapping */
  private readonly agentCoordinates: Map<Agent, GridCoordinate>;

  constructor(configOrRows: GridConfig | number, cols?: number, cellSize?: number) {
    let config: GridConfig;
    
    // Support both config object and simple rows/cols parameters
    if (typeof configOrRows === 'number' && cols !== undefined) {
      const rows = configOrRows;
      const actualCellSize = cellSize || 1;
      config = {
        width: cols * actualCellSize,
        height: rows * actualCellSize,
        boundaryType: 'absorbing' as any,
        rows: rows,
        cols: cols,
        neighborhoodType: 'moore' as any,
        allowMultipleOccupancy: true
      };
    } else {
      config = configOrRows as GridConfig;
    }

    super(config);

    this.config = { ...config };
    this.agentCoordinates = new Map();

    // Initialize grid
    this.grid = this.initializeGrid();

    this.validateConfiguration();
  }

  /**
   * Find neighbors within radius (in grid cells)
   */
  findNeighbors(
    position: Position,
    radius: number,
    options: NeighborQueryOptions = {}
  ): SpatialQueryResult<Agent> {
    const startTime = performance.now();
    const maxResults = options.maxResults ?? Number.MAX_SAFE_INTEGER;

    const gridCoord = this.positionToGrid(position);
    if (!this.isValidCoordinate(gridCoord)) {
      return {
        items: [],
        distances: [],
        queryTime: performance.now() - startTime,
      };
    }

    const neighbors: Agent[] = [];
    const distances: number[] = [];
    const radiusInt = Math.floor(radius);

    // Search in grid neighborhood
    for (let dr = -radiusInt; dr <= radiusInt; dr++) {
      for (let dc = -radiusInt; dc <= radiusInt; dc++) {
        if (neighbors.length >= maxResults) break;

        const neighborCoord: GridCoordinate = {
          row: gridCoord.row + dr,
          col: gridCoord.col + dc,
        };

        if (!this.isValidCoordinate(neighborCoord)) continue;

        const distance = this.gridDistance(gridCoord, neighborCoord);
        if (distance > radius) continue;

        const cell = this.grid[neighborCoord.row]?.[neighborCoord.col];
        if (!cell) continue;

        for (const agent of cell.agents) {
          if (neighbors.length >= maxResults) break;

          // Apply filter if provided
          if (options.filterFn && !options.filterFn(agent)) {
            continue;
          }

          neighbors.push(agent);
          if (options.includeDistance) {
            distances.push(distance);
          }
        }
      }
    }

    // Sort by distance if requested
    if (options.includeDistance && distances.length > 0) {
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
      distances: options.includeDistance ? distances : [],
      queryTime: performance.now() - startTime,
    };
  }

  /**
   * Get agents at specific position
   */
  getAgentsAt(position: Position): ReadonlyArray<Agent> {
    const gridCoord = this.positionToGrid(position);

    if (!this.isValidCoordinate(gridCoord)) {
      return [];
    }

    const cell = this.grid[gridCoord.row]?.[gridCoord.col];
    return cell ? Array.from(cell.agents) : [];
  }

  /**
   * Get agents in specific grid cell
   */
  getAgentsAtCell(coordinate: GridCoordinate): ReadonlyArray<Agent> {
    if (!this.isValidCoordinate(coordinate)) {
      return [];
    }

    const cell = this.grid[coordinate.row]?.[coordinate.col];
    return cell ? Array.from(cell.agents) : [];
  }

  /**
   * Get grid coordinate for agent
   */
  getAgentGridCoordinate(agent: Agent): GridCoordinate | undefined {
    return this.agentCoordinates.get(agent);
  }

  /**
   * Get neighbors of a grid cell
   */
  getCellNeighbors(coordinate: GridCoordinate): ReadonlyArray<GridCoordinate> {
    const neighbors: GridCoordinate[] = [];

    if (this.config.neighborhoodType === 'moore') {
      // Moore neighborhood (8 neighbors)
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue; // Skip center cell

          const neighbor: GridCoordinate = {
            row: coordinate.row + dr,
            col: coordinate.col + dc,
          };

          if (this.isValidCoordinate(neighbor)) {
            neighbors.push(neighbor);
          }
        }
      }
    } else {
      // Von Neumann neighborhood (4 neighbors)
      const offsets = [
        { row: -1, col: 0 }, // North
        { row: 1, col: 0 }, // South
        { row: 0, col: -1 }, // West
        { row: 0, col: 1 }, // East
      ];

      for (const offset of offsets) {
        const neighbor: GridCoordinate = {
          row: coordinate.row + offset.row,
          col: coordinate.col + offset.col,
        };

        if (this.isValidCoordinate(neighbor)) {
          neighbors.push(neighbor);
        }
      }
    }

    return neighbors;
  }

  /**
   * Check if cell can accommodate more agents
   */
  canPlaceAgent(coordinate: GridCoordinate): boolean {
    if (!this.isValidCoordinate(coordinate)) {
      return false;
    }

    const cell = this.grid[coordinate.row]?.[coordinate.col];
    if (!cell) return false;

    if (!this.config.allowMultipleOccupancy) {
      return cell.agents.size === 0;
    }

    return cell.agents.size < cell.maxOccupancy;
  }

  /**
   * Get empty cells in grid
   */
  getEmptyCells(): ReadonlyArray<GridCoordinate> {
    const emptyCells: GridCoordinate[] = [];

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const coordinate: GridCoordinate = { row, col };
        if (this.canPlaceAgent(coordinate)) {
          emptyCells.push(coordinate);
        }
      }
    }

    return emptyCells;
  }

  /**
   * Get grid occupancy statistics
   */
  getOccupancyStats(): {
    totalCells: number;
    occupiedCells: number;
    emptyCells: number;
    averageOccupancy: number;
    maxOccupancy: number;
  } {
    let occupiedCells = 0;
    let totalAgents = 0;
    let maxOccupancy = 0;

    for (let row = 0; row < this.config.rows; row++) {
      for (let col = 0; col < this.config.cols; col++) {
        const cell = this.grid[row]?.[col];
        if (!cell) continue;
        const agentCount = cell.agents.size;

        if (agentCount > 0) {
          occupiedCells++;
          totalAgents += agentCount;
          maxOccupancy = Math.max(maxOccupancy, agentCount);
        }
      }
    }

    const totalCells = this.config.rows * this.config.cols;

    return {
      totalCells,
      occupiedCells,
      emptyCells: totalCells - occupiedCells,
      averageOccupancy: occupiedCells > 0 ? totalAgents / occupiedCells : 0,
      maxOccupancy,
    };
  }

  /**
   * Convert position to grid coordinate
   */
  positionToGrid(position: Position): GridCoordinate {
    const cellWidth = this.dimensions.width / this.config.cols;
    const cellHeight = this.dimensions.height / this.config.rows;

    return {
      row: Math.floor(position.y / cellHeight),
      col: Math.floor(position.x / cellWidth),
    };
  }

  /**
   * Convert grid coordinate to position (center of cell)
   */
  gridToPosition(coordinate: GridCoordinate): Position {
    const cellWidth = this.dimensions.width / this.config.cols;
    const cellHeight = this.dimensions.height / this.config.rows;

    return {
      x: (coordinate.col + 0.5) * cellWidth,
      y: (coordinate.row + 0.5) * cellHeight,
    } as Position;
  }

  /**
   * Calculate distance between grid coordinates
   */
  gridDistance(a: GridCoordinate, b: GridCoordinate): number {
    if (this.config.neighborhoodType === 'moore') {
      // Chebyshev distance (max of differences)
      return Math.max(Math.abs(a.row - b.row), Math.abs(a.col - b.col));
    } else {
      // Manhattan distance
      return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
    }
  }

  /**
   * Get current grid configuration
   */
  getGridConfig(): GridConfig {
    return { ...this.config };
  }

  /**
   * Place agent at specific grid coordinate
   */
  placeAgentAtCell(agent: Agent, coordinate: GridCoordinate): boolean {
    if (!this.canPlaceAgent(coordinate)) {
      return false;
    }

    // Remove from old position if exists
    this.removeAgentFromGrid(agent);

    // Add to new position
    const cell = this.grid[coordinate.row]?.[coordinate.col];
    if (!cell) return false;
    cell.agents.add(agent);
    this.agentCoordinates.set(agent, coordinate);

    // Update agent's position to cell center
    const position = this.gridToPosition(coordinate);
    agent.setPosition(position);

    return true;
  }

  /**
   * Hook: Handle agent addition
   */
  protected override onAgentAdded(agent: Agent, position: Position): void {
    const gridCoord = this.positionToGrid(position);

    if (this.isValidCoordinate(gridCoord) && this.canPlaceAgent(gridCoord)) {
      const cell = this.grid[gridCoord.row]?.[gridCoord.col];
      if (!cell) {
        throw new Error(
          `Invalid grid cell at ${gridCoord.row}, ${gridCoord.col}`
        );
      }
      cell.agents.add(agent);
      this.agentCoordinates.set(agent, gridCoord);

      // Snap position to cell center
      const centerPosition = this.gridToPosition(gridCoord);
      agent.setPosition(centerPosition);
    } else {
      throw new Error(
        `Cannot place agent at position ${position.x}, ${position.y} - cell occupied or invalid`
      );
    }
  }

  /**
   * Hook: Handle agent removal
   */
  protected override onAgentRemoved(agent: Agent): void {
    this.removeAgentFromGrid(agent);
  }

  /**
   * Hook: Handle agent movement
   */
  protected override onAgentMoved(
    agent: Agent,
    _oldPosition: Position,
    newPosition: Position
  ): void {
    const newGridCoord = this.positionToGrid(newPosition);

    if (!this.isValidCoordinate(newGridCoord)) {
      throw new Error(
        `Invalid grid position: ${newGridCoord.row}, ${newGridCoord.col}`
      );
    }

    const oldGridCoord = this.agentCoordinates.get(agent);

    // Only move if changing cells
    if (
      !oldGridCoord ||
      oldGridCoord.row !== newGridCoord.row ||
      oldGridCoord.col !== newGridCoord.col
    ) {
      if (!this.canPlaceAgent(newGridCoord)) {
        throw new Error(
          `Cannot move agent to occupied cell: ${newGridCoord.row}, ${newGridCoord.col}`
        );
      }

      // Remove from old cell
      if (oldGridCoord && this.isValidCoordinate(oldGridCoord)) {
        const oldCell = this.grid[oldGridCoord.row]?.[oldGridCoord.col];
        if (oldCell) {
          oldCell.agents.delete(agent);
        }
      }

      // Add to new cell
      const newCell = this.grid[newGridCoord.row]?.[newGridCoord.col];
      if (!newCell) {
        throw new Error(
          `Invalid grid cell at ${newGridCoord.row}, ${newGridCoord.col}`
        );
      }
      newCell.agents.add(agent);
      this.agentCoordinates.set(agent, newGridCoord);

      // Snap to cell center
      const centerPosition = this.gridToPosition(newGridCoord);
      agent.setPosition(centerPosition);
    }
  }

  /**
   * Initialize grid structure
   */
  private initializeGrid(): GridCell[][] {
    const grid: GridCell[][] = [];

    for (let row = 0; row < this.config.rows; row++) {
      grid[row] = [];

      for (let col = 0; col < this.config.cols; col++) {
        grid[row]![col] = {
          coordinate: { row, col },
          agents: new Set(),
          maxOccupancy: this.config.allowMultipleOccupancy ? 10 : 1, // Default max occupancy
        };
      }
    }

    return grid;
  }

  /**
   * Check if grid coordinate is valid
   */
  private isValidCoordinate(coordinate: GridCoordinate): boolean {
    return (
      coordinate.row >= 0 &&
      coordinate.row < this.config.rows &&
      coordinate.col >= 0 &&
      coordinate.col < this.config.cols
    );
  }

  /**
   * Remove agent from grid
   */
  private removeAgentFromGrid(agent: Agent): void {
    const coordinate = this.agentCoordinates.get(agent);

    if (coordinate && this.isValidCoordinate(coordinate)) {
      const cell = this.grid[coordinate.row]?.[coordinate.col];
      if (cell) {
        cell.agents.delete(agent);
      }
    }

    this.agentCoordinates.delete(agent);
  }

  /**
   * Validate grid configuration
   */
  private validateConfiguration(): void {
    if (this.config.rows <= 0 || this.config.cols <= 0) {
      throw new Error('Grid dimensions must be positive');
    }

    if (
      this.dimensions.width / this.config.cols < 1 ||
      this.dimensions.height / this.config.rows < 1
    ) {
      throw new Error('Grid cells are too small for given dimensions');
    }
  }
}
