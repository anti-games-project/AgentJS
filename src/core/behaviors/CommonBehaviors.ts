/**
 * CommonBehaviors - Reusable behavior tree nodes for agents
 */

import {
  BehaviorNode,
  ActionNode,
  ConditionNode,
  NodeStatus,
  BehaviorContext,
  SequenceNode,
  SelectorNode,
} from './BehaviorTree';
import type { Agent } from '../agents/Agent';
import type { Environment } from '../environment/Environment';
import type { Position } from '../../types/core';

/**
 * Movement behaviors
 */
export class MovementBehaviors {
  /**
   * Move towards a target position
   */
  static moveToPosition(
    targetPosition: Position,
    speed: number = 1
  ): ActionNode {
    return new ActionNode('MoveToPosition', context => {
      const agent = context.agent;
      const currentPos = agent.position;

      const dx = targetPosition.x - currentPos.x;
      const dy = targetPosition.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.1) {
        return NodeStatus.SUCCESS;
      }

      const moveX = (dx / distance) * speed * context.deltaTime;
      const moveY = (dy / distance) * speed * context.deltaTime;

      agent.setPosition({
        x: currentPos.x + moveX,
        y: currentPos.y + moveY,
      } as Position);

      return NodeStatus.RUNNING;
    });
  }

  /**
   * Wander randomly
   */
  static wander(speed: number = 1): ActionNode {
    return new ActionNode('Wander', context => {
      const agent = context.agent;

      // Get or create wander target
      let wanderTarget = context.blackboard.get('wanderTarget');
      if (!wanderTarget) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 5 + Math.random() * 10;
        wanderTarget = {
          x: agent.position.x + Math.cos(angle) * distance,
          y: agent.position.y + Math.sin(angle) * distance,
        };
        context.blackboard.set('wanderTarget', wanderTarget);
      }

      const currentPos = agent.position;
      const dx = wanderTarget.x - currentPos.x;
      const dy = wanderTarget.y - currentPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 0.5) {
        // Reached target, pick new one
        context.blackboard.delete('wanderTarget');
        return NodeStatus.SUCCESS;
      }

      const moveX = (dx / distance) * speed * context.deltaTime;
      const moveY = (dy / distance) * speed * context.deltaTime;

      agent.setPosition({
        x: currentPos.x + moveX,
        y: currentPos.y + moveY,
      } as Position);

      return NodeStatus.RUNNING;
    });
  }

  /**
   * Flee from a position
   */
  static fleeFrom(dangerPosition: Position, speed: number = 1.5): ActionNode {
    return new ActionNode('FleeFrom', context => {
      const agent = context.agent;
      const currentPos = agent.position;

      const dx = currentPos.x - dangerPosition.x;
      const dy = currentPos.y - dangerPosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 10) {
        return NodeStatus.SUCCESS;
      }

      const fleeX = (dx / distance) * speed * context.deltaTime;
      const fleeY = (dy / distance) * speed * context.deltaTime;

      agent.setPosition({
        x: currentPos.x + fleeX,
        y: currentPos.y + fleeY,
      } as Position);

      return NodeStatus.RUNNING;
    });
  }
}

/**
 * Property conditions
 */
export class PropertyConditions {
  /**
   * Check if property is above threshold
   */
  static propertyAbove(property: string, threshold: number): ConditionNode {
    return new ConditionNode(`${property} > ${threshold}`, context => {
      const value = context.agent.getProperty<number>(property) ?? 0;
      return value > threshold;
    });
  }

  /**
   * Check if property is below threshold
   */
  static propertyBelow(property: string, threshold: number): ConditionNode {
    return new ConditionNode(`${property} < ${threshold}`, context => {
      const value = context.agent.getProperty<number>(property) ?? 0;
      return value < threshold;
    });
  }

  /**
   * Check if property equals value
   */
  static propertyEquals(property: string, value: any): ConditionNode {
    return new ConditionNode(`${property} == ${value}`, context => {
      return context.agent.getProperty(property) === value;
    });
  }

  /**
   * Check if has property
   */
  static hasProperty(property: string): ConditionNode {
    return new ConditionNode(`Has ${property}`, context => {
      return context.agent.hasProperty(property);
    });
  }
}

/**
 * Resource management behaviors
 */
export class ResourceBehaviors {
  /**
   * Consume resource
   */
  static consumeResource(resource: string, amount: number): ActionNode {
    return new ActionNode(`Consume ${resource}`, context => {
      const agent = context.agent;
      const current = agent.getProperty<number>(resource) ?? 0;

      if (current < amount) {
        return NodeStatus.FAILURE;
      }

      agent.setProperty(resource, current - amount);
      return NodeStatus.SUCCESS;
    });
  }

  /**
   * Gather resource
   */
  static gatherResource(resource: string, amount: number): ActionNode {
    return new ActionNode(`Gather ${resource}`, context => {
      const agent = context.agent;
      const current = agent.getProperty<number>(resource) ?? 0;

      agent.setProperty(resource, current + amount);
      return NodeStatus.SUCCESS;
    });
  }

