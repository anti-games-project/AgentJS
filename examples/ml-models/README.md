# ML Models Examples - AgentJS Framework

This directory contains pre-trained machine learning models and interactive demonstration examples that come bundled with the AgentJS framework package.

## Directory Structure

### Off-the-Shelf Models (`/off-the-shelf/`)
Generic ML models that can be applied to any agent-based simulation:
- **General Behavioral Models**: Basic movement, decision-making patterns
- **Clustering Models**: Agent grouping and spatial organization
- **Time Series Models**: Temporal pattern recognition
- **Reinforcement Learning**: Pre-trained RL agents for common scenarios

### Domain-Specific Models (`/domain-specific/`)

#### Bird Flocking (`/bird-flocking/`)
Trained models specifically for avian flocking behaviors:
- **Boids Enhancement Model**: ML-enhanced Reynolds flocking rules
- **Species-Specific Models**: Starling murmurations, geese V-formations
- **Environmental Adaptation**: Weather-responsive flocking patterns
- **Predator Avoidance**: Anti-predator flocking strategies

#### Economic Modeling (`/economic-modeling/`)
*Economic modeling examples have been removed. Future versions may include simplified economic agent patterns.*

### Interactive Demos (`/demos/`)
Complete browser-based demonstrations showcasing the ML models:
- **Resource Seeking Demo**: Intelligent pathfinding with obstacle avoidance
- **Starling Murmuration**: Research-accurate flocking with topological neighbors
- **Configuration System**: Real-time parameter adjustment and JSON import/export
- **Comparison Studies**: Side-by-side ML vs rule-based behavior analysis

### Integration Examples (`/integrations/`)
Complete simulation examples showing how to use the models:
- **Mixed Model Simulations**: Combining multiple ML models
- **Comparison Studies**: ML vs rule-based behavior comparisons
- **Performance Benchmarks**: Speed and accuracy metrics
- **Real-time Inference**: Live model switching examples

## Model Formats

All models are provided in TensorFlow.js format (`.json` + `.bin` files) for browser compatibility.

### Model Metadata Structure
Each model includes:
```json
{
  "name": "model-name",
  "version": "1.0.0",
  "description": "Model description",
  "inputShape": [batch_size, features],
  "outputShape": [batch_size, actions],
  "domain": "flocking|economic|general",
  "trainingData": {
    "source": "dataset description",
    "size": "number of samples",
    "validation_accuracy": "0.85"
  },
  "performance": {
    "inference_time_ms": 5,
    "memory_mb": 2.3,
    "accuracy": 0.87
  }
}
```

## Quick Start

### Using Off-the-Shelf Models

```typescript
import { ModelRegistry, MLAgent } from 'agentjs';

// Load a generic behavioral model
const registry = ModelRegistry.getInstance();
await registry.loadModel(
  'general-behavior', 
  './examples/ml-models/off-the-shelf/general-behavior-v1.json'
);

// Create agent with the model
const agent = new MLAgent('agent-1');
await agent.setMLModel('general-behavior');
```

### Using Domain-Specific Models

```typescript
// Load bird flocking model
await registry.loadModel(
  'starling-flocking',
  './examples/ml-models/domain-specific/bird-flocking/starling-murmuration-v2.json'
);

// Apply to multiple agents
const flock = [];
for (let i = 0; i < 50; i++) {
  const bird = new MLAgent(`bird-${i}`);
  await bird.setMLModel('starling-flocking');
  flock.push(bird);
}
```

## Model Performance Guidelines

### Real-time Requirements
- **Inference Time**: < 16ms per agent (60 FPS)
- **Memory Usage**: < 100MB total for all loaded models
- **Batch Processing**: Use MLPerformanceManager for >50 agents

### Quality Metrics
- **Accuracy**: >80% for production use
- **Robustness**: Graceful degradation when inputs are out of range
- **Fallback**: Always implement rule-based fallback behavior

## Contributing New Models

To add a new pre-trained model:

1. **Train and Export**: Export your TensorFlow/PyTorch model to TensorFlow.js format
2. **Create Metadata**: Follow the metadata JSON structure above  
3. **Add Integration**: Create a wrapper class implementing `MLBehaviorModel`
4. **Documentation**: Add usage examples and performance benchmarks
5. **Testing**: Ensure model works with AgentJS state encoding

### Model Training Guidelines

For domain-specific models:
- Use the `GenericDataCollector` to gather training data from simulations
- Validate on held-out test scenarios
- Document training hyperparameters and data sources
- Include performance benchmarks vs rule-based approaches

## Available Models

### Currently Included

#### Off-the-Shelf
- ⏳ **General Movement Model** (coming soon)
- ⏳ **Clustering Behavior Model** (coming soon)
- ⏳ **Social Interaction Model** (coming soon)

#### Bird Flocking
- ⏳ **Starling Murmuration Model** (coming soon)
- ⏳ **Geese V-Formation Model** (coming soon)
- ⏳ **Predator Evasion Model** (coming soon)

#### Economic Modeling  
- *Economic models removed from this version*

### Planned Models
- Weather-responsive flocking
- Multi-species interaction models
- Advanced behavioral patterns
- Ecosystem modeling

## License and Attribution

Models in this directory may have different licenses:
- **Off-the-shelf models**: MIT License (freely usable)
- **Research models**: May require attribution to original papers
- **Commercial models**: Check individual license files

See individual model directories for specific licensing information.

## Technical Requirements

- **TensorFlow.js**: ^4.15.0 or higher
- **Browser Support**: Modern browsers with WebGL support
- **Memory**: Minimum 4GB RAM recommended for multiple models
- **Performance**: GPU acceleration recommended for >100 agents

## Troubleshooting

### Common Issues
1. **Model Loading Failures**: Check file paths and CORS policy
2. **Memory Leaks**: Ensure proper tensor disposal after inference
3. **Performance Issues**: Use batch processing for multiple agents
4. **Accuracy Problems**: Verify input state encoding matches training

### Debug Mode
Enable debug logging to troubleshoot model issues:

```typescript
const agent = new MLAgent('debug-agent', { debug: true });
await agent.setMLModel('your-model');
console.log('Model stats:', agent.getPredictionStats());
```