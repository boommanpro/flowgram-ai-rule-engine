import { FlowNodeRegistry } from '../typings';
import { StartNodeRegistry } from './start';
import { LLMNodeRegistry } from './llm';
import { EndNodeRegistry } from './end';
import { ConditionNodeRegistry } from './condition';

export const nodeRegistries: FlowNodeRegistry[] = [
  ConditionNodeRegistry,
  StartNodeRegistry,
  EndNodeRegistry,
  LLMNodeRegistry,
];
