# AgentJS NPM Package - File Manifest

This document provides a complete listing of all files included in the @agentjs/core NPM package with their purposes.

## Package Metadata & Configuration

- **package.json** - NPM package configuration with dependencies, scripts, and metadata
- **README.md** - Main documentation with installation, usage examples, and API overview  
- **CHANGELOG.md** - Version history and release notes for all package versions
- **LICENSE** - MIT license for open-source distribution
- **.npmignore** - Specifies files to exclude from the published NPM package
- **tsconfig.json** - TypeScript compiler configuration for development
- **tsconfig.build.json** - TypeScript compiler configuration for production builds

## Compiled Distribution Files (/dist)

### Main Entry Points
- **dist/index.es.js** - ES Module format for modern JavaScript environments
- **dist/index.cjs.js** - CommonJS format for Node.js and legacy bundlers
- **dist/index.umd.js** - Universal Module Definition for browser script tags
- **dist/index.d.ts** - Main TypeScript type definitions entry point
- **dist/index-full.d.ts** - Complete type definitions including all exports

### Core Framework Types (/dist/core)
- **dist/core/AgentManager.d.ts** - Type definitions for central agent lifecycle management
- **dist/core/Simulation.d.ts** - Type definitions for simulation orchestration
- **dist/core/index.d.ts** - Core module barrel exports

### Agent System Types (/dist/core/agents)
- **dist/core/agents/Agent.d.ts** - Abstract base agent interface definitions
- **dist/core/agents/BaseAgent.d.ts** - Basic agent implementation types
- **dist/core/agents/MovingAgent.d.ts** - Movement-capable agent types
- **dist/core/agents/NetworkAgent.d.ts** - Social network agent types
- **dist/core/agents/index.d.ts** - Agent module exports

### Environment Types (/dist/core/environment)
- **dist/core/environment/Environment.d.ts** - Abstract environment interface
- **dist/core/environment/ContinuousSpace.d.ts** - 2D continuous space types
- **dist/core/environment/Grid2D.d.ts** - Discrete grid environment types

### Scheduling Types (/dist/core/scheduling)
- **dist/core/scheduling/Scheduler.d.ts** - Abstract scheduler interface
- **dist/core/scheduling/RandomScheduler.d.ts** - Random activation scheduler types
- **dist/core/scheduling/SequentialScheduler.d.ts** - Sequential activation scheduler types

### Network Types (/dist/core/network)
- **dist/core/network/NetworkManager.d.ts** - Social network management types
- **dist/core/network/SocialInfluence.d.ts** - Influence propagation system types
- **dist/core/network/NetworkFormation.d.ts** - Dynamic network creation types

### Behavior Types (/dist/core/behaviors)
- **dist/core/behaviors/BehaviorTree.d.ts** - Hierarchical behavior management types
- **dist/core/behaviors/CommonBehaviors.d.ts** - Pre-built behavior pattern types
- **dist/core/behaviors/index.d.ts** - Behavior module exports

### Interaction Types (/dist/core/interactions)
- **dist/core/interactions/InteractionEngine.d.ts** - Agent interaction system types

### Performance Types (/dist/core/performance)
- **dist/core/performance/PerformanceBenchmark.d.ts** - Performance monitoring types
- **dist/core/performance/index.d.ts** - Performance module exports

### Visualization Types (/dist/visualization)
- **dist/visualization/Visualizer.d.ts** - Main p5.js rendering engine types
- **dist/visualization/Camera.d.ts** - 2D camera control types
- **dist/visualization/AnimationEngine.d.ts** - Animation system types
- **dist/visualization/ParticleEffectsSystem.d.ts** - Particle effects types
- **dist/visualization/HeatMapSystem.d.ts** - Heat map visualization types
- **dist/visualization/AgentTrailSystem.d.ts** - Movement trail rendering types
- **dist/visualization/InputManager.d.ts** - Input handling system types
- **dist/visualization/AgentDefinitionVisualizer.d.ts** - Agent visual configuration types
- **dist/visualization/index.d.ts** - Visualization module exports

