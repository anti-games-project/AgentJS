/**
 * Camera - Interactive camera system for visualization
 */

import type { Position } from '../types/core';

/** Camera configuration */
export interface CameraConfig {
  readonly bounds?:
    | {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
      }
    | undefined;
  readonly zoom: {
    min: number;
    max: number;
    sensitivity: number;
  };
  readonly pan: {
    enabled: boolean;
    sensitivity: number;
    smoothing: number;
  };
  readonly viewport: {
    width: number;
    height: number;
  };
}

/** Camera transformation state */
export interface CameraTransform {
  x: number;
  y: number;
  zoom: number;
  targetX: number;
  targetY: number;
  targetZoom: number;
}

/**
 * Camera - Advanced camera system with smooth controls
 *
 * Features:
 * - Smooth pan and zoom with easing
 * - Viewport bounds constraining
 * - Screen-to-world coordinate conversion
 * - Performance-optimized viewport culling
 * - Touch gesture support preparation
 *
 * Educational Context: Provides intuitive navigation
 * of large agent simulations with smooth interactions.
 */
export class Camera {
  /** Camera configuration */
  private config: CameraConfig;

  /** Current camera state */
  private transform: CameraTransform;

  /** Previous mouse position for dragging */
  private previousMouse: { x: number; y: number } = { x: 0, y: 0 };

  /** Whether camera is currently being dragged */
  private isDragging = false;

  /** Animation frame ID for smooth transitions */
  private animationId: number | null = null;

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = {
      bounds: undefined,
      zoom: {
        min: 0.1,
        max: 5.0,
        sensitivity: 0.1,
      },
      pan: {
        enabled: true,
        sensitivity: 1.0,
        smoothing: 0.15,
      },
      viewport: {
        width: 800,
        height: 600,
      },
      ...config,
    };

    // Initialize camera at center of viewport
    const centerX = this.config.viewport.width / 2;
    const centerY = this.config.viewport.height / 2;

    this.transform = {
      x: centerX,
      y: centerY,
      zoom: 1.0,
      targetX: centerX,
      targetY: centerY,
      targetZoom: 1.0,
    };

    this.startAnimation();
  }

  /**
   * Start smooth animation loop
   */
  private startAnimation(): void {
    const animate = () => {
      this.updateSmoothing();
      this.animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  /**
   * Update smooth camera transitions
   */
  private updateSmoothing(): void {
    const smoothing = this.config.pan.smoothing;

    // Smooth position interpolation
    this.transform.x += (this.transform.targetX - this.transform.x) * smoothing;
    this.transform.y += (this.transform.targetY - this.transform.y) * smoothing;
    this.transform.zoom +=
      (this.transform.targetZoom - this.transform.zoom) * smoothing;

    // Apply bounds constraints
    this.constrainToBounds();
  }

  /**
   * Pan camera by delta amount
   */
  pan(deltaX: number, deltaY: number): void {
    if (!this.config.pan.enabled) return;

    const sensitivity = this.config.pan.sensitivity;

    this.transform.targetX += (deltaX * sensitivity) / this.transform.zoom;
    this.transform.targetY += (deltaY * sensitivity) / this.transform.zoom;

    this.constrainToBounds();
  }

  /**
   * Zoom camera at specific screen point
   */
  zoomAt(screenX: number, screenY: number, factor: number): void {
    // Convert screen point to world coordinates before zoom
    const worldPoint = this.screenToWorld(screenX, screenY);

    // Apply zoom
    const newZoom = this.transform.targetZoom * factor;
    this.transform.targetZoom = Math.max(
      this.config.zoom.min,
      Math.min(this.config.zoom.max, newZoom)
    );

    // Convert world point back to screen coordinates after zoom
    const newScreenPoint = this.worldToScreen(worldPoint.x, worldPoint.y);

    // Adjust position to keep world point stationary
    this.transform.targetX += screenX - newScreenPoint.x;
    this.transform.targetY += screenY - newScreenPoint.y;

    this.constrainToBounds();
  }

  /**
   * Zoom by factor at viewport center
   */
  zoom(factor: number): void {
    const centerX = this.config.viewport.width / 2;
    const centerY = this.config.viewport.height / 2;
    this.zoomAt(centerX, centerY, factor);
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): Position {
    const worldX = (screenX - this.transform.x) / this.transform.zoom;
    const worldY = (screenY - this.transform.y) / this.transform.zoom;

    return { x: worldX, y: worldY } as Position;
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const screenX = worldX * this.transform.zoom + this.transform.x;
    const screenY = worldY * this.transform.zoom + this.transform.y;

    return { x: screenX, y: screenY };
  }

  /**
   * Check if a world position is visible in the viewport
   */
  isVisible(worldPos: Position, margin: number = 0): boolean {
    const screenPos = this.worldToScreen(worldPos.x, worldPos.y);

    return (
      screenPos.x >= -margin &&
      screenPos.x <= this.config.viewport.width + margin &&
      screenPos.y >= -margin &&
      screenPos.y <= this.config.viewport.height + margin
    );
  }

  /**
   * Get visible world bounds for viewport culling
   */
  getVisibleBounds(margin: number = 50): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    const topLeft = this.screenToWorld(-margin, -margin);
    const bottomRight = this.screenToWorld(
      this.config.viewport.width + margin,
      this.config.viewport.height + margin
    );

    return {
      minX: topLeft.x,
      maxX: bottomRight.x,
      minY: topLeft.y,
      maxY: bottomRight.y,
    };
  }

  /**
   * Center camera on world position
   */
  centerOn(worldX: number, worldY: number): void {
    this.transform.targetX =
      this.config.viewport.width / 2 - worldX * this.transform.targetZoom;
    this.transform.targetY =
      this.config.viewport.height / 2 - worldY * this.transform.targetZoom;

    this.constrainToBounds();
  }

  /**
   * Fit world bounds in viewport
   */
  fitBounds(
    bounds: {
      minX: number;
      maxX: number;
      minY: number;
      maxY: number;
    },
    padding: number = 50
  ): void {
    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    const viewportWidth = this.config.viewport.width - padding * 2;
    const viewportHeight = this.config.viewport.height - padding * 2;

    // Calculate zoom to fit both dimensions
    const zoomX = viewportWidth / worldWidth;
    const zoomY = viewportHeight / worldHeight;
    const zoom = Math.min(zoomX, zoomY);

    // Clamp to zoom limits
    this.transform.targetZoom = Math.max(
      this.config.zoom.min,
      Math.min(this.config.zoom.max, zoom)
    );

    // Center on bounds
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;
    this.centerOn(centerX, centerY);
  }

  /**
   * Handle mouse press for dragging
   */
  handleMousePress(mouseX: number, mouseY: number): void {
    this.previousMouse = { x: mouseX, y: mouseY };
    this.isDragging = true;
  }

  /**
   * Handle mouse drag
   */
  handleMouseDrag(mouseX: number, mouseY: number): void {
    if (!this.isDragging) return;

    const deltaX = mouseX - this.previousMouse.x;
    const deltaY = mouseY - this.previousMouse.y;

    this.pan(deltaX, deltaY);

    this.previousMouse = { x: mouseX, y: mouseY };
  }

  /**
   * Handle mouse release
   */
  handleMouseRelease(): void {
    this.isDragging = false;
  }

  /**
   * Handle mouse wheel for zooming
   */
  handleMouseWheel(mouseX: number, mouseY: number, delta: number): void {
    const zoomFactor =
      delta > 0
        ? 1 - this.config.zoom.sensitivity
        : 1 + this.config.zoom.sensitivity;
    this.zoomAt(mouseX, mouseY, zoomFactor);
  }

  /**
   * Constrain camera to bounds if set
   */
  private constrainToBounds(): void {
    if (!this.config.bounds) return;

    const bounds = this.config.bounds;

    // Calculate world viewport bounds
    const viewportBounds = this.getVisibleBounds(0);

    // Constrain X axis
    if (viewportBounds.minX < bounds.minX) {
      this.transform.targetX +=
        (bounds.minX - viewportBounds.minX) * this.transform.targetZoom;
    }
    if (viewportBounds.maxX > bounds.maxX) {
      this.transform.targetX -=
        (viewportBounds.maxX - bounds.maxX) * this.transform.targetZoom;
    }

    // Constrain Y axis
    if (viewportBounds.minY < bounds.minY) {
      this.transform.targetY +=
        (bounds.minY - viewportBounds.minY) * this.transform.targetZoom;
    }
    if (viewportBounds.maxY > bounds.maxY) {
      this.transform.targetY -=
        (viewportBounds.maxY - bounds.maxY) * this.transform.targetZoom;
    }
  }

  /**
   * Update viewport size
   */
  updateViewport(width: number, height: number): void {
    this.config.viewport.width = width;
    this.config.viewport.height = height;
  }

  /**
   * Get current camera position
   */
  getPosition(): { x: number; y: number } {
    return {
      x: this.transform.x,
      y: this.transform.y,
    };
  }

  /**
   * Get current zoom level
   */
  getZoom(): number {
    return this.transform.zoom;
  }

  /**
   * Get complete transform state
   */
  getTransform(): CameraTransform {
    return { ...this.transform };
  }

  /**
   * Set camera bounds
   */
  setBounds(bounds: CameraConfig['bounds']): void {
    this.config = { ...this.config, bounds };
    this.constrainToBounds();
  }

  /**
   * Update camera configuration
   */
  updateConfig(newConfig: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Re-constrain zoom if limits changed
    if (newConfig.zoom) {
      this.transform.targetZoom = Math.max(
        this.config.zoom.min,
        Math.min(this.config.zoom.max, this.transform.targetZoom)
      );
    }

    this.constrainToBounds();
  }

  /**
   * Reset camera to default state
   */
  reset(): void {
    const centerX = this.config.viewport.width / 2;
    const centerY = this.config.viewport.height / 2;

    this.transform.targetX = centerX;
    this.transform.targetY = centerY;
    this.transform.targetZoom = 1.0;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  /**
   * Get viewport width
   */
  getViewportWidth(): number {
    return this.config.viewport.width;
  }

  /**
   * Get viewport height
   */
  getViewportHeight(): number {
    return this.config.viewport.height;
  }
}
