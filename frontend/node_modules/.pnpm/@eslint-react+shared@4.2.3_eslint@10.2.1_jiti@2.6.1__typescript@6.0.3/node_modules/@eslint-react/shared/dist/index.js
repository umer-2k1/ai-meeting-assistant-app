import module from "node:module";
import path from "node:path";
import { P, match } from "ts-pattern";
import { z } from "zod/v4";

//#region src/_id.ts
/**
* A generator for unique ids.
*/
var IdGenerator = class {
	n;
	prefix;
	/**
	* @param prefix Optional. A prefix of generated ids.
	*/
	constructor(prefix = "id_") {
		this.prefix = prefix;
		this.n = 0n;
	}
	/**
	* Generates an id.
	* @returns A generated id.
	*/
	next() {
		this.n = 1n + this.n;
		return this.prefix + this.n.toString(16);
	}
};

//#endregion
//#region src/constants.ts
/**
* The NPM scope for this project.
*/
const NPM_SCOPE = "@eslint-react";
/**
* The GitHub repository for this project.
*/
const GITHUB_URL = "https://github.com/Rel1cx/eslint-react";
/**
* The URL to the project's website.
*/
const WEBSITE_URL = "https://eslint-react.xyz";
/**
* Regular expressions for matching a HTML tag name
*/
const RE_HTML_TAG = /^[a-z][^-]*$/u;
/**
* Regular expression for matching a TypeScript file extension.
*/
const RE_TS_EXT = /^[cm]?tsx?$/u;
/**
* Regular expression for matching a JavaScript file extension.
*/
const RE_JS_EXT = /^[cm]?jsx?$/u;
/**
* Regular expression for matching a PascalCase string.
*/
const RE_PASCAL_CASE = /^[A-Z][\dA-Za-z]*$/u;
/**
* Regular expression for matching a camelCase string.
*/
const RE_CAMEL_CASE = /^[a-z][\dA-Za-z]*$/u;
/**
* Regular expression for matching a kebab-case string.
*/
const RE_KEBAB_CASE = /^[a-z][\d\-a-z]*$/u;
/**
* Regular expression for matching a snake_case string.
*/
const RE_SNAKE_CASE = /^[a-z][\d_a-z]*$/u;
/**
* Regular expression for matching a CONSTANT_CASE string.
*/
const RE_CONSTANT_CASE = /^[A-Z][\d_A-Z]*$/u;
const RE_JAVASCRIPT_PROTOCOL = /^[\u0000-\u001F ]*j[\t\n\r]*a[\t\n\r]*v[\t\n\r]*a[\t\n\r]*s[\t\n\r]*c[\t\n\r]*r[\t\n\r]*i[\t\n\r]*p[\t\n\r]*t[\t\n\r]*:/iu;
/**
* Regular expression for matching a valid JavaScript identifier.
*/
const RE_JS_IDENTIFIER = /^[_$a-z][\w$]*$/i;
/**
* Regular expression for matching a RegExp string.
*/
const RE_REGEXP_STR = /^\/(.+)\/([A-Za-z]*)$/u;
/**
* Regular expression for matching a `@jsx` annotation comment.
*/
const RE_ANNOTATION_JSX = /@jsx\s+(\S+)/u;
/**
* Regular expression for matching a `@jsxFrag` annotation comment.
*/
const RE_ANNOTATION_JSX_FRAG = /@jsxFrag\s+(\S+)/u;
/**
* Regular expression for matching a `@jsxRuntime` annotation comment.
*/
const RE_ANNOTATION_JSX_RUNTIME = /@jsxRuntime\s+(\S+)/u;
/**
* Regular expression for matching a `@jsxImportSource` annotation comment.
*/
const RE_ANNOTATION_JSX_IMPORT_SOURCE = /@jsxImportSource\s+(\S+)/u;
/**
* Regular expression for matching a React component name.
*/
const RE_COMPONENT_NAME = /^[A-Z]/u;
/**
* Regular expression for matching a React component name (loose).
*/
const RE_COMPONENT_NAME_LOOSE = /^_?[A-Z]/u;
/**
* Regular expression for matching a React Hook name.
*/
const RE_HOOK_NAME = /^use/u;
/**
* Known impure functions
*/
const IMPURE_FUNCS = new Map([
	["Atomics", new Set([
		"add",
		"and",
		"compareExchange",
		"exchange",
		"load",
		"notify",
		"or",
		"store",
		"sub",
		"wait",
		"waitAsync",
		"xor"
	])],
	["caches", new Set([
		"delete",
		"has",
		"keys",
		"match",
		"open"
	])],
	["clipboard", new Set([
		"read",
		"readText",
		"write",
		"writeText"
	])],
	["cookieStore", new Set([
		"delete",
		"get",
		"getAll",
		"set"
	])],
	["crypto", new Set(["getRandomValues", "randomUUID"])],
	["Date", new Set(["now"])],
	["document", new Set([
		"adoptNode",
		"append",
		"close",
		"createAttribute",
		"createAttributeNS",
		"createCDATASection",
		"createComment",
		"createDocumentFragment",
		"createDocumentType",
		"createElement",
		"createElementNS",
		"createEvent",
		"createNodeIterator",
		"createProcessingInstruction",
		"createRange",
		"createTextNode",
		"createTreeWalker",
		"elementFromPoint",
		"elementsFromPoint",
		"execCommand",
		"exitFullscreen",
		"exitPictureInPicture",
		"exitPointerLock",
		"getAnimations",
		"getElementById",
		"getElementsByClassName",
		"getElementsByName",
		"getElementsByTagName",
		"getElementsByTagNameNS",
		"getSelection",
		"hasFocus",
		"importNode",
		"open",
		"prepend",
		"querySelector",
		"querySelectorAll",
		"replaceChildren",
		"requestStorageAccess",
		"startViewTransition",
		"write",
		"writeln"
	])],
	["globalThis", new Set([
		"addEventListener",
		"alert",
		"alert",
		"blur",
		"cancelAnimationFrame",
		"cancelIdleCallback",
		"clearInterval",
		"clearInterval",
		"clearTimeout",
		"clearTimeout",
		"close",
		"confirm",
		"confirm",
		"dispatchEvent",
		"fetch",
		"fetch",
		"focus",
		"getComputedStyle",
		"getSelection",
		"matchMedia",
		"moveBy",
		"moveTo",
		"open",
		"postMessage",
		"postMessage",
		"print",
		"prompt",
		"prompt",
		"queueMicrotask",
		"queueMicrotask",
		"removeEventListener",
		"reportError",
		"requestAnimationFrame",
		"requestIdleCallback",
		"resizeBy",
		"resizeTo",
		"scroll",
		"scrollBy",
		"scrollTo",
		"setInterval",
		"setInterval",
		"setTimeout",
		"setTimeout",
		"stop",
		"structuredClone"
	])],
	["history", new Set([
		"back",
		"forward",
		"go",
		"pushState",
		"replaceState"
	])],
	["indexedDB", new Set([
		"databases",
		"deleteDatabase",
		"open"
	])],
	["localStorage", new Set([
		"clear",
		"getItem",
		"key",
		"removeItem",
		"setItem"
	])],
	["location", new Set([
		"assign",
		"reload",
		"replace"
	])],
	["Math", new Set(["random"])],
	["navigation", new Set([
		"back",
		"forward",
		"navigate",
		"reload",
		"traverseTo",
		"updateCurrentEntry"
	])],
	["navigator", new Set([
		"canShare",
		"getBattery",
		"getGamepads",
		"getUserMedia",
		"javaEnabled",
		"registerProtocolHandler",
		"requestMediaKeySystemAccess",
		"requestMIDIAccess",
		"sendBeacon",
		"share",
		"vibrate"
	])],
	["Notification", new Set(["requestPermission"])],
	["Object", new Set([
		"assign",
		"defineProperties",
		"defineProperty",
		"freeze",
		"preventExtensions",
		"seal",
		"setPrototypeOf"
	])],
	["performance", new Set([
		"clearMarks",
		"clearMeasures",
		"getEntries",
		"getEntriesByName",
		"getEntriesByType",
		"mark",
		"measure",
		"now"
	])],
	["process", new Set([
		"abort",
		"chdir",
		"cpuUsage",
		"emitWarning",
		"exit",
		"hrtime",
		"kill",
		"memoryUsage",
		"nextTick",
		"send",
		"stderr",
		"stdout"
	])],
	["Reflect", new Set([
		"defineProperty",
		"deleteProperty",
		"preventExtensions",
		"set",
		"setPrototypeOf"
	])],
	["scheduler", new Set(["postTask", "yield"])],
	["sessionStorage", new Set([
		"clear",
		"getItem",
		"key",
		"removeItem",
		"setItem"
	])],
	["URL", new Set(["createObjectURL", "revokeObjectURL"])],
	["window", new Set([
		"addEventListener",
		"alert",
		"alert",
		"blur",
		"cancelAnimationFrame",
		"cancelIdleCallback",
		"clearInterval",
		"clearInterval",
		"clearTimeout",
		"clearTimeout",
		"close",
		"confirm",
		"confirm",
		"dispatchEvent",
		"fetch",
		"fetch",
		"focus",
		"getComputedStyle",
		"getSelection",
		"matchMedia",
		"moveBy",
		"moveTo",
		"open",
		"postMessage",
		"postMessage",
		"print",
		"prompt",
		"prompt",
		"queueMicrotask",
		"queueMicrotask",
		"removeEventListener",
		"reportError",
		"requestAnimationFrame",
		"requestIdleCallback",
		"resizeBy",
		"resizeTo",
		"scroll",
		"scrollBy",
		"scrollTo",
		"setInterval",
		"setInterval",
		"setTimeout",
		"setTimeout",
		"stop",
		"structuredClone"
	])]
]);
/**
* Known impure global constructors used with `new`
*/
const IMPURE_CTORS = new Set([
	"Audio",
	"AudioContext",
	"BroadcastChannel",
	"Date",
	"EventSource",
	"FileReader",
	"Image",
	"IntersectionObserver",
	"MediaRecorder",
	"MediaSource",
	"MediaStream",
	"MessageChannel",
	"MutationObserver",
	"Notification",
	"OfflineAudioContext",
	"PerformanceObserver",
	"ReportingObserver",
	"ResizeObserver",
	"RTCPeerConnection",
	"SharedWorker",
	"WebSocket",
	"Worker",
	"XMLHttpRequest"
]);
/**
* Known pure functions
*/
const PURE_FUNCS = new Map([
	["Array", new Set([
		"from",
		"isArray",
		"of"
	])],
	["Atomics", new Set(["isLockFree"])],
	["BigInt", new Set(["asIntN", "asUintN"])],
	["Date", new Set(["parse", "UTC"])],
	["globalThis", new Set([
		"atob",
		"Boolean",
		"btoa",
		"decodeURI",
		"decodeURIComponent",
		"encodeURI",
		"encodeURIComponent",
		"escape",
		"isFinite",
		"isNaN",
		"Number",
		"parseFloat",
		"parseInt",
		"String",
		"unescape"
	])],
	["JSON", new Set(["parse", "stringify"])],
	["Math", new Set([
		"abs",
		"acos",
		"acosh",
		"asin",
		"asinh",
		"atan",
		"atan2",
		"atanh",
		"cbrt",
		"ceil",
		"clz32",
		"cos",
		"cosh",
		"exp",
		"expm1",
		"floor",
		"fround",
		"hypot",
		"imul",
		"log",
		"log1p",
		"log2",
		"log10",
		"max",
		"min",
		"pow",
		"round",
		"sign",
		"sin",
		"sinh",
		"sqrt",
		"tan",
		"tanh",
		"trunc"
	])],
	["Number", new Set([
		"isFinite",
		"isInteger",
		"isNaN",
		"isSafeInteger",
		"parseFloat",
		"parseInt"
	])],
	["Object", new Set([
		"entries",
		"fromEntries",
		"getOwnPropertyDescriptor",
		"getOwnPropertyDescriptors",
		"getOwnPropertyNames",
		"getOwnPropertySymbols",
		"getPrototypeOf",
		"groupBy",
		"hasOwn",
		"is",
		"isExtensible",
		"isFrozen",
		"isSealed",
		"keys",
		"values"
	])],
	["Reflect", new Set([
		"apply",
		"construct",
		"get",
		"getOwnPropertyDescriptor",
		"getPrototypeOf",
		"has",
		"isExtensible",
		"ownKeys"
	])],
	["String", new Set([
		"fromCharCode",
		"fromCodePoint",
		"raw"
	])]
]);
/**
Known pure global constructors used with `new`
*/
const PURE_CTORS = new Set([
	"Array",
	"ArrayBuffer",
	"BigInt64Array",
	"BigUint64Array",
	"DataView",
	"Error",
	"EvalError",
	"FinalizationRegistry",
	"Float32Array",
	"Float64Array",
	"Int8Array",
	"Int16Array",
	"Int32Array",
	"Map",
	"RangeError",
	"ReferenceError",
	"RegExp",
	"Set",
	"SyntaxError",
	"TypeError",
	"Uint8Array",
	"Uint8ClampedArray",
	"Uint16Array",
	"Uint32Array",
	"URIError",
	"URL",
	"URLSearchParams",
	"WeakMap",
	"WeakRef",
	"WeakSet"
]);

//#endregion
//#region src/define-rule-listener.ts
/**
* Defines a rule listener by merging multiple visitor objects
*
* @param base Base visitor object (target of merge)
* @param rest Additional visitor objects to merge (one or more)
* @returns Merged RuleListener object
*
* @example
* ```typescript
* const listener1 = { Identifier: () => console.log(1) };
* const listener2 = { Identifier: () => console.log(2) };
* const merged = defineRuleListener(listener1, listener2);
* // When encountering Identifier nodes, outputs 1 then 2
* ```
*/
function defineRuleListener(base, ...rest) {
	for (const r of rest) for (const key in r) {
		const existing = base[key];
		base[key] = existing ? (...args) => {
			existing(...args);
			r[key]?.(...args);
		} : r[key];
	}
	return base;
}

//#endregion
//#region ../../.pkgs/eff/dist/index.js
/**
* Returns its argument.
*
* @param x - The value to return.
* @returns The input value unchanged.
*/
function identity(x) {
	return x;
}
/**
* Creates a function that can be used in a data-last (aka `pipe`able) or
* data-first style.
*
* The first parameter to `dual` is either the arity of the uncurried function
* or a predicate that determines if the function is being used in a data-first
* or data-last style.
*
* Using the arity is the most common use case, but there are some cases where
* you may want to use a predicate. For example, if you have a function that
* takes an optional argument, you can use a predicate to determine if the
* function is being used in a data-first or data-last style.
*
* You can pass either the arity of the uncurried function or a predicate
* which determines if the function is being used in a data-first or
* data-last style.
*
* **Example** (Using arity to determine data-first or data-last style)
*
* ```ts
* import { dual, pipe } from "effect/Function"
*
* const sum = dual<
*   (that: number) => (self: number) => number,
*   (self: number, that: number) => number
* >(2, (self, that) => self + that)
*
* console.log(sum(2, 3)) // 5
* console.log(pipe(2, sum(3))) // 5
* ```
*
* **Example** (Using call signatures to define the overloads)
*
* ```ts
* import { dual, pipe } from "effect/Function"
*
* const sum: {
*   (that: number): (self: number) => number
*   (self: number, that: number): number
* } = dual(2, (self: number, that: number): number => self + that)
*
* console.log(sum(2, 3)) // 5
* console.log(pipe(2, sum(3))) // 5
* ```
*
* **Example** (Using a predicate to determine data-first or data-last style)
*
* ```ts
* import { dual, pipe } from "effect/Function"
*
* const sum = dual<
*   (that: number) => (self: number) => number,
*   (self: number, that: number) => number
* >(
*   (args) => args.length === 2,
*   (self, that) => self + that
* )
*
* console.log(sum(2, 3)) // 5
* console.log(pipe(2, sum(3))) // 5
* ```
*
* @param arity - The arity of the uncurried function or a predicate that determines if the function is being used in a data-first or data-last style.
* @param body - The function to be curried.
* @since 1.0.0
*/
const dual = function(arity, body) {
	if (typeof arity === "function") return function() {
		return arity(arguments) ? body.apply(this, arguments) : ((self) => body(self, ...arguments));
	};
	switch (arity) {
		case 0:
		case 1: throw new RangeError(`Invalid arity ${arity}`);
		case 2: return function(a, b) {
			if (arguments.length >= 2) return body(a, b);
			return function(self) {
				return body(self, a);
			};
		};
		case 3: return function(a, b, c) {
			if (arguments.length >= 3) return body(a, b, c);
			return function(self) {
				return body(self, a, b);
			};
		};
		default: return function() {
			if (arguments.length >= arity) return body.apply(this, arguments);
			const args = arguments;
			return function(self) {
				return body(self, ...args);
			};
		};
	}
};
/**
* Do nothing and return `false`.
*
* @returns false
*/
function constFalse() {
	return false;
}
/**
* Composes two functions, `ab` and `bc` into a single function that takes in an argument `a` of type `A` and returns a result of type `C`.
* The result is obtained by first applying the `ab` function to `a` and then applying the `bc` function to the result of `ab`.
*
* @param self - The first function to apply (or the composed function in data-last style).
* @param bc - The second function to apply.
* @returns A composed function that applies both functions in sequence.
* @example
* ```ts
* import * as assert from "node:assert"
* import { compose } from "effect/Function"
*
* const increment = (n: number) => n + 1;
* const square = (n: number) => n * n;
*
* assert.strictEqual(compose(increment, square)(2), 9);
* ```
*
* @since 1.0.0
*/
const compose = dual(2, (ab, bc) => (a) => bc(ab(a)));
function getOrInsertComputed(map, key, callback) {
	if (map.has(key)) return map.get(key);
	const value = callback(key);
	map.set(key, value);
	return value;
}

//#endregion
//#region src/react-version.ts
const _require = module.createRequire(process.cwd() + path.sep);
/**
* Gets the React version from the project's dependencies.
* @param fallback The fallback version to return if React is not found.
* @returns The detected React version or the fallback version.
*/
function getReactVersion(fallback) {
	try {
		return match(_require("react")).with({ version: P.select(P.string) }, identity).otherwise(() => fallback);
	} catch {
		return fallback;
	}
}

//#endregion
//#region src/regexp.ts
/**
* Convert a string to the `RegExp`.
* Normal strings (ex: `"foo"`) is converted to `/^foo$/` of `RegExp`.
* Strings like `"/^foo/i"` are converted to `/^foo/i` of `RegExp`.
* @see https://github.com/sveltejs/eslint-plugin-svelte/blob/main/packages/eslint-plugin-svelte/src/utils/regexp.ts
* @param string The string to convert.
* @returns Returns the `RegExp`.
*/
function toRegExp(string) {
	if (string == null) return { test: constFalse };
	const [, pattern, flags = "u"] = RE_REGEXP_STR.exec(string) ?? [];
	if (pattern != null) return new RegExp(pattern, flags);
	return { test: (s) => s === string };
}
/**
* Check whether given string is regexp string
* @param string The string to check
* @returns boolean
*/
function isRegExp(string) {
	return RE_REGEXP_STR.test(string);
}

