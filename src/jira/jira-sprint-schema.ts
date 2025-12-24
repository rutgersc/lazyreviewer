import { Schema } from "effect";

export const JiraSprintSchema = Schema.Struct({
  id: Schema.Number,
  self: Schema.String,
  state: Schema.String,
  name: Schema.String,
  startDate: Schema.optional(Schema.String),
  endDate: Schema.optional(Schema.String),
  originBoardId: Schema.optional(Schema.Number),
  goal: Schema.optional(Schema.String),
});

export const JiraSprintListResponseSchema = Schema.Struct({
  maxResults: Schema.Number,
  startAt: Schema.Number,
  isLast: Schema.Boolean,
  values: Schema.mutable(Schema.Array(JiraSprintSchema)),
});

const JiraCommentContentTextSchema = Schema.Struct({
  text: Schema.optional(Schema.String),
  type: Schema.String
});

const JiraCommentContentBlockSchema = Schema.Struct({
  content: Schema.optional(Schema.mutable(Schema.Array(JiraCommentContentTextSchema))),
  type: Schema.String
});

const JiraCommentBodyStructSchema = Schema.Struct({
  content: Schema.optional(
    Schema.mutable(Schema.Array(JiraCommentContentBlockSchema))
  ),
  type: Schema.String,
});

type JiraCommentBody = Schema.Schema.Type<typeof JiraCommentBodyStructSchema>;

const JiraCommentBodySchema = Schema.transform(
  Schema.Union(JiraCommentBodyStructSchema, Schema.String),
  JiraCommentBodyStructSchema,
  {
    decode: (input): JiraCommentBody => {
      if (typeof input === 'string') {
        return {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: input }] }]
        };
      }
      return input;
    },
    encode: (body) => body
  }
);

const JiraSprintCommentSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.Struct({
    displayName: Schema.String,
    emailAddress: Schema.optional(Schema.String)
  }),
  body: JiraCommentBodySchema,
  created: Schema.String,
  updated: Schema.String
});

export const JiraSprintIssueFieldsSchema = Schema.Struct({
  summary: Schema.String,
  parent: Schema.optional(Schema.NullOr(Schema.Struct({
    key: Schema.String,
    fields: Schema.Struct({
      summary: Schema.String,
      status: Schema.Struct({
        name: Schema.String,
      }),
      issuetype: Schema.Struct({
        name: Schema.String,
      }),
    }),
  }))),
  status: Schema.Struct({
    name: Schema.String,
    statusCategory: Schema.Struct({
      name: Schema.String,
    }),
  }),
  assignee: Schema.optional(Schema.NullOr(Schema.Struct({
    displayName: Schema.String,
    emailAddress: Schema.optional(Schema.String),
  }))),
  priority: Schema.optional(Schema.NullOr(Schema.Struct({
    name: Schema.String,
  }))),
  issuetype: Schema.Struct({
    name: Schema.String,
  }),
  created: Schema.optional(Schema.NullOr(Schema.String)),
  updated: Schema.optional(Schema.NullOr(Schema.String)),
  comment: Schema.optional(Schema.NullOr(Schema.Struct({
    total: Schema.optionalWith(Schema.Number, { default: () => 0 }),
    comments: Schema.mutable(Schema.Array(JiraSprintCommentSchema))
  }))),
  subtasks: Schema.optional(Schema.NullOr(Schema.mutable(Schema.Array(Schema.Struct({
    id: Schema.String,
    key: Schema.String,
    fields: Schema.Struct({
      summary: Schema.String,
      status: Schema.Struct({
        name: Schema.String,
      }),
      issuetype: Schema.Struct({
        name: Schema.String,
      }),
    }),
  }))))),
});

export const JiraSprintIssueSchema = Schema.Struct({
  key: Schema.String,
  id: Schema.String,
  self: Schema.String,
  fields: JiraSprintIssueFieldsSchema,
});

export const JiraSprintIssuesResponseSchema = Schema.Struct({
  maxResults: Schema.Number,
  startAt: Schema.Number,
  total: Schema.Number,
  issues: Schema.mutable(Schema.Array(JiraSprintIssueSchema)),
});

import type { JiraIssue } from "./jira-schema";

export type JiraSprint = Schema.Schema.Type<typeof JiraSprintSchema>;
export type JiraSprintIssue = Schema.Schema.Type<typeof JiraSprintIssueSchema>;
export type JiraSprintIssuesResponse = Schema.Schema.Type<typeof JiraSprintIssuesResponseSchema>;

export type JiraSprintTreeNode = {
  issue: JiraIssue;
  children: JiraIssue[];
  isExpanded: boolean;
};

export type JiraSprintTree = JiraSprintTreeNode[];
