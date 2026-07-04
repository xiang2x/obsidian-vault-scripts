/**
 * Evaluate esbuild CJS output in a minimal CommonJS sandbox.
 */
export function evalCjs(
	code: string,
	sandbox: {
		require: (id: string) => unknown;
	},
): Record<string, unknown> {
	const module = { exports: {} as Record<string, unknown> };
	const exports = module.exports;
	const runner = new Function(
		"require",
		"module",
		"exports",
		`"use strict";\n${code}`,
	) as (
		require: (id: string) => unknown,
		module: { exports: Record<string, unknown> },
		exports: Record<string, unknown>,
	) => void;

	runner(sandbox.require, module, exports);
	return module.exports;
}
