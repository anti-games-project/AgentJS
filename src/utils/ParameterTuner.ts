import { EventEmitter } from 'eventemitter3';
import type {
  ConfigurationManager,
} from './ConfigurationManager';
import type { DataCollector } from '../analysis/DataCollector';
import type { StatisticsEngine } from '../analysis/StatisticsEngine';

export interface TuningTarget {
  metric: string;
  target: 'maximize' | 'minimize' | 'target';
  targetValue?: number;
  weight: number;
}

export interface TuningParameter {
  key: string;
  min: number;
  max: number;
  step: number;
  current: number;
}

export interface TuningExperiment {
  id: string;
  parameters: Record<string, number>;
  results: Record<string, number>;
  score: number;
  timestamp: number;
}

export interface TuningConfig {
  algorithm: 'grid' | 'random' | 'genetic' | 'bayesian';
  maxIterations: number;
  maxRuntime: number; // milliseconds
  convergenceThreshold: number;
  parallelRuns: number;
  stepsPerExperiment: number;
}

export class ParameterTuner extends EventEmitter {
  private configManager: ConfigurationManager;
  private dataCollector: DataCollector;
  private statisticsEngine: StatisticsEngine;
  private config: TuningConfig;

  private tuningParameters: Map<string, TuningParameter> = new Map();
  private tuningTargets: TuningTarget[] = [];
  private experiments: TuningExperiment[] = [];
  private bestExperiment: TuningExperiment | null = null;

  private isRunning: boolean = false;
  private currentIteration: number = 0;
  private startTime: number = 0;

  constructor(
    configManager: ConfigurationManager,
    dataCollector: DataCollector,
    statisticsEngine: StatisticsEngine,
    config: Partial<TuningConfig> = {}
  ) {
    super();
    this.configManager = configManager;
    this.dataCollector = dataCollector;
    this.statisticsEngine = statisticsEngine;

    this.config = {
      algorithm: 'random',
      maxIterations: 100,
      maxRuntime: 300000, // 5 minutes
      convergenceThreshold: 0.001,
      parallelRuns: 1,
      stepsPerExperiment: 200,
      ...config,
    };
  }

  // Parameter management
  public addTuningParameter(
    key: string,
    min: number,
    max: number,
    step: number = 1
  ): void {
    const paramDef = this.configManager.getParameterDefinition(key);
    if (!paramDef) {
      throw new Error(`Parameter ${key} not found in configuration schema`);
    }

    if (paramDef.type !== 'number') {
      throw new Error(`Parameter ${key} must be numeric for tuning`);
    }

    const current =
      this.configManager.getParameter(key) || paramDef.defaultValue;

    this.tuningParameters.set(key, {
      key,
      min: Math.max(min, paramDef.min || Number.MIN_SAFE_INTEGER),
      max: Math.min(max, paramDef.max || Number.MAX_SAFE_INTEGER),
      step,
      current,
    });

    this.emit('parameter:added', { key, min, max, step, current });
  }

  public removeTuningParameter(key: string): void {
    this.tuningParameters.delete(key);
    this.emit('parameter:removed', { key });
  }

  public addTuningTarget(target: TuningTarget): void {
    this.tuningTargets.push(target);
    this.emit('target:added', target);
  }

  public removeTuningTarget(metric: string): void {
    const index = this.tuningTargets.findIndex(t => t.metric === metric);
    if (index >= 0) {
      const removed = this.tuningTargets.splice(index, 1)[0];
      this.emit('target:removed', removed);
    }
  }

  // Tuning execution
  public async startTuning(): Promise<TuningExperiment | null> {
    if (this.isRunning) {
      throw new Error('Tuning is already running');
    }

    if (this.tuningParameters.size === 0) {
      throw new Error('No tuning parameters defined');
    }

    if (this.tuningTargets.length === 0) {
      throw new Error('No tuning targets defined');
    }

    this.isRunning = true;
    this.currentIteration = 0;
    this.startTime = Date.now();
    this.experiments = [];
    this.bestExperiment = null;

    this.emit('tuning:started', {
      algorithm: this.config.algorithm,
      parameters: Array.from(this.tuningParameters.keys()),
      targets: this.tuningTargets.map(t => t.metric),
    });

    try {
      switch (this.config.algorithm) {
        case 'grid':
          await this.runGridSearch();
          break;
        case 'random':
          await this.runRandomSearch();
          break;
        case 'genetic':
          await this.runGeneticAlgorithm();
          break;
        case 'bayesian':
          await this.runBayesianOptimization();
          break;
        default:
          throw new Error(`Unknown tuning algorithm: ${this.config.algorithm}`);
      }
    } catch (error) {
      this.emit('tuning:error', error);
      throw error;
    } finally {
      this.isRunning = false;
      this.emit('tuning:completed', {
        bestExperiment: this.bestExperiment,
        totalExperiments: this.experiments.length,
        runtime: Date.now() - this.startTime,
      });
    }

    return this.bestExperiment;
  }

