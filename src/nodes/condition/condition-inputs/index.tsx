import { useContext } from 'react';

import { nanoid } from 'nanoid';
import { Field, FieldArray } from '@flowgram.ai/free-layout-editor';
import { Button } from '@douyinfe/semi-ui';
import { IconPlus, IconCrossCircleStroked } from '@douyinfe/semi-icons';

import { FlowLiteralValueSchema, FlowRefValueSchema } from '../../../typings';
import { FxExpression } from '../../../form-components/fx-expression';
import { FormItem } from '../../../form-components';
import { Feedback } from '../../../form-components';
import { NodeRenderContext } from '../../../context';
import { ConditionPort } from './styles';

interface ConditionValue {
  key: string;
  value: FlowLiteralValueSchema | FlowRefValueSchema;
}

export function ConditionInputs() {
  const { readonly } = useContext(NodeRenderContext);
  return (
    <FieldArray name="inputsValues.conditions">
      {({ field }) => (
        <>
          {field.map((child, index) => (
            <Field<ConditionValue> key={child.name} name={child.name}>
              {({ field: childField, fieldState: childState }) => (
                <FormItem name="if" type="boolean" required={true} labelWidth={40}>
                  <FxExpression
                    value={childField.value.value}
                    onChange={(v) => childField.onChange({ key: childField.value.key, value: v })}
                    icon={
                      <Button
                        theme="borderless"
                        icon={<IconCrossCircleStroked />}
                        onClick={() => field.delete(index)}
                      />
                    }
                    hasError={Object.keys(childState?.errors || {}).length > 0}
                    disabled={readonly}
                  />
                  <Feedback errors={childState?.errors} invalid={childState?.invalid} />
                  <ConditionPort data-port-id={childField.value.key} data-port-type="output" />
                </FormItem>
              )}
            </Field>
          ))}
          {!readonly && (
            <div>
              <Button
                theme="borderless"
                icon={<IconPlus />}
                onClick={() =>
                  field.append({
                    key: `if_${nanoid(6)}`,
                    value: { type: 'expression', content: '' },
                  })
                }
              >
                Add
              </Button>
            </div>
          )}
        </>
      )}
    </FieldArray>
  );
}
