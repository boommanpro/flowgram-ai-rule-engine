import { useCallback } from 'react';

import { useClientContext, usePlayground } from '@flowgram.ai/free-layout-editor';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { IconTerminal } from '@douyinfe/semi-icons';

export const Console = () => {
  const ctx = useClientContext();

  const playground = usePlayground();
  const consoleJSON = useCallback(async () => {
    console.log(ctx.document.toJSON());
  }, [ctx]);

  return (
    <Tooltip content={'Terminal Show JSON Data'}>
      <Button
        disabled={playground.config.readonly}
        type="tertiary"
        icon={<IconTerminal />}
        theme="borderless"
        onClick={consoleJSON}
      />
    </Tooltip>
  );
};