//#endregion
//#region src/report.ts
/**
* Creates a report function for the given rule context.
* @param context The ESLint rule context.
* @returns A function that can be used to report violations.
*/
function report(context) {
	return (descriptor) => {
		if (descriptor == null) return;
		return context.report(descriptor);
	};
}

//#endregion
//#region src/settings.ts
/**
* @internal
*/
const ESLintReactSettingsSchema = z.object({
	importSource: z.optional(z.string()),
	compilationMode: z.optional(z.enum([
		"infer",
		"annotation",
		"syntax",
		"all"
	])),
	polymorphicPropName: z.optional(z.string()),
	version: z.optional(z.string()),
	additionalStateHooks: z.optional(z.string()),
	additionalEffectHooks: z.optional(z.string())
});
/**
* @internal
*/
const ESLintSettingsSchema = z.optional(z.object({ "react-x": z.optional(z.unknown()) }));
const DEFAULT_ESLINT_REACT_SETTINGS = {
	version: "detect",
	importSource: "react",
	polymorphicPropName: "as"
};
const DEFAULT_ESLINT_SETTINGS = { "react-x": DEFAULT_ESLINT_REACT_SETTINGS };
function isESLintSettings(settings) {
	return ESLintSettingsSchema.safeParse(settings).success;
}
function isESLintReactSettings(settings) {
	return ESLintReactSettingsSchema.safeParse(settings).success;
}
const decodeESLintSettings = (settings) => {
	if (isESLintSettings(settings)) return settings;
	return DEFAULT_ESLINT_SETTINGS;
};
const decodeSettings = (settings) => {
	if (isESLintReactSettings(settings)) return settings;
	return DEFAULT_ESLINT_REACT_SETTINGS;
};
const normalizeSettings = ({ importSource = "react", compilationMode, polymorphicPropName = "as", version, additionalStateHooks, additionalEffectHooks, ...rest }) => {
	return {
		...rest,
		importSource,
		compilationMode: compilationMode ?? "off",
		polymorphicPropName,
		version: match(version).with(P.union(P.nullish, "", "detect"), () => getReactVersion("19.2.4")).otherwise(identity),
		additionalStateHooks: toRegExp(additionalStateHooks),
		additionalEffectHooks: toRegExp(additionalEffectHooks)
	};
};
const cache = /* @__PURE__ */ new Map();
function getSettingsFromContext(context) {
	const settings = context.settings;
	return getOrInsertComputed(cache, settings["react-x"], () => normalizeSettings(decodeSettings(settings["react-x"])));
}

