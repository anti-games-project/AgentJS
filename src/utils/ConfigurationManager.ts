import { EventEmitter } from 'eventemitter3';

export interface SimulationConfig {
  simulation: {
    maxSteps: number;
    stepInterval: number;
    autoStart: boolean;
    randomSeed?: number;
  };
  agents: {
    initialCount: number;
    maxCount: number;
    defaultProperties: Record<string, any>;
    spawnRate: number;
    despawnConditions: Record<string, any>;
  };
  environment: {
    type: 'continuous' | 'grid';
    width: number;
    height: number;
    boundaries: 'wrap' | 'bounce' | 'open';
    zones?: Array<{
      id: string;
      type: string;
      x: number;
      y: number;
      width: number;
      height: number;
      properties: Record<string, any>;
    }>;
  };
  network: {
    enableNetworking: boolean;
    maxConnections: number;
    connectionTypes: string[];
    formationRules: Record<string, any>;
    decayRate: number;
  };
  visualization: {
    enabled: boolean;
    fps: number;
    canvas: {
      width: number;
      height: number;
      backgroundColor: string;
    };
    agents: {
      showTrails: boolean;
      trailLength: number;
      showConnections: boolean;
      showProperties: boolean;
    };
    effects: {
      animations: boolean;
      particles: boolean;
      heatMaps: boolean;
    };
  };
  dataCollection: {
    enabled: boolean;
    collectInterval: number;
    maxDataPoints: number;
    enableAgentTracking: boolean;
    enableNetworkMetrics: boolean;
    customMetrics: string[];
  };
  export: {
    format: 'csv' | 'json';
    includeTimestamps: boolean;
    includeMetadata: boolean;
    precision: number;
  };
}

export interface ParameterDefinition {
  key: string;
  type: 'number' | 'string' | 'boolean' | 'array' | 'object';
  defaultValue: any;
  min?: number;
  max?: number;
  step?: number;
  options?: any[];
  description: string;
  category: string;
  validation?: (value: any) => boolean | string;
}

export interface ConfigurationSchema {
  version: string;
  parameters: ParameterDefinition[];
  presets: Record<string, Partial<SimulationConfig>>;
}

export class ConfigurationManager extends EventEmitter {
  private config: SimulationConfig;
  private schema: ConfigurationSchema;
  private presets: Map<string, Partial<SimulationConfig>> = new Map();
  private validationErrors: string[] = [];

  constructor(initialConfig?: Partial<SimulationConfig>) {
    super();
    this.schema = this.createDefaultSchema();
    this.config = this.createDefaultConfig();

    if (initialConfig) {
      this.updateConfig(initialConfig);
    }

    this.loadPresets();
  }

  private createDefaultConfig(): SimulationConfig {
    return {
      simulation: {
        maxSteps: 1000,
        stepInterval: 100,
        autoStart: false,
      },
      agents: {
        initialCount: 50,
        maxCount: 200,
        defaultProperties: {
          autonomy: 50,
          resources: 100,
          type: 'default',
        },
        spawnRate: 0.1,
        despawnConditions: {
          minResources: 0,
          maxAge: 1000,
        },
      },
      environment: {
        type: 'continuous',
        width: 800,
        height: 600,
        boundaries: 'wrap',
        zones: [],
      },
      network: {
        enableNetworking: true,
        maxConnections: 5,
        connectionTypes: ['supportive', 'exploitative', 'economic'],
        formationRules: {
          proximityThreshold: 50,
          autonomyDifference: 30,
        },
        decayRate: 0.01,
      },
      visualization: {
        enabled: true,
        fps: 60,
        canvas: {
          width: 800,
          height: 600,
          backgroundColor: '#f0f0f0',
        },
        agents: {
          showTrails: true,
          trailLength: 20,
          showConnections: true,
          showProperties: false,
        },
        effects: {
          animations: true,
          particles: true,
          heatMaps: false,
        },
      },
      dataCollection: {
        enabled: true,
        collectInterval: 100,
        maxDataPoints: 10000,
        enableAgentTracking: true,
        enableNetworkMetrics: true,
        customMetrics: [],
      },
      export: {
        format: 'csv',
        includeTimestamps: true,
        includeMetadata: true,
        precision: 4,
      },
    };
  }

