import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.js"],
		benchmark: {
			include: ["test/**/*.bench.js"]
		},
		coverage: {
			provider: "v8",
			include: ["src/**/*.js"],
			exclude: ["src/lib/readability/**", "src/lib/mhtml-to-html/vendor/**"]
		}
	}
});
