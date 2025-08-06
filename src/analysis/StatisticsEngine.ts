import { EventEmitter } from 'eventemitter3';
import type { DataCollector, DataPoint } from './DataCollector';

export interface StatisticsResult {
  name: string;
  value: number;
  confidence?: number;
  metadata?: Record<string, any>;
}

export interface TrendAnalysis {
  slope: number;
  correlation: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: 'weak' | 'moderate' | 'strong';
  significance: number;
}

export interface DistributionAnalysis {
  mean: number;
  median: number;
  mode: number[];
  standardDeviation: number;
  variance: number;
  skewness: number;
  kurtosis: number;
  quartiles: [number, number, number];
  outliers: number[];
}

export interface NetworkAnalysis {
  density: number;
  clustering: number;
  averagePathLength: number;
  centralityMetrics: {
    degree: Record<string, number>;
    betweenness: Record<string, number>;
    closeness: Record<string, number>;
  };
  communities: string[][];
  smallWorldCoefficient: number;
}

export interface StatisticsEngineConfig {
  analysisInterval: number;
  enableTrendAnalysis: boolean;
  enableDistributionAnalysis: boolean;
  enableNetworkAnalysis: boolean;
  minDataPointsForAnalysis: number;
  confidenceLevel: number;
}

export class StatisticsEngine extends EventEmitter {
  private dataCollector: DataCollector;
  private config: StatisticsEngineConfig;
  private analysisResults: Map<string, StatisticsResult[]> = new Map();
  private lastAnalysisTime: number = 0;

  constructor(
    dataCollector: DataCollector,
    config: Partial<StatisticsEngineConfig> = {}
  ) {
    super();
    this.dataCollector = dataCollector;
    this.config = {
      analysisInterval: 1000, // 1 second
      enableTrendAnalysis: true,
      enableDistributionAnalysis: true,
      enableNetworkAnalysis: true,
      minDataPointsForAnalysis: 10,
      confidenceLevel: 0.95,
      ...config,
    };

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.dataCollector.on('data:collected', () => {
      if (this.shouldPerformAnalysis()) {
        this.performAnalysis();
      }
    });
  }

  private shouldPerformAnalysis(): boolean {
    const now = Date.now();
    return now - this.lastAnalysisTime >= this.config.analysisInterval;
  }

  private performAnalysis(): void {
    const now = Date.now();

    // Analyze all available time series
    const availableSeries = this.dataCollector.getAvailableTimeSeries();

    availableSeries.forEach(seriesName => {
      const data = this.dataCollector.getTimeSeries(seriesName);
      if (data.length >= this.config.minDataPointsForAnalysis) {
        this.analyzeTimeSeries(seriesName, data);
      }
    });

    // Analyze simulation-level metrics
    this.analyzeSimulationMetrics();

    // Perform network analysis if enabled
    if (this.config.enableNetworkAnalysis) {
      this.analyzeNetworkMetrics();
    }

    this.lastAnalysisTime = now;
    this.emit('analysis:complete', { timestamp: now });
  }

  private analyzeTimeSeries(seriesName: string, data: DataPoint[]): void {
    const values = data.map(point => point.value);

    // Basic statistics
    const basicStats = this.calculateBasicStatistics(values);
    this.storeResult(seriesName, 'mean', basicStats.mean);
    this.storeResult(seriesName, 'median', basicStats.median);
    this.storeResult(
      seriesName,
      'standardDeviation',
      basicStats.standardDeviation
    );

    // Trend analysis
    if (this.config.enableTrendAnalysis) {
      const trendAnalysis = this.analyzeTrend(values);
      this.storeResult(seriesName, 'trend_slope', trendAnalysis.slope);
      this.storeResult(
        seriesName,
        'trend_correlation',
        trendAnalysis.correlation
      );
    }

    // Distribution analysis
    if (this.config.enableDistributionAnalysis) {
      const distributionAnalysis = this.analyzeDistribution(values);
      this.storeResult(seriesName, 'skewness', distributionAnalysis.skewness);
      this.storeResult(seriesName, 'kurtosis', distributionAnalysis.kurtosis);
    }
  }

