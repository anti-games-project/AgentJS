import { SimulationController, SimulationState } from './SimulationController';
import type { ParameterManager } from './ParameterManager';

/**
 * Control panel configuration
 */
export interface ControlPanelConfig {
  container: HTMLElement;
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  theme?: 'light' | 'dark';
  collapsible?: boolean;
  showPerformanceStats?: boolean;
  showParameterControls?: boolean;
}

/**
 * Control panel theme styles
 */
interface ThemeStyles {
  background: string;
  text: string;
  border: string;
  button: string;
  buttonHover: string;
  buttonActive: string;
  slider: string;
  sliderThumb: string;
}

/**
 * HTML/CSS control panel for simulation management
 */
export class ControlPanel {
  private controller: SimulationController;
  private parameterManager?: ParameterManager;
  private config: Required<ControlPanelConfig>;
  private container: HTMLElement;
  private panelElement!: HTMLDivElement;
  private isCollapsed: boolean = false;
  private updateInterval: number | null = null;

  private elements: {
    playButton: HTMLButtonElement;
    pauseButton: HTMLButtonElement;
    resetButton: HTMLButtonElement;
    stepButton: HTMLButtonElement;
    speedSlider: HTMLInputElement;
    speedDisplay: HTMLSpanElement;
    fpsSlider: HTMLInputElement;
    fpsDisplay: HTMLSpanElement;
    stepDisplay: HTMLSpanElement;
    performanceDisplay?: HTMLDivElement;
    parameterContainer?: HTMLDivElement;
    collapseButton?: HTMLButtonElement;
  } = {} as any;

  private themes: Record<'light' | 'dark', ThemeStyles> = {
    light: {
      background: '#ffffff',
      text: '#333333',
      border: '#dddddd',
      button: '#f0f0f0',
      buttonHover: '#e0e0e0',
      buttonActive: '#4CAF50',
      slider: '#dddddd',
      sliderThumb: '#4CAF50'
    },
    dark: {
      background: '#2a2a2a',
      text: '#ffffff',
      border: '#444444',
      button: '#3a3a3a',
      buttonHover: '#4a4a4a',
      buttonActive: '#4CAF50',
      slider: '#444444',
      sliderThumb: '#4CAF50'
    }
  };

  constructor(controller: SimulationController, config: ControlPanelConfig) {
    this.controller = controller;
    this.config = {
      position: config.position || 'top-right',
      theme: config.theme || 'light',
      collapsible: config.collapsible ?? true,
      showPerformanceStats: config.showPerformanceStats ?? true,
      showParameterControls: config.showParameterControls ?? true,
      container: config.container
    };
    this.container = config.container;

    this.createPanel();
    this.attachEventListeners();
    this.applyTheme();
    this.startUpdateLoop();
  }

  /**
   * Set parameter manager for dynamic controls
   */
  setParameterManager(parameterManager: ParameterManager): void {
    this.parameterManager = parameterManager;
    if (this.config.showParameterControls && this.elements.parameterContainer) {
      this.createParameterControls();
    }
  }

