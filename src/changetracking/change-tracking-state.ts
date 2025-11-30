export interface ChangeTrackingState {
  // Map from mrId to Set of noteIds we've seen
  mrCommentIds: Map<string, Set<string>>
}

export const initialChangeTrackingState: ChangeTrackingState = {
  mrCommentIds: new Map()
}
