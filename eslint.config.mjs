import js from "@eslint/js";

export default [
	js.configs.recommended,
	{
		ignores: ["src/lib/readability/**"]
	},
	{
		languageOptions: {
			ecmaVersion: 2025,
			sourceType: "module",
			globals: {
				console: "readonly",
			}
		},
		rules: {
			"linebreak-style": [
				"error",
				"unix"
			],
			"quotes": [
				"error",
				"double"
			],
			"semi": [
				"error",
				"always"
			],
			"no-console": [
				"warn"
			],
			"eqeqeq": ["error", "always"],
			"prefer-const": "warn",
			"no-var": "warn",
		}
	}
];