  public stopTuning(): void {
    this.isRunning = false;
    this.emit('tuning:stopped');
  }

  // Algorithm implementations
  private async runGridSearch(): Promise<void> {
    const parameterKeys = Array.from(this.tuningParameters.keys());
    const parameterRanges = parameterKeys.map(key => {
      const param = this.tuningParameters.get(key)!;
      const values: number[] = [];
      for (let value = param.min; value <= param.max; value += param.step) {
        values.push(value);
      }
      return values;
    });

    const totalCombinations = parameterRanges.reduce(
      (total, range) => total * range.length,
      1
    );

    if (totalCombinations > this.config.maxIterations) {
      this.emit(
        'tuning:warning',
        `Grid search would require ${totalCombinations} experiments, limiting to ${this.config.maxIterations}`
      );
    }

    const combinations = this.generateGridCombinations(
      parameterRanges,
      parameterKeys
    );

    for (const combination of combinations.slice(
      0,
      this.config.maxIterations
    )) {
      if (!this.isRunning || this.shouldStop()) break;

      await this.runExperiment(combination);
      this.currentIteration++;
    }
  }

  private async runRandomSearch(): Promise<void> {
    while (
      this.isRunning &&
      this.currentIteration < this.config.maxIterations &&
      !this.shouldStop()
    ) {
      const parameters = this.generateRandomParameters();
      await this.runExperiment(parameters);
      this.currentIteration++;
    }
  }

  private async runGeneticAlgorithm(): Promise<void> {
    const populationSize = Math.min(20, this.config.maxIterations);
    const generations = Math.floor(this.config.maxIterations / populationSize);

    // Initialize population
    let population: Record<string, number>[] = [];
    for (let i = 0; i < populationSize; i++) {
      population.push(this.generateRandomParameters());
    }

    for (
      let gen = 0;
      gen < generations && this.isRunning && !this.shouldStop();
      gen++
    ) {
      // Evaluate population
      const evaluatedPopulation: Array<{
        parameters: Record<string, number>;
        score: number;
      }> = [];

      for (const individual of population) {
        if (!this.isRunning || this.shouldStop()) break;

        const experiment = await this.runExperiment(individual);
        evaluatedPopulation.push({
          parameters: individual,
          score: experiment.score,
        });
        this.currentIteration++;
      }

      if (!this.isRunning || this.shouldStop()) break;

      // Selection and reproduction
      evaluatedPopulation.sort((a, b) => b.score - a.score);
      const elite = evaluatedPopulation.slice(
        0,
        Math.floor(populationSize * 0.2)
      );

      // Generate new population
      const newPopulation: Record<string, number>[] = [];

      // Keep elite
      elite.forEach(individual => {
        newPopulation.push({ ...individual.parameters });
      });

      // Generate offspring
      while (newPopulation.length < populationSize) {
        const parent1 = this.tournamentSelection(evaluatedPopulation);
        const parent2 = this.tournamentSelection(evaluatedPopulation);
        const offspring = this.crossover(
          parent1.parameters,
          parent2.parameters
        );
        this.mutate(offspring);
        newPopulation.push(offspring);
      }

      population = newPopulation;

      this.emit('tuning:generation', {
        generation: gen,
        bestScore: evaluatedPopulation[0]?.score,
        averageScore:
          evaluatedPopulation.reduce((sum, ind) => sum + ind.score, 0) /
          evaluatedPopulation.length,
      });
    }
  }

  private async runBayesianOptimization(): Promise<void> {
    // Simplified Bayesian optimization
    // In practice, would use libraries like gaussian-process or similar

    // Start with random exploration
    const initialSamples = Math.min(
      10,
      Math.floor(this.config.maxIterations * 0.2)
    );

    for (
      let i = 0;
      i < initialSamples && this.isRunning && !this.shouldStop();
      i++
    ) {
      const parameters = this.generateRandomParameters();
      await this.runExperiment(parameters);
      this.currentIteration++;
    }

    // Continue with exploitation/exploration balance
    while (
      this.isRunning &&
      this.currentIteration < this.config.maxIterations &&
      !this.shouldStop()
    ) {
      // Simple acquisition function: choose parameters near best performing ones with some randomness
      const parameters = this.generateAcquisitionParameters();
      await this.runExperiment(parameters);
      this.currentIteration++;
    }
  }