### Analysis Types (/dist/analysis)
- **dist/analysis/DataCollector.d.ts** - Real-time data collection types
- **dist/analysis/DataExporter.d.ts** - Data export system types
- **dist/analysis/TrajectoryExporter.d.ts** - Movement trajectory export types
- **dist/analysis/ChartVisualizer.d.ts** - Chart.js integration types
- **dist/analysis/EnhancedMetrics.d.ts** - Advanced metrics calculation types
- **dist/analysis/StatisticsEngine.d.ts** - Statistical analysis types
- **dist/analysis/ExportManager.d.ts** - Export management system types
- **dist/analysis/index.d.ts** - Analysis module exports

### Control Types (/dist/controls)
- **dist/controls/SimulationController.d.ts** - High-level simulation control types
- **dist/controls/ParameterManager.d.ts** - Dynamic parameter management types
- **dist/controls/ControlPanel.d.ts** - Runtime control panel types
- **dist/controls/index.d.ts** - Control module exports

### Performance Optimization Types (/dist/performance)
- **dist/performance/ObjectPool.d.ts** - Object pooling system types
- **dist/performance/ViewportCuller.d.ts** - Render culling system types
- **dist/performance/index.d.ts** - Performance module exports

### Utility Types (/dist/utils)
- **dist/utils/MathUtils.d.ts** - Mathematical utilities and Vector2D types
- **dist/utils/ConfigurationManager.d.ts** - Configuration management types
- **dist/utils/ParameterTuner.d.ts** - Parameter optimization types
- **dist/utils/index.d.ts** - Utility module exports

### Machine Learning Types (/dist/ml)
- **dist/ml/interfaces.d.ts** - ML system interface definitions
- **dist/ml/MLAgent.d.ts** - ML-enhanced agent types
- **dist/ml/StateEncoder.d.ts** - State encoding for ML types
- **dist/ml/ModelRegistry.d.ts** - ML model management types
- **dist/ml/MLPerformanceManager.d.ts** - ML performance optimization types
- **dist/ml/GenericDataCollector.d.ts** - ML data collection types
- **dist/ml/index.d.ts** - ML module exports

### ML Model Types (/dist/ml/models)
- **dist/ml/models/FlockingMLModel.d.ts** - Flocking behavior ML model types
- **dist/ml/models/EconomicMLModel.d.ts** - Economic behavior ML model types
- **dist/ml/models/NetworkFormationModel.d.ts** - Network formation ML model types

### Core Type Definitions (/dist/types)
- **dist/types/core.d.ts** - Core framework type definitions
- **dist/types/events.d.ts** - Event system type definitions
- **dist/types/spatial.d.ts** - Spatial data structure type definitions

## Source Code (/src)

### Core Framework (/src/core)
- **src/core/AgentManager.ts** - Central agent lifecycle management implementation
- **src/core/Simulation.ts** - Main simulation orchestrator implementation

### Agent System (/src/core/agents)
- **src/core/agents/Agent.ts** - Abstract base class for all agents
- **src/core/agents/BaseAgent.ts** - Basic agent with property management
- **src/core/agents/MovingAgent.ts** - Agent with movement capabilities
- **src/core/agents/NetworkAgent.ts** - Agent with social network features
- **src/core/agents/index.ts** - Agent module barrel exports

### Environment System (/src/core/environment)
- **src/core/environment/Environment.ts** - Abstract spatial environment base
- **src/core/environment/ContinuousSpace.ts** - 2D continuous space with quadtree
- **src/core/environment/Grid2D.ts** - Discrete grid-based environment

### Scheduling System (/src/core/scheduling)
- **src/core/scheduling/Scheduler.ts** - Abstract scheduler for agent activation
- **src/core/scheduling/RandomScheduler.ts** - Random order agent activation
- **src/core/scheduling/SequentialScheduler.ts** - Sequential agent activation

### Network System (/src/core/network)
- **src/core/network/NetworkManager.ts** - Social network graph management
- **src/core/network/SocialInfluence.ts** - Influence propagation algorithms
- **src/core/network/NetworkFormation.ts** - Dynamic network creation rules

### Behavior System (/src/core/behaviors)
- **src/core/behaviors/BehaviorTree.ts** - Hierarchical behavior management
- **src/core/behaviors/CommonBehaviors.ts** - Flocking, seeking, avoidance behaviors
- **src/core/behaviors/index.ts** - Behavior module exports

