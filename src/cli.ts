#!/usr/bin/env node

import { loadMainCli } from "./legacy.js";

loadMainCli().runCli(process.argv);
