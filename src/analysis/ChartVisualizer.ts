import {
  Chart,
  ChartConfiguration,
  ChartType,
  ChartOptions,
  registerables,
} from 'chart.js';
import { EventEmitter } from 'eventemitter3';
import type { DataCollector } from './DataCollector';
import type { StatisticsEngine } from './StatisticsEngine';

// Register Chart.js components
Chart.register(...registerables);

export interface ChartConfig {
  type: ChartType;
  title: string;
  container: HTMLCanvasElement;
  dataSeries: string[];
  updateInterval: number;
  maxDataPoints: number;
  colors: string[];
  options?: Partial<ChartOptions>;
}

export interface ChartTheme {
  backgroundColor: string;
  gridColor: string;
  textColor: string;
  colors: string[];
}

export class ChartVisualizer extends EventEmitter {
  private dataCollector: DataCollector;
  private statisticsEngine: StatisticsEngine | undefined;
  private charts: Map<string, Chart> = new Map();
  private updateIntervals: Map<string, NodeJS.Timeout> = new Map();
  private themes: Map<string, ChartTheme> = new Map();

  constructor(
    dataCollector: DataCollector,
    statisticsEngine?: StatisticsEngine
  ) {
    super();
    this.dataCollector = dataCollector;
    this.statisticsEngine = statisticsEngine;
    this.initializeThemes();
    this.setupEventListeners();
  }

  private initializeThemes(): void {
    // Default theme
    this.themes.set('default', {
      backgroundColor: '#ffffff',
      gridColor: '#e5e5e5',
      textColor: '#333333',
      colors: [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40',
        '#FF6384',
        '#C9CBCF',
      ],
    });

    // Dark theme
    this.themes.set('dark', {
      backgroundColor: '#2d3748',
      gridColor: '#4a5568',
      textColor: '#e2e8f0',
      colors: [
        '#FED7D7',
        '#BEE3F8',
        '#FEFCBF',
        '#B2F5EA',
        '#D6F5D6',
        '#FDEBC5',
        '#F7FAFC',
        '#E2E8F0',
      ],
    });

    // Educational theme (high contrast, colorblind friendly)
    this.themes.set('accessible', {
      backgroundColor: '#ffffff',
      gridColor: '#cccccc',
      textColor: '#000000',
      colors: [
        '#1f77b4',
        '#ff7f0e',
        '#2ca02c',
        '#d62728',
        '#9467bd',
        '#8c564b',
        '#e377c2',
        '#7f7f7f',
      ],
    });
  }

  private setupEventListeners(): void {
    this.dataCollector.on('data:collected', () => {
      this.updateAllCharts();
    });

    if (this.statisticsEngine) {
      this.statisticsEngine.on('statistic:updated', () => {
        this.updateStatisticsCharts();
      });
    }
  }

  public createTimeSeriesChart(
    config: Partial<ChartConfig> & { id: string }
  ): Chart {
    const chartConfig = this.buildTimeSeriesConfig(config);
    const chart = new Chart(config.container!, chartConfig);

    this.charts.set(config.id, chart);

    if (config.updateInterval && config.updateInterval > 0) {
      const intervalId = setInterval(() => {
        this.updateChart(config.id);
      }, config.updateInterval);
      this.updateIntervals.set(config.id, intervalId);
    }

    this.emit('chart:created', { id: config.id, type: 'timeSeries' });
    return chart;
  }

  public createHistogramChart(
    config: Partial<ChartConfig> & { id: string; seriesName: string }
  ): Chart {
    const chartConfig = this.buildHistogramConfig(config);
    const chart = new Chart(config.container!, chartConfig);

    this.charts.set(config.id, chart);
    this.emit('chart:created', { id: config.id, type: 'histogram' });
    return chart;
  }

  public createScatterPlot(
    config: Partial<ChartConfig> & {
      id: string;
      xSeries: string;
      ySeries: string;
    }
  ): Chart {
    const chartConfig = this.buildScatterConfig(config);
    const chart = new Chart(config.container!, chartConfig);

    this.charts.set(config.id, chart);
    this.emit('chart:created', { id: config.id, type: 'scatter' });
    return chart;
  }

  public createNetworkMetricsChart(
    config: Partial<ChartConfig> & { id: string }
  ): Chart {
    const chartConfig = this.buildNetworkMetricsConfig(config);
    const chart = new Chart(config.container!, chartConfig);

    this.charts.set(config.id, chart);

    if (config.updateInterval && config.updateInterval > 0) {
      const intervalId = setInterval(() => {
        this.updateNetworkChart(config.id);
      }, config.updateInterval);
      this.updateIntervals.set(config.id, intervalId);
    }

    this.emit('chart:created', { id: config.id, type: 'networkMetrics' });
    return chart;
  }

  public createStatisticsDashboard(
    containerId: string,
    _theme: string = 'default'
  ): HTMLElement {
    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Container with id '${containerId}' not found`);
    }

    const dashboard = document.createElement('div');
    dashboard.className = 'charts-dashboard';
    dashboard.innerHTML = `
      <div class="dashboard-grid">
        <div class="chart-container">
          <h3>Population Dynamics</h3>
          <canvas id="${containerId}_population"></canvas>
        </div>
        <div class="chart-container">
          <h3>Autonomy Levels</h3>
          <canvas id="${containerId}_autonomy"></canvas>
        </div>
        <div class="chart-container">
          <h3>Network Growth</h3>
          <canvas id="${containerId}_network"></canvas>
        </div>
        <div class="chart-container">
          <h3>Resource Distribution</h3>
          <canvas id="${containerId}_resources"></canvas>
        </div>
      </div>
    `;

    container.appendChild(dashboard);

    // Create individual charts
    this.createTimeSeriesChart({
      id: `${containerId}_population`,
      container: document.getElementById(
        `${containerId}_population`
      ) as HTMLCanvasElement,
      dataSeries: ['totalAgents'],
      title: 'Agent Population Over Time',
      updateInterval: 1000,
      maxDataPoints: 100,
    });

    this.createTimeSeriesChart({
      id: `${containerId}_autonomy`,
      container: document.getElementById(
        `${containerId}_autonomy`
      ) as HTMLCanvasElement,
      dataSeries: ['averageAutonomy'],
      title: 'Average Autonomy Level',
      updateInterval: 1000,
      maxDataPoints: 100,
    });

    this.createNetworkMetricsChart({
      id: `${containerId}_network`,
      container: document.getElementById(
        `${containerId}_network`
      ) as HTMLCanvasElement,
      title: 'Network Metrics',
      updateInterval: 1000,
      maxDataPoints: 100,
    });

    this.createTimeSeriesChart({
      id: `${containerId}_resources`,
      container: document.getElementById(
        `${containerId}_resources`
      ) as HTMLCanvasElement,
      dataSeries: ['averageResources'],
      title: 'Average Resources',
      updateInterval: 1000,
      maxDataPoints: 100,
    });

    return dashboard;
  }

  private buildTimeSeriesConfig(
    config: Partial<ChartConfig> & { id: string }
  ): ChartConfiguration {
    const theme = this.themes.get('default')!;

    return {
      type: 'line',
      data: {
        labels: [],
        datasets: (config.dataSeries || []).map((series, index) => ({
          label: series,
          data: [],
          borderColor: theme.colors[index % theme.colors.length],
          backgroundColor: theme.colors[index % theme.colors.length] + '20',
          fill: false,
          tension: 0.1,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: config.title || 'Time Series Chart',
          },
          legend: {
            display: true,
          },
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: 'Time Steps',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Value',
            },
          },
        },
        animation: {
          duration: 200,
        },
        ...config.options,
      },
    };
  }

  private buildHistogramConfig(
    config: Partial<ChartConfig> & { id: string; seriesName: string }
  ): ChartConfiguration {
    const theme = this.themes.get('default')!;

    return {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: config.seriesName,
            data: [],
            backgroundColor: theme.colors[0] + '80',
            borderColor: theme.colors[0],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: config.title || `${config.seriesName} Distribution`,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Value Range',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Frequency',
            },
          },
        },
        ...config.options,
      },
    };
  }

  private buildScatterConfig(
    config: Partial<ChartConfig> & {
      id: string;
      xSeries: string;
      ySeries: string;
    }
  ): ChartConfiguration {
    const theme = this.themes.get('default')!;

    return {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `${config.xSeries} vs ${config.ySeries}`,
            data: [],
            backgroundColor: theme.colors[0] + '80',
            borderColor: theme.colors[0],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: config.title || `${config.xSeries} vs ${config.ySeries}`,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: config.xSeries,
            },
          },
          y: {
            title: {
              display: true,
              text: config.ySeries,
            },
          },
        },
        ...config.options,
      },
    };
  }

  private buildNetworkMetricsConfig(
    config: Partial<ChartConfig> & { id: string }
  ): ChartConfiguration {
    const theme = this.themes.get('default')!;

    return {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Total Connections',
            data: [],
            borderColor: theme.colors[0],
            backgroundColor: theme.colors[0] + '20',
            yAxisID: 'y',
          },
          {
            label: 'Network Density',
            data: [],
            borderColor: theme.colors[1],
            backgroundColor: theme.colors[1] + '20',
            yAxisID: 'y1',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: config.title || 'Network Metrics',
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Time Steps',
            },
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: {
              display: true,
              text: 'Connections',
            },
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: {
              display: true,
              text: 'Density',
            },
            grid: {
              drawOnChartArea: false,
            },
          },
        },
        ...config.options,
      },
    };
  }

  private updateChart(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (!chart) return;

    // Update based on chart type
    const chartType = (chart.config as any).type;
    if (chartType === 'line') {
      this.updateTimeSeriesChart(chartId, chart);
    } else if (chartType === 'bar') {
      this.updateHistogramChart(chartId, chart);
    } else if (chartType === 'scatter') {
      this.updateScatterChart(chartId, chart);
    }
  }

  private updateTimeSeriesChart(_chartId: string, chart: Chart): void {
    const config = chart.config as ChartConfiguration<'line'>;
    const datasets = config.data?.datasets || [];

    datasets.forEach((dataset, index) => {
      const seriesName = dataset.label;
      if (seriesName) {
        const data = this.dataCollector.getTimeSeries(seriesName);
        const maxPoints = 100; // Configurable max points

        // Get recent data points
        const recentData = data.slice(-maxPoints);

        // Update labels (time steps)
        if (index === 0) {
          config.data!.labels = recentData.map(point => point.step);
        }

        // Update dataset values
        dataset.data = recentData.map(point => point.value);
      }
    });

    chart.update('none'); // No animation for real-time updates
  }

  private updateHistogramChart(_chartId: string, _chart: Chart): void {
    // Implementation for histogram updates
    // This would calculate distribution bins from current data
  }

  private updateScatterChart(_chartId: string, _chart: Chart): void {
    // Implementation for scatter plot updates
    // This would plot x,y pairs from two data series
  }

  private updateNetworkChart(chartId: string): void {
    const chart = this.charts.get(chartId);
    if (!chart) return;

    const history = this.dataCollector.getSimulationHistory();
    const maxPoints = 100;
    const recentHistory = history.slice(-maxPoints);

    const config = chart.config as ChartConfiguration<'line'>;

    // Update labels
    config.data!.labels = recentHistory.map(h => h.step);

    // Update datasets
    if (config.data?.datasets && config.data.datasets.length >= 2) {
      config.data.datasets[0]!.data = recentHistory.map(
        h => h.totalConnections
      );
      config.data.datasets[1]!.data = recentHistory.map(h => h.networkDensity);
    }

    chart.update('none');
  }

  private updateAllCharts(): void {
    this.charts.forEach((_chart, chartId) => {
      this.updateChart(chartId);
    });
  }

  private updateStatisticsCharts(): void {
    // Update charts that display statistics
    if (!this.statisticsEngine) return;

    const currentStats = this.statisticsEngine.getAllCurrentStatistics();
    this.emit('statistics:updated', currentStats);
  }

  // Public API methods
  public setTheme(chartId: string, themeName: string): void {
    const chart = this.charts.get(chartId);
    const theme = this.themes.get(themeName);

    if (!chart || !theme) return;

    // Update chart colors based on theme
    const config = chart.config;
    if (config.data?.datasets) {
      config.data.datasets.forEach((dataset, index) => {
        if ('borderColor' in dataset) {
          dataset.borderColor = theme.colors[index % theme.colors.length];
        }
        if ('backgroundColor' in dataset) {
          dataset.backgroundColor =
            theme.colors[index % theme.colors.length] + '20';
        }
      });
    }

    chart.update();
  }

  public destroyChart(chartId: string): void {
    const chart = this.charts.get(chartId);
    const intervalId = this.updateIntervals.get(chartId);

    if (chart) {
      chart.destroy();
      this.charts.delete(chartId);
    }

    if (intervalId) {
      clearInterval(intervalId);
      this.updateIntervals.delete(chartId);
    }

    this.emit('chart:destroyed', { id: chartId });
  }

  public destroyAllCharts(): void {
    Array.from(this.charts.keys()).forEach(chartId => {
      this.destroyChart(chartId);
    });
  }

  public exportChart(
    chartId: string,
    format: 'png' | 'jpeg' | 'pdf' = 'png'
  ): string | null {
    const chart = this.charts.get(chartId);
    if (!chart) return null;

    return chart.toBase64Image('image/' + format, 1);
  }

  public getChartSummary(): {
    totalCharts: number;
    activeCharts: string[];
    availableThemes: string[];
    availableDataSeries: string[];
  } {
    return {
      totalCharts: this.charts.size,
      activeCharts: Array.from(this.charts.keys()),
      availableThemes: Array.from(this.themes.keys()),
      availableDataSeries: this.dataCollector.getAvailableTimeSeries(),
    };
  }
}
