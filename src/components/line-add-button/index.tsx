import { WorkflowNodePanelService } from '@flowgram.ai/free-node-panel-plugin';
import { LineRenderProps } from '@flowgram.ai/free-lines-plugin';
import { useService } from '@flowgram.ai/free-layout-editor';

import './index.less';
import { useVisible } from './use-visible';
import { IconPlusCircle } from './button';

export const LineAddButton = (props: LineRenderProps) => {
  const { line, selected, color } = props;
  const visible = useVisible({ line, selected, color });
  const nodePanelService = useService<WorkflowNodePanelService>(WorkflowNodePanelService);

  if (!visible) {
    return <></>;
  }

  const { fromPort, toPort } = line;

  return (
    <div
      className="line-add-button"
      style={{
        left: '50%',
        top: '50%',
        color,
      }}
      data-testid="sdk.workflow.canvas.line.add"
      data-line-id={line.id}
      onClick={async () => {
        const node = await nodePanelService.call({
          panelPosition: {
            x: (line.position.from.x + line.position.to.x) / 2,
            y: (line.position.from.y + line.position.to.y) / 2,
          },
          fromPort,
          toPort,
          enableBuildLine: true,
          enableAutoOffset: true,
          panelProps: {
            enableScrollClose: true,
          },
        });
        if (!node) {
          return;
        }
        line.dispose();
      }}
    >
      <IconPlusCircle />
    </div>
  );
};
