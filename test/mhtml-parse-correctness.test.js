import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
	generateFixture,
	generateMhtml,
	generateEmptyMhtml,
	generateNoBoundaryMhtml
} from "./fixtures/mhtml-generator.js";
import parseJS from "../src/lib/mhtml-to-html/parse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_DIR = resolve(__dirname, "..", "lib", "wasm");
const WASM_GLUE = resolve(WASM_DIR, "mhtml_parser.js");
const WASM_BIN = resolve(WASM_DIR, "mhtml_parser_bg.wasm");

// Eagerly initialize WASM at module level so it.skipIf works
let wasmAvailable = false;
let parseWasm;
try {
	if (existsSync(WASM_BIN)) {
		const wasmModule = await import(WASM_GLUE);
		const wasmBytes = readFileSync(WASM_BIN);
		wasmModule.initSync({ module: wasmBytes });
		parseWasm = wasmModule.parse_mhtml;
		wasmAvailable = true;
	}
} catch {
	console.warn("WASM module not available — skipping WASM tests. Build WASM first.");
}

/**
 * Run the JS parser with a stub DOMParser so document/stylesheet
 * charset processing is skipped. We use text/plain content types
 * in fixtures to avoid hitting those code paths entirely.
 */
function runJSParse(mhtml) {
	return parseJS(mhtml, { DOMParser: undefined });
}

/**
 * Compare a WASM resource's raw byte data against the JS resource's
 * decoded string data. For text resources, decoding the WASM bytes
 * as UTF-8 should yield the same string the JS parser produces.
 * For base64 resources, the data is base64 text in both cases.
 */
function compareResourceData(wasmData, jsData) {
	if (wasmData instanceof Uint8Array) {
		const decoded = new TextDecoder().decode(wasmData);
		return decoded === jsData;
	}
	return wasmData === jsData;
}

