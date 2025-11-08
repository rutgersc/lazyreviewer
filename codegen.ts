import type { CodegenConfig } from '@graphql-codegen/cli';
import * as dotenv from 'dotenv';

dotenv.config();

const config: CodegenConfig = {
  schema: [
    {
      'https://git.elabnext.com/api/graphql': {
        headers: {
          Authorization: `Bearer ${process.env.GITLAB_TOKEN}`,
        },
      },
    },
  ],
  documents: ['src/graphql/**/*.graphql'],
  generates: {
    'src/graphql/': {
      preset: 'near-operation-file',
      presetConfig: {
        extension: '.generated.ts',
        baseTypesPath: 'generated/gitlab-base-types',
      },
      plugins: [
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        avoidOptionals: true,
        skipTypename: true,
        dedupeOperationSuffix: true,
        enumsAsTypes: true,
        useTypeImports: true,
        immutableTypes: true,  // Generate readonly types (compatible with Effect schemas)
        scalars: {
          Time: 'string',
          Date: 'string',
          ID: 'string',
        },
      },
    },
    'src/graphql/generated/gitlab-base-types.ts': {
      plugins: ['typescript'],
      config: {
        avoidOptionals: true,
        skipTypename: true,
        enumsAsTypes: true,
        useTypeImports: true,
        immutableTypes: true,
        scalars: {
          Time: 'string',
          Date: 'string',
          ID: 'string',
        },
      },
    },
  },
};

export default config;
