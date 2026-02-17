export type DiscoveredRepo = {
  readonly provider: 'gitlab' | 'bitbucket'
  readonly fullPath: string
  readonly name: string
  readonly workspace?: string
  readonly repoSlug?: string
}

export type DiscoveredUser = {
  readonly provider: 'gitlab' | 'bitbucket'
  readonly username: string
  readonly displayName?: string
}

export type OnboardingStep = 'repos' | 'users' | 'identity'
