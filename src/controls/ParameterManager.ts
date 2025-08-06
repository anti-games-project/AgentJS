import { EventEmitter } from 'eventemitter3';

/**
 * Parameter value types
 */
export type ParameterValue = number | boolean | string;

/**
 * Parameter types
 */
export enum ParameterType {
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  ENUM = 'enum'
}

/**
 * Parameter definition
 */
export interface ParameterDefinition {
  key: string;
  label: string;
  type: ParameterType;
  defaultValue: ParameterValue;
  description?: string;
  category?: string;
  
  // Type-specific options
  min?: number; // For NUMBER type
  max?: number; // For NUMBER type
  step?: number; // For NUMBER type
  options?: string[]; // For ENUM type
  
  // Validation
  validator?: (value: ParameterValue) => boolean;
  
  // UI hints
  displayOrder?: number;
  hidden?: boolean;
  readonly?: boolean;
}

/**
 * Parameter group for organization
 */
export interface ParameterGroup {
  name: string;
  label: string;
  parameters: ParameterDefinition[];
  collapsed?: boolean;
}

/**
 * Parameter change event
 */
export interface ParameterChangeEvent {
  key: string;
  oldValue: ParameterValue;
  newValue: ParameterValue;
  source: 'ui' | 'api' | 'preset';
}

/**
 * Parameter preset
 */
export interface ParameterPreset {
  name: string;
  description?: string;
  values: Record<string, ParameterValue>;
}

/**
 * Manager events
 */
export interface ParameterManagerEvents {
  'parameter:changed': (event: ParameterChangeEvent) => void;
  'parameter:registered': (definition: ParameterDefinition) => void;
  'preset:applied': (preset: ParameterPreset) => void;
  'validation:failed': (key: string, value: ParameterValue, error: string) => void;
}

/**
 * Dynamic parameter management system
 */
export class ParameterManager extends EventEmitter<ParameterManagerEvents> {
  private parameters: Map<string, ParameterDefinition> = new Map();
  private values: Map<string, ParameterValue> = new Map();
  private groups: Map<string, ParameterGroup> = new Map();
  private presets: Map<string, ParameterPreset> = new Map();
  private changeCallbacks: Map<string, Array<(value: ParameterValue) => void>> = new Map();

  constructor() {
    super();
  }

  /**
   * Register a new parameter
   */
  registerParameter(definition: ParameterDefinition): void {
    // Validate definition
    this.validateDefinition(definition);

    // Store parameter
    this.parameters.set(definition.key, definition);
    this.values.set(definition.key, definition.defaultValue);

    // Add to category group if specified
    if (definition.category) {
      this.addToGroup(definition.category, definition);
    }

    this.emit('parameter:registered', definition);
  }

  /**
   * Register multiple parameters at once
   */
  registerParameters(definitions: ParameterDefinition[]): void {
    for (const definition of definitions) {
      this.registerParameter(definition);
    }
  }

  /**
   * Register a parameter group
   */
  registerGroup(group: ParameterGroup): void {
    this.groups.set(group.name, group);
    
    // Register all parameters in the group
    for (const param of group.parameters) {
      param.category = group.name;
      this.registerParameter(param);
    }
  }

  /**
   * Get parameter value
   */
  getValue(key: string): ParameterValue | undefined {
    return this.values.get(key);
  }

  /**
   * Get typed parameter value
   */
  getNumber(key: string): number {
    const value = this.getValue(key);
    if (typeof value !== 'number') {
      throw new Error(`Parameter ${key} is not a number`);
    }
    return value;
  }

  /**
   * Get typed boolean value
   */
  getBoolean(key: string): boolean {
    const value = this.getValue(key);
    if (typeof value !== 'boolean') {
      throw new Error(`Parameter ${key} is not a boolean`);
    }
    return value;
  }

  /**
   * Get typed string value
   */
  getString(key: string): string {
    const value = this.getValue(key);
    if (typeof value !== 'string') {
      throw new Error(`Parameter ${key} is not a string`);
    }
    return value;
  }

