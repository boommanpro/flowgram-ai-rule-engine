import { EditorRenderer, FreeLayoutEditorProvider } from '@flowgram.ai/free-layout-editor';

import '@flowgram.ai/free-layout-editor/index.css';
import './styles/index.css';
import { nodeRegistries } from './nodes';
import { initialData } from './initial-data';
import { useEditorProps } from './hooks';
import { DemoTools } from './components/tools';

export const Editor = () => {
  const editorProps = useEditorProps(initialData, nodeRegistries);
  return (
    <div className="doc-free-feature-overview">
      <FreeLayoutEditorProvider {...editorProps}>
        <div className="demo-container">
          <EditorRenderer className="demo-editor" />
        </div>
        <DemoTools />
      </FreeLayoutEditorProvider>
    </div>
  );
};
