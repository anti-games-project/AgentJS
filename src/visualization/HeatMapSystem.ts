/**
 * HeatMapSystem - Agent density and property value heat maps
 *
 * Features:
 * - Agent density heat maps
 * - Property value heat maps (autonomy, resources, etc.)
 * - Dynamic heat map updates
 * - Customizable color schemes
 * - Performance-optimized rendering
 * - Multiple heat map layers
 */

/// <reference path="../types/p5-global.d.ts" />
import type { Agent } from '../core/agents/Agent';
import type { AgentId, Position } from '../types/core';

/** Heat map configuration */
export interface HeatMapConfig {
  cellSize: number;
  smoothing: number;
  intensity: number;
  radius: number;
  colorScheme: ColorScheme;
  updateInterval: number;
  maxValue: number;
  minValue: number;
  threshold: number;
  blur: boolean;
  blurRadius: number;
}

/** Color scheme for heat maps */
export type ColorScheme =
  | 'thermal'
  | 'viridis'
  | 'plasma'
  | 'cool'
  | 'warm'
  | 'custom';

/** Heat map layer types */
export type HeatMapLayer =
  | 'density'
  | 'autonomy'
  | 'resources'
  | 'energy'
  | 'custom';

/** Heat map cell data */
interface HeatMapCell {
  value: number;
  density: number;
  propertySum: number;
  agentCount: number;
  lastUpdate: number;
}

/** Heat map data structure */
interface HeatMapData {
  width: number;
  height: number;
  cellSize: number;
  cells: HeatMapCell[][];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
  lastUpdate: number;
}

/** Color gradient point */
interface ColorStop {
  position: number; // 0-1
  color: Color;
}

/**
 * HeatMapSystem - Advanced heat map visualization
 *
 * Educational Context: Visualizes spatial patterns in agent
 * populations and behaviors, revealing clustering, movement
 * patterns, and resource distribution dynamics.
 */
export class HeatMapSystem {
  /** Heat map configurations for different layers */
  private configs: Map<HeatMapLayer, HeatMapConfig> = new Map();

  /** Heat map data for different layers */
  private heatMaps: Map<HeatMapLayer, HeatMapData> = new Map();

  /** Active layers to render */
  private activeLayers: Set<HeatMapLayer> = new Set();

  /** Color gradients for different schemes */
  private colorGradients: Map<ColorScheme, ColorStop[]> = new Map();

  /** p5 instance for rendering */
  private p5Instance: p5Instance | null = null;

  /** Graphics buffer for performance */
  private graphicsBuffer: p5Graphics | null = null;

  /** Current timestamp */
  private currentTime: number = 0;

  /** Performance statistics */
  private readonly stats = {
    totalCells: 0,
    activeCells: 0,
    updateTime: 0,
    renderTime: 0,
    lastUpdate: 0,
  };

  /** Default bounds for heat maps */
  private defaultBounds = {
    minX: -400,
    maxX: 400,
    minY: -300,
    maxY: 300,
  };

  constructor() {
    this.initializeDefaultConfigs();
  }

  /**
   * Initialize default configurations
   */
  private initializeDefaultConfigs(): void {
    // Density heat map
    this.configs.set('density', {
      cellSize: 20,
      smoothing: 0.8,
      intensity: 1.0,
      radius: 30,
      colorScheme: 'thermal',
      updateInterval: 100,
      maxValue: 10,
      minValue: 0,
      threshold: 0.1,
      blur: true,
      blurRadius: 2,
    });

    // Autonomy heat map
    this.configs.set('autonomy', {
      cellSize: 25,
      smoothing: 0.7,
      intensity: 0.8,
      radius: 35,
      colorScheme: 'viridis',
      updateInterval: 150,
      maxValue: 100,
      minValue: 0,
      threshold: 5,
      blur: true,
      blurRadius: 3,
    });

    // Resources heat map
    this.configs.set('resources', {
      cellSize: 30,
      smoothing: 0.6,
      intensity: 0.9,
      radius: 40,
      colorScheme: 'warm',
      updateInterval: 200,
      maxValue: 100,
      minValue: 0,
      threshold: 2,
      blur: true,
      blurRadius: 2,
    });

    // Energy heat map
    this.configs.set('energy', {
      cellSize: 20,
      smoothing: 0.9,
      intensity: 0.7,
      radius: 25,
      colorScheme: 'plasma',
      updateInterval: 80,
      maxValue: 100,
      minValue: 0,
      threshold: 1,
      blur: false,
      blurRadius: 0,
    });
  }

  /**
   * Set p5 instance and initialize graphics
   */
  setP5Instance(p5Instance: p5Instance): void {
    this.p5Instance = p5Instance;
    this.initializeColorGradients();
    this.createGraphicsBuffer();
  }

  /**
   * Initialize color gradients with p5 instance
   */
  private initializeColorGradients(): void {
    if (!this.p5Instance) return;

    const p5 = this.p5Instance;

    // Thermal (black -> red -> yellow -> white)
    this.colorGradients.set('thermal', [
      { position: 0.0, color: p5.color(0, 0, 0, 0) },
      { position: 0.25, color: p5.color(128, 0, 0, 100) },
      { position: 0.5, color: p5.color(255, 0, 0, 150) },
      { position: 0.75, color: p5.color(255, 255, 0, 200) },
      { position: 1.0, color: p5.color(255, 255, 255, 255) },
    ]);

    // Viridis (dark purple -> blue -> green -> yellow)
    this.colorGradients.set('viridis', [
      { position: 0.0, color: p5.color(68, 1, 84, 0) },
      { position: 0.25, color: p5.color(59, 82, 139, 100) },
      { position: 0.5, color: p5.color(33, 145, 140, 150) },
      { position: 0.75, color: p5.color(94, 201, 98, 200) },
      { position: 1.0, color: p5.color(253, 231, 37, 255) },
    ]);

    // Plasma (dark purple -> pink -> orange -> yellow)
    this.colorGradients.set('plasma', [
      { position: 0.0, color: p5.color(13, 8, 135, 0) },
      { position: 0.25, color: p5.color(126, 3, 168, 100) },
      { position: 0.5, color: p5.color(203, 71, 119, 150) },
      { position: 0.75, color: p5.color(248, 149, 64, 200) },
      { position: 1.0, color: p5.color(240, 249, 33, 255) },
    ]);

    // Cool (blue -> cyan -> white)
    this.colorGradients.set('cool', [
      { position: 0.0, color: p5.color(0, 0, 255, 0) },
      { position: 0.5, color: p5.color(0, 255, 255, 150) },
      { position: 1.0, color: p5.color(255, 255, 255, 255) },
    ]);

    // Warm (red -> orange -> yellow)
    this.colorGradients.set('warm', [
      { position: 0.0, color: p5.color(255, 0, 0, 0) },
      { position: 0.5, color: p5.color(255, 165, 0, 150) },
      { position: 1.0, color: p5.color(255, 255, 0, 255) },
    ]);
  }

  /**
   * Create graphics buffer for performance
   */
  private createGraphicsBuffer(): void {
    if (!this.p5Instance) return;

    const bufferWidth = Math.abs(
      this.defaultBounds.maxX - this.defaultBounds.minX
    );
    const bufferHeight = Math.abs(
      this.defaultBounds.maxY - this.defaultBounds.minY
    );

    this.graphicsBuffer = this.p5Instance.createGraphics(
      bufferWidth,
      bufferHeight
    );
  }

  /**
   * Update all active heat maps
   */
  update(agents: Map<AgentId, Agent>, currentTime: number): void {
    this.currentTime = currentTime;
    const startTime = performance.now();

    // Update each active layer
    for (const layer of this.activeLayers) {
      this.updateHeatMapLayer(layer, agents);
    }

    this.stats.updateTime = performance.now() - startTime;
    this.stats.lastUpdate = currentTime;
  }

  /**
   * Update specific heat map layer
   */
  private updateHeatMapLayer(
    layer: HeatMapLayer,
    agents: Map<AgentId, Agent>
  ): void {
    const config = this.configs.get(layer);
    if (!config) return;

    // Check if update is needed based on interval
    let heatMap = this.heatMaps.get(layer);
    if (
      heatMap &&
      this.currentTime - heatMap.lastUpdate < config.updateInterval
    ) {
      return;
    }

    // Initialize heat map if needed
    if (!heatMap) {
      heatMap = this.initializeHeatMap(config);
      this.heatMaps.set(layer, heatMap);
    }

    // Clear previous values
    this.clearHeatMap(heatMap);

    // Update heat map based on layer type
    switch (layer) {
      case 'density':
        this.updateDensityHeatMap(heatMap, agents, config);
        break;
      case 'autonomy':
        this.updatePropertyHeatMap(heatMap, agents, config, 'autonomy');
        break;
      case 'resources':
        this.updatePropertyHeatMap(heatMap, agents, config, 'resources');
        break;
      case 'energy':
        this.updatePropertyHeatMap(heatMap, agents, config, 'energy');
        break;
    }

    // Apply smoothing
    if (config.smoothing > 0) {
      this.applySmoothing(heatMap, config.smoothing);
    }

    // Apply blur if enabled
    if (config.blur) {
      this.applyBlur(heatMap, config.blurRadius);
    }

    heatMap.lastUpdate = this.currentTime;
  }

  /**
   * Initialize heat map data structure
   */
  private initializeHeatMap(config: HeatMapConfig): HeatMapData {
    const bounds = this.defaultBounds;
    const width = Math.ceil((bounds.maxX - bounds.minX) / config.cellSize);
    const height = Math.ceil((bounds.maxY - bounds.minY) / config.cellSize);

    const cells: HeatMapCell[][] = [];
    for (let x = 0; x < width; x++) {
      cells[x] = [];
      for (let y = 0; y < height; y++) {
        cells[x]![y] = {
          value: 0,
          density: 0,
          propertySum: 0,
          agentCount: 0,
          lastUpdate: 0,
        };
      }
    }

    return {
      width,
      height,
      cellSize: config.cellSize,
      cells,
      bounds,
      lastUpdate: 0,
    };
  }

  /**
   * Clear heat map values
   */
  private clearHeatMap(heatMap: HeatMapData): void {
    for (let x = 0; x < heatMap.width; x++) {
      for (let y = 0; y < heatMap.height; y++) {
        const cell = heatMap.cells[x]![y]!;
        cell.value = 0;
        cell.density = 0;
        cell.propertySum = 0;
        cell.agentCount = 0;
      }
    }
  }

  /**
   * Update density heat map
   */
  private updateDensityHeatMap(
    heatMap: HeatMapData,
    agents: Map<AgentId, Agent>,
    config: HeatMapConfig
  ): void {
    for (const agent of agents.values()) {
      const position = agent.getPosition();
      if (!position) continue;

      this.addAgentInfluence(
        heatMap,
        position,
        1,
        config.radius,
        config.intensity
      );
    }
  }

  /**
   * Update property-based heat map
   */
  private updatePropertyHeatMap(
    heatMap: HeatMapData,
    agents: Map<AgentId, Agent>,
    config: HeatMapConfig,
    property: string
  ): void {
    for (const agent of agents.values()) {
      const position = agent.getPosition();
      if (!position) continue;

      const value = agent.getProperty<number>(property) || 0;
      this.addAgentInfluence(
        heatMap,
        position,
        value,
        config.radius,
        config.intensity
      );
    }
  }

  /**
   * Add agent influence to heat map
   */
  private addAgentInfluence(
    heatMap: HeatMapData,
    position: Position,
    value: number,
    radius: number,
    intensity: number
  ): void {
    const cellX = Math.floor(
      (position.x - heatMap.bounds.minX) / heatMap.cellSize
    );
    const cellY = Math.floor(
      (position.y - heatMap.bounds.minY) / heatMap.cellSize
    );

    const radiusInCells = Math.ceil(radius / heatMap.cellSize);

    for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
      for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
        const targetX = cellX + dx;
        const targetY = cellY + dy;

        if (
          targetX < 0 ||
          targetX >= heatMap.width ||
          targetY < 0 ||
          targetY >= heatMap.height
        ) {
          continue;
        }

        const distance = Math.sqrt(dx * dx + dy * dy) * heatMap.cellSize;
        if (distance > radius) continue;

        // Calculate influence based on distance (Gaussian falloff)
        const influence = Math.exp(
          -(distance * distance) / (2 * radius * radius)
        );
        const contribution = value * influence * intensity;

        const cell = heatMap.cells[targetX]![targetY]!;
        cell.value += contribution;
        cell.density += influence;
        cell.propertySum += value * influence;
        cell.agentCount++;
      }
    }
  }

  /**
   * Apply smoothing to heat map
   */
  private applySmoothing(heatMap: HeatMapData, smoothing: number): void {
    const smoothedCells: HeatMapCell[][] = [];

    for (let x = 0; x < heatMap.width; x++) {
      smoothedCells[x] = [];
      for (let y = 0; y < heatMap.height; y++) {
        smoothedCells[x]![y] = { ...heatMap.cells[x]![y]! };
      }
    }

    for (let x = 1; x < heatMap.width - 1; x++) {
      for (let y = 1; y < heatMap.height - 1; y++) {
        let sum = 0;
        let count = 0;

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const targetX = x + dx;
            const targetY = y + dy;
            if (targetX >= 0 && targetX < heatMap.width && targetY >= 0 && targetY < heatMap.height) {
              const cell = heatMap.cells[targetX]?.[targetY];
              if (cell) {
                sum += cell.value;
                count++;
              }
            }
          }
        }

        const average = count > 0 ? sum / count : 0;
        const currentCell = heatMap.cells[x]?.[y];
        const current = currentCell?.value || 0;
        const smoothedCell = smoothedCells[x]?.[y];

        if (smoothedCell) {
          smoothedCell.value = current + (average - current) * smoothing;
        }
      }
    }

    heatMap.cells = smoothedCells;
  }

  /**
   * Apply blur to heat map
   */
  private applyBlur(heatMap: HeatMapData, blurRadius: number): void {
    if (blurRadius <= 0) return;

    const blurredCells: HeatMapCell[][] = [];

    for (let x = 0; x < heatMap.width; x++) {
      blurredCells[x] = [];
      for (let y = 0; y < heatMap.height; y++) {
        const cell = heatMap.cells[x]![y]!;
        blurredCells[x]![y] = { ...cell };
      }
    }

    for (let x = 0; x < heatMap.width; x++) {
      for (let y = 0; y < heatMap.height; y++) {
        let sum = 0;
        let count = 0;

        for (let dx = -blurRadius; dx <= blurRadius; dx++) {
          for (let dy = -blurRadius; dy <= blurRadius; dy++) {
            const nx = x + dx;
            const ny = y + dy;

            if (
              nx >= 0 &&
              nx < heatMap.width &&
              ny >= 0 &&
              ny < heatMap.height
            ) {
              const cell = heatMap.cells[nx]?.[ny];
              if (cell) {
                sum += cell.value;
                count++;
              }
            }
          }
        }

        const blurredCell = blurredCells[x]![y]!;
        blurredCell.value = count > 0 ? sum / count : 0;
      }
    }

    heatMap.cells = blurredCells;
  }

  /**
   * Render all active heat maps
   */
  render(sketch: p5Instance): void {
    if (!this.p5Instance) {
      this.p5Instance = sketch;
      this.initializeColorGradients();
    }

    const startTime = performance.now();

    sketch.push();

    // Render each active layer
    for (const layer of this.activeLayers) {
      const heatMap = this.heatMaps.get(layer);
      const config = this.configs.get(layer);

      if (heatMap && config) {
        this.renderHeatMapLayer(sketch, heatMap, config);
      }
    }

    sketch.pop();

    this.stats.renderTime = performance.now() - startTime;
  }

  /**
   * Render specific heat map layer
   */
  private renderHeatMapLayer(
    sketch: p5Instance,
    heatMap: HeatMapData,
    config: HeatMapConfig
  ): void {
    const gradient = this.colorGradients.get(config.colorScheme);
    if (!gradient) return;

    sketch.push();
    sketch.noStroke();

    let activeCells = 0;

    for (let x = 0; x < heatMap.width; x++) {
      for (let y = 0; y < heatMap.height; y++) {
        const cell = heatMap.cells[x]![y]!;

        if (cell.value < config.threshold) continue;

        // Normalize value to 0-1 range
        const normalizedValue = Math.min(
          1,
          Math.max(
            0,
            (cell.value - config.minValue) / (config.maxValue - config.minValue)
          )
        );

        // Get color from gradient
        const color = this.getColorFromGradient(gradient, normalizedValue);

        sketch.fill(color);

        // Draw cell
        const worldX = heatMap.bounds.minX + x * heatMap.cellSize;
        const worldY = heatMap.bounds.minY + y * heatMap.cellSize;

        sketch.rect(worldX, worldY, heatMap.cellSize, heatMap.cellSize);
        activeCells++;
      }
    }

    sketch.pop();

    this.stats.activeCells = activeCells;
    this.stats.totalCells = heatMap.width * heatMap.height;
  }

  /**
   * Get color from gradient at position
   */
  private getColorFromGradient(
    gradient: ColorStop[],
    position: number
  ): Color {
    if (!this.p5Instance) {
      // Return a default color if p5Instance is not available
      return { toString: () => '#000000' } as Color;
    }

    position = Math.max(0, Math.min(1, position));

    // Find surrounding color stops
    let lowerStop = gradient[0]!;
    let upperStop = gradient[gradient.length - 1]!;

    for (let i = 0; i < gradient.length - 1; i++) {
      const currentStop = gradient[i]!;
      const nextStop = gradient[i + 1]!;
      if (
        position >= currentStop.position &&
        position <= nextStop.position
      ) {
        lowerStop = currentStop;
        upperStop = nextStop;
        break;
      }
    }

    // Interpolate between colors
    const range = upperStop.position - lowerStop.position;
    const t = range === 0 ? 0 : (position - lowerStop.position) / range;

    const r =
      this.p5Instance.red(lowerStop.color) +
      t *
        (this.p5Instance.red(upperStop.color) -
          this.p5Instance.red(lowerStop.color));
    const g =
      this.p5Instance.green(lowerStop.color) +
      t *
        (this.p5Instance.green(upperStop.color) -
          this.p5Instance.green(lowerStop.color));
    const b =
      this.p5Instance.blue(lowerStop.color) +
      t *
        (this.p5Instance.blue(upperStop.color) -
          this.p5Instance.blue(lowerStop.color));
    const a =
      this.p5Instance.alpha(lowerStop.color) +
      t *
        (this.p5Instance.alpha(upperStop.color) -
          this.p5Instance.alpha(lowerStop.color));

    return this.p5Instance.color(r, g, b, a);
  }

  /**
   * Enable heat map layer
   */
  enableLayer(layer: HeatMapLayer): void {
    this.activeLayers.add(layer);
  }

  /**
   * Disable heat map layer
   */
  disableLayer(layer: HeatMapLayer): void {
    this.activeLayers.delete(layer);
  }

  /**
   * Toggle heat map layer
   */
  toggleLayer(layer: HeatMapLayer): boolean {
    if (this.activeLayers.has(layer)) {
      this.disableLayer(layer);
      return false;
    } else {
      this.enableLayer(layer);
      return true;
    }
  }

  /**
   * Check if layer is active
   */
  isLayerActive(layer: HeatMapLayer): boolean {
    return this.activeLayers.has(layer);
  }

  /**
   * Get active layers
   */
  getActiveLayers(): HeatMapLayer[] {
    return Array.from(this.activeLayers);
  }

  /**
   * Update layer configuration
   */
  updateLayerConfig(layer: HeatMapLayer, config: Partial<HeatMapConfig>): void {
    const currentConfig = this.configs.get(layer);
    if (currentConfig) {
      this.configs.set(layer, { ...currentConfig, ...config });
    }
  }

  /**
   * Get layer configuration
   */
  getLayerConfig(layer: HeatMapLayer): HeatMapConfig | undefined {
    return this.configs.get(layer);
  }

  /**
   * Set heat map bounds
   */
  setBounds(bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }): void {
    this.defaultBounds = bounds;

    // Reinitialize all heat maps
    this.heatMaps.clear();
  }

  /**
   * Get performance statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Export heat map data
   */
  exportHeatMapData(layer: HeatMapLayer): number[][] | null {
    const heatMap = this.heatMaps.get(layer);
    if (!heatMap) return null;

    const data: number[][] = [];
    for (let x = 0; x < heatMap.width; x++) {
      data[x] = [];
      for (let y = 0; y < heatMap.height; y++) {
        data[x]![y] = heatMap.cells[x]![y]!.value;
      }
    }

    return data;
  }

  /**
   * Clear all heat maps
   */
  clear(): void {
    this.heatMaps.clear();
    this.activeLayers.clear();
  }

  /**
   * Destroy the heat map system
   */
  destroy(): void {
    this.clear();
    this.colorGradients.clear();

    if (this.graphicsBuffer) {
      this.graphicsBuffer.remove();
      this.graphicsBuffer = null;
    }

    this.p5Instance = null;
  }
}
