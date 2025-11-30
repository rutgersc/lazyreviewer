import type { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import type {
  GraphQLSchema,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLScalarType,
  GraphQLEnumType,
  SelectionSetNode,
  FieldNode,
  FragmentSpreadNode,
  GraphQLOutputType,
  GraphQLList,
  GraphQLNonNull,
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
}

interface GeneratorContext {
  schema: GraphQLSchema;
  enumsUsed: Set<string>;
  indentLevel: number;
  fragmentsUsed: Set<string>;
}

/**
 * GraphQL Code Generator plugin for Effect Schema generation
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

  const imports: string[] = ['import { Schema } from "effect"'];
  const schemas: Array<{
    queryType: string;
    schemaBody: string;
    enumImports: string[];
    fragmentImports: string[];
    sourceFileName?: string;
  }> = [];
  const fragmentSchemas: Array<{
    fragmentName: string;
    schemaBody: string;
    enumImports: string[];
    sourceFileName?: string;
  }> = [];
  const queryTypes: string[] = [];

  // Helper: Get indent string
  const indent = (level = ctx.indentLevel): string => '  '.repeat(level);

  // Helper: Convert GraphQL type to Effect Schema
  const typeToSchema = (
    type: GraphQLOutputType,
    fieldNode?: FieldNode
  ): string => {
    // Handle NonNull wrapper
    if (isNonNullType(type)) {
      return typeToSchema(type.ofType, fieldNode);
    }

    // Handle List wrapper
    if (isListType(type)) {
      const elementType = type.ofType;
      const isElementNullable = !isNonNullType(elementType);

      // Process the element type (will unwrap NonNull if needed)
      let elementSchema = typeToSchema(elementType, fieldNode);

      // Wrap with NullOr if the element is nullable
      if (isElementNullable) {
        elementSchema = `Schema.NullOr(${elementSchema})`;
      }

      return `Schema.Array(\n${indent(ctx.indentLevel + 1)}${elementSchema}\n${indent()})`;
    }

    const namedType = getNamedType(type);

    // Handle scalar types
    if (isScalarType(namedType)) {
      switch (namedType.name) {
        case 'String':
          return 'Schema.String';
        case 'Int':
        case 'Float':
          return 'Schema.Number';
        case 'Boolean':
          return 'Schema.Boolean';
        case 'ID':
          return 'Schema.Any'; // GraphQL ID scalar
        // Custom scalars configured in codegen.ts
        case 'Time':
        case 'Date':
          return 'Schema.String';
        default:
          return 'Schema.Unknown'; // Other custom scalars
      }
    }

    // Handle enum types
    if (isEnumType(namedType)) {
      ctx.enumsUsed.add(namedType.name);
      return `${namedType.name}Schema`;
    }

    // Handle object and interface types - need to process selection set
    if (isObjectType(namedType) || isInterfaceType(namedType)) {
      if (fieldNode?.selectionSet) {
        return selectionSetToSchema(fieldNode.selectionSet, namedType);
      }
    }

    return 'Schema.Unknown';
  };

  // Helper: Convert SelectionSet to Schema.Struct
  const selectionSetToSchema = (
    selectionSet: SelectionSetNode,
    parentType: GraphQLObjectType | GraphQLInterfaceType
  ): string => {
    ctx.indentLevel++;

    const fields: string[] = [];
    const fragmentSpreads: string[] = [];

    for (const selection of selectionSet.selections) {
      // Handle fragment spreads
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

      // Handle __typename specially - it's always a literal of the type name
      if (fieldName === '__typename') {
        fields.push(`${indent()}__typename: Schema.Literal('${parentType.name}')`);
        continue;
      }

      // Get the field definition from the parent type
      const fieldDef = parentType.getFields()[fieldName];
      if (!fieldDef) continue;

      const fieldType = fieldDef.type;
      const isNullable = !isNonNullType(fieldType);

      let fieldSchema = typeToSchema(fieldType, fieldNode);

      // Wrap with NullOr if nullable
      if (isNullable) {
        fieldSchema = `Schema.NullOr(${fieldSchema})`;
      }

      fields.push(`${indent()}${fieldName}: ${fieldSchema}`);
    }

    // If we have fragment spreads and no fields, just reference the fragment schema
    if (fragmentSpreads.length === 1 && fields.length === 0) {
      ctx.indentLevel--;
      return `${fragmentSpreads[0]}FragmentSchema`;
    }

    // If we have fragment spreads with additional fields, extend the fragment
    if (fragmentSpreads.length > 0 && fields.length > 0) {
      ctx.indentLevel--;
      // Use Schema.extend to merge fragment with additional fields
      const additionalFields = `Schema.Struct({\n${fields.join(',\n')}\n${indent(ctx.indentLevel)}})`;
      return `Schema.extend(${fragmentSpreads[0]}FragmentSchema, ${additionalFields})`;
    }

    // If we have multiple fragment spreads but no additional fields
    if (fragmentSpreads.length > 0 && fields.length === 0) {
      ctx.indentLevel--;
      // If multiple fragments, use the first one (this is a simplification)
      return `${fragmentSpreads[0]}FragmentSchema`;
    }

    const result = fields.length > 0
      ? `Schema.Struct({\n${fields.join(',\n')}\n${indent(ctx.indentLevel - 1)}})`
      : 'Schema.Struct({})';

    ctx.indentLevel--;
    return result;
  };

  // Process each document
  for (const doc of documents) {
    if (!doc.document) continue;

    // Get the source filename (e.g., "mrs.graphql" -> "mrs")
    const sourceFileName = doc.location
      ? doc.location.replace(/\\/g, '/').split('/').pop()?.replace('.graphql', '')
      : undefined;

    for (const definition of doc.document.definitions) {
      // Process fragment definitions
      if (definition.kind === 'FragmentDefinition') {
        const fragmentName = definition.name.value;
        const typeName = definition.typeCondition.name.value;

        // Get the type the fragment is defined on
        const fragmentType = schema.getType(typeName);
        if (!fragmentType || (!isObjectType(fragmentType) && !isInterfaceType(fragmentType))) {
          continue;
        }

        // Reset context for this fragment
        ctx.indentLevel = 0;
        ctx.enumsUsed.clear();
        ctx.fragmentsUsed.clear();

        // Generate schema from selection set
        const schemaBody = selectionSetToSchema(definition.selectionSet, fragmentType);

        // Collect enums used in this fragment
        const enumImports = Array.from(ctx.enumsUsed);

        fragmentSchemas.push({
          fragmentName,
          schemaBody,
          enumImports,
          sourceFileName,
        });
        continue;
      }

      if (definition.kind !== 'OperationDefinition') continue;
      if (definition.operation !== 'query') continue;

      const operationName = definition.name?.value;
      if (!operationName) continue;

      const queryTypeName = `${operationName}Query`;
      queryTypes.push(queryTypeName);

      // Get the root query type
      const queryType = schema.getQueryType();
      if (!queryType) continue;

      // Reset context for this query
      ctx.indentLevel = 0;
      ctx.enumsUsed.clear();
      ctx.fragmentsUsed.clear();

      // Generate schema from selection set
      const schemaBody = selectionSetToSchema(definition.selectionSet, queryType);

      // Collect enums and fragments used in this query
      const enumImports = Array.from(ctx.enumsUsed);
      const fragmentImports = Array.from(ctx.fragmentsUsed);

      schemas.push({
        queryType: queryTypeName,
        schemaBody,
        enumImports,
        fragmentImports,
        sourceFileName,
      });
    }
  }

  // Helper: Convert PascalCase to kebab-case
  // Handles acronyms properly (e.g., "MRs" -> "mrs", "MRPipeline" -> "mr-pipeline")
  const toKebabCase = (str: string): string => {
    return str
      // Handle acronyms: MRPipeline -> MR-Pipeline, but NOT MRs -> M-Rs
      // Only split if we have 2+ capitals followed by capital+lowercase
      .replace(/([A-Z]{2,})([A-Z][a-z])/g, '$1-$2')
      // Insert dash before uppercase letter that follows a lowercase letter
      .replace(/([a-z\d])([A-Z])/g, '$1-$2')
      .toLowerCase();
  };

  // Helper: Convert kebab-case to PascalCase (matching GraphQL Codegen's normalization)
  // e.g., "mr-pipeline" -> "MrPipeline", "job-status" -> "JobStatus"
  const toPascalCase = (str: string): string => {
    return str
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
  };

  // Helper: Normalize PascalCase names the same way GraphQL Codegen does
  // Converts multiple consecutive capitals followed by PascalCase to normalized form
  // e.g., "MRPipeline" -> "MrPipeline", "SingleMR" -> "SingleMr", but "MRs" -> "MRs"
  const normalizeOperationName = (name: string): string => {
    return name.replace(/([A-Z]{2,})([A-Z][a-z])/g, (_, capitals, rest) => {
      // Keep first capital, lowercase the middle capitals, keep the rest
      return capitals.charAt(0) + capitals.slice(1).toLowerCase() + rest;
    });
  };

  // Build output for fragments
  const fragmentOutput = fragmentSchemas.map(({ fragmentName, schemaBody, enumImports, sourceFileName }) => {
    const fileName = sourceFileName || toKebabCase(fragmentName);
    const fragmentTypeName = `${fragmentName}Fragment`;

    // Derive the relative path prefix from baseTypesPath
    const baseTypesPath = config.baseTypesPath || './generated/gitlab-base-types.schema';
    const relativePrefix = baseTypesPath.startsWith('../') ? '../' : './';

    const localImports = [`import type { ${fragmentTypeName} } from "${relativePrefix}${fileName}.generated"`];

    if (enumImports.length > 0) {
      const enumSchemas = enumImports.map((e: string) => `${e}Schema`).join(', ');
      localImports.push(`import { ${enumSchemas} } from "${baseTypesPath}"`);
    }

    return `${localImports.join('\n')}

export const ${fragmentName}FragmentSchema: Schema.Schema<${fragmentTypeName}> = ${schemaBody}
`;
  }).join('\n');

  // Build output for each query's schema
  const queryOutput = schemas.map(({ queryType, schemaBody, enumImports, fragmentImports, sourceFileName }) => {
    // Use source filename if available, otherwise fallback to kebab-case conversion
    const fileName = sourceFileName || toKebabCase(queryType.replace('Query', ''));
    // Normalize the query type name to match GraphQL Codegen's normalization
    const normalizedQueryType = normalizeOperationName(queryType);

    // Derive the relative path prefix from baseTypesPath (e.g., '../' if baseTypesPath starts with '../')
    const baseTypesPath = config.baseTypesPath || './generated/gitlab-base-types.schema';
    const relativePrefix = baseTypesPath.startsWith('../') ? '../' : './';

    const localImports = [`import type { ${normalizedQueryType} } from "${relativePrefix}${fileName}.generated"`];

    if (enumImports.length > 0) {
      const enumSchemas = enumImports.map((e: string) => `${e}Schema`).join(', ');
      localImports.push(`import { ${enumSchemas} } from "${baseTypesPath}"`);
    }

    if (fragmentImports.length > 0) {
      // Only import fragments if we're not in the file where they're defined
      // Fragments are defined in mrs.schema.ts, so skip import if fileName is "mrs"
      if (fileName !== 'mrs') {
        const fragmentSchemas = fragmentImports.map((f: string) => `${f}FragmentSchema`).join(', ');
        // Import fragment schemas from mrs.schema.ts (where fragments are defined)
        // Note: This assumes all fragments are in mrs.schema.ts - adjust if fragments are in other files
        localImports.push(`import { ${fragmentSchemas} } from "./mrs.schema"`);
      }
    }

    return `${localImports.join('\n')}

export const ${normalizedQueryType}Schema: Schema.Schema<${normalizedQueryType}> = ${schemaBody}
`;
  }).join('\n');

  // Combine fragment schemas and query schemas
  const output = [fragmentOutput, queryOutput].filter(Boolean).join('\n');

  return {
    prepend: imports,
    content: output,
  };
};
