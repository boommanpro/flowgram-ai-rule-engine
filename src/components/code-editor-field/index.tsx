import React, { useState } from 'react';

import Label from '@douyinfe/semi-ui/lib/es/form/label';
import { Button, Modal, TextArea } from '@douyinfe/semi-ui';
import { IconCode } from '@douyinfe/semi-icons';

export const CodeEditorField = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) => {
  const [visible, setVisible] = useState(false);
  const [tempValue, setTempValue] = useState(value);

  const showDialog = () => {
    setTempValue(value); // 初始化 tempValue 为当前的 value
    setVisible(true);
  };

  const handleOk = () => {
    onChange(tempValue); // 更新 value
    setVisible(false);
  };

  const handleCancel = () => {
    setVisible(false);
  };

  return (
    <>
      <Label>
        code:
        <Button icon={<IconCode />} style={{ marginLeft: '8px' }} onClick={showDialog}>
          Editor
        </Button>
      </Label>
      <Modal
        title="代码编辑器"
        visible={visible}
        onOk={handleOk}
        onCancel={handleCancel}
        closeOnEsc={true}
        fullScreen
        style={{ zIndex: 1000 }} // 确保 Modal 在最外层
        getPopupContainer={() => document.body} // 显式指定渲染到 body
      >
        <TextArea
          value={tempValue}
          onChange={(v) => setTempValue(v)}
          rows={10}
          style={{ width: '100%' }}
        />
      </Modal>
    </>
  );
};
