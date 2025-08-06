import * as tf from '@tensorflow/tfjs';
import { MLBehaviorModel, MLAgentState, AgentAction } from '../interfaces';
import { Position } from '../../types/core';

/**
 * Generic economic agent ML model for trading and resource decisions
 * Works for market trading, resource allocation, or economic simulations
 */
export class EconomicMLModel implements MLBehaviorModel {
  private model?: tf.LayersModel;
  private inputFeatures: string[];
  private outputActions: string[];
  private isLoaded = false;
  private riskTolerance = 0.5;
  private greedFactor = 0.3;
  private socialInfluence = 0.2;

  constructor() {
    this.inputFeatures = [
      'resource_level', 'market_price', 'price_trend',
      'neighbor_avg_resources', 'neighbor_activity_level',
      'time_since_last_trade', 'trade_success_rate',
      'local_market_conditions', 'personal_wealth_rank'
    ];

    this.outputActions = [
      'buy_probability', 'sell_probability', 'hold_probability',
      'trade_amount', 'risk_level'
    ];
  }

  async predict(state: MLAgentState): Promise<AgentAction> {
    if (this.model && this.isLoaded) {
      return this.predictWithML(state);
    } else {
      // Fallback to rule-based economic behavior
      return this.predictWithRules(state);
    }
  }

  /**
   * ML-based prediction
   */
  private async predictWithML(state: MLAgentState): Promise<AgentAction> {
    try {
      const inputTensor = this.encodeEconomicState(state);
      const prediction = this.model!.predict(inputTensor) as tf.Tensor;
      const action = this.decodeEconomicAction(prediction, state);
      
      // Clean up tensors
      inputTensor.dispose();
      prediction.dispose();
      
      return action;
    } catch (error) {
      console.warn('ML prediction failed, falling back to rules:', error);
      return this.predictWithRules(state);
    }
  }

  /**
   * Rule-based economic prediction (fallback and training data generation)
   */
  private predictWithRules(state: MLAgentState): AgentAction {
    const resources = (state.properties.resources as number) || 50;
    const wealth = (state.properties.wealth as number) || 100;
    const marketPrice = this.getMarketPrice(state);
    const priceHistory = this.getPriceHistory(state);
    
    // Calculate market indicators
    const priceTrend = this.calculatePriceTrend(priceHistory);
    const volatility = this.calculateVolatility(priceHistory);
    const neighborBehavior = this.analyzeNeighborBehavior(state);
    
    // Make economic decision
    const decision = this.makeEconomicDecision({
      resources,
      wealth,
      marketPrice,
      priceTrend,
      volatility,
      neighborBehavior
    });

    return this.createEconomicAction(decision, state);
  }

  /**
   * Make economic decision based on current conditions
   */
  private makeEconomicDecision(context: {
    resources: number;
    wealth: number;
    marketPrice: number;
    priceTrend: number;
    volatility: number;
    neighborBehavior: { buying: number; selling: number; holding: number };
  }): { action: 'buy' | 'sell' | 'hold'; amount: number; confidence: number } {
    
    let buyScore = 0;
    let sellScore = 0;
    
    // Price-based scoring
    if (context.priceTrend > 0.1) {
      buyScore += 0.3; // Rising prices
    } else if (context.priceTrend < -0.1) {
      sellScore += 0.3; // Falling prices
    }
    
    // Volatility consideration
    if (context.volatility > 0.2) {
      // High volatility - be more cautious
      buyScore *= (1 - this.riskTolerance);
      sellScore *= (1 - this.riskTolerance);
    }
    
    // Resource level consideration
    const resourceRatio = context.resources / 100;
    if (resourceRatio < 0.3) {
      sellScore += 0.4; // Low resources, need to sell
    } else if (resourceRatio > 0.7) {
      buyScore += 0.2; // High resources, can afford to buy
    }
    
    // Wealth consideration
    const wealthFactor = Math.min(context.wealth / 1000, 1);
    buyScore *= wealthFactor; // Can only buy if wealthy enough
    
    // Social influence from neighbors
    const socialBias = 
      context.neighborBehavior.buying * this.socialInfluence -
      context.neighborBehavior.selling * this.socialInfluence;
    buyScore += socialBias;
    sellScore -= socialBias;
    
    // Greed factor
    if (context.priceTrend > 0.2) {
      buyScore += this.greedFactor; // FOMO
    } else if (context.priceTrend < -0.2) {
      sellScore += this.greedFactor; // Panic selling
    }
    
    // Determine action
    const threshold = 0.3;
    let action: 'buy' | 'sell' | 'hold';
    let confidence: number;
    
    if (buyScore > sellScore && buyScore > threshold) {
      action = 'buy';
      confidence = Math.min(buyScore, 1);
    } else if (sellScore > buyScore && sellScore > threshold) {
      action = 'sell';
      confidence = Math.min(sellScore, 1);
    } else {
      action = 'hold';
      confidence = 0.5;
    }
    
    // Calculate trade amount
    const baseAmount = Math.max(1, context.resources * 0.1);
    const confidenceMultiplier = confidence * (1 + this.riskTolerance);
    const amount = Math.floor(baseAmount * confidenceMultiplier);
    
    return { action, amount, confidence };
  }