  // Experiment execution
  private async runExperiment(
    parameters: Record<string, number>
  ): Promise<TuningExperiment> {
    const experimentId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Apply parameters to configuration
    const originalConfig = this.configManager.getConfig();

    Object.entries(parameters).forEach(([key, value]) => {
      this.configManager.setParameter(key, value);
    });

    // Reset data collection
    this.dataCollector.reset();
    this.statisticsEngine.reset();

    // Start data collection
    this.dataCollector.startCollection();

    // Run simulation for specified steps
    // Note: This assumes the simulation can be controlled externally
    // In practice, you'd integrate with your simulation loop
    await this.simulateSteps(this.config.stepsPerExperiment);

    // Stop data collection
    this.dataCollector.stopCollection();

    // Collect results
    const results = this.collectExperimentResults();
    const score = this.calculateScore(results);

    const experiment: TuningExperiment = {
      id: experimentId,
      parameters: { ...parameters },
      results,
      score,
      timestamp: Date.now(),
    };

    this.experiments.push(experiment);

    // Update best experiment
    if (!this.bestExperiment || score > this.bestExperiment.score) {
      this.bestExperiment = experiment;
      this.emit('tuning:new-best', experiment);
    }

    // Restore original configuration
    this.configManager.updateConfig(originalConfig);

    this.emit('tuning:experiment-complete', experiment);

    return experiment;
  }

  private async simulateSteps(_steps: number): Promise<void> {
    // This is a placeholder - in practice, you'd integrate with your simulation
    return new Promise(resolve => {
      setTimeout(resolve, 100); // Simulate some processing time
    });
  }

  private collectExperimentResults(): Record<string, number> {
    const results: Record<string, number> = {};

    // Collect final statistics for each target metric
    this.tuningTargets.forEach(target => {
      const statistic = this.statisticsEngine.getStatistic(
        'simulation',
        target.metric
      );
      if (statistic) {
        results[target.metric] = statistic.value;
      } else {
        // Try to get from time series data
        const timeSeries = this.dataCollector.getTimeSeries(target.metric);
        if (timeSeries.length > 0) {
          const lastPoint = timeSeries[timeSeries.length - 1];
          results[target.metric] = lastPoint?.value ?? 0;
        } else {
          results[target.metric] = 0;
        }
      }
    });

    return results;
  }

  private calculateScore(results: Record<string, number>): number {
    let totalScore = 0;
    let totalWeight = 0;

    this.tuningTargets.forEach(target => {
      const value = results[target.metric];
      if (value === undefined) return;

      let score = 0;

      switch (target.target) {
        case 'maximize':
          score = value;
          break;
        case 'minimize':
          score = -value;
          break;
        case 'target':
          if (target.targetValue !== undefined) {
            score = -Math.abs(value - target.targetValue);
          }
          break;
      }

      totalScore += score * target.weight;
      totalWeight += target.weight;
    });

    return totalWeight > 0 ? totalScore / totalWeight : 0;
  }

  // Utility methods for algorithms
  private generateRandomParameters(): Record<string, number> {
    const parameters: Record<string, number> = {};

    this.tuningParameters.forEach((param, key) => {
      const range = param.max - param.min;
      const steps = Math.floor(range / param.step);
      const randomStep = Math.floor(Math.random() * (steps + 1));
      parameters[key] = param.min + randomStep * param.step;
    });

    return parameters;
  }

  private generateGridCombinations(
    ranges: number[][],
    keys: string[]
  ): Record<string, number>[] {
    const combinations: Record<string, number>[] = [];

    const generate = (index: number, current: Record<string, number>) => {
      if (index === ranges.length) {
        combinations.push({ ...current });
        return;
      }

      const range = ranges[index];
      const key = keys[index];
      if (range && key !== undefined) {
        range.forEach(value => {
          current[key] = value;
          generate(index + 1, current);
        });
      }
    };

    generate(0, {});
    return combinations;
  }

