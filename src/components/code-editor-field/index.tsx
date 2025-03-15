import React, { useRef, useState, useCallback } from 'react';

import * as monaco from 'monaco-editor';
import Label from '@douyinfe/semi-ui/lib/es/form/label';
import { Button, Modal } from '@douyinfe/semi-ui';
import { IconCode } from '@douyinfe/semi-icons';

import { MonacoEditor } from '../monaco-editor';

export const CodeEditorField = ({
  value,
  onChange,
  language,
}: {
  value: string;
  onChange: (value: string) => void;
  language: string;
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [visible, setVisible] = useState(false);

  const showDialog = useCallback(() => setVisible(true), []);
  const handleCancel = useCallback(() => setVisible(false), []);

  const handleOk = useCallback(() => {
    const editorValue = editorRef.current?.getValue();
    if (editorValue) {
      onChange(editorValue);
    }
    setVisible(false);
  }, [onChange]);

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
        closeOnEsc
        fullScreen
        style={{ zIndex: 1000 }}
        getPopupContainer={() => document.body}
      >
        <MonacoEditor
          value={value}
          style={{ width: '100%', height: '500px' }}
          language={language}
          theme="vs-dark"
          options={{
            fontSize: 14,
            lineNumbers: 'on',
            minimap: { enabled: false },
          }}
          editorRef={editorRef}
        />
      </Modal>
    </>
  );
};
