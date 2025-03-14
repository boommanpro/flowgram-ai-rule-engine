import React, { useContext } from 'react';

import { FlowNodeRegistry } from '@flowgram.ai/free-layout-editor';

import { NodeRenderContext } from '../../context';
import { FormTitleDescription, FormWrapper } from './styles';

/**
 * @param props
 * @constructor
 */
export function FormContent(props: { children?: React.ReactNode }) {
  const { expanded, node } = useContext(NodeRenderContext);
  const registry = node.getNodeRegistry<FlowNodeRegistry>();
  return (
    <FormWrapper>
      {expanded ? (
        <>
          <FormTitleDescription>{registry.info?.description}</FormTitleDescription>
          {props.children}
        </>
      ) : undefined}
    </FormWrapper>
  );
}
