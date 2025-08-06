/**
 * Mathematical utility functions for AgentJS framework
 */

export class Vector2D {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  static from(obj: { x: number; y: number }): Vector2D {
    return new Vector2D(obj.x, obj.y);
  }

  add(other: Vector2D): Vector2D {
    return new Vector2D(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2D): Vector2D {
    return new Vector2D(this.x - other.x, this.y - other.y);
  }

  multiply(scalar: number): Vector2D {
    return new Vector2D(this.x * scalar, this.y * scalar);
  }

  divide(scalar: number): Vector2D {
    if (scalar === 0) throw new Error('Division by zero');
    return new Vector2D(this.x / scalar, this.y / scalar);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2D {
    const mag = this.magnitude();
    return mag > 0 ? this.divide(mag) : new Vector2D(0, 0);
  }

  distance(other: Vector2D): number {
    return this.subtract(other).magnitude();
  }

  dot(other: Vector2D): number {
    return this.x * other.x + this.y * other.y;
  }

  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(angle: number): Vector2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vector2D(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  clone(): Vector2D {
    return new Vector2D(this.x, this.y);
  }

  equals(other: Vector2D, tolerance: number = 1e-10): boolean {
    return (
      Math.abs(this.x - other.x) < tolerance &&
      Math.abs(this.y - other.y) < tolerance
    );
  }

  toString(): string {
    return `Vector2D(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }
}

export class MathUtils {
  /**
   * Clamp a value between min and max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Linear interpolation between two values
   */
  static lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Map a value from one range to another
   */
  static map(
    value: number,
    fromMin: number,
    fromMax: number,
    toMin: number,
    toMax: number
  ): number {
    return toMin + ((value - fromMin) * (toMax - toMin)) / (fromMax - fromMin);
  }

  /**
   * Convert degrees to radians
   */
  static degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert radians to degrees
   */
  static radToDeg(radians: number): number {
    return (radians * 180) / Math.PI;
  }

  /**
   * Calculate distance between two points
   */
  static distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate squared distance (faster than distance for comparisons)
   */
  static distanceSquared(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return dx * dx + dy * dy;
  }

  /**
   * Generate random number between min and max
   */
  static random(min: number = 0, max: number = 1): number {
    return min + Math.random() * (max - min);
  }

  /**
   * Generate random integer between min and max (inclusive)
   */
  static randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate random boolean
   */
  static randomBoolean(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }

  /**
   * Generate random number from normal distribution (Box-Muller transform)
   */
  static randomNormal(mean: number = 0, stdDev: number = 1): number {
    let u = 0,
      v = 0;
    while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
    while (v === 0) v = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }

  /**
   * Select random element from array
   */
  static randomChoice<T>(array: T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot select from empty array');
    }
    return array[Math.floor(Math.random() * array.length)]!;
  }

  /**
   * Shuffle array in place (Fisher-Yates algorithm)
   */
  static shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i]!;
      array[i] = array[j]!;
      array[j] = temp;
    }
    return array;
  }

  /**
   * Calculate weighted random selection
   */
  static weightedRandom<T>(items: T[], weights: number[]): T {
    if (items.length !== weights.length) {
      throw new Error('Items and weights arrays must have the same length');
    }

    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < items.length; i++) {
      const weight = weights[i];
      if (weight !== undefined) {
        random -= weight;
        if (random <= 0) {
          return items[i]!;
        }
      }
    }

    return items[items.length - 1]!;
  }

  /**
   * Check if point is inside circle
   */
  static pointInCircle(
    px: number,
    py: number,
    cx: number,
    cy: number,
    radius: number
  ): boolean {
    return this.distanceSquared(px, py, cx, cy) <= radius * radius;
  }

  /**
   * Check if point is inside rectangle
   */
  static pointInRect(
    px: number,
    py: number,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    return px >= x && px <= x + width && py >= y && py <= y + height;
  }

  /**
   * Calculate angle between two points
   */
  static angleBetween(x1: number, y1: number, x2: number, y2: number): number {
    return Math.atan2(y2 - y1, x2 - x1);
  }

  /**
   * Normalize angle to [0, 2π] range
   */
  static normalizeAngle(angle: number): number {
    while (angle < 0) angle += 2 * Math.PI;
    while (angle >= 2 * Math.PI) angle -= 2 * Math.PI;
    return angle;
  }

  /**
   * Calculate shortest angular difference between two angles
   */
  static angleDifference(angle1: number, angle2: number): number {
    let diff = angle2 - angle1;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    return diff;
  }

  /**
   * Round number to specified decimal places
   */
  static round(value: number, decimals: number = 0): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Check if number is approximately equal to another
   */
  static approximately(
    a: number,
    b: number,
    tolerance: number = 1e-10
  ): boolean {
    return Math.abs(a - b) < tolerance;
  }

  /**
   * Calculate mean of array
   */
  static mean(values: number[]): number {
    return values.length > 0
      ? values.reduce((sum, val) => sum + val, 0) / values.length
      : 0;
  }

  /**
   * Calculate median of array
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length === 0) return 0;
    
    return sorted.length % 2 === 0
      ? ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
      : sorted[mid] ?? 0;
  }

  /**
   * Calculate standard deviation of array
   */
  static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = this.mean(values);
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile of array
   */
  static percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);

    const floorIndex = Math.floor(index);
    const ceilIndex = Math.ceil(index);
    
    if (index === floorIndex) {
      return sorted[floorIndex] ?? 0;
    } else {
      const lower = sorted[floorIndex] ?? 0;
      const upper = sorted[ceilIndex] ?? 0;
      return lower + (upper - lower) * (index - floorIndex);
    }
  }

  /**
   * Generate UUID v4
   */
  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      }
    );
  }

  /**
   * Deep clone an object
   */
  static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
    if (obj instanceof Array)
      return obj.map(item => this.deepClone(item)) as unknown as T;
    if (typeof obj === 'object') {
      const cloned = {} as T;
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }

  /**
   * Debounce function calls
   */
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(null, args), wait);
    };
  }

  /**
   * Throttle function calls
   */
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func.apply(null, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Format number with specified precision
   */
  static formatNumber(value: number, precision: number = 2): string {
    return value.toFixed(precision);
  }

  /**
   * Format number as percentage
   */
  static formatPercentage(value: number, precision: number = 1): string {
    return `${(value * 100).toFixed(precision)}%`;
  }

  /**
   * Validate if value is a finite number
   */
  static isValidNumber(value: any): value is number {
    return typeof value === 'number' && isFinite(value);
  }

  /**
   * Ensure value is within bounds, wrapping if necessary
   */
  static wrap(value: number, min: number, max: number): number {
    const range = max - min;
    if (range <= 0) return min;

    while (value < min) value += range;
    while (value >= max) value -= range;
    return value;
  }

  /**
   * Calculate Euclidean distance in N dimensions
   */
  static distanceND(point1: number[], point2: number[]): number {
    if (point1.length !== point2.length) {
      throw new Error('Points must have the same dimensionality');
    }

    return Math.sqrt(
      point1.reduce((sum, val, i) => sum + Math.pow(val - (point2[i] || 0), 2), 0)
    );
  }

  /**
   * Calculate Manhattan distance in N dimensions
   */
  static manhattanDistance(point1: number[], point2: number[]): number {
    if (point1.length !== point2.length) {
      throw new Error('Points must have the same dimensionality');
    }

    return point1.reduce((sum, val, i) => sum + Math.abs(val - (point2[i] || 0)), 0);
  }
}
