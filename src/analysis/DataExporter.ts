import type { DataCollector, SimulationMetrics } from './DataCollector';
import type { StatisticsEngine } from './StatisticsEngine';

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx';
  includeTimestamps: boolean;
  includeMetadata: boolean;
  dateFormat: 'iso' | 'unix' | 'readable';
  precision: number;
  compression: boolean;
}

export interface ExportResult {
  data: string | Uint8Array;
  filename: string;
  mimeType: string;
  size: number;
}

export class DataExporter {
  private dataCollector: DataCollector;
  private statisticsEngine: StatisticsEngine | undefined;

  constructor(
    dataCollector: DataCollector,
    statisticsEngine?: StatisticsEngine
  ) {
    this.dataCollector = dataCollector;
    this.statisticsEngine = statisticsEngine;
  }

  public async exportTimeSeries(
    seriesNames: string[] = [],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const config = this.mergeExportOptions(options);
    const exportData = this.prepareTimeSeriesData(seriesNames, config);

    switch (config.format) {
      case 'csv':
        return this.exportToCSV(exportData, 'timeseries', config);
      case 'json':
        return this.exportToJSON(exportData, 'timeseries', config);
      case 'xlsx':
        return this.exportToXLSX(exportData, 'timeseries', config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  public async exportSimulationHistory(
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const config = this.mergeExportOptions(options);
    const history = this.dataCollector.getSimulationHistory();
    const exportData = this.prepareSimulationHistoryData(history, config);

    switch (config.format) {
      case 'csv':
        return this.exportToCSV(exportData, 'simulation_history', config);
      case 'json':
        return this.exportToJSON(exportData, 'simulation_history', config);
      case 'xlsx':
        return this.exportToXLSX(exportData, 'simulation_history', config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  public async exportAgentHistory(
    agentIds: string[] = [],
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const config = this.mergeExportOptions(options);
    const exportData = this.prepareAgentHistoryData(agentIds, config);

    switch (config.format) {
      case 'csv':
        return this.exportToCSV(exportData, 'agent_history', config);
      case 'json':
        return this.exportToJSON(exportData, 'agent_history', config);
      case 'xlsx':
        return this.exportToXLSX(exportData, 'agent_history', config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  public async exportStatistics(
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    if (!this.statisticsEngine) {
      throw new Error('StatisticsEngine not provided to DataExporter');
    }

    const config = this.mergeExportOptions(options);
    const statsReport = this.statisticsEngine.generateReport();
    const exportData = this.prepareStatisticsData(statsReport, config);

    switch (config.format) {
      case 'csv':
        return this.exportToCSV(exportData, 'statistics', config);
      case 'json':
        return this.exportToJSON(exportData, 'statistics', config);
      case 'xlsx':
        return this.exportToXLSX(exportData, 'statistics', config);
      default:
        throw new Error(`Unsupported export format: ${config.format}`);
    }
  }

  public async exportComplete(
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult> {
    const config = this.mergeExportOptions({ ...options, format: 'json' });

    const completeData = {
      metadata: {
        exportTimestamp: new Date().toISOString(),
        dataCollectorSummary: this.dataCollector.getDataSummary(),
        exportOptions: config,
      },
      timeSeries: this.prepareTimeSeriesData([], config),
      simulationHistory: this.dataCollector.getSimulationHistory(),
      agentHistory: this.prepareAgentHistoryData([], config),
      statistics: this.statisticsEngine
        ? this.statisticsEngine.generateReport()
        : null,
    };

    return this.exportToJSON(completeData, 'complete_export', config);
  }

  private mergeExportOptions(options: Partial<ExportOptions>): ExportOptions {
    return {
      format: 'csv',
      includeTimestamps: true,
      includeMetadata: true,
      dateFormat: 'iso',
      precision: 4,
      compression: false,
      ...options,
    };
  }

  private prepareTimeSeriesData(
    seriesNames: string[],
    config: ExportOptions
  ): any {
    const availableSeries =
      seriesNames.length > 0
        ? seriesNames
        : this.dataCollector.getAvailableTimeSeries();

    const timeSeriesData: Record<string, any[]> = {};

    availableSeries.forEach(seriesName => {
      const data = this.dataCollector.getTimeSeries(seriesName);
      timeSeriesData[seriesName] = data.map(point => ({
        timestamp: this.formatTimestamp(point.timestamp, config),
        step: point.step,
        value: this.formatNumber(point.value, config.precision),
        ...(config.includeMetadata && point.metadata
          ? { metadata: point.metadata }
          : {}),
      }));
    });

    return timeSeriesData;
  }

  private prepareSimulationHistoryData(
    history: SimulationMetrics[],
    config: ExportOptions
  ): any[] {
    return history.map(metrics => ({
      timestamp: this.formatTimestamp(metrics.timestamp, config),
      step: metrics.step,
      totalAgents: metrics.totalAgents,
      averageAutonomy: this.formatNumber(
        metrics.averageAutonomy,
        config.precision
      ),
      averageResources: this.formatNumber(
        metrics.averageResources,
        config.precision
      ),
      totalConnections: metrics.totalConnections,
      networkDensity: this.formatNumber(
        metrics.networkDensity,
        config.precision
      ),
      populationByType: metrics.populationByType,
      spatialDistribution: {
        centerOfMass: {
          x: this.formatNumber(
            metrics.spatialDistribution.centerOfMass.x,
            config.precision
          ),
          y: this.formatNumber(
            metrics.spatialDistribution.centerOfMass.y,
            config.precision
          ),
        },
        spread: this.formatNumber(
          metrics.spatialDistribution.spread,
          config.precision
        ),
      },
    }));
  }

  private prepareAgentHistoryData(
    agentIds: string[],
    config: ExportOptions
  ): any[] {
    const allAgentData: any[] = [];

    // If no specific agent IDs provided, export all tracked agents
    const targetAgentIds =
      agentIds.length > 0
        ? agentIds
        : Array.from(this.dataCollector['agentHistory'].keys());

    targetAgentIds.forEach(agentId => {
      const history = this.dataCollector.getAgentHistory(agentId);
      history.forEach(metrics => {
        allAgentData.push({
          agentId: metrics.agentId,
          agentType: metrics.agentType,
          timestamp: this.formatTimestamp(metrics.timestamp, config),
          position: {
            x: this.formatNumber(metrics.position.x, config.precision),
            y: this.formatNumber(metrics.position.y, config.precision),
          },
          connections: metrics.connections,
          properties: Object.fromEntries(
            Object.entries(metrics.properties).map(([key, value]) => [
              key,
              this.formatNumber(value, config.precision),
            ])
          ),
        });
      });
    });

    return allAgentData;
  }

  private prepareStatisticsData(statsReport: any, config: ExportOptions): any {
    return {
      timestamp: this.formatTimestamp(statsReport.timestamp, config),
      summary: Object.fromEntries(
        Object.entries(statsReport.summary).map(([key, value]) => [
          key,
          this.formatNumber(value as number, config.precision),
        ])
      ),
      trends: Object.fromEntries(
        Object.entries(statsReport.trends).map(
          ([key, trend]: [string, any]) => [
            key,
            {
              ...trend,
              slope: this.formatNumber(trend.slope, config.precision),
              correlation: this.formatNumber(
                trend.correlation,
                config.precision
              ),
              significance: this.formatNumber(
                trend.significance,
                config.precision
              ),
            },
          ]
        )
      ),
      distributions: Object.fromEntries(
        Object.entries(statsReport.distributions).map(
          ([key, dist]: [string, any]) => [
            key,
            {
              ...dist,
              mean: this.formatNumber(dist.mean, config.precision),
              median: this.formatNumber(dist.median, config.precision),
              standardDeviation: this.formatNumber(
                dist.standardDeviation,
                config.precision
              ),
              variance: this.formatNumber(dist.variance, config.precision),
              skewness: this.formatNumber(dist.skewness, config.precision),
              kurtosis: this.formatNumber(dist.kurtosis, config.precision),
            },
          ]
        )
      ),
    };
  }

  private formatTimestamp(
    timestamp: number,
    config: ExportOptions
  ): string | number {
    if (!config.includeTimestamps) return timestamp;

    switch (config.dateFormat) {
      case 'unix':
        return timestamp;
      case 'iso':
        return new Date(timestamp).toISOString();
      case 'readable':
        return new Date(timestamp).toLocaleString();
      default:
        return timestamp;
    }
  }

  private formatNumber(value: number, precision: number): number {
    return Number(value.toFixed(precision));
  }

  private async exportToCSV(
    data: any,
    baseName: string,
    _config: ExportOptions
  ): Promise<ExportResult> {
    let csvContent = '';

    if (Array.isArray(data)) {
      // Handle array data (like simulation history)
      if (data.length > 0) {
        const headers = Object.keys(data[0]);
        csvContent = headers.join(',') + '\n';

        data.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvContent += values.join(',') + '\n';
        });
      }
    } else if (typeof data === 'object') {
      // Handle object data (like time series)
      const allRows: any[] = [];

      Object.entries(data).forEach(
        ([seriesName, seriesData]: [string, any]) => {
          if (Array.isArray(seriesData)) {
            seriesData.forEach(point => {
              allRows.push({
                series: seriesName,
                ...point,
              });
            });
          }
        }
      );

      if (allRows.length > 0) {
        const headers = Object.keys(allRows[0]);
        csvContent = headers.join(',') + '\n';

        allRows.forEach(row => {
          const values = headers.map(header => {
            const value = row[header];
            if (typeof value === 'object' && value !== null) {
              return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
            }
            return `"${String(value).replace(/"/g, '""')}"`;
          });
          csvContent += values.join(',') + '\n';
        });
      }
    }

    const filename = `${baseName}_${new Date().toISOString().split('T')[0]}.csv`;
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(csvContent);

    return {
      data: csvContent,
      filename,
      mimeType: 'text/csv',
      size: uint8Array.length,
    };
  }

  private async exportToJSON(
    data: any,
    baseName: string,
    _config: ExportOptions
  ): Promise<ExportResult> {
    const jsonString = JSON.stringify(data, null, 2);
    const filename = `${baseName}_${new Date().toISOString().split('T')[0]}.json`;
    const encoder = new TextEncoder();
    const uint8Array = encoder.encode(jsonString);

    return {
      data: jsonString,
      filename,
      mimeType: 'application/json',
      size: uint8Array.length,
    };
  }

  private async exportToXLSX(
    _data: any,
    _baseName: string,
    _config: ExportOptions
  ): Promise<ExportResult> {
    // For XLSX export, we'll need a library like xlsx or similar
    // For now, we'll throw an error indicating it's not implemented
    throw new Error('XLSX export not implemented yet. Use CSV or JSON format.');
  }

  // Utility methods for browser downloads
  public downloadExport(exportResult: ExportResult): void {
    const blob = new Blob([exportResult.data], { type: exportResult.mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = exportResult.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  public async saveToFile(
    exportResult: ExportResult,
    _customFilename?: string
  ): Promise<void> {
    // This would require a file system API or Node.js environment
    // For browser environments, use downloadExport instead
    if (typeof window !== 'undefined') {
      this.downloadExport(exportResult);
    } else {
      // Node.js environment - would need fs module
      throw new Error('File saving in Node.js environment not implemented yet');
    }
  }

  // Batch export utilities
  public async exportAllFormats(
    dataType:
      | 'timeSeries'
      | 'simulationHistory'
      | 'agentHistory'
      | 'statistics'
      | 'complete',
    options: Partial<ExportOptions> = {}
  ): Promise<ExportResult[]> {
    const formats: ('csv' | 'json')[] = ['csv', 'json'];
    const results: ExportResult[] = [];

    for (const format of formats) {
      const exportOptions = { ...options, format };

      let result: ExportResult;
      switch (dataType) {
        case 'timeSeries':
          result = await this.exportTimeSeries([], exportOptions);
          break;
        case 'simulationHistory':
          result = await this.exportSimulationHistory(exportOptions);
          break;
        case 'agentHistory':
          result = await this.exportAgentHistory([], exportOptions);
          break;
        case 'statistics':
          result = await this.exportStatistics(exportOptions);
          break;
        case 'complete':
          result = await this.exportComplete(exportOptions);
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      results.push(result);
    }

    return results;
  }

  public getExportSummary(): {
    availableTimeSeries: string[];
    simulationHistoryLength: number;
    trackedAgents: number;
    hasStatistics: boolean;
    supportedFormats: string[];
  } {
    return {
      availableTimeSeries: this.dataCollector.getAvailableTimeSeries(),
      simulationHistoryLength: this.dataCollector.getSimulationHistory().length,
      trackedAgents: this.dataCollector.getDataSummary().trackedAgents,
      hasStatistics: this.statisticsEngine !== undefined,
      supportedFormats: ['csv', 'json'],
    };
  }
}
