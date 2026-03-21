import {
	decodeString,
	encodeString,
	getCharset,
	replaceCharset,
	isDocument,
	isStylesheet,
	isText,
	decodeBinary,
	parseDOM
} from "./util.js";
import * as cssTree from "./vendor/csstree.esm.js";
import modParseJS from "./parse.js";

const BINARY_ENCODING = "binary";
const BASE64_ENCODING = "base64";
const UTF8_CHARSET = "utf-8";
const AT_RULE = "Atrule";
const CHARSET_IDENTIFIER = "charset";
const META_TAG = "META";
const CONTENT_ATTRIBUTE = "content";
const CHARSET_ATTRIBUTE = "charset";
const HTTP_EQUIV_ATTRIBUTE = "http-equiv";
const CONTENT_TYPE_HEADER = "content-type";

let wasmPromise = null;
let wasmModule = null;
let wasmLoadFailed = false;

function loadWasm() {
	if (wasmLoadFailed) return Promise.resolve(null);
	if (wasmModule) return Promise.resolve(wasmModule);
	if (!wasmPromise) {
		wasmPromise = (async () => {
			try {
				const wasm = await import("../../lib/wasm/mhtml_parser.js");
				await wasm.default();
				wasmModule = wasm;
				return wasm;
			} catch (_) {
				wasmLoadFailed = true;
				return null;
			}
		})();
	}
	return wasmPromise;
}

// Kick off loading immediately
loadWasm();

export default parse;

async function parse(mhtml, { DOMParser } = { DOMParser: globalThis.DOMParser }, context = { resources: {}, frames: {} }) {
	if (typeof mhtml === "string") {
		mhtml = encodeString(mhtml);
	}
	const wasm = await loadWasm();
	if (!wasm) {
		return modParseJS(mhtml, { DOMParser }, context);
	}
	return parseWithWasm(wasm, mhtml, DOMParser, context);
}

function parseWithWasm(wasm, mhtml, DOMParser, context) {
	const { resources, frames } = context;

	let wasmResult;
	try {
		wasmResult = wasm.parse_mhtml(mhtml);
	} catch (_) {
		return modParseJS(mhtml, { DOMParser }, context);
	}

	const headers = wasmResult.headers || {};
	const embeddedToProcess = [];

	// Process resources and collect embedded MHTML in single pass
	for (const [id, wasmResource] of Object.entries(wasmResult.resources || {})) {
		if (!resources[id]) {
			const resource = {
				id: wasmResource.id,
				contentType: wasmResource.contentType,
				transferEncoding: wasmResource.transferEncoding,
				data: wasmResource.data
			};
			processResource(resource, DOMParser);
			resources[id] = resource;
		}
		if (wasmResource.used && wasmResource.data && wasmResource.data.length > 0) {
			embeddedToProcess.push(wasmResource.data);
		}
	}

	// Process frames — link to already-processed resources where possible
	for (const [id, wasmResource] of Object.entries(wasmResult.frames || {})) {
		if (!frames[id]) {
			if (resources[wasmResource.id]) {
				frames[id] = resources[wasmResource.id];
			} else {
				const resource = {
					id: wasmResource.id,
					contentType: wasmResource.contentType,
					transferEncoding: wasmResource.transferEncoding,
					data: wasmResource.data
				};
				processResource(resource, DOMParser);
				resources[wasmResource.id] = resource;
				frames[id] = resource;
			}
		}
	}

	// Handle embedded MHTML
	for (const data of embeddedToProcess) {
		parse(data, { DOMParser }, context);
	}

	if (wasmResult.index !== undefined && context.index === undefined) {
		context.index = wasmResult.index;
	}

	return { headers, frames: context.frames, resources: context.resources, index: context.index };
}

function processResource(resource, DOMParser) {
	const rawData = resource.data instanceof Uint8Array ? resource.data : new Uint8Array(resource.data);
	const charset = resource.contentType ? getCharset(resource.contentType) : undefined;

	if (resource.transferEncoding === BINARY_ENCODING && (!resource.contentType || !isText(resource.contentType))) {
		resource.transferEncoding = BASE64_ENCODING;
		resource.data = decodeBinary(rawData);
	} else {
		resource.data = decodeString(rawData, charset);
	}

	if (resource.contentType) {
		resource.contentType = replaceCharset(resource.contentType, UTF8_CHARSET);
		if (isStylesheet(resource.contentType)) {
			processStylesheetCharset(resource, rawData, charset);
		} else if (isDocument(resource.contentType)) {
			processDocumentCharset(resource, rawData, charset, DOMParser);
		}
	}
}

function processStylesheetCharset(resource, rawData, charset) {
	try {
		let ast = cssTree.parse(resource.data);
		if (ast.children.first && ast.children.first.type === AT_RULE && ast.children.first.name.toLowerCase() === CHARSET_IDENTIFIER) {
			const charsetNode = ast.children.first;
			const cssCharset = charsetNode.prelude.children.first.value.toLowerCase();
			if (cssCharset !== UTF8_CHARSET && cssCharset !== charset) {
				resource.data = decodeString(rawData, cssCharset);
				ast = cssTree.parse(resource.data);
			}
			ast.children.remove(ast.children.head);
			resource.data = cssTree.generate(ast);
		}
		// eslint-disable-next-line no-unused-vars
	} catch (_) {
		// ignored
	}
}

function processDocumentCharset(resource, rawData, charset, DOMParser) {
	const contentType = resource.contentType.split(";")[0];
	let dom = parseDOM(resource.data, contentType, DOMParser);
	let charserMetaElement = getMetaCharsetElement(dom.document.documentElement);
	if (charserMetaElement) {
		let htmlCharset = charserMetaElement.getAttribute(CHARSET_ATTRIBUTE);
		if (htmlCharset) {
			htmlCharset = htmlCharset.toLowerCase();
			if (htmlCharset !== UTF8_CHARSET && htmlCharset !== charset) {
				resource.data = decodeString(rawData, charset);
				dom = parseDOM(resource.data, contentType, DOMParser);
				charserMetaElement = getMetaCharsetElement(dom.document.documentElement);
			}
		}
		if (charserMetaElement) {
			charserMetaElement.remove();
		}
		resource.data = dom.serialize();
	}
	let metaElement = getMetaContentTypeElement(dom.document);
	if (metaElement) {
		const metaContentType = metaElement.getAttribute(CONTENT_ATTRIBUTE);
		const htmlCharset = getCharset(metaContentType);
		if (htmlCharset && htmlCharset !== UTF8_CHARSET && htmlCharset !== charset) {
			resource.data = decodeString(rawData, htmlCharset);
			dom = parseDOM(resource.data, contentType, DOMParser);
			metaElement = getMetaContentTypeElement(dom.document.documentElement);
		}
		if (metaElement) {
			metaElement.remove();
		}
		resource.data = dom.serialize();
	}
}

function getMetaCharsetElement(document) {
	const metaElements = document.getElementsByTagName(META_TAG);
	return Array.from(metaElements).find(metaElement => metaElement.getAttribute(CHARSET_ATTRIBUTE));
}

function getMetaContentTypeElement(document) {
	const metaElements = document.getElementsByTagName(META_TAG);
	return Array.from(metaElements).find(metaElement => metaElement.getAttribute(HTTP_EQUIV_ATTRIBUTE)
		&& metaElement.getAttribute(HTTP_EQUIV_ATTRIBUTE).toLowerCase() === CONTENT_TYPE_HEADER.toLowerCase());
}
