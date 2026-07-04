import { VS_NOT_READY } from "../shared/constants";
import type { VsProxy } from "./types";

/**
 * M3 之前的占位代理：访问任意导出名时给出明确错误。
 */
export function createStubVsProxy(): VsProxy {
	return new Proxy({} as VsProxy, {
		get(_target, prop) {
			if (prop === "then") {
				return undefined;
			}
			throw new Error(`${VS_NOT_READY} (vs.${String(prop)})`);
		},
	});
}