  private createDefaultSchema(): ConfigurationSchema {
    return {
      version: '1.0.0',
      parameters: [
        // Simulation parameters
        {
          key: 'simulation.maxSteps',
          type: 'number',
          defaultValue: 1000,
          min: 1,
          max: 10000,
          step: 1,
          description: 'Maximum number of simulation steps',
          category: 'Simulation',
        },
        {
          key: 'simulation.stepInterval',
          type: 'number',
          defaultValue: 100,
          min: 1,
          max: 1000,
          step: 1,
          description: 'Interval between steps in milliseconds',
          category: 'Simulation',
        },
        {
          key: 'simulation.autoStart',
          type: 'boolean',
          defaultValue: false,
          description: 'Automatically start simulation when loaded',
          category: 'Simulation',
        },

        // Agent parameters
        {
          key: 'agents.initialCount',
          type: 'number',
          defaultValue: 50,
          min: 1,
          max: 1000,
          step: 1,
          description: 'Initial number of agents',
          category: 'Agents',
        },
        {
          key: 'agents.maxCount',
          type: 'number',
          defaultValue: 200,
          min: 1,
          max: 1000,
          step: 1,
          description: 'Maximum number of agents',
          category: 'Agents',
        },
        {
          key: 'agents.defaultProperties.autonomy',
          type: 'number',
          defaultValue: 50,
          min: 0,
          max: 100,
          step: 1,
          description: 'Default autonomy level for new agents',
          category: 'Agents',
        },
        {
          key: 'agents.defaultProperties.resources',
          type: 'number',
          defaultValue: 100,
          min: 0,
          max: 1000,
          step: 1,
          description: 'Default resource level for new agents',
          category: 'Agents',
        },

        // Environment parameters
        {
          key: 'environment.type',
          type: 'string',
          defaultValue: 'continuous',
          options: ['continuous', 'grid'],
          description: 'Type of environment space',
          category: 'Environment',
        },
        {
          key: 'environment.width',
          type: 'number',
          defaultValue: 800,
          min: 100,
          max: 2000,
          step: 10,
          description: 'Environment width',
          category: 'Environment',
        },
        {
          key: 'environment.height',
          type: 'number',
          defaultValue: 600,
          min: 100,
          max: 2000,
          step: 10,
          description: 'Environment height',
          category: 'Environment',
        },
        {
          key: 'environment.boundaries',
          type: 'string',
          defaultValue: 'wrap',
          options: ['wrap', 'bounce', 'open'],
          description: 'Boundary behavior',
          category: 'Environment',
        },

        // Network parameters
        {
          key: 'network.enableNetworking',
          type: 'boolean',
          defaultValue: true,
          description: 'Enable agent networking',
          category: 'Network',
        },
        {
          key: 'network.maxConnections',
          type: 'number',
          defaultValue: 5,
          min: 1,
          max: 20,
          step: 1,
          description: 'Maximum connections per agent',
          category: 'Network',
        },
        {
          key: 'network.decayRate',
          type: 'number',
          defaultValue: 0.01,
          min: 0,
          max: 1,
          step: 0.01,
          description: 'Connection decay rate per step',
          category: 'Network',
        },

        // Visualization parameters
        {
          key: 'visualization.fps',
          type: 'number',
          defaultValue: 60,
          min: 1,
          max: 120,
          step: 1,
          description: 'Target frames per second',
          category: 'Visualization',
        },
        {
          key: 'visualization.agents.showTrails',
          type: 'boolean',
          defaultValue: true,
          description: 'Show agent movement trails',
          category: 'Visualization',
        },
        {
          key: 'visualization.agents.trailLength',
          type: 'number',
          defaultValue: 20,
          min: 1,
          max: 100,
          step: 1,
          description: 'Length of agent trails',
          category: 'Visualization',
        },
        {
          key: 'visualization.agents.showConnections',
          type: 'boolean',
          defaultValue: true,
          description: 'Show agent connections',
          category: 'Visualization',
        },

        // Data collection parameters
        {
          key: 'dataCollection.collectInterval',
          type: 'number',
          defaultValue: 100,
          min: 10,
          max: 1000,
          step: 10,
          description: 'Data collection interval in milliseconds',
          category: 'Data Collection',
        },
        {
          key: 'dataCollection.maxDataPoints',
          type: 'number',
          defaultValue: 10000,
          min: 100,
          max: 100000,
          step: 100,
          description: 'Maximum data points to store',
          category: 'Data Collection',
        },
      ],
      presets: {},
    };
  }

