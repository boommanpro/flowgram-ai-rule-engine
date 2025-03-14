import React from 'react';

import { type TreeNodeData } from '@douyinfe/semi-ui/lib/es/tree';
import { TreeSelect } from '@douyinfe/semi-ui';

import { type JsonSchema } from '../../../typings';
import { useVariableTree } from './use-variable-tree';

export interface VariableSelectorProps {
  value?: string;
  onChange: (value?: string) => void;
  options?: {
    size?: 'small' | 'large' | 'default';
    emptyContent?: JSX.Element;
    targetSchemas?: JsonSchema[];
    strongEqualToTargetSchema?: boolean;
  };
  hasError?: boolean;
  style?: React.CSSProperties;
  disabled?: boolean;
}

export const VariableSelector = ({
  value,
  onChange,
  options,
  disabled,
  style,
  hasError,
}: VariableSelectorProps) => {
  const { size = 'small', emptyContent, targetSchemas, strongEqualToTargetSchema } = options || {};

  const treeData = useVariableTree<TreeNodeData>({
    targetSchemas,
    strongEqual: strongEqualToTargetSchema,
    ignoreReadonly: true,
    getTreeData: ({ variable, key, icon, children, disabled, parentFields }) => ({
      key,
      value: key,
      icon: (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: 4,
          }}
        >
          {icon}
        </span>
      ),
      label: variable.meta?.expressionTitle || variable.key || '',
      disabled,
      labelPath: [...parentFields, variable]
        .map((_field) => _field.meta?.expressionTitle || _field.key || '')
        .join('.'),
      children,
    }),
  });

  const renderEmpty = () => {
    if (emptyContent) {
      return emptyContent;
    }

    return 'nodata';
  };

  return (
    <>
      <TreeSelect
        dropdownMatchSelectWidth={false}
        disabled={disabled}
        treeData={treeData}
        size={size}
        value={value}
        style={{
          ...style,
          outline: hasError ? '1px solid red' : undefined,
        }}
        validateStatus={hasError ? 'error' : undefined}
        onChange={(option) => {
          onChange(option as string);
        }}
        showClear
        placeholder="Select Variable..."
        emptyContent={renderEmpty()}
      />
    </>
  );
};
