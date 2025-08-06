/**
 * Visualizer - Main visualization class with p5Instance.js integration
 */

/// <reference path="../types/p5-global.d.ts" />
import type { Agent } from '../core/agents/Agent';
import type { Environment } from '../core/environment/Environment';
import type { NetworkManager } from '../core/network/NetworkManager';
import { ConnectionType } from '../core/network/NetworkManager';
import type { AgentId, Position } from '../types/core';
import { AgentDefinitionVisualizer } from './AgentDefinitionVisualizer';
import { AnimationEngine } from './AnimationEngine';
import { AgentTrailSystem } from './AgentTrailSystem';
import { HeatMapSystem, type HeatMapLayer } from './HeatMapSystem';
import {
  ParticleEffectsSystem,
  type ParticleEffectType,
} from './ParticleEffectsSystem';

/** Visualization configuration */
export interface VisualizerConfig {
  readonly canvas: {
    width: number;
    height: number;
    background: number;
  };
  readonly rendering: {
    frameRate: number;
    enableAntiAliasing: boolean;
    pixelDensity: number;
  };
  readonly agents: {
    defaultSize: number;
    sizeProperty?: string;
    colorProperty?: string;
    minSize: number;
    maxSize: number;
  };
  readonly camera: {
    enablePan: boolean;
    enableZoom: boolean;
    minZoom: number;
    maxZoom: number;
  };
}

/** Agent visual appearance */
export interface AgentVisuals {
  size: number;
  color: Color | string;
  transparency: number;
  shape: 'circle' | 'square' | 'triangle';
}

/** Camera state */
export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Visualizer - Main visualization system for AgentJS
 *
 * Features:
 * - p5Instance.js integration with TypeScript support
 * - Real-time agent rendering with property-based visuals
 * - Interactive camera controls (pan/zoom)
 * - Performance optimization for 100+ agents
 * - Configurable rendering pipeline
 *
 * Educational Context: Provides visual feedback for agent-based
 * simulations, making complex behaviors observable and understandable.
 */
export class Visualizer {
  /** p5Instance.js instance */
  private p5Instance: p5Instance | null = null;

  /** Reference to agents map */
  private agents: Map<AgentId, Agent> = new Map();

  /** Reference to environment */
  private environment: Environment | null = null;

  /** Reference to network manager */
  private networkManager: NetworkManager | null = null;

  /** Visualization configuration */
  private config: VisualizerConfig;

  /** Camera state */
  private camera: CameraState;

  /** Canvas container element */
  private container: HTMLElement | null = null;

  /** Animation frame ID for cleanup */
  private animationId: number | null = null;

  /** Performance monitoring */
  private readonly frameStats = {
    frames: 0,
    lastTime: 0,
    fps: 60,
  };

  /** Real-time agent definition visualizer */
  private definitionVisualizer: AgentDefinitionVisualizer;

  /** Animation engine for smooth transitions */
  private animationEngine: AnimationEngine;

  /** Agent trail system for movement history */
  private trailSystem: AgentTrailSystem;

  /** Heat map system for spatial analysis */
  private heatMapSystem: HeatMapSystem;

  /** Particle effects system for visual feedback */
  private particleSystem: ParticleEffectsSystem;

  constructor(config: Partial<VisualizerConfig> = {}) {
    this.config = {
      canvas: {
        width: 800,
        height: 600,
        background: 240,
      },
      rendering: {
        frameRate: 60,
        enableAntiAliasing: true,
        pixelDensity: 1,
      },
      agents: {
        defaultSize: 8,
        sizeProperty: 'energy',
        colorProperty: 'autonomy',
        minSize: 4,
        maxSize: 20,
      },
      camera: {
        enablePan: true,
        enableZoom: true,
        minZoom: 0.1,
        maxZoom: 5.0,
      },
      ...config,
    };

    this.camera = {
      x: 0,
      y: 0,
      zoom: 1,
    };

    // Initialize visualization systems
    this.definitionVisualizer = new AgentDefinitionVisualizer({
      showIncomplete: true,
      showProgress: true,
      highlightMissing: true,
      animateChanges: true,
    });

    this.animationEngine = new AnimationEngine();
    this.trailSystem = new AgentTrailSystem();
    this.heatMapSystem = new HeatMapSystem();
    this.particleSystem = new ParticleEffectsSystem();
  }