  /**
   * Transfer resource to another agent
   */
  static transferResource(
    resource: string,
    _targetAgentId: string,
    amount: number
  ): ActionNode {
    return new ActionNode(`Transfer ${resource}`, context => {
      const agent = context.agent;
      const current = agent.getProperty<number>(resource) ?? 0;

      if (current < amount) {
        return NodeStatus.FAILURE;
      }

      // In a real implementation, would find target agent and transfer
      agent.setProperty(resource, current - amount);
      return NodeStatus.SUCCESS;
    });
  }
}

/**
 * Social behaviors
 */
export class SocialBehaviors {
  /**
   * Seek nearby agents
   */
  static seekNearbyAgents(
    environment: Environment,
    radius: number = 5
  ): ActionNode {
    return new ActionNode('SeekNearbyAgents', context => {
      const agent = context.agent;
      const position = environment.getAgentPosition(agent);

      if (!position) {
        return NodeStatus.FAILURE;
      }

      const nearby = environment.findNeighbors(position, radius, {
        filterFn: other => other.id !== agent.id,
      });

      if (nearby.items.length === 0) {
        return NodeStatus.FAILURE;
      }

      // Store nearby agents in blackboard
      context.blackboard.set('nearbyAgents', nearby.items);
      return NodeStatus.SUCCESS;
    });
  }

  /**
   * Interact with nearest agent
   */
  static interactWithNearest(): ActionNode {
    return new ActionNode('InteractWithNearest', context => {
      const nearbyAgents = context.blackboard.get('nearbyAgents') as Agent[];

      if (!nearbyAgents || nearbyAgents.length === 0) {
        return NodeStatus.FAILURE;
      }

      // In real implementation, would trigger interaction
      return NodeStatus.SUCCESS;
    });
  }
}

/**
 * Utility-based decision making
 */
export class UtilityBehaviors {
  /**
   * Select action based on utility scores
   */
  static utilitySelect(
    actions: Array<{
      name: string;
      utility: (context: BehaviorContext) => number;
      behavior: BehaviorNode;
    }>
  ): BehaviorNode {
    return new ActionNode('UtilitySelect', context => {
      // Calculate utilities
      const scores = actions.map(action => ({
        ...action,
        score: action.utility(context),
      }));

      // Sort by score
      scores.sort((a, b) => b.score - a.score);

      // Execute highest utility action
      if (scores.length > 0 && scores[0]!.score > 0) {
        return scores[0]!.behavior.execute(context);
      }

      return NodeStatus.FAILURE;
    });
  }

  /**
   * Energy utility function
   */
  static energyUtility(
    weight: number = 1
  ): (context: BehaviorContext) => number {
    return context => {
      const energy = context.agent.getProperty<number>('energy') ?? 0;
      return ((100 - energy) / 100) * weight;
    };
  }

  /**
   * Social utility function
   */
  static socialUtility(
    weight: number = 1
  ): (context: BehaviorContext) => number {
    return context => {
      const loneliness = context.agent.getProperty<number>('loneliness') ?? 0;
      return (loneliness / 100) * weight;
    };
  }
}

/**
 * Create common behavior patterns
 */
export class BehaviorPatterns {
  /**
   * Create a foraging behavior
   */
  static createForagingBehavior(environment: Environment): BehaviorNode {
    const sequence = new SequenceNode('Foraging');

    sequence
      .addChild(PropertyConditions.propertyBelow('energy', 50))
      .addChild(MovementBehaviors.wander(1))
      .addChild(SocialBehaviors.seekNearbyAgents(environment, 3))
      .addChild(ResourceBehaviors.gatherResource('energy', 10));

    return sequence;
  }

  /**
   * Create a social behavior
   */
  static createSocialBehavior(environment: Environment): BehaviorNode {
    const sequence = new SequenceNode('Socializing');

    sequence
      .addChild(PropertyConditions.propertyAbove('loneliness', 30))
      .addChild(SocialBehaviors.seekNearbyAgents(environment, 10))
      .addChild(SocialBehaviors.interactWithNearest());

    return sequence;
  }

  /**
   * Create a flee behavior
   */
  static createFleeBehavior(dangerThreshold: number = 30): BehaviorNode {
    const selector = new SelectorNode('SafetyFirst');

    selector.addChild(
      new SequenceNode('CheckDanger')
        .addChild(PropertyConditions.propertyAbove('danger', dangerThreshold))
        .addChild(MovementBehaviors.wander(2)) // Flee quickly
    );

    return selector;
  }

  /**
   * Create a balanced agent behavior
   */
  static createBalancedBehavior(environment: Environment): BehaviorNode {
    const root = new SelectorNode('BalancedAgent');

    // Priority 1: Safety
    root.addChild(this.createFleeBehavior());

    // Priority 2: Basic needs
    root.addChild(this.createForagingBehavior(environment));

    // Priority 3: Social needs
    root.addChild(this.createSocialBehavior(environment));

    // Default: Wander
    root.addChild(MovementBehaviors.wander(0.5));

    return root;
  }
}
