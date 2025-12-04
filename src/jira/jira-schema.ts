import { Schema} from "effect";

export const JiraStatusNameSchema = Schema.Literal(
  "FINAL REVIEW",
  "TEST IN PROGRESS",
  "To Do",
  "Done",
  "Merge Requested",
  "Merged",
  "Pending",
  "In Progress"
);

const JiraCommentContentTextSchema = Schema.Struct({
  text: Schema.optional(Schema.String),
  type: Schema.String
})

const JiraCommentContentBlockSchema = Schema.Struct({
  content:  Schema.optional(Schema.mutable(Schema.Array(JiraCommentContentTextSchema))),
  type: Schema.String
})

const JiraCommentBodySchema = Schema.Struct({
  content: Schema.optional(Schema.mutable(Schema.Array(JiraCommentContentBlockSchema))),
  type: Schema.String
})

export const JiraCommentSchema = Schema.Struct({
  id: Schema.String,
  author: Schema.Struct({
    displayName: Schema.String,
    emailAddress: Schema.optional(Schema.String)
  }),
  body: JiraCommentBodySchema,
  created: Schema.String,
  updated: Schema.String
})

export const JiraIssueSchema = Schema.Struct({
  key: Schema.String,
  id: Schema.String,
  self: Schema.String,
  fields: Schema.Struct({
    summary: Schema.String,
    parent: Schema.optional(Schema.Struct({
      key: Schema.String,
      fields: Schema.Struct({
        summary: Schema.String,
        issuetype: Schema.Struct({
          name: Schema.String
        })
      })
    })),
    status: Schema.Struct({
      name: Schema.String,
      statusCategory: Schema.Struct({
        name: Schema.String
      })
    }),
    assignee: Schema.optional(Schema.NullOr(Schema.Struct({
      displayName: Schema.String,
      emailAddress: Schema.String
    }))),
    priority: Schema.Struct({
      name: Schema.String
    }),
    issuetype: Schema.Struct({
      name: Schema.String
    }),
    created: Schema.String,
    updated: Schema.String,
    comment: Schema.Struct({
      total: Schema.optionalWith(Schema.Number, { default: () => 0 }),
      comments: Schema.mutable(Schema.Array(JiraCommentSchema))
    })
  })
}).annotations({ identifier: "JiraIssue" })

export const JiraSearchResponseSchema = Schema.Struct({
  issues: Schema.mutable(Schema.Array(JiraIssueSchema)),
  total: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  maxResults: Schema.optionalWith(Schema.Number, { default: () => 0 })
});

export type JiraStatusName = Schema.Schema.Type<typeof JiraStatusNameSchema>;
export type JiraComment = Schema.Schema.Type<typeof JiraCommentSchema>;
export type JiraIssue = Schema.Schema.Type<typeof JiraIssueSchema>;
export type JiraSearchResponse = Schema.Schema.Type<typeof JiraSearchResponseSchema>;