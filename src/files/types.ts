export type ProjectFileKind = "source" | "css" | "html";

export type DiscoveredProjectFile = {
  kind: ProjectFileKind;
  absolutePath: string;
  relativePath: string;
};

export type FileDiscoveryResult = {
  rootDir: string;
  sourceFiles: DiscoveredProjectFile[];
  cssFiles: DiscoveredProjectFile[];
  htmlFiles: DiscoveredProjectFile[];
};
