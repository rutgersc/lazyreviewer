import type { PluginFunction } from '@graphql-codegen/plugin-helpers';
import type { GraphQLSchema } from 'graphql';
import { isEnumType } from 'graphql';

/**
 * GraphQL Code Generator plugin for Effect Schema base types (enums)
 */
export const plugin: PluginFunction = (schema: GraphQLSchema) => {
  const imports: string[] = ['import { Schema } from "effect"'];
  const enumSchemas: string[] = [];
  const enumTypes: string[] = [];

  // Get all enum types from the schema
  const typeMap = schema.getTypeMap();

  for (const [typeName, type] of Object.entries(typeMap)) {
    // Skip internal GraphQL types
    if (typeName.startsWith('__')) continue;

    if (isEnumType(type)) {
      enumTypes.push(typeName);

      const values = type.getValues();
      const literals = values
        .map(v => `  Schema.Literal('${v.value}')`)
        .join(',\n');

      enumSchemas.push(
        `export const ${typeName}Schema: Schema.Codec<${typeName}> = Schema.Union([\n${literals}\n])`
      );
    }
  }

  // Add import for all enum types
  if (enumTypes.length > 0) {
    imports.push(`import type { ${enumTypes.join(', ')} } from "./gitlab-base-types"`);
  }

  return {
    prepend: imports,
    content: enumSchemas.join('\n'),
  };
};
