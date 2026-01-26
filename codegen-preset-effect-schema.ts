import type { Types } from '@graphql-codegen/plugin-helpers';
import * as path from 'path';

export type EffectSchemaPresetConfig = {
  baseTypesPath?: string;
  extension?: string;
};

/**
 * Custom preset that generates per-file Effect schemas while passing ALL documents
 * to the plugin, allowing automatic fragment discovery across files.
 */
export const preset: Types.OutputPreset<EffectSchemaPresetConfig> = {
  buildGeneratesSection: async (options) => {
    const { baseOutputDir, presetConfig, schema, documents, pluginMap, plugins, config } = options;

    const extension = presetConfig.extension || '.schema.ts';
    const baseTypesPath = presetConfig.baseTypesPath || '../generated/gitlab-base-types.schema';

    // Group documents by source file
    const docsByFile = new Map<string, Types.DocumentFile[]>();

    for (const doc of documents) {
      if (!doc.location) continue;
      const fileName = path.basename(doc.location).replace('.graphql', '');
      if (!docsByFile.has(fileName)) {
        docsByFile.set(fileName, []);
      }
      docsByFile.get(fileName)!.push(doc);
    }

    // Build fragment source map by scanning ALL documents
    const fragmentSources: Record<string, string> = {};
    for (const doc of documents) {
      if (!doc.document || !doc.location) continue;
      const fileName = path.basename(doc.location).replace('.graphql', '');

      for (const def of doc.document.definitions) {
        if (def.kind === 'FragmentDefinition') {
          fragmentSources[def.name.value] = fileName;
        }
      }
    }

    // Generate one output per source file, but pass ALL documents to each
    // invocation so fragment references can be resolved
    const result: Types.GenerateOptions[] = [];

    for (const [fileName] of docsByFile) {
      result.push({
        filename: path.join(baseOutputDir, `${fileName}${extension}`),
        plugins,
        pluginMap,
        schema,
        documents, // Pass ALL documents for fragment resolution
        config: {
          ...config,
          baseTypesPath,
          fragmentSources,
          targetFile: fileName, // Tell the plugin which file to generate for
        },
      });
    }

    return result;
  },
};

export default { preset };
