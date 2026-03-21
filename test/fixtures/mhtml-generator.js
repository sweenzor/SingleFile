const CRLF = "\r\n";
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64_LINE_LENGTH = 76;

/**
 * Generate a repeatable pseudo-random base64 line of a given length.
 * Uses a simple seeded approach so fixtures are deterministic.
 */
function base64Line(seed, length = BASE64_LINE_LENGTH) {
	let s = seed;
	let line = "";
	for (let i = 0; i < length; i++) {
		s = (s * 1103515245 + 12345) & 0x7fffffff;
		line += BASE64_CHARS[s % 64];
	}
	return line;
}

/**
 * Generate a base64 payload of approximately `bytes` size.
 * Each line is 76 chars + CRLF = 78 bytes.
 */
function generateBase64Payload(bytes, seed = 42) {
	const lineCount = Math.ceil(bytes / 78);
	const lines = [];
	for (let i = 0; i < lineCount; i++) {
		lines.push(base64Line(seed + i));
	}
	return lines.join(CRLF);
}

/**
 * Generate a text payload of approximately `bytes` size.
 */
function generateTextPayload(bytes) {
	const line = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.";
	const lineWithCrlf = line + CRLF;
	const lineCount = Math.ceil(bytes / lineWithCrlf.length);
	const lines = [];
	for (let i = 0; i < lineCount; i++) {
		lines.push(line);
	}
	return lines.join(CRLF);
}

/**
 * Build a valid MHTML Uint8Array with the given specification.
 *
 * @param {object} options
 * @param {number} options.resourceCount - Number of additional resources (beyond the main HTML)
 * @param {number} options.resourceSize  - Approximate byte size of each resource's data
 * @param {"base64"|"text"} [options.encoding="base64"] - Encoding for additional resources
 * @returns {Uint8Array}
 */
export function generateMhtml({ resourceCount, resourceSize, encoding = "base64" }) {
	const encoder = new TextEncoder();
	const boundary = "----=_Part_SingleFile_Test_001";
	const parts = [];

	// Top-level MHTML headers
	parts.push("From: <Saved by SingleFile>");
	parts.push("Subject: Synthetic Test Fixture");
	parts.push("MIME-Version: 1.0");
	parts.push(`Content-Type: multipart/related;boundary="${boundary}"`);
	parts.push("");

	// Main HTML resource (text/plain to avoid DOMParser dependency)
	parts.push(`--${boundary}`);
	parts.push("Content-Type: text/plain; charset=utf-8");
	parts.push("Content-Transfer-Encoding: quoted-printable");
	parts.push("Content-Location: https://example.com/index.html");
	parts.push("");
	parts.push("<html><head><title>Test</title></head><body><p>Hello World</p></body></html>");

	// Additional resources
	for (let i = 0; i < resourceCount; i++) {
		parts.push(`--${boundary}`);
		if (encoding === "base64") {
			parts.push("Content-Type: image/png");
			parts.push("Content-Transfer-Encoding: base64");
		} else {
			parts.push("Content-Type: text/plain");
			parts.push("Content-Transfer-Encoding: quoted-printable");
		}
		parts.push(`Content-Location: https://example.com/resource-${i}`);
		parts.push("");
		if (encoding === "base64") {
			parts.push(generateBase64Payload(resourceSize, i * 1000));
		} else {
			parts.push(generateTextPayload(resourceSize));
		}
	}

	// Closing boundary
	parts.push(`--${boundary}--`);
	parts.push("");

	return encoder.encode(parts.join(CRLF));
}

/**
 * Pre-defined fixture sizes.
 * Each returns a Uint8Array when called.
 */
export const FIXTURE_SPECS = {
	small: { resourceCount: 2, resourceSize: 4000, encoding: "base64" },       // ~10KB
	medium: { resourceCount: 50, resourceSize: 20000, encoding: "base64" },     // ~1MB
	large: { resourceCount: 200, resourceSize: 50000, encoding: "base64" },     // ~10MB
	xlarge: { resourceCount: 500, resourceSize: 200000, encoding: "base64" },   // ~100MB
};

/**
 * Generate a fixture by name.
 * @param {"small"|"medium"|"large"|"xlarge"} name
 * @returns {Uint8Array}
 */
export function generateFixture(name) {
	const spec = FIXTURE_SPECS[name];
	if (!spec) {
		throw new Error(`Unknown fixture: ${name}. Use: ${Object.keys(FIXTURE_SPECS).join(", ")}`);
	}
	return generateMhtml(spec);
}

/**
 * Generate an empty MHTML (no resources, just headers + boundary).
 */
export function generateEmptyMhtml() {
	const encoder = new TextEncoder();
	const boundary = "----=_Part_Empty_001";
	const parts = [
		"From: <Saved by SingleFile>",
		"Subject: Empty",
		`Content-Type: multipart/related;boundary="${boundary}"`,
		"",
		`--${boundary}--`,
		""
	];
	return encoder.encode(parts.join(CRLF));
}

/**
 * Generate MHTML with no boundary (single resource, no multipart).
 */
export function generateNoBoundaryMhtml() {
	const encoder = new TextEncoder();
	const parts = [
		"From: <Saved by SingleFile>",
		"Content-Type: text/plain",
		"Content-Transfer-Encoding: quoted-printable",
		"Content-Location: https://example.com/single",
		"",
		"This is a single-part MHTML with no boundary.",
		""
	];
	return encoder.encode(parts.join(CRLF));
}
