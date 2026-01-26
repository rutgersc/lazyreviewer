import type { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import type {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  SelectionSetNode,
  FieldNode,
  FragmentSpreadNode,
  GraphQLOutputType,
} from 'graphql';
import {
  isObjectType,
  isInterfaceType,
  isScalarType,
  isEnumType,
  isListType,
  isNonNullType,
  getNamedType,
} from 'graphql';

interface EffectSchemaPluginConfig {
  baseTypesPath?: string;
  // Maps fragment names to their source file (without extension)
  // Auto-populated by the custom preset
  fragmentSources?: Record<string, string>;
  // When using the custom preset, specifies which file to generate for
  targetFile?: string;
}

interface GeneratorContext {
  schema: GraphQLSchema;
  enumsUsed: Set<string>;
  indentLevel: number;
  fragmentsUsed: Set<string>;
}

/**
 * GraphQL Code Generator plugin for Effect Schema generation
 * Works with near-operation-file preset to generate per-file schemas
 */
export const plugin: PluginFunction<EffectSchemaPluginConfig> = (
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  config: EffectSchemaPluginConfig
) => {
  const ctx: GeneratorContext = {
    schema,
    enumsUsed: new Set(),
    indentLevel: 0,
    fragmentsUsed: new Set(),
  };

  const fragmentSources = config.fragmentSources || {};
  const baseTypesPath = config.baseTypesPath || './generated/gitlab-base-types.schema';

  // Collect all fragments and queries from documents
  const fragments: Array<{
    fragmentName: string;
    schemaBody: string;
    enumImports: string[];
    sourceFileName?: string;
  }> = [];

  const queries: Array<{
    queryType: string;
    schemaBody: string;
    enumImports: string[];
    fragmentImports: string[];
    sourceFileName?: string;
  }> = [];

  const indent = (level = ctx.indentLevel): string => '  '.repeat(level);

  const typeToSchema = (type: GraphQLOutputType, fieldNode?: FieldNode): string => {
    if (isNonNullType(type)) {
      return typeToSchema(type.ofType, fieldNode);
    }

    if (isListType(type)) {
      const elementType = type.ofType;
      const isElementNullable = !isNonNullType(elementType);
      let elementSchema = typeToSchema(elementType, fieldNode);
      if (isElementNullable) {
        elementSchema = `Schema.NullOr(${elementSchema})`;
      }
      return `Schema.Array(\n${indent(ctx.indentLevel + 1)}${elementSchema}\n${indent()})`;
    }

    const namedType = getNamedType(type);

    if (isScalarType(namedType)) {
      switch (namedType.name) {
        case 'String': return 'Schema.String';
        case 'Int':
        case 'Float': return 'Schema.Number';
        case 'Boolean': return 'Schema.Boolean';
        case 'ID': return 'Schema.Any';
        case 'Time':
        case 'Date': return 'Schema.String';
        default: return 'Schema.Unknown';
      }
    }

    if (isEnumType(namedType)) {
      ctx.enumsUsed.add(namedType.name);
      return `${namedType.name}Schema`;
    }

    if (isObjectType(namedType) || isInterfaceType(namedType)) {
      if (fieldNode?.selectionSet) {
        return selectionSetToSchema(fieldNode.selectionSet, namedType);
      }
    }

    return 'Schema.Unknown';
  };

  const selectionSetToSchema = (
    selectionSet: SelectionSetNode,
    parentType: GraphQLObjectType | GraphQLInterfaceType
  ): string => {
    ctx.indentLevel++;

    const fields: string[] = [];
    const fragmentSpreads: string[] = [];

    for (const selection of selectionSet.selections) {
      if (selection.kind === 'FragmentSpread') {
        const fragmentSpread = selection as FragmentSpreadNode;
        const fragmentName = fragmentSpread.name.value;
        ctx.fragmentsUsed.add(fragmentName);
        fragmentSpreads.push(fragmentName);
        continue;
      }

      if (selection.kind !== 'Field') continue;

      const fieldNode = selection as FieldNode;
      const fieldName = fieldNode.name.value;

      if (fieldName === '__typename') {
        fields.push(`${indent()}__typename: Schema.Literal('${parentType.name}')`);
        continue;
      }

      const fieldDef = parentType.getFields()[fieldName];
      if (!fieldDef) continue;

      const fieldType = fieldDef.type;
      const isNullable = !isNonNullType(fieldType);
      let fieldSchema = typeToSchema(fieldType, fieldNode);

      if (isNullable) {
        fieldSchema = `Schema.NullOr(${fieldSchema})`;
      }

      fields.push(`${indent()}${fieldName}: ${fieldSchema}`);
    }

    if (fragmentSpreads.length === 1 && fields.length === 0) {
      ctx.indentLevel--;
      return `${fragmentSpreads[0]}FragmentSchema`;
    }

    if (fragmentSpreads.length > 0 && fields.length > 0) {
      ctx.indentLevel--;
      const additionalFields = `Schema.Struct({\n${fields.join(',\n')}\n${indent(ctx.indentLevel)}})`;
      return `Schema.extend(${fragmentSpreads[0]}FragmentSchema, ${additionalFields})`;
    }

    if (fragmentSpreads.length > 0 && fields.length === 0) {
      ctx.indentLevel--;
      return `${fragmentSpreads[0]}FragmentSchema`;
    }

    const result = fields.length > 0
      ? `Schema.Struct({\n${fields.join(',\n')}\n${indent(ctx.indentLevel - 1)}})`
      : 'Schema.Struct({})';

    ctx.indentLevel--;
    return result;
  };

  // Process documents
  for (const doc of documents) {
    if (!doc.document) continue;

    const sourceFileName = doc.location
      ? doc.location.replace(/\\/g, '/').split('/').pop()?.replace('.graphql', '')
      : undefined;

    for (const definition of doc.document.definitions) {
      if (definition.kind === 'FragmentDefinition') {
        const fragmentName = definition.name.value;
        const typeName = definition.typeCondition.name.value;
        const fragmentType = schema.getType(typeName);

        if (!fragmentType || (!isObjectType(fragmentType) && !isInterfaceType(fragmentType))) {
          continue;
        }

        ctx.indentLevel = 0;
        ctx.enumsUsed.clear();
        ctx.fragmentsUsed.clear();

        const schemaBody = selectionSetToSchema(definition.selectionSet, fragmentType);
        const enumImports = Array.from(ctx.enumsUsed);

        fragments.push({ fragmentName, schemaBody, enumImports, sourceFileName });
        continue;
      }

      if (definition.kind !== 'OperationDefinition') continue;
      if (definition.operation !== 'query') continue;

      const operationName = definition.name?.value;
      if (!operationName) continue;

      const queryTypeName = `${operationName}Query`;
      const queryType = schema.getQueryType();
      if (!queryType) continue;

      ctx.indentLevel = 0;
      ctx.enumsUsed.clear();
      ctx.fragmentsUsed.clear();

      const schemaBody = selectionSetToSchema(definition.selectionSet, queryType);
      const enumImports = Array.from(ctx.enumsUsed);
      const fragmentImports = Array.from(ctx.fragmentsUsed);

      queries.push({ queryType: queryTypeName, schemaBody, enumImports, fragmentImports, sourceFileName });
    }
  }

  // Normalize operation name (e.g., "MRPipeline" -> "MrPipeline")
  const normalizeOperationName = (name: string): string => {
    return name.replace(/([A-Z]{2,})([A-Z][a-z])/g, (_, capitals, rest) => {
      return capitals.charAt(0) + capitals.slice(1).toLowerCase() + rest;
    });
  };

  // Determine the current file name - use targetFile from preset if available
  const targetFile = config.targetFile;
  const currentFileName = targetFile || fragments[0]?.sourceFileName || queries[0]?.sourceFileName;

  // Filter to only items for the target file
  const targetFragments = targetFile
    ? fragments.filter(f => f.sourceFileName === targetFile)
    : fragments;
  const targetQueries = targetFile
    ? queries.filter(q => q.sourceFileName === targetFile)
    : queries;

  // Build deduplicated imports
  const typeImports = new Set<string>();
  const enumImports = new Set<string>();
  const fragmentImportsByFile = new Map<string, Set<string>>();

  // Local fragment names (defined in this file)
  const localFragmentNames = new Set(targetFragments.map(f => f.fragmentName));

  // Process fragments for this file
  for (const { fragmentName, enumImports: enums } of targetFragments) {
    typeImports.add(`${fragmentName}Fragment`);
    enums.forEach(e => enumImports.add(e));
  }

  // Process queries for this file
  for (const { queryType, enumImports: enums, fragmentImports: frags } of targetQueries) {
    typeImports.add(normalizeOperationName(queryType));
    enums.forEach(e => enumImports.add(e));

    // Handle fragment imports from other files
    for (const fragName of frags) {
      if (localFragmentNames.has(fragName)) continue;

      const sourceFile = fragmentSources[fragName];
      if (sourceFile && sourceFile !== currentFileName) {
        if (!fragmentImportsByFile.has(sourceFile)) {
          fragmentImportsByFile.set(sourceFile, new Set());
        }
        fragmentImportsByFile.get(sourceFile)!.add(`${fragName}FragmentSchema`);
      }
    }
  }

  // Build import statements
  const importStatements: string[] = [];

  if (typeImports.size > 0 && currentFileName) {
    importStatements.push(`import type { ${[...typeImports].join(', ')} } from "../${currentFileName}.generated"`);
  }

  if (enumImports.size > 0) {
    importStatements.push(`import { ${[...enumImports].map(e => `${e}Schema`).join(', ')} } from "${baseTypesPath}"`);
  }

  for (const [sourceFile, fragSchemas] of fragmentImportsByFile) {
    importStatements.push(`import { ${[...fragSchemas].join(', ')} } from "./${sourceFile}.schema"`);
  }

  // Build schema definitions
  const schemaDefinitions: string[] = [];

  for (const { fragmentName, schemaBody } of targetFragments) {
    schemaDefinitions.push(`export const ${fragmentName}FragmentSchema: Schema.Schema<${fragmentName}Fragment> = ${schemaBody}`);
  }

  for (const { queryType, schemaBody } of targetQueries) {
    const normalized = normalizeOperationName(queryType);
    schemaDefinitions.push(`export const ${normalized}Schema: Schema.Schema<${normalized}> = ${schemaBody}`);
  }

  const output = schemaDefinitions.length > 0
    ? `${importStatements.join('\n')}\n\n${schemaDefinitions.join('\n\n')}\n`
    : '';

  return {
    prepend: ['import { Schema } from "effect"'],
    content: output,
  };
};