  /**
   * Create agent action from economic decision
   */
  private createEconomicAction(
    decision: { action: 'buy' | 'sell' | 'hold'; amount: number; confidence: number },
    state: MLAgentState
  ): AgentAction {
    const marketPrice = this.getMarketPrice(state);
    
    switch (decision.action) {
      case 'buy':
        return {
          type: 'CUSTOM',
          parameters: {
            economicAction: 'buy',
            amount: decision.amount,
            price: marketPrice,
            resourceChange: decision.amount,
            wealthChange: -decision.amount * marketPrice
          },
          confidence: decision.confidence
        };
        
      case 'sell':
        return {
          type: 'CUSTOM',
          parameters: {
            economicAction: 'sell',
            amount: decision.amount,
            price: marketPrice,
            resourceChange: -decision.amount,
            wealthChange: decision.amount * marketPrice
          },
          confidence: decision.confidence
        };
        
      case 'hold':
      default:
        return {
          type: 'CHANGE_PROPERTY',
          parameters: {
            property: 'patience',
            delta: 1
          },
          confidence: decision.confidence
        };
    }
  }

  /**
   * Get current market price from environment or agent properties
   */
  private getMarketPrice(state: MLAgentState): number {
    return (state.environment.globalProperties?.marketPrice as number | undefined) || 
           (state.properties.marketPrice as number) || 
           50 + Math.sin(Date.now() / 10000) * 10; // Synthetic price variation
  }

  /**
   * Get price history for trend analysis
   */
  private getPriceHistory(state: MLAgentState): number[] {
    // In a real implementation, this would come from historical data
    // For now, generate synthetic price history
    const basePrice = this.getMarketPrice(state);
    const history: number[] = [];
    
    for (let i = 10; i >= 0; i--) {
      const variation = Math.sin((Date.now() - i * 1000) / 10000) * 10;
      const noise = (Math.random() - 0.5) * 5;
      history.push(basePrice + variation + noise);
    }
    
    return history;
  }

  /**
   * Calculate price trend (positive = rising, negative = falling)
   */
  private calculatePriceTrend(priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0;
    
    const recent = priceHistory.slice(-3);
    const older = priceHistory.slice(0, -3);
    
    const recentAvg = recent.reduce((sum, p) => sum + p, 0) / recent.length;
    const olderAvg = older.length > 0 
      ? older.reduce((sum, p) => sum + p, 0) / older.length
      : recentAvg;
    
    return (recentAvg - olderAvg) / olderAvg;
  }

  /**
   * Calculate price volatility
   */
  private calculateVolatility(priceHistory: number[]): number {
    if (priceHistory.length < 2) return 0;
    
    const avg = priceHistory.reduce((sum, p) => sum + p, 0) / priceHistory.length;
    const variance = priceHistory.reduce((sum, p) => sum + (p - avg) ** 2, 0) / priceHistory.length;
    
    return Math.sqrt(variance) / avg; // Coefficient of variation
  }

  /**
   * Analyze neighbor economic behavior
   */
  private analyzeNeighborBehavior(state: MLAgentState): { buying: number; selling: number; holding: number } {
    const neighbors = state.neighbors;
    if (neighbors.length === 0) {
      return { buying: 0.33, selling: 0.33, holding: 0.34 };
    }
    
    let buying = 0;
    let selling = 0;
    let holding = 0;
    
    for (const neighbor of neighbors) {
      const recentActivity = (neighbor.getProperty?.('recentEconomicActivity') as string) || 'hold';
      const tradingMomentum = (neighbor.getProperty?.('tradingMomentum') as number) || 0;
      
      if (recentActivity === 'buy' || tradingMomentum > 0.2) {
        buying++;
      } else if (recentActivity === 'sell' || tradingMomentum < -0.2) {
        selling++;
      } else {
        holding++;
      }
    }
    
    const total = neighbors.length;
    return {
      buying: buying / total,
      selling: selling / total,
      holding: holding / total
    };
  }

