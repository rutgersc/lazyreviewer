import { Schema } from "effect"
import type { AccessLevelEnum, AccessTokenGranularScopeAccess, AccessTokenSort, AccessTokenState, AgentTokenStatus, AiAcceptedSelfHostedModels, AiAction, AiAdditionalContextCategory, AiCatalogFlowConfigType, AiCatalogItemReportReason, AiCatalogItemType, AiCatalogVersionBump, AiConversationsThreadsConversationType, AiFeatureProviders, AiFeatures, AiMessageRole, AiMessageType, AiModelSelectionFeatures, AiSelfHostedModelReleaseState, AiUsageEventType, AiUserMetricsSort, AlertManagementAlertSort, AlertManagementDomainFilter, AlertManagementIntegrationType, AlertManagementPayloadAlertFieldName, AlertManagementPayloadAlertFieldType, AlertManagementSeverity, AlertManagementStatus, AnalyticsAggregationPeriod, AnalyzerStatusEnum, AnalyzerTypeEnum, ApiFuzzingScanMode, ApprovalReportType, ApprovalRuleType, AssigneeWildcardId, AttributeFilterOperator, AutoStopSetting, AvailabilityEnum, AvailableExportFields, BlobViewersType, CarStatus, CiCatalogResourceScope, CiCatalogResourceSort, CiCatalogResourceVerificationLevel, CiConfigIncludeType, CiConfigStatus, CiFreezePeriodStatus, CiGroupVariablesSort, CiInputsType, CiJobAnalyticsAggregation, CiJobAnalyticsField, CiJobAnalyticsSort, CiJobFailureReason, CiJobKind, CiJobSource, CiJobStatus, CiJobTokenScopeDirection, CiJobTokenScopePolicies, CiPipelineCreationStatus, CiPipelineSources, CiRunnerAccessLevel, CiRunnerCloudProvider, CiRunnerCreationMethod, CiRunnerCreationState, CiRunnerJobExecutionStatus, CiRunnerMembershipFilter, CiRunnerSort, CiRunnerStatus, CiRunnerType, CiRunnerUpgradeStatus, CiVariableSort, CiVariableType, CodeFlowNodeType, CodeQualityDegradationSeverity, CodequalityReportsComparerReportGenerationStatus, CodequalityReportsComparerStatus, CommitActionMode, CommitEncoding, ComparableSecurityReportType, ComparisonOperator, ComplianceFrameworkPresenceFilter, ComplianceFrameworkSort, ComplianceStandardsAdherenceCheckName, ComplianceStandardsAdherenceStandard, ComplianceStandardsAdherenceStatus, ComplianceViolationReason, ComplianceViolationSeverity, ComplianceViolationSort, ComplianceViolationStatus, ConanMetadatumFileTypeEnum, ContactSort, ContainerExpirationPolicyCadenceEnum, ContainerExpirationPolicyKeepEnum, ContainerExpirationPolicyOlderThanEnum, ContainerProtectionRepositoryRuleAccessLevel, ContainerProtectionTagRuleAccessLevel, ContainerRepositoryCleanupStatus, ContainerRepositorySort, ContainerRepositoryStatus, ContainerRepositoryTagSort, CustomFieldType, CustomerRelationsContactState, CustomerRelationsOrganizationState, CustomizableDashboardCategory, CvssSeverity, DastPreScanVerificationCheckType, DastPreScanVerificationStatus, DastProfileCadenceUnit, DastScanMethodType, DastScanTypeEnum, DastSiteProfileValidationStatusEnum, DastSiteValidationStatusEnum, DastSiteValidationStrategyEnum, DastTargetTypeEnum, DataVisualizationColorEnum, DataVisualizationWeightEnum, DependencyProxyManifestStatus, DependencySort, DeploymentApprovalSummaryStatus, DeploymentStatus, DeploymentTier, DeploymentsApprovalStatus, DesignCollectionCopyState, DesignVersionEvent, DetailedMergeStatus, DiffPositionType, DismissalType, DoraMetricBucketingInterval, DuoWorkflowStatus, DuoWorkflowStatusGroup, DuoWorkflowsWorkflowSort, EntryType, EpicSort, EpicState, EpicStateEvent, EpicWildcardId, ErrorTrackingStatus, EscalationRuleStatus, EventAction, ExclusionScannerEnum, ExclusionTypeEnum, ExtensionsMarketplaceOptInStatus, FindingReportsComparerStatus, GeoRegistriesBulkAction, GeoRegistryAction, GeoRegistryClass, GeoRegistrySort, GitlabSubscriptionsAddOnType, GitlabSubscriptionsUserRole, GitlabSubscriptionsUserSort, GoogleCloudArtifactRegistryArtifactsSort, GroupMemberRelation, GroupPermission, GroupReleaseSort, GroupSecretsManagerStatus, GroupSort, GroupingEnum, HealthStatus, HealthStatusFilter, ImportSource, ImportSourceUserStatus, IntegrationType, IssuableResourceLinkType, IssuableSearchableField, IssuableSeverity, IssuableState, IssueCreationIterationWildcardId, IssueEscalationStatus, IssueSort, IssueState, IssueStateEvent, IssueType, IterationSearchableField, IterationSort, IterationState, IterationWildcardId, JobArtifactFileType, LabelSearchFieldList, LdapAdminRoleSyncStatus, ListLimitMetric, MeasurementIdentifier, MemberAccessLevel, MemberAccessLevelName, MemberApprovalStatusType, MemberRoleAdminPermission, MemberRolePermission, MemberRoleStandardPermission, MemberRolesAccessLevel, MemberRolesOrderBy, MemberSort, MergeRequestNewState, MergeRequestReviewState, MergeRequestSort, MergeRequestState, MergeRequestsDashboardListType, MergeStatus, MergeStrategyEnum, MergeTrainStatus, MergeabilityCheckIdentifier, MergeabilityCheckStatus, MilestoneSort, MilestoneStateEnum, MilestoneWildcardId, MlModelVersionsOrderBy, MlModelsOrderBy, MoveType, MutationOperationMode, NamespaceClusterAgentFilter, NamespaceProjectSort, NegatedIterationWildcardId, NegatedMilestoneWildcardId, NotesFilterType, OncallRotationUnitEnum, OpenTelemetryMetricType, OrganizationClusterAgentFilter, OrganizationGroupProjectDisplay, OrganizationGroupProjectSort, OrganizationSort, OrganizationUserAccessLevel, PackageDependencyType, PackageGroupSort, PackageManager, PackageSort, PackageStatus, PackageTypeEnum, PackagesCleanupKeepDuplicatedPackageFilesEnum, PackagesProtectionRuleAccessLevel, PackagesProtectionRuleAccessLevelForDelete, PackagesProtectionRulePackageType, PermissionBoundary, PipelineAnalyticsJobStatus, PipelineConfigSourceEnum, PipelineMergeRequestEventType, PipelineScheduleSort, PipelineScheduleStatus, PipelineScopeEnum, PipelineSecurityReportFindingSort, PipelineStatusEnum, PipelineVariablesDefaultRoleType, PolicyEnforcementType, PolicyProjectCreatedStatus, PolicyStatus, PolicyType, PolicyViolationErrorType, PolicyViolationStatus, PolicyViolations, PrincipalType, ProductAnalyticsState, ProjectArchived, ProjectComplianceControlStatus, ProjectComplianceRequirementStatusOrderBy, ProjectFeatureAccessLevel, ProjectMemberRelation, ProjectSecretStatus, ProjectSecretsManagerStatus, ProjectSort, ProjectTrackedContext, ReachabilityType, RefType, RegistryState, RelationshipType, RelativePositionType, ReleaseAssetLinkType, ReleaseSort, ReleaseTagWildcardId, ReplicationStateEnum, RequirementState, RequirementStatusFilter, ResourceGroupsProcessMode, ReviewerWildcardId, RiskRating, SastUiComponentSize, SbomSourceType, ScanModeEnum, ScanStatus, SearchLevel, SearchType, SecretRotationStatus, SecretsManagementAction, SecurityAttributeBulkUpdateMode, SecurityCategoryEditableState, SecurityCategoryTemplateType, SecurityPolicyRelationType, SecurityPreferredLicenseSourceConfiguration, SecurityReportTypeEnum, SecurityScanProfileType, SecurityScannerType, SentryErrorStatus, ServiceType, ShaFormat, SharedRunnersSetting, SnippetBlobActionEnum, Sort, SortDirectionEnum, SourceUserSort, SquashOptionSetting, SubscriptionHistoryChangeType, SubscriptionStatus, TestCaseStatus, TestReportState, TimeboxReportErrorReason, TimelogSort, TodoActionEnum, TodoSort, TodoStateEnum, TodoTargetEnum, TrainingUrlRequestStatus, TypeEnum, UserCalloutFeatureNameEnum, UserGroupCalloutFeatureName, UserPromotionStatusType, UserState, UserType, ValueStreamDashboardMetric, ValueStreamDashboardProjectLevelMetric, ValueStreamStageEvent, ValueStreamStageItemSort, VerificationStateEnum, VerificationStatus, VisibilityLevelsEnum, VisibilityPipelineIdType, VisibilityScopesEnum, VulnerabilityDismissalReason, VulnerabilityExternalIssueLinkExternalTracker, VulnerabilityExternalIssueLinkType, VulnerabilityFalsePositiveDetectionStatus, VulnerabilityFindingTokenStatusState, VulnerabilityGrade, VulnerabilityIssueLinkType, VulnerabilityOwasp2021Top10, VulnerabilityOwaspTop10, VulnerabilityReportType, VulnerabilitySeverity, VulnerabilitySort, VulnerabilityState, VulnerabilityWorkflowName, WebhookAlertStatus, WebhookBranchFilterStrategy, WeightWildcardId, WorkItemAwardEmojiUpdateAction, WorkItemDiscussionsSort, WorkItemParentWildcardId, WorkItemRelatedLinkType, WorkItemSort, WorkItemState, WorkItemStateEvent, WorkItemStatusCategoryEnum, WorkItemSubscriptionEvent, WorkItemTodoUpdateAction, WorkItemWidgetType, WorkItemsSavedViewsSort, WorkflowEnvironment, WorkspaceVariableInputType, WorkspaceVariableType } from "./gitlab-base-types"
export const AccessLevelEnumSchema: Schema.Schema<AccessLevelEnum> = Schema.Union(
  Schema.Literal('ADMIN'),
  Schema.Literal('DEVELOPER'),
  Schema.Literal('GUEST'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('MINIMAL_ACCESS'),
  Schema.Literal('NO_ACCESS'),
  Schema.Literal('OWNER'),
  Schema.Literal('PLANNER'),
  Schema.Literal('REPORTER')
)
export const AccessTokenGranularScopeAccessSchema: Schema.Schema<AccessTokenGranularScopeAccess> = Schema.Union(
  Schema.Literal('ALL_MEMBERSHIPS'),
  Schema.Literal('INSTANCE'),
  Schema.Literal('PERSONAL_PROJECTS'),
  Schema.Literal('SELECTED_MEMBERSHIPS'),
  Schema.Literal('USER')
)
export const AccessTokenSortSchema: Schema.Schema<AccessTokenSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('EXPIRES_ASC'),
  Schema.Literal('EXPIRES_DESC'),
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('LAST_USED_ASC'),
  Schema.Literal('LAST_USED_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC')
)
export const AccessTokenStateSchema: Schema.Schema<AccessTokenState> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('INACTIVE')
)
export const AgentTokenStatusSchema: Schema.Schema<AgentTokenStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('REVOKED')
)
export const AiAcceptedSelfHostedModelsSchema: Schema.Schema<AiAcceptedSelfHostedModels> = Schema.Union(
  Schema.Literal('CLAUDE_3'),
  Schema.Literal('CODEGEMMA'),
  Schema.Literal('CODELLAMA'),
  Schema.Literal('CODESTRAL'),
  Schema.Literal('DEEPSEEKCODER'),
  Schema.Literal('GENERAL'),
  Schema.Literal('GPT'),
  Schema.Literal('LLAMA3'),
  Schema.Literal('MISTRAL'),
  Schema.Literal('MIXTRAL')
)
export const AiActionSchema: Schema.Schema<AiAction> = Schema.Union(
  Schema.Literal('CHAT')
)
export const AiAdditionalContextCategorySchema: Schema.Schema<AiAdditionalContextCategory> = Schema.Union(
  Schema.Literal('AGENT_USER_ENVIRONMENT'),
  Schema.Literal('DEPENDENCY'),
  Schema.Literal('DIRECTORY'),
  Schema.Literal('FILE'),
  Schema.Literal('ISSUE'),
  Schema.Literal('LOCAL_GIT'),
  Schema.Literal('MERGE_REQUEST'),
  Schema.Literal('REPOSITORY'),
  Schema.Literal('SNIPPET'),
  Schema.Literal('TERMINAL'),
  Schema.Literal('USER_RULE')
)
export const AiCatalogFlowConfigTypeSchema: Schema.Schema<AiCatalogFlowConfigType> = Schema.Union(
  Schema.Literal('CHAT')
)
export const AiCatalogItemReportReasonSchema: Schema.Schema<AiCatalogItemReportReason> = Schema.Union(
  Schema.Literal('EXCESSIVE_RESOURCE_USAGE'),
  Schema.Literal('IMMEDIATE_SECURITY_THREAT'),
  Schema.Literal('OTHER'),
  Schema.Literal('POTENTIAL_SECURITY_THREAT'),
  Schema.Literal('SPAM_OR_LOW_QUALITY')
)
export const AiCatalogItemTypeSchema: Schema.Schema<AiCatalogItemType> = Schema.Union(
  Schema.Literal('AGENT'),
  Schema.Literal('FLOW'),
  Schema.Literal('THIRD_PARTY_FLOW')
)
export const AiCatalogVersionBumpSchema: Schema.Schema<AiCatalogVersionBump> = Schema.Union(
  Schema.Literal('MAJOR'),
  Schema.Literal('MINOR'),
  Schema.Literal('PATCH')
)
export const AiConversationsThreadsConversationTypeSchema: Schema.Schema<AiConversationsThreadsConversationType> = Schema.Union(
  Schema.Literal('DUO_CHAT'),
  Schema.Literal('DUO_CHAT_LEGACY'),
  Schema.Literal('DUO_CODE_REVIEW'),
  Schema.Literal('DUO_QUICK_CHAT')
)
export const AiFeatureProvidersSchema: Schema.Schema<AiFeatureProviders> = Schema.Union(
  Schema.Literal('DISABLED'),
  Schema.Literal('SELF_HOSTED'),
  Schema.Literal('UNASSIGNED'),
  Schema.Literal('VENDORED')
)
export const AiFeaturesSchema: Schema.Schema<AiFeatures> = Schema.Union(
  Schema.Literal('CODE_COMPLETIONS'),
  Schema.Literal('CODE_GENERATIONS'),
  Schema.Literal('DUO_AGENT_PLATFORM'),
  Schema.Literal('DUO_AGENT_PLATFORM_AGENTIC_CHAT'),
  Schema.Literal('DUO_CHAT'),
  Schema.Literal('DUO_CHAT_EXPLAIN_CODE'),
  Schema.Literal('DUO_CHAT_EXPLAIN_VULNERABILITY'),
  Schema.Literal('DUO_CHAT_FIX_CODE'),
  Schema.Literal('DUO_CHAT_REFACTOR_CODE'),
  Schema.Literal('DUO_CHAT_SUMMARIZE_COMMENTS'),
  Schema.Literal('DUO_CHAT_TROUBLESHOOT_JOB'),
  Schema.Literal('DUO_CHAT_WRITE_TESTS'),
  Schema.Literal('GENERATE_COMMIT_MESSAGE'),
  Schema.Literal('GLAB_ASK_GIT_COMMAND'),
  Schema.Literal('RESOLVE_VULNERABILITY'),
  Schema.Literal('REVIEW_MERGE_REQUEST'),
  Schema.Literal('SUMMARIZE_NEW_MERGE_REQUEST'),
  Schema.Literal('SUMMARIZE_REVIEW')
)
export const AiMessageRoleSchema: Schema.Schema<AiMessageRole> = Schema.Union(
  Schema.Literal('ASSISTANT'),
  Schema.Literal('SYSTEM'),
  Schema.Literal('USER')
)
export const AiMessageTypeSchema: Schema.Schema<AiMessageType> = Schema.Union(
  Schema.Literal('TOOL')
)
export const AiModelSelectionFeaturesSchema: Schema.Schema<AiModelSelectionFeatures> = Schema.Union(
  Schema.Literal('CODE_COMPLETIONS'),
  Schema.Literal('CODE_GENERATIONS'),
  Schema.Literal('DUO_AGENT_PLATFORM'),
  Schema.Literal('DUO_AGENT_PLATFORM_AGENTIC_CHAT'),
  Schema.Literal('DUO_CHAT'),
  Schema.Literal('DUO_CHAT_EXPLAIN_CODE'),
  Schema.Literal('DUO_CHAT_EXPLAIN_VULNERABILITY'),
  Schema.Literal('DUO_CHAT_FIX_CODE'),
  Schema.Literal('DUO_CHAT_REFACTOR_CODE'),
  Schema.Literal('DUO_CHAT_SUMMARIZE_COMMENTS'),
  Schema.Literal('DUO_CHAT_TROUBLESHOOT_JOB'),
  Schema.Literal('DUO_CHAT_WRITE_TESTS'),
  Schema.Literal('GENERATE_COMMIT_MESSAGE'),
  Schema.Literal('RESOLVE_VULNERABILITY'),
  Schema.Literal('REVIEW_MERGE_REQUEST'),
  Schema.Literal('SUMMARIZE_NEW_MERGE_REQUEST'),
  Schema.Literal('SUMMARIZE_REVIEW')
)
export const AiSelfHostedModelReleaseStateSchema: Schema.Schema<AiSelfHostedModelReleaseState> = Schema.Union(
  Schema.Literal('BETA'),
  Schema.Literal('EXPERIMENTAL'),
  Schema.Literal('GA')
)
export const AiUsageEventTypeSchema: Schema.Schema<AiUsageEventType> = Schema.Union(
  Schema.Literal('AGENT_PLATFORM_SESSION_CREATED'),
  Schema.Literal('AGENT_PLATFORM_SESSION_DROPPED'),
  Schema.Literal('AGENT_PLATFORM_SESSION_FINISHED'),
  Schema.Literal('AGENT_PLATFORM_SESSION_RESUMED'),
  Schema.Literal('AGENT_PLATFORM_SESSION_STARTED'),
  Schema.Literal('AGENT_PLATFORM_SESSION_STOPPED'),
  Schema.Literal('CODE_SUGGESTIONS_REQUESTED'),
  Schema.Literal('CODE_SUGGESTION_ACCEPTED_IN_IDE'),
  Schema.Literal('CODE_SUGGESTION_DIRECT_ACCESS_TOKEN_REFRESH'),
  Schema.Literal('CODE_SUGGESTION_REJECTED_IN_IDE'),
  Schema.Literal('CODE_SUGGESTION_SHOWN_IN_IDE'),
  Schema.Literal('ENCOUNTER_DUO_CODE_REVIEW_ERROR_DURING_REVIEW'),
  Schema.Literal('EXCLUDED_FILES_FROM_DUO_CODE_REVIEW'),
  Schema.Literal('FIND_NOTHING_TO_REVIEW_DUO_CODE_REVIEW_ON_MR'),
  Schema.Literal('FIND_NO_ISSUES_DUO_CODE_REVIEW_AFTER_REVIEW'),
  Schema.Literal('FINISH_MCP_TOOL_CALL'),
  Schema.Literal('POST_COMMENT_DUO_CODE_REVIEW_ON_DIFF'),
  Schema.Literal('REACT_THUMBS_DOWN_ON_DUO_CODE_REVIEW_COMMENT'),
  Schema.Literal('REACT_THUMBS_UP_ON_DUO_CODE_REVIEW_COMMENT'),
  Schema.Literal('REQUEST_DUO_CHAT_RESPONSE'),
  Schema.Literal('REQUEST_REVIEW_DUO_CODE_REVIEW_ON_MR_BY_AUTHOR'),
  Schema.Literal('REQUEST_REVIEW_DUO_CODE_REVIEW_ON_MR_BY_NON_AUTHOR'),
  Schema.Literal('START_MCP_TOOL_CALL'),
  Schema.Literal('TROUBLESHOOT_JOB')
)
export const AiUserMetricsSortSchema: Schema.Schema<AiUserMetricsSort> = Schema.Union(
  Schema.Literal('AGENT_PLATFORM_TOTAL_COUNT_ASC'),
  Schema.Literal('AGENT_PLATFORM_TOTAL_COUNT_DESC'),
  Schema.Literal('CHAT_TOTAL_COUNT_ASC'),
  Schema.Literal('CHAT_TOTAL_COUNT_DESC'),
  Schema.Literal('CODE_REVIEW_TOTAL_COUNT_ASC'),
  Schema.Literal('CODE_REVIEW_TOTAL_COUNT_DESC'),
  Schema.Literal('CODE_SUGGESTIONS_TOTAL_COUNT_ASC'),
  Schema.Literal('CODE_SUGGESTIONS_TOTAL_COUNT_DESC'),
  Schema.Literal('MCP_TOTAL_COUNT_ASC'),
  Schema.Literal('MCP_TOTAL_COUNT_DESC'),
  Schema.Literal('TROUBLESHOOT_JOB_TOTAL_COUNT_ASC'),
  Schema.Literal('TROUBLESHOOT_JOB_TOTAL_COUNT_DESC')
)
export const AlertManagementAlertSortSchema: Schema.Schema<AlertManagementAlertSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('CREATED_TIME_ASC'),
  Schema.Literal('CREATED_TIME_DESC'),
  Schema.Literal('ENDED_AT_ASC'),
  Schema.Literal('ENDED_AT_DESC'),
  Schema.Literal('EVENT_COUNT_ASC'),
  Schema.Literal('EVENT_COUNT_DESC'),
  Schema.Literal('SEVERITY_ASC'),
  Schema.Literal('SEVERITY_DESC'),
  Schema.Literal('STARTED_AT_ASC'),
  Schema.Literal('STARTED_AT_DESC'),
  Schema.Literal('STATUS_ASC'),
  Schema.Literal('STATUS_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('UPDATED_TIME_ASC'),
  Schema.Literal('UPDATED_TIME_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const AlertManagementDomainFilterSchema: Schema.Schema<AlertManagementDomainFilter> = Schema.Union(
  Schema.Literal('operations'),
  Schema.Literal('threat_monitoring')
)
export const AlertManagementIntegrationTypeSchema: Schema.Schema<AlertManagementIntegrationType> = Schema.Union(
  Schema.Literal('HTTP'),
  Schema.Literal('PROMETHEUS')
)
export const AlertManagementPayloadAlertFieldNameSchema: Schema.Schema<AlertManagementPayloadAlertFieldName> = Schema.Union(
  Schema.Literal('DESCRIPTION'),
  Schema.Literal('END_TIME'),
  Schema.Literal('FINGERPRINT'),
  Schema.Literal('GITLAB_ENVIRONMENT_NAME'),
  Schema.Literal('HOSTS'),
  Schema.Literal('MONITORING_TOOL'),
  Schema.Literal('SERVICE'),
  Schema.Literal('SEVERITY'),
  Schema.Literal('START_TIME'),
  Schema.Literal('TITLE')
)
export const AlertManagementPayloadAlertFieldTypeSchema: Schema.Schema<AlertManagementPayloadAlertFieldType> = Schema.Union(
  Schema.Literal('ARRAY'),
  Schema.Literal('DATETIME'),
  Schema.Literal('NUMBER'),
  Schema.Literal('STRING')
)
export const AlertManagementSeveritySchema: Schema.Schema<AlertManagementSeverity> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('INFO'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('UNKNOWN')
)
export const AlertManagementStatusSchema: Schema.Schema<AlertManagementStatus> = Schema.Union(
  Schema.Literal('ACKNOWLEDGED'),
  Schema.Literal('IGNORED'),
  Schema.Literal('RESOLVED'),
  Schema.Literal('TRIGGERED')
)
export const AnalyticsAggregationPeriodSchema: Schema.Schema<AnalyticsAggregationPeriod> = Schema.Union(
  Schema.Literal('DAY'),
  Schema.Literal('MONTH'),
  Schema.Literal('WEEK')
)
export const AnalyzerStatusEnumSchema: Schema.Schema<AnalyzerStatusEnum> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('NOT_CONFIGURED'),
  Schema.Literal('SUCCESS')
)
export const AnalyzerTypeEnumSchema: Schema.Schema<AnalyzerTypeEnum> = Schema.Union(
  Schema.Literal('API_FUZZING'),
  Schema.Literal('CLUSTER_IMAGE_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING_FOR_REGISTRY'),
  Schema.Literal('CONTAINER_SCANNING_PIPELINE_BASED'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('SAST'),
  Schema.Literal('SAST_ADVANCED'),
  Schema.Literal('SAST_IAC'),
  Schema.Literal('SECRET_DETECTION'),
  Schema.Literal('SECRET_DETECTION_PIPELINE_BASED'),
  Schema.Literal('SECRET_DETECTION_SECRET_PUSH_PROTECTION')
)
export const ApiFuzzingScanModeSchema: Schema.Schema<ApiFuzzingScanMode> = Schema.Union(
  Schema.Literal('HAR'),
  Schema.Literal('OPENAPI'),
  Schema.Literal('POSTMAN')
)
export const ApprovalReportTypeSchema: Schema.Schema<ApprovalReportType> = Schema.Union(
  Schema.Literal('ANY_MERGE_REQUEST'),
  Schema.Literal('LICENSE_SCANNING'),
  Schema.Literal('SCAN_FINDING')
)
export const ApprovalRuleTypeSchema: Schema.Schema<ApprovalRuleType> = Schema.Union(
  Schema.Literal('ANY_APPROVER'),
  Schema.Literal('CODE_OWNER'),
  Schema.Literal('REGULAR'),
  Schema.Literal('REPORT_APPROVER')
)
export const AssigneeWildcardIdSchema: Schema.Schema<AssigneeWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const AttributeFilterOperatorSchema: Schema.Schema<AttributeFilterOperator> = Schema.Union(
  Schema.Literal('IS_NOT_ONE_OF'),
  Schema.Literal('IS_ONE_OF')
)
export const AutoStopSettingSchema: Schema.Schema<AutoStopSetting> = Schema.Union(
  Schema.Literal('ALWAYS'),
  Schema.Literal('WITH_ACTION')
)
export const AvailabilityEnumSchema: Schema.Schema<AvailabilityEnum> = Schema.Union(
  Schema.Literal('BUSY'),
  Schema.Literal('NOT_SET')
)
export const AvailableExportFieldsSchema: Schema.Schema<AvailableExportFields> = Schema.Union(
  Schema.Literal('ASSIGNEE'),
  Schema.Literal('ASSIGNEE_USERNAME'),
  Schema.Literal('AUTHOR'),
  Schema.Literal('AUTHOR_USERNAME'),
  Schema.Literal('CLOSED_AT'),
  Schema.Literal('CONFIDENTIAL'),
  Schema.Literal('CREATED_AT'),
  Schema.Literal('DESCRIPTION'),
  Schema.Literal('DUE_DATE'),
  Schema.Literal('ID'),
  Schema.Literal('IID'),
  Schema.Literal('LOCKED'),
  Schema.Literal('MILESTONE'),
  Schema.Literal('PARENT_ID'),
  Schema.Literal('PARENT_IID'),
  Schema.Literal('PARENT_TITLE'),
  Schema.Literal('START_DATE'),
  Schema.Literal('STATE'),
  Schema.Literal('TIME_ESTIMATE'),
  Schema.Literal('TIME_SPENT'),
  Schema.Literal('TITLE'),
  Schema.Literal('TYPE'),
  Schema.Literal('UPDATED_AT'),
  Schema.Literal('URL'),
  Schema.Literal('WEIGHT')
)
export const BlobViewersTypeSchema: Schema.Schema<BlobViewersType> = Schema.Union(
  Schema.Literal('auxiliary'),
  Schema.Literal('rich'),
  Schema.Literal('simple')
)
export const CarStatusSchema: Schema.Schema<CarStatus> = Schema.Union(
  Schema.Literal('FRESH'),
  Schema.Literal('IDLE'),
  Schema.Literal('MERGED'),
  Schema.Literal('MERGING'),
  Schema.Literal('SKIP_MERGED'),
  Schema.Literal('STALE')
)
export const CiCatalogResourceScopeSchema: Schema.Schema<CiCatalogResourceScope> = Schema.Union(
  Schema.Literal('ALL'),
  Schema.Literal('NAMESPACES')
)
export const CiCatalogResourceSortSchema: Schema.Schema<CiCatalogResourceSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('LATEST_RELEASED_AT_ASC'),
  Schema.Literal('LATEST_RELEASED_AT_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('STAR_COUNT_ASC'),
  Schema.Literal('STAR_COUNT_DESC'),
  Schema.Literal('USAGE_COUNT_ASC'),
  Schema.Literal('USAGE_COUNT_DESC')
)
export const CiCatalogResourceVerificationLevelSchema: Schema.Schema<CiCatalogResourceVerificationLevel> = Schema.Union(
  Schema.Literal('GITLAB_MAINTAINED'),
  Schema.Literal('GITLAB_PARTNER_MAINTAINED'),
  Schema.Literal('UNVERIFIED'),
  Schema.Literal('VERIFIED_CREATOR_MAINTAINED'),
  Schema.Literal('VERIFIED_CREATOR_SELF_MANAGED')
)
export const CiConfigIncludeTypeSchema: Schema.Schema<CiConfigIncludeType> = Schema.Union(
  Schema.Literal('component'),
  Schema.Literal('file'),
  Schema.Literal('local'),
  Schema.Literal('remote'),
  Schema.Literal('template')
)
export const CiConfigStatusSchema: Schema.Schema<CiConfigStatus> = Schema.Union(
  Schema.Literal('INVALID'),
  Schema.Literal('VALID')
)
export const CiFreezePeriodStatusSchema: Schema.Schema<CiFreezePeriodStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('INACTIVE')
)
export const CiGroupVariablesSortSchema: Schema.Schema<CiGroupVariablesSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('KEY_ASC'),
  Schema.Literal('KEY_DESC')
)
export const CiInputsTypeSchema: Schema.Schema<CiInputsType> = Schema.Union(
  Schema.Literal('ARRAY'),
  Schema.Literal('BOOLEAN'),
  Schema.Literal('NUMBER'),
  Schema.Literal('STRING')
)
export const CiJobAnalyticsAggregationSchema: Schema.Schema<CiJobAnalyticsAggregation> = Schema.Union(
  Schema.Literal('MEAN_DURATION_IN_SECONDS'),
  Schema.Literal('P95_DURATION_IN_SECONDS'),
  Schema.Literal('RATE_OF_CANCELED'),
  Schema.Literal('RATE_OF_FAILED'),
  Schema.Literal('RATE_OF_SUCCESS')
)
export const CiJobAnalyticsFieldSchema: Schema.Schema<CiJobAnalyticsField> = Schema.Union(
  Schema.Literal('NAME'),
  Schema.Literal('STAGE')
)
export const CiJobAnalyticsSortSchema: Schema.Schema<CiJobAnalyticsSort> = Schema.Union(
  Schema.Literal('CANCELED_RATE_ASC'),
  Schema.Literal('CANCELED_RATE_DESC'),
  Schema.Literal('FAILED_RATE_ASC'),
  Schema.Literal('FAILED_RATE_DESC'),
  Schema.Literal('MEAN_DURATION_ASC'),
  Schema.Literal('MEAN_DURATION_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('P95_DURATION_ASC'),
  Schema.Literal('P95_DURATION_DESC'),
  Schema.Literal('SUCCESS_RATE_ASC'),
  Schema.Literal('SUCCESS_RATE_DESC')
)
export const CiJobFailureReasonSchema: Schema.Schema<CiJobFailureReason> = Schema.Union(
  Schema.Literal('API_FAILURE'),
  Schema.Literal('ARCHIVED_FAILURE'),
  Schema.Literal('BRIDGE_PIPELINE_IS_CHILD_PIPELINE'),
  Schema.Literal('BUILDS_DISABLED'),
  Schema.Literal('CI_QUOTA_EXCEEDED'),
  Schema.Literal('DATA_INTEGRITY_FAILURE'),
  Schema.Literal('DEPLOYMENT_REJECTED'),
  Schema.Literal('DOWNSTREAM_BRIDGE_PROJECT_NOT_FOUND'),
  Schema.Literal('DOWNSTREAM_PIPELINE_CREATION_FAILED'),
  Schema.Literal('DUO_WORKFLOW_NOT_ALLOWED'),
  Schema.Literal('ENVIRONMENT_CREATION_FAILURE'),
  Schema.Literal('FAILED_OUTDATED_DEPLOYMENT_JOB'),
  Schema.Literal('FORWARD_DEPLOYMENT_FAILURE'),
  Schema.Literal('INSUFFICIENT_BRIDGE_PERMISSIONS'),
  Schema.Literal('INSUFFICIENT_UPSTREAM_PERMISSIONS'),
  Schema.Literal('INVALID_BRIDGE_TRIGGER'),
  Schema.Literal('IP_RESTRICTION_FAILURE'),
  Schema.Literal('JOB_EXECUTION_TIMEOUT'),
  Schema.Literal('MISSING_DEPENDENCY_FAILURE'),
  Schema.Literal('NO_MATCHING_RUNNER'),
  Schema.Literal('PIPELINE_LOOP_DETECTED'),
  Schema.Literal('PROJECT_DELETED'),
  Schema.Literal('PROTECTED_ENVIRONMENT_FAILURE'),
  Schema.Literal('REACHED_DOWNSTREAM_PIPELINE_TRIGGER_RATE_LIMIT'),
  Schema.Literal('REACHED_MAX_DESCENDANT_PIPELINES_DEPTH'),
  Schema.Literal('REACHED_MAX_PIPELINE_HIERARCHY_SIZE'),
  Schema.Literal('RUNNER_SYSTEM_FAILURE'),
  Schema.Literal('RUNNER_UNSUPPORTED'),
  Schema.Literal('SCHEDULER_FAILURE'),
  Schema.Literal('SCRIPT_FAILURE'),
  Schema.Literal('SECRETS_PROVIDER_NOT_FOUND'),
  Schema.Literal('STALE_SCHEDULE'),
  Schema.Literal('STUCK_OR_TIMEOUT_FAILURE'),
  Schema.Literal('TRACE_SIZE_EXCEEDED'),
  Schema.Literal('UNKNOWN_FAILURE'),
  Schema.Literal('UNMET_PREREQUISITES'),
  Schema.Literal('UPSTREAM_BRIDGE_PROJECT_NOT_FOUND'),
  Schema.Literal('USER_BLOCKED')
)
export const CiJobKindSchema: Schema.Schema<CiJobKind> = Schema.Union(
  Schema.Literal('BRIDGE'),
  Schema.Literal('BUILD')
)
export const CiJobSourceSchema: Schema.Schema<CiJobSource> = Schema.Union(
  Schema.Literal('API'),
  Schema.Literal('CHAT'),
  Schema.Literal('CONTAINER_REGISTRY_PUSH'),
  Schema.Literal('DUO_WORKFLOW'),
  Schema.Literal('EXTERNAL'),
  Schema.Literal('EXTERNAL_PULL_REQUEST_EVENT'),
  Schema.Literal('MERGE_REQUEST_EVENT'),
  Schema.Literal('ONDEMAND_DAST_SCAN'),
  Schema.Literal('ONDEMAND_DAST_VALIDATION'),
  Schema.Literal('PARENT_PIPELINE'),
  Schema.Literal('PIPELINE'),
  Schema.Literal('PIPELINE_EXECUTION_POLICY'),
  Schema.Literal('PIPELINE_EXECUTION_POLICY_SCHEDULE'),
  Schema.Literal('PUSH'),
  Schema.Literal('SCAN_EXECUTION_POLICY'),
  Schema.Literal('SCHEDULE'),
  Schema.Literal('SECURITY_ORCHESTRATION_POLICY'),
  Schema.Literal('TRIGGER'),
  Schema.Literal('UNKNOWN'),
  Schema.Literal('WEB'),
  Schema.Literal('WEBIDE')
)
export const CiJobStatusSchema: Schema.Schema<CiJobStatus> = Schema.Union(
  Schema.Literal('CANCELED'),
  Schema.Literal('CANCELING'),
  Schema.Literal('CREATED'),
  Schema.Literal('FAILED'),
  Schema.Literal('MANUAL'),
  Schema.Literal('PENDING'),
  Schema.Literal('PREPARING'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SCHEDULED'),
  Schema.Literal('SKIPPED'),
  Schema.Literal('SUCCESS'),
  Schema.Literal('WAITING_FOR_CALLBACK'),
  Schema.Literal('WAITING_FOR_RESOURCE')
)
export const CiJobTokenScopeDirectionSchema: Schema.Schema<CiJobTokenScopeDirection> = Schema.Union(
  Schema.Literal('INBOUND'),
  Schema.Literal('OUTBOUND')
)
export const CiJobTokenScopePoliciesSchema: Schema.Schema<CiJobTokenScopePolicies> = Schema.Union(
  Schema.Literal('ADMIN_DEPLOYMENTS'),
  Schema.Literal('ADMIN_ENVIRONMENTS'),
  Schema.Literal('ADMIN_JOBS'),
  Schema.Literal('ADMIN_PACKAGES'),
  Schema.Literal('ADMIN_PIPELINES'),
  Schema.Literal('ADMIN_RELEASES'),
  Schema.Literal('ADMIN_SECURE_FILES'),
  Schema.Literal('ADMIN_TERRAFORM_STATE'),
  Schema.Literal('READ_DEPLOYMENTS'),
  Schema.Literal('READ_ENVIRONMENTS'),
  Schema.Literal('READ_JOBS'),
  Schema.Literal('READ_MERGE_REQUESTS'),
  Schema.Literal('READ_PACKAGES'),
  Schema.Literal('READ_PIPELINES'),
  Schema.Literal('READ_RELEASES'),
  Schema.Literal('READ_REPOSITORIES'),
  Schema.Literal('READ_SECURE_FILES'),
  Schema.Literal('READ_TERRAFORM_STATE'),
  Schema.Literal('READ_WORK_ITEMS')
)
export const CiPipelineCreationStatusSchema: Schema.Schema<CiPipelineCreationStatus> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('IN_PROGRESS'),
  Schema.Literal('SUCCEEDED')
)
export const CiPipelineSourcesSchema: Schema.Schema<CiPipelineSources> = Schema.Union(
  Schema.Literal('API'),
  Schema.Literal('CHAT'),
  Schema.Literal('CONTAINER_REGISTRY_PUSH'),
  Schema.Literal('DUO_WORKFLOW'),
  Schema.Literal('EXTERNAL'),
  Schema.Literal('EXTERNAL_PULL_REQUEST_EVENT'),
  Schema.Literal('MERGE_REQUEST_EVENT'),
  Schema.Literal('ONDEMAND_DAST_SCAN'),
  Schema.Literal('ONDEMAND_DAST_VALIDATION'),
  Schema.Literal('PARENT_PIPELINE'),
  Schema.Literal('PIPELINE'),
  Schema.Literal('PIPELINE_EXECUTION_POLICY_SCHEDULE'),
  Schema.Literal('PUSH'),
  Schema.Literal('SCHEDULE'),
  Schema.Literal('SECURITY_ORCHESTRATION_POLICY'),
  Schema.Literal('TRIGGER'),
  Schema.Literal('UNKNOWN'),
  Schema.Literal('WEB'),
  Schema.Literal('WEBIDE')
)
export const CiRunnerAccessLevelSchema: Schema.Schema<CiRunnerAccessLevel> = Schema.Union(
  Schema.Literal('NOT_PROTECTED'),
  Schema.Literal('REF_PROTECTED')
)
export const CiRunnerCloudProviderSchema: Schema.Schema<CiRunnerCloudProvider> = Schema.Union(
  Schema.Literal('GKE'),
  Schema.Literal('GOOGLE_CLOUD')
)
export const CiRunnerCreationMethodSchema: Schema.Schema<CiRunnerCreationMethod> = Schema.Union(
  Schema.Literal('AUTHENTICATED_USER'),
  Schema.Literal('REGISTRATION_TOKEN')
)
export const CiRunnerCreationStateSchema: Schema.Schema<CiRunnerCreationState> = Schema.Union(
  Schema.Literal('FINISHED'),
  Schema.Literal('STARTED')
)
export const CiRunnerJobExecutionStatusSchema: Schema.Schema<CiRunnerJobExecutionStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('IDLE')
)
export const CiRunnerMembershipFilterSchema: Schema.Schema<CiRunnerMembershipFilter> = Schema.Union(
  Schema.Literal('ALL_AVAILABLE'),
  Schema.Literal('DESCENDANTS'),
  Schema.Literal('DIRECT')
)
export const CiRunnerSortSchema: Schema.Schema<CiRunnerSort> = Schema.Union(
  Schema.Literal('CONTACTED_ASC'),
  Schema.Literal('CONTACTED_DESC'),
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('MOST_ACTIVE_DESC'),
  Schema.Literal('TOKEN_EXPIRES_AT_ASC'),
  Schema.Literal('TOKEN_EXPIRES_AT_DESC')
)
export const CiRunnerStatusSchema: Schema.Schema<CiRunnerStatus> = Schema.Union(
  Schema.Literal('NEVER_CONTACTED'),
  Schema.Literal('OFFLINE'),
  Schema.Literal('ONLINE'),
  Schema.Literal('STALE')
)
export const CiRunnerTypeSchema: Schema.Schema<CiRunnerType> = Schema.Union(
  Schema.Literal('GROUP_TYPE'),
  Schema.Literal('INSTANCE_TYPE'),
  Schema.Literal('PROJECT_TYPE')
)
export const CiRunnerUpgradeStatusSchema: Schema.Schema<CiRunnerUpgradeStatus> = Schema.Union(
  Schema.Literal('AVAILABLE'),
  Schema.Literal('INVALID'),
  Schema.Literal('NOT_AVAILABLE'),
  Schema.Literal('RECOMMENDED')
)
export const CiVariableSortSchema: Schema.Schema<CiVariableSort> = Schema.Union(
  Schema.Literal('KEY_ASC'),
  Schema.Literal('KEY_DESC')
)
export const CiVariableTypeSchema: Schema.Schema<CiVariableType> = Schema.Union(
  Schema.Literal('ENV_VAR'),
  Schema.Literal('FILE')
)
export const CodeFlowNodeTypeSchema: Schema.Schema<CodeFlowNodeType> = Schema.Union(
  Schema.Literal('PROPAGATION'),
  Schema.Literal('SINK'),
  Schema.Literal('SOURCE')
)
export const CodeQualityDegradationSeveritySchema: Schema.Schema<CodeQualityDegradationSeverity> = Schema.Union(
  Schema.Literal('BLOCKER'),
  Schema.Literal('CRITICAL'),
  Schema.Literal('INFO'),
  Schema.Literal('MAJOR'),
  Schema.Literal('MINOR'),
  Schema.Literal('UNKNOWN')
)
export const CodequalityReportsComparerReportGenerationStatusSchema: Schema.Schema<CodequalityReportsComparerReportGenerationStatus> = Schema.Union(
  Schema.Literal('ERROR'),
  Schema.Literal('PARSED'),
  Schema.Literal('PARSING')
)
export const CodequalityReportsComparerStatusSchema: Schema.Schema<CodequalityReportsComparerStatus> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('NOT_FOUND'),
  Schema.Literal('SUCCESS')
)
export const CommitActionModeSchema: Schema.Schema<CommitActionMode> = Schema.Union(
  Schema.Literal('CHMOD'),
  Schema.Literal('CREATE'),
  Schema.Literal('DELETE'),
  Schema.Literal('MOVE'),
  Schema.Literal('UPDATE')
)
export const CommitEncodingSchema: Schema.Schema<CommitEncoding> = Schema.Union(
  Schema.Literal('BASE64'),
  Schema.Literal('TEXT')
)
export const ComparableSecurityReportTypeSchema: Schema.Schema<ComparableSecurityReportType> = Schema.Union(
  Schema.Literal('API_FUZZING'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('SAST'),
  Schema.Literal('SECRET_DETECTION')
)
export const ComparisonOperatorSchema: Schema.Schema<ComparisonOperator> = Schema.Union(
  Schema.Literal('EQUAL_TO'),
  Schema.Literal('GREATER_THAN_OR_EQUAL_TO'),
  Schema.Literal('LESS_THAN_OR_EQUAL_TO')
)
export const ComplianceFrameworkPresenceFilterSchema: Schema.Schema<ComplianceFrameworkPresenceFilter> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const ComplianceFrameworkSortSchema: Schema.Schema<ComplianceFrameworkSort> = Schema.Union(
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATED_AT_ASC'),
  Schema.Literal('UPDATED_AT_DESC')
)
export const ComplianceStandardsAdherenceCheckNameSchema: Schema.Schema<ComplianceStandardsAdherenceCheckName> = Schema.Union(
  Schema.Literal('AT_LEAST_ONE_NON_AUTHOR_APPROVAL'),
  Schema.Literal('AT_LEAST_TWO_APPROVALS'),
  Schema.Literal('DAST'),
  Schema.Literal('PREVENT_APPROVAL_BY_MERGE_REQUEST_AUTHOR'),
  Schema.Literal('PREVENT_APPROVAL_BY_MERGE_REQUEST_COMMITTERS'),
  Schema.Literal('SAST')
)
export const ComplianceStandardsAdherenceStandardSchema: Schema.Schema<ComplianceStandardsAdherenceStandard> = Schema.Union(
  Schema.Literal('GITLAB'),
  Schema.Literal('SOC2')
)
export const ComplianceStandardsAdherenceStatusSchema: Schema.Schema<ComplianceStandardsAdherenceStatus> = Schema.Union(
  Schema.Literal('FAIL'),
  Schema.Literal('SUCCESS')
)
export const ComplianceViolationReasonSchema: Schema.Schema<ComplianceViolationReason> = Schema.Union(
  Schema.Literal('APPROVED_BY_COMMITTER'),
  Schema.Literal('APPROVED_BY_INSUFFICIENT_USERS'),
  Schema.Literal('APPROVED_BY_MERGE_REQUEST_AUTHOR')
)
export const ComplianceViolationSeveritySchema: Schema.Schema<ComplianceViolationSeverity> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('INFO'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM')
)
export const ComplianceViolationSortSchema: Schema.Schema<ComplianceViolationSort> = Schema.Union(
  Schema.Literal('MERGED_AT_ASC'),
  Schema.Literal('MERGED_AT_DESC'),
  Schema.Literal('MERGE_REQUEST_TITLE_ASC'),
  Schema.Literal('MERGE_REQUEST_TITLE_DESC'),
  Schema.Literal('SEVERITY_LEVEL_ASC'),
  Schema.Literal('SEVERITY_LEVEL_DESC'),
  Schema.Literal('VIOLATION_REASON_ASC'),
  Schema.Literal('VIOLATION_REASON_DESC')
)
export const ComplianceViolationStatusSchema: Schema.Schema<ComplianceViolationStatus> = Schema.Union(
  Schema.Literal('DETECTED'),
  Schema.Literal('DISMISSED'),
  Schema.Literal('IN_REVIEW'),
  Schema.Literal('RESOLVED')
)
export const ConanMetadatumFileTypeEnumSchema: Schema.Schema<ConanMetadatumFileTypeEnum> = Schema.Union(
  Schema.Literal('PACKAGE_FILE'),
  Schema.Literal('RECIPE_FILE')
)
export const ContactSortSchema: Schema.Schema<ContactSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('DESCRIPTION_ASC'),
  Schema.Literal('DESCRIPTION_DESC'),
  Schema.Literal('EMAIL_ASC'),
  Schema.Literal('EMAIL_DESC'),
  Schema.Literal('FIRST_NAME_ASC'),
  Schema.Literal('FIRST_NAME_DESC'),
  Schema.Literal('LAST_NAME_ASC'),
  Schema.Literal('LAST_NAME_DESC'),
  Schema.Literal('ORGANIZATION_ASC'),
  Schema.Literal('ORGANIZATION_DESC'),
  Schema.Literal('PHONE_ASC'),
  Schema.Literal('PHONE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const ContainerExpirationPolicyCadenceEnumSchema: Schema.Schema<ContainerExpirationPolicyCadenceEnum> = Schema.Union(
  Schema.Literal('EVERY_DAY'),
  Schema.Literal('EVERY_MONTH'),
  Schema.Literal('EVERY_THREE_MONTHS'),
  Schema.Literal('EVERY_TWO_WEEKS'),
  Schema.Literal('EVERY_WEEK')
)
export const ContainerExpirationPolicyKeepEnumSchema: Schema.Schema<ContainerExpirationPolicyKeepEnum> = Schema.Union(
  Schema.Literal('FIFTY_TAGS'),
  Schema.Literal('FIVE_TAGS'),
  Schema.Literal('ONE_HUNDRED_TAGS'),
  Schema.Literal('ONE_TAG'),
  Schema.Literal('TEN_TAGS'),
  Schema.Literal('TWENTY_FIVE_TAGS')
)
export const ContainerExpirationPolicyOlderThanEnumSchema: Schema.Schema<ContainerExpirationPolicyOlderThanEnum> = Schema.Union(
  Schema.Literal('FOURTEEN_DAYS'),
  Schema.Literal('NINETY_DAYS'),
  Schema.Literal('SEVEN_DAYS'),
  Schema.Literal('SIXTY_DAYS'),
  Schema.Literal('THIRTY_DAYS')
)
export const ContainerProtectionRepositoryRuleAccessLevelSchema: Schema.Schema<ContainerProtectionRepositoryRuleAccessLevel> = Schema.Union(
  Schema.Literal('ADMIN'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('OWNER')
)
export const ContainerProtectionTagRuleAccessLevelSchema: Schema.Schema<ContainerProtectionTagRuleAccessLevel> = Schema.Union(
  Schema.Literal('ADMIN'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('OWNER')
)
export const ContainerRepositoryCleanupStatusSchema: Schema.Schema<ContainerRepositoryCleanupStatus> = Schema.Union(
  Schema.Literal('ONGOING'),
  Schema.Literal('SCHEDULED'),
  Schema.Literal('UNFINISHED'),
  Schema.Literal('UNSCHEDULED')
)
export const ContainerRepositorySortSchema: Schema.Schema<ContainerRepositorySort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const ContainerRepositoryStatusSchema: Schema.Schema<ContainerRepositoryStatus> = Schema.Union(
  Schema.Literal('DELETE_FAILED'),
  Schema.Literal('DELETE_ONGOING'),
  Schema.Literal('DELETE_SCHEDULED')
)
export const ContainerRepositoryTagSortSchema: Schema.Schema<ContainerRepositoryTagSort> = Schema.Union(
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('PUBLISHED_AT_ASC'),
  Schema.Literal('PUBLISHED_AT_DESC')
)
export const CustomFieldTypeSchema: Schema.Schema<CustomFieldType> = Schema.Union(
  Schema.Literal('DATE'),
  Schema.Literal('MULTI_SELECT'),
  Schema.Literal('NUMBER'),
  Schema.Literal('SINGLE_SELECT'),
  Schema.Literal('TEXT')
)
export const CustomerRelationsContactStateSchema: Schema.Schema<CustomerRelationsContactState> = Schema.Union(
  Schema.Literal('active'),
  Schema.Literal('all'),
  Schema.Literal('inactive')
)
export const CustomerRelationsOrganizationStateSchema: Schema.Schema<CustomerRelationsOrganizationState> = Schema.Union(
  Schema.Literal('active'),
  Schema.Literal('all'),
  Schema.Literal('inactive')
)
export const CustomizableDashboardCategorySchema: Schema.Schema<CustomizableDashboardCategory> = Schema.Union(
  Schema.Literal('ANALYTICS')
)
export const CvssSeveritySchema: Schema.Schema<CvssSeverity> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('NONE')
)
export const DastPreScanVerificationCheckTypeSchema: Schema.Schema<DastPreScanVerificationCheckType> = Schema.Union(
  Schema.Literal('AUTHENTICATION'),
  Schema.Literal('CONNECTION'),
  Schema.Literal('CRAWLING')
)
export const DastPreScanVerificationStatusSchema: Schema.Schema<DastPreScanVerificationStatus> = Schema.Union(
  Schema.Literal('COMPLETE'),
  Schema.Literal('COMPLETE_WITH_ERRORS'),
  Schema.Literal('FAILED'),
  Schema.Literal('RUNNING')
)
export const DastProfileCadenceUnitSchema: Schema.Schema<DastProfileCadenceUnit> = Schema.Union(
  Schema.Literal('DAY'),
  Schema.Literal('MONTH'),
  Schema.Literal('WEEK'),
  Schema.Literal('YEAR')
)
export const DastScanMethodTypeSchema: Schema.Schema<DastScanMethodType> = Schema.Union(
  Schema.Literal('GRAPHQL'),
  Schema.Literal('HAR'),
  Schema.Literal('OPENAPI'),
  Schema.Literal('POSTMAN_COLLECTION'),
  Schema.Literal('WEBSITE')
)
export const DastScanTypeEnumSchema: Schema.Schema<DastScanTypeEnum> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('PASSIVE')
)
export const DastSiteProfileValidationStatusEnumSchema: Schema.Schema<DastSiteProfileValidationStatusEnum> = Schema.Union(
  Schema.Literal('FAILED_VALIDATION'),
  Schema.Literal('INPROGRESS_VALIDATION'),
  Schema.Literal('NONE'),
  Schema.Literal('PASSED_VALIDATION'),
  Schema.Literal('PENDING_VALIDATION')
)
export const DastSiteValidationStatusEnumSchema: Schema.Schema<DastSiteValidationStatusEnum> = Schema.Union(
  Schema.Literal('FAILED_VALIDATION'),
  Schema.Literal('INPROGRESS_VALIDATION'),
  Schema.Literal('PASSED_VALIDATION'),
  Schema.Literal('PENDING_VALIDATION')
)
export const DastSiteValidationStrategyEnumSchema: Schema.Schema<DastSiteValidationStrategyEnum> = Schema.Union(
  Schema.Literal('HEADER'),
  Schema.Literal('META_TAG'),
  Schema.Literal('TEXT_FILE')
)
export const DastTargetTypeEnumSchema: Schema.Schema<DastTargetTypeEnum> = Schema.Union(
  Schema.Literal('API'),
  Schema.Literal('WEBSITE')
)
export const DataVisualizationColorEnumSchema: Schema.Schema<DataVisualizationColorEnum> = Schema.Union(
  Schema.Literal('AQUA'),
  Schema.Literal('BLUE'),
  Schema.Literal('GREEN'),
  Schema.Literal('MAGENTA'),
  Schema.Literal('ORANGE')
)
export const DataVisualizationWeightEnumSchema: Schema.Schema<DataVisualizationWeightEnum> = Schema.Union(
  Schema.Literal('WEIGHT_50'),
  Schema.Literal('WEIGHT_100'),
  Schema.Literal('WEIGHT_200'),
  Schema.Literal('WEIGHT_300'),
  Schema.Literal('WEIGHT_400'),
  Schema.Literal('WEIGHT_500'),
  Schema.Literal('WEIGHT_600'),
  Schema.Literal('WEIGHT_700'),
  Schema.Literal('WEIGHT_800'),
  Schema.Literal('WEIGHT_900'),
  Schema.Literal('WEIGHT_950')
)
export const DependencyProxyManifestStatusSchema: Schema.Schema<DependencyProxyManifestStatus> = Schema.Union(
  Schema.Literal('DEFAULT'),
  Schema.Literal('ERROR'),
  Schema.Literal('PENDING_DESTRUCTION'),
  Schema.Literal('PROCESSING')
)
export const DependencySortSchema: Schema.Schema<DependencySort> = Schema.Union(
  Schema.Literal('LICENSE_ASC'),
  Schema.Literal('LICENSE_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('PACKAGER_ASC'),
  Schema.Literal('PACKAGER_DESC'),
  Schema.Literal('SEVERITY_ASC'),
  Schema.Literal('SEVERITY_DESC')
)
export const DeploymentApprovalSummaryStatusSchema: Schema.Schema<DeploymentApprovalSummaryStatus> = Schema.Union(
  Schema.Literal('APPROVED'),
  Schema.Literal('PENDING_APPROVAL'),
  Schema.Literal('REJECTED')
)
export const DeploymentStatusSchema: Schema.Schema<DeploymentStatus> = Schema.Union(
  Schema.Literal('BLOCKED'),
  Schema.Literal('CANCELED'),
  Schema.Literal('CREATED'),
  Schema.Literal('FAILED'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SKIPPED'),
  Schema.Literal('SUCCESS')
)
export const DeploymentTierSchema: Schema.Schema<DeploymentTier> = Schema.Union(
  Schema.Literal('DEVELOPMENT'),
  Schema.Literal('OTHER'),
  Schema.Literal('PRODUCTION'),
  Schema.Literal('STAGING'),
  Schema.Literal('TESTING')
)
export const DeploymentsApprovalStatusSchema: Schema.Schema<DeploymentsApprovalStatus> = Schema.Union(
  Schema.Literal('APPROVED'),
  Schema.Literal('REJECTED')
)
export const DesignCollectionCopyStateSchema: Schema.Schema<DesignCollectionCopyState> = Schema.Union(
  Schema.Literal('ERROR'),
  Schema.Literal('IN_PROGRESS'),
  Schema.Literal('READY')
)
export const DesignVersionEventSchema: Schema.Schema<DesignVersionEvent> = Schema.Union(
  Schema.Literal('CREATION'),
  Schema.Literal('DELETION'),
  Schema.Literal('MODIFICATION'),
  Schema.Literal('NONE')
)
export const DetailedMergeStatusSchema: Schema.Schema<DetailedMergeStatus> = Schema.Union(
  Schema.Literal('APPROVALS_SYNCING'),
  Schema.Literal('BLOCKED_STATUS'),
  Schema.Literal('CHECKING'),
  Schema.Literal('CI_MUST_PASS'),
  Schema.Literal('CI_STILL_RUNNING'),
  Schema.Literal('COMMITS_STATUS'),
  Schema.Literal('CONFLICT'),
  Schema.Literal('DISCUSSIONS_NOT_RESOLVED'),
  Schema.Literal('DRAFT_STATUS'),
  Schema.Literal('EXTERNAL_STATUS_CHECKS'),
  Schema.Literal('JIRA_ASSOCIATION'),
  Schema.Literal('LOCKED_LFS_FILES'),
  Schema.Literal('LOCKED_PATHS'),
  Schema.Literal('MERGEABLE'),
  Schema.Literal('MERGE_TIME'),
  Schema.Literal('NEED_REBASE'),
  Schema.Literal('NOT_APPROVED'),
  Schema.Literal('NOT_OPEN'),
  Schema.Literal('PREPARING'),
  Schema.Literal('REQUESTED_CHANGES'),
  Schema.Literal('SECURITY_POLICIES_VIOLATIONS'),
  Schema.Literal('TITLE_NOT_MATCHING'),
  Schema.Literal('UNCHECKED')
)
export const DiffPositionTypeSchema: Schema.Schema<DiffPositionType> = Schema.Union(
  Schema.Literal('file'),
  Schema.Literal('image'),
  Schema.Literal('text')
)
export const DismissalTypeSchema: Schema.Schema<DismissalType> = Schema.Union(
  Schema.Literal('EMERGENCY_HOT_FIX'),
  Schema.Literal('OTHER'),
  Schema.Literal('POLICY_FALSE_POSITIVE'),
  Schema.Literal('SCANNER_FALSE_POSITIVE')
)
export const DoraMetricBucketingIntervalSchema: Schema.Schema<DoraMetricBucketingInterval> = Schema.Union(
  Schema.Literal('ALL'),
  Schema.Literal('DAILY'),
  Schema.Literal('MONTHLY')
)
export const DuoWorkflowStatusSchema: Schema.Schema<DuoWorkflowStatus> = Schema.Union(
  Schema.Literal('CREATED'),
  Schema.Literal('FAILED'),
  Schema.Literal('FINISHED'),
  Schema.Literal('INPUT_REQUIRED'),
  Schema.Literal('PAUSED'),
  Schema.Literal('PLAN_APPROVAL_REQUIRED'),
  Schema.Literal('RUNNING'),
  Schema.Literal('STOPPED'),
  Schema.Literal('TOOL_CALL_APPROVAL_REQUIRED')
)
export const DuoWorkflowStatusGroupSchema: Schema.Schema<DuoWorkflowStatusGroup> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('AWAITING_INPUT'),
  Schema.Literal('CANCELED'),
  Schema.Literal('COMPLETED'),
  Schema.Literal('FAILED'),
  Schema.Literal('PAUSED')
)
export const DuoWorkflowsWorkflowSortSchema: Schema.Schema<DuoWorkflowsWorkflowSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('STATUS_ASC'),
  Schema.Literal('STATUS_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const EntryTypeSchema: Schema.Schema<EntryType> = Schema.Union(
  Schema.Literal('blob'),
  Schema.Literal('commit'),
  Schema.Literal('tree')
)
export const EpicSortSchema: Schema.Schema<EpicSort> = Schema.Union(
  Schema.Literal('CREATED_AT_ASC'),
  Schema.Literal('CREATED_AT_DESC'),
  Schema.Literal('END_DATE_ASC'),
  Schema.Literal('END_DATE_DESC'),
  Schema.Literal('START_DATE_ASC'),
  Schema.Literal('START_DATE_DESC'),
  Schema.Literal('TITLE_ASC'),
  Schema.Literal('TITLE_DESC'),
  Schema.Literal('UPDATED_AT_ASC'),
  Schema.Literal('UPDATED_AT_DESC'),
  Schema.Literal('end_date_asc'),
  Schema.Literal('end_date_desc'),
  Schema.Literal('start_date_asc'),
  Schema.Literal('start_date_desc')
)
export const EpicStateSchema: Schema.Schema<EpicState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('opened')
)
export const EpicStateEventSchema: Schema.Schema<EpicStateEvent> = Schema.Union(
  Schema.Literal('CLOSE'),
  Schema.Literal('REOPEN')
)
export const EpicWildcardIdSchema: Schema.Schema<EpicWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const ErrorTrackingStatusSchema: Schema.Schema<ErrorTrackingStatus> = Schema.Union(
  Schema.Literal('ERROR'),
  Schema.Literal('NOT_FOUND'),
  Schema.Literal('RETRY'),
  Schema.Literal('SUCCESS')
)
export const EscalationRuleStatusSchema: Schema.Schema<EscalationRuleStatus> = Schema.Union(
  Schema.Literal('ACKNOWLEDGED'),
  Schema.Literal('RESOLVED')
)
export const EventActionSchema: Schema.Schema<EventAction> = Schema.Union(
  Schema.Literal('APPROVED'),
  Schema.Literal('CLOSED'),
  Schema.Literal('COMMENTED'),
  Schema.Literal('CREATED'),
  Schema.Literal('DESTROYED'),
  Schema.Literal('EXPIRED'),
  Schema.Literal('JOINED'),
  Schema.Literal('LEFT'),
  Schema.Literal('MERGED'),
  Schema.Literal('PUSHED'),
  Schema.Literal('REOPENED'),
  Schema.Literal('UPDATED')
)
export const ExclusionScannerEnumSchema: Schema.Schema<ExclusionScannerEnum> = Schema.Union(
  Schema.Literal('SECRET_PUSH_PROTECTION')
)
export const ExclusionTypeEnumSchema: Schema.Schema<ExclusionTypeEnum> = Schema.Union(
  Schema.Literal('PATH'),
  Schema.Literal('RAW_VALUE'),
  Schema.Literal('REGEX_PATTERN'),
  Schema.Literal('RULE')
)
export const ExtensionsMarketplaceOptInStatusSchema: Schema.Schema<ExtensionsMarketplaceOptInStatus> = Schema.Union(
  Schema.Literal('DISABLED'),
  Schema.Literal('ENABLED'),
  Schema.Literal('UNSET')
)
export const FindingReportsComparerStatusSchema: Schema.Schema<FindingReportsComparerStatus> = Schema.Union(
  Schema.Literal('ERROR'),
  Schema.Literal('PARSED'),
  Schema.Literal('PARSING')
)
export const GeoRegistriesBulkActionSchema: Schema.Schema<GeoRegistriesBulkAction> = Schema.Union(
  Schema.Literal('RESYNC_ALL'),
  Schema.Literal('REVERIFY_ALL')
)
export const GeoRegistryActionSchema: Schema.Schema<GeoRegistryAction> = Schema.Union(
  Schema.Literal('RESYNC'),
  Schema.Literal('REVERIFY')
)
export const GeoRegistryClassSchema: Schema.Schema<GeoRegistryClass> = Schema.Union(
  Schema.Literal('CI_SECURE_FILE_REGISTRY'),
  Schema.Literal('CONTAINER_REPOSITORY_REGISTRY'),
  Schema.Literal('DEPENDENCY_PROXY_BLOB_REGISTRY'),
  Schema.Literal('DEPENDENCY_PROXY_MANIFEST_REGISTRY'),
  Schema.Literal('DESIGN_MANAGEMENT_REPOSITORY_REGISTRY'),
  Schema.Literal('GROUP_WIKI_REPOSITORY_REGISTRY'),
  Schema.Literal('JOB_ARTIFACT_REGISTRY'),
  Schema.Literal('LFS_OBJECT_REGISTRY'),
  Schema.Literal('MERGE_REQUEST_DIFF_REGISTRY'),
  Schema.Literal('PACKAGES_NUGET_SYMBOL_REGISTRY'),
  Schema.Literal('PACKAGE_FILE_REGISTRY'),
  Schema.Literal('PAGES_DEPLOYMENT_REGISTRY'),
  Schema.Literal('PIPELINE_ARTIFACT_REGISTRY'),
  Schema.Literal('PROJECT_REPOSITORY_REGISTRY'),
  Schema.Literal('PROJECT_WIKI_REPOSITORY_REGISTRY'),
  Schema.Literal('SNIPPET_REPOSITORY_REGISTRY'),
  Schema.Literal('TERRAFORM_STATE_VERSION_REGISTRY'),
  Schema.Literal('UPLOAD_REGISTRY')
)
export const GeoRegistrySortSchema: Schema.Schema<GeoRegistrySort> = Schema.Union(
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('LAST_SYNCED_AT_ASC'),
  Schema.Literal('LAST_SYNCED_AT_DESC'),
  Schema.Literal('VERIFIED_AT_ASC'),
  Schema.Literal('VERIFIED_AT_DESC')
)
export const GitlabSubscriptionsAddOnTypeSchema: Schema.Schema<GitlabSubscriptionsAddOnType> = Schema.Union(
  Schema.Literal('CODE_SUGGESTIONS'),
  Schema.Literal('DUO_AMAZON_Q'),
  Schema.Literal('DUO_CORE'),
  Schema.Literal('DUO_ENTERPRISE')
)
export const GitlabSubscriptionsUserRoleSchema: Schema.Schema<GitlabSubscriptionsUserRole> = Schema.Union(
  Schema.Literal('DEVELOPER'),
  Schema.Literal('GUEST'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('OWNER'),
  Schema.Literal('PLANNER'),
  Schema.Literal('REPORTER')
)
export const GitlabSubscriptionsUserSortSchema: Schema.Schema<GitlabSubscriptionsUserSort> = Schema.Union(
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('LAST_ACTIVITY_ON_ASC'),
  Schema.Literal('LAST_ACTIVITY_ON_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC')
)
export const GoogleCloudArtifactRegistryArtifactsSortSchema: Schema.Schema<GoogleCloudArtifactRegistryArtifactsSort> = Schema.Union(
  Schema.Literal('BUILD_TIME_ASC'),
  Schema.Literal('BUILD_TIME_DESC'),
  Schema.Literal('IMAGE_SIZE_BYTES_ASC'),
  Schema.Literal('IMAGE_SIZE_BYTES_DESC'),
  Schema.Literal('MEDIA_TYPE_ASC'),
  Schema.Literal('MEDIA_TYPE_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATE_TIME_ASC'),
  Schema.Literal('UPDATE_TIME_DESC'),
  Schema.Literal('UPLOAD_TIME_ASC'),
  Schema.Literal('UPLOAD_TIME_DESC')
)
export const GroupMemberRelationSchema: Schema.Schema<GroupMemberRelation> = Schema.Union(
  Schema.Literal('DESCENDANTS'),
  Schema.Literal('DIRECT'),
  Schema.Literal('INHERITED'),
  Schema.Literal('SHARED_FROM_GROUPS')
)
export const GroupPermissionSchema: Schema.Schema<GroupPermission> = Schema.Union(
  Schema.Literal('CREATE_PROJECTS'),
  Schema.Literal('IMPORT_PROJECTS'),
  Schema.Literal('TRANSFER_PROJECTS')
)
export const GroupReleaseSortSchema: Schema.Schema<GroupReleaseSort> = Schema.Union(
  Schema.Literal('RELEASED_AT_ASC'),
  Schema.Literal('RELEASED_AT_DESC')
)
export const GroupSecretsManagerStatusSchema: Schema.Schema<GroupSecretsManagerStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('DEPROVISIONING'),
  Schema.Literal('PROVISIONING')
)
export const GroupSortSchema: Schema.Schema<GroupSort> = Schema.Union(
  Schema.Literal('CREATED_AT_ASC'),
  Schema.Literal('CREATED_AT_DESC'),
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('PATH_ASC'),
  Schema.Literal('PATH_DESC'),
  Schema.Literal('SIMILARITY'),
  Schema.Literal('UPDATED_AT_ASC'),
  Schema.Literal('UPDATED_AT_DESC')
)
export const GroupingEnumSchema: Schema.Schema<GroupingEnum> = Schema.Union(
  Schema.Literal('INSTANCE_AGGREGATE'),
  Schema.Literal('PER_ROOT_NAMESPACE')
)
export const HealthStatusSchema: Schema.Schema<HealthStatus> = Schema.Union(
  Schema.Literal('atRisk'),
  Schema.Literal('needsAttention'),
  Schema.Literal('onTrack')
)
export const HealthStatusFilterSchema: Schema.Schema<HealthStatusFilter> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE'),
  Schema.Literal('atRisk'),
  Schema.Literal('needsAttention'),
  Schema.Literal('onTrack')
)
export const ImportSourceSchema: Schema.Schema<ImportSource> = Schema.Union(
  Schema.Literal('BITBUCKET'),
  Schema.Literal('BITBUCKET_SERVER'),
  Schema.Literal('CUSTOM_TEMPLATE'),
  Schema.Literal('FOGBUGZ'),
  Schema.Literal('GIT'),
  Schema.Literal('GITEA'),
  Schema.Literal('GITHUB'),
  Schema.Literal('GITLAB_GROUP'),
  Schema.Literal('GITLAB_MIGRATION'),
  Schema.Literal('GITLAB_PROJECT'),
  Schema.Literal('JIRA'),
  Schema.Literal('MANIFEST'),
  Schema.Literal('NONE')
)
export const ImportSourceUserStatusSchema: Schema.Schema<ImportSourceUserStatus> = Schema.Union(
  Schema.Literal('AWAITING_APPROVAL'),
  Schema.Literal('COMPLETED'),
  Schema.Literal('FAILED'),
  Schema.Literal('KEEP_AS_PLACEHOLDER'),
  Schema.Literal('PENDING_REASSIGNMENT'),
  Schema.Literal('REASSIGNMENT_IN_PROGRESS'),
  Schema.Literal('REJECTED')
)
export const IntegrationTypeSchema: Schema.Schema<IntegrationType> = Schema.Union(
  Schema.Literal('BEYOND_IDENTITY')
)
export const IssuableResourceLinkTypeSchema: Schema.Schema<IssuableResourceLinkType> = Schema.Union(
  Schema.Literal('general'),
  Schema.Literal('pagerduty'),
  Schema.Literal('slack'),
  Schema.Literal('zoom')
)
export const IssuableSearchableFieldSchema: Schema.Schema<IssuableSearchableField> = Schema.Union(
  Schema.Literal('DESCRIPTION'),
  Schema.Literal('TITLE')
)
export const IssuableSeveritySchema: Schema.Schema<IssuableSeverity> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('UNKNOWN')
)
export const IssuableStateSchema: Schema.Schema<IssuableState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('locked'),
  Schema.Literal('opened')
)
export const IssueCreationIterationWildcardIdSchema: Schema.Schema<IssueCreationIterationWildcardId> = Schema.Union(
  Schema.Literal('CURRENT')
)
export const IssueEscalationStatusSchema: Schema.Schema<IssueEscalationStatus> = Schema.Union(
  Schema.Literal('ACKNOWLEDGED'),
  Schema.Literal('IGNORED'),
  Schema.Literal('RESOLVED'),
  Schema.Literal('TRIGGERED')
)
export const IssueSortSchema: Schema.Schema<IssueSort> = Schema.Union(
  Schema.Literal('BLOCKING_ISSUES_ASC'),
  Schema.Literal('BLOCKING_ISSUES_DESC'),
  Schema.Literal('CLOSED_AT_ASC'),
  Schema.Literal('CLOSED_AT_DESC'),
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('DUE_DATE_ASC'),
  Schema.Literal('DUE_DATE_DESC'),
  Schema.Literal('ESCALATION_STATUS_ASC'),
  Schema.Literal('ESCALATION_STATUS_DESC'),
  Schema.Literal('HEALTH_STATUS_ASC'),
  Schema.Literal('HEALTH_STATUS_DESC'),
  Schema.Literal('LABEL_PRIORITY_ASC'),
  Schema.Literal('LABEL_PRIORITY_DESC'),
  Schema.Literal('MILESTONE_DUE_ASC'),
  Schema.Literal('MILESTONE_DUE_DESC'),
  Schema.Literal('POPULARITY_ASC'),
  Schema.Literal('POPULARITY_DESC'),
  Schema.Literal('PRIORITY_ASC'),
  Schema.Literal('PRIORITY_DESC'),
  Schema.Literal('PUBLISHED_ASC'),
  Schema.Literal('PUBLISHED_DESC'),
  Schema.Literal('RELATIVE_POSITION_ASC'),
  Schema.Literal('SEVERITY_ASC'),
  Schema.Literal('SEVERITY_DESC'),
  Schema.Literal('SLA_DUE_AT_ASC'),
  Schema.Literal('SLA_DUE_AT_DESC'),
  Schema.Literal('STATUS_ASC'),
  Schema.Literal('STATUS_DESC'),
  Schema.Literal('TITLE_ASC'),
  Schema.Literal('TITLE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('WEIGHT_ASC'),
  Schema.Literal('WEIGHT_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const IssueStateSchema: Schema.Schema<IssueState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('locked'),
  Schema.Literal('opened')
)
export const IssueStateEventSchema: Schema.Schema<IssueStateEvent> = Schema.Union(
  Schema.Literal('CLOSE'),
  Schema.Literal('REOPEN')
)
export const IssueTypeSchema: Schema.Schema<IssueType> = Schema.Union(
  Schema.Literal('EPIC'),
  Schema.Literal('INCIDENT'),
  Schema.Literal('ISSUE'),
  Schema.Literal('KEY_RESULT'),
  Schema.Literal('OBJECTIVE'),
  Schema.Literal('REQUIREMENT'),
  Schema.Literal('TASK'),
  Schema.Literal('TEST_CASE'),
  Schema.Literal('TICKET')
)
export const IterationSearchableFieldSchema: Schema.Schema<IterationSearchableField> = Schema.Union(
  Schema.Literal('CADENCE_TITLE'),
  Schema.Literal('TITLE')
)
export const IterationSortSchema: Schema.Schema<IterationSort> = Schema.Union(
  Schema.Literal('CADENCE_AND_DUE_DATE_ASC'),
  Schema.Literal('CADENCE_AND_DUE_DATE_DESC')
)
export const IterationStateSchema: Schema.Schema<IterationState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('current'),
  Schema.Literal('opened'),
  Schema.Literal('upcoming')
)
export const IterationWildcardIdSchema: Schema.Schema<IterationWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('CURRENT'),
  Schema.Literal('NONE')
)
export const JobArtifactFileTypeSchema: Schema.Schema<JobArtifactFileType> = Schema.Union(
  Schema.Literal('ACCESSIBILITY'),
  Schema.Literal('ANNOTATIONS'),
  Schema.Literal('API_FUZZING'),
  Schema.Literal('ARCHIVE'),
  Schema.Literal('BROWSER_PERFORMANCE'),
  Schema.Literal('CLUSTER_APPLICATIONS'),
  Schema.Literal('CLUSTER_IMAGE_SCANNING'),
  Schema.Literal('COBERTURA'),
  Schema.Literal('CODEQUALITY'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('CYCLONEDX'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('DOTENV'),
  Schema.Literal('JACOCO'),
  Schema.Literal('JUNIT'),
  Schema.Literal('LICENSE_SCANNING'),
  Schema.Literal('LOAD_PERFORMANCE'),
  Schema.Literal('LSIF'),
  Schema.Literal('METADATA'),
  Schema.Literal('METRICS'),
  Schema.Literal('METRICS_REFEREE'),
  Schema.Literal('NETWORK_REFEREE'),
  Schema.Literal('PERFORMANCE'),
  Schema.Literal('REPOSITORY_XRAY'),
  Schema.Literal('REQUIREMENTS'),
  Schema.Literal('REQUIREMENTS_V2'),
  Schema.Literal('SAST'),
  Schema.Literal('SCIP'),
  Schema.Literal('SECRET_DETECTION'),
  Schema.Literal('TERRAFORM'),
  Schema.Literal('TRACE')
)
export const LabelSearchFieldListSchema: Schema.Schema<LabelSearchFieldList> = Schema.Union(
  Schema.Literal('DESCRIPTION'),
  Schema.Literal('TITLE')
)
export const LdapAdminRoleSyncStatusSchema: Schema.Schema<LdapAdminRoleSyncStatus> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('NEVER_SYNCED'),
  Schema.Literal('QUEUED'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SUCCESSFUL')
)
export const ListLimitMetricSchema: Schema.Schema<ListLimitMetric> = Schema.Union(
  Schema.Literal('all_metrics'),
  Schema.Literal('issue_count'),
  Schema.Literal('issue_weights')
)
export const MeasurementIdentifierSchema: Schema.Schema<MeasurementIdentifier> = Schema.Union(
  Schema.Literal('GROUPS'),
  Schema.Literal('ISSUES'),
  Schema.Literal('MERGE_REQUESTS'),
  Schema.Literal('PIPELINES'),
  Schema.Literal('PIPELINES_CANCELED'),
  Schema.Literal('PIPELINES_FAILED'),
  Schema.Literal('PIPELINES_SKIPPED'),
  Schema.Literal('PIPELINES_SUCCEEDED'),
  Schema.Literal('PROJECTS'),
  Schema.Literal('USERS')
)
export const MemberAccessLevelSchema: Schema.Schema<MemberAccessLevel> = Schema.Union(
  Schema.Literal('DEVELOPER'),
  Schema.Literal('GUEST'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('MINIMAL_ACCESS'),
  Schema.Literal('OWNER'),
  Schema.Literal('PLANNER'),
  Schema.Literal('REPORTER')
)
export const MemberAccessLevelNameSchema: Schema.Schema<MemberAccessLevelName> = Schema.Union(
  Schema.Literal('DEVELOPER'),
  Schema.Literal('GUEST'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('OWNER'),
  Schema.Literal('PLANNER'),
  Schema.Literal('REPORTER')
)
export const MemberApprovalStatusTypeSchema: Schema.Schema<MemberApprovalStatusType> = Schema.Union(
  Schema.Literal('APPROVED'),
  Schema.Literal('DENIED'),
  Schema.Literal('PENDING')
)
export const MemberRoleAdminPermissionSchema: Schema.Schema<MemberRoleAdminPermission> = Schema.Union(
  Schema.Literal('READ_ADMIN_CICD'),
  Schema.Literal('READ_ADMIN_GROUPS'),
  Schema.Literal('READ_ADMIN_MONITORING'),
  Schema.Literal('READ_ADMIN_PROJECTS'),
  Schema.Literal('READ_ADMIN_SUBSCRIPTION'),
  Schema.Literal('READ_ADMIN_USERS')
)
export const MemberRolePermissionSchema: Schema.Schema<MemberRolePermission> = Schema.Union(
  Schema.Literal('ADMIN_CICD_VARIABLES'),
  Schema.Literal('ADMIN_COMPLIANCE_FRAMEWORK'),
  Schema.Literal('ADMIN_GROUP_MEMBER'),
  Schema.Literal('ADMIN_INTEGRATIONS'),
  Schema.Literal('ADMIN_MERGE_REQUEST'),
  Schema.Literal('ADMIN_PROTECTED_BRANCH'),
  Schema.Literal('ADMIN_PROTECTED_ENVIRONMENTS'),
  Schema.Literal('ADMIN_PUSH_RULES'),
  Schema.Literal('ADMIN_RUNNERS'),
  Schema.Literal('ADMIN_SECURITY_ATTRIBUTES'),
  Schema.Literal('ADMIN_SECURITY_TESTING'),
  Schema.Literal('ADMIN_TERRAFORM_STATE'),
  Schema.Literal('ADMIN_VULNERABILITY'),
  Schema.Literal('ADMIN_WEB_HOOK'),
  Schema.Literal('ARCHIVE_PROJECT'),
  Schema.Literal('MANAGE_DEPLOY_TOKENS'),
  Schema.Literal('MANAGE_GROUP_ACCESS_TOKENS'),
  Schema.Literal('MANAGE_MERGE_REQUEST_SETTINGS'),
  Schema.Literal('MANAGE_PROJECT_ACCESS_TOKENS'),
  Schema.Literal('MANAGE_PROTECTED_TAGS'),
  Schema.Literal('MANAGE_SECURITY_POLICY_LINK'),
  Schema.Literal('READ_ADMIN_CICD'),
  Schema.Literal('READ_ADMIN_GROUPS'),
  Schema.Literal('READ_ADMIN_MONITORING'),
  Schema.Literal('READ_ADMIN_PROJECTS'),
  Schema.Literal('READ_ADMIN_SUBSCRIPTION'),
  Schema.Literal('READ_ADMIN_USERS'),
  Schema.Literal('READ_CODE'),
  Schema.Literal('READ_COMPLIANCE_DASHBOARD'),
  Schema.Literal('READ_CRM_CONTACT'),
  Schema.Literal('READ_DEPENDENCY'),
  Schema.Literal('READ_RUNNERS'),
  Schema.Literal('READ_SECURITY_ATTRIBUTE'),
  Schema.Literal('READ_SECURITY_SCAN_PROFILES'),
  Schema.Literal('READ_VULNERABILITY'),
  Schema.Literal('REMOVE_GROUP'),
  Schema.Literal('REMOVE_PROJECT')
)
export const MemberRoleStandardPermissionSchema: Schema.Schema<MemberRoleStandardPermission> = Schema.Union(
  Schema.Literal('ADMIN_CICD_VARIABLES'),
  Schema.Literal('ADMIN_COMPLIANCE_FRAMEWORK'),
  Schema.Literal('ADMIN_GROUP_MEMBER'),
  Schema.Literal('ADMIN_INTEGRATIONS'),
  Schema.Literal('ADMIN_MERGE_REQUEST'),
  Schema.Literal('ADMIN_PROTECTED_BRANCH'),
  Schema.Literal('ADMIN_PROTECTED_ENVIRONMENTS'),
  Schema.Literal('ADMIN_PUSH_RULES'),
  Schema.Literal('ADMIN_RUNNERS'),
  Schema.Literal('ADMIN_SECURITY_ATTRIBUTES'),
  Schema.Literal('ADMIN_SECURITY_TESTING'),
  Schema.Literal('ADMIN_TERRAFORM_STATE'),
  Schema.Literal('ADMIN_VULNERABILITY'),
  Schema.Literal('ADMIN_WEB_HOOK'),
  Schema.Literal('ARCHIVE_PROJECT'),
  Schema.Literal('MANAGE_DEPLOY_TOKENS'),
  Schema.Literal('MANAGE_GROUP_ACCESS_TOKENS'),
  Schema.Literal('MANAGE_MERGE_REQUEST_SETTINGS'),
  Schema.Literal('MANAGE_PROJECT_ACCESS_TOKENS'),
  Schema.Literal('MANAGE_PROTECTED_TAGS'),
  Schema.Literal('MANAGE_SECURITY_POLICY_LINK'),
  Schema.Literal('READ_CODE'),
  Schema.Literal('READ_COMPLIANCE_DASHBOARD'),
  Schema.Literal('READ_CRM_CONTACT'),
  Schema.Literal('READ_DEPENDENCY'),
  Schema.Literal('READ_RUNNERS'),
  Schema.Literal('READ_SECURITY_ATTRIBUTE'),
  Schema.Literal('READ_SECURITY_SCAN_PROFILES'),
  Schema.Literal('READ_VULNERABILITY'),
  Schema.Literal('REMOVE_GROUP'),
  Schema.Literal('REMOVE_PROJECT')
)
export const MemberRolesAccessLevelSchema: Schema.Schema<MemberRolesAccessLevel> = Schema.Union(
  Schema.Literal('DEVELOPER'),
  Schema.Literal('GUEST'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('MINIMAL_ACCESS'),
  Schema.Literal('PLANNER'),
  Schema.Literal('REPORTER')
)
export const MemberRolesOrderBySchema: Schema.Schema<MemberRolesOrderBy> = Schema.Union(
  Schema.Literal('CREATED_AT'),
  Schema.Literal('ID'),
  Schema.Literal('NAME')
)
export const MemberSortSchema: Schema.Schema<MemberSort> = Schema.Union(
  Schema.Literal('ACCESS_LEVEL_ASC'),
  Schema.Literal('ACCESS_LEVEL_DESC'),
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('USER_FULL_NAME_ASC'),
  Schema.Literal('USER_FULL_NAME_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const MergeRequestNewStateSchema: Schema.Schema<MergeRequestNewState> = Schema.Union(
  Schema.Literal('CLOSED'),
  Schema.Literal('OPEN')
)
export const MergeRequestReviewStateSchema: Schema.Schema<MergeRequestReviewState> = Schema.Union(
  Schema.Literal('APPROVED'),
  Schema.Literal('REQUESTED_CHANGES'),
  Schema.Literal('REVIEWED'),
  Schema.Literal('REVIEW_STARTED'),
  Schema.Literal('UNAPPROVED'),
  Schema.Literal('UNREVIEWED')
)
export const MergeRequestSortSchema: Schema.Schema<MergeRequestSort> = Schema.Union(
  Schema.Literal('CLOSED_AT_ASC'),
  Schema.Literal('CLOSED_AT_DESC'),
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('LABEL_PRIORITY_ASC'),
  Schema.Literal('LABEL_PRIORITY_DESC'),
  Schema.Literal('MERGED_AT_ASC'),
  Schema.Literal('MERGED_AT_DESC'),
  Schema.Literal('MILESTONE_DUE_ASC'),
  Schema.Literal('MILESTONE_DUE_DESC'),
  Schema.Literal('POPULARITY_ASC'),
  Schema.Literal('POPULARITY_DESC'),
  Schema.Literal('PRIORITY_ASC'),
  Schema.Literal('PRIORITY_DESC'),
  Schema.Literal('TITLE_ASC'),
  Schema.Literal('TITLE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const MergeRequestStateSchema: Schema.Schema<MergeRequestState> = Schema.Union(
  Schema.Literal('all'),
  Schema.Literal('closed'),
  Schema.Literal('locked'),
  Schema.Literal('merged'),
  Schema.Literal('opened')
)
export const MergeRequestsDashboardListTypeSchema: Schema.Schema<MergeRequestsDashboardListType> = Schema.Union(
  Schema.Literal('ACTION_BASED'),
  Schema.Literal('ROLE_BASED')
)
export const MergeStatusSchema: Schema.Schema<MergeStatus> = Schema.Union(
  Schema.Literal('CANNOT_BE_MERGED'),
  Schema.Literal('CANNOT_BE_MERGED_RECHECK'),
  Schema.Literal('CAN_BE_MERGED'),
  Schema.Literal('CHECKING'),
  Schema.Literal('UNCHECKED')
)
export const MergeStrategyEnumSchema: Schema.Schema<MergeStrategyEnum> = Schema.Union(
  Schema.Literal('ADD_TO_MERGE_TRAIN_WHEN_CHECKS_PASS'),
  Schema.Literal('MERGE_TRAIN'),
  Schema.Literal('MERGE_WHEN_CHECKS_PASS')
)
export const MergeTrainStatusSchema: Schema.Schema<MergeTrainStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('COMPLETED')
)
export const MergeabilityCheckIdentifierSchema: Schema.Schema<MergeabilityCheckIdentifier> = Schema.Union(
  Schema.Literal('CI_MUST_PASS'),
  Schema.Literal('COMMITS_STATUS'),
  Schema.Literal('CONFLICT'),
  Schema.Literal('DISCUSSIONS_NOT_RESOLVED'),
  Schema.Literal('DRAFT_STATUS'),
  Schema.Literal('JIRA_ASSOCIATION_MISSING'),
  Schema.Literal('LOCKED_LFS_FILES'),
  Schema.Literal('LOCKED_PATHS'),
  Schema.Literal('MERGE_REQUEST_BLOCKED'),
  Schema.Literal('MERGE_TIME'),
  Schema.Literal('NEED_REBASE'),
  Schema.Literal('NOT_APPROVED'),
  Schema.Literal('NOT_OPEN'),
  Schema.Literal('REQUESTED_CHANGES'),
  Schema.Literal('SECURITY_POLICY_VIOLATIONS'),
  Schema.Literal('STATUS_CHECKS_MUST_PASS'),
  Schema.Literal('TITLE_REGEX')
)
export const MergeabilityCheckStatusSchema: Schema.Schema<MergeabilityCheckStatus> = Schema.Union(
  Schema.Literal('CHECKING'),
  Schema.Literal('FAILED'),
  Schema.Literal('INACTIVE'),
  Schema.Literal('SUCCESS'),
  Schema.Literal('WARNING')
)
export const MilestoneSortSchema: Schema.Schema<MilestoneSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('DUE_DATE_ASC'),
  Schema.Literal('DUE_DATE_DESC'),
  Schema.Literal('EXPIRED_LAST_DUE_DATE_ASC'),
  Schema.Literal('EXPIRED_LAST_DUE_DATE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const MilestoneStateEnumSchema: Schema.Schema<MilestoneStateEnum> = Schema.Union(
  Schema.Literal('active'),
  Schema.Literal('closed')
)
export const MilestoneWildcardIdSchema: Schema.Schema<MilestoneWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE'),
  Schema.Literal('STARTED'),
  Schema.Literal('UPCOMING')
)
export const MlModelVersionsOrderBySchema: Schema.Schema<MlModelVersionsOrderBy> = Schema.Union(
  Schema.Literal('CREATED_AT'),
  Schema.Literal('ID'),
  Schema.Literal('VERSION')
)
export const MlModelsOrderBySchema: Schema.Schema<MlModelsOrderBy> = Schema.Union(
  Schema.Literal('CREATED_AT'),
  Schema.Literal('ID'),
  Schema.Literal('NAME'),
  Schema.Literal('UPDATED_AT')
)
export const MoveTypeSchema: Schema.Schema<MoveType> = Schema.Union(
  Schema.Literal('after'),
  Schema.Literal('before')
)
export const MutationOperationModeSchema: Schema.Schema<MutationOperationMode> = Schema.Union(
  Schema.Literal('APPEND'),
  Schema.Literal('REMOVE'),
  Schema.Literal('REPLACE')
)
export const NamespaceClusterAgentFilterSchema: Schema.Schema<NamespaceClusterAgentFilter> = Schema.Union(
  Schema.Literal('ALL'),
  Schema.Literal('AVAILABLE'),
  Schema.Literal('DIRECTLY_MAPPED'),
  Schema.Literal('UNMAPPED')
)
export const NamespaceProjectSortSchema: Schema.Schema<NamespaceProjectSort> = Schema.Union(
  Schema.Literal('ACTIVITY_DESC'),
  Schema.Literal('BUILD_ARTIFACTS_SIZE_ASC'),
  Schema.Literal('BUILD_ARTIFACTS_SIZE_DESC'),
  Schema.Literal('CONTAINER_REGISTRY_SIZE_ASC'),
  Schema.Literal('CONTAINER_REGISTRY_SIZE_DESC'),
  Schema.Literal('EXCESS_REPO_STORAGE_SIZE_DESC'),
  Schema.Literal('FULL_PATH_ASC'),
  Schema.Literal('FULL_PATH_DESC'),
  Schema.Literal('LFS_OBJECTS_SIZE_ASC'),
  Schema.Literal('LFS_OBJECTS_SIZE_DESC'),
  Schema.Literal('PACKAGES_SIZE_ASC'),
  Schema.Literal('PACKAGES_SIZE_DESC'),
  Schema.Literal('PATH_ASC'),
  Schema.Literal('PATH_DESC'),
  Schema.Literal('REPOSITORY_SIZE_ASC'),
  Schema.Literal('REPOSITORY_SIZE_DESC'),
  Schema.Literal('SIMILARITY'),
  Schema.Literal('SNIPPETS_SIZE_ASC'),
  Schema.Literal('SNIPPETS_SIZE_DESC'),
  Schema.Literal('STORAGE_SIZE_ASC'),
  Schema.Literal('STORAGE_SIZE_DESC'),
  Schema.Literal('WIKI_SIZE_ASC'),
  Schema.Literal('WIKI_SIZE_DESC')
)
export const NegatedIterationWildcardIdSchema: Schema.Schema<NegatedIterationWildcardId> = Schema.Union(
  Schema.Literal('CURRENT')
)
export const NegatedMilestoneWildcardIdSchema: Schema.Schema<NegatedMilestoneWildcardId> = Schema.Union(
  Schema.Literal('STARTED'),
  Schema.Literal('UPCOMING')
)
export const NotesFilterTypeSchema: Schema.Schema<NotesFilterType> = Schema.Union(
  Schema.Literal('ALL_NOTES'),
  Schema.Literal('ONLY_ACTIVITY'),
  Schema.Literal('ONLY_COMMENTS')
)
export const OncallRotationUnitEnumSchema: Schema.Schema<OncallRotationUnitEnum> = Schema.Union(
  Schema.Literal('DAYS'),
  Schema.Literal('HOURS'),
  Schema.Literal('WEEKS')
)
export const OpenTelemetryMetricTypeSchema: Schema.Schema<OpenTelemetryMetricType> = Schema.Union(
  Schema.Literal('EXPONENTIAL_HISTOGRAM_TYPE'),
  Schema.Literal('GAUGE_TYPE'),
  Schema.Literal('HISTOGRAM_TYPE'),
  Schema.Literal('SUM_TYPE')
)
export const OrganizationClusterAgentFilterSchema: Schema.Schema<OrganizationClusterAgentFilter> = Schema.Union(
  Schema.Literal('ALL'),
  Schema.Literal('DIRECTLY_MAPPED')
)
export const OrganizationGroupProjectDisplaySchema: Schema.Schema<OrganizationGroupProjectDisplay> = Schema.Union(
  Schema.Literal('GROUPS'),
  Schema.Literal('PROJECTS')
)
export const OrganizationGroupProjectSortSchema: Schema.Schema<OrganizationGroupProjectSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const OrganizationSortSchema: Schema.Schema<OrganizationSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('DEFAULT_RATE_ASC'),
  Schema.Literal('DEFAULT_RATE_DESC'),
  Schema.Literal('DESCRIPTION_ASC'),
  Schema.Literal('DESCRIPTION_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const OrganizationUserAccessLevelSchema: Schema.Schema<OrganizationUserAccessLevel> = Schema.Union(
  Schema.Literal('DEFAULT'),
  Schema.Literal('OWNER')
)
export const PackageDependencyTypeSchema: Schema.Schema<PackageDependencyType> = Schema.Union(
  Schema.Literal('BUNDLE_DEPENDENCIES'),
  Schema.Literal('DEPENDENCIES'),
  Schema.Literal('DEV_DEPENDENCIES'),
  Schema.Literal('PEER_DEPENDENCIES')
)
export const PackageGroupSortSchema: Schema.Schema<PackageGroupSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('PROJECT_PATH_ASC'),
  Schema.Literal('PROJECT_PATH_DESC'),
  Schema.Literal('TYPE_ASC'),
  Schema.Literal('TYPE_DESC'),
  Schema.Literal('VERSION_ASC'),
  Schema.Literal('VERSION_DESC')
)
export const PackageManagerSchema: Schema.Schema<PackageManager> = Schema.Union(
  Schema.Literal('APK'),
  Schema.Literal('BUNDLER'),
  Schema.Literal('CARGO'),
  Schema.Literal('COMPOSER'),
  Schema.Literal('CONAN'),
  Schema.Literal('CONDA'),
  Schema.Literal('GO'),
  Schema.Literal('GRADLE'),
  Schema.Literal('MAVEN'),
  Schema.Literal('NPM'),
  Schema.Literal('NUGET'),
  Schema.Literal('PIP'),
  Schema.Literal('PIPENV'),
  Schema.Literal('PNPM'),
  Schema.Literal('POETRY'),
  Schema.Literal('PUB'),
  Schema.Literal('SBT'),
  Schema.Literal('SETUPTOOLS'),
  Schema.Literal('YARN')
)
export const PackageSortSchema: Schema.Schema<PackageSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('TYPE_ASC'),
  Schema.Literal('TYPE_DESC'),
  Schema.Literal('VERSION_ASC'),
  Schema.Literal('VERSION_DESC')
)
export const PackageStatusSchema: Schema.Schema<PackageStatus> = Schema.Union(
  Schema.Literal('DEFAULT'),
  Schema.Literal('DEPRECATED'),
  Schema.Literal('ERROR'),
  Schema.Literal('HIDDEN'),
  Schema.Literal('PENDING_DESTRUCTION'),
  Schema.Literal('PROCESSING')
)
export const PackageTypeEnumSchema: Schema.Schema<PackageTypeEnum> = Schema.Union(
  Schema.Literal('CARGO'),
  Schema.Literal('COMPOSER'),
  Schema.Literal('CONAN'),
  Schema.Literal('DEBIAN'),
  Schema.Literal('GENERIC'),
  Schema.Literal('GOLANG'),
  Schema.Literal('HELM'),
  Schema.Literal('MAVEN'),
  Schema.Literal('ML_MODEL'),
  Schema.Literal('NPM'),
  Schema.Literal('NUGET'),
  Schema.Literal('PYPI'),
  Schema.Literal('RPM'),
  Schema.Literal('RUBYGEMS'),
  Schema.Literal('TERRAFORM_MODULE')
)
export const PackagesCleanupKeepDuplicatedPackageFilesEnumSchema: Schema.Schema<PackagesCleanupKeepDuplicatedPackageFilesEnum> = Schema.Union(
  Schema.Literal('ALL_PACKAGE_FILES'),
  Schema.Literal('FIFTY_PACKAGE_FILES'),
  Schema.Literal('FORTY_PACKAGE_FILES'),
  Schema.Literal('ONE_PACKAGE_FILE'),
  Schema.Literal('TEN_PACKAGE_FILES'),
  Schema.Literal('THIRTY_PACKAGE_FILES'),
  Schema.Literal('TWENTY_PACKAGE_FILES')
)
export const PackagesProtectionRuleAccessLevelSchema: Schema.Schema<PackagesProtectionRuleAccessLevel> = Schema.Union(
  Schema.Literal('ADMIN'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('OWNER')
)
export const PackagesProtectionRuleAccessLevelForDeleteSchema: Schema.Schema<PackagesProtectionRuleAccessLevelForDelete> = Schema.Union(
  Schema.Literal('ADMIN'),
  Schema.Literal('OWNER')
)
export const PackagesProtectionRulePackageTypeSchema: Schema.Schema<PackagesProtectionRulePackageType> = Schema.Union(
  Schema.Literal('CONAN'),
  Schema.Literal('GENERIC'),
  Schema.Literal('HELM'),
  Schema.Literal('MAVEN'),
  Schema.Literal('NPM'),
  Schema.Literal('NUGET'),
  Schema.Literal('PYPI')
)
export const PermissionBoundarySchema: Schema.Schema<PermissionBoundary> = Schema.Union(
  Schema.Literal('GROUP'),
  Schema.Literal('INSTANCE'),
  Schema.Literal('PROJECT'),
  Schema.Literal('USER')
)
export const PipelineAnalyticsJobStatusSchema: Schema.Schema<PipelineAnalyticsJobStatus> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('FAILED'),
  Schema.Literal('OTHER'),
  Schema.Literal('SUCCESS')
)
export const PipelineConfigSourceEnumSchema: Schema.Schema<PipelineConfigSourceEnum> = Schema.Union(
  Schema.Literal('AUTO_DEVOPS_SOURCE'),
  Schema.Literal('BRIDGE_SOURCE'),
  Schema.Literal('COMPLIANCE_SOURCE'),
  Schema.Literal('EXTERNAL_PROJECT_SOURCE'),
  Schema.Literal('PARAMETER_SOURCE'),
  Schema.Literal('PIPELINE_EXECUTION_POLICY_FORCED'),
  Schema.Literal('REMOTE_SOURCE'),
  Schema.Literal('REPOSITORY_SOURCE'),
  Schema.Literal('SECURITY_POLICIES_DEFAULT_SOURCE'),
  Schema.Literal('UNKNOWN_SOURCE'),
  Schema.Literal('WEBIDE_SOURCE')
)
export const PipelineMergeRequestEventTypeSchema: Schema.Schema<PipelineMergeRequestEventType> = Schema.Union(
  Schema.Literal('DETACHED'),
  Schema.Literal('MERGED_RESULT'),
  Schema.Literal('MERGE_TRAIN')
)
export const PipelineScheduleSortSchema: Schema.Schema<PipelineScheduleSort> = Schema.Union(
  Schema.Literal('CREATED_AT_ASC'),
  Schema.Literal('CREATED_AT_DESC'),
  Schema.Literal('DESCRIPTION_ASC'),
  Schema.Literal('DESCRIPTION_DESC'),
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('NEXT_RUN_AT_ASC'),
  Schema.Literal('NEXT_RUN_AT_DESC'),
  Schema.Literal('REF_ASC'),
  Schema.Literal('REF_DESC'),
  Schema.Literal('UPDATED_AT_ASC'),
  Schema.Literal('UPDATED_AT_DESC')
)
export const PipelineScheduleStatusSchema: Schema.Schema<PipelineScheduleStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('INACTIVE')
)
export const PipelineScopeEnumSchema: Schema.Schema<PipelineScopeEnum> = Schema.Union(
  Schema.Literal('BRANCHES'),
  Schema.Literal('FINISHED'),
  Schema.Literal('PENDING'),
  Schema.Literal('RUNNING'),
  Schema.Literal('TAGS')
)
export const PipelineSecurityReportFindingSortSchema: Schema.Schema<PipelineSecurityReportFindingSort> = Schema.Union(
  Schema.Literal('severity_asc'),
  Schema.Literal('severity_desc')
)
export const PipelineStatusEnumSchema: Schema.Schema<PipelineStatusEnum> = Schema.Union(
  Schema.Literal('CANCELED'),
  Schema.Literal('CANCELING'),
  Schema.Literal('CREATED'),
  Schema.Literal('FAILED'),
  Schema.Literal('MANUAL'),
  Schema.Literal('PENDING'),
  Schema.Literal('PREPARING'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SCHEDULED'),
  Schema.Literal('SKIPPED'),
  Schema.Literal('SUCCESS'),
  Schema.Literal('WAITING_FOR_CALLBACK'),
  Schema.Literal('WAITING_FOR_RESOURCE')
)
export const PipelineVariablesDefaultRoleTypeSchema: Schema.Schema<PipelineVariablesDefaultRoleType> = Schema.Union(
  Schema.Literal('DEVELOPER'),
  Schema.Literal('MAINTAINER'),
  Schema.Literal('NO_ONE_ALLOWED'),
  Schema.Literal('OWNER')
)
export const PolicyEnforcementTypeSchema: Schema.Schema<PolicyEnforcementType> = Schema.Union(
  Schema.Literal('ENFORCE'),
  Schema.Literal('WARN')
)
export const PolicyProjectCreatedStatusSchema: Schema.Schema<PolicyProjectCreatedStatus> = Schema.Union(
  Schema.Literal('ERROR'),
  Schema.Literal('SUCCESS')
)
export const PolicyStatusSchema: Schema.Schema<PolicyStatus> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('RUNNING'),
  Schema.Literal('SCHEDULED')
)
export const PolicyTypeSchema: Schema.Schema<PolicyType> = Schema.Union(
  Schema.Literal('APPROVAL_POLICY'),
  Schema.Literal('PIPELINE_EXECUTION_POLICY'),
  Schema.Literal('PIPELINE_EXECUTION_SCHEDULE_POLICY'),
  Schema.Literal('SCAN_EXECUTION_POLICY'),
  Schema.Literal('VULNERABILITY_MANAGEMENT_POLICY')
)
export const PolicyViolationErrorTypeSchema: Schema.Schema<PolicyViolationErrorType> = Schema.Union(
  Schema.Literal('ARTIFACTS_MISSING'),
  Schema.Literal('SCAN_REMOVED'),
  Schema.Literal('UNKNOWN')
)
export const PolicyViolationStatusSchema: Schema.Schema<PolicyViolationStatus> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('RUNNING'),
  Schema.Literal('WARNING')
)
export const PolicyViolationsSchema: Schema.Schema<PolicyViolations> = Schema.Union(
  Schema.Literal('DISMISSED_IN_MR')
)
export const PrincipalTypeSchema: Schema.Schema<PrincipalType> = Schema.Union(
  Schema.Literal('GROUP'),
  Schema.Literal('MEMBER_ROLE'),
  Schema.Literal('ROLE'),
  Schema.Literal('USER')
)
export const ProductAnalyticsStateSchema: Schema.Schema<ProductAnalyticsState> = Schema.Union(
  Schema.Literal('COMPLETE'),
  Schema.Literal('CREATE_INSTANCE'),
  Schema.Literal('LOADING_INSTANCE'),
  Schema.Literal('WAITING_FOR_EVENTS')
)
export const ProjectArchivedSchema: Schema.Schema<ProjectArchived> = Schema.Union(
  Schema.Literal('EXCLUDE'),
  Schema.Literal('INCLUDE'),
  Schema.Literal('ONLY')
)
export const ProjectComplianceControlStatusSchema: Schema.Schema<ProjectComplianceControlStatus> = Schema.Union(
  Schema.Literal('FAIL'),
  Schema.Literal('PASS'),
  Schema.Literal('PENDING')
)
export const ProjectComplianceRequirementStatusOrderBySchema: Schema.Schema<ProjectComplianceRequirementStatusOrderBy> = Schema.Union(
  Schema.Literal('FRAMEWORK'),
  Schema.Literal('PROJECT'),
  Schema.Literal('REQUIREMENT')
)
export const ProjectFeatureAccessLevelSchema: Schema.Schema<ProjectFeatureAccessLevel> = Schema.Union(
  Schema.Literal('DISABLED'),
  Schema.Literal('ENABLED'),
  Schema.Literal('PRIVATE')
)
export const ProjectMemberRelationSchema: Schema.Schema<ProjectMemberRelation> = Schema.Union(
  Schema.Literal('DESCENDANTS'),
  Schema.Literal('DIRECT'),
  Schema.Literal('INHERITED'),
  Schema.Literal('INVITED_GROUPS'),
  Schema.Literal('SHARED_INTO_ANCESTORS')
)
export const ProjectSecretStatusSchema: Schema.Schema<ProjectSecretStatus> = Schema.Union(
  Schema.Literal('COMPLETED'),
  Schema.Literal('CREATE_IN_PROGRESS'),
  Schema.Literal('CREATE_STALE'),
  Schema.Literal('UPDATE_IN_PROGRESS'),
  Schema.Literal('UPDATE_STALE')
)
export const ProjectSecretsManagerStatusSchema: Schema.Schema<ProjectSecretsManagerStatus> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('DEPROVISIONING'),
  Schema.Literal('PROVISIONING')
)
export const ProjectSortSchema: Schema.Schema<ProjectSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('LATEST_ACTIVITY_ASC'),
  Schema.Literal('LATEST_ACTIVITY_DESC'),
  Schema.Literal('NAME_ASC'),
  Schema.Literal('NAME_DESC'),
  Schema.Literal('PATH_ASC'),
  Schema.Literal('PATH_DESC'),
  Schema.Literal('STARS_ASC'),
  Schema.Literal('STARS_DESC'),
  Schema.Literal('STORAGE_SIZE_ASC'),
  Schema.Literal('STORAGE_SIZE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const ProjectTrackedContextSchema: Schema.Schema<ProjectTrackedContext> = Schema.Union(
  Schema.Literal('BRANCH'),
  Schema.Literal('TAG')
)
export const ReachabilityTypeSchema: Schema.Schema<ReachabilityType> = Schema.Union(
  Schema.Literal('IN_USE'),
  Schema.Literal('NOT_FOUND'),
  Schema.Literal('UNKNOWN')
)
export const RefTypeSchema: Schema.Schema<RefType> = Schema.Union(
  Schema.Literal('HEADS'),
  Schema.Literal('TAGS')
)
export const RegistryStateSchema: Schema.Schema<RegistryState> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('PENDING'),
  Schema.Literal('STARTED'),
  Schema.Literal('SYNCED')
)
export const RelationshipTypeSchema: Schema.Schema<RelationshipType> = Schema.Union(
  Schema.Literal('DIRECT'),
  Schema.Literal('INHERITED')
)
export const RelativePositionTypeSchema: Schema.Schema<RelativePositionType> = Schema.Union(
  Schema.Literal('AFTER'),
  Schema.Literal('BEFORE')
)
export const ReleaseAssetLinkTypeSchema: Schema.Schema<ReleaseAssetLinkType> = Schema.Union(
  Schema.Literal('IMAGE'),
  Schema.Literal('OTHER'),
  Schema.Literal('PACKAGE'),
  Schema.Literal('RUNBOOK')
)
export const ReleaseSortSchema: Schema.Schema<ReleaseSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('RELEASED_AT_ASC'),
  Schema.Literal('RELEASED_AT_DESC')
)
export const ReleaseTagWildcardIdSchema: Schema.Schema<ReleaseTagWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const ReplicationStateEnumSchema: Schema.Schema<ReplicationStateEnum> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('PENDING'),
  Schema.Literal('STARTED'),
  Schema.Literal('SYNCED')
)
export const RequirementStateSchema: Schema.Schema<RequirementState> = Schema.Union(
  Schema.Literal('ARCHIVED'),
  Schema.Literal('OPENED')
)
export const RequirementStatusFilterSchema: Schema.Schema<RequirementStatusFilter> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('MISSING'),
  Schema.Literal('PASSED')
)
export const ResourceGroupsProcessModeSchema: Schema.Schema<ResourceGroupsProcessMode> = Schema.Union(
  Schema.Literal('NEWEST_FIRST'),
  Schema.Literal('NEWEST_READY_FIRST'),
  Schema.Literal('OLDEST_FIRST'),
  Schema.Literal('UNORDERED')
)
export const ReviewerWildcardIdSchema: Schema.Schema<ReviewerWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const RiskRatingSchema: Schema.Schema<RiskRating> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('UNKNOWN')
)
export const SastUiComponentSizeSchema: Schema.Schema<SastUiComponentSize> = Schema.Union(
  Schema.Literal('LARGE'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('SMALL')
)
export const SbomSourceTypeSchema: Schema.Schema<SbomSourceType> = Schema.Union(
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING_FOR_REGISTRY'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('NIL_SOURCE')
)
export const ScanModeEnumSchema: Schema.Schema<ScanModeEnum> = Schema.Union(
  Schema.Literal('ALL'),
  Schema.Literal('FULL'),
  Schema.Literal('PARTIAL')
)
export const ScanStatusSchema: Schema.Schema<ScanStatus> = Schema.Union(
  Schema.Literal('CREATED'),
  Schema.Literal('JOB_FAILED'),
  Schema.Literal('PREPARATION_FAILED'),
  Schema.Literal('PREPARING'),
  Schema.Literal('PURGED'),
  Schema.Literal('REPORT_ERROR'),
  Schema.Literal('SUCCEEDED')
)
export const SearchLevelSchema: Schema.Schema<SearchLevel> = Schema.Union(
  Schema.Literal('GLOBAL'),
  Schema.Literal('GROUP'),
  Schema.Literal('PROJECT')
)
export const SearchTypeSchema: Schema.Schema<SearchType> = Schema.Union(
  Schema.Literal('ADVANCED'),
  Schema.Literal('BASIC'),
  Schema.Literal('ZOEKT')
)
export const SecretRotationStatusSchema: Schema.Schema<SecretRotationStatus> = Schema.Union(
  Schema.Literal('APPROACHING'),
  Schema.Literal('OK'),
  Schema.Literal('OVERDUE')
)
export const SecretsManagementActionSchema: Schema.Schema<SecretsManagementAction> = Schema.Union(
  Schema.Literal('DELETE'),
  Schema.Literal('READ'),
  Schema.Literal('WRITE')
)
export const SecurityAttributeBulkUpdateModeSchema: Schema.Schema<SecurityAttributeBulkUpdateMode> = Schema.Union(
  Schema.Literal('ADD'),
  Schema.Literal('REMOVE'),
  Schema.Literal('REPLACE')
)
export const SecurityCategoryEditableStateSchema: Schema.Schema<SecurityCategoryEditableState> = Schema.Union(
  Schema.Literal('EDITABLE'),
  Schema.Literal('EDITABLE_ATTRIBUTES'),
  Schema.Literal('LOCKED')
)
export const SecurityCategoryTemplateTypeSchema: Schema.Schema<SecurityCategoryTemplateType> = Schema.Union(
  Schema.Literal('APPLICATION'),
  Schema.Literal('BUSINESS_IMPACT'),
  Schema.Literal('BUSINESS_UNIT'),
  Schema.Literal('EXPOSURE')
)
export const SecurityPolicyRelationTypeSchema: Schema.Schema<SecurityPolicyRelationType> = Schema.Union(
  Schema.Literal('DESCENDANT'),
  Schema.Literal('DIRECT'),
  Schema.Literal('INHERITED'),
  Schema.Literal('INHERITED_ONLY')
)
export const SecurityPreferredLicenseSourceConfigurationSchema: Schema.Schema<SecurityPreferredLicenseSourceConfiguration> = Schema.Union(
  Schema.Literal('PMDB'),
  Schema.Literal('SBOM')
)
export const SecurityReportTypeEnumSchema: Schema.Schema<SecurityReportTypeEnum> = Schema.Union(
  Schema.Literal('API_FUZZING'),
  Schema.Literal('CLUSTER_IMAGE_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('SAST'),
  Schema.Literal('SAST_ADVANCED'),
  Schema.Literal('SAST_IAC'),
  Schema.Literal('SECRET_DETECTION')
)
export const SecurityScanProfileTypeSchema: Schema.Schema<SecurityScanProfileType> = Schema.Union(
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('SAST'),
  Schema.Literal('SECRET_DETECTION')
)
export const SecurityScannerTypeSchema: Schema.Schema<SecurityScannerType> = Schema.Union(
  Schema.Literal('API_FUZZING'),
  Schema.Literal('CLUSTER_IMAGE_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('SAST'),
  Schema.Literal('SAST_ADVANCED'),
  Schema.Literal('SAST_IAC'),
  Schema.Literal('SECRET_DETECTION')
)
export const SentryErrorStatusSchema: Schema.Schema<SentryErrorStatus> = Schema.Union(
  Schema.Literal('IGNORED'),
  Schema.Literal('RESOLVED'),
  Schema.Literal('RESOLVED_IN_NEXT_RELEASE'),
  Schema.Literal('UNRESOLVED')
)
export const ServiceTypeSchema: Schema.Schema<ServiceType> = Schema.Union(
  Schema.Literal('APPLE_APP_STORE_SERVICE'),
  Schema.Literal('ASANA_SERVICE'),
  Schema.Literal('ASSEMBLA_SERVICE'),
  Schema.Literal('BAMBOO_SERVICE'),
  Schema.Literal('BUGZILLA_SERVICE'),
  Schema.Literal('BUILDKITE_SERVICE'),
  Schema.Literal('CAMPFIRE_SERVICE'),
  Schema.Literal('CLICKUP_SERVICE'),
  Schema.Literal('CONFLUENCE_SERVICE'),
  Schema.Literal('CUSTOM_ISSUE_TRACKER_SERVICE'),
  Schema.Literal('DATADOG_SERVICE'),
  Schema.Literal('DIFFBLUE_COVER_SERVICE'),
  Schema.Literal('DISCORD_SERVICE'),
  Schema.Literal('DRONE_CI_SERVICE'),
  Schema.Literal('EMAILS_ON_PUSH_SERVICE'),
  Schema.Literal('EWM_SERVICE'),
  Schema.Literal('EXTERNAL_WIKI_SERVICE'),
  Schema.Literal('GITHUB_SERVICE'),
  Schema.Literal('GITLAB_SLACK_APPLICATION_SERVICE'),
  Schema.Literal('GIT_GUARDIAN_SERVICE'),
  Schema.Literal('GOOGLE_CLOUD_PLATFORM_ARTIFACT_REGISTRY_SERVICE'),
  Schema.Literal('GOOGLE_CLOUD_PLATFORM_WORKLOAD_IDENTITY_FEDERATION_SERVICE'),
  Schema.Literal('GOOGLE_PLAY_SERVICE'),
  Schema.Literal('HANGOUTS_CHAT_SERVICE'),
  Schema.Literal('HARBOR_SERVICE'),
  Schema.Literal('IRKER_SERVICE'),
  Schema.Literal('JENKINS_SERVICE'),
  Schema.Literal('JIRA_CLOUD_APP_SERVICE'),
  Schema.Literal('JIRA_SERVICE'),
  Schema.Literal('LINEAR_SERVICE'),
  Schema.Literal('MATRIX_SERVICE'),
  Schema.Literal('MATTERMOST_SERVICE'),
  Schema.Literal('MATTERMOST_SLASH_COMMANDS_SERVICE'),
  Schema.Literal('MICROSOFT_TEAMS_SERVICE'),
  Schema.Literal('PACKAGIST_SERVICE'),
  Schema.Literal('PHORGE_SERVICE'),
  Schema.Literal('PIPELINES_EMAIL_SERVICE'),
  Schema.Literal('PIVOTALTRACKER_SERVICE'),
  Schema.Literal('PUMBLE_SERVICE'),
  Schema.Literal('PUSHOVER_SERVICE'),
  Schema.Literal('REDMINE_SERVICE'),
  Schema.Literal('SLACK_SERVICE'),
  Schema.Literal('SLACK_SLASH_COMMANDS_SERVICE'),
  Schema.Literal('SQUASH_TM_SERVICE'),
  Schema.Literal('TEAMCITY_SERVICE'),
  Schema.Literal('TELEGRAM_SERVICE'),
  Schema.Literal('UNIFY_CIRCUIT_SERVICE'),
  Schema.Literal('WEBEX_TEAMS_SERVICE'),
  Schema.Literal('YOUTRACK_SERVICE'),
  Schema.Literal('ZENTAO_SERVICE')
)
export const ShaFormatSchema: Schema.Schema<ShaFormat> = Schema.Union(
  Schema.Literal('LONG'),
  Schema.Literal('SHORT')
)
export const SharedRunnersSettingSchema: Schema.Schema<SharedRunnersSetting> = Schema.Union(
  Schema.Literal('DISABLED_AND_OVERRIDABLE'),
  Schema.Literal('DISABLED_AND_UNOVERRIDABLE'),
  Schema.Literal('ENABLED')
)
export const SnippetBlobActionEnumSchema: Schema.Schema<SnippetBlobActionEnum> = Schema.Union(
  Schema.Literal('create'),
  Schema.Literal('delete'),
  Schema.Literal('move'),
  Schema.Literal('update')
)
export const SortSchema: Schema.Schema<Sort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const SortDirectionEnumSchema: Schema.Schema<SortDirectionEnum> = Schema.Union(
  Schema.Literal('ASC'),
  Schema.Literal('DESC')
)
export const SourceUserSortSchema: Schema.Schema<SourceUserSort> = Schema.Union(
  Schema.Literal('ID_ASC'),
  Schema.Literal('ID_DESC'),
  Schema.Literal('SOURCE_NAME_ASC'),
  Schema.Literal('SOURCE_NAME_DESC'),
  Schema.Literal('STATUS_ASC'),
  Schema.Literal('STATUS_DESC')
)
export const SquashOptionSettingSchema: Schema.Schema<SquashOptionSetting> = Schema.Union(
  Schema.Literal('ALLOWED'),
  Schema.Literal('ALWAYS'),
  Schema.Literal('ENCOURAGED'),
  Schema.Literal('NEVER')
)
export const SubscriptionHistoryChangeTypeSchema: Schema.Schema<SubscriptionHistoryChangeType> = Schema.Union(
  Schema.Literal('GITLAB_SUBSCRIPTION_DESTROYED'),
  Schema.Literal('GITLAB_SUBSCRIPTION_UPDATED')
)
export const SubscriptionStatusSchema: Schema.Schema<SubscriptionStatus> = Schema.Union(
  Schema.Literal('EXPLICITLY_SUBSCRIBED'),
  Schema.Literal('EXPLICITLY_UNSUBSCRIBED')
)
export const TestCaseStatusSchema: Schema.Schema<TestCaseStatus> = Schema.Union(
  Schema.Literal('error'),
  Schema.Literal('failed'),
  Schema.Literal('skipped'),
  Schema.Literal('success')
)
export const TestReportStateSchema: Schema.Schema<TestReportState> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('PASSED')
)
export const TimeboxReportErrorReasonSchema: Schema.Schema<TimeboxReportErrorReason> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('LABEL_PRIORITY_ASC'),
  Schema.Literal('LABEL_PRIORITY_DESC'),
  Schema.Literal('MILESTONE_DUE_ASC'),
  Schema.Literal('MILESTONE_DUE_DESC'),
  Schema.Literal('MISSING_DATES'),
  Schema.Literal('PRIORITY_ASC'),
  Schema.Literal('PRIORITY_DESC'),
  Schema.Literal('TOO_MANY_EVENTS'),
  Schema.Literal('UNSUPPORTED'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const TimelogSortSchema: Schema.Schema<TimelogSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('SPENT_AT_ASC'),
  Schema.Literal('SPENT_AT_DESC'),
  Schema.Literal('TIME_SPENT_ASC'),
  Schema.Literal('TIME_SPENT_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const TodoActionEnumSchema: Schema.Schema<TodoActionEnum> = Schema.Union(
  Schema.Literal('added_approver'),
  Schema.Literal('approval_required'),
  Schema.Literal('assigned'),
  Schema.Literal('build_failed'),
  Schema.Literal('directly_addressed'),
  Schema.Literal('duo_core_access_granted'),
  Schema.Literal('duo_enterprise_access_granted'),
  Schema.Literal('duo_pro_access_granted'),
  Schema.Literal('marked'),
  Schema.Literal('member_access_requested'),
  Schema.Literal('mentioned'),
  Schema.Literal('merge_train_removed'),
  Schema.Literal('okr_checkin_requested'),
  Schema.Literal('review_requested'),
  Schema.Literal('review_submitted'),
  Schema.Literal('ssh_key_expired'),
  Schema.Literal('ssh_key_expiring_soon'),
  Schema.Literal('unmergeable')
)
export const TodoSortSchema: Schema.Schema<TodoSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('LABEL_PRIORITY_ASC'),
  Schema.Literal('LABEL_PRIORITY_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const TodoStateEnumSchema: Schema.Schema<TodoStateEnum> = Schema.Union(
  Schema.Literal('done'),
  Schema.Literal('pending')
)
export const TodoTargetEnumSchema: Schema.Schema<TodoTargetEnum> = Schema.Union(
  Schema.Literal('ALERT'),
  Schema.Literal('COMMIT'),
  Schema.Literal('COMPLIANCE_VIOLATION'),
  Schema.Literal('DESIGN'),
  Schema.Literal('EPIC'),
  Schema.Literal('ISSUE'),
  Schema.Literal('KEY'),
  Schema.Literal('MERGEREQUEST'),
  Schema.Literal('NAMESPACE'),
  Schema.Literal('PROJECT'),
  Schema.Literal('USER'),
  Schema.Literal('VULNERABILITY'),
  Schema.Literal('WIKIPAGEMETA'),
  Schema.Literal('WORKITEM')
)
export const TrainingUrlRequestStatusSchema: Schema.Schema<TrainingUrlRequestStatus> = Schema.Union(
  Schema.Literal('COMPLETED'),
  Schema.Literal('PENDING')
)
export const TypeEnumSchema: Schema.Schema<TypeEnum> = Schema.Union(
  Schema.Literal('personal'),
  Schema.Literal('project')
)
export const UserCalloutFeatureNameEnumSchema: Schema.Schema<UserCalloutFeatureNameEnum> = Schema.Union(
  Schema.Literal('ACTIVE_USER_COUNT_THRESHOLD'),
  Schema.Literal('AI_EXPERIMENT_SAST_FP_DETECTION'),
  Schema.Literal('BRANCH_RULES_INFO_CALLOUT'),
  Schema.Literal('BRANCH_RULES_TIP_CALLOUT'),
  Schema.Literal('BUY_PIPELINE_MINUTES_NOTIFICATION_DOT'),
  Schema.Literal('CANARY_DEPLOYMENT'),
  Schema.Literal('CI_DEPRECATION_WARNING_FOR_TYPES_KEYWORD'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_DANGER_STAGE'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_EXCEEDED_STAGE'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_WARNING_STAGE'),
  Schema.Literal('CLUSTER_SECURITY_WARNING'),
  Schema.Literal('DEPLOYMENT_APPROVALS_EMPTY_STATE'),
  Schema.Literal('DEPLOYMENT_DETAILS_FEEDBACK'),
  Schema.Literal('DORA_DASHBOARD_MIGRATION_GROUP'),
  Schema.Literal('DORA_DASHBOARD_MIGRATION_PROJECT'),
  Schema.Literal('DUO_AMAZON_Q_ALERT'),
  Schema.Literal('DUO_CHAT_CALLOUT'),
  Schema.Literal('EMAIL_OTP_ENROLLMENT_CALLOUT'),
  Schema.Literal('EXPIRED_TRIAL_STATUS_WIDGET'),
  Schema.Literal('EXPLORE_DUO_CORE_BANNER'),
  Schema.Literal('FEATURE_FLAGS_NEW_VERSION'),
  Schema.Literal('FOCUSED_VULNERABILITY_REPORTING'),
  Schema.Literal('GCP_SIGNUP_OFFER'),
  Schema.Literal('GEO_ENABLE_HASHED_STORAGE'),
  Schema.Literal('GEO_MIGRATE_HASHED_STORAGE'),
  Schema.Literal('GKE_CLUSTER_INTEGRATION'),
  Schema.Literal('GOLD_TRIAL_BILLINGS'),
  Schema.Literal('JOINING_A_PROJECT_ALERT'),
  Schema.Literal('MERGE_REQUEST_DASHBOARD_DISPLAY_PREFERENCES_POPOVER'),
  Schema.Literal('MERGE_REQUEST_DASHBOARD_SHOW_DRAFTS'),
  Schema.Literal('NAMESPACE_OVER_STORAGE_USERS_COMBINED_ALERT'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_ALERT_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_ERROR_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_WARNING_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_PRE_ENFORCEMENT_BANNER'),
  Schema.Literal('NEW_MERGE_REQUEST_DASHBOARD_WELCOME'),
  Schema.Literal('NEW_MR_DASHBOARD_BANNER'),
  Schema.Literal('NEW_TOP_LEVEL_GROUP_ALERT'),
  Schema.Literal('NEW_USER_SIGNUPS_CAP_REACHED'),
  Schema.Literal('OPENSSL_CALLOUT'),
  Schema.Literal('PERIOD_IN_TERRAFORM_STATE_NAME_ALERT'),
  Schema.Literal('PERSONAL_ACCESS_TOKEN_EXPIRY'),
  Schema.Literal('PERSONAL_HOMEPAGE_PREFERENCES_BANNER'),
  Schema.Literal('PERSONAL_PROJECT_LIMITATIONS_BANNER'),
  Schema.Literal('PIPELINE_INPUTS_ANNOUNCEMENT_BANNER'),
  Schema.Literal('PIPELINE_NEEDS_BANNER'),
  Schema.Literal('PIPELINE_NEEDS_HOVER_TIP'),
  Schema.Literal('PIPELINE_NEW_INPUTS_ADOPTION_BANNER'),
  Schema.Literal('PIPELINE_SCHEDULES_INPUTS_ADOPTION_BANNER'),
  Schema.Literal('PIPL_COMPLIANCE_ALERT'),
  Schema.Literal('PREVIEW_USER_OVER_LIMIT_FREE_PLAN_ALERT'),
  Schema.Literal('PRODUCT_USAGE_DATA_COLLECTION_CHANGES'),
  Schema.Literal('PROFILE_PERSONAL_ACCESS_TOKEN_EXPIRY'),
  Schema.Literal('PROJECT_REPOSITORY_LIMIT_ALERT_WARNING_THRESHOLD'),
  Schema.Literal('REGISTRATION_ENABLED_CALLOUT'),
  Schema.Literal('SECURITY_CONFIGURATION_DEVOPS_ALERT'),
  Schema.Literal('SECURITY_CONFIGURATION_UPGRADE_BANNER'),
  Schema.Literal('SECURITY_NEWSLETTER_CALLOUT'),
  Schema.Literal('SECURITY_POLICY_PROTECTED_BRANCH_MODIFICATION'),
  Schema.Literal('SECURITY_TRAINING_FEATURE_PROMOTION'),
  Schema.Literal('SUBMIT_LICENSE_USAGE_DATA_BANNER'),
  Schema.Literal('SUGGEST_PIPELINE'),
  Schema.Literal('SUGGEST_POPOVER_DISMISSED'),
  Schema.Literal('TABS_POSITION_HIGHLIGHT'),
  Schema.Literal('TERRAFORM_NOTIFICATION_DISMISSED'),
  Schema.Literal('THREAT_MONITORING_INFO'),
  Schema.Literal('TRANSITION_TO_JIHU_CALLOUT'),
  Schema.Literal('TRIAL_STATUS_REMINDER_D3'),
  Schema.Literal('TRIAL_STATUS_REMINDER_D14'),
  Schema.Literal('TWO_FACTOR_AUTH_RECOVERY_SETTINGS_CHECK'),
  Schema.Literal('ULTIMATE_TRIAL'),
  Schema.Literal('UNFINISHED_TAG_CLEANUP_CALLOUT'),
  Schema.Literal('USER_REACHED_LIMIT_FREE_PLAN_ALERT'),
  Schema.Literal('VERIFICATION_REMINDER'),
  Schema.Literal('VSD_FEEDBACK_BANNER'),
  Schema.Literal('VULNERABILITY_ARCHIVAL'),
  Schema.Literal('VULNERABILITY_REPORT_GROUPING'),
  Schema.Literal('VULNERABILITY_REPORT_LIMITED_EXPERIENCE'),
  Schema.Literal('WEB_IDE_ALERT_DISMISSED'),
  Schema.Literal('WEB_IDE_CI_ENVIRONMENTS_GUIDANCE'),
  Schema.Literal('WORK_ITEM_CONSOLIDATED_LIST_FEEDBACK'),
  Schema.Literal('WORK_ITEM_EPIC_FEEDBACK')
)
export const UserGroupCalloutFeatureNameSchema: Schema.Schema<UserGroupCalloutFeatureName> = Schema.Union(
  Schema.Literal('ALL_SEATS_USED_ALERT'),
  Schema.Literal('APPROACHING_SEAT_COUNT_THRESHOLD'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_DANGER_STAGE'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_EXCEEDED_STAGE'),
  Schema.Literal('CI_MINUTES_LIMIT_ALERT_WARNING_STAGE'),
  Schema.Literal('COMPLIANCE_FRAMEWORK_SETTINGS_MOVED_CALLOUT'),
  Schema.Literal('ENFORCEMENT_AT_LIMIT_ALERT'),
  Schema.Literal('EXPIRED_DUO_ENTERPRISE_TRIAL_WIDGET'),
  Schema.Literal('EXPIRED_DUO_PRO_TRIAL_WIDGET'),
  Schema.Literal('EXPIRED_TRIAL_STATUS_WIDGET'),
  Schema.Literal('FREE_GROUP_LIMITED_ALERT'),
  Schema.Literal('INVITE_MEMBERS_BANNER'),
  Schema.Literal('MRS_PREMIUM_MESSAGE_CALLOUT'),
  Schema.Literal('NAMESPACE_OVER_STORAGE_USERS_COMBINED_ALERT'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_ALERT_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_ERROR_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_LIMIT_ALERT_WARNING_THRESHOLD'),
  Schema.Literal('NAMESPACE_STORAGE_PRE_ENFORCEMENT_BANNER'),
  Schema.Literal('NAMESPACE_USER_CAP_REACHED_ALERT'),
  Schema.Literal('PREVIEW_USAGE_QUOTA_FREE_PLAN_ALERT'),
  Schema.Literal('PREVIEW_USER_OVER_LIMIT_FREE_PLAN_ALERT'),
  Schema.Literal('PROJECT_PREMIUM_MESSAGE_CALLOUT'),
  Schema.Literal('PROJECT_REPOSITORY_LIMIT_ALERT_WARNING_THRESHOLD'),
  Schema.Literal('REPOSITORY_PREMIUM_MESSAGE_CALLOUT'),
  Schema.Literal('UNLIMITED_MEMBERS_DURING_TRIAL_ALERT'),
  Schema.Literal('USAGE_QUOTA_TRIAL_ALERT'),
  Schema.Literal('USER_REACHED_LIMIT_FREE_PLAN_ALERT'),
  Schema.Literal('VIRTUAL_REGISTRY_PERMISSION_CHANGE_ALERT'),
  Schema.Literal('WEB_HOOK_DISABLED')
)
export const UserPromotionStatusTypeSchema: Schema.Schema<UserPromotionStatusType> = Schema.Union(
  Schema.Literal('FAILED'),
  Schema.Literal('PARTIAL_SUCCESS'),
  Schema.Literal('SUCCESS')
)
export const UserStateSchema: Schema.Schema<UserState> = Schema.Union(
  Schema.Literal('active'),
  Schema.Literal('banned'),
  Schema.Literal('blocked'),
  Schema.Literal('blocked_pending_approval'),
  Schema.Literal('deactivated'),
  Schema.Literal('ldap_blocked')
)
export const UserTypeSchema: Schema.Schema<UserType> = Schema.Union(
  Schema.Literal('ADMIN_BOT'),
  Schema.Literal('ALERT_BOT'),
  Schema.Literal('AUTOMATION_BOT'),
  Schema.Literal('DUO_CODE_REVIEW_BOT'),
  Schema.Literal('GHOST'),
  Schema.Literal('HUMAN'),
  Schema.Literal('IMPORT_USER'),
  Schema.Literal('PLACEHOLDER'),
  Schema.Literal('PROJECT_BOT'),
  Schema.Literal('SECURITY_BOT'),
  Schema.Literal('SECURITY_POLICY_BOT'),
  Schema.Literal('SERVICE_ACCOUNT'),
  Schema.Literal('SERVICE_USER'),
  Schema.Literal('SUPPORT_BOT'),
  Schema.Literal('VISUAL_REVIEW_BOT')
)
export const ValueStreamDashboardMetricSchema: Schema.Schema<ValueStreamDashboardMetric> = Schema.Union(
  Schema.Literal('CONTRIBUTORS'),
  Schema.Literal('GROUPS'),
  Schema.Literal('ISSUES'),
  Schema.Literal('MERGE_REQUESTS'),
  Schema.Literal('PIPELINES'),
  Schema.Literal('PROJECTS'),
  Schema.Literal('USERS')
)
export const ValueStreamDashboardProjectLevelMetricSchema: Schema.Schema<ValueStreamDashboardProjectLevelMetric> = Schema.Union(
  Schema.Literal('CONTRIBUTORS'),
  Schema.Literal('ISSUES'),
  Schema.Literal('MERGE_REQUESTS'),
  Schema.Literal('PIPELINES')
)
export const ValueStreamStageEventSchema: Schema.Schema<ValueStreamStageEvent> = Schema.Union(
  Schema.Literal('CODE_STAGE_START'),
  Schema.Literal('ISSUE_CLOSED'),
  Schema.Literal('ISSUE_CREATED'),
  Schema.Literal('ISSUE_DEPLOYED_TO_PRODUCTION'),
  Schema.Literal('ISSUE_FIRST_ADDED_TO_BOARD'),
  Schema.Literal('ISSUE_FIRST_ADDED_TO_ITERATION'),
  Schema.Literal('ISSUE_FIRST_ASSIGNED_AT'),
  Schema.Literal('ISSUE_FIRST_ASSOCIATED_WITH_MILESTONE'),
  Schema.Literal('ISSUE_FIRST_MENTIONED_IN_COMMIT'),
  Schema.Literal('ISSUE_LABEL_ADDED'),
  Schema.Literal('ISSUE_LABEL_REMOVED'),
  Schema.Literal('ISSUE_LAST_EDITED'),
  Schema.Literal('ISSUE_STAGE_END'),
  Schema.Literal('MERGE_REQUEST_CLOSED'),
  Schema.Literal('MERGE_REQUEST_CREATED'),
  Schema.Literal('MERGE_REQUEST_FIRST_ASSIGNED_AT'),
  Schema.Literal('MERGE_REQUEST_FIRST_COMMIT_AT'),
  Schema.Literal('MERGE_REQUEST_FIRST_DEPLOYED_TO_PRODUCTION'),
  Schema.Literal('MERGE_REQUEST_LABEL_ADDED'),
  Schema.Literal('MERGE_REQUEST_LABEL_REMOVED'),
  Schema.Literal('MERGE_REQUEST_LAST_APPROVED_AT'),
  Schema.Literal('MERGE_REQUEST_LAST_BUILD_FINISHED'),
  Schema.Literal('MERGE_REQUEST_LAST_BUILD_STARTED'),
  Schema.Literal('MERGE_REQUEST_LAST_EDITED'),
  Schema.Literal('MERGE_REQUEST_MERGED'),
  Schema.Literal('MERGE_REQUEST_REVIEWER_FIRST_ASSIGNED'),
  Schema.Literal('PLAN_STAGE_START')
)
export const ValueStreamStageItemSortSchema: Schema.Schema<ValueStreamStageItemSort> = Schema.Union(
  Schema.Literal('DURATION_ASC'),
  Schema.Literal('DURATION_DESC'),
  Schema.Literal('END_EVENT_ASC'),
  Schema.Literal('END_EVENT_DESC')
)
export const VerificationStateEnumSchema: Schema.Schema<VerificationStateEnum> = Schema.Union(
  Schema.Literal('DISABLED'),
  Schema.Literal('FAILED'),
  Schema.Literal('PENDING'),
  Schema.Literal('STARTED'),
  Schema.Literal('SUCCEEDED')
)
export const VerificationStatusSchema: Schema.Schema<VerificationStatus> = Schema.Union(
  Schema.Literal('MULTIPLE_SIGNATURES'),
  Schema.Literal('OTHER_USER'),
  Schema.Literal('REVOKED_KEY'),
  Schema.Literal('SAME_USER_DIFFERENT_EMAIL'),
  Schema.Literal('UNKNOWN_KEY'),
  Schema.Literal('UNVERIFIED'),
  Schema.Literal('UNVERIFIED_AUTHOR_EMAIL'),
  Schema.Literal('UNVERIFIED_KEY'),
  Schema.Literal('VERIFIED'),
  Schema.Literal('VERIFIED_CA'),
  Schema.Literal('VERIFIED_SYSTEM')
)
export const VisibilityLevelsEnumSchema: Schema.Schema<VisibilityLevelsEnum> = Schema.Union(
  Schema.Literal('internal'),
  Schema.Literal('private'),
  Schema.Literal('public')
)
export const VisibilityPipelineIdTypeSchema: Schema.Schema<VisibilityPipelineIdType> = Schema.Union(
  Schema.Literal('ID'),
  Schema.Literal('IID')
)
export const VisibilityScopesEnumSchema: Schema.Schema<VisibilityScopesEnum> = Schema.Union(
  Schema.Literal('internal'),
  Schema.Literal('private'),
  Schema.Literal('public')
)
export const VulnerabilityDismissalReasonSchema: Schema.Schema<VulnerabilityDismissalReason> = Schema.Union(
  Schema.Literal('ACCEPTABLE_RISK'),
  Schema.Literal('FALSE_POSITIVE'),
  Schema.Literal('MITIGATING_CONTROL'),
  Schema.Literal('NOT_APPLICABLE'),
  Schema.Literal('USED_IN_TESTS')
)
export const VulnerabilityExternalIssueLinkExternalTrackerSchema: Schema.Schema<VulnerabilityExternalIssueLinkExternalTracker> = Schema.Union(
  Schema.Literal('JIRA')
)
export const VulnerabilityExternalIssueLinkTypeSchema: Schema.Schema<VulnerabilityExternalIssueLinkType> = Schema.Union(
  Schema.Literal('CREATED')
)
export const VulnerabilityFalsePositiveDetectionStatusSchema: Schema.Schema<VulnerabilityFalsePositiveDetectionStatus> = Schema.Union(
  Schema.Literal('DETECTED_AS_FP'),
  Schema.Literal('DETECTED_AS_NOT_FP'),
  Schema.Literal('FAILED'),
  Schema.Literal('IN_PROGRESS'),
  Schema.Literal('NOT_STARTED')
)
export const VulnerabilityFindingTokenStatusStateSchema: Schema.Schema<VulnerabilityFindingTokenStatusState> = Schema.Union(
  Schema.Literal('ACTIVE'),
  Schema.Literal('INACTIVE'),
  Schema.Literal('UNKNOWN')
)
export const VulnerabilityGradeSchema: Schema.Schema<VulnerabilityGrade> = Schema.Union(
  Schema.Literal('A'),
  Schema.Literal('B'),
  Schema.Literal('C'),
  Schema.Literal('D'),
  Schema.Literal('F')
)
export const VulnerabilityIssueLinkTypeSchema: Schema.Schema<VulnerabilityIssueLinkType> = Schema.Union(
  Schema.Literal('CREATED'),
  Schema.Literal('RELATED')
)
export const VulnerabilityOwasp2021Top10Schema: Schema.Schema<VulnerabilityOwasp2021Top10> = Schema.Union(
  Schema.Literal('A01_2021'),
  Schema.Literal('A02_2021'),
  Schema.Literal('A03_2021'),
  Schema.Literal('A04_2021'),
  Schema.Literal('A05_2021'),
  Schema.Literal('A06_2021'),
  Schema.Literal('A07_2021'),
  Schema.Literal('A08_2021'),
  Schema.Literal('A09_2021'),
  Schema.Literal('A1_2021'),
  Schema.Literal('A2_2021'),
  Schema.Literal('A3_2021'),
  Schema.Literal('A4_2021'),
  Schema.Literal('A5_2021'),
  Schema.Literal('A6_2021'),
  Schema.Literal('A7_2021'),
  Schema.Literal('A8_2021'),
  Schema.Literal('A9_2021'),
  Schema.Literal('A10_2021'),
  Schema.Literal('NONE')
)
export const VulnerabilityOwaspTop10Schema: Schema.Schema<VulnerabilityOwaspTop10> = Schema.Union(
  Schema.Literal('A1_2017'),
  Schema.Literal('A2_2017'),
  Schema.Literal('A3_2017'),
  Schema.Literal('A4_2017'),
  Schema.Literal('A5_2017'),
  Schema.Literal('A6_2017'),
  Schema.Literal('A7_2017'),
  Schema.Literal('A8_2017'),
  Schema.Literal('A9_2017'),
  Schema.Literal('A10_2017'),
  Schema.Literal('NONE')
)
export const VulnerabilityReportTypeSchema: Schema.Schema<VulnerabilityReportType> = Schema.Union(
  Schema.Literal('API_FUZZING'),
  Schema.Literal('CLUSTER_IMAGE_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING'),
  Schema.Literal('CONTAINER_SCANNING_FOR_REGISTRY'),
  Schema.Literal('COVERAGE_FUZZING'),
  Schema.Literal('DAST'),
  Schema.Literal('DEPENDENCY_SCANNING'),
  Schema.Literal('GENERIC'),
  Schema.Literal('SAST'),
  Schema.Literal('SECRET_DETECTION')
)
export const VulnerabilitySeveritySchema: Schema.Schema<VulnerabilitySeverity> = Schema.Union(
  Schema.Literal('CRITICAL'),
  Schema.Literal('HIGH'),
  Schema.Literal('INFO'),
  Schema.Literal('LOW'),
  Schema.Literal('MEDIUM'),
  Schema.Literal('UNKNOWN')
)
export const VulnerabilitySortSchema: Schema.Schema<VulnerabilitySort> = Schema.Union(
  Schema.Literal('detected_asc'),
  Schema.Literal('detected_desc'),
  Schema.Literal('severity_asc'),
  Schema.Literal('severity_desc')
)
export const VulnerabilityStateSchema: Schema.Schema<VulnerabilityState> = Schema.Union(
  Schema.Literal('CONFIRMED'),
  Schema.Literal('DETECTED'),
  Schema.Literal('DISMISSED'),
  Schema.Literal('RESOLVED')
)
export const VulnerabilityWorkflowNameSchema: Schema.Schema<VulnerabilityWorkflowName> = Schema.Union(
  Schema.Literal('RESOLVE_SAST_VULNERABILITY'),
  Schema.Literal('SAST_FP_DETECTION')
)
export const WebhookAlertStatusSchema: Schema.Schema<WebhookAlertStatus> = Schema.Union(
  Schema.Literal('DISABLED'),
  Schema.Literal('EXECUTABLE'),
  Schema.Literal('TEMPORARILY_DISABLED')
)
export const WebhookBranchFilterStrategySchema: Schema.Schema<WebhookBranchFilterStrategy> = Schema.Union(
  Schema.Literal('ALL_BRANCHES'),
  Schema.Literal('REGEX'),
  Schema.Literal('WILDCARD')
)
export const WeightWildcardIdSchema: Schema.Schema<WeightWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const WorkItemAwardEmojiUpdateActionSchema: Schema.Schema<WorkItemAwardEmojiUpdateAction> = Schema.Union(
  Schema.Literal('ADD'),
  Schema.Literal('REMOVE'),
  Schema.Literal('TOGGLE')
)
export const WorkItemDiscussionsSortSchema: Schema.Schema<WorkItemDiscussionsSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC')
)
export const WorkItemParentWildcardIdSchema: Schema.Schema<WorkItemParentWildcardId> = Schema.Union(
  Schema.Literal('ANY'),
  Schema.Literal('NONE')
)
export const WorkItemRelatedLinkTypeSchema: Schema.Schema<WorkItemRelatedLinkType> = Schema.Union(
  Schema.Literal('BLOCKED_BY'),
  Schema.Literal('BLOCKS'),
  Schema.Literal('RELATED')
)
export const WorkItemSortSchema: Schema.Schema<WorkItemSort> = Schema.Union(
  Schema.Literal('BLOCKING_ISSUES_ASC'),
  Schema.Literal('BLOCKING_ISSUES_DESC'),
  Schema.Literal('CLOSED_AT_ASC'),
  Schema.Literal('CLOSED_AT_DESC'),
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('DUE_DATE_ASC'),
  Schema.Literal('DUE_DATE_DESC'),
  Schema.Literal('ESCALATION_STATUS_ASC'),
  Schema.Literal('ESCALATION_STATUS_DESC'),
  Schema.Literal('HEALTH_STATUS_ASC'),
  Schema.Literal('HEALTH_STATUS_DESC'),
  Schema.Literal('LABEL_PRIORITY_ASC'),
  Schema.Literal('LABEL_PRIORITY_DESC'),
  Schema.Literal('MILESTONE_DUE_ASC'),
  Schema.Literal('MILESTONE_DUE_DESC'),
  Schema.Literal('POPULARITY_ASC'),
  Schema.Literal('POPULARITY_DESC'),
  Schema.Literal('PRIORITY_ASC'),
  Schema.Literal('PRIORITY_DESC'),
  Schema.Literal('RELATIVE_POSITION_ASC'),
  Schema.Literal('SEVERITY_ASC'),
  Schema.Literal('SEVERITY_DESC'),
  Schema.Literal('START_DATE_ASC'),
  Schema.Literal('START_DATE_DESC'),
  Schema.Literal('STATUS_ASC'),
  Schema.Literal('STATUS_DESC'),
  Schema.Literal('TITLE_ASC'),
  Schema.Literal('TITLE_DESC'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('WEIGHT_ASC'),
  Schema.Literal('WEIGHT_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const WorkItemStateSchema: Schema.Schema<WorkItemState> = Schema.Union(
  Schema.Literal('CLOSED'),
  Schema.Literal('OPEN')
)
export const WorkItemStateEventSchema: Schema.Schema<WorkItemStateEvent> = Schema.Union(
  Schema.Literal('CLOSE'),
  Schema.Literal('REOPEN')
)
export const WorkItemStatusCategoryEnumSchema: Schema.Schema<WorkItemStatusCategoryEnum> = Schema.Union(
  Schema.Literal('CANCELED'),
  Schema.Literal('DONE'),
  Schema.Literal('IN_PROGRESS'),
  Schema.Literal('TO_DO'),
  Schema.Literal('TRIAGE')
)
export const WorkItemSubscriptionEventSchema: Schema.Schema<WorkItemSubscriptionEvent> = Schema.Union(
  Schema.Literal('SUBSCRIBE'),
  Schema.Literal('UNSUBSCRIBE')
)
export const WorkItemTodoUpdateActionSchema: Schema.Schema<WorkItemTodoUpdateAction> = Schema.Union(
  Schema.Literal('ADD'),
  Schema.Literal('MARK_AS_DONE')
)
export const WorkItemWidgetTypeSchema: Schema.Schema<WorkItemWidgetType> = Schema.Union(
  Schema.Literal('ASSIGNEES'),
  Schema.Literal('AWARD_EMOJI'),
  Schema.Literal('COLOR'),
  Schema.Literal('CRM_CONTACTS'),
  Schema.Literal('CURRENT_USER_TODOS'),
  Schema.Literal('CUSTOM_FIELDS'),
  Schema.Literal('DESCRIPTION'),
  Schema.Literal('DESIGNS'),
  Schema.Literal('DEVELOPMENT'),
  Schema.Literal('EMAIL_PARTICIPANTS'),
  Schema.Literal('ERROR_TRACKING'),
  Schema.Literal('HEALTH_STATUS'),
  Schema.Literal('HIERARCHY'),
  Schema.Literal('ITERATION'),
  Schema.Literal('LABELS'),
  Schema.Literal('LINKED_ITEMS'),
  Schema.Literal('LINKED_RESOURCES'),
  Schema.Literal('MILESTONE'),
  Schema.Literal('NOTES'),
  Schema.Literal('NOTIFICATIONS'),
  Schema.Literal('PARTICIPANTS'),
  Schema.Literal('PROGRESS'),
  Schema.Literal('REQUIREMENT_LEGACY'),
  Schema.Literal('START_AND_DUE_DATE'),
  Schema.Literal('STATUS'),
  Schema.Literal('TEST_REPORTS'),
  Schema.Literal('TIME_TRACKING'),
  Schema.Literal('VERIFICATION_STATUS'),
  Schema.Literal('VULNERABILITIES'),
  Schema.Literal('WEIGHT')
)
export const WorkItemsSavedViewsSortSchema: Schema.Schema<WorkItemsSavedViewsSort> = Schema.Union(
  Schema.Literal('CREATED_ASC'),
  Schema.Literal('CREATED_DESC'),
  Schema.Literal('ID'),
  Schema.Literal('RELATIVE_POSITION'),
  Schema.Literal('UPDATED_ASC'),
  Schema.Literal('UPDATED_DESC'),
  Schema.Literal('created_asc'),
  Schema.Literal('created_desc'),
  Schema.Literal('updated_asc'),
  Schema.Literal('updated_desc')
)
export const WorkflowEnvironmentSchema: Schema.Schema<WorkflowEnvironment> = Schema.Union(
  Schema.Literal('AMBIENT'),
  Schema.Literal('CHAT'),
  Schema.Literal('CHAT_PARTIAL'),
  Schema.Literal('IDE'),
  Schema.Literal('WEB')
)
export const WorkspaceVariableInputTypeSchema: Schema.Schema<WorkspaceVariableInputType> = Schema.Union(
  Schema.Literal('ENVIRONMENT')
)
export const WorkspaceVariableTypeSchema: Schema.Schema<WorkspaceVariableType> = Schema.Union(
  Schema.Literal('ENVIRONMENT')
)