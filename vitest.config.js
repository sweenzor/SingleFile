import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		include: ["test/**/*.test.js"],
		benchmark: {
			include: ["test/**/*.bench.js"]
		}
	}
});
