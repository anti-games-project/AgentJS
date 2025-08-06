/**
 * AgentTrailSystem - Movement history visualization
 *
 * Features:
 * - Configurable trail length and fade
 * - Trail color based on agent state
 * - Performance optimization for many trails
 * - State change indicators along trails
 * - Historical position markers
 */

/// <reference path="../types/p5-global.d.ts" />
import type { Agent } from '../core/agents/Agent';
import type { AgentId, Position } from '../types/core';

/** Create a Position object from coordinates */
const createPosition = (x: number, y: number): Position =>
  ({ x, y }) as Position;

/** Trail point with metadata */
export interface TrailPoint {
  position: Position;
  timestamp: number;
  agentState?: Record<string, any>;
  isStateChange?: boolean;
  stateChangeType?: string | undefined;
}

/** Trail configuration */
export interface TrailConfig {
  maxLength: number;
  fadeSpeed: number;
  colorProperty?: string;
  showStateChanges: boolean;
  showDirectionArrows: boolean;
  lineWidth: number;
  minAlpha: number;
  maxAlpha: number;
  smoothingFactor: number;
  cullDistance: number;
}

/** Agent trail data */
interface AgentTrail {
  agentId: AgentId;
  points: TrailPoint[];
  lastPosition: Position | null;
  lastStateSnapshot: Record<string, any>;
  color: Color | null;
  isVisible: boolean;
  needsUpdate: boolean;
}

/** Trail rendering style */
export interface TrailStyle {
  strokeColor: Color;
  strokeWeight: number;
  alpha: number;
  isDashed: boolean;
  dashPattern?: number[] | undefined;
}

/**
 * AgentTrailSystem - Manages movement trails for all agents
 *
 * Educational Context: Visualizes agent movement patterns
 * and behavioral changes over time, helping users understand
 * spatial dynamics and decision-making processes.
 */
export class AgentTrailSystem {
  /** Trail configuration */
  private config: TrailConfig;

  /** Agent trails map */
  private trails: Map<AgentId, AgentTrail> = new Map();

  /** Current timestamp for trail points */
  private currentTime: number = 0;

  /** Performance monitoring */
  private readonly stats = {
    totalTrails: 0,
    visibleTrails: 0,
    totalPoints: 0,
    averageTrailLength: 0,
    lastUpdateTime: 0,
  };

  /** Color cache for performance */
  private colorCache: Map<string, Color> = new Map();

  /** p5 instance reference for color creation */
  private p5Instance: p5Instance | null = null;

  constructor(config: Partial<TrailConfig> = {}) {
    this.config = {
      maxLength: 50,
      fadeSpeed: 0.98,
      colorProperty: 'autonomy',
      showStateChanges: true,
      showDirectionArrows: false,
      lineWidth: 2,
      minAlpha: 20,
      maxAlpha: 200,
      smoothingFactor: 0.3,
      cullDistance: 5, // Minimum distance between trail points
      ...config,
    };
  }

  /**
   * Set p5 instance for color creation
   */
  setP5Instance(p5Instance: p5Instance): void {
    this.p5Instance = p5Instance;
    this.colorCache.clear();
  }

  /**
   * Update trails for all agents
   */
  update(agents: Map<AgentId, Agent>, currentTime: number): void {
    this.currentTime = currentTime;

    // Update existing trails and add new ones
    for (const [agentId, agent] of agents) {
      this.updateAgentTrail(agentId, agent);
    }

    // Remove trails for agents that no longer exist
    for (const agentId of this.trails.keys()) {
      if (!agents.has(agentId)) {
        this.trails.delete(agentId);
      }
    }

    // Update performance stats
    this.updateStats();
  }

  /**
   * Update trail for a specific agent
   */
  private updateAgentTrail(agentId: AgentId, agent: Agent): void {
    const currentPos = agent.position;
    if (!currentPos) return;

    let trail = this.trails.get(agentId);

    // Create new trail if needed
    if (!trail) {
      trail = this.createNewTrail(agentId, agent);
      this.trails.set(agentId, trail);
    }

    // Check if agent moved significantly
    const shouldAddPoint = this.shouldAddTrailPoint(trail, currentPos, agent);

    if (shouldAddPoint) {
      this.addTrailPoint(trail, currentPos, agent);
    }

    // Update trail properties
    this.updateTrailProperties(trail, agent);

    // Cull old points
    this.cullTrailPoints(trail);
  }