  private generateAcquisitionParameters(): Record<string, number> {
    // Simple acquisition: blend best parameters with random exploration
    if (this.bestExperiment && Math.random() > 0.3) {
      // Exploit: use best parameters with small perturbations
      const parameters: Record<string, number> = {};

      this.tuningParameters.forEach((param, key) => {
        const bestValue = this.bestExperiment!.parameters[key] ?? param.min;
        const perturbation = (Math.random() - 0.5) * param.step * 3;
        const newValue = Math.max(
          param.min,
          Math.min(param.max, bestValue + perturbation)
        );
        parameters[key] = Math.round(newValue / param.step) * param.step;
      });

      return parameters;
    } else {
      // Explore: random parameters
      return this.generateRandomParameters();
    }
  }

  private tournamentSelection(
    population: Array<{ parameters: Record<string, number>; score: number }>
  ): { parameters: Record<string, number>; score: number } {
    const tournamentSize = Math.min(3, population.length);
    const tournament = [];

    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      const selected = population[randomIndex];
      if (selected) {
        tournament.push(selected);
      }
    }

    tournament.sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0));
    return tournament[0] ?? { parameters: {}, score: 0 };
  }

  private crossover(
    parent1: Record<string, number>,
    parent2: Record<string, number>
  ): Record<string, number> {
    const offspring: Record<string, number> = {};

    Object.keys(parent1).forEach(key => {
      const value1 = parent1[key];
      const value2 = parent2[key];
      offspring[key] = Math.random() > 0.5 ? (value1 ?? 0) : (value2 ?? 0);
    });

    return offspring;
  }

  private mutate(individual: Record<string, number>): void {
    const mutationRate = 0.1;

    Object.keys(individual).forEach(key => {
      if (Math.random() < mutationRate) {
        const param = this.tuningParameters.get(key)!;
        const range = param.max - param.min;
        const perturbation = (Math.random() - 0.5) * range * 0.1;
        const currentValue = individual[key] ?? param.min;
        const newValue = Math.max(
          param.min,
          Math.min(param.max, currentValue + perturbation)
        );
        individual[key] = Math.round(newValue / param.step) * param.step;
      }
    });
  }

  private shouldStop(): boolean {
    const runtime = Date.now() - this.startTime;
    return runtime >= this.config.maxRuntime || this.hasConverged();
  }

  private hasConverged(): boolean {
    if (this.experiments.length < 10) return false;

    const recentScores = this.experiments.slice(-10).map(exp => exp.score);
    const mean =
      recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
    const variance =
      recentScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) /
      recentScores.length;

    return Math.sqrt(variance) < this.config.convergenceThreshold;
  }

  // Public API methods
  public getTuningStatus(): {
    isRunning: boolean;
    currentIteration: number;
    maxIterations: number;
    runtime: number;
    bestScore: number | undefined;
    experimentsCount: number;
  } {
    return {
      isRunning: this.isRunning,
      currentIteration: this.currentIteration,
      maxIterations: this.config.maxIterations,
      runtime: this.isRunning ? Date.now() - this.startTime : 0,
      bestScore: this.bestExperiment?.score,
      experimentsCount: this.experiments.length,
    };
  }

  public getExperiments(): TuningExperiment[] {
    return [...this.experiments];
  }

  public getBestExperiment(): TuningExperiment | null {
    return this.bestExperiment;
  }

  public applyBestParameters(): boolean {
    if (!this.bestExperiment) return false;

    Object.entries(this.bestExperiment.parameters).forEach(([key, value]) => {
      this.configManager.setParameter(key, value);
    });

    this.emit('parameters:applied', this.bestExperiment.parameters);
    return true;
  }

  public exportResults(): {
    config: TuningConfig;
    parameters: Array<{ key: string } & TuningParameter>;
    targets: TuningTarget[];
    experiments: TuningExperiment[];
    bestExperiment: TuningExperiment | null;
    summary: {
      totalExperiments: number;
      bestScore: number | null;
      convergenceReached: boolean;
    };
  } {
    return {
      config: { ...this.config },
      parameters: Array.from(this.tuningParameters.entries()).map(
        ([paramKey, param]) => ({ ...param, key: paramKey })
      ),
      targets: [...this.tuningTargets],
      experiments: [...this.experiments],
      bestExperiment: this.bestExperiment,
      summary: {
        totalExperiments: this.experiments.length,
        bestScore: this.bestExperiment?.score || null,
        convergenceReached: this.hasConverged(),
      },
    };
  }
}
