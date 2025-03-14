import { FlowNodeRegistry } from '../../typings';
import iconStart from '../../assets/icon-start.jpg';
import { formMeta } from './form-meta';

export const NoteNodeRegistry: FlowNodeRegistry = {
  type: 'note',
  meta: {
    deleteDisable: false,
    useDynamicPort: true,
    copyDisable: false,
    size: {
      width: 360,
      height: 211,
    },
  },
  info: {
    icon: iconStart,
    description:
      'The starting node of the workflow, used to set the information needed to initiate the workflow.',
  },
  /**
   * Render node via formMeta
   */
  formMeta,
  /**
   * Start Node cannot be added
   */
  canAdd() {
    return false;
  },
  onAdd(ctx) {
    return {
      id: 'note',
      type: 'note',
      data: {
        title: 'Note',
        description: 'Enter your note description...',
      },
    };
  },
};