  /**
   * Set parameter value
   */
  setValue(key: string, value: ParameterValue, source: 'ui' | 'api' | 'preset' = 'api'): boolean {
    const definition = this.parameters.get(key);
    if (!definition) {
      console.warn(`Parameter ${key} not registered`);
      return false;
    }

    // Validate value
    if (!this.validateValue(definition, value)) {
      return false;
    }

    const oldValue = this.values.get(key);
    if (oldValue === value) {
      return true; // No change
    }

    // Update value
    this.values.set(key, value);

    // Emit change event
    const event: ParameterChangeEvent = {
      key,
      oldValue: oldValue!,
      newValue: value,
      source
    };
    this.emit('parameter:changed', event);

    // Call registered callbacks
    const callbacks = this.changeCallbacks.get(key);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(value);
      }
    }

    return true;
  }

  /**
   * Set multiple values at once
   */
  setValues(values: Record<string, ParameterValue>, source: 'ui' | 'api' | 'preset' = 'api'): void {
    for (const [key, value] of Object.entries(values)) {
      this.setValue(key, value, source);
    }
  }

  /**
   * Register a callback for parameter changes
   */
  onChange(key: string, callback: (value: ParameterValue) => void): () => void {
    if (!this.changeCallbacks.has(key)) {
      this.changeCallbacks.set(key, []);
    }
    
    const callbacks = this.changeCallbacks.get(key)!;
    callbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get parameter definition
   */
  getDefinition(key: string): ParameterDefinition | undefined {
    return this.parameters.get(key);
  }

  /**
   * Get all parameter definitions
   */
  getAllDefinitions(): ParameterDefinition[] {
    return Array.from(this.parameters.values());
  }

  /**
   * Get parameters by category
   */
  getByCategory(category: string): ParameterDefinition[] {
    return this.getAllDefinitions().filter(def => def.category === category);
  }

  /**
   * Get all groups
   */
  getGroups(): ParameterGroup[] {
    return Array.from(this.groups.values());
  }

  /**
   * Get all current values
   */
  getAllValues(): Record<string, ParameterValue> {
    const result: Record<string, ParameterValue> = {};
    for (const [key, value] of this.values) {
      result[key] = value;
    }
    return result;
  }

  /**
   * Save current values as a preset
   */
  savePreset(name: string, description?: string): ParameterPreset {
    const preset: ParameterPreset = {
      name,
      values: this.getAllValues()
    };
    
    if (description !== undefined) {
      preset.description = description;
    }
    
    this.presets.set(name, preset);
    return preset;
  }

  /**
   * Apply a preset
   */
  applyPreset(name: string): boolean {
    const preset = this.presets.get(name);
    if (!preset) {
      console.warn(`Preset ${name} not found`);
      return false;
    }

    this.setValues(preset.values, 'preset');
    this.emit('preset:applied', preset);
    return true;
  }

  /**
   * Get all presets
   */
  getPresets(): ParameterPreset[] {
    return Array.from(this.presets.values());
  }

  /**
   * Delete a preset
   */
  deletePreset(name: string): boolean {
    return this.presets.delete(name);
  }

  /**
   * Export configuration
   */
  exportConfig(): {
    definitions: ParameterDefinition[];
    values: Record<string, ParameterValue>;
    presets: ParameterPreset[];
  } {
    return {
      definitions: this.getAllDefinitions(),
      values: this.getAllValues(),
      presets: this.getPresets()
    };
  }

  /**
   * Import configuration
   */
  importConfig(config: {
    definitions?: ParameterDefinition[];
    values?: Record<string, ParameterValue>;
    presets?: ParameterPreset[];
  }): void {
    // Import definitions
    if (config.definitions) {
      for (const def of config.definitions) {
        this.registerParameter(def);
      }
    }

    // Import values
    if (config.values) {
      this.setValues(config.values);
    }

    // Import presets
    if (config.presets) {
      for (const preset of config.presets) {
        this.presets.set(preset.name, preset);
      }
    }
  }

  /**
   * Reset parameter to default value
   */
  resetToDefault(key: string): boolean {
    const definition = this.parameters.get(key);
    if (!definition) {
      return false;
    }

    return this.setValue(key, definition.defaultValue);
  }

  /**
   * Reset all parameters to defaults
   */
  resetAllToDefaults(): void {
    for (const [key, definition] of this.parameters) {
      this.setValue(key, definition.defaultValue);
    }
  }

  /**
   * Validate parameter definition
   */
  private validateDefinition(definition: ParameterDefinition): void {
    if (!definition.key || definition.key.trim() === '') {
      throw new Error('Parameter key cannot be empty');
    }

    if (!definition.label || definition.label.trim() === '') {
      throw new Error('Parameter label cannot be empty');
    }

    // Type-specific validation
    switch (definition.type) {
      case ParameterType.NUMBER:
        if (typeof definition.defaultValue !== 'number') {
          throw new Error(`Default value for ${definition.key} must be a number`);
        }
        if (definition.min !== undefined && definition.max !== undefined && definition.min > definition.max) {
          throw new Error(`Min value cannot be greater than max value for ${definition.key}`);
        }
        break;
      
      case ParameterType.BOOLEAN:
        if (typeof definition.defaultValue !== 'boolean') {
          throw new Error(`Default value for ${definition.key} must be a boolean`);
        }
        break;
      
      case ParameterType.ENUM:
        if (!definition.options || definition.options.length === 0) {
          throw new Error(`Enum parameter ${definition.key} must have options`);
        }
        if (!definition.options.includes(definition.defaultValue as string)) {
          throw new Error(`Default value for ${definition.key} must be one of the options`);
        }
        break;
    }
  }

  /**
   * Validate parameter value
   */
  private validateValue(definition: ParameterDefinition, value: ParameterValue): boolean {
    // Type validation
    switch (definition.type) {
      case ParameterType.NUMBER:
        if (typeof value !== 'number') {
          this.emit('validation:failed', definition.key, value, 'Value must be a number');
          return false;
        }
        if (definition.min !== undefined && value < definition.min) {
          this.emit('validation:failed', definition.key, value, `Value must be >= ${definition.min}`);
          return false;
        }
        if (definition.max !== undefined && value > definition.max) {
          this.emit('validation:failed', definition.key, value, `Value must be <= ${definition.max}`);
          return false;
        }
        break;
      
      case ParameterType.BOOLEAN:
        if (typeof value !== 'boolean') {
          this.emit('validation:failed', definition.key, value, 'Value must be a boolean');
          return false;
        }
        break;
      
      case ParameterType.ENUM:
        if (!definition.options?.includes(value as string)) {
          this.emit('validation:failed', definition.key, value, 'Value must be one of the options');
          return false;
        }
        break;
    }

    // Custom validation
    if (definition.validator && !definition.validator(value)) {
      this.emit('validation:failed', definition.key, value, 'Custom validation failed');
      return false;
    }

    return true;
  }

  /**
   * Add parameter to group
   */
  private addToGroup(groupName: string, parameter: ParameterDefinition): void {
    if (!this.groups.has(groupName)) {
      this.groups.set(groupName, {
        name: groupName,
        label: groupName,
        parameters: []
      });
    }

    const group = this.groups.get(groupName)!;
    if (!group.parameters.find(p => p.key === parameter.key)) {
      group.parameters.push(parameter);
    }
  }

  /**
   * Create UI controls for parameters
   */
  createUIControls(container: HTMLElement): void {
    // Clear existing controls
    container.innerHTML = '';

    // Create controls for each group
    for (const group of this.getGroups()) {
      const groupElement = this.createGroupElement(group);
      container.appendChild(groupElement);
    }

    // Create controls for ungrouped parameters
    const ungrouped = this.getAllDefinitions().filter(def => !def.category);
    if (ungrouped.length > 0) {
      const ungroupedElement = this.createGroupElement({
        name: 'ungrouped',
        label: 'General',
        parameters: ungrouped
      });
      container.appendChild(ungroupedElement);
    }
  }

  /**
   * Create group element
   */
  private createGroupElement(group: ParameterGroup): HTMLElement {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'parameter-group';
    groupDiv.innerHTML = `<h5 class="group-header">${group.label}</h5>`;

    const contentDiv = document.createElement('div');
    contentDiv.className = 'group-content';

    for (const param of group.parameters) {
      if (!param.hidden) {
        const control = this.createParameterControl(param);
        contentDiv.appendChild(control);
      }
    }

    groupDiv.appendChild(contentDiv);
    return groupDiv;
  }

  /**
   * Create parameter control element
   */
  private createParameterControl(definition: ParameterDefinition): HTMLElement {
    const controlDiv = document.createElement('div');
    controlDiv.className = 'parameter-control';

    const label = document.createElement('label');
    label.textContent = definition.label;
    if (definition.description) {
      label.title = definition.description;
    }
    controlDiv.appendChild(label);

    const value = this.getValue(definition.key)!;

    switch (definition.type) {
      case ParameterType.NUMBER:
        const numberInput = document.createElement('input');
        numberInput.type = 'range';
        numberInput.min = definition.min?.toString() || '0';
        numberInput.max = definition.max?.toString() || '100';
        numberInput.step = definition.step?.toString() || '1';
        numberInput.value = value.toString();
        numberInput.disabled = definition.readonly || false;

        const valueSpan = document.createElement('span');
        valueSpan.className = 'parameter-value';
        valueSpan.textContent = value.toString();

        numberInput.addEventListener('input', () => {
          const newValue = parseFloat(numberInput.value);
          if (this.setValue(definition.key, newValue, 'ui')) {
            valueSpan.textContent = newValue.toString();
          }
        });

        controlDiv.appendChild(numberInput);
        controlDiv.appendChild(valueSpan);
        break;

      case ParameterType.BOOLEAN:
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = value as boolean;
        checkbox.disabled = definition.readonly || false;

        checkbox.addEventListener('change', () => {
          this.setValue(definition.key, checkbox.checked, 'ui');
        });

        controlDiv.appendChild(checkbox);
        break;

      case ParameterType.ENUM:
        const select = document.createElement('select');
        select.disabled = definition.readonly || false;

        for (const option of definition.options || []) {
          const optionElement = document.createElement('option');
          optionElement.value = option;
          optionElement.textContent = option;
          optionElement.selected = option === value;
          select.appendChild(optionElement);
        }

        select.addEventListener('change', () => {
          this.setValue(definition.key, select.value, 'ui');
        });

        controlDiv.appendChild(select);
        break;
    }

    return controlDiv;
  }
}

/**
 * Factory function for creating parameter managers
 */
export function createParameterManager(): ParameterManager {
  return new ParameterManager();
}