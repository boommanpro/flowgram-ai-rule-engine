import { useCallback } from 'react';

import { useClientContext, usePlayground } from '@flowgram.ai/free-layout-editor';
import { Button, Tooltip } from '@douyinfe/semi-ui';
import { IconFile } from '@douyinfe/semi-icons';

import { NoteNodeRegistry } from '../../nodes/note';

export const AddNote = () => {
  const playground = usePlayground();
  const ctx = useClientContext();
  const addNote = useCallback(async () => {
    const randomId = `note_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
    ctx.document.createWorkflowNodeByType(
      'note',
      { x: 100, y: 100 },
      {
        id: randomId,
        data: {
          ...NoteNodeRegistry.data,
        },
        meta: {
          ...NoteNodeRegistry.meta,
        },
      }
    );
  }, [ctx]);

  return (
    <Tooltip content={'Add Note'}>
      <Button
        disabled={playground.config.readonly}
        type="tertiary"
        icon={<IconFile />}
        theme="borderless"
        onClick={addNote}
      />
    </Tooltip>
  );
};