  /**
   * Initialize visualization with container element
   */
  initialize(containerElement: HTMLElement): void {
    this.container = containerElement;

    this.p5Instance = new p5((sketch: p5Instance) => {
      sketch.setup = () => this.setup(sketch);
      sketch.draw = () => this.draw(sketch);
      sketch.mousePressed = () => this.handleMousePressed(sketch);
      sketch.mouseDragged = () => this.handleMouseDragged(sketch);
      sketch.mouseWheel = (event: any) => this.handleMouseWheel(sketch, event);
      sketch.windowResized = () => this.handleWindowResize(sketch);
    }, containerElement);

    // Initialize systems with p5Instance instance
    this.trailSystem.setP5Instance(this.p5Instance);
    this.heatMapSystem.setP5Instance(this.p5Instance);
    this.particleSystem.setP5Instance(this.p5Instance);
  }

  /**
   * p5Instance.js setup function
   */
  private setup(sketch: p5Instance): void {
    sketch.createCanvas(this.config.canvas.width, this.config.canvas.height);
    sketch.frameRate(this.config.rendering.frameRate);
    sketch.pixelDensity(this.config.rendering.pixelDensity);

    if (this.config.rendering.enableAntiAliasing) {
      sketch.smooth();
    } else {
      sketch.noSmooth();
    }

    // Initial camera setup
    this.camera = {
      x: this.config.canvas.width / 2,
      y: this.config.canvas.height / 2,
      zoom: 1,
    };
  }

  /**
   * p5Instance.js draw function - main rendering loop
   */
  private draw(sketch: p5Instance): void {
    // Update performance stats
    this.updateFrameStats();

    const currentTime = performance.now();
    const deltaTime = currentTime - this.frameStats.lastTime;

    // Update animation systems
    this.animationEngine.update(deltaTime);
    this.trailSystem.update(this.agents, currentTime);
    this.heatMapSystem.update(this.agents, currentTime);
    this.particleSystem.update(deltaTime);

    // Clear background
    sketch.background(this.config.canvas.background);

    // Apply camera transformations
    sketch.push();
    sketch.translate(this.camera.x, this.camera.y);
    sketch.scale(this.camera.zoom);

    // Render environment
    if (this.environment) {
      this.renderEnvironment(sketch);
    }

    // Render heat maps (behind everything)
    this.heatMapSystem.render(sketch);

    // Render agent trails (behind agents)
    this.trailSystem.render(sketch);

    // Render network connections (behind agents)
    if (this.networkManager) {
      this.renderConnections(sketch);
    }

    // Render agents
    this.renderAgents(sketch);

    // Render particle effects (on top of agents)
    this.particleSystem.render(sketch);

    // Restore transformations
    sketch.pop();

    // Render UI overlay
    this.renderUI(sketch);
  }

  /**
   * Render all agents
   */
  private renderAgents(sketch: p5Instance): void {
    for (const agent of this.agents.values()) {
      const position = this.environment?.getAgentPosition(agent);
      if (position) {
        // Update definition tracking
        this.definitionVisualizer.updateAgentDefinition(agent);

        // Render with definition extent visualization
        this.renderAgentWithDefinition(sketch, agent, position);
      }
    }
  }

  /**
   * Render a single agent with definition extent visualization
   */
  private renderAgentWithDefinition(
    sketch: p5Instance,
    agent: Agent,
    position: Position
  ): void {
    const baseVisuals = this.calculateAgentVisuals(sketch, agent);

    // Use definition visualizer for enhanced rendering
    this.definitionVisualizer.renderAgentWithDefinition(
      sketch,
      agent,
      position,
      baseVisuals
    );
  }

  /**
   * Render a single agent (legacy method, kept for compatibility)
   */
  // @ts-ignore - keeping for legacy compatibility
  private _renderAgent(sketch: p5Instance, agent: Agent, position: Position): void {
    const visuals = this.calculateAgentVisuals(sketch, agent);

    sketch.push();
    sketch.translate(position.x, position.y);

    // Set fill color and transparency
    if (typeof visuals.color === 'string') {
      sketch.fill(visuals.color);
    } else {
      sketch.fill(visuals.color);
    }
    sketch.stroke(0);
    sketch.strokeWeight(1 / this.camera.zoom);

    // Render based on shape
    switch (visuals.shape) {
      case 'circle':
        sketch.circle(0, 0, visuals.size);
        break;
      case 'square':
        sketch.rectMode(sketch.CENTER);
        sketch.square(0, 0, visuals.size);
        break;
      case 'triangle':
        this.drawTriangle(sketch, visuals.size);
        break;
    }

    sketch.pop();
  }

  /**
   * Calculate visual properties for an agent
   *
   * MVP Visual Design: Uses primary colors and geometric shapes
   * - Red: Exploitation/danger states
   * - Blue: Support/safety states
   * - Green: Growth/empowerment states
   * - Yellow: Resources/opportunities
   * - Orange: Vulnerability/warning states
   */
  private calculateAgentVisuals(sketch: p5Instance, agent: Agent): AgentVisuals {
    const config = this.config.agents;

    // Calculate size based on property (resources/social capital)
    let size = config.defaultSize;
    if (config.sizeProperty) {
      const value = agent.getProperty<number>(config.sizeProperty);
      if (typeof value === 'number') {
        size = sketch.map(value, 0, 100, config.minSize, config.maxSize);
      }
    }

    // Calculate color based on autonomy/network state (MVP primary colors)
    let color: Color | string = sketch.color(100, 150, 255); // Default blue
    if (config.colorProperty) {
      const value = agent.getProperty<number>(config.colorProperty);
      if (typeof value === 'number') {
        // MVP: Primary color mapping for autonomy levels
        if (value < 20) {
          color = sketch.color(220, 53, 69); // Red - exploitation/danger
        } else if (value < 40) {
          color = sketch.color(255, 165, 0); // Orange - vulnerability/warning
        } else if (value < 60) {
          color = sketch.color(255, 235, 59); // Yellow - resources/opportunities
        } else if (value < 80) {
          color = sketch.color(13, 110, 253); // Blue - support/safety
        } else {
          color = sketch.color(40, 167, 69); // Green - growth/empowerment
        }
      }
    }

    // Determine shape based on agent type (MVP geometric shapes)
    const agentType = agent.getProperty<string>('type') ?? 'default';
    const shape = this.getAgentShape(agentType);

    return {
      size: Math.max(config.minSize, size),
      color,
      transparency: 255,
      shape,
    };
  }

  /**
   * Get agent shape based on type (MVP geometric shapes)
   *
   * MVP Design Mapping:
   * - Circles: Community members (default)
   * - Triangles: Leaders/influencers
   * - Squares: Resources/institutions
   *
   * Post-MVP: Will be replaced with custom character artwork
   */
  private getAgentShape(agentType: string): 'circle' | 'square' | 'triangle' {
    switch (agentType) {
      case 'leader':
      case 'influencer':
        return 'triangle'; // Leaders/influencers
      case 'resource':
      case 'institution':
      case 'service':
        return 'square'; // Resources/institutions
      case 'member':
      case 'community':
      default:
        return 'circle'; // Community members (default)
    }
  }

  /**
   * Draw triangle shape
   */
  private drawTriangle(sketch: p5Instance, size: number): void {
    const height = size * 0.866; // Height of equilateral triangle
    sketch.triangle(
      0,
      -height / 2,
      -size / 2,
      height / 2,
      size / 2,
      height / 2
    );
  }

  /**
   * Render network connections (MVP geometric line visualization)
   *
   * MVP Design:
   * - Supportive connections: Blue lines (#2563EB)
   * - Exploitative connections: Red lines (#DC2626)
   * - Economic connections: Green dashed lines (#059669)
   */
  private renderConnections(sketch: p5Instance): void {
    if (!this.networkManager || !this.environment) return;

    const connections = this.networkManager.getAllConnections();

    for (const connection of connections) {
      const sourceAgent = this.agents.get(connection.source);
      const targetAgent = this.agents.get(connection.target);

      if (!sourceAgent || !targetAgent) continue;

      const sourcePos = this.environment.getAgentPosition(sourceAgent);
      const targetPos = this.environment.getAgentPosition(targetAgent);

      if (!sourcePos || !targetPos) continue;

      // MVP: Set line style based on connection type
      sketch.push();

      const lineWidth =
        Math.max(1, Math.min(4, connection.weight * 3)) / this.camera.zoom;
      sketch.strokeWeight(lineWidth);

      switch (connection.type) {
        case ConnectionType.SUPPORTIVE:
          sketch.stroke(37, 99, 235); // Blue - support/safety
          sketch.noFill();
          // Smooth curve for organic relationships
          const midX = (sourcePos.x + targetPos.x) / 2;
          const midY = (sourcePos.y + targetPos.y) / 2 - 10;
          sketch.bezier(
            sourcePos.x,
            sourcePos.y,
            midX,
            midY,
            midX,
            midY,
            targetPos.x,
            targetPos.y
          );
          break;

        case ConnectionType.EXPLOITATIVE:
          sketch.stroke(220, 38, 38); // Red - exploitation/danger
          sketch.noFill();
          // Straight angular line for tension
          sketch.line(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
          break;

        case ConnectionType.ECONOMIC:
          sketch.stroke(5, 150, 105); // Green - growth/resources
          sketch.noFill();
          // Dashed line for transactional nature
          this.drawDashedLine(
            sketch,
            sourcePos.x,
            sourcePos.y,
            targetPos.x,
            targetPos.y,
            5
          );
          break;

        default:
          sketch.stroke(100); // Neutral gray
          sketch.noFill();
          sketch.line(sourcePos.x, sourcePos.y, targetPos.x, targetPos.y);
          break;
      }

      sketch.pop();
    }
  }

  /**
   * Draw dashed line for economic connections
   */
  private drawDashedLine(
    sketch: p5Instance,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    dashLength: number
  ): void {
    const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    const dashCount = Math.floor(distance / (dashLength * 2));

    if (dashCount === 0) {
      sketch.line(x1, y1, x2, y2);
      return;
    }

    const dx = (x2 - x1) / distance;
    const dy = (y2 - y1) / distance;

    for (let i = 0; i < dashCount; i++) {
      const startX = x1 + dx * dashLength * 2 * i;
      const startY = y1 + dy * dashLength * 2 * i;
      const endX = x1 + dx * dashLength * (2 * i + 1);
      const endY = y1 + dy * dashLength * (2 * i + 1);

      sketch.line(startX, startY, endX, endY);
    }
  }

  /**
   * Render environment background (MVP zone visualization)
   *
   * MVP Design:
   * - Safe zones: Light blue overlay (rgba(37, 99, 235, 0.1))
   * - Danger zones: Light red overlay (rgba(220, 38, 38, 0.1))
   * - Resource areas: Light yellow overlay (rgba(254, 240, 138, 0.2))
   * - Neutral areas: Default background (#F5F5F4)
   */
  private renderEnvironment(sketch: p5Instance): void {
    if (!this.environment) return;

    const bounds = this.getEnvironmentBounds();
    if (!bounds) return;

    sketch.push();

    // Render environment zones (MVP implementation)
    this.renderEnvironmentZones(sketch, bounds);

    // Render environment boundaries
    sketch.noFill();
    sketch.stroke(100);
    sketch.strokeWeight(2 / this.camera.zoom);
    sketch.rect(bounds.x, bounds.y, bounds.width, bounds.height);

    sketch.pop();
  }

  /**
   * Render environment zones with MVP color overlays
   */
  private renderEnvironmentZones(
    sketch: p5Instance,
    bounds: { x: number; y: number; width: number; height: number }
  ): void {
    // Example zone implementation - these would be configurable in a real application

    // Safe zone (top-left quadrant)
    sketch.fill(37, 99, 235, 25); // Light blue overlay (alpha = 25/255 ≈ 0.1)
    sketch.noStroke();
    sketch.rect(bounds.x, bounds.y, bounds.width / 2, bounds.height / 2);

    // Danger zone (bottom-right quadrant)
    sketch.fill(220, 38, 38, 25); // Light red overlay
    sketch.noStroke();
    sketch.rect(
      bounds.x + bounds.width / 2,
      bounds.y + bounds.height / 2,
      bounds.width / 2,
      bounds.height / 2
    );

    // Resource area (top-right quadrant)
    sketch.fill(254, 240, 138, 51); // Light yellow overlay (alpha = 51/255 ≈ 0.2)
    sketch.noStroke();
    sketch.rect(
      bounds.x + bounds.width / 2,
      bounds.y,
      bounds.width / 2,
      bounds.height / 2
    );

    // Neutral area (bottom-left) - no overlay, just default background
  }

  /**
   * Get environment boundaries
   */
  private getEnvironmentBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null {
    // Default bounds - could be made configurable
    return {
      x: -this.config.canvas.width / 2,
      y: -this.config.canvas.height / 2,
      width: this.config.canvas.width,
      height: this.config.canvas.height,
    };
  }

  /**
   * Render UI overlay
   */
  private renderUI(sketch: p5Instance): void {
    sketch.push();
    sketch.resetMatrix(); // Reset camera transformations for UI

    // FPS counter
    sketch.fill(0);
    sketch.noStroke();
    sketch.textAlign(sketch.LEFT, sketch.TOP);
    sketch.text(`FPS: ${this.frameStats.fps.toFixed(1)}`, 10, 10);
    sketch.text(`Agents: ${this.agents.size}`, 10, 25);
    sketch.text(`Zoom: ${(this.camera.zoom * 100).toFixed(0)}%`, 10, 40);

    // Definition extent statistics
    const definitionStats = this.getDefinitionStats();
    sketch.text(`Complete: ${definitionStats.complete}`, 10, 55);
    sketch.text(`Partial: ${definitionStats.partial}`, 10, 70);
    sketch.text(`Missing: ${definitionStats.missing}`, 10, 85);

    sketch.pop();
  }

  /**
   * Handle mouse press events
   */
  private handleMousePressed(sketch: p5Instance): boolean {
    // Store initial mouse position for dragging
    this.previousMouseX = sketch.mouseX;
    this.previousMouseY = sketch.mouseY;
    return false;
  }

  /** Previous mouse coordinates for dragging */
  private previousMouseX = 0;
  private previousMouseY = 0;

  /**
   * Handle mouse drag events
   */
  private handleMouseDragged(sketch: p5Instance): boolean {
    if (!this.config.camera.enablePan) return false;

    const deltaX = sketch.mouseX - this.previousMouseX;
    const deltaY = sketch.mouseY - this.previousMouseY;

    this.camera.x += deltaX;
    this.camera.y += deltaY;

    this.previousMouseX = sketch.mouseX;
    this.previousMouseY = sketch.mouseY;

    return false;
  }

  /**
   * Handle mouse wheel events for zooming
   */
  private handleMouseWheel(_sketch: p5Instance, event: any): boolean {
    if (!this.config.camera.enableZoom) return false;

    const zoomFactor = event.delta > 0 ? 0.9 : 1.1;
    const newZoom = this.camera.zoom * zoomFactor;

    // Clamp zoom to limits
    this.camera.zoom = Math.max(
      this.config.camera.minZoom,
      Math.min(this.config.camera.maxZoom, newZoom)
    );

    return false;
  }

  /**
   * Handle window resize
   */
  private handleWindowResize(sketch: p5Instance): void {
    if (this.container) {
      const rect = this.container.getBoundingClientRect();
      sketch.resizeCanvas(rect.width, rect.height);
      this.config.canvas.width = rect.width;
      this.config.canvas.height = rect.height;
    }
  }

  /**
   * Update frame rate statistics
   */
  private updateFrameStats(): void {
    this.frameStats.frames++;
    const currentTime = Date.now();

    if (currentTime - this.frameStats.lastTime >= 1000) {
      this.frameStats.fps = this.frameStats.frames;
      this.frameStats.frames = 0;
      this.frameStats.lastTime = currentTime;
    }
  }

  /**
   * Set agents to visualize
   */
  setAgents(agents: Map<AgentId, Agent>): void {
    this.agents = agents;
  }

  /**
   * Set environment to visualize
   */
  setEnvironment(environment: Environment): void {
    this.environment = environment;
  }

  /**
   * Set network manager to visualize connections
   */
  setNetworkManager(networkManager: NetworkManager): void {
    this.networkManager = networkManager;
  }

  /**
   * Update visualization configuration
   */
  updateConfig(newConfig: Partial<VisualizerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.p5Instance && newConfig.rendering?.frameRate) {
      this.p5Instance.frameRate(newConfig.rendering.frameRate);
    }
  }

  /**
   * Get current camera state
   */
  getCameraState(): CameraState {
    return { ...this.camera };
  }

  /**
   * Set camera state
   */
  setCameraState(state: Partial<CameraState>): void {
    this.camera = { ...this.camera, ...state };
  }

  /**
   * Reset camera to default position
   */
  resetCamera(): void {
    this.camera = {
      x: this.config.canvas.width / 2,
      y: this.config.canvas.height / 2,
      zoom: 1,
    };
  }

  /**
   * Get current frame rate
   */
  getFrameRate(): number {
    return this.frameStats.fps;
  }

  /**
   * Get definition extent statistics
   */
  private getDefinitionStats(): {
    complete: number;
    partial: number;
    missing: number;
  } {
    const allStates = this.definitionVisualizer.getAllDefinitionStates();
    let complete = 0;
    let partial = 0;
    let missing = 0;

    allStates.forEach(state => {
      if (state.isComplete) {
        complete++;
      } else if (state.completeness > 0) {
        partial++;
      } else {
        missing++;
      }
    });

    return { complete, partial, missing };
  }

  /**
   * Get definition visualizer instance
   */
  getDefinitionVisualizer(): AgentDefinitionVisualizer {
    return this.definitionVisualizer;
  }

  /**
   * Enable/disable heat map layer
   */
  toggleHeatMapLayer(layer: HeatMapLayer): boolean {
    return this.heatMapSystem.toggleLayer(layer);
  }

  /**
   * Enable/disable agent trails
   */
  toggleAgentTrails(enabled: boolean): void {
    this.trailSystem.updateConfig({ maxLength: enabled ? 50 : 0 });
  }

  /**
   * Create particle effect at position
   */
  createParticleEffect(type: ParticleEffectType, position: Position): string {
    return this.particleSystem.createEffect(type, position);
  }

  /**
   * Animate agent to new position
   */
  animateAgentToPosition(
    agentId: AgentId,
    newPosition: Position,
    duration: number = 1000
  ): void {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const currentPosition = agent.position;
    if (!currentPosition) return;

    this.animationEngine.animateAgentPosition(
      agentId,
      currentPosition.x,
      currentPosition.y,
      newPosition.x,
      newPosition.y,
      duration,
      undefined,
      (x: number, y: number) => {
        // Update agent position during animation
        if (this.environment) {
          this.environment.moveAgent(agent, { x, y } as Position);
        }
      }
    );
  }

  /**
   * Get animation engine instance
   */
  getAnimationEngine(): AnimationEngine {
    return this.animationEngine;
  }

  /**
   * Get trail system instance
   */
  getTrailSystem(): AgentTrailSystem {
    return this.trailSystem;
  }

  /**
   * Get heat map system instance
   */
  getHeatMapSystem(): HeatMapSystem {
    return this.heatMapSystem;
  }

  /**
   * Get particle system instance
   */
  getParticleSystem(): ParticleEffectsSystem {
    return this.particleSystem;
  }

  /**
   * Get combined performance statistics
   */
  getAdvancedStats(): {
    visualizer: { fps: number; agents: number; zoom: number };
    animation: any;
    trails: any;
    heatMaps: any;
    particles: any;
  } {
    return {
      visualizer: {
        fps: this.frameStats.fps,
        agents: this.agents.size,
        zoom: this.camera.zoom,
      },
      animation: this.animationEngine.getStats(),
      trails: this.trailSystem.getStats(),
      heatMaps: this.heatMapSystem.getStats(),
      particles: this.particleSystem.getStats(),
    };
  }

  /**
   * Destroy the visualizer and clean up resources
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    // Destroy all systems
    this.animationEngine.destroy();
    this.trailSystem.destroy();
    this.heatMapSystem.destroy();
    this.particleSystem.destroy();
    this.definitionVisualizer.clear();

    if (this.p5Instance) {
      this.p5Instance.remove();
      this.p5Instance = null;
    }

    this.agents.clear();
    this.environment = null;
    this.container = null;
  }
}