  /**
   * Encode agent state for ML model input
   */
  private encodeEconomicState(state: MLAgentState): tf.Tensor {
    const resources = ((state.properties.resources as number) || 50) / 100;
    // const wealth = Math.min(((state.properties.wealth as number) || 100) / 1000, 1); // Reserved for future calculations
    const marketPrice = this.getMarketPrice(state) / 100;
    const priceHistory = this.getPriceHistory(state);
    const priceTrend = this.calculatePriceTrend(priceHistory);
    const volatility = this.calculateVolatility(priceHistory);
    
    const neighborBehavior = this.analyzeNeighborBehavior(state);
    const neighborAvgResources = state.neighbors.length > 0
      ? state.neighbors.reduce((sum, n) => sum + ((n.getProperty?.('resources') as number) || 50), 0) 
        / state.neighbors.length / 100
      : 0.5;
    
    const timeSinceLastTrade = Math.min(((state.properties.timeSinceLastTrade as number) || 0) / 100, 1);
    const tradeSuccessRate = (state.properties.tradeSuccessRate as number) || 0.5;
    const localActivity = (neighborBehavior.buying + neighborBehavior.selling);
    const wealthRank = this.calculateWealthRank(state);
    
    const features = [
      resources,              // Resource level [0-1]
      marketPrice,           // Market price [normalized]
      priceTrend,            // Price trend [-1 to 1]
      neighborAvgResources,  // Neighbor resources [0-1]
      localActivity,         // Local activity [0-2]
      timeSinceLastTrade,    // Time since trade [0-1]
      tradeSuccessRate,      // Success rate [0-1]
      volatility,            // Market volatility [0+]
      wealthRank             // Wealth rank [0-1]
    ];

    return tf.tensor2d([features]);
  }

  /**
   * Calculate relative wealth rank among neighbors
   */
  private calculateWealthRank(state: MLAgentState): number {
    const myWealth = (state.properties.wealth as number) || 100;
    const neighbors = state.neighbors;
    
    if (neighbors.length === 0) return 0.5;
    
    let betterThanCount = 0;
    for (const neighbor of neighbors) {
      const neighborWealth = (neighbor.getProperty?.('wealth') as number) || 100;
      if (myWealth > neighborWealth) {
        betterThanCount++;
      }
    }
    
    return betterThanCount / neighbors.length;
  }

  /**
   * Decode ML output to economic action
   */
  private decodeEconomicAction(prediction: tf.Tensor, state: MLAgentState): AgentAction {
    const values = prediction.dataSync() as Float32Array;
    
    if (values.length >= 5) {
      const buyProb = values[0]!;
      const sellProb = values[1]!;
      const holdProb = values[2]!;
      const tradeAmount = Math.max(1, Math.floor(values[3]! * 50)); // Scale to reasonable amount
      // const riskLevel = values[4]!; // Reserved for future use
      
      // Determine action based on probabilities
      let action: 'buy' | 'sell' | 'hold';
      let confidence: number;
      
      if (buyProb > sellProb && buyProb > holdProb) {
        action = 'buy';
        confidence = buyProb;
      } else if (sellProb > holdProb) {
        action = 'sell';
        confidence = sellProb;
      } else {
        action = 'hold';
        confidence = holdProb;
      }
      
      const decision = { action, amount: tradeAmount, confidence };
      return this.createEconomicAction(decision, state);
    }

    // Fallback
    return this.predictWithRules(state);
  }

  async load(modelPath: string): Promise<void> {
    try {
      this.model = await tf.loadLayersModel(modelPath);
      this.isLoaded = true;
      console.log('EconomicMLModel loaded successfully');
    } catch (error) {
      console.warn('Failed to load EconomicMLModel, using rule-based fallback:', error);
      this.isLoaded = false;
    }
  }

  getRequiredInputs(): string[] {
    return [...this.inputFeatures];
  }

