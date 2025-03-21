import React, { useContext, useRef, useState } from 'react';

import {
  Command,
  Field,
  FieldRenderProps,
  useClientContext,
} from '@flowgram.ai/free-layout-editor';
import {
  Button,
  Divider,
  Dropdown,
  IconButton,
  Input,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconMore, IconSmallTriangleDown, IconSmallTriangleLeft } from '@douyinfe/semi-icons';

import { FormTitleDescription } from './styles.tsx';
import { Feedback } from '../feedback';
import { FlowNodeRegistry } from '../../typings';
import { NodeRenderContext } from '../../context';
import { getIcon } from './utils';
import { Header, Operators, Title } from './styles';

const { Text } = Typography;

function DropdownContent() {
  const { node, deleteNode } = useContext(NodeRenderContext);
  const clientContext = useClientContext();
  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  const handleCopy = () => {
    clientContext.playground.commandService.executeCommand(Command.Default.COPY, node);
  };
  return (
    <Dropdown.Menu>
      <Dropdown.Item onClick={handleCopy} disabled={registry.meta!.copyDisable === true}>
        Copy
      </Dropdown.Item>
      <Dropdown.Item
        onClick={deleteNode}
        disabled={!!(registry.canDelete?.(clientContext, node) || registry.meta!.deleteDisable)}
      >
        Delete
      </Dropdown.Item>
    </Dropdown.Menu>
  );
}

export function FormHeader() {
  const { node, expanded, toggleExpand, readonly } = useContext(NodeRenderContext);
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

  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  const [isDesEditing, setIsDesEditing] = useState(false);
  const inputDesRef = useRef<HTMLInputElement>(null);

  const handleDesDoubleClick = () => {
    if (!readonly) {
      setIsDesEditing(true);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const handleDesBlur = (onChange: (value: string) => void, value: string) => {
    onChange(value);
    setIsDesEditing(false);
  };

  return (
    <>
      <Header>
        {getIcon(node)}
        <Title onDoubleClick={handleDoubleClick}>
          <Field name="title">
            {({ field: { value, onChange }, fieldState }: FieldRenderProps<string>) => (
              <div style={{ height: 24 }}>
                {isEditing ? (
                  <Input
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
        </Title>
        <span>{node.id}</span>
        <Button
          type="primary"
          icon={expanded ? <IconSmallTriangleDown /> : <IconSmallTriangleLeft />}
          size="small"
          theme="borderless"
          onClick={toggleExpand}
        />
        {readonly ? undefined : (
          <Operators>
            <Dropdown trigger="hover" position="bottomRight" render={<DropdownContent />}>
              <IconButton
                color="secondary"
                size="small"
                theme="borderless"
                icon={<IconMore />}
                onClick={(e) => e.stopPropagation()}
              />
            </Dropdown>
          </Operators>
        )}
      </Header>
      <FormTitleDescription onDoubleClick={handleDesDoubleClick}>
        <Field name="description">
          {({ field: { value, onChange }, fieldState }: FieldRenderProps<string>) => (
            <div>
              {isDesEditing ? (
                <TextArea
                  style={{ width: 340 }}
                  ref={inputRef}
                  defaultValue={value}
                  onBlur={() => handleDesBlur(onChange, inputRef.current?.value || '')}
                  onEnterPress={() => handleDesBlur(onChange, inputRef.current?.value || '')}
                />
              ) : (
                <Text
                  style={{
                    color: '#888888',
                    fontSize: '0.875rem',
                    lineHeight: '1.25rem',
                  }}
                  ellipsis={{ showTooltip: true }}
                >
                  {value}
                </Text>
              )}
              <Feedback errors={fieldState?.errors} />
            </div>
          )}
        </Field>
      </FormTitleDescription>
    </>
  );
}