  private loadPresets(): void {
    // Educational scenario preset
    this.presets.set('educational', {
      agents: {
        initialCount: 30,
        maxCount: 50,
        defaultProperties: {
          autonomy: 40,
          resources: 80,
          type: 'student',
        },
        spawnRate: 0,
        despawnConditions: {},
      },
      visualization: {
        enabled: true,
        fps: 30,
        canvas: {
          width: 800,
          height: 600,
          backgroundColor: '#ffffff',
        },
        agents: {
          showTrails: true,
          trailLength: 15,
          showConnections: true,
          showProperties: true,
        },
        effects: {
          animations: true,
          particles: false,
          heatMaps: true,
        },
      },
      dataCollection: {
        enabled: true,
        collectInterval: 200,
        maxDataPoints: 1000,
        enableAgentTracking: true,
        enableNetworkMetrics: true,
        customMetrics: [],
      },
    });

    // Performance testing preset
    this.presets.set('performance', {
      agents: {
        initialCount: 100,
        maxCount: 500,
        defaultProperties: {},
        spawnRate: 0,
        despawnConditions: {},
      },
      visualization: {
        enabled: true,
        fps: 120,
        canvas: {
          width: 800,
          height: 600,
          backgroundColor: '#000000',
        },
        agents: {
          showTrails: false,
          trailLength: 0,
          showConnections: false,
          showProperties: false,
        },
        effects: {
          animations: false,
          particles: false,
          heatMaps: false,
        },
      },
      dataCollection: {
        enabled: true,
        collectInterval: 50,
        maxDataPoints: 10000,
        enableAgentTracking: false,
        enableNetworkMetrics: false,
        customMetrics: [],
      },
    });

    // Research preset
    this.presets.set('research', {
      simulation: {
        maxSteps: 5000,
        stepInterval: 100,
        autoStart: false,
      },
      agents: {
        initialCount: 75,
        maxCount: 150,
        defaultProperties: {},
        spawnRate: 0,
        despawnConditions: {},
      },
      dataCollection: {
        enabled: true,
        collectInterval: 10,
        maxDataPoints: 50000,
        enableAgentTracking: true,
        enableNetworkMetrics: true,
        customMetrics: [],
      },
      export: {
        format: 'csv',
        includeTimestamps: true,
        includeMetadata: true,
        precision: 6,
      },
    });
  }

  // Configuration management methods
  public getConfig(): SimulationConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  public updateConfig(updates: Partial<SimulationConfig>): boolean {
    try {
      const newConfig = this.deepMerge(this.config, updates);
      const validationResult = this.validateConfig(newConfig);

      if (validationResult.isValid) {
        const oldConfig = this.getConfig();
        this.config = newConfig;
        this.emit('config:updated', { oldConfig, newConfig: this.getConfig() });
        return true;
      } else {
        this.validationErrors = validationResult.errors;
        this.emit('config:validation-error', validationResult.errors);
        return false;
      }
    } catch (error) {
      this.emit('config:error', error);
      return false;
    }
  }

  public setParameter(key: string, value: any): boolean {
    const paramDef = this.schema.parameters.find(p => p.key === key);
    
    // If parameter is not defined in schema, allow it for flexibility (like test parameters)
    if (!paramDef) {
      // Allow custom parameters by creating them on the fly
      this.schema.parameters.push({
        key: key,
        type: typeof value as any,
        defaultValue: value,
        description: `Dynamic parameter: ${key}`,
        category: 'custom'
      });
    } else {
      // Validate the value for known parameters
      const validationResult = this.validateParameter(paramDef, value);
      if (!validationResult.isValid) {
        this.emit('config:validation-error', validationResult.errors);
        return false;
      }
    }

    // Update the configuration
    const keys = key.split('.');
    let current: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const currentKey = keys[i];
      if (!currentKey) continue;
      
      if (!(currentKey in current)) {
        current[currentKey] = {};
      }
      current = current[currentKey];
    }

    const lastKey = keys[keys.length - 1];
    if (!lastKey) return false;
    
    const oldValue = current[lastKey];
    current[lastKey] = value;

    this.emit('parameter:updated', { key, oldValue, newValue: value });
    return true;
  }

  public getParameter(key: string): any {
    const keys = key.split('.');
    let current: any = this.config;

    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        return undefined;
      }
    }

    return current;
  }

  public loadPreset(presetName: string): boolean {
    const preset = this.presets.get(presetName);
    if (!preset) {
      this.emit('config:error', `Unknown preset: ${presetName}`);
      return false;
    }

    return this.updateConfig(preset);
  }

  public savePreset(name: string, config?: Partial<SimulationConfig>): void {
    const presetConfig = config || this.getConfig();
    this.presets.set(name, presetConfig);
    this.emit('preset:saved', { name, config: presetConfig });
  }

  public getAvailablePresets(): string[] {
    return Array.from(this.presets.keys());
  }

  // Validation methods
  private validateConfig(config: SimulationConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic structure validation
    if (typeof config !== 'object') {
      errors.push('Configuration must be an object');
      return { isValid: false, errors };
    }

    // Validate each parameter
    this.schema.parameters.forEach(paramDef => {
      const value = this.getNestedValue(config, paramDef.key);
      const validation = this.validateParameter(paramDef, value);
      if (!validation.isValid) {
        errors.push(...validation.errors);
      }
    });

    // Cross-parameter validation
    if (config.agents?.initialCount > config.agents?.maxCount) {
      errors.push('Initial agent count cannot exceed maximum agent count');
    }

    if (config.visualization?.agents?.trailLength > 100) {
      errors.push('Trail length cannot exceed 100 for performance reasons');
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateParameter(
    paramDef: ParameterDefinition,
    value: any
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (value === undefined || value === null) {
      value = paramDef.defaultValue;
    }

    // Type validation
    if (typeof value !== paramDef.type) {
      errors.push(
        `Parameter ${paramDef.key} must be of type ${paramDef.type}, got ${typeof value}`
      );
      return { isValid: false, errors };
    }

    // Range validation for numbers
    if (paramDef.type === 'number') {
      if (paramDef.min !== undefined && value < paramDef.min) {
        errors.push(
          `Parameter ${paramDef.key} must be at least ${paramDef.min}, got ${value}`
        );
      }
      if (paramDef.max !== undefined && value > paramDef.max) {
        errors.push(
          `Parameter ${paramDef.key} must be at most ${paramDef.max}, got ${value}`
        );
      }
    }

    // Options validation
    if (paramDef.options && !paramDef.options.includes(value)) {
      errors.push(
        `Parameter ${paramDef.key} must be one of: ${paramDef.options.join(', ')}`
      );
    }

    // Custom validation
    if (paramDef.validation) {
      const result = paramDef.validation(value);
      if (result !== true) {
        errors.push(
          typeof result === 'string'
            ? result
            : `Invalid value for ${paramDef.key}`
        );
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Export/Import methods
  public exportConfig(format: 'json' | 'yaml' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify(this.config, null, 2);
    } else {
      // Simple YAML export (basic implementation)
      return this.objectToYaml(this.config);
    }
  }

  public importConfig(
    configString: string,
    format: 'json' | 'yaml' = 'json'
  ): boolean {
    try {
      let importedConfig: Partial<SimulationConfig>;

      if (format === 'json') {
        importedConfig = JSON.parse(configString);
      } else {
        importedConfig = this.yamlToObject(configString);
      }

      return this.updateConfig(importedConfig);
    } catch (error) {
      this.emit('config:error', `Failed to import configuration: ${error}`);
      return false;
    }
  }

  // Utility methods
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private objectToYaml(obj: any, indent: number = 0): string {
    let yaml = '';
    const indentStr = '  '.repeat(indent);

    for (const [key, value] of Object.entries(obj)) {
      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        yaml += `${indentStr}${key}:\n`;
        yaml += this.objectToYaml(value, indent + 1);
      } else if (Array.isArray(value)) {
        yaml += `${indentStr}${key}:\n`;
        value.forEach(item => {
          yaml += `${indentStr}  - ${item}\n`;
        });
      } else {
        yaml += `${indentStr}${key}: ${value}\n`;
      }
    }

    return yaml;
  }

  private yamlToObject(yamlString: string): any {
    // Simple YAML parser (basic implementation)
    // In production, use a proper YAML library
    const lines = yamlString.split('\n');
    const result: any = {};
    const stack: any[] = [result];
    // let _currentIndent = 0;

    lines.forEach(line => {
      if (line.trim() === '' || line.trim().startsWith('#')) return;

      const content = line.trim();

      if (content.includes(':')) {
        const parts = content.split(':').map(s => s.trim());
        const key = parts[0];
        const value = parts[1];
        
        if (!key) return;

        const currentObj = stack[stack.length - 1];
        if (!currentObj) return;

        if (!value || value === '') {
          // Object
          const obj = {};
          currentObj[key] = obj;
          stack.push(obj);
          // currentIndent = indent;
        } else {
          // Value
          currentObj[key] = this.parseValue(value);
        }
      }
    });

    return result;
  }

  private parseValue(value: string): any {
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (!isNaN(Number(value))) return Number(value);
    return value;
  }

  // Public getters
  public getSchema(): ConfigurationSchema {
    return JSON.parse(JSON.stringify(this.schema));
  }

  public getValidationErrors(): string[] {
    return [...this.validationErrors];
  }

  public getParameterDefinition(key: string): ParameterDefinition | undefined {
    return this.schema.parameters.find(p => p.key === key);
  }

  public getParametersByCategory(): Record<string, ParameterDefinition[]> {
    const categories: Record<string, ParameterDefinition[]> = {};

    this.schema.parameters.forEach(param => {
      const category = param.category || 'uncategorized';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category]?.push(param);
    });

    return categories;
  }
}