  private calculateBasicStatistics(values: number[]): {
    mean: number;
    median: number;
    mode: number[];
    standardDeviation: number;
    variance: number;
    min: number;
    max: number;
    range: number;
  } {
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = values.length;

    // Mean
    const mean = values.reduce((sum, val) => sum + val, 0) / n;

    // Median
    const median =
      n % 2 === 0
        ? (sortedValues[n / 2 - 1]! + sortedValues[n / 2]!) / 2
        : sortedValues[Math.floor(n / 2)]!;

    // Mode
    const frequencyMap = new Map<number, number>();
    values.forEach(value => {
      frequencyMap.set(value, (frequencyMap.get(value) || 0) + 1);
    });
    const maxFrequency = Math.max(...frequencyMap.values());
    const mode = Array.from(frequencyMap.entries())
      .filter(([_, freq]) => freq === maxFrequency)
      .map(([value, _]) => value);

    // Variance and Standard Deviation
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const standardDeviation = Math.sqrt(variance);

    // Min, Max, Range
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    return {
      mean,
      median,
      mode,
      standardDeviation,
      variance,
      min,
      max,
      range,
    };
  }

  private analyzeTrend(values: number[]): TrendAnalysis {
    if (values.length < 2) {
      return {
        slope: 0,
        correlation: 0,
        direction: 'stable',
        strength: 'weak',
        significance: 0,
      };
    }

    const n = values.length;
    const xValues = Array.from({ length: n }, (_, i) => i);

    // Calculate linear regression
    const xMean = xValues.reduce((sum, x) => sum + x, 0) / n;
    const yMean = values.reduce((sum, y) => sum + y, 0) / n;

    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;

    for (let i = 0; i < n; i++) {
      const xDiff = xValues[i]! - xMean;
      const yDiff = values[i]! - yMean;

      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }

    const correlation = numerator / Math.sqrt(xDenominator * yDenominator);
    const slope = numerator / xDenominator;

    // Determine direction and strength
    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.001) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    const absCorrelation = Math.abs(correlation);
    let strength: 'weak' | 'moderate' | 'strong';
    if (absCorrelation < 0.3) {
      strength = 'weak';
    } else if (absCorrelation < 0.7) {
      strength = 'moderate';
    } else {
      strength = 'strong';
    }

    // Simple significance test (based on correlation strength)
    const significance = absCorrelation;

    return {
      slope,
      correlation,
      direction,
      strength,
      significance,
    };
  }

  private analyzeDistribution(values: number[]): DistributionAnalysis {
    const basicStats = this.calculateBasicStatistics(values);
    const n = values.length;
    const mean = basicStats.mean;
    const stdDev = basicStats.standardDeviation;

    // Quartiles
    const sortedValues = [...values].sort((a, b) => a - b);
    const q1Index = Math.floor(n * 0.25);
    const q2Index = Math.floor(n * 0.5);
    const q3Index = Math.floor(n * 0.75);
    const quartiles: [number, number, number] = [
      sortedValues[q1Index]!,
      sortedValues[q2Index]!,
      sortedValues[q3Index]!,
    ];

    // Skewness
    const skewness =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 3);
      }, 0) / n;

    // Kurtosis
    const kurtosis =
      values.reduce((sum, val) => {
        return sum + Math.pow((val - mean) / stdDev, 4);
      }, 0) /
        n -
      3; // Excess kurtosis

    // Outliers (using IQR method)
    const iqr = quartiles[2] - quartiles[0];
    const lowerBound = quartiles[0] - 1.5 * iqr;
    const upperBound = quartiles[2] + 1.5 * iqr;
    const outliers = values.filter(val => val < lowerBound || val > upperBound);

    return {
      mean: basicStats.mean,
      median: basicStats.median,
      mode: basicStats.mode,
      standardDeviation: basicStats.standardDeviation,
      variance: basicStats.variance,
      skewness,
      kurtosis,
      quartiles,
      outliers,
    };
  }

  private analyzeSimulationMetrics(): void {
    const history = this.dataCollector.getSimulationHistory();
    if (history.length < this.config.minDataPointsForAnalysis) return;

    // Analyze population dynamics
    const populationCounts = history.map(h => h.totalAgents);
    const populationStats = this.calculateBasicStatistics(populationCounts);
    this.storeResult(
      'simulation',
      'population_stability',
      1 - populationStats.standardDeviation / populationStats.mean
    );

    // Analyze network evolution
    const networkDensities = history.map(h => h.networkDensity);
    const networkTrend = this.analyzeTrend(networkDensities);
    this.storeResult('simulation', 'network_growth_rate', networkTrend.slope);

    // Analyze autonomy distribution
    const autonomyLevels = history.map(h => h.averageAutonomy);
    const autonomyTrend = this.analyzeTrend(autonomyLevels);
    this.storeResult('simulation', 'autonomy_trend', autonomyTrend.slope);
  }

  private analyzeNetworkMetrics(): void {
    // This would require network topology analysis
    // For now, we'll calculate basic network statistics
    const currentMetrics = this.dataCollector.getCurrentMetrics();
    if (!currentMetrics) return;

    this.storeResult('network', 'density', currentMetrics.networkDensity);
    this.storeResult(
      'network',
      'total_connections',
      currentMetrics.totalConnections
    );
  }

  private storeResult(
    category: string,
    metric: string,
    value: number,
    metadata?: Record<string, any>
  ): void {
    const key = `${category}_${metric}`;

    if (!this.analysisResults.has(key)) {
      this.analysisResults.set(key, []);
    }

    const results = this.analysisResults.get(key)!;
    results.push({
      name: key,
      value,
      confidence: this.config.confidenceLevel,
      metadata: {
        timestamp: Date.now(),
        category,
        metric,
        ...metadata,
      },
    });

    // Keep only recent results
    if (results.length > 100) {
      results.splice(0, results.length - 100);
    }

    this.emit('statistic:updated', { name: key, value, category, metric });
  }

  // Public API methods
  public getStatistic(
    category: string,
    metric: string
  ): StatisticsResult | null {
    const key = `${category}_${metric}`;
    const results = this.analysisResults.get(key);
    return results && results.length > 0 ? results[results.length - 1]! : null;
  }

  public getStatisticHistory(
    category: string,
    metric: string
  ): StatisticsResult[] {
    const key = `${category}_${metric}`;
    return this.analysisResults.get(key) || [];
  }

  public getAllCurrentStatistics(): Record<string, StatisticsResult> {
    const current: Record<string, StatisticsResult> = {};

    this.analysisResults.forEach((results, key) => {
      if (results.length > 0) {
        current[key] = results[results.length - 1]!;
      }
    });

    return current;
  }

  public getAvailableMetrics(): string[] {
    return Array.from(this.analysisResults.keys());
  }

  public generateReport(): {
    summary: Record<string, number>;
    trends: Record<string, TrendAnalysis>;
    distributions: Record<string, DistributionAnalysis>;
    timestamp: number;
  } {
    const summary: Record<string, number> = {};
    const trends: Record<string, TrendAnalysis> = {};
    const distributions: Record<string, DistributionAnalysis> = {};

    // Generate summary of current statistics
    const currentStats = this.getAllCurrentStatistics();
    Object.entries(currentStats).forEach(([key, result]) => {
      summary[key] = result.value;
    });

    // Generate trend analysis for time series
    const availableSeries = this.dataCollector.getAvailableTimeSeries();
    availableSeries.forEach(seriesName => {
      const data = this.dataCollector.getTimeSeries(seriesName);
      if (data.length >= this.config.minDataPointsForAnalysis) {
        const values = data.map(point => point.value);
        trends[seriesName] = this.analyzeTrend(values);
        distributions[seriesName] = this.analyzeDistribution(values);
      }
    });

    return {
      summary,
      trends,
      distributions,
      timestamp: Date.now(),
    };
  }

  public reset(): void {
    this.analysisResults.clear();
    this.lastAnalysisTime = 0;
    this.emit('statistics:reset');
  }

  public exportResults(): {
    statistics: Record<string, StatisticsResult[]>;
    config: StatisticsEngineConfig;
    exportTimestamp: number;
  } {
    const statistics: Record<string, StatisticsResult[]> = {};
    this.analysisResults.forEach((results, key) => {
      statistics[key] = [...results];
    });

    return {
      statistics,
      config: { ...this.config },
      exportTimestamp: Date.now(),
    };
  }
}
