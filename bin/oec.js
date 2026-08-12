#!/usr/bin/env node
import { launch } from "./launcher.js"

process.exit(await launch(process.argv.slice(2)))
