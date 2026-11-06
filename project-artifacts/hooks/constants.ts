export const GIT_TIMEOUT_MS = 5000

export const ARTIFACTS_PANE_TITLE = 'Artifacts'
/** The command, and the status bar item that stands for it. */
export const ARTIFACTS_COMMAND = 'repo-artifacts'

/** The artifacts server, as /mcp lists it. */
export const ARTIFACTS_SERVER = 'claude-artifacts'
export const LIST_TOOL = 'list_artifacts'
export const COMMENTS_TOOL = 'read_comments'
/** list_artifacts' own ceiling for one unpaged call. */
export const LIST_LIMIT = 500

/** `$.store` key holding every repo's links: git common dir → artifact refs. */
export const LINKS_STORE_KEY = 'artifact-links'
/** `$.store` key holding the keys of the repos folded in the pane, so a fold outlives the session. */
export const COLLAPSED_STORE_KEY = 'artifact-collapsed'

/** Tool calls that create or change an artifact; the session's repo takes what they touch. */
export const LINKING_TOOLS: readonly string[] = [
  'mcp__claude-artifacts__publish_version',
  'mcp__claude-artifacts__publish_files',
  'mcp__claude-artifacts__edit_version',
  'mcp__claude-artifacts__create_from_type',
]
/** Its input's slug names the type, not the artifact it makes. */
export const CREATE_FROM_TYPE_TOOL = 'mcp__claude-artifacts__create_from_type'
/** A Claude Docs batch links only when it creates the doc. */
export const DOCS_BATCH_TOOL = 'mcp__claude_ai_Claude_Docs__batch'

export const ARTIFACT_URL_PREFIX = 'https://claude.ai/artifact/'

/** Tool inputs naming a file or folder: the repo holding it becomes the session's active repo. */
export const PATH_FIELDS: readonly string[] = ['file_path', 'notebook_path', 'path']
