export type RepositoryFile = {
  path: string;
  content: string;
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
    | "other";
  files: string[];
  description?: string;
};

export type ArchitectureEdge = {
  source: string;
  target: string;
  relationship: string;
};

export type Architecture = {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
  summary: string;
};