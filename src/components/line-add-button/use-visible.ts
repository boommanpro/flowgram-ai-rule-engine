import { LineColors, usePlayground, WorkflowLineEntity } from '@flowgram.ai/free-layout-editor';

import './index.less';

export const useVisible = (params: {
  line: WorkflowLineEntity;
  selected?: boolean;
  color?: string;
}): boolean => {
  const playground = usePlayground();
  const { line, selected = false, color } = params;
  if (line.disposed) {
    // 在 dispose 后，再去获取 line.to | line.from 会导致错误创建端口
    return false;
  }
  if (playground.config.readonly) {
    return false;
  }
  if (!selected && color !== LineColors.HOVER) {
    return false;
  }
  if (
    line.fromPort.portID === 'loop-output-to-function' &&
    line.toPort?.portID === 'loop-function-input'
  ) {
    return false;
  }
  if (
    line.fromPort.portID === 'batch-output-to-function' &&
    line.toPort?.portID === 'batch-function-input'
  ) {
    return false;
  }
  return true;
};
