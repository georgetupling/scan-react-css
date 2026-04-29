import { extractHtmlScriptSources } from "../../../../project/htmlScriptSources.js";
import { extractHtmlStylesheetLinks } from "../../../../project/htmlStylesheetLinks.js";
import type { ScanDiagnostic } from "../../../../project/types.js";
import type { ProjectHtmlFile } from "../types.js";
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
