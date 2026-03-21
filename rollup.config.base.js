import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

const EXTERNAL = ["single-file-core"];
const TERSER_HOOKS_OPTIONS = {
	mangle: {
		keep_fnames: true
	}
};

export function createConfig({ minify }) {
	const PLUGINS = [resolve({ moduleDirectories: ["node_modules"] })];

	function outputPlugins(terserOptions) {
		return minify ? [terser(terserOptions)] : [];
	}

	return [{
		input: ["single-file-core/single-file.js"],
		output: [{
			file: "lib/single-file.js",
			format: "umd",
			name: "singlefile",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/single-file-frames.js"],
		output: [{
			file: "lib/single-file-frames.js",
			format: "umd",
			name: "singlefile",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/single-file-bootstrap.js"],
		output: [{
			file: "lib/single-file-bootstrap.js",
			format: "umd",
			name: "singlefileBootstrap",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/single-file-hooks-frames.js"],
		output: [{
			file: "lib/single-file-hooks-frames.js",
			format: "iife",
			plugins: outputPlugins(TERSER_HOOKS_OPTIONS)
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/single-file-infobar.js"],
		output: [{
			file: "lib/single-file-infobar.js",
			format: "iife",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/vendor/zip/z-worker.js"],
		output: [{
			file: "lib/single-file-z-worker.js",
			format: "es",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/vendor/zip/zip.js"],
		output: [{
			file: "lib/single-file-zip.js",
			format: "es",
			plugins: outputPlugins()
		}],
		context: "this",
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/vendor/zip/zip.min.js"],
		output: [{
			file: "lib/single-file-zip.min.js",
			format: "es",
			plugins: outputPlugins()
		}],
		context: "this",
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["src/core/content/content-bootstrap.js"],
		output: [{
			file: "lib/single-file-extension-bootstrap.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/core/content/content-frames.js"],
		output: [{
			file: "lib/single-file-extension-frames.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/index.js"],
		output: [{
			file: "lib/single-file-extension-core.js",
			format: "umd",
			name: "extension",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/core/content/content.js"],
		output: [{
			file: "lib/single-file-extension.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/ui/content/content-ui-editor-web.js"],
		output: [{
			file: "lib/single-file-extension-editor.js",
			format: "iife",
			plugins: []
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["single-file-core/single-file-editor-helper.js"],
		output: [{
			file: "lib/single-file-extension-editor-helper.js",
			format: "umd",
			name: "singlefile",
			plugins: outputPlugins()
		}],
		plugins: PLUGINS,
		external: EXTERNAL
	}, {
		input: ["src/lib/single-file/browser-polyfill/chrome-browser-polyfill.js"],
		output: [{
			file: "lib/chrome-browser-polyfill.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/core/bg/index.js"],
		output: [{
			file: "lib/single-file-extension-background.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/lib/single-file/background.js"],
		output: [{
			file: "lib/single-file-background.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}, {
		input: ["src/lib/web-stream/index.js"],
		output: [{
			file: "lib/web-stream.js",
			format: "iife",
			plugins: outputPlugins()
		}]
	}];
}