describe("MHTML parse correctness", () => {

	describe("WASM parser output structure", () => {
		it.skipIf(!wasmAvailable)("returns headers, resources, frames, index", () => {
			const fixture = generateMhtml({ resourceCount: 2, resourceSize: 100 });
			const result = parseWasm(fixture);
			expect(result).toHaveProperty("headers");
			expect(result).toHaveProperty("resources");
			expect(result).toHaveProperty("frames");
			expect(result).toHaveProperty("index");
		});

		it.skipIf(!wasmAvailable)("parses top-level headers", () => {
			const fixture = generateMhtml({ resourceCount: 1, resourceSize: 100 });
			const result = parseWasm(fixture);
			expect(result.headers.get("subject")).toBe("Synthetic Test Fixture");
			expect(result.headers.get("from")).toBe("<Saved by SingleFile>");
		});

		it.skipIf(!wasmAvailable)("identifies the index resource", () => {
			const fixture = generateMhtml({ resourceCount: 1, resourceSize: 100 });
			const result = parseWasm(fixture);
			// The first text/plain resource is NOT a document, so index might be undefined.
			// Our fixture uses text/plain, not text/html, so index stays undefined
			// unless the parser treats text/plain as a document (it doesn't).
			// This is expected behavior.
			expect(result.index).toBeUndefined();
		});

		it.skipIf(!wasmAvailable)("extracts correct resource count", () => {
			const fixture = generateMhtml({ resourceCount: 5, resourceSize: 100 });
			const result = parseWasm(fixture);
			const keys = Object.keys(result.resources);
			// 1 main HTML resource + 5 additional = 6 total
			expect(keys.length).toBe(6);
		});

		it.skipIf(!wasmAvailable)("preserves resource content types", () => {
			const fixture = generateMhtml({ resourceCount: 2, resourceSize: 100 });
			const result = parseWasm(fixture);
			const mainResource = result.resources["https://example.com/index.html"];
			expect(mainResource).toBeDefined();
			expect(mainResource.contentType).toBe("text/plain; charset=utf-8");
			const imgResource = result.resources["https://example.com/resource-0"];
			expect(imgResource).toBeDefined();
			expect(imgResource.contentType).toBe("image/png");
		});

		it.skipIf(!wasmAvailable)("resource data is Uint8Array", () => {
			const fixture = generateMhtml({ resourceCount: 1, resourceSize: 100 });
			const result = parseWasm(fixture);
			const resource = result.resources["https://example.com/index.html"];
			expect(resource.data).toBeInstanceOf(Uint8Array);
		});
	});

	describe("WASM vs JS — header comparison", () => {
		for (const size of ["small", "medium"]) {
			it.skipIf(!wasmAvailable)(`${size}: headers match`, () => {
				const fixture = generateFixture(size);
				const wasmResult = parseWasm(fixture);
				const jsResult = runJSParse(fixture);

				// Compare header keys and values
				for (const [key, value] of wasmResult.headers) {
					expect(jsResult.headers[key]).toBe(value);
				}
				for (const key of Object.keys(jsResult.headers)) {
					expect(wasmResult.headers.get(key)).toBe(jsResult.headers[key]);
				}
			});
		}
	});

	describe("WASM vs JS — resource keys match", () => {
		for (const size of ["small", "medium"]) {
			it.skipIf(!wasmAvailable)(`${size}: same resource IDs`, () => {
				const fixture = generateFixture(size);
				const wasmResult = parseWasm(fixture);
				const jsResult = runJSParse(fixture);

				const wasmKeys = Object.keys(wasmResult.resources).sort();
				const jsKeys = Object.keys(jsResult.resources).sort();
				expect(wasmKeys).toEqual(jsKeys);
			});
		}
	});

	describe("WASM vs JS — resource content types match", () => {
		for (const size of ["small", "medium"]) {
			it.skipIf(!wasmAvailable)(`${size}: content types match`, () => {
				const fixture = generateFixture(size);
				const wasmResult = parseWasm(fixture);
				const jsResult = runJSParse(fixture);

				for (const key of Object.keys(wasmResult.resources)) {
					const wasmRes = wasmResult.resources[key];
					const jsRes = jsResult.resources[key];
					expect(jsRes).toBeDefined();
					// JS replaces charset to utf-8; for types without charset
					// param (image/png) or already utf-8, they should match
					expect(wasmRes.contentType).toBe(jsRes.contentType);
				}
			});
		}
	});

	describe("WASM vs JS — resource data match", () => {
		for (const size of ["small", "medium"]) {
			it.skipIf(!wasmAvailable)(`${size}: data matches after decoding`, () => {
				const fixture = generateFixture(size);
				const wasmResult = parseWasm(fixture);
				const jsResult = runJSParse(fixture);

				for (const key of Object.keys(wasmResult.resources)) {
					const wasmRes = wasmResult.resources[key];
					const jsRes = jsResult.resources[key];
					expect(
						compareResourceData(wasmRes.data, jsRes.data)
					).toBe(true);
				}
			});
		}
	});

	describe("WASM vs JS — transfer encoding match", () => {
		it.skipIf(!wasmAvailable)("small: transfer encodings match", () => {
			const fixture = generateFixture("small");
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);

			for (const key of Object.keys(wasmResult.resources)) {
				const wasmRes = wasmResult.resources[key];
				const jsRes = jsResult.resources[key];
				expect(wasmRes.transferEncoding).toBe(jsRes.transferEncoding);
			}
		});
	});

	describe("WASM vs JS — large fixture", () => {
		it.skipIf(!wasmAvailable)("large: resource count and keys match", () => {
			const fixture = generateFixture("large");
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);

			const wasmKeys = Object.keys(wasmResult.resources).sort();
			const jsKeys = Object.keys(jsResult.resources).sort();
			expect(wasmKeys).toEqual(jsKeys);
		});

		it.skipIf(!wasmAvailable)("large: spot-check first and last resource data", () => {
			const fixture = generateFixture("large");
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);

			// Check first additional resource
			const firstKey = "https://example.com/resource-0";
			expect(
				compareResourceData(wasmResult.resources[firstKey].data, jsResult.resources[firstKey].data)
			).toBe(true);

			// Check last additional resource
			const lastKey = "https://example.com/resource-199";
			expect(
				compareResourceData(wasmResult.resources[lastKey].data, jsResult.resources[lastKey].data)
			).toBe(true);
		});
	});

	describe("edge cases", () => {
		it.skipIf(!wasmAvailable)("empty MHTML: no resources", () => {
			const fixture = generateEmptyMhtml();
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);
			expect(Object.keys(wasmResult.resources).length).toBe(0);
			expect(Object.keys(jsResult.resources).length).toBe(0);
		});

		it.skipIf(!wasmAvailable)("no boundary MHTML: single resource", () => {
			const fixture = generateNoBoundaryMhtml();
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);
			expect(Object.keys(wasmResult.resources).length).toBe(1);
			expect(Object.keys(jsResult.resources).length).toBe(1);
		});

		it.skipIf(!wasmAvailable)("text encoding resources: data matches", () => {
			const fixture = generateMhtml({ resourceCount: 3, resourceSize: 500, encoding: "text" });
			const wasmResult = parseWasm(fixture);
			const jsResult = runJSParse(fixture);

			for (const key of Object.keys(wasmResult.resources)) {
				expect(
					compareResourceData(wasmResult.resources[key].data, jsResult.resources[key].data)
				).toBe(true);
			}
		});
	});
});
