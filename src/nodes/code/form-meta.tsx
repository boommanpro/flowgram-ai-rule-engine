import {
  Field,
  FieldRenderProps,
  FormMeta,
  FormRenderProps,
  ValidateTrigger,
} from '@flowgram.ai/free-layout-editor';
import Label from '@douyinfe/semi-ui/lib/es/form/label';
import { Button, Divider, Select } from '@douyinfe/semi-ui';
import { IconCode } from '@douyinfe/semi-icons';

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
        name="language"
        render={({
          field: { value, onChange },
          fieldState,
        }: FieldRenderProps<Record<string, JsonSchema>>) => (
          <>
            <Label>
              language:
              <Select defaultValue={value} style={{ width: 200, marginLeft: '8px' }} />
            </Label>
          </>
        )}
      />
      <Field
        name="code"
        render={({
          field: { value, onChange },
          fieldState,
        }: FieldRenderProps<Record<string, JsonSchema>>) => (
          <>
            <CodeEditorField value={value} onChange={onChange} />
          </>
        )}
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
      <FormOutputs />
    </FormContent>
  </>
);

export const formMeta: FormMeta<FlowNodeJSON> = {
  render: renderForm,
  validateTrigger: ValidateTrigger.onChange,
  validate: {
    title: ({ value }: { value: string }) => (value ? undefined : 'Title is required'),
  },
};
