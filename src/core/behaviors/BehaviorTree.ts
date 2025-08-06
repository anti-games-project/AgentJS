/**
 * BehaviorTree - Advanced agent AI system using behavior trees
 */

import type { Agent } from '../agents/Agent';

/** Node execution status */
export enum NodeStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
  RUNNING = 'running',
}

/** Behavior tree node context */
export interface BehaviorContext {
  agent: Agent;
  deltaTime: number;
  blackboard: Map<string, any>;
  [key: string]: any;
}

/**
 * Base class for all behavior tree nodes
 */
export abstract class BehaviorNode {
  protected name: string;
  protected parent: BehaviorNode | null = null;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * Execute the node behavior
   */
  abstract execute(context: BehaviorContext): NodeStatus;

  /**
   * Reset node state
   */
  reset(): void {
    // Override in subclasses if needed
  }

  /**
   * Get node name
   */
  getName(): string {
    return this.name;
  }

  /**
   * Set parent node
   */
  setParent(parent: BehaviorNode): void {
    this.parent = parent;
  }
}

/**
 * Composite node that can have children
 */
export abstract class CompositeNode extends BehaviorNode {
  protected children: BehaviorNode[] = [];

  /**
   * Add child node
   */
  addChild(child: BehaviorNode): this {
    child.setParent(this);
    this.children.push(child);
    return this;
  }

  /**
   * Remove child node
   */
  removeChild(child: BehaviorNode): boolean {
    const index = this.children.indexOf(child);
    if (index >= 0) {
      this.children.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all children
   */
  getChildren(): ReadonlyArray<BehaviorNode> {
    return this.children;
  }

  /**
   * Reset all children
   */
  override reset(): void {
    super.reset();
    for (const child of this.children) {
      child.reset();
    }
  }
}

/**
 * Decorator node that modifies behavior of a single child
 */
export abstract class DecoratorNode extends BehaviorNode {
  protected child: BehaviorNode | null = null;

  /**
   * Set the child node
   */
  setChild(child: BehaviorNode): this {
    if (this.child) {
      this.child.setParent(null!);
    }
    child.setParent(this);
    this.child = child;
    return this;
  }

  /**
   * Get child node
   */
  getChild(): BehaviorNode | null {
    return this.child;
  }

  /**
   * Reset child
   */
  override reset(): void {
    super.reset();
    this.child?.reset();
  }
}

/**
 * Sequence node - executes children in order until one fails
 */
export class SequenceNode extends CompositeNode {
  private currentIndex: number = 0;

  constructor(name: string = 'Sequence') {
    super(name);
  }

  execute(context: BehaviorContext): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex]!;
      const status = child.execute(context);

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }

      if (status === NodeStatus.FAILURE) {
        this.currentIndex = 0;
        return NodeStatus.FAILURE;
      }

      this.currentIndex++;
    }

    this.currentIndex = 0;
    return NodeStatus.SUCCESS;
  }

  override reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

/**
 * Selector node - executes children until one succeeds
 */
export class SelectorNode extends CompositeNode {
  private currentIndex: number = 0;

  constructor(name: string = 'Selector') {
    super(name);
  }

  execute(context: BehaviorContext): NodeStatus {
    while (this.currentIndex < this.children.length) {
      const child = this.children[this.currentIndex]!;
      const status = child.execute(context);

      if (status === NodeStatus.RUNNING) {
        return NodeStatus.RUNNING;
      }

      if (status === NodeStatus.SUCCESS) {
        this.currentIndex = 0;
        return NodeStatus.SUCCESS;
      }

      this.currentIndex++;
    }

    this.currentIndex = 0;
    return NodeStatus.FAILURE;
  }

  override reset(): void {
    super.reset();
    this.currentIndex = 0;
  }
}

/**
 * Parallel node - executes all children simultaneously
 */
export class ParallelNode extends CompositeNode {
  private successThreshold: number;
  private failureThreshold: number;

  constructor(
    name: string = 'Parallel',
    successThreshold: number = 1,
    failureThreshold: number = 1
  ) {
    super(name);
    this.successThreshold = successThreshold;
    this.failureThreshold = failureThreshold;
  }

  execute(context: BehaviorContext): NodeStatus {
    let successCount = 0;
    let failureCount = 0;
    let runningCount = 0;

    for (const child of this.children) {
      const status = child.execute(context);

      switch (status) {
        case NodeStatus.SUCCESS:
          successCount++;
          break;
        case NodeStatus.FAILURE:
          failureCount++;
          break;
        case NodeStatus.RUNNING:
          runningCount++;
          break;
      }
    }

    if (successCount >= this.successThreshold) {
      return NodeStatus.SUCCESS;
    }

    if (failureCount >= this.failureThreshold) {
      return NodeStatus.FAILURE;
    }

    if (runningCount > 0) {
      return NodeStatus.RUNNING;
    }

    return NodeStatus.FAILURE;
  }
}

/**
 * Inverter decorator - inverts the result of its child
 */
export class InverterNode extends DecoratorNode {
  constructor(name: string = 'Inverter') {
    super(name);
  }

  execute(context: BehaviorContext): NodeStatus {
    if (!this.child) {
      return NodeStatus.FAILURE;
    }

    const status = this.child.execute(context);

    switch (status) {
      case NodeStatus.SUCCESS:
        return NodeStatus.FAILURE;
      case NodeStatus.FAILURE:
        return NodeStatus.SUCCESS;
      default:
        return status;
    }
  }
}

/**
 * Repeater decorator - repeats child execution
 */
export class RepeaterNode extends DecoratorNode {
  private maxRepeats: number;
  private currentRepeats: number = 0;

  constructor(name: string = 'Repeater', maxRepeats: number = -1) {
    super(name);
    this.maxRepeats = maxRepeats;
  }

  execute(context: BehaviorContext): NodeStatus {
    if (!this.child) {
      return NodeStatus.FAILURE;
    }

    if (this.maxRepeats > 0 && this.currentRepeats >= this.maxRepeats) {
      this.currentRepeats = 0;
      return NodeStatus.SUCCESS;
    }

    const status = this.child.execute(context);

    if (status === NodeStatus.RUNNING) {
      return NodeStatus.RUNNING;
    }

    this.currentRepeats++;

    if (this.maxRepeats < 0) {
      // Infinite repeat
      return NodeStatus.RUNNING;
    }

    return NodeStatus.RUNNING;
  }

  override reset(): void {
    super.reset();
    this.currentRepeats = 0;
  }
}

/**
 * Condition node - checks a condition
 */
export class ConditionNode extends BehaviorNode {
  private condition: (context: BehaviorContext) => boolean;

  constructor(name: string, condition: (context: BehaviorContext) => boolean) {
    super(name);
    this.condition = condition;
  }

  execute(context: BehaviorContext): NodeStatus {
    return this.condition(context) ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
}

/**
 * Action node - performs an action
 */
export class ActionNode extends BehaviorNode {
  private action: (context: BehaviorContext) => NodeStatus;

  constructor(name: string, action: (context: BehaviorContext) => NodeStatus) {
    super(name);
    this.action = action;
  }

  execute(context: BehaviorContext): NodeStatus {
    return this.action(context);
  }
}

/**
 * Wait node - waits for a specified duration
 */
export class WaitNode extends BehaviorNode {
  private duration: number;
  private elapsedTime: number = 0;

  constructor(name: string = 'Wait', duration: number) {
    super(name);
    this.duration = duration;
  }

  execute(context: BehaviorContext): NodeStatus {
    this.elapsedTime += context.deltaTime;

    if (this.elapsedTime >= this.duration) {
      this.elapsedTime = 0;
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.RUNNING;
  }

  override reset(): void {
    super.reset();
    this.elapsedTime = 0;
  }
}

/**
 * Behavior tree manager for an agent
 */
export class BehaviorTree {
  private root: BehaviorNode | null = null;
  private blackboard: Map<string, any>;

  constructor(root?: BehaviorNode | any) {
    this.blackboard = new Map();
    if (root) {
      // Support both proper BehaviorNode instances and simple node objects
      if (root instanceof BehaviorNode) {
        this.root = root;
      } else if (root.execute && typeof root.execute === 'function') {
        // Convert simple node object to ActionNode
        this.root = new ActionNode(root.id || root.name || 'SimpleNode', root.execute);
      }
    }
  }

  /**
   * Set the root node of the tree
   */
  setRoot(root: BehaviorNode): void {
    this.root = root;
  }

  /**
   * Execute the behavior tree
   */
  execute(agent: Agent, deltaTime?: number): NodeStatus | any {
    if (!this.root) {
      return NodeStatus.FAILURE;
    }

    const context: BehaviorContext = {
      agent,
      deltaTime: deltaTime || 0.016,
      blackboard: this.blackboard,
    };

    const result = this.root.execute(context);
    
    // Support both enum and object return formats for compatibility
    if (result === NodeStatus.SUCCESS) {
      return { status: 'success' };
    } else if (result === NodeStatus.FAILURE) {
      return { status: 'failure' };
    } else if (result === NodeStatus.RUNNING) {
      return { status: 'running' };
    }
    
    return result;
  }

  /**
   * Reset the behavior tree
   */
  reset(): void {
    this.root?.reset();
    this.blackboard.clear();
  }

  /**
   * Get blackboard value
   */
  getBlackboardValue<T>(key: string): T | undefined {
    return this.blackboard.get(key);
  }

  /**
   * Set blackboard value
   */
  setBlackboardValue<T>(key: string, value: T): void {
    this.blackboard.set(key, value);
  }

  /**
   * Clear blackboard
   */
  clearBlackboard(): void {
    this.blackboard.clear();
  }

  /**
   * Create a behavior tree from JSON configuration
   */
  static fromJSON(_config: any): BehaviorTree {
    const tree = new BehaviorTree();
    // Implementation would parse JSON and build tree
    // This is a placeholder for the actual implementation
    return tree;
  }
}
