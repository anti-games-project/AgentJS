# AgentJS Framework Examples

This directory contains comprehensive examples demonstrating the AgentJS framework's capabilities.

## Foundation Features Demo

**File**: `foundation-features-demo.ts`

A comprehensive demonstration of all foundation features implemented in Week 5 of development:

### Features Demonstrated

#### 1. Data Export & Trajectory Tracking
- **TrajectoryExporter**: Records agent positions and properties over time
- **CSV Export**: Export simulation data for analysis in external tools
- **Network Export**: Export social network structures in multiple formats
- **Environmental Metrics**: Spatial analysis and hotspot detection
- **Streaming Export**: Memory-efficient export for large datasets

```typescript
// Export simulation data
const exportedData = demo.exportData();
console.log(`Trajectory records: ${exportedData.trajectories.split('\n').length - 1}`);
```

#### 2. Enhanced Metrics Collection
- **NetworkMetrics**: Clustering, centrality, modularity analysis
- **SpatialMetrics**: Dispersion, hotspots, spatial autocorrelation
- **Time-Series**: Circular buffers with moving statistics
- **Real-time Analysis**: Continuous metric calculation during simulation

```typescript
// Calculate advanced network metrics
const networkMetrics = enhancedMetrics.calculateNetworkMetrics(networkManager, agentManager);
console.log(`Network density: ${networkMetrics.density.toFixed(3)}`);
```

#### 3. UI Controls & Parameter Management
- **SimulationController**: Play/pause/reset/step controls with performance monitoring
- **ControlPanel**: HTML/CSS interface with draggable panels
- **ParameterManager**: Live parameter adjustment with validation
- **Event-Driven**: Real-time parameter updates affecting simulation

```typescript
// Register dynamic parameters
parameterManager.registerParameter({
  key: 'agentCount',
  label: 'Number of Agents',
  type: ParameterType.NUMBER,
  defaultValue: 50,
  min: 10,
  max: 200
});
```

#### 4. Performance Optimization
- **ViewportCuller**: Spatial indexing and level-of-detail rendering
- **ObjectPool**: Memory management for frequent allocations
- **Spatial Indexing**: Quadtree-based agent location queries
- **LOD System**: Distance-based detail reduction

```typescript
// Demonstrate viewport culling
const cullingResult = demo.demonstrateViewportCulling(camera);
console.log(`Culled ${cullingResult.cullingResult.cullRatio * 100}% of agents`);
```

### Running the Demo

#### Browser Environment
```html
<!DOCTYPE html>
<html>
<head>
    <title>AgentJS Foundation Demo</title>
</head>
<body>
    <script type="module">
        import { runFoundationDemo } from './foundation-features-demo.js';
        runFoundationDemo();
    </script>
</body>
</html>
```

#### Node.js Environment
```typescript
import { runFoundationDemo } from './foundation-features-demo';
runFoundationDemo();
```

### Expected Output

The demo will:

1. **Initialize Systems** - Set up all framework components
2. **Create Agents** - Generate agents with random properties and positions
3. **Build Networks** - Create social connections based on parameters
4. **Run Simulation** - Execute 100 simulation steps with data collection
5. **Export Data** - Generate comprehensive data exports
6. **Performance Report** - Display performance metrics for all systems

### Console Output Example

```
🚀 Starting AgentJS Foundation Features Demo
Created simulation with 50 agents
▶️ Running simulation...
Step 50: averageAutonomy = 0.523
Step 50: networkDensity = 0.156
Step 50: spatialDispersion = 198.347
Progress: 25/100 steps completed
Performance: {
  simulation: { actualFPS: 60, stepsPerSecond: 20 },
  viewport: { cullTime: 1.2, averageCullTime: 1.1 },
  trajectory: { totalRecords: 1250, uniqueAgents: 50 }
}
✅ Simulation complete! Exporting data...
📊 Exported data summary:
- Trajectory records: 2500
- Network nodes: 50
- Network edges: 23
- Environmental metrics: 8 properties
🏁 Demo completed successfully!
```

### Key Learning Outcomes

After running this demo, you'll understand:

1. **Data Management**: How to collect, analyze, and export simulation data
2. **Performance Optimization**: Techniques for handling large agent populations
3. **User Interface**: Building responsive controls for simulation management
4. **Metrics Analysis**: Advanced analysis of agent behaviors and patterns
5. **System Integration**: How all framework components work together

### Customization

The demo is highly configurable through parameters:

- **Agent Count**: 10-200 agents
- **Connection Probability**: Network density control
- **Movement Patterns**: Different agent behaviors
- **Export Formats**: CSV, JSON, GraphML options
- **Performance Settings**: LOD distances, culling thresholds

### Next Steps

This foundation demo prepares you for:

1. **ML Integration** - Using exported data for machine learning
2. **Custom Game Development** - Building specific social impact games
3. **Research Applications** - Academic studies using the framework
4. **Production Deployment** - Scaling to large simulations

## ML Models Collection

**Directory**: `ml-models/`

A comprehensive collection of machine learning models for intelligent agent behaviors, including both off-the-shelf and domain-specific trained models.

### Off-the-Shelf Models (`ml-models/off-the-shelf/`)

#### General Behavior Model
**File**: `GeneralBehaviorModel.ts`

A versatile ML model providing general-purpose agent behaviors:

