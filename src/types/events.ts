/**
 * Event type definitions for the AgentJS framework
 */

import type { Agent } from '../core/agents/Agent';
import type { PropertyValue } from './core';

/** Base event interface */
export interface BaseEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly source?: Agent;
}

/** Agent property change event */
export interface PropertyChangedEvent extends BaseEvent {
  readonly type: 'propertyChanged';
  readonly agent: Agent;
  readonly property: string;
  readonly oldValue: PropertyValue;
  readonly newValue: PropertyValue;
}

/** Agent position change event */
export interface PositionChangedEvent extends BaseEvent {
  readonly type: 'positionChanged';
  readonly agent: Agent;
  readonly oldPosition: { x: number; y: number };
  readonly newPosition: { x: number; y: number };
}

/** Agent interaction event */
export interface InteractionEvent extends BaseEvent {
  readonly type: 'interaction';
  readonly initiator: Agent;
  readonly target: Agent;
  readonly interactionType: string;
  readonly result: Record<string, any>;
}

/** Network connection event */
export interface ConnectionEvent extends BaseEvent {
  readonly type: 'connectionFormed' | 'connectionBroken' | 'connectionModified';
  readonly source: Agent;
  readonly target: Agent;
  readonly connectionType: string;
  readonly strength?: number;
}

/** Agent lifecycle events */
export interface AgentLifecycleEvent extends BaseEvent {
  readonly type:
    | 'agentCreated'
    | 'agentDestroyed'
    | 'agentActivated'
    | 'agentDeactivated';
  readonly agent: Agent;
}

/** Simulation step event */
export interface SimulationStepEvent extends BaseEvent {
  readonly type: 'simulationStep';
  readonly stepNumber: number;
  readonly agentCount: number;
  readonly activeAgents: number;
}

/** Performance warning event */
export interface PerformanceWarningEvent extends BaseEvent {
  readonly type: 'performanceWarning';
  readonly metric: string;
  readonly value: number;
  readonly threshold: number;
  readonly message: string;
}

/** Union of all event types */
export type AgentEvent =
  | PropertyChangedEvent
  | PositionChangedEvent
  | InteractionEvent
  | ConnectionEvent
  | AgentLifecycleEvent
  | SimulationStepEvent
  | PerformanceWarningEvent;

/** Event listener function type */
export type EventListener<T extends BaseEvent = AgentEvent> = (
  _event: T
) => void;

/** Event handler map */
export type EventHandlerMap = {
  [K in AgentEvent['type']]?: EventListener<Extract<AgentEvent, { type: K }>>[];
};
