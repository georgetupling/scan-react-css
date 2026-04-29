import type { ScanDiagnostic } from "../../../../project/types.js";
import type { ProjectHtmlFile } from "../types.js";
import { extractHtmlScriptSources } from "./extractHtmlScriptSources.js";
import { extractHtmlStylesheetLinks } from "./extractHtmlStylesheetLinks.js";
import {
  resolveLocalHtmlScriptSources,
  resolveLocalHtmlStylesheetLinks,
} from "./htmlPathResolution.js";

export function collectHtmlResources(input: {
  rootDir: string;
  htmlFiles: ProjectHtmlFile[];
  diagnostics: ScanDiagnostic[];
}): {
  htmlStylesheetLinks: ReturnType<typeof resolveLocalHtmlStylesheetLinks>;
  htmlScriptSources: ReturnType<typeof resolveLocalHtmlScriptSources>;
} {
  const htmlStylesheetLinks = input.htmlFiles.flatMap((htmlFile) =>
    extractHtmlStylesheetLinks({
      filePath: htmlFile.filePath,
      htmlText: htmlFile.htmlText,
    }),
  );
  const htmlScriptSources = input.htmlFiles.flatMap((htmlFile) =>
    extractHtmlScriptSources({
      filePath: htmlFile.filePath,
      htmlText: htmlFile.htmlText,
    }),
  );

  return {
    htmlStylesheetLinks: resolveLocalHtmlStylesheetLinks({
      rootDir: input.rootDir,
      htmlStylesheetLinks,
      diagnostics: input.diagnostics,
    }),
    htmlScriptSources: resolveLocalHtmlScriptSources({
      rootDir: input.rootDir,
      htmlScriptSources,
      diagnostics: input.diagnostics,
    }),
  };
}