- **Movement Patterns**: Energy-based movement decisions and exploration
- **Social Behaviors**: Crowd avoidance and company seeking
- **Resource Management**: Opportunistic and urgent resource gathering
- **Configuration Options**: Exploration rate, social influence, risk tolerance

```typescript
// Create and configure general behavior model
const generalModel = new GeneralBehaviorModel({
  explorationRate: 0.4,
  socialInfluence: 0.6,
  resourceSeeking: 0.8,
  riskTolerance: 0.3
});

await agent.setMLModel('general-behavior');
```

**Features**:
- Automatic fallback to rule-based behavior
- Real-time parameter adjustment
- Performance monitoring and confidence scoring
- Compatible with any agent-based simulation domain

### Domain-Specific Models

#### Bird Flocking (`ml-models/domain-specific/bird-flocking/`)

**File**: `StarlingMurmurationModel.ts`

Research-based starling flocking model incorporating:

- **Topological Neighbors**: Interaction with closest N birds (not distance-based)
- **Density Waves**: Propagation of density changes through murmurations
- **Predator Avoidance**: High-priority threat response behaviors
- **Environmental Adaptation**: Wind response and obstacle avoidance

```typescript
// Configure starling-specific flocking
const starlingModel = new StarlingMurmurationModel({
  separationRadius: 1.0,
  alignmentRadius: 4.0,
  cohesionRadius: 15.0,
  maxSpeed: 15.0,
  predatorAvoidanceRadius: 75.0,
  densityWaveStrength: 0.8,
  topologicalNeighbors: 7
});
```

**Based on research**:
- Cavagna et al. (2010) - Scale-free correlations in starling flocks
- Ballerini et al. (2008) - Interaction ruling animal collective behavior
- Reynolds (1987) - Flocks, herds and schools behavioral model

#### Economic Modeling (`ml-models/domain-specific/economic-modeling/`)

**File**: `StockTradingModel.ts`

Sophisticated financial agent model with:

- **Technical Analysis**: RSI, MACD, Bollinger Bands, moving averages
- **Risk Management**: Stop-loss, take-profit, position sizing
- **Market Sentiment**: News analysis and herding behaviors
- **Fundamental Analysis**: Economic indicators and interest rates

```typescript
// Configure trading agent
const tradingModel = new StockTradingModel({
  riskTolerance: 0.4,
  timeHorizon: 50,
  technicalWeight: 0.4,
  fundamentalWeight: 0.3,
  sentimentWeight: 0.3,
  herding: 0.2
});
```

**Features**:
- Real-time market data processing
- Multi-factor decision making
- Portfolio management and performance tracking
- Behavioral finance integration

### Integration Examples (`ml-models/integrations/`)

#### Mixed Model Simulation
**File**: `mixed-model-simulation.ts`

Comprehensive example demonstrating:

- **Multiple Model Types**: General, bird flocking, and trading models working together
- **Performance Comparison**: ML vs rule-based agent behaviors
- **Real-time Model Switching**: Adaptive behavior change during simulation
- **Performance Monitoring**: Detailed metrics and benchmarking

```typescript
// Run complete mixed model example
const simulation = new MixedModelSimulation({
  agentCounts: {
    generalAgents: 15,
    birdAgents: 25,
    traderAgents: 8,
    ruleBasedAgents: 12
  },
  simulationSteps: 300,
  performanceMonitoring: true,
  modelComparison: true
});

await simulation.initialize();
await simulation.run();
```

**Demonstrates**:
- Model loading and registration
- Multi-domain agent creation
- Environmental updates for different agent types
- Performance metrics collection
- Adaptive model switching
- Comprehensive reporting

### Model Performance Features

All models include:

- **Automatic Fallback**: Rule-based behavior when ML fails
- **Confidence Scoring**: Prediction confidence for decision making
- **Memory Management**: Proper TensorFlow.js tensor disposal
- **Batch Processing**: Optimized inference for multiple agents
- **Real-time Metrics**: Performance monitoring and statistics

### Usage Guidelines

#### Loading Models
```typescript
import { ModelRegistry } from 'agentjs';

const registry = ModelRegistry.getInstance();
await registry.loadModel('model-name', './path/to/model.json');
```

#### Creating ML Agents
```typescript
import { MLAgent } from 'agentjs';

const agent = new MLAgent('agent-id', {
  mlEnabled: true,
  fallbackEnabled: true
});

await agent.setMLModel('model-name');
```

#### Performance Optimization
```typescript
import { MLPerformanceManager } from 'agentjs';

const perfManager = MLPerformanceManager.getInstance();
perfManager.configure({
  batchSize: 16,
  batchTimeout: 16, // 60 FPS
  maxQueueSize: 500
});
```

## Additional Examples

Future examples will include:

- **EmptyAddress Game Preview** - Early game mechanics demonstration
- **Custom Model Training** - Creating domain-specific models
- **Multi-Agent Scenarios** - Complex social dynamics
- **Performance Benchmarks** - Large-scale simulation testing

## Contributing Examples

To add new examples:

1. Create a new `.ts` file in this directory
2. Follow the naming convention: `[feature]-[description]-demo.ts`
3. Include comprehensive comments and console output
4. Update this README with your example description
5. Ensure examples are self-contained and runnable

## Support

For questions about these examples:

- Check the main framework documentation
- Review the test files for detailed API usage
- Open issues for bugs or unclear behavior
- Contribute improvements through pull requests