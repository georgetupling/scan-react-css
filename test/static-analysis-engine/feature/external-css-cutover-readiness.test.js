import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";

import { scanReactCss } from "../../../dist/index.js";
import { runExperimentalSelectorPilotAgainstCurrentScanner } from "../../../dist/static-analysis-engine.js";
import { TestProjectBuilder } from "../../support/TestProjectBuilder.js";
import { withBuiltProject } from "../../support/integrationTestUtils.js";

const FONT_AWESOME_PROVIDER = {
  provider: "font-awesome",
  match: ["**/cdnjs.cloudflare.com/ajax/libs/font-awesome/**/css/*.css"],
  classPrefixes: ["fa-"],
  classNames: ["fa", "fa-solid", "fa-regular", "fa-brands"],
};

test("external-css cutover readiness keeps imported external css and declared-provider behavior on the shipped path", async () => {
  await withBuiltProject(
    new TestProjectBuilder()
      .withTemplate("basic-react-app")
      .withFile(
        "index.html",
        [
          "<!doctype html>",
          "<html><head>",
          '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" />',
          '</head><body><div id="root"></div></body></html>',
        ].join("\n"),
      )
      .withSourceFile(
        "src/App.tsx",
        [
          'import "bootstrap/dist/css/bootstrap.css";',
          'export function App() { return <div className="btn fa-solid fa-trash ghost-btn" />; }',
        ].join("\n"),
      )
      .withNodeModuleFile("bootstrap/dist/css/bootstrap.css", ".btn { display: inline-block; }\n")
      .withConfig({
        externalCss: {
          mode: "declared-globals",
          globals: [FONT_AWESOME_PROVIDER],
        },
      }),
    async (project) => {
      const result = await scanReactCss({ targetPath: project.rootDir });
      const ghostFinding = result.findings.find(
        (finding) =>
          finding.ruleId === "missing-external-css-class" &&
          finding.subject?.className === "ghost-btn",
      );

      assert.ok(ghostFinding);
      assert.equal(
        result.findings.some(
          (finding) =>
            finding.ruleId === "missing-external-css-class" &&
            (finding.subject?.className === "btn" ||
              finding.subject?.className === "fa-solid" ||
              finding.subject?.className === "fa-trash"),
        ),
        false,
      );
      assert.deepEqual(ghostFinding?.metadata.externalCssSpecifiers, [
        "bootstrap/dist/css/bootstrap.css",
      ]);
      assert.equal(ghostFinding?.metadata.referenceKind, "string-literal");

      const artifact = await runExperimentalSelectorPilotAgainstCurrentScanner({
        cwd: project.rootDir,
      });

      assert.ok(
        artifact.comparisonResult.comparison.matched.some(
          (entry) =>
            entry.experimental.ruleId === "missing-external-css-class" &&
            entry.baseline.ruleId === "missing-external-css-class" &&
            entry.baseline.subject?.className === "ghost-btn",
        ),
      );
      assert.equal(
        artifact.comparisonResult.comparison.experimentalOnly.some(
          (finding) => finding.ruleId === "missing-external-css-class",
        ),
        false,
      );
      assert.equal(
        artifact.comparisonResult.comparison.baselineOnly.some(
          (finding) => finding.ruleId === "missing-external-css-class",
        ),
        false,
      );
    },
  );
});

test("external-css cutover readiness keeps fetch-remote fallback behavior runtime-owned while the shipped rule stays native-backed", async () => {
  await withHttpServer(
    (request, response) => {
      if (request.url === "/missing.css") {
        response.writeHead(404, { "content-type": "text/plain" });
        response.end("not found");
        return;
      }

      response.writeHead(404);
      response.end("not found");
    },
    async (serverBaseUrl) => {
      await withBuiltProject(
        new TestProjectBuilder()
          .withTemplate("basic-react-app")
          .withFile(
            "index.html",
            [
              "<!doctype html>",
              "<html><head>",
              `<link rel="stylesheet" href="${serverBaseUrl}/missing.css" />`,
              '</head><body><div id="root"></div></body></html>',
            ].join("\n"),
          )
          .withSourceFile(
            "src/App.tsx",
            'export function App() { return <div className="library-btn" />; }\n',
          )
          .withConfig({
            externalCss: {
              mode: "fetch-remote",
            },
          }),
        async (project) => {
          const result = await scanReactCss({ targetPath: project.rootDir });
          const missingFinding = result.findings.find(
            (finding) =>
              finding.ruleId === "missing-external-css-class" &&
              finding.subject?.className === "library-btn",
          );

          assert.ok(
            result.operationalWarnings?.some((warning) =>
              warning.includes(
                `Could not fetch remote external CSS "${serverBaseUrl}/missing.css"`,
              ),
            ),
          );
          assert.ok(missingFinding);
          assert.equal(
            result.findings.some(
              (finding) =>
                finding.ruleId === "missing-css-class" &&
                finding.subject?.className === "library-btn",
            ),
            false,
          );
          assert.deepEqual(missingFinding?.metadata.externalCssSpecifiers, [
            `${serverBaseUrl}/missing.css`,
          ]);
        },
      );
    },
  );
});

async function withHttpServer(handler, run) {
  const server = http.createServer(handler);

  await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Failed to start test HTTP server.");
  }

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(undefined);
      });
    });
  }
}