### Interaction System (/src/core/interactions)
- **src/core/interactions/InteractionEngine.ts** - Agent-to-agent interaction rules

### Performance Monitoring (/src/core/performance)
- **src/core/performance/PerformanceBenchmark.ts** - Simulation performance tracking
- **src/core/performance/index.ts** - Performance module exports

### Visualization System (/src/visualization)
- **src/visualization/Visualizer.ts** - Main p5.js rendering engine
- **src/visualization/Camera.ts** - 2D camera with pan/zoom controls
- **src/visualization/AnimationEngine.ts** - Smooth animation transitions
- **src/visualization/ParticleEffectsSystem.ts** - Visual particle effects
- **src/visualization/HeatMapSystem.ts** - Density and property heat maps
- **src/visualization/AgentTrailSystem.ts** - Agent movement trail rendering
- **src/visualization/InputManager.ts** - Mouse and keyboard input handling
- **src/visualization/AgentDefinitionVisualizer.ts** - Agent visual configuration
- **src/visualization/index.ts** - Visualization module exports

### Analysis System (/src/analysis)
- **src/analysis/DataCollector.ts** - Real-time simulation data collection
- **src/analysis/DataExporter.ts** - Export to CSV/JSON/Excel formats
- **src/analysis/TrajectoryExporter.ts** - Agent trajectory data export
- **src/analysis/ChartVisualizer.ts** - Chart.js dashboard integration
- **src/analysis/EnhancedMetrics.ts** - Advanced statistical metrics
- **src/analysis/StatisticsEngine.ts** - Core statistics calculations
- **src/analysis/ExportManager.ts** - Unified export management
- **src/analysis/index.ts** - Analysis module exports

### Control System (/src/controls)
- **src/controls/SimulationController.ts** - High-level simulation controls
- **src/controls/ParameterManager.ts** - Dynamic parameter management
- **src/controls/ControlPanel.ts** - Runtime control widgets
- **src/controls/index.ts** - Control module exports

### Performance Optimization (/src/performance)
- **src/performance/ObjectPool.ts** - Memory-efficient object pooling
- **src/performance/ViewportCuller.ts** - Render optimization for large simulations
- **src/performance/index.ts** - Performance module exports

### Utilities (/src/utils)
- **src/utils/MathUtils.ts** - Vector math and mathematical helpers
- **src/utils/ConfigurationManager.ts** - Configuration loading and validation
- **src/utils/ParameterTuner.ts** - Automated parameter optimization
- **src/utils/index.ts** - Utility module exports

### Machine Learning (/src/ml)
- **src/ml/interfaces.ts** - ML system interfaces and types
- **src/ml/MLAgent.ts** - ML-enhanced agent implementation
- **src/ml/StateEncoder.ts** - Agent state to tensor encoding
- **src/ml/ModelRegistry.ts** - ML model management system
- **src/ml/MLPerformanceManager.ts** - ML performance optimization
- **src/ml/GenericDataCollector.ts** - Training data collection
- **src/ml/index.ts** - ML module exports

### ML Models (/src/ml/models)
- **src/ml/models/FlockingMLModel.ts** - Neural network for flocking behavior
- **src/ml/models/EconomicMLModel.ts** - Economic decision-making model
- **src/ml/models/NetworkFormationModel.ts** - Social network formation AI

### Type Definitions (/src/types)
- **src/types/core.ts** - Core framework type definitions
- **src/types/events.ts** - Event system type definitions
- **src/types/spatial.ts** - Spatial data structure types

### Main Entry Point
- **src/index.ts** - Main framework API exports
- **src/index-full.ts** - Complete exports including all submodules

## Package Structure Summary

Total Files: 200+ files
- TypeScript Source: 60+ implementation files
- Type Definitions: 130+ .d.ts files with source maps
- Distribution Builds: 3 formats (ES, CommonJS, UMD) with source maps
- Documentation: README, CHANGELOG, LICENSE
- Configuration: TypeScript, NPM, build configs

Package Size: ~1.6 MB compressed, ~6.5 MB unpacked

This package provides a complete Agent-Based Modeling framework for browser and Node.js environments with full TypeScript support, multiple build formats, and comprehensive documentation.