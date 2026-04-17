# react-css-scanner

`react-css-scanner` is a standalone React CSS audit tool that can be used either:

- as a CLI via `npx react-css-scanner` or an npm script
- as a Node API via `import { scan } from "react-css-scanner"`

## Project setup

The package is now scaffolded as:

- TypeScript source in `src/`
- ESM-only npm package output
- CLI entrypoint via `bin`
- Node import API from the same package
- temporary bridge to the existing legacy `css-audit/*.cjs` implementation

That bridge keeps the current scanner working while the internals are ported to TypeScript incrementally.

## Intended usage

CLI:

```bash
npx react-css-scanner ./src
```

Node API:

```ts
import { scan } from "react-css-scanner";

const findings = scan({ targetDirectory: "./src" });
console.log(findings);
```

## Next steps

1. Install dependencies.
2. Run `npm run build`.
3. Port the legacy `css-audit/*.cjs` modules into `src/` one slice at a time.
