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
    'src/generated/gitlab-sdk.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        avoidOptionals: true,
        skipTypename: true,
        dedupeOperationSuffix: true,
        enumsAsTypes: true,
        useTypeImports: true,
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
