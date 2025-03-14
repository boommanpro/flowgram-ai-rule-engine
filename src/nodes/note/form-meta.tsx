import { useRef, useState } from 'react';

import {
  Field,
  FieldRenderProps,
  FormMeta,
  FormRenderProps,
  ValidateTrigger,
} from '@flowgram.ai/free-layout-editor';
import { TextArea } from '@douyinfe/semi-ui';

import { FlowNodeJSON } from '../../typings';

export const renderForm = ({ form }: FormRenderProps<FlowNodeJSON>) => {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const [backgroundColor, setBackgroundColor] = useState('#fefbee'); // 默认背景色

  const handleSelect = () => {
    setBackgroundColor('#fdf3eb'); // 选择文本时背景色
  };

  const handleBlur = () => {
    setBackgroundColor('#fefbee'); // 失去焦点时恢复默认背景色
  };

  return (
    <>
      <Field
        name="description"
        render={({ field: { value, onChange }, fieldState }: FieldRenderProps<string>) => (
          <TextArea
            ref={textAreaRef}
            placeholder="输入要添加的注释..."
            value={value || ''}
            autosize={{ minRows: 1, maxRows: 10 }}
            showClear
            onChange={(value, e) => {
              onChange(value);
            }}
            onClick={handleSelect}
            onBlur={handleBlur}
            style={{ width: '100%', height: '300px', background: backgroundColor }}
          />
        )}
      />
    </>
  );
};

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    description: ({ value }: { value: string }) => (value ? undefined : 'Description is required'),
  },
};
