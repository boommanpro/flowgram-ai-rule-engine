import { FlowNodeRegistry } from '../typings';
import { StartNodeRegistry } from './start';
import { NoteNodeRegistry } from './note';
import { LLMNodeRegistry } from './llm';
import { EndNodeRegistry } from './end';
import { ConditionNodeRegistry } from './condition';
import { CodeNodeRegistry } from './code';

export const nodeRegistries: FlowNodeRegistry[] = [
  ConditionNodeRegistry,
  StartNodeRegistry,
  EndNodeRegistry,
  LLMNodeRegistry,
  NoteNodeRegistry,
  CodeNodeRegistry,
];
