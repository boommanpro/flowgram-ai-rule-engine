import React, { type SVGProps } from 'react';

import { Input, Button } from '@douyinfe/semi-ui';

import { FlowRefValueSchema, FlowLiteralValueSchema } from '../../typings';
import { VariableSelector } from '../../plugins/sync-variable-plugin/variable-selector';

export function FxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 16 16" {...props}>
      <path
        fill="currentColor"
        fillRule="evenodd"
        d="M5.581 4.49A2.75 2.75 0 0 1 8.319 2h.931a.75.75 0 0 1 0 1.5h-.931a1.25 1.25 0 0 0-1.245 1.131l-.083.869H9.25a.75.75 0 0 1 0 1.5H6.849l-.43 4.51A2.75 2.75 0 0 1 3.681 14H2.75a.75.75 0 0 1 0-1.5h.931a1.25 1.25 0 0 0 1.245-1.132L5.342 7H3.75a.75.75 0 0 1 0-1.5h1.735zM9.22 9.22a.75.75 0 0 1 1.06 0l1.22 1.22l1.22-1.22a.75.75 0 1 1 1.06 1.06l-1.22 1.22l1.22 1.22a.75.75 0 1 1-1.06 1.06l-1.22-1.22l-1.22 1.22a.75.75 0 1 1-1.06-1.06l1.22-1.22l-1.22-1.22a.75.75 0 0 1 0-1.06"
        clipRule="evenodd"
      ></path>
    </svg>
  );
}

export interface FxExpressionProps {
  value?: FlowLiteralValueSchema | FlowRefValueSchema;
  onChange: (value: FlowLiteralValueSchema | FlowRefValueSchema) => void;
  literal?: boolean;
  hasError?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export function FxExpression(props: FxExpressionProps) {
  const { value, onChange, disabled, literal, icon } = props;
  if (literal) return <Input value={value as string} onChange={onChange} disabled={disabled} />;
  const isExpression = typeof value === 'object' && value.type === 'expression';
  const toggleExpression = () => {
    if (isExpression) {
      onChange((value as FlowRefValueSchema).content as string);
    } else {
      onChange({ content: value as string, type: 'expression' });
    }
  };
  return (
    <div style={{ display: 'flex' }}>
      {isExpression ? (
        <VariableSelector
          value={value.content}
          hasError={props.hasError}
          style={{ flexGrow: 1 }}
          onChange={(v) => onChange({ type: 'expression', content: v })}
          disabled={disabled}
        />
      ) : (
        <Input
          value={value as string}
          onChange={onChange}
          validateStatus={props.hasError ? 'error' : undefined}
          disabled={disabled}
          style={{ flexGrow: 1, outline: props.hasError ? '1px solid red' : undefined }}
        />
      )}
      {!disabled &&
        (icon || <Button theme="borderless" icon={<FxIcon />} onClick={toggleExpression} />)}
    </div>
  );
}