  getOutputActions(): string[] {
    return [...this.outputActions];
  }

  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = undefined as any;
    }
    this.isLoaded = false;
  }

  /**
   * Configure economic behavior parameters
   */
  configure(options: {
    riskTolerance?: number;
    greedFactor?: number;
    socialInfluence?: number;
  }): void {
    if (options.riskTolerance !== undefined) {
      this.riskTolerance = Math.max(0, Math.min(1, options.riskTolerance));
    }
    if (options.greedFactor !== undefined) {
      this.greedFactor = Math.max(0, Math.min(1, options.greedFactor));
    }
    if (options.socialInfluence !== undefined) {
      this.socialInfluence = Math.max(0, Math.min(1, options.socialInfluence));
    }
  }

  /**
   * Generate training data for economic model
   */
  generateTrainingData(
    scenarios: Array<{ 
      agentCount: number; 
      marketConditions: 'bull' | 'bear' | 'volatile' | 'stable';
      initialWealth: { min: number; max: number };
    }>,
    stepsPerScenario: number = 200
  ): Array<{ input: number[]; output: number[] }> {
    const trainingData: Array<{ input: number[]; output: number[] }> = [];

    for (const scenario of scenarios) {
      for (let step = 0; step < stepsPerScenario; step++) {
        const mockState = this.generateMockEconomicState(scenario, step);
        const action = this.predictWithRules(mockState);
        
        const input = this.encodeEconomicState(mockState).dataSync() as Float32Array;
        
        // Convert action back to output format
        let output: number[];
        if (action.parameters.economicAction === 'buy') {
          output = [0.8, 0.1, 0.1, action.parameters.amount / 50, 0.6];
        } else if (action.parameters.economicAction === 'sell') {
          output = [0.1, 0.8, 0.1, action.parameters.amount / 50, 0.4];
        } else {
          output = [0.1, 0.1, 0.8, 0.1, 0.3];
        }

        trainingData.push({
          input: Array.from(input),
          output
        });
      }
    }

    return trainingData;
  }

  /**
   * Generate mock economic state for training
   */
  private generateMockEconomicState(
    scenario: { 
      agentCount: number; 
      marketConditions: string;
      initialWealth: { min: number; max: number };
    }, 
    step: number
  ): MLAgentState {
    const wealth = scenario.initialWealth.min + 
      Math.random() * (scenario.initialWealth.max - scenario.initialWealth.min);
    
    const resources = 30 + Math.random() * 40;
    
    // Market price varies based on conditions
    let basePrice = 50;
    let volatility = 0.1;
    
    switch (scenario.marketConditions) {
      case 'bull':
        basePrice = 50 + step * 0.5;
        volatility = 0.05;
        break;
      case 'bear':
        basePrice = 100 - step * 0.3;
        volatility = 0.08;
        break;
      case 'volatile':
        basePrice = 50 + Math.sin(step * 0.1) * 20;
        volatility = 0.3;
        break;
      case 'stable':
        basePrice = 50 + Math.sin(step * 0.01) * 5;
        volatility = 0.02;
        break;
    }
    
    const marketPrice = basePrice + (Math.random() - 0.5) * volatility * basePrice;
    
    // Generate mock neighbors
    const neighborCount = Math.floor(Math.random() * Math.min(8, scenario.agentCount - 1));
    const neighbors = Array.from({ length: neighborCount }, () => ({
      id: Math.random().toString(),
      position: { x: Math.random() * 1000, y: Math.random() * 1000 } as Position,
      getProperty: (key: string) => {
        switch (key) {
          case 'resources': return 30 + Math.random() * 40;
          case 'wealth': return scenario.initialWealth.min + 
            Math.random() * (scenario.initialWealth.max - scenario.initialWealth.min);
          case 'recentEconomicActivity': 
            return ['buy', 'sell', 'hold'][Math.floor(Math.random() * 3)];
          case 'tradingMomentum': return (Math.random() - 0.5) * 0.6;
          default: return Math.random();
        }
      }
    }));

    return {
      position: { x: Math.random() * 1000, y: Math.random() * 1000 } as Position,
      properties: {
        resources,
        wealth,
        marketPrice,
        timeSinceLastTrade: Math.random() * 50,
        tradeSuccessRate: 0.3 + Math.random() * 0.4
      },
      environment: {
        bounds: { width: 1000, height: 1000 },
        currentStep: step,
        globalProperties: { marketPrice },
        localDensity: neighborCount
      },
      neighbors: neighbors as any[]
    };
  }
}