import React, { useRef, useEffect } from 'react';

import * as monaco from 'monaco-editor';
import { debounce } from 'lodash-es';

// @ts-ignore
self.MonacoEnvironment = {
  getWorker: function (moduleId, label) {
    if (label === 'json') {
      return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url));
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url));
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url));
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url)
      );
    }
    return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url));
  },
};

interface MonacoEditorProps {
  value: string;
  style?: React.CSSProperties;
  language?: string;
  theme?: string;
  options?: monaco.editor.IStandaloneEditorConstructionOptions;
  editorRef?: React.MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>; // 新增 editorRef 属性
}

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  style,
  language = 'typescript',
  theme = 'vs',
  options = {},
  editorRef: externalEditorRef, // 接收外部传递的 editorRef
}) => {
  const divEl = useRef<HTMLDivElement>(null);
  const internalEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const isEditorAliveRef = useRef(true);

  useEffect(() => {
    if (divEl.current && !internalEditorRef.current) {
      const model = monaco.editor.createModel(value, language);
      internalEditorRef.current = monaco.editor.create(divEl.current, {
        model,
        theme,
        ...options,
      });

      // 将 editorRef 传递给外部
      if (externalEditorRef) {
        externalEditorRef.current = internalEditorRef.current;
      }
    }
    return () => {
      isEditorAliveRef.current = false;
      internalEditorRef.current?.dispose();
      internalEditorRef.current = null;

      // 清理外部 editorRef
      if (externalEditorRef) {
        externalEditorRef.current = null;
      }
    };
  }, [language, theme, options]);

  return <div className="Editor" ref={divEl} style={style}></div>;
};
