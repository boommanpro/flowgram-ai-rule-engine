import React from 'react';

import { type NodeRenderReturnType } from '@flowgram.ai/free-layout-editor';

export const NodeRenderContext = React.createContext<NodeRenderReturnType>({} as any);
