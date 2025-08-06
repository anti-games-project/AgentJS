# Complete ML Demos Recreation Prompt

## Context
You are working on the EmptyAddress Network Autonomy Game (AgentJS Framework) Week 6 ML Integration. The user needs two fully functional p5.js demos showing ML vs rule-based agent comparisons. One demo (p5-behavior-demo.html) is working but one other need complete recreation.

## Required Files to Create

### 1. Stock Trading Demo: `/examples/ml-models/demos/stock-trading-demo.html`

**Requirements:**
- **Economic modeling with Chart.js price visualization**
- **ML Traders (Green)**: Technical analysis (RSI, moving averages), sentiment analysis, risk management
- **Rule Traders (Orange)**: Simple buy-low/sell-high logic
- **Live Chart.js line chart** showing market price over time
- **Real-time JSON configuration panel** with load/export
- **Live parameter sliders**: Risk Tolerance (0-1), Technical Analysis Weight (0-1), Market Volatility (0-1), Initial Cash (1000-50000)
- **Portfolio metrics**: Cash, shares, total value, profit/loss percentages
- **Market scenarios**: Bull market, Bear market, Volatile market, Crash simulation

**Key Classes:**
```javascript
class TradingAgent {
  constructor(x, y, isML = true)
  makeMLTradingDecision() // Technical analysis + sentiment + risk
  makeRuleTradingDecision() // Simple price comparison
  calculateTechnicalIndicators() // RSI, SMA, volatility
  updatePortfolio(action, price)
  assessRisk()
}

// Market state and Chart.js integration
let marketState = {
  price: 100,
  priceHistory: [],
  volatility: 0.02,
  sentiment: 0.5
}
```

### 2. Update Index Page: `/examples/ml-models/demos/index.html`

**Already exists but ensure it has:**
- Professional landing page showcasing all three demos
- Configuration examples for each demo
- Comparison tables showing ML vs Rule capabilities
- Tech stack information and usage instructions

## Technical Requirements

### Common Features (All Demos):
1. **p5.js integration**: Full-screen canvas with proper setup/draw loops
2. **Real-time controls**: Play/Pause/Reset buttons with visual feedback
3. **JSON configuration system**: 
   - Live textarea showing current config
   - Load/Export buttons with file download
   - Parameter validation and error handling
4. **Interactive sliders**: Real-time parameter adjustment with value display
5. **Performance monitoring**: FPS counter, agent counts, simulation metrics
6. **Professional UI**: Dark theme with green accents (#00ff88), monospace fonts
7. **Feature explanations**: Bottom-right panel explaining current AgentJS capability
8. **Scenario buttons**: Turn green when active, multiple scenarios per demo

### Specific Technical Details:

**Flocking Demo Specifics:**
- Canvas size: windowWidth x windowHeight
- Bird count: 25 ML + 25 Rule for flocking scenario
- Topological neighbors: Default 7, research-based (Ballerini et al. studies)
- Density wave calculation: Store local density history, detect gradients
- Predator scenario: 3 red predators with hunt radius visualization
- Obstacle scenario: 5 blue circular obstacles with collision detection

**Trading Demo Specifics:**
- Chart.js configuration: Line chart, 50-point sliding window, real-time updates
- Market simulation: Price walks with configurable volatility and trends
- Technical indicators: 14-period RSI, 20-period SMA, volatility calculation
- Trading logic: ML agents use multiple signals, Rule agents use simple thresholds
- Visual representation: Agents as circles on trading floor, size = portfolio value

### Color Schemes:
- **ML Agents**: Green (#00ff88) or Blue (#00aaff) 
- **Rule Agents**: Orange (#ffaa00)
- **Resources**: Red (#ff4444)
- **Obstacles**: Blue (#4444ff)
- **Predators**: Red (#ff4444)
- **UI**: Dark background (#0a0a15), green accents (#00ff88)

### File Structure:
```
/examples/ml-models/demos/
├── index.html (landing page - already exists)
├── p5-behavior-demo.html (resource seeking - working)
├── flocking-demo.html (CREATE THIS)
└── stock-trading-demo.html (CREATE THIS)
```

## Validation Checklist

For each demo, verify:
- [ ] Loads without console errors
- [ ] Play/Pause/Reset buttons work
- [ ] All sliders update parameters in real-time
- [ ] JSON config loads/exports correctly
- [ ] Scenario buttons switch properly and turn green
- [ ] Performance metrics update (FPS, counts)
- [ ] Visual differences between ML and Rule agents are clear
- [ ] Feature explanation panel updates with scenario changes
- [ ] Responsive design works on different screen sizes

## Implementation Priority:
1. **stock-trading-demo.html** - Chart.js integration challenges  
2. **Update index.html** - Ensure all links and descriptions accurate

## Success Criteria:
The demo fully functional with professional presentation, clear ML vs Rule comparisons, and comprehensive JSON configuration systems. Each demo should effectively demonstrate different AgentJS framework capabilities for educational purposes.

Create these files with complete, production-ready code that works immediately when opened in a browser.
