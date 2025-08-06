/**
 * Global p5.js type declarations for browser environments
 * where p5.js is loaded as a global script
 */

declare global {
  // p5.js global instance and types
  interface Window {
    p5: typeof p5;
  }
  
  // Global p5 constructor
  declare var p5: {
    new (sketch: (p: p5Instance) => void, element?: HTMLElement): p5Instance;
  };

  // Blend modes
  type BLEND_MODE = 'BLEND' | 'ADD' | 'DARKEST' | 'LIGHTEST' | 'DIFFERENCE' | 'MULTIPLY' | 'EXCLUSION' | 'SCREEN' | 'REPLACE' | 'OVERLAY' | 'HARD_LIGHT' | 'SOFT_LIGHT' | 'DODGE' | 'BURN';

  // p5 instance interface with commonly used methods
  interface p5Instance {
    // Canvas and drawing
    createCanvas(width: number, height: number): any;
    createGraphics(width: number, height: number): p5Graphics;
    background(color: string | number): void;
    background(r: number, g: number, b: number): void;
    fill(color: string | number | Color): void;
    fill(r: number, g: number, b: number, a?: number): void;
    noFill(): void;
    stroke(color: string | number | Color): void;
    stroke(r: number, g: number, b: number, a?: number): void;
    noStroke(): void;
    strokeWeight(weight: number): void;
    blendMode(mode: BLEND_MODE): void;
    
    // Shapes
    circle(x: number, y: number, diameter: number): void;
    ellipse(x: number, y: number, w: number, h?: number): void;
    rect(x: number, y: number, w: number, h?: number): void;
    square(x: number, y: number, size: number): void;
    line(x1: number, y1: number, x2: number, y2: number): void;
    point(x: number, y: number): void;
    triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): void;
    bezier(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number): void;
    
    // Text
    text(str: string | number, x: number, y: number): void;
    textAlign(horizAlign: string | number, vertAlign?: string | number): void;
    textSize(size: number): void;
    
    // Color methods and properties
    color(r: number, g: number, b: number, a?: number): Color;
    color(color: string): Color;
    color(gray: number, alpha?: number): Color;
    red(color: Color): number;
    green(color: Color): number;
    blue(color: Color): number;
    alpha(color: Color): number;
    
    // Transformations
    push(): void;
    pop(): void;
    translate(x: number, y: number): void;
    rotate(angle: number): void;
    scale(s: number): void;
    scale(x: number, y: number): void;
    resetMatrix(): void;
    
    // Math utilities and constants
    map(value: number, start1: number, stop1: number, start2: number, stop2: number): number;
    sin(angle: number): number;
    cos(angle: number): number;
    arc(x: number, y: number, w: number, h: number, start: number, stop: number): void;
    TWO_PI: number;
    PI: number;
    HALF_PI: number;
    
    // Settings
    frameRate(fps: number): void;
    pixelDensity(density: number): void;
    smooth(): void;
    noSmooth(): void;
    rectMode(mode: string): void;
    
    // Input
    mouseX: number;
    mouseY: number;
    mousePressed?: (event?: MouseEvent) => void;
    mouseDragged?: (event?: MouseEvent) => void;
    mouseWheel?: (event?: WheelEvent) => void;
    
    // Lifecycle
    setup?: () => void;
    draw?: () => void;
    windowResized?: () => void;
    
    // Canvas management
    resizeCanvas(width: number, height: number): void;
    remove(): void;
    
    // Constants
    CENTER: string;
    LEFT: string;
    RIGHT: string;
    TOP: string;
    BOTTOM: string;
    
    // Canvas parent
    parent?: any;
  }

  // Graphics buffer interface
  interface p5Graphics extends p5Instance {
    remove(): void;
  }

  // Color type for p5.js
  interface Color {
    toString(): string;
  }
}

export {};