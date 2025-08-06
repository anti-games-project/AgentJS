# AgentJS Core

[![npm version](https://badge.fury.io/js/%40agentjs%2Fcore.svg)](https://badge.fury.io/js/%40agentjs%2Fcore)
[![CI](https://github.com/emptyaddress-project/agentjs-core/workflows/CI/badge.svg)](https://github.com/emptyaddress-project/agentjs-core/actions)
[![codecov](https://codecov.io/gh/emptyaddress-project/agentjs-core/branch/main/graph/badge.svg)](https://codecov.io/gh/emptyaddress-project/agentjs-core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**A comprehensive agent-based modeling framework with built-in p5.js visualization, designed for social impact research and education.**

## 🎯 Mission

Created in partnership with **Apne Aap Women Worldwide**, AgentJS enables educational tools that illuminate trafficking dynamics and demonstrate pathways to empowerment, supporting the vision of "a world where no child is bought or sold."

## ✨ Features

- 🤖 **Multi-Agent Systems** - BaseAgent, MovingAgent, NetworkAgent with extensible properties
- 🌍 **Flexible Environments** - Continuous space and grid-based environments with spatial indexing
- 🔗 **Social Networks** - Dynamic network formation, influence propagation, and community detection
- 📊 **Data Analysis** - Real-time metrics collection, statistical analysis, and export capabilities
- 🎨 **Rich Visualizations** - p5.js integration with customizable agent rendering and animations
- ⚡ **Performance Optimized** - Spatial indexing, object pooling, and efficient algorithms
- 📱 **Cross-Platform** - Works in browsers, Node.js, and modern bundlers
- 🔬 **Educational Focus** - Designed for social impact research and complex systems education
- 🧠 **ML Integration** - Built-in support for machine learning models and behavior trees

## 🚀 Quick Start

### Installation

```bash
npm install @agentjs/core p5
```

### Basic Usage

```typescript
import { BaseAgent, ContinuousSpace, AgentManager, Visualizer } from '@agentjs/core';
import p5 from 'p5';

// Create environment and agents
const environment = new ContinuousSpace({ 
  width: 800, 
  height: 600, 
  boundaryType: 'periodic' 
});

const agentManager = new AgentManager();

// Create agents with custom properties
for (let i = 0; i < 50; i++) {
  const agent = new BaseAgent(`agent-${i}`, {
    autonomy: Math.random() * 100,
    resources: Math.random() * 100,
    type: 'community_member'
  });
  
  agentManager.addAgent(agent);
  environment.addAgent(agent, {
    x: Math.random() * 800,
    y: Math.random() * 600
  });
}

// Set up visualization
const sketch = (p: p5) => {
  p.setup = () => {
    p.createCanvas(800, 600);
  };
  
  p.draw = () => {
    p.background(240);
    
    // Step simulation
    agentManager.stepAll();
    
    // Visualize agents
    const agents = agentManager.getAllAgents();
    agents.forEach(agent => {
      const pos = agent.getPosition();
      const autonomy = agent.getProperty('autonomy') as number;
      
      p.fill(255 - autonomy * 2.55, autonomy * 2.55, 100);
      p.circle(pos.x, pos.y, 10);
    });
  };
};

new p5(sketch);
```

### Social Network Example

```typescript
import { NetworkAgent, NetworkManager, ConnectionType } from '@agentjs/core';

// Create network manager
const networkManager = new NetworkManager();

// Create network agents
const agent1 = new NetworkAgent('person1', { trust: 80, vulnerability: 30 }, networkManager);
const agent2 = new NetworkAgent('person2', { trust: 60, vulnerability: 70 }, networkManager);

// Form supportive connection
networkManager.addConnection(
  agent1.id,
  agent2.id,
  ConnectionType.SUPPORTIVE,
  0.8  // connection strength
);

// Analyze network
const analysis = networkManager.getNetworkAnalysis();
console.log(`Network has ${analysis.nodeCount} nodes and ${analysis.edgeCount} connections`);
```

## 🏗️ Architecture

```
@agentjs/core
├── core/
│   ├── agents/          # Agent classes and behaviors
│   ├── environment/     # Spatial environments
│   ├── scheduling/      # Agent activation patterns
│   └── interactions/    # Agent interactions and networks
├── visualization/       # p5.js rendering system
├── analysis/           # Data collection and statistics
├── examples/           # Interactive demos and ML models
└── utils/              # Utility functions
```

## 🧪 Development Status

**Current Version**: 1.0.0

This framework is actively developed as part of the EmptyAddress Network Autonomy Game project for social impact research and education.

### Completed Features

✅ Core agent system (BaseAgent, MovingAgent, NetworkAgent) with property management  
✅ Environment systems (ContinuousSpace, Grid2D) with spatial indexing  
✅ Scheduling systems (RandomScheduler, SequentialScheduler)  
✅ Network system (NetworkManager) with social influence and analysis  
✅ Interaction engine for agent-to-agent interactions  
✅ Behavior trees for complex agent behaviors  
✅ Performance benchmarking and optimization  
✅ Visualization system with p5.js integration, animations, and effects  
✅ Machine learning model integration with TensorFlow.js  
✅ TypeScript configuration with strict type checking  
✅ Build system with Vite and comprehensive exports  
✅ Comprehensive test suite validating all features

### In Progress

🚧 Interactive demonstration examples  
🚧 Documentation website and tutorials  
🚧 Advanced ML model training examples

## 🤝 Contributing

This project is developed as part of the EmptyAddress educational initiative. Please see our [contribution guidelines](CONTRIBUTING.md) for details on how to participate.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Apne Aap Women Worldwide** for partnership and guidance
- **p5.js Community** for visualization framework
- **Agent-Based Modeling Community** for research foundations

---

**Educational Impact**: Every technical decision in this framework supports learning about trafficking dynamics, community empowerment, and social network effects in vulnerable populations.
