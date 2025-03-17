import React, { useCallback } from 'react';

import {
  Field,
  FieldRenderProps,
  FormMeta,
  FormRenderProps,
  ValidateTrigger,
} from '@flowgram.ai/free-layout-editor';
import Label from '@douyinfe/semi-ui/lib/es/form/label';
import { Divider, Select } from '@douyinfe/semi-ui';

import { FlowNodeJSON, JsonSchema } from '../../typings';
import { FormContent, FormHeader, FormOutputs, PropertiesEdit } from '../../form-components';
import { CodeEditorField } from '../../components/code-editor-field';

export const renderForm = ({ form }: FormRenderProps<FlowNodeJSON>) => (
  <>
    <FormHeader />
    <FormContent>
      <span>输入配置</span>
      <Field
        name="inputs.properties"
        render={({
          field: { value, onChange },
          fieldState,
        }: FieldRenderProps<Record<string, JsonSchema>>) => (
          <>
            <PropertiesEdit value={value} onChange={onChange} useFx={true} />
          </>
        )}
      />
      <Divider margin="12px" />
      <span>代码配置</span>
      <Field
        name="config"
        render={({
          field: { value, onChange },
          fieldState,
        }: FieldRenderProps<Record<string, JsonSchema>>) => {
          const handleLanguageChange = useCallback(
            (selectedValue: string) => {
              onChange({ ...value, language: selectedValue });
            },
            [value, onChange]
          );

          const handleCodeChange = useCallback(
            (newCode: string) => {
              onChange({ ...value, code: newCode });
            },
            [value, onChange]
          );

          return (
            <>
              <Label>
                language:
                <Select
                  defaultValue={value.language}
                  style={{ width: 200, marginLeft: '8px' }}
                  onChange={handleLanguageChange}
                >
                  <Select.Option value="python">python</Select.Option>
                  <Select.Option value="javascript">javascript</Select.Option>
                  <Select.Option value="typescript">typescript</Select.Option>
                  <Select.Option value="java">java</Select.Option>
                </Select>
              </Label>
              <CodeEditorField
                value={value.code}
                onChange={handleCodeChange}
                language={value.language}
              />
            </>
          );
        }}
      />
      <Divider margin="12px" />
      <span>输出配置</span>
      <Field
        name="outputs.properties"
        render={({
          field: { value, onChange },
          fieldState,
        }: FieldRenderProps<Record<string, JsonSchema>>) => (
          <>
            <PropertiesEdit value={value} onChange={onChange} />
          </>
        )}
      />
    </FormContent>
    <FormOutputs />
  </>
);

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    title: ({ value }: { value: string }) => (value ? undefined : 'Title is required'),
  },
};