  /**
   * Create the control panel HTML structure
   */
  private createPanel(): void {
    // Create main panel container
    this.panelElement = document.createElement('div');
    this.panelElement.className = 'agentjs-control-panel';
    this.panelElement.innerHTML = `
      <div class="panel-header">
        <h3>Simulation Controls</h3>
        ${this.config.collapsible ? '<button class="collapse-btn">−</button>' : ''}
      </div>
      <div class="panel-content">
        <div class="control-section">
          <div class="button-group">
            <button class="control-btn play-btn" title="Play">▶</button>
            <button class="control-btn pause-btn" title="Pause">⏸</button>
            <button class="control-btn step-btn" title="Step">⏭</button>
            <button class="control-btn reset-btn" title="Reset">⏹</button>
          </div>
        </div>
        
        <div class="control-section">
          <label>
            Speed: <span class="speed-display">1.0x</span>
            <input type="range" class="speed-slider" min="0.1" max="10" step="0.1" value="1">
          </label>
        </div>
        
        <div class="control-section">
          <label>
            Target FPS: <span class="fps-display">60</span>
            <input type="range" class="fps-slider" min="1" max="120" step="1" value="60">
          </label>
        </div>
        
        <div class="control-section">
          <div class="info-display">
            Step: <span class="step-display">0</span>
          </div>
        </div>
        
        ${this.config.showPerformanceStats ? `
        <div class="control-section performance-section">
          <h4>Performance</h4>
          <div class="performance-display"></div>
        </div>
        ` : ''}
        
        ${this.config.showParameterControls ? `
        <div class="control-section parameter-section">
          <h4>Parameters</h4>
          <div class="parameter-container"></div>
        </div>
        ` : ''}
      </div>
    `;

    // Add CSS styles
    this.addStyles();

    // Position the panel
    this.positionPanel();

    // Add to container
    this.container.appendChild(this.panelElement);

    // Get element references
    this.elements.playButton = this.panelElement.querySelector('.play-btn')!;
    this.elements.pauseButton = this.panelElement.querySelector('.pause-btn')!;
    this.elements.resetButton = this.panelElement.querySelector('.reset-btn')!;
    this.elements.stepButton = this.panelElement.querySelector('.step-btn')!;
    this.elements.speedSlider = this.panelElement.querySelector('.speed-slider')!;
    this.elements.speedDisplay = this.panelElement.querySelector('.speed-display')!;
    this.elements.fpsSlider = this.panelElement.querySelector('.fps-slider')!;
    this.elements.fpsDisplay = this.panelElement.querySelector('.fps-display')!;
    this.elements.stepDisplay = this.panelElement.querySelector('.step-display')!;

    if (this.config.showPerformanceStats) {
      this.elements.performanceDisplay = this.panelElement.querySelector('.performance-display')!;
    }

    if (this.config.showParameterControls) {
      this.elements.parameterContainer = this.panelElement.querySelector('.parameter-container')!;
    }

    if (this.config.collapsible) {
      this.elements.collapseButton = this.panelElement.querySelector('.collapse-btn')!;
    }

    // Update initial state
    this.updateButtonStates();
  }

  /**
   * Add CSS styles to the document
   */
  private addStyles(): void {
    if (document.getElementById('agentjs-control-panel-styles')) {
      return; // Styles already added
    }

    const styleElement = document.createElement('style');
    styleElement.id = 'agentjs-control-panel-styles';
    styleElement.textContent = `
      .agentjs-control-panel {
        position: absolute;
        width: 300px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        z-index: 1000;
        transition: all 0.3s ease;
      }

      .agentjs-control-panel.collapsed {
        height: auto !important;
      }

      .agentjs-control-panel.collapsed .panel-content {
        display: none;
      }

      .panel-header {
        padding: 12px 16px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
        cursor: move;
      }

      .panel-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .collapse-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
      }

      .panel-content {
        padding: 16px;
      }

      .control-section {
        margin-bottom: 16px;
      }

      .control-section:last-child {
        margin-bottom: 0;
      }

      .control-section h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
      }

      .button-group {
        display: flex;
        gap: 8px;
      }

      .control-btn {
        flex: 1;
        padding: 8px;
        border: none;
        border-radius: 4px;
        font-size: 16px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .control-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .control-btn.active {
        font-weight: bold;
      }

      label {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      input[type="range"] {
        width: 100%;
        height: 6px;
        border-radius: 3px;
        outline: none;
        -webkit-appearance: none;
        appearance: none;
      }

      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        cursor: pointer;
      }

      input[type="range"]::-moz-range-thumb {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        cursor: pointer;
        border: none;
      }

      .info-display {
        padding: 8px;
        border-radius: 4px;
        font-family: monospace;
      }

      .performance-display {
        font-family: monospace;
        font-size: 12px;
        line-height: 1.6;
      }

      .parameter-control {
        margin-bottom: 12px;
      }

      .parameter-control label {
        font-size: 12px;
        margin-bottom: 4px;
      }

      .parameter-value {
        font-family: monospace;
        font-size: 12px;
        margin-left: 8px;
      }

      /* Position-specific styles */
      .agentjs-control-panel.top-left {
        top: 20px;
        left: 20px;
      }

      .agentjs-control-panel.top-right {
        top: 20px;
        right: 20px;
      }

      .agentjs-control-panel.bottom-left {
        bottom: 20px;
        left: 20px;
      }

      .agentjs-control-panel.bottom-right {
        bottom: 20px;
        right: 20px;
      }
    `;

    document.head.appendChild(styleElement);
  }

  /**
   * Apply theme colors
   */
  private applyTheme(): void {
    const theme = this.themes[this.config.theme];
    const panel = this.panelElement;

    panel.style.backgroundColor = theme.background;
    panel.style.color = theme.text;
    panel.style.border = `1px solid ${theme.border}`;

    // Style header
    const header = panel.querySelector('.panel-header') as HTMLElement;
    header.style.backgroundColor = theme.button;
    header.style.borderBottom = `1px solid ${theme.border}`;

    // Style buttons
    const buttons = panel.querySelectorAll('.control-btn, .collapse-btn');
    buttons.forEach((btn) => {
      const button = btn as HTMLButtonElement;
      button.style.backgroundColor = theme.button;
      button.style.color = theme.text;

      button.addEventListener('mouseenter', () => {
        if (!button.disabled && !button.classList.contains('active')) {
          button.style.backgroundColor = theme.buttonHover;
        }
      });

      button.addEventListener('mouseleave', () => {
        if (!button.classList.contains('active')) {
          button.style.backgroundColor = theme.button;
        }
      });
    });

    // Style sliders
    const sliders = panel.querySelectorAll('input[type="range"]');
    sliders.forEach((slider) => {
      const input = slider as HTMLInputElement;
      input.style.backgroundColor = theme.slider;
      
      // Browser-specific thumb styling
      input.style.setProperty('--thumb-color', theme.sliderThumb);
    });

    // Style info displays
    const infoDisplay = panel.querySelector('.info-display') as HTMLElement;
    if (infoDisplay) {
      infoDisplay.style.backgroundColor = theme.button;
      infoDisplay.style.border = `1px solid ${theme.border}`;
    }
  }

  /**
   * Position the panel based on config
   */
  private positionPanel(): void {
    this.panelElement.className = `agentjs-control-panel ${this.config.position}`;
  }

  /**
   * Attach event listeners to controls
   */
  private attachEventListeners(): void {
    // Button events
    this.elements.playButton.addEventListener('click', () => this.controller.play());
    this.elements.pauseButton.addEventListener('click', () => this.controller.pause());
    this.elements.resetButton.addEventListener('click', () => this.controller.reset());
    this.elements.stepButton.addEventListener('click', () => this.controller.step());

    // Slider events
    this.elements.speedSlider.addEventListener('input', (e) => {
      const value = parseFloat((e.target as HTMLInputElement).value);
      this.controller.setSpeed(value);
      this.elements.speedDisplay.textContent = `${value.toFixed(1)}x`;
    });

    this.elements.fpsSlider.addEventListener('input', (e) => {
      const value = parseInt((e.target as HTMLInputElement).value);
      this.controller.setTargetFPS(value);
      this.elements.fpsDisplay.textContent = value.toString();
    });

    // Collapse button
    if (this.elements.collapseButton) {
      this.elements.collapseButton.addEventListener('click', () => {
        this.isCollapsed = !this.isCollapsed;
        this.panelElement.classList.toggle('collapsed', this.isCollapsed);
        this.elements.collapseButton!.textContent = this.isCollapsed ? '+' : '−';
      });
    }

    // Controller events
    this.controller.on('state:changed', () => this.updateButtonStates());
    this.controller.on('step:complete', (step) => {
      this.elements.stepDisplay.textContent = step.toString();
    });

    // Make panel draggable
    this.makeDraggable();
  }

  /**
   * Make the panel draggable
   */
  private makeDraggable(): void {
    const header = this.panelElement.querySelector('.panel-header') as HTMLElement;
    let isDragging = false;
    let currentX: number;
    let currentY: number;
    let initialX: number;
    let initialY: number;

    header.addEventListener('mousedown', (e) => {
      if ((e.target as HTMLElement).classList.contains('collapse-btn')) {
        return;
      }

      isDragging = true;
      initialX = e.clientX - this.panelElement.offsetLeft;
      initialY = e.clientY - this.panelElement.offsetTop;
      header.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;

      this.panelElement.style.left = `${currentX}px`;
      this.panelElement.style.top = `${currentY}px`;
      this.panelElement.style.right = 'auto';
      this.panelElement.style.bottom = 'auto';
    });

    document.addEventListener('mouseup', () => {
      isDragging = false;
      header.style.cursor = 'move';
    });
  }

  /**
   * Update button states based on simulation state
   */
  private updateButtonStates(): void {
    const state = this.controller.getState();
    const theme = this.themes[this.config.theme];

    // Reset all buttons
    [this.elements.playButton, this.elements.pauseButton].forEach(btn => {
      btn.classList.remove('active');
      btn.style.backgroundColor = theme.button;
    });

    // Update based on state
    switch (state) {
      case SimulationState.RUNNING:
        this.elements.playButton.classList.add('active');
        this.elements.playButton.style.backgroundColor = theme.buttonActive;
        this.elements.playButton.disabled = true;
        this.elements.pauseButton.disabled = false;
        this.elements.stepButton.disabled = true;
        break;
      case SimulationState.PAUSED:
        this.elements.pauseButton.classList.add('active');
        this.elements.pauseButton.style.backgroundColor = theme.buttonActive;
        this.elements.playButton.disabled = false;
        this.elements.pauseButton.disabled = true;
        this.elements.stepButton.disabled = false;
        break;
      case SimulationState.IDLE:
        this.elements.playButton.disabled = false;
        this.elements.pauseButton.disabled = true;
        this.elements.stepButton.disabled = false;
        break;
    }
  }

  /**
   * Create parameter controls dynamically
   */
  private createParameterControls(): void {
    if (!this.parameterManager || !this.elements.parameterContainer) {
      return;
    }

    // This will be implemented when ParameterManager is created
    // For now, placeholder
    this.elements.parameterContainer.innerHTML = '<p style="font-size: 12px; opacity: 0.7;">No parameters registered</p>';
  }

  /**
   * Start the update loop for performance stats
   */
  private startUpdateLoop(): void {
    if (!this.config.showPerformanceStats) {
      return;
    }

    this.updateInterval = window.setInterval(() => {
      this.updatePerformanceDisplay();
    }, 1000);
  }

  /**
   * Update performance display
   */
  private updatePerformanceDisplay(): void {
    if (!this.elements.performanceDisplay) {
      return;
    }

    const stats = this.controller.getPerformanceStats();
    this.elements.performanceDisplay.innerHTML = `
      FPS: ${stats.actualFPS.toFixed(1)}<br>
      Steps/s: ${stats.stepsPerSecond.toFixed(1)}<br>
      Frame: ${stats.frameTime.toFixed(1)}ms<br>
      Step: ${stats.stepTime.toFixed(2)}ms
    `;
  }

  /**
   * Set theme
   */
  setTheme(theme: 'light' | 'dark'): void {
    this.config.theme = theme;
    this.applyTheme();
  }

  /**
   * Show the panel
   */
  show(): void {
    this.panelElement.style.display = 'block';
  }

  /**
   * Hide the panel
   */
  hide(): void {
    this.panelElement.style.display = 'none';
  }

  /**
   * Destroy the control panel
   */
  destroy(): void {
    if (this.updateInterval !== null) {
      clearInterval(this.updateInterval);
    }

    this.controller.removeAllListeners();
    this.panelElement.remove();

    // Remove styles if no other panels exist
    const otherPanels = document.querySelectorAll('.agentjs-control-panel');
    if (otherPanels.length === 0) {
      const styleElement = document.getElementById('agentjs-control-panel-styles');
      styleElement?.remove();
    }
  }
}

/**
 * Factory function for creating control panels
 */
export function createControlPanel(
  controller: SimulationController,
  config: ControlPanelConfig
): ControlPanel {
  return new ControlPanel(controller, config);
}