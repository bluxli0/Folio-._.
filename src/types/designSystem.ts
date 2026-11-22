export type DesignCustomVarType = 'color' | 'number' | 'text';

export interface DesignCustomVariable {
  id: string;
  key: string; // e.g. "grid-gap" -> CSS --grid-gap & JS vars["grid-gap"]
  label: string;
  type: DesignCustomVarType;
  value: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface DesignSystemConfig {
  name: string;
  themeColor: string;
  accentColor: string;
  surfaceColor: string;
  textColor: string;
  animationSpeed: number; // multiplier: 0.25 to 3.0 (1 = normal)
  spriteSize: number; // px: 16 to 128
  borderRadius: number; // px: 0 to 32
  spacingUnit: number; // px: 2 to 16
  fontScale: number; // multiplier: 0.75 to 1.5
  seedEnabled: boolean;
  seed: string;
  customVars: DesignCustomVariable[];
}

export interface WorkspaceFileEntry {
  path: string;
  size: number;
  isText: boolean;
  mimeType: string;
}

export interface PreviewBundleJson {
  format: 'folio-preview-bundle-v1';
  exportedAt: number;
  language: string;
  code: string;
  designSystem: DesignSystemConfig;
  workspaceFiles?: Array<{ path: string; content: string }>;
}

export interface GitHubStatus {
  configured: boolean;
  connected: boolean;
  user?: {
    login: string;
    name?: string | null;
    avatar_url?: string;
    html_url?: string;
  };
}

export interface GitHubRepoSummary {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  description?: string | null;
  html_url: string;
  updated_at?: string;
}

export interface WorkspaceSummary {
  id: string;
  fileCount: number;
  entryFolders: string[];
  hasWorkflow: boolean;
  updatedAt: number;
}

export interface WorkflowStep {
  name?: string;
  language?: string;
  filePath?: string;
  code?: string;
}

export interface WorkflowStepResult {
  name: string;
  runtime: string;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

export interface GitHubPushResult {
  owner: string;
  repo: string;
  branch: string;
  commitSha: string;
  commitUrl: string;
  repoUrl: string;
  pushedCount: number;
}

