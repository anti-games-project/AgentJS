import { DataCollector, SimulationMetrics } from './DataCollector';
import { Visualizer } from '../visualization/Visualizer';

export interface ExportOptions {
  includeHeaders?: boolean;
  dateFormat?: 'timestamp' | 'iso' | 'locale';
  precision?: number;
  filterStartTime?: number;
  filterEndTime?: number;
  includeMetadata?: boolean;
  customSeparator?: string;
}

export interface ExportResult {
  success: boolean;
  data?: string;
  filename?: string;
  error?: string;
  size?: number;
}

export interface ChartExportOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
  quality?: number;
  format?: 'png' | 'jpeg' | 'webp';
}

/**
 * Export simulation data to various formats (CSV, JSON, Excel-compatible)
 * Also handles image and visualization exports
 */
export class ExportManager {
  private dataCollector: DataCollector;
  private visualizer: Visualizer | undefined;

  constructor(dataCollector: DataCollector, visualizer?: Visualizer) {
    this.dataCollector = dataCollector;
    this.visualizer = visualizer;
  }

  /**
   * Export time series data to CSV format
   */
  exportTimeSeriesCSV(
    seriesNames: string[],
    options: ExportOptions = {}
  ): ExportResult {
    try {
      const {
        includeHeaders = true,
        dateFormat = 'timestamp',
        precision = 6,
        filterStartTime,
        filterEndTime,
        customSeparator = ',',
      } = options;

      // Collect all data points from specified series
      const allData: Array<{
        timestamp: number;
        step: number;
        series: string;
        value: number;
      }> = [];

      seriesNames.forEach(seriesName => {
        const timeSeries = this.dataCollector.getTimeSeries(seriesName);
        timeSeries.forEach(point => {
          // Apply time filtering if specified
          if (filterStartTime && point.timestamp < filterStartTime) return;
          if (filterEndTime && point.timestamp > filterEndTime) return;

          allData.push({
            timestamp: point.timestamp,
            step: point.step,
            series: seriesName,
            value: point.value,
          });
        });
      });

      // Sort by timestamp
      allData.sort((a, b) => a.timestamp - b.timestamp);

      // Build CSV content
      const rows: string[] = [];

      if (includeHeaders) {
        rows.push(['Timestamp', 'Step', 'Series', 'Value'].join(customSeparator));
      }

      allData.forEach(point => {
        const timestamp = this.formatTimestamp(point.timestamp, dateFormat);
        const value = Number(point.value.toFixed(precision));
        rows.push([timestamp, point.step, point.series, value].join(customSeparator));
      });

      const csvContent = rows.join('\n');
      const filename = this.generateFilename('timeseries', 'csv');

      return {
        success: true,
        data: csvContent,
        filename,
        size: csvContent.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  /**
   * Export simulation metrics to CSV format
   */
  exportSimulationMetricsCSV(options: ExportOptions = {}): ExportResult {
    try {
      const {
        includeHeaders = true,
        dateFormat = 'timestamp',
        precision = 6,
        customSeparator = ',',
      } = options;

      const history = this.dataCollector.getSimulationHistory();
      if (history.length === 0) {
        return {
          success: false,
          error: 'No simulation metrics data available',
        };
      }

      const rows: string[] = [];

      if (includeHeaders) {
        const headers = [
          'Timestamp',
          'Step',
          'Total_Agents',
          'Average_Autonomy',
          'Average_Resources',
          'Total_Connections',
          'Network_Density',
          'Center_X',
          'Center_Y',
          'Spatial_Spread',
        ];
        rows.push(headers.join(customSeparator));
      }

      history.forEach(metrics => {
        const timestamp = this.formatTimestamp(metrics.timestamp, dateFormat);
        const row = [
          timestamp,
          metrics.step,
          metrics.totalAgents,
          Number(metrics.averageAutonomy.toFixed(precision)),
          Number(metrics.averageResources.toFixed(precision)),
          metrics.totalConnections,
          Number(metrics.networkDensity.toFixed(precision)),
          Number(metrics.spatialDistribution.centerOfMass.x.toFixed(precision)),
          Number(metrics.spatialDistribution.centerOfMass.y.toFixed(precision)),
          Number(metrics.spatialDistribution.spread.toFixed(precision)),
        ];
        rows.push(row.join(customSeparator));
      });

      const csvContent = rows.join('\n');
      const filename = this.generateFilename('simulation-metrics', 'csv');

      return {
        success: true,
        data: csvContent,
        filename,
        size: csvContent.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  /**
   * Export agent trajectory data to CSV format
   */
  exportAgentTrajectoriesCSV(
    agentIds?: string[],
    options: ExportOptions = {}
  ): ExportResult {
    try {
      const {
        includeHeaders = true,
        dateFormat = 'timestamp',
        precision = 6,
        customSeparator = ',',
      } = options;

      const allTrajectories: Array<{
        agentId: string;
        timestamp: number;
        agentType: string;
        x: number;
        y: number;
        properties: Record<string, number>;
      }> = [];

      // Get agent IDs to export
      const targetAgentIds = agentIds || Array.from(
        this.dataCollector.getDataSummary().trackedAgents > 0
          ? [...Array(this.dataCollector.getDataSummary().trackedAgents)].map((_, i) => `agent_${i}`)
          : []
      );

      targetAgentIds.forEach(agentId => {
        const history = this.dataCollector.getAgentHistory(agentId);
        history.forEach(metrics => {
          allTrajectories.push({
            agentId: metrics.agentId,
            timestamp: metrics.timestamp,
            agentType: metrics.agentType,
            x: metrics.position.x,
            y: metrics.position.y,
            properties: metrics.properties,
          });
        });
      });

      // Sort by timestamp
      allTrajectories.sort((a, b) => a.timestamp - b.timestamp);

      if (allTrajectories.length === 0) {
        return {
          success: false,
          error: 'No agent trajectory data available',
        };
      }

      // Build CSV content
      const rows: string[] = [];

      if (includeHeaders) {
        const headers = ['Agent_ID', 'Timestamp', 'Agent_Type', 'X', 'Y'];
        
        // Add property columns (use first trajectory to determine properties)
        if (allTrajectories.length > 0 && allTrajectories[0]) {
          const propertyNames = Object.keys(allTrajectories[0].properties);
          headers.push(...propertyNames);
        }
        
        rows.push(headers.join(customSeparator));
      }

      allTrajectories.forEach(trajectory => {
        const timestamp = this.formatTimestamp(trajectory.timestamp, dateFormat);
        const row = [
          trajectory.agentId,
          timestamp,
          trajectory.agentType,
          Number(trajectory.x.toFixed(precision)),
          Number(trajectory.y.toFixed(precision)),
        ];

        // Add property values
        Object.values(trajectory.properties).forEach(value => {
          row.push(Number(value.toFixed(precision)));
        });

        rows.push(row.join(customSeparator));
      });

      const csvContent = rows.join('\n');
      const filename = this.generateFilename('agent-trajectories', 'csv');

      return {
        success: true,
        data: csvContent,
        filename,
        size: csvContent.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  /**
   * Export data to JSON format
   */
  exportToJSON(
    dataType: 'timeseries' | 'simulation' | 'agents' | 'all',
    options: ExportOptions = {}
  ): ExportResult {
    try {
      const { includeMetadata = true, filterStartTime, filterEndTime } = options;

      let exportData: any = {};

      switch (dataType) {
        case 'timeseries':
          exportData = this.collectTimeSeriesData(filterStartTime, filterEndTime);
          break;
        case 'simulation':
          exportData = this.collectSimulationData(filterStartTime, filterEndTime);
          break;
        case 'agents':
          exportData = this.collectAgentData(filterStartTime, filterEndTime);
          break;
        case 'all':
          exportData = {
            timeseries: this.collectTimeSeriesData(filterStartTime, filterEndTime),
            simulation: this.collectSimulationData(filterStartTime, filterEndTime),
            agents: this.collectAgentData(filterStartTime, filterEndTime),
          };
          break;
      }

      if (includeMetadata) {
        exportData.metadata = {
          exportTime: new Date().toISOString(),
          dataType,
          summary: this.dataCollector.getDataSummary(),
          filterStartTime,
          filterEndTime,
        };
      }

      const jsonContent = JSON.stringify(exportData, null, 2);
      const filename = this.generateFilename(`${dataType}-data`, 'json');

      return {
        success: true,
        data: jsonContent,
        filename,
        size: jsonContent.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown export error',
      };
    }
  }

  /**
   * Export data in Excel-compatible format (tab-separated values)
   */
  exportToExcel(
    dataType: 'timeseries' | 'simulation' | 'agents',
    seriesNames?: string[],
    options: ExportOptions = {}
  ): ExportResult {
    // Use tab separator for Excel compatibility
    const excelOptions = { ...options, customSeparator: '\t' };

    switch (dataType) {
      case 'timeseries':
        const result = this.exportTimeSeriesCSV(
          seriesNames || this.dataCollector.getAvailableTimeSeries(),
          excelOptions
        );
        if (result.success && result.filename) {
          result.filename = result.filename.replace('.csv', '.tsv');
        }
        return result;

      case 'simulation':
        const simResult = this.exportSimulationMetricsCSV(excelOptions);
        if (simResult.success && simResult.filename) {
          simResult.filename = simResult.filename.replace('.csv', '.tsv');
        }
        return simResult;

      case 'agents':
        const agentResult = this.exportAgentTrajectoriesCSV(undefined, excelOptions);
        if (agentResult.success && agentResult.filename) {
          agentResult.filename = agentResult.filename.replace('.csv', '.tsv');
        }
        return agentResult;

      default:
        return {
          success: false,
          error: 'Invalid data type for Excel export',
        };
    }
  }

  /**
   * Export visualization screenshot
   */
  exportScreenshot(
    options: ChartExportOptions = {}
  ): ExportResult {
    try {
      if (!this.visualizer) {
        return {
          success: false,
          error: 'No visualizer available for screenshot export',
        };
      }

      // Destructure options but mark as unused since they're not implemented yet
      const {} = options;
      void options; // Acknowledge the parameter

      // Canvas access not implemented yet - return placeholder
      return {
        success: false,
        error: 'Canvas export not yet implemented - requires p5 instance access',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Screenshot export failed',
      };
    }
  }

  /**
   * Save export result to file (browser download)
   */
  saveToFile(exportResult: ExportResult): void {
    if (!exportResult.success || !exportResult.data || !exportResult.filename) {
      console.error('Cannot save invalid export result');
      return;
    }

    try {
      let blob: Blob;
      
      if (exportResult.data.startsWith('data:image/')) {
        // Handle image data URLs
        const base64Data = exportResult.data.split(',')[1];
        if (!base64Data) {
          throw new Error('Invalid image data URL format');
        }
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        
        const byteArray = new Uint8Array(byteNumbers);
        const mimeType = exportResult.data.substring(5, exportResult.data.indexOf(';'));
        blob = new Blob([byteArray], { type: mimeType });
      } else {
        // Handle text data
        const mimeType = exportResult.filename.endsWith('.json')
          ? 'application/json'
          : 'text/plain';
        blob = new Blob([exportResult.data], { type: mimeType });
      }

      // Create download link
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = exportResult.filename;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to save file:', error);
    }
  }

  // Private helper methods

  private formatTimestamp(timestamp: number, format: string): string {
    switch (format) {
      case 'iso':
        return new Date(timestamp).toISOString();
      case 'locale':
        return new Date(timestamp).toLocaleString();
      case 'timestamp':
      default:
        return timestamp.toString();
    }
  }

  private generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}_${timestamp}.${extension}`;
  }

  private collectTimeSeriesData(startTime?: number, endTime?: number): any {
    const data: any = {};
    
    this.dataCollector.getAvailableTimeSeries().forEach(seriesName => {
      let timeSeries = this.dataCollector.getTimeSeries(seriesName);
      
      // Apply time filtering
      if (startTime || endTime) {
        timeSeries = timeSeries.filter(point => {
          if (startTime && point.timestamp < startTime) return false;
          if (endTime && point.timestamp > endTime) return false;
          return true;
        });
      }
      
      data[seriesName] = timeSeries;
    });
    
    return data;
  }

  private collectSimulationData(startTime?: number, endTime?: number): SimulationMetrics[] {
    let history = this.dataCollector.getSimulationHistory();
    
    // Apply time filtering
    if (startTime || endTime) {
      history = history.filter(metrics => {
        if (startTime && metrics.timestamp < startTime) return false;
        if (endTime && metrics.timestamp > endTime) return false;
        return true;
      });
    }
    
    return history;
  }

  private collectAgentData(_startTime?: number, _endTime?: number): any {
    const agentData: any = {};
    
    // This would need to be implemented based on how agent history is stored
    // For now, return summary data
    agentData.summary = this.dataCollector.getDataSummary();
    
    return agentData;
  }
}