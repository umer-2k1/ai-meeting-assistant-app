import { TSESTreeJSXAttributeLike, TSESTreeJSXElementLike } from "@eslint-react/ast";
import { TSESTree } from "@typescript-eslint/types";
import { RuleContext } from "@eslint-react/shared";

//#region src/find-attribute.d.ts
/**
 * Find a JSX attribute (or spread attribute containing the property) by name
 * on a given element.
 *
 * Returns the **last** matching attribute to mirror React's behaviour where
 * later props win, or `undefined` when the attribute is not present.
 *
 * Spread attributes are resolved when possible: if the spread argument is an
 * identifier that resolves to an object expression, the object's properties
 * are searched for a matching key.
 *
 * @param context - The ESLint rule context (needed for variable resolution in
 *                  spread attributes).
 * @param element - The `JSXElement` node to search.
 * @param name    - The attribute name to look for (e.g. `"className"`).
 * @returns The matching `JSXAttribute` or `JSXSpreadAttribute`, or
 *          `undefined` when not found.
 *
 * @example
 * ```ts
 * const attr = findAttribute(context, node, "sandbox");
 * if (attr != null) {
 *   // attribute (or spread containing it) exists on the element
 * }
 * ```
 */
declare function findAttribute(context: RuleContext, element: TSESTree.JSXElement, name: string): TSESTreeJSXAttributeLike | undefined;
//#endregion
//#region src/find-parent-attribute.d.ts
/**
 * Walk **up** the AST from `node` to find the nearest ancestor that is a
 * `JSXAttribute` and (optionally) passes a predicate.
 *
 * This is useful when a rule visitor enters a deeply‑nested node (e.g. a
 * `Literal` inside an expression container) and needs to know which JSX
 * attribute it belongs to.
 *
 * @param node - The starting node for the upward search.
 * @param test - Optional predicate to filter candidate `JSXAttribute` nodes.
 *               When omitted every `JSXAttribute` ancestor matches.
 * @returns The first matching `JSXAttribute` ancestor, or `null` if none is
 *          found before reaching the root.
 *
 * @example
 * ```ts
 * // Inside a Literal visitor, find the owning attribute:
 * const attr = findParentAttribute(literalNode);
 * if (attr != null) {
 *   console.log(getAttributeName(attr));
 * }
 * ```
 */
declare function findParentAttribute(node: TSESTree.Node, test?: (node: TSESTree.JSXAttribute) => boolean): TSESTree.JSXAttribute | null;
//#endregion
//#region src/get-attribute-name.d.ts
/**
 * Get the stringified name of a `JSXAttribute` node.
 *
 * Handles both simple identifiers and namespaced names:
 *
 * - `className`   -> `"className"`
 * - `aria-label`  -> `"aria-label"`
 * - `xml:space`   -> `"xml:space"`
 *
 * @param node - A `JSXAttribute` AST node.
 * @returns The attribute name as a plain string.
 *
 * @example
 * ```ts
 * import { getAttributeName } from "@eslint-react/jsx";
 *
 * // Inside a rule visitor:
 * JSXAttribute(node) {
 *   const name = getAttributeName(node); // "className"
 * }
 * ```
 */
declare function getAttributeName(node: TSESTree.JSXAttribute): string;
//#endregion
//#region src/get-attribute-static-value.d.ts
/**
 * Find an attribute by name on a JSX element and collapse its value to a
 * plain JavaScript value in a single step.
 *
 * This is a convenience composition of {@link findAttribute} ->
 * {@link resolveAttributeValue} -> `toStatic()`, with automatic handling
 * of the `spreadProps` case (extracts the named property from the spread
 * object).
 *
 * Returns `undefined` when the attribute is absent **or** when its value
 * cannot be statically determined.
 *
 * @param context - The ESLint rule context.
 * @param element - The `JSXElement` node to inspect.
 * @param name    - The attribute name to look up (e.g. `"className"`).
 * @returns The static value of the attribute, or `undefined`.
 *
 * @example
 * ```ts
 * // <iframe sandbox="allow-scripts" />
 * const sandbox = getAttributeStaticValue(context, node, "sandbox");
 * // -> "allow-scripts"
 *
 * // <button type={dynamicVar} />
 * const type = getAttributeStaticValue(context, node, "type");
 * // -> undefined  (cannot be resolved statically)
 * ```
 */
declare function getAttributeStaticValue(context: RuleContext, element: TSESTree.JSXElement, name: string): unknown;
//#endregion
//#region src/jsx-attribute-value.d.ts
/**
 * Discriminated union representing the resolved value of a JSX attribute.
 *
 * Each variant carries the original AST `node` (where applicable) and a
 * `toStatic()` helper that attempts to collapse the value into a plain
 * JavaScript value at analysis time.
 *
 * @example
 * ```ts
 * const value = resolveAttributeValue(context, attr);
 * switch (value.kind) {
 *   case "literal":
 *     console.log(value.toStatic()); // string | number | boolean | …
 *     break;
 *   case "unknown":
 *     // dynamic – toStatic() may return `undefined`
 *     break;
 * }
 * ```
 */
type JsxAttributeValue = JsxAttributeValueBoolean | JsxAttributeValueElement | JsxAttributeValueLiteral | JsxAttributeValueUnknown | JsxAttributeValueMissing | JsxAttributeValueSpreadChild | JsxAttributeValueSpreadProps;
/** Boolean attribute with no value (e.g. `<input disabled />`) */
interface JsxAttributeValueBoolean {
  readonly kind: "boolean";
  readonly node: null;
  toStatic(): true;
}
/** JSX element used as an attribute value (e.g. `<Slot icon=<Icon /> />`) */
interface JsxAttributeValueElement {
  readonly kind: "element";
  readonly node: TSESTree.JSXElement;
  toStatic(): null;
}
/** Literal value (e.g. `<img alt="photo" />`) */
interface JsxAttributeValueLiteral {
  readonly kind: "literal";
  readonly node: TSESTree.Literal;
  toStatic(): TSESTree.Literal["value"];
}
/** Expression container value (e.g. `<Comp value={expr} />`) */
interface JsxAttributeValueUnknown {
  readonly kind: "unknown";
  readonly node: TSESTree.JSXExpressionContainer["expression"];
  toStatic(): unknown;
}
/** Empty expression container (e.g. `<Comp value={} />`) */
interface JsxAttributeValueMissing {
  readonly kind: "missing";
  readonly node: TSESTree.JSXEmptyExpression;
  toStatic(): null;
}
/** Spread child expression (e.g. `{...items}` as children) */
interface JsxAttributeValueSpreadChild {
  readonly kind: "spreadChild";
  getChildren(at: number): unknown;
  readonly node: TSESTree.JSXSpreadChild["expression"];
  toStatic(): null;
}
/** Spread props (e.g. `<Comp {...props} />`) */
interface JsxAttributeValueSpreadProps {
  readonly kind: "spreadProps";
  getProperty(name: string): unknown;
  readonly node: TSESTree.JSXSpreadAttribute["argument"];
  toStatic(): null;
}
//#endregion
//#region src/get-attribute-value.d.ts
/**
 * Find an attribute by name on a JSX element **and** resolve its value in a
 * single call.
 *
 * This is a convenience composition of {@link findAttribute} and
 * {@link resolveAttributeValue} that eliminates the most common two-step
 * pattern in lint rules:
 *
 * ```ts
 * const attr = findAttribute(context, element, name);
 * if (attr == null) return;
 * const value = resolveAttributeValue(context, attr);
 * ```
 *
 * @param context - The ESLint rule context.
 * @param element - The `JSXElement` node to search.
 * @param name    - The attribute name to look up (e.g. `"className"`).
 * @returns A {@link JsxAttributeValue} descriptor, or `undefined` when the
 *          attribute is not present on the element.
 *
 * @example
 * ```ts
 * const value = getAttributeValue(context, node, "sandbox");
 * if (value?.kind === "literal") {
 *   console.log(value.toStatic()); // the literal value
 * }
 * ```
 */
declare function getAttributeValue(context: RuleContext, element: TSESTree.JSXElement, name: string): JsxAttributeValue | undefined;
//#endregion
//#region src/get-children.d.ts
/**
 * Get the **meaningful** children of a JSX element or fragment.
 *
 * Filters out "padding spaces" — `JSXText` nodes that consist entirely of
 * whitespace and contain at least one newline.  These nodes are artefacts of
 * source formatting that React trims away during rendering and are therefore
 * not considered meaningful content.
 *
 * @param element - A `JSXElement` or `JSXFragment` node.
 * @returns An array of children nodes that contribute to rendered output.
 *
 * @example
 * ```ts
 * import { getChildren } from "@eslint-react/jsx";
 *
 * // <div>
 * //   <span />
 * // </div>
 * //
 * // Raw children: [JSXText("\n  "), JSXElement(<span />), JSXText("\n")]
 * // getChildren:  [JSXElement(<span />)]
 *
 * const meaningful = getChildren(node);
 * ```
 */
declare function getChildren(element: TSESTreeJSXElementLike): TSESTree.JSXChild[];
//#endregion
//#region src/get-element-type.d.ts
/**
 * Get the string representation of a JSX element's type.
 *
 * - `<div>`              -> `"div"`
 * - `<Foo.Bar>`          -> `"Foo.Bar"`
 * - `<React.Fragment>`   -> `"React.Fragment"`
 * - `<></>`              -> `""`
 *
 * @param node - A `JSXElement` or `JSXFragment` node.
 * @returns The fully-qualified element type string.
 */
declare function getElementFullType(node: TSESTreeJSXElementLike): string;
/**
 * Get the **self name** (last dot-separated segment) of a JSX element type.
 *
 * - `<Foo.Bar.Baz>`  -> `"Baz"`
 * - `<div>`           -> `"div"`
 * - `<></>`           -> `""`
 *
 * @param node - A `JSXElement` or `JSXFragment` node.
 * @returns The last segment of the element type, or `""` for fragments.
 */
declare function getElementSelfType(node: TSESTreeJSXElementLike): string;
//#endregion
//#region src/has-any-attribute.d.ts
/**
 * Check whether a JSX element carries **at least one** of the given attributes.
 *
 * This is a batch variant of {@link hasAttribute} for the common pattern of
 * short-circuiting on multiple prop names:
 *
 * ```ts
 * // before
 * if (hasAttribute(ctx, el, "key")) return;
 * if (hasAttribute(ctx, el, "ref")) return;
 *
 * // after
 * if (hasAnyAttribute(ctx, el, ["key", "ref"])) return;
 * ```
 *
 * Spread attributes are taken into account (see {@link findAttribute}).
 *
 * @param context - The ESLint rule context (needed for variable resolution in
 *                  spread attributes).
 * @param element - The `JSXElement` node to inspect.
 * @param names   - The attribute names to look for.
 * @returns `true` when **at least one** of the attributes is present.
 */
declare function hasAnyAttribute(context: RuleContext, element: TSESTree.JSXElement, names: readonly string[]): boolean;
//#endregion
//#region src/has-attribute.d.ts
/**
 * Check whether a JSX element carries a given attribute (prop).
 *
 * This is a thin convenience wrapper around {@link findAttribute} for the
 * common case where you only need a boolean answer.
 *
 * Spread attributes are taken into account: `<Comp {...{ disabled: true }} />`
 * will report `true` for `"disabled"`.
 *
 * @param context - The ESLint rule context (needed for variable resolution in
 *                  spread attributes).
 * @param element - The `JSXElement` node to inspect.
 * @param name    - The attribute name to look for (e.g. `"className"`).
 * @returns `true` when the attribute is present on the element.
 *
 * @example
 * ```ts
 * import { hasAttribute } from "@eslint-react/jsx";
 *
 * if (hasAttribute(context, node, "key")) {
 *   // element has a `key` prop
 * }
 * ```
 */
declare function hasAttribute(context: RuleContext, element: TSESTree.JSXElement, name: string): boolean;
//#endregion
//#region src/has-children.d.ts
/**
 * Check whether a JSX element (or fragment) has **meaningful** children —
 * that is, at least one child that is not purely whitespace text.
 *
 * A `JSXText` child whose `raw` content is empty after trimming is
 * considered non-meaningful regardless of whether it contains a line break.
 * This matches React's rendering behaviour where whitespace-only text nodes
 * do not produce visible output.
 *
 * @param element - A `JSXElement` or `JSXFragment` node.
 * @returns `true` when the element has at least one meaningful child.
 *
 * @example
 * ```ts
 * import { hasChildren } from "@eslint-react/jsx";
 *
 * // <div>hello</div>           -> true
 * // <div>  {expr}  </div>      -> true
 * // <div>   </div>             -> false  (whitespace-only)
 * // <div>                      -> false  (whitespace-only, with newlines)
 * // </div>
 * // <div></div>                -> false  (no children at all)
 *
 * if (hasChildren(node)) {
 *   // element renders visible content
 * }
 * ```
 */
declare function hasChildren(element: TSESTreeJSXElementLike): boolean;
//#endregion
//#region src/has-every-attribute.d.ts
/**
 * Check whether a JSX element carries **all** of the given attributes (props).
 *
 * This is a batch variant of {@link hasAttribute} for the common pattern
 * where a rule needs to verify that a set of required props are all present.
 *
 * Spread attributes are taken into account (see {@link findAttribute}).
 *
 * @param context  - The ESLint rule context (needed for variable resolution in
 *                   spread attributes).
 * @param element  - The `JSXElement` node to inspect.
 * @param names    - The attribute names to look for.
 * @returns `true` when **every** name in `names` is present on the element.
 *
 * @example
 * ```ts
 * import { hasEveryAttribute } from "@eslint-react/jsx";
 *
 * // Ensure both `alt` and `src` are provided on an <img>
 * if (hasEveryAttribute(context, node, ["alt", "src"])) {
 *   // element has both props
 * }
 * ```
 */
declare function hasEveryAttribute(context: RuleContext, element: TSESTree.JSXElement, names: readonly string[]): boolean;
//#endregion
//#region src/is-element.d.ts
/**
 * A test that determines whether a JSX element matches.
 *
 * - `string`     — matches against the full element type (e.g. `"div"`,
 *                  `"React.Fragment"`)
 * - `string[]`   — matches when the element type equals **any** of the
 *                  given strings
 * - `function`   — receives the element type string and returns a boolean
 */
type ElementTest = string | readonly string[] | ((elementType: string, node: TSESTreeJSXElementLike) => boolean);
/**
 * Check whether a node is a `JSXElement` (or `JSXFragment`) and optionally
 * matches a given test.
 *
 * Modelled after
 * [`hast-util-is-element`](https://github.com/syntax-tree/hast-util-is-element):
 * the `test` parameter controls what counts as a match.
 *
 * When called **without** a test, the function acts as a simple type-guard
 * for `JSXElement | JSXFragment`.
 *
 * @param node - The AST node to test.
 * @param test - Optional test to match the element type against.
 * @returns `true` when the node is a matching JSX element.
 *
 * @example
 * ```ts
 * import { isElement } from "@eslint-react/jsx";
 *
 * // Type-guard only — any JSX element or fragment
 * if (isElement(node)) { … }
 *
 * // Match a single tag name
 * if (isElement(node, "iframe")) { … }
 *
 * // Match one of several tag names
 * if (isElement(node, ["button", "input", "select"])) { … }
 *
 * // Custom predicate
 * if (isElement(node, (type) => type.endsWith(".Provider"))) { … }
 * ```
 */
declare function isElement(node: TSESTree.Node | null | undefined, test?: ElementTest): node is TSESTreeJSXElementLike;
//#endregion
//#region src/is-fragment-element.d.ts
/**
 * Check whether a node is a React **Fragment** element.
 *
 * Recognises both the shorthand `<>…</>` syntax (`JSXFragment`) and the
 * explicit `<Fragment>` / `<React.Fragment>` form (`JSXElement`).
 *
 * The comparison is performed against the **self name** (last dot‑separated
 * segment) of both the node and the configured factory, so
 * `<React.Fragment>` matches `"React.Fragment"` and `<Fragment>` matches
 * `"Fragment"`.
 *
 * @param node                - The AST node to test.
 * @param jsxFragmentFactory  - The configured fragment factory string
 *                              (e.g. `"React.Fragment"`).  Defaults to
 *                              `"React.Fragment"`.
 * @returns `true` when the node represents a React Fragment.
 *
 * @example
 * ```ts
 * // Using the default factory
 * if (isFragmentElement(node)) { … }
 *
 * // With a custom factory from jsxConfig
 * const config = getJsxConfig(context);
 * if (isFragmentElement(node, config.jsxFragmentFactory)) { … }
 * ```
 */
declare function isFragmentElement(node: TSESTree.Node, jsxFragmentFactory?: string): node is TSESTreeJSXElementLike;
//#endregion
//#region src/is-host-element.d.ts
/**
 * Check whether a node is a **host** (intrinsic / DOM) element.
 *
 * A host element is a `JSXElement` whose tag name is a plain `JSXIdentifier`
 * starting with a lowercase letter – the same heuristic React uses to
 * distinguish `<div>` from `<MyComponent>`.
 *
 * @param node - The AST node to test.
 * @returns `true` when the node is a `JSXElement` with a lowercase tag name.
 *
 * @example
 * ```ts
 * // <div className="box" />  -> true
 * // <span />                 -> true
 * // <MyComponent />          -> false
 * // <Foo.Bar />              -> false
 * isHostElement(node);
 * ```
 */
declare function isHostElement(node: TSESTree.Node): node is TSESTree.JSXElement;
//#endregion
//#region src/jsx-detection-hint.d.ts
/**
 * BitFlags for configuring JSX detection behavior.
 *
 * Used by {@link isJsxLike} to control which AST node kinds are
 * considered "JSX-like". Combine flags with the `|` operator.
 *
 * @example
 * ```ts
 * const hint = JsxDetectionHint.DoNotIncludeJsxWithBooleanValue
 *   | JsxDetectionHint.DoNotIncludeJsxWithStringValue;
 *
 * isJsxLike(context, node, hint);
 * ```
 */
type JsxDetectionHint = bigint;
declare const JsxDetectionHint: {
  readonly None: 0n;
  readonly DoNotIncludeJsxWithNullValue: bigint;
  readonly DoNotIncludeJsxWithNumberValue: bigint;
  readonly DoNotIncludeJsxWithBigIntValue: bigint;
  readonly DoNotIncludeJsxWithStringValue: bigint;
  readonly DoNotIncludeJsxWithBooleanValue: bigint;
  readonly DoNotIncludeJsxWithUndefinedValue: bigint;
  readonly DoNotIncludeJsxWithEmptyArrayValue: bigint;
  readonly DoNotIncludeJsxWithCreateElementValue: bigint;
  readonly RequireAllArrayElementsToBeJsx: bigint;
  readonly RequireBothSidesOfLogicalExpressionToBeJsx: bigint;
  readonly RequireBothBranchesOfConditionalExpressionToBeJsx: bigint;
};
/**
 * Default JSX detection configuration.
 *
 * Skips number, bigint, boolean, string, and undefined literals –
 * the value types that are commonly returned alongside JSX in React
 * components but are not themselves renderable elements.
 */
declare const DEFAULT_JSX_DETECTION_HINT: JsxDetectionHint;
//#endregion
//#region src/is-jsx-like.d.ts
/**
 * Determine whether a node represents JSX-like content based on heuristics.
 *
 * The detection behaviour is configurable through {@link JsxDetectionHint}
 * bit-flags so that callers can opt individual value kinds in or out.
 *
 * @param context - The ESLint rule context (needed for variable resolution).
 * @param node    - The AST node to analyse.
 * @param hint    - Optional bit-flags to adjust detection behaviour.
 *                  Defaults to {@link DEFAULT_JSX_DETECTION_HINT}.
 * @returns Whether the node is considered JSX-like.
 *
 * @example
 * ```ts
 * import { isJsxLike } from "@eslint-react/jsx";
 *
 * if (isJsxLike(context, node)) {
 *   // node looks like it evaluates to a React element
 * }
 * ```
 */
declare function isJsxLike(context: RuleContext, node: TSESTree.Node | null, hint?: JsxDetectionHint): boolean;
//#endregion
//#region src/is-jsx-text.d.ts
/**
 * Check whether a node is a JSX text node.
 *
 * Returns `true` for both `JSXText` nodes and `Literal` nodes that appear
 * as direct children of a JSX element (the parser may represent inline text
 * with either node type depending on context).
 *
 * @param node - The AST node to test.
 * @returns `true` when `node` is a `JSXText` or `Literal`.
 */
declare function isJsxText(node: TSESTree.Node | null): node is TSESTree.JSXText | TSESTree.Literal;
//#endregion
//#region src/is-whitespace.d.ts
/**
 * Check whether a JSX child node is **whitespace padding** that React would
 * trim away during rendering.
 *
 * A child is considered whitespace padding when it is a `JSXText` node whose
 * raw content is empty after trimming **and** contains at least one newline.
 * This is the whitespace that appears between JSX tags purely for formatting:
 *
 * ```jsx
 * <div>
 *   <span />     ← the text between </span> and the next tag is padding
 *   <span />
 * </div>
 * ```
 *
 * Use {@link isWhitespaceText} for a looser check that also matches
 * whitespace‑only text that does **not** contain a newline.
 *
 * @param node - A JSX child node.
 * @returns `true` when the node is purely formatting whitespace.
 *
 * @example
 * ```ts
 * import { isWhitespace } from "@eslint-react/jsx";
 *
 * const meaningful = element.children.filter(
 *   (child) => !isWhitespace(child),
 * );
 * ```
 */
declare function isWhitespace(node: TSESTree.JSXChild): boolean;
/**
 * Check whether a JSX child node is **any** whitespace‑only text.
 *
 * This is a looser variant of {@link isWhitespace} — it matches every
 * `JSXText` node whose raw content is empty after trimming, regardless of
 * whether it contains a newline.
 *
 * @param node - A JSX child node.
 * @returns `true` when the node is a whitespace‑only `JSXText`.
 */
declare function isWhitespaceText(node: TSESTree.JSXChild): boolean;
//#endregion
//#region src/jsx-config.d.ts
/**
 * TypeScript `jsx` compiler option values.
 *
 * Mirrors `ts.JsxEmit` so that consumers do not need a direct dependency on
 * the TypeScript compiler.
 */
declare const JsxEmit: {
  readonly None: 0;
  readonly Preserve: 1;
  readonly React: 2;
  readonly ReactNative: 3;
  readonly ReactJSX: 4;
  readonly ReactJSXDev: 5;
};
/**
 * Resolved JSX configuration derived from compiler options and / or pragma
 * annotations found in the source file.
 */
interface JsxConfig {
  jsx?: number;
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  jsxImportSource?: string;
}
/**
 * Read JSX configuration from the TypeScript compiler options exposed by the
 * parser services.
 *
 * Falls back to sensible React defaults when no compiler options are
 * available (e.g. when the file is parsed without type information).
 *
 * @param context - The ESLint rule context.
 * @returns Fully‑populated `JsxConfig` derived from compiler options.
 */
declare function getJsxConfigFromCompilerOptions(context: RuleContext): Required<JsxConfig>;
/**
 * Extract JSX configuration from `@jsx`, `@jsxFrag`, `@jsxRuntime` and
 * `@jsxImportSource` pragma comments in the source file.
 *
 * The result is cached per `sourceCode` instance via a `WeakMap` so that
 * repeated calls from different rules analysing the same file are free.
 *
 * @param context - The ESLint rule context.
 * @returns Partial `JsxConfig` containing only the values found in pragmas.
 */
declare function getJsxConfigFromAnnotation(context: RuleContext): JsxConfig;
/**
 * Get the fully‑merged JSX configuration for the current file.
 *
 * Compiler options provide the base values; pragma annotations found in the
 * source override them where present.  The result is cached per `sourceCode`.
 *
 * This is the main entry‑point most consumers should use.
 *
 * @param context - The ESLint rule context.
 * @returns Fully‑populated, merged `JsxConfig`.
 */
declare function getJsxConfig(context: RuleContext): Required<JsxConfig>;
//#endregion
//#region src/resolve-attribute-value.d.ts
/**
 * Resolve the value of a JSX attribute (or spread attribute) into a
 * {@link JsxAttributeValue} descriptor that can be inspected further.
 *
 * This is the low‑level building block – it operates on a single attribute
 * node that the caller has already located.  For the higher‑level "find by
 * name **and** resolve" combo, see {@link getAttributeValue}.
 *
 * @param context   - The ESLint rule context (needed for scope look‑ups).
 * @param attribute - A `JSXAttribute` or `JSXSpreadAttribute` node.
 * @returns A discriminated‑union descriptor of the attribute's value.
 *
 * @example
 * ```ts
 * import { findAttribute, resolveAttributeValue } from "@eslint-react/jsx";
 *
 * const attr = findAttribute(context, element, "sandbox");
 * if (attr != null) {
 *   const value = resolveAttributeValue(context, attr);
 *   if (value.kind === "literal") {
 *     console.log(value.toStatic());
 *   }
 * }
 * ```
 */
declare function resolveAttributeValue(context: RuleContext, attribute: TSESTreeJSXAttributeLike): JsxAttributeValue;
//#endregion
export { DEFAULT_JSX_DETECTION_HINT, ElementTest, JsxAttributeValue, JsxConfig, JsxDetectionHint, JsxEmit, findAttribute, findParentAttribute, getAttributeName, getAttributeStaticValue, getAttributeValue, getChildren, getElementFullType, getElementSelfType, getJsxConfig, getJsxConfigFromAnnotation, getJsxConfigFromCompilerOptions, hasAnyAttribute, hasAttribute, hasChildren, hasEveryAttribute, isElement, isFragmentElement, isHostElement, isJsxLike, isJsxText, isWhitespace, isWhitespaceText, resolveAttributeValue };