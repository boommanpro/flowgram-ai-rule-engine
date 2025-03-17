import React, { useContext, useState, useRef } from 'react';

import { Field, FieldRenderProps, FlowNodeRegistry } from '@flowgram.ai/free-layout-editor';
import Text from '@douyinfe/semi-ui/lib/es/typography/text';
import { Divider, Input, TextArea } from '@douyinfe/semi-ui';

import { NodeRenderContext } from '../../context';
import { FormWrapper } from './styles';
import { Feedback } from '../feedback';

/**
 * @param props
 * @constructor
 */
export function FormContent(props: { children?: React.ReactNode }) {
  const { node, expanded, toggleExpand, readonly } = useContext(NodeRenderContext);

  return <FormWrapper>{expanded ? <>{props.children}</> : undefined}</FormWrapper>;
}