  /**
   * Create new trail for agent
   */
  private createNewTrail(agentId: AgentId, agent: Agent): AgentTrail {
    const currentPos = agent.position;

    return {
      agentId,
      points: currentPos ? [this.createTrailPoint(currentPos, agent)] : [],
      lastPosition: currentPos,
      lastStateSnapshot: this.captureAgentState(agent),
      color: null,
      isVisible: true,
      needsUpdate: true,
    };
  }

  /**
   * Check if a new trail point should be added
   */
  private shouldAddTrailPoint(
    trail: AgentTrail,
    currentPos: Position,
    agent: Agent
  ): boolean {
    // Always add first point
    if (!trail.lastPosition) return true;

    // Check minimum distance
    const distance = this.calculateDistance(trail.lastPosition, currentPos);
    if (distance < this.config.cullDistance) return false;

    // Check for state changes
    if (this.config.showStateChanges && this.hasStateChanged(trail, agent)) {
      return true;
    }

    // Add point if moved significant distance
    return distance >= this.config.cullDistance;
  }

  /**
   * Add new trail point
   */
  private addTrailPoint(
    trail: AgentTrail,
    position: Position,
    agent: Agent
  ): void {
    const currentState = this.captureAgentState(agent);
    const isStateChange = this.hasStateChanged(trail, agent);

    const point: TrailPoint = {
      position: createPosition(position.x, position.y),
      timestamp: this.currentTime,
      agentState: currentState,
      isStateChange,
      stateChangeType: isStateChange
        ? this.getStateChangeType(trail.lastStateSnapshot, currentState)
        : undefined,
    };

    trail.points.push(point);
    trail.lastPosition = position;
    trail.lastStateSnapshot = currentState;
    trail.needsUpdate = true;
  }

  /**
   * Create trail point from position and agent
   */
  private createTrailPoint(position: Position, agent: Agent): TrailPoint {
    return {
      position: createPosition(position.x, position.y),
      timestamp: this.currentTime,
      agentState: this.captureAgentState(agent),
      isStateChange: false,
    };
  }

  /**
   * Capture agent state snapshot
   */
  private captureAgentState(agent: Agent): Record<string, any> {
    const state: Record<string, any> = {};

    // Capture key properties
    if (this.config.colorProperty) {
      state[this.config.colorProperty] = agent.getProperty(
        this.config.colorProperty
      );
    }

    state.type = agent.getProperty('type');
    state.energy = agent.getProperty('energy');
    state.autonomy = agent.getProperty('autonomy');

    return state;
  }

  /**
   * Check if agent state has changed significantly
   */
  private hasStateChanged(trail: AgentTrail, agent: Agent): boolean {
    const currentState = this.captureAgentState(agent);
    const lastState = trail.lastStateSnapshot;

    // Check key properties for changes
    for (const key in currentState) {
      if (Math.abs((currentState[key] || 0) - (lastState[key] || 0)) > 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get state change type for visualization
   */
  private getStateChangeType(
    oldState: Record<string, any>,
    newState: Record<string, any>
  ): string {
    const autonomyChange = (newState.autonomy || 0) - (oldState.autonomy || 0);
    const energyChange = (newState.energy || 0) - (oldState.energy || 0);

    if (autonomyChange > 10) return 'autonomy_gain';
    if (autonomyChange < -10) return 'autonomy_loss';
    if (energyChange > 10) return 'energy_gain';
    if (energyChange < -10) return 'energy_loss';

    return 'unknown';
  }

  /**
   * Update trail visual properties
   */
  private updateTrailProperties(trail: AgentTrail, agent: Agent): void {
    if (!this.p5Instance) return;

    // Update color based on current agent state
    if (this.config.colorProperty) {
      const colorValue = agent.getProperty<number>(this.config.colorProperty);
      trail.color = this.getColorForValue(colorValue);
    }

    // Update visibility based on viewport culling
    trail.isVisible = this.isTrailVisible(trail);
  }

  /**
   * Get color for property value
   */
  private getColorForValue(value: number | undefined): Color {
    if (!this.p5Instance) {
      return { toString: () => '#649AFF' } as Color;
    }

    const normalizedValue = Math.max(0, Math.min(100, value || 0));
    const colorKey = `color_${Math.floor(normalizedValue / 5) * 5}`;

    if (this.colorCache.has(colorKey)) {
      return this.colorCache.get(colorKey)!;
    }

    let color: Color;

    // MVP color mapping (matches agent colors)
    if (normalizedValue < 20) {
      color = this.p5Instance.color(220, 53, 69); // Red
    } else if (normalizedValue < 40) {
      color = this.p5Instance.color(255, 165, 0); // Orange
    } else if (normalizedValue < 60) {
      color = this.p5Instance.color(255, 235, 59); // Yellow
    } else if (normalizedValue < 80) {
      color = this.p5Instance.color(13, 110, 253); // Blue
    } else {
      color = this.p5Instance.color(40, 167, 69); // Green
    }

    this.colorCache.set(colorKey, color);
    return color;
  }

  /**
   * Check if trail is visible (basic implementation)
   */
  private isTrailVisible(trail: AgentTrail): boolean {
    // Simple visibility check - could be enhanced with viewport culling
    return trail.points.length > 0;
  }

  /**
   * Remove old trail points
   */
  private cullTrailPoints(trail: AgentTrail): void {
    // Remove points beyond max length
    if (trail.points.length > this.config.maxLength) {
      trail.points = trail.points.slice(-this.config.maxLength);
      trail.needsUpdate = true;
    }

    // Remove very old points (time-based culling)
    const maxAge = 30000; // 30 seconds
    const cutoffTime = this.currentTime - maxAge;

    const oldLength = trail.points.length;
    trail.points = trail.points.filter(point => point.timestamp > cutoffTime);

    if (trail.points.length !== oldLength) {
      trail.needsUpdate = true;
    }
  }

  /**
   * Render all trails
   */
  render(sketch: p5Instance): void {
    if (!this.p5Instance) {
      this.p5Instance = sketch;
    }

    sketch.push();

    for (const trail of this.trails.values()) {
      if (trail.isVisible && trail.points.length > 1) {
        this.renderTrail(sketch, trail);
      }
    }

    sketch.pop();
  }

  /**
   * Render individual trail
   */
  private renderTrail(sketch: p5Instance, trail: AgentTrail): void {
    const points = trail.points;
    if (points.length < 2) return;

    sketch.push();

    // Draw trail line
    for (let i = 0; i < points.length - 1; i++) {
      const point1 = points[i];
      const point2 = points[i + 1];

      if (!point1 || !point2) continue;

      // Calculate fade based on age and position
      const age = (this.currentTime - point1.timestamp) / 10000; // 10 second full fade
      const fadeAlpha = Math.max(
        this.config.minAlpha,
        this.config.maxAlpha * (1 - age)
      );

      // Set stroke style
      const style = this.getTrailStyle(trail, point1, fadeAlpha);
      sketch.stroke(style.strokeColor);
      sketch.strokeWeight(style.strokeWeight);

      // Draw line segment
      if (style.isDashed && style.dashPattern) {
        this.drawDashedLine(
          sketch,
          point1.position,
          point2.position,
          style.dashPattern
        );
      } else {
        sketch.line(
          point1.position.x,
          point1.position.y,
          point2.position.x,
          point2.position.y
        );
      }
    }

    // Draw state change indicators
    if (this.config.showStateChanges) {
      this.renderStateChangeIndicators(sketch, trail);
    }

    // Draw direction arrows
    if (this.config.showDirectionArrows) {
      this.renderDirectionArrows(sketch, trail);
    }

    sketch.pop();
  }

  /**
   * Get trail style for segment
   */
  private getTrailStyle(
    trail: AgentTrail,
    point: TrailPoint,
    alpha: number
  ): TrailStyle {
    const baseColor = trail.color || this.p5Instance?.color(100, 150, 255);
    if (!this.p5Instance || !baseColor) {
      return {
        strokeColor: { toString: () => '#649AFF' } as Color,
        strokeWeight: Math.max(0.5, this.config.lineWidth / 1.0),
        alpha: alpha,
        isDashed: false,
      };
    }
    
    const strokeColor = this.p5Instance.color(
      this.p5Instance.red(baseColor),
      this.p5Instance.green(baseColor),
      this.p5Instance.blue(baseColor),
      alpha
    );

    return {
      strokeColor: strokeColor as Color,
      strokeWeight: this.config.lineWidth,
      alpha,
      isDashed: point.isStateChange || false,
      dashPattern: point.isStateChange ? [5, 3] : undefined,
    };
  }

  /**
   * Draw dashed line
   */
  private drawDashedLine(
    sketch: p5Instance,
    start: Position,
    end: Position,
    pattern: number[]
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance === 0) return;

    const unitX = dx / distance;
    const unitY = dy / distance;

    let currentDistance = 0;
    let patternIndex = 0;
    let drawing = true;

    while (currentDistance < distance) {
      const dashLength = Math.min(
        pattern[patternIndex] || 1,
        distance - currentDistance
      );
      const endX = start.x + unitX * (currentDistance + dashLength);
      const endY = start.y + unitY * (currentDistance + dashLength);

      if (drawing) {
        sketch.line(
          start.x + unitX * currentDistance,
          start.y + unitY * currentDistance,
          endX,
          endY
        );
      }

      currentDistance += dashLength;
      patternIndex = (patternIndex + 1) % pattern.length;
      drawing = !drawing;
    }
  }

  /**
   * Render state change indicators
   */
  private renderStateChangeIndicators(sketch: p5Instance, trail: AgentTrail): void {
    sketch.push();

    for (const point of trail.points) {
      if (point.isStateChange) {
        const color = this.getStateChangeColor(point.stateChangeType);
        sketch.fill(color);
        sketch.noStroke();
        sketch.circle(point.position.x, point.position.y, 6);
      }
    }

    sketch.pop();
  }

  /**
   * Get color for state change type
   */
  private getStateChangeColor(changeType: string | undefined): Color {
    if (!this.p5Instance) {
      return { toString: () => '#FFFFFF' } as Color;
    }

    switch (changeType) {
      case 'autonomy_gain':
        return this.p5Instance.color(40, 167, 69); // Green
      case 'autonomy_loss':
        return this.p5Instance.color(220, 53, 69); // Red
      case 'energy_gain':
        return this.p5Instance.color(255, 235, 59); // Yellow
      case 'energy_loss':
        return this.p5Instance.color(255, 165, 0); // Orange
      default:
        return this.p5Instance.color(100, 100, 100); // Gray
    }
  }

  /**
   * Render direction arrows
   */
  private renderDirectionArrows(sketch: p5Instance, trail: AgentTrail): void {
    const points = trail.points;
    if (points.length < 3) return;

    sketch.push();
    sketch.fill(trail.color || sketch.color(100, 150, 255));
    sketch.noStroke();

    // Draw arrows every few points
    for (let i = 2; i < points.length; i += 5) {
      const point1 = points[i - 1];
      const point2 = points[i];

      if (point1 && point2) {
        this.drawArrow(sketch, point1.position, point2.position, 4);
      }
    }

    sketch.pop();
  }

  /**
   * Draw arrow pointing from start to end
   */
  private drawArrow(
    sketch: p5Instance,
    start: Position,
    end: Position,
    size: number
  ): void {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);

    const arrowX = start.x + dx * 0.7;
    const arrowY = start.y + dy * 0.7;

    sketch.push();
    sketch.translate(arrowX, arrowY);
    sketch.rotate(angle);

    // Draw arrow head
    sketch.triangle(0, 0, -size, -size / 2, -size, size / 2);

    sketch.pop();
  }

  /**
   * Calculate distance between two positions
   */
  private calculateDistance(pos1: Position, pos2: Position): number {
    const dx = pos2.x - pos1.x;
    const dy = pos2.y - pos1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Update performance statistics
   */
  private updateStats(): void {
    this.stats.totalTrails = this.trails.size;
    this.stats.visibleTrails = Array.from(this.trails.values()).filter(
      t => t.isVisible
    ).length;
    this.stats.totalPoints = Array.from(this.trails.values()).reduce(
      (sum, t) => sum + t.points.length,
      0
    );
    this.stats.averageTrailLength =
      this.stats.totalTrails > 0
        ? this.stats.totalPoints / this.stats.totalTrails
        : 0;
    this.stats.lastUpdateTime = this.currentTime;
  }

  /**
   * Get trail for specific agent
   */
  getTrail(agentId: AgentId): AgentTrail | undefined {
    return this.trails.get(agentId);
  }

  /**
   * Clear trail for specific agent
   */
  clearTrail(agentId: AgentId): boolean {
    return this.trails.delete(agentId);
  }

  /**
   * Clear all trails
   */
  clearAllTrails(): void {
    this.trails.clear();
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TrailConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Mark all trails for update
    for (const trail of this.trails.values()) {
      trail.needsUpdate = true;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): TrailConfig {
    return { ...this.config };
  }

  /**
   * Get performance statistics
   */
  getStats(): typeof this.stats {
    return { ...this.stats };
  }

  /**
   * Export trail data for analysis
   */
  exportTrailData(): Record<AgentId, TrailPoint[]> {
    const data: Record<AgentId, TrailPoint[]> = {};

    for (const [agentId, trail] of this.trails) {
      data[agentId] = [...trail.points];
    }

    return data;
  }

  /**
   * Destroy the trail system
   */
  destroy(): void {
    this.trails.clear();
    this.colorCache.clear();
    this.p5Instance = null;
  }
}
