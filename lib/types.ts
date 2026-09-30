export type RepositoryFile = {
  path: string;
  content: string;
};

export type AnalyzedFile = {
  path: string;
  language: string;
  layer: string;
  imports: string[];
  internalImports: string[];
  externalImports: string[];
  isEntryPoint: boolean;
};

export type Dependency = {
  source: string;
  target: string;
  type: "internal" | "external";
};

export type ArchitectureNode = {
  id: string;
  label: string;
  type:
    | "api"
    | "service"
    | "database"
    | "model"
    | "middleware"
    | "utility"
    | "test"
    | "other";
  files: string[];
  description: string;
};

export type ArchitectureEdge = {
  source: string;
  target: string;
  relationship:
    | "calls"
    | "imports"
    | "uses"
    | "stores"
    | "depends_on";
};

export type ArchitectureRisk = {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  component: string;
  description: string;
  evidence: string[];
  recommendation: string;
};

export type ArchitectureMetrics = {
  fileCount: number;
  componentCount: number;
  relationshipCount: number;
  externalDependencyCount: number;
  entryPointCount: number;
  layerCount: number;
  highRiskCount: number;
  mediumRiskCount: number;
};

export type ArchitectureIssues = {
  circularDependencies: string[][];
  deadFiles: string[];
};

export type ArchitectureHealth = {
  score: number;
  summary: string;
  strengths: string[];
  concerns: string[];
};

export type Architecture = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  summary: string;
  mermaid: string;
  health: ArchitectureHealth;
  risks: ArchitectureRisk[];
  metrics: ArchitectureMetrics;
  issues: ArchitectureIssues;
  files: AnalyzedFile[];
  dependencies: Dependency[];
  languages: Record<string, number>;
  layers: string[];
  entryPoints: string[];
  externalDependencies: string[];
};