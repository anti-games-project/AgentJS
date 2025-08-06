/**
 * InputManager - Handles mouse, keyboard, and touch input for visualization
 */

import { EventEmitter } from 'eventemitter3';
import type { Agent } from '../core/agents/Agent';
import type { AgentId, Position } from '../types/core';
import type { Camera } from './Camera';

/** Input configuration */
export interface InputConfig {
  readonly mouse: {
    enableSelection: boolean;
    enableDragging: boolean;
    dragThreshold: number;
  };
  readonly keyboard: {
    enableShortcuts: boolean;
    shortcuts: Map<string, string>;
  };
  readonly touch: {
    enableGestures: boolean;
    pinchSensitivity: number;
  };
}

/** Selection rectangle */
export interface SelectionRect {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

/** Input event types */
export interface InputEvents {
  agentSelected: { agent: Agent; position: Position };
  agentDeselected: { agent: Agent };
  multipleSelected: { agents: Agent[] };
  selectionCleared: void;
  dragStart: { startPos: Position };
  dragEnd: { endPos: Position };
  contextMenu: { position: Position; agent?: Agent };
}

/**
 * InputManager - Comprehensive input handling system
 *
 * Features:
 * - Mouse click and drag handling
 * - Agent selection (single and multi-select)
 * - Keyboard shortcuts
 * - Touch gesture preparation
 * - Context menu support
 *
 * Educational Context: Enables interactive exploration
 * of agent simulations through direct manipulation.
 */
export class InputManager extends EventEmitter<InputEvents> {
  /** Input configuration */
  private config: InputConfig;

  /** Reference to camera for coordinate conversion */
  private camera: Camera;

  /** Map of agents for selection */
  private agents: Map<AgentId, Agent> = new Map();

  /** Currently selected agents */
  private selectedAgents: Set<AgentId> = new Set();

  /** Mouse state */
  private mouseState = {
    isDown: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    button: 0,
    isDragging: false,
  };

  /** Selection rectangle for multi-select */
  private selectionRect: SelectionRect | null = null;

  /** Keyboard state */
  private keyState: Set<string> = new Set();

  /** Canvas element for event binding */
  private canvas: HTMLElement | null = null;

  /** Bound event handlers for cleanup */
  private boundHandlers: Map<string, EventListener> = new Map();

  constructor(camera: Camera, config: Partial<InputConfig> = {}) {
    super();

    this.camera = camera;
    this.config = {
      mouse: {
        enableSelection: true,
        enableDragging: true,
        dragThreshold: 5,
      },
      keyboard: {
        enableShortcuts: true,
        shortcuts: new Map([
          ['KeyR', 'resetCamera'],
          ['KeyA', 'selectAll'],
          ['Escape', 'clearSelection'],
          ['Delete', 'deleteSelected'],
        ]),
      },
      touch: {
        enableGestures: true,
        pinchSensitivity: 0.1,
      },
      ...config,
    };
  }

  /**
   * Initialize input handling with canvas element
   */
  initialize(canvasElement: HTMLElement): void {
    this.canvas = canvasElement;
    this.bindEvents();
  }

  /**
   * Bind all input event handlers
   */
  private bindEvents(): void {
    if (!this.canvas) return;

    // Mouse events
    this.addHandler('mousedown', e => this.handleMouseDown(e as MouseEvent));
    this.addHandler('mousemove', e => this.handleMouseMove(e as MouseEvent));
    this.addHandler('mouseup', e => this.handleMouseUp(e as MouseEvent));
    this.addHandler('wheel', e => this.handleWheel(e as WheelEvent));
    this.addHandler('contextmenu', e =>
      this.handleContextMenu(e as MouseEvent)
    );

    // Keyboard events (on document for global capture)
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    document.addEventListener('keyup', this.handleKeyUp.bind(this));

    // Touch events for mobile support
    if (this.config.touch.enableGestures) {
      this.addHandler('touchstart', e =>
        this.handleTouchStart(e as TouchEvent)
      );
      this.addHandler('touchmove', e => this.handleTouchMove(e as TouchEvent));
      this.addHandler('touchend', e => this.handleTouchEnd(e as TouchEvent));
    }
  }

  /**
   * Add event handler with cleanup tracking
   */
  private addHandler(event: string, handler: EventListener): void {
    if (!this.canvas) return;

    this.canvas.addEventListener(event, handler);
    this.boundHandlers.set(event, handler);
  }

  /**
   * Handle mouse down events
   */
  private handleMouseDown(event: MouseEvent): void {
    if (!this.canvas) return;

    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    this.mouseState = {
      isDown: true,
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
      button: event.button,
      isDragging: false,
    };

    // Handle camera dragging (right click or middle click)
    if (event.button === 2 || event.button === 1) {
      this.camera.handleMousePress(
        this.mouseState.currentX,
        this.mouseState.currentY
      );
      return;
    }

    // Handle selection start (left click)
    if (event.button === 0 && this.config.mouse.enableSelection) {
      this.startSelection(
        this.mouseState.startX,
        this.mouseState.startY,
        event.ctrlKey || event.metaKey
      );
    }
  }

  /**
   * Handle mouse move events
   */
  private handleMouseMove(event: MouseEvent): void {
    if (!this.canvas || !this.mouseState.isDown) return;

    const rect = this.canvas.getBoundingClientRect();
    this.mouseState.currentX = event.clientX - rect.left;
    this.mouseState.currentY = event.clientY - rect.top;

    // Check if dragging threshold is exceeded
    const dragDistance = Math.sqrt(
      Math.pow(this.mouseState.currentX - this.mouseState.startX, 2) +
        Math.pow(this.mouseState.currentY - this.mouseState.startY, 2)
    );

    if (dragDistance > this.config.mouse.dragThreshold) {
      this.mouseState.isDragging = true;
    }

    // Handle camera dragging
    if (this.mouseState.button === 2 || this.mouseState.button === 1) {
      this.camera.handleMouseDrag(
        this.mouseState.currentX,
        this.mouseState.currentY
      );
      return;
    }

    // Handle selection rectangle
    if (
      this.mouseState.button === 0 &&
      this.mouseState.isDragging &&
      this.config.mouse.enableSelection
    ) {
      this.updateSelectionRect();
    }
  }

  /**
   * Handle mouse up events
   */
  private handleMouseUp(event: MouseEvent): void {
    if (!this.mouseState.isDown) return;

    // Handle camera drag end
    if (this.mouseState.button === 2 || this.mouseState.button === 1) {
      this.camera.handleMouseRelease();
    }

    // Handle selection completion
    if (this.mouseState.button === 0 && this.config.mouse.enableSelection) {
      if (this.mouseState.isDragging) {
        this.completeRectangleSelection(event.ctrlKey || event.metaKey);
      } else {
        this.handleSingleClick(
          this.mouseState.startX,
          this.mouseState.startY,
          event.ctrlKey || event.metaKey
        );
      }
    }

    // Reset mouse state
    this.mouseState.isDown = false;
    this.mouseState.isDragging = false;
    this.selectionRect = null;
  }

  /**
   * Handle mouse wheel events
   */
  private handleWheel(event: WheelEvent): void {
    if (!this.canvas) return;

    event.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    this.camera.handleMouseWheel(mouseX, mouseY, event.deltaY);
  }

  /**
   * Handle context menu events
   */
  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();

    if (!this.canvas) return;

    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const worldPos = this.camera.screenToWorld(mouseX, mouseY);
    const agent = this.findAgentAtPosition(worldPos);

    this.emit('contextMenu', { position: worldPos, agent });
  }

  /**
   * Handle keyboard down events
   */
  private handleKeyDown(event: KeyboardEvent): void {
    if (!this.config.keyboard.enableShortcuts) return;

    this.keyState.add(event.code);

    const action = this.config.keyboard.shortcuts.get(event.code);
    if (action) {
      event.preventDefault();
      this.executeKeyboardAction(action);
    }
  }

  /**
   * Handle keyboard up events
   */
  private handleKeyUp(event: KeyboardEvent): void {
    this.keyState.delete(event.code);
  }

  /**
   * Execute keyboard action
   */
  private executeKeyboardAction(action: string): void {
    switch (action) {
      case 'resetCamera':
        this.camera.reset();
        break;
      case 'selectAll':
        this.selectAllAgents();
        break;
      case 'clearSelection':
        this.clearSelection();
        break;
      case 'deleteSelected':
        // Emit event for external handling
        break;
    }
  }

  /**
   * Handle touch start events
   */
  private handleTouchStart(event: TouchEvent): void {
    // Basic touch support - can be expanded for gestures
    if (event.touches.length === 1) {
      const touch = event.touches[0]!;
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
      });
      this.handleMouseDown(mouseEvent);
    }
  }

  /**
   * Handle touch move events
   */
  private handleTouchMove(event: TouchEvent): void {
    event.preventDefault();

    if (event.touches.length === 1) {
      const touch = event.touches[0]!;
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
      });
      this.handleMouseMove(mouseEvent);
    }
    // TODO: Handle pinch gestures for zooming
  }

  /**
   * Handle touch end events
   */
  private handleTouchEnd(_event: TouchEvent): void {
    const mouseEvent = new MouseEvent('mouseup', {
      button: 0,
    });
    this.handleMouseUp(mouseEvent);
  }

  /**
   * Start selection process
   */
  private startSelection(x: number, y: number, multiSelect: boolean): void {
    if (!multiSelect) {
      this.clearSelection();
    }

    this.selectionRect = {
      startX: x,
      startY: y,
      endX: x,
      endY: y,
    };
  }

  /**
   * Update selection rectangle
   */
  private updateSelectionRect(): void {
    if (!this.selectionRect) return;

    this.selectionRect.endX = this.mouseState.currentX;
    this.selectionRect.endY = this.mouseState.currentY;
  }

  /**
   * Complete rectangle selection
   */
  private completeRectangleSelection(multiSelect: boolean): void {
    if (!this.selectionRect) return;

    const selectedAgents = this.findAgentsInRectangle(this.selectionRect);

    if (multiSelect) {
      selectedAgents.forEach(agent => this.addToSelection(agent));
    } else {
      this.setSelection(selectedAgents);
    }

    if (selectedAgents.length > 0) {
      this.emit('multipleSelected', { agents: selectedAgents });
    }

    this.selectionRect = null;
  }

  /**
   * Handle single click selection
   */
  private handleSingleClick(x: number, y: number, multiSelect: boolean): void {
    const worldPos = this.camera.screenToWorld(x, y);
    const agent = this.findAgentAtPosition(worldPos);

    if (agent) {
      if (multiSelect) {
        this.toggleSelection(agent);
      } else {
        this.setSelection([agent]);
      }

      this.emit('agentSelected', { agent, position: worldPos });
    } else if (!multiSelect) {
      this.clearSelection();
    }
  }

  /**
   * Find agent at world position
   */
  private findAgentAtPosition(worldPos: Position): Agent | null {
    const tolerance = 10 / this.camera.getZoom(); // Adjust tolerance based on zoom

    for (const agent of this.agents.values()) {
      // This would need to be implemented based on how positions are stored
      // For now, assume agents have a position property
      const agentPos = (agent as any).position as Position;
      if (agentPos) {
        const distance = Math.sqrt(
          Math.pow(worldPos.x - agentPos.x, 2) +
            Math.pow(worldPos.y - agentPos.y, 2)
        );

        if (distance <= tolerance) {
          return agent;
        }
      }
    }

    return null;
  }

  /**
   * Find agents within rectangle
   */
  private findAgentsInRectangle(rect: SelectionRect): Agent[] {
    const minX = Math.min(rect.startX, rect.endX);
    const maxX = Math.max(rect.startX, rect.endX);
    const minY = Math.min(rect.startY, rect.endY);
    const maxY = Math.max(rect.startY, rect.endY);

    const selectedAgents: Agent[] = [];

    for (const agent of this.agents.values()) {
      const agentPos = (agent as any).position as Position;
      if (agentPos) {
        const screenPos = this.camera.worldToScreen(agentPos.x, agentPos.y);

        if (
          screenPos.x >= minX &&
          screenPos.x <= maxX &&
          screenPos.y >= minY &&
          screenPos.y <= maxY
        ) {
          selectedAgents.push(agent);
        }
      }
    }

    return selectedAgents;
  }

  /**
   * Set agents map for selection
   */
  setAgents(agents: Map<AgentId, Agent>): void {
    this.agents = agents;
  }

  /**
   * Add agent to selection
   */
  private addToSelection(agent: Agent): void {
    this.selectedAgents.add(agent.id);
  }

  /**
   * Remove agent from selection
   */
  private removeFromSelection(agent: Agent): void {
    this.selectedAgents.delete(agent.id);
    this.emit('agentDeselected', { agent });
  }

  /**
   * Toggle agent selection
   */
  private toggleSelection(agent: Agent): void {
    if (this.selectedAgents.has(agent.id)) {
      this.removeFromSelection(agent);
    } else {
      this.addToSelection(agent);
    }
  }

  /**
   * Set selection to specific agents
   */
  private setSelection(agents: Agent[]): void {
    this.clearSelection();
    agents.forEach(agent => this.addToSelection(agent));
  }

  /**
   * Select all agents
   */
  private selectAllAgents(): void {
    const allAgents = Array.from(this.agents.values());
    this.setSelection(allAgents);
    this.emit('multipleSelected', { agents: allAgents });
  }

  /**
   * Clear all selections
   */
  clearSelection(): void {
    this.selectedAgents.clear();
    this.emit('selectionCleared');
  }

  /**
   * Get currently selected agents
   */
  getSelectedAgents(): Agent[] {
    return Array.from(this.selectedAgents)
      .map(id => this.agents.get(id))
      .filter((agent): agent is Agent => agent !== undefined);
  }

  /**
   * Check if agent is selected
   */
  isSelected(agent: Agent): boolean {
    return this.selectedAgents.has(agent.id);
  }

  /**
   * Get current selection rectangle for rendering
   */
  getSelectionRect(): SelectionRect | null {
    return this.selectionRect;
  }

  /**
   * Update input configuration
   */
  updateConfig(newConfig: Partial<InputConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    // Remove canvas event listeners
    if (this.canvas) {
      for (const [event, handler] of this.boundHandlers) {
        this.canvas.removeEventListener(event, handler);
      }
    }

    // Remove document event listeners
    document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.removeEventListener('keyup', this.handleKeyUp.bind(this));

    this.boundHandlers.clear();
    this.selectedAgents.clear();
    this.keyState.clear();
    this.canvas = null;
  }
}
