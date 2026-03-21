import { bench, describe, beforeAll } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateFixture } from "./fixtures/mhtml-generator.js";
import parseJS from "../src/lib/mhtml-to-html/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = resolve(__dirname, "..", "lib", "wasm");
const WASM_GLUE = resolve(WASM_DIR, "mhtml_parser.js");
const WASM_BIN = resolve(WASM_DIR, "mhtml_parser_bg.wasm");

// Eagerly initialize WASM at module level so bench.skipIf works
let parseWasm;
let wasmAvailable = false;
try {
	if (existsSync(WASM_BIN)) {
		const wasmModule = await import(WASM_GLUE);
		const wasmBytes = readFileSync(WASM_BIN);
		wasmModule.initSync({ module: wasmBytes });
		parseWasm = wasmModule.parse_mhtml;
		wasmAvailable = true;
	}
} catch (e) {
	console.warn("WASM module not available — WASM benchmarks will be skipped.", e.message);
}

// Pre-generate fixtures so generation time isn't included in benchmarks
let smallFixture, mediumFixture, largeFixture, xlargeFixture;

beforeAll(() => {
	console.log("Generating fixtures...");
	smallFixture = generateFixture("small");
	console.log(`  small:  ${(smallFixture.byteLength / 1024).toFixed(1)} KB`);
	mediumFixture = generateFixture("medium");
	console.log(`  medium: ${(mediumFixture.byteLength / 1024).toFixed(1)} KB`);
	largeFixture = generateFixture("large");
	console.log(`  large:  ${(largeFixture.byteLength / (1024 * 1024)).toFixed(1)} MB`);
	xlargeFixture = generateFixture("xlarge");
	console.log(`  xlarge: ${(xlargeFixture.byteLength / (1024 * 1024)).toFixed(1)} MB`);
	console.log("Fixtures ready.");
});

describe("MHTML parse — small (~10KB)", () => {
	bench("JS", () => {
		parseJS(smallFixture, { DOMParser: undefined });
	});

	bench.skipIf(!wasmAvailable)("WASM", () => {
		parseWasm(smallFixture);
	});
});

describe("MHTML parse — medium (~1MB)", () => {
	bench("JS", () => {
		parseJS(mediumFixture, { DOMParser: undefined });
	});

	bench.skipIf(!wasmAvailable)("WASM", () => {
		parseWasm(mediumFixture);
	});
});

describe("MHTML parse — large (~10MB)", () => {
	bench("JS", () => {
		parseJS(largeFixture, { DOMParser: undefined });
	}, { iterations: 5, warmupIterations: 1 });

	bench.skipIf(!wasmAvailable)("WASM", () => {
		parseWasm(largeFixture);
	}, { iterations: 5, warmupIterations: 1 });
});

describe("MHTML parse — xlarge (~100MB)", () => {
	bench("JS", () => {
		parseJS(xlargeFixture, { DOMParser: undefined });
	}, { iterations: 3, warmupIterations: 0 });

	bench.skipIf(!wasmAvailable)("WASM", () => {
		parseWasm(xlargeFixture);
	}, { iterations: 3, warmupIterations: 0 });
});
