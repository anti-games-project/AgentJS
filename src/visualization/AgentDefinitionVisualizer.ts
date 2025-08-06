/**
 * AgentDefinitionVisualizer - Real-time visualization of agent definition extent
 *
 * Shows agent definition progress in real-time during creation/modification,
 * not just when complete. Provides visual feedback for incomplete definitions.
 */

/// <reference path="../types/p5-global.d.ts" />
import type { Agent } from '../core/agents/Agent';
import type { Position } from '../types/core';

/** Configuration for definition visualization */
export interface DefinitionVisualizerConfig {
  readonly showIncomplete: boolean;
  readonly showProgress: boolean;
  readonly highlightMissing: boolean;
  readonly animateChanges: boolean;
  readonly opacity: {
    complete: number;
    incomplete: number;
    missing: number;
  };
}

/** Agent definition state tracking */
export interface AgentDefinitionState {
  readonly agentId: string;
  readonly completeness: number; // 0-1 scale
  readonly requiredProperties: string[];
  readonly definedProperties: string[];
  readonly missingProperties: string[];
  readonly lastModified: number;
  readonly isComplete: boolean;
}

/** Visual indicators for definition state */
export interface DefinitionVisuals {
  readonly borderColor: Color;
  readonly fillColor: Color;
  readonly strokeWeight: number;
  readonly size: number;
  readonly opacity: number;
  readonly showProgress: boolean;
  readonly progressColor: Color;
}

/**
 * AgentDefinitionVisualizer - Real-time agent definition visualization
 *
 * Features:
 * - Shows partial agent definitions during creation
 * - Visual completeness indicators (progress rings, opacity)
 * - Highlights missing required properties
 * - Animates property additions/modifications
 * - Supports live editing workflows
 *
 * Use Cases:
 * - Agent builder interfaces
 * - Live parameter tuning
 * - Definition validation feedback
 * - Educational scaffolding
 */
export class AgentDefinitionVisualizer {
  private config: DefinitionVisualizerConfig;
  private definitionStates: Map<string, AgentDefinitionState> = new Map();
  private animations: Map<string, number> = new Map(); // Animation timers

  /** Required properties for complete agent definition */
  private requiredProperties: string[] = [
    'autonomy',
    'resources',
    'socialCapital',
    'type',
    'vulnerability',
  ];

  constructor(config: Partial<DefinitionVisualizerConfig> = {}) {
    this.config = {
      showIncomplete: true,
      showProgress: true,
      highlightMissing: true,
      animateChanges: true,
      opacity: {
        complete: 255,
        incomplete: 180,
        missing: 100,
      },
      ...config,
    };
  }

  /**
   * Update definition state for an agent
   * Call whenever agent properties change
   */
  updateAgentDefinition(agent: Agent): void {
    const definedProperties = Object.keys(agent.getAllProperties());
    const missingProperties = this.requiredProperties.filter(
      prop => !definedProperties.includes(prop)
    );

    const completeness =
      definedProperties.length / this.requiredProperties.length;
    const isComplete = missingProperties.length === 0;

    const state: AgentDefinitionState = {
      agentId: agent.id,
      completeness: Math.min(1, completeness),
      requiredProperties: [...this.requiredProperties],
      definedProperties: [...definedProperties],
      missingProperties: [...missingProperties],
      lastModified: Date.now(),
      isComplete,
    };

    // Track state changes for animations
    const previousState = this.definitionStates.get(agent.id);
    if (previousState && previousState.completeness !== state.completeness) {
      this.triggerAnimation(agent.id);
    }

    this.definitionStates.set(agent.id, state);
  }

  /**
   * Remove agent from definition tracking
   */
  removeAgentDefinition(agentId: string): void {
    this.definitionStates.delete(agentId);
    this.animations.delete(agentId);
  }

  /**
   * Render agent with definition extent visualization
   */
  renderAgentWithDefinition(
    sketch: p5Instance,
    agent: Agent,
    position: Position,
    baseVisuals: any
  ): void {
    const definitionState = this.definitionStates.get(agent.id);
    if (!definitionState) {
      // Auto-track if not already tracked
      this.updateAgentDefinition(agent);
      return this.renderAgentWithDefinition(
        sketch,
        agent,
        position,
        baseVisuals
      );
    }

    // Skip incomplete agents if configured
    if (!this.config.showIncomplete && !definitionState.isComplete) {
      return;
    }

    const visuals = this.calculateDefinitionVisuals(
      sketch,
      definitionState,
      baseVisuals
    );

    sketch.push();
    sketch.translate(position.x, position.y);

    // Render base agent with definition-aware visuals
    this.renderAgentBase(sketch, agent, visuals);

    // Render definition-specific overlays
    if (this.config.showProgress) {
      this.renderProgressIndicator(sketch, definitionState, visuals);
    }

    if (this.config.highlightMissing && !definitionState.isComplete) {
      this.renderMissingPropertiesIndicator(sketch, definitionState, visuals);
    }

    // Render animation effects
    if (this.config.animateChanges) {
      this.renderAnimationEffects(sketch, agent.id, visuals);
    }

    sketch.pop();
  }

  /**
   * Calculate visual properties based on definition state
   */
  private calculateDefinitionVisuals(
    sketch: p5Instance,
    state: AgentDefinitionState,
    baseVisuals: any
  ): DefinitionVisuals {
    const completeness = state.completeness;

    // Base colors
    let borderColor: Color;
    let fillColor: Color;
    let opacity: number;

    if (state.isComplete) {
      borderColor = sketch.color(40, 167, 69); // Green - complete
      fillColor = baseVisuals.color || sketch.color(100, 150, 255);
      opacity = this.config.opacity.complete;
    } else if (completeness > 0.5) {
      borderColor = sketch.color(255, 165, 0); // Orange - partially complete
      fillColor = baseVisuals.color || sketch.color(100, 150, 255);
      opacity = this.config.opacity.incomplete;
    } else {
      borderColor = sketch.color(220, 53, 69); // Red - mostly incomplete
      fillColor = sketch.color(200, 200, 200); // Gray for incomplete
      opacity = this.config.opacity.missing;
    }

    // Progress indicator color
    const progressColor = sketch.color(40, 167, 69); // Green progress

    return {
      borderColor,
      fillColor,
      strokeWeight: state.isComplete ? 2 : 3,
      size: baseVisuals.size || 10,
      opacity,
      showProgress: this.config.showProgress,
      progressColor,
    };
  }

  /**
   * Render the base agent with definition-aware styling
   */
  private renderAgentBase(
    sketch: p5Instance,
    agent: Agent,
    visuals: DefinitionVisuals
  ): void {
    // Set fill with opacity
    const fillColor = sketch.color(
      sketch.red(visuals.fillColor),
      sketch.green(visuals.fillColor),
      sketch.blue(visuals.fillColor),
      visuals.opacity
    );
    sketch.fill(fillColor);

    // Set stroke
    sketch.stroke(visuals.borderColor);
    sketch.strokeWeight(visuals.strokeWeight);

    // Render shape based on agent type
    const agentType = agent.getProperty<string>('type') || 'default';
    const size = visuals.size;

    switch (agentType) {
      case 'leader':
      case 'influencer':
        // Triangle for leaders
        const h = size * 0.866;
        sketch.triangle(0, -h / 2, -size / 2, h / 2, size / 2, h / 2);
        break;
      case 'resource':
      case 'institution':
        // Square for resources
        sketch.rectMode(sketch.CENTER);
        sketch.square(0, 0, size);
        break;
      default:
        // Circle for community members
        sketch.circle(0, 0, size);
        break;
    }
  }

  /**
   * Render progress indicator around agent
   */
  private renderProgressIndicator(
    sketch: p5Instance,
    state: AgentDefinitionState,
    visuals: DefinitionVisuals
  ): void {
    if (!visuals.showProgress || state.isComplete) return;

    const radius = visuals.size * 0.8;
    const progressAngle = state.completeness * sketch.TWO_PI;

    sketch.push();
    sketch.noFill();
    sketch.stroke(visuals.progressColor);
    sketch.strokeWeight(2);

    // Progress arc
    sketch.arc(
      0,
      0,
      radius,
      radius,
      -sketch.HALF_PI,
      -sketch.HALF_PI + progressAngle
    );

    // Background arc (remaining progress)
    sketch.stroke(100, 100, 100, 100);
    sketch.strokeWeight(1);
    sketch.arc(
      0,
      0,
      radius,
      radius,
      -sketch.HALF_PI + progressAngle,
      -sketch.HALF_PI + sketch.TWO_PI
    );

    sketch.pop();
  }

  /**
   * Render indicator for missing properties
   */
  private renderMissingPropertiesIndicator(
    sketch: p5Instance,
    state: AgentDefinitionState,
    visuals: DefinitionVisuals
  ): void {
    if (state.missingProperties.length === 0) return;

    const radius = visuals.size * 0.6;
    const missingCount = state.missingProperties.length;

    sketch.push();

    // Pulsing warning indicator
    const pulseTime = Date.now() * 0.005;
    const pulseAlpha = sketch.map(sketch.sin(pulseTime), -1, 1, 50, 150);

    sketch.fill(220, 53, 69, pulseAlpha); // Red with pulsing alpha
    sketch.noStroke();

    // Small warning indicators around the agent
    for (let i = 0; i < missingCount; i++) {
      const angle = (i / missingCount) * sketch.TWO_PI;
      const x = sketch.cos(angle) * radius;
      const y = sketch.sin(angle) * radius;

      sketch.push();
      sketch.translate(x, y);
      sketch.triangle(0, -3, -2, 2, 2, 2); // Small warning triangle
      sketch.pop();
    }

    sketch.pop();
  }

  /**
   * Render animation effects for recent changes
   */
  private renderAnimationEffects(
    sketch: p5Instance,
    agentId: string,
    visuals: DefinitionVisuals
  ): void {
    const animationTime = this.animations.get(agentId);
    if (!animationTime) return;

    const elapsed = Date.now() - animationTime;
    const duration = 1000; // 1 second animation

    if (elapsed > duration) {
      this.animations.delete(agentId);
      return;
    }

    const progress = elapsed / duration;
    const easeOut = 1 - Math.pow(1 - progress, 3);

    // Expanding ring animation
    const ringRadius = visuals.size * (1 + easeOut * 0.5);
    const ringAlpha = (1 - easeOut) * 100;

    sketch.push();
    sketch.noFill();
    sketch.stroke(40, 167, 69, ringAlpha); // Green ring
    sketch.strokeWeight(2);
    sketch.circle(0, 0, ringRadius);
    sketch.pop();
  }

  /**
   * Trigger animation for property change
   */
  private triggerAnimation(agentId: string): void {
    if (this.config.animateChanges) {
      this.animations.set(agentId, Date.now());
    }
  }

  /**
   * Get definition state for an agent
   */
  getDefinitionState(agentId: string): AgentDefinitionState | undefined {
    return this.definitionStates.get(agentId);
  }

  /**
   * Get all tracked definition states
   */
  getAllDefinitionStates(): Map<string, AgentDefinitionState> {
    return new Map(this.definitionStates);
  }

  /**
   * Set required properties for complete definition
   */
  setRequiredProperties(properties: string[]): void {
    this.requiredProperties = [...properties];
    // Recalculate all states
    this.definitionStates.forEach((_state, agentId) => {
      // This will trigger recalculation on next render
      this.definitionStates.delete(agentId);
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DefinitionVisualizerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear all tracked states
   */
  clear(): void {
    this.definitionStates.clear();
    this.animations.clear();
  }
}
