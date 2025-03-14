import React, { useContext, useState, useRef } from 'react';

import { Field, FieldRenderProps, FlowNodeRegistry } from '@flowgram.ai/free-layout-editor';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Input, TextArea } from '@douyinfe/semi-ui';

import { NodeRenderContext } from '../../context';
import { FormTitleDescription, FormWrapper } from './styles';
import { Feedback } from '../feedback';

/**
 * @param props
 * @constructor
 */
export function FormContent(props: { children?: React.ReactNode }) {
  const { node, expanded, toggleExpand, readonly } = useContext(NodeRenderContext);

  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDoubleClick = () => {
    if (!readonly) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleBlur = (onChange: (value: string) => void, value: string) => {
    onChange(value);
    setIsEditing(false);
  };

  return (
    <FormWrapper>
      {expanded ? (
        <>
          <FormTitleDescription onDoubleClick={handleDoubleClick}>
            <Field name="description">
              {({ field: { value, onChange }, fieldState }: FieldRenderProps<string>) => (
                <div>
                  {isEditing ? (
                    <TextArea
                      ref={inputRef}
                      defaultValue={value}
                      onBlur={() => handleBlur(onChange, inputRef.current?.value || '')}
                      onEnterPress={() => handleBlur(onChange, inputRef.current?.value || '')}
                    />
                  ) : (
                    <Text ellipsis={{ showTooltip: true }}>{value}</Text>
                  )}
                  <Feedback errors={fieldState?.errors} />
                </div>
              )}
            </Field>
          </FormTitleDescription>
          {props.children}
        </>
      ) : undefined}
    </FormWrapper>
  );
}