//#endregion
export { DEFAULT_ESLINT_REACT_SETTINGS, DEFAULT_ESLINT_SETTINGS, ESLintReactSettingsSchema, ESLintSettingsSchema, GITHUB_URL, IMPURE_CTORS, IMPURE_FUNCS, IdGenerator, NPM_SCOPE, PURE_CTORS, PURE_FUNCS, RE_ANNOTATION_JSX, RE_ANNOTATION_JSX_FRAG, RE_ANNOTATION_JSX_IMPORT_SOURCE, RE_ANNOTATION_JSX_RUNTIME, RE_CAMEL_CASE, RE_COMPONENT_NAME, RE_COMPONENT_NAME_LOOSE, RE_CONSTANT_CASE, RE_HOOK_NAME, RE_HTML_TAG, RE_JAVASCRIPT_PROTOCOL, RE_JS_EXT, RE_JS_IDENTIFIER, RE_KEBAB_CASE, RE_PASCAL_CASE, RE_REGEXP_STR, RE_SNAKE_CASE, RE_TS_EXT, WEBSITE_URL, decodeESLintSettings, decodeSettings, defineRuleListener, getReactVersion, getSettingsFromContext, isESLintReactSettings, isESLintSettings, isRegExp, normalizeSettings, report, toRegExp };