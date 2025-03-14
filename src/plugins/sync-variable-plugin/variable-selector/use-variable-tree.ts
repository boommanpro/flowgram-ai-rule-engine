import { useCallback, useMemo } from 'react';

import {
  ArrayType,
  ASTFactory,
  ASTKind,
  type BaseType,
  CustomType,
  isMatchAST,
  ObjectType,
  type UnionJSON,
  useScopeAvailable,
} from '@flowgram.ai/free-layout-editor';

import { createASTFromJSONSchema } from '../utils';
import { ArrayIcons, VariableTypeIcons } from '../icons';
import { type JsonSchema } from '../../../typings';

type VariableField = any;

interface HooksParams<TreeData> {
  // filter target type
  targetSchemas?: JsonSchema[];
  // Is it strongly type-checked?
  strongEqual?: boolean;
  // ignore global Config
  ignoreReadonly?: boolean;
  // render tree node
  getTreeData: (props: {
    key: string;
    icon: JSX.Element | undefined;
    variable: VariableField;
    parentFields: VariableField[];
    disabled?: boolean;
    children?: TreeData[];
  }) => TreeData;
}

export function useVariableTree<TreeData>({
  targetSchemas = [],
  strongEqual = false,
  ignoreReadonly = false,
  getTreeData,
}: HooksParams<TreeData>): TreeData[] {
  const available = useScopeAvailable();

  const getVariableTypeIcon = useCallback((variable: VariableField) => {
    const _type = variable.type;

    if (isMatchAST(_type, ArrayType)) {
      return (
        (ArrayIcons as any)[_type.items?.kind.toLowerCase()] ||
        VariableTypeIcons[ASTKind.Array.toLowerCase()]
      );
    }

    if (isMatchAST(_type, CustomType)) {
      return VariableTypeIcons[_type.typeName.toLowerCase()];
    }

    return (VariableTypeIcons as any)[variable.type?.kind.toLowerCase()];
  }, []);

  const targetTypeAST: UnionJSON = useMemo(
    () =>
      ASTFactory.createUnion({
        types: targetSchemas.map((_targetSchema) => {
          const typeAst = createASTFromJSONSchema(_targetSchema)!;
          return strongEqual ? typeAst : { ...typeAst, weak: true };
        }),
      }),
    [strongEqual, ...targetSchemas]
  );

  const checkTypeFiltered = useCallback(
    (type?: BaseType) => {
      if (!type) {
        return true;
      }

      if (targetTypeAST.types?.length) {
        return !type.isTypeEqual(targetTypeAST);
      }

      return false;
    },
    [strongEqual, targetTypeAST]
  );

  const renderVariable = (
    variable: VariableField,
    parentFields: VariableField[] = []
  ): TreeData | null => {
    let type = variable?.type;

    const isTypeFiltered = checkTypeFiltered(type);

    let children: TreeData[] | undefined;
    if (isMatchAST(type, ObjectType)) {
      children = (type.properties || [])
        .map((_property) => renderVariable(_property as VariableField, [...parentFields, variable]))
        .filter(Boolean) as TreeData[];
    }

    if (isTypeFiltered && !children?.length) {
      return null;
    }

    const currPath = [
      ...parentFields.map((_field) => _field.meta?.titleKey || _field.key),
      variable.meta?.titleKey || variable.key,
    ].join('.');

    return getTreeData({
      key: currPath,
      icon: getVariableTypeIcon(variable),
      variable,
      parentFields,
      children,
      disabled: isTypeFiltered,
    });
  };

  return [
    ...available.variables
      .filter((_v) => {
        if (ignoreReadonly) {
          return !_v.meta?.readonly;
        }
        return true;
      })
      .slice(0)
      .reverse(),
  ]
    .map((_variable) => renderVariable(_variable as VariableField))
    .filter(Boolean) as TreeData[];
}
