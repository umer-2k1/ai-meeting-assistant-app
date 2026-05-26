import * as ast from "@eslint-react/ast";
import { findParent } from "@eslint-react/ast";
import { resolve } from "@eslint-react/var";
import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/types";
import { getStaticValue } from "@typescript-eslint/utils/ast-utils";
import { P, match } from "ts-pattern";
import { RE_ANNOTATION_JSX, RE_ANNOTATION_JSX_FRAG, RE_ANNOTATION_JSX_IMPORT_SOURCE, RE_ANNOTATION_JSX_RUNTIME } from "@eslint-react/shared";

//#region src/get-attribute-name.ts
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
function getAttributeName(node) {
	if (node.name.type === "JSXIdentifier") return node.name.name;
	return node.name.namespace.name + ":" + node.name.name.name;
}

//#endregion
//#region src/find-attribute.ts
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
function findAttribute(context, element, name) {
	return element.openingElement.attributes.findLast((attr) => {
		if (attr.type === AST_NODE_TYPES.JSXAttribute) return getAttributeName(attr) === name;
		switch (attr.argument.type) {
			case AST_NODE_TYPES.Identifier: {
				const initNode = resolve(context, attr.argument);
				if (initNode?.type === AST_NODE_TYPES.ObjectExpression) return ast.findProperty(initNode.properties, name) != null;
				return false;
			}
			case AST_NODE_TYPES.ObjectExpression: return ast.findProperty(attr.argument.properties, name) != null;
		}
		return false;
	});
}

//#endregion
//#region src/find-parent-attribute.ts
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
function findParentAttribute(node, test = () => true) {
	const guard = (n) => {
		return n.type === AST_NODE_TYPES.JSXAttribute && test(n);
	};
	return findParent(node, guard);
}

//#endregion
//#region src/resolve-attribute-value.ts
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
function resolveAttributeValue(context, attribute) {
	if (attribute.type === AST_NODE_TYPES.JSXAttribute) return resolveJsxAttribute(context, attribute);
	return resolveJsxSpreadAttribute(context, attribute);
}
function resolveJsxAttribute(context, node) {
	const scope = context.sourceCode.getScope(node);
	if (node.value == null) return {
		kind: "boolean",
		node: null,
		toStatic() {
			return true;
		}
	};
	switch (node.value.type) {
		case AST_NODE_TYPES.Literal: {
			const staticValue = node.value.value;
			return {
				kind: "literal",
				node: node.value,
				toStatic() {
					return staticValue;
				}
			};
		}
		case AST_NODE_TYPES.JSXExpressionContainer: {
			const expr = node.value.expression;
			if (expr.type === AST_NODE_TYPES.JSXEmptyExpression) return {
				kind: "missing",
				node: expr,
				toStatic() {
					return null;
				}
			};
			return {
				kind: "unknown",
				node: expr,
				toStatic() {
					return getStaticValue(expr, scope)?.value;
				}
			};
		}
		case AST_NODE_TYPES.JSXElement: return {
			kind: "element",
			node: node.value,
			toStatic() {
				return null;
			}
		};
		case AST_NODE_TYPES.JSXSpreadChild: return {
			kind: "spreadChild",
			getChildren(_at) {
				return null;
			},
			node: node.value.expression,
			toStatic() {
				return null;
			}
		};
	}
}
function resolveJsxSpreadAttribute(context, node) {
	const scope = context.sourceCode.getScope(node);
	return {
		kind: "spreadProps",
		getProperty(name) {
			return match(getStaticValue(node.argument, scope)?.value).with({ [name]: P.select(P.unknown) }, (v) => v).otherwise(() => null);
		},
		node: node.argument,
		toStatic() {
			return null;
		}
	};
}

//#endregion
//#region src/get-attribute-static-value.ts
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
function getAttributeStaticValue(context, element, name) {
	const attr = findAttribute(context, element, name);
	if (attr == null) return void 0;
	const resolved = resolveAttributeValue(context, attr);
	if (resolved.kind === "spreadProps") return resolved.getProperty(name);
	return resolved.toStatic();
}

//#endregion
//#region src/get-attribute-value.ts
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
function getAttributeValue(context, element, name) {
	const attr = findAttribute(context, element, name);
	if (attr == null) return void 0;
	return resolveAttributeValue(context, attr);
}

//#endregion
//#region src/get-children.ts
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
function getChildren(element) {
	return element.children.filter((child) => !isPaddingSpaces(child));
}
/**
* A `JSXText` node is considered **padding spaces** when it is purely
* whitespace *and* contains at least one newline character.
*
* These nodes are formatting artefacts (indentation between JSX tags) that
* React discards at render time.
*
* @param node The JSX child node to check.
* @internal
*/
function isPaddingSpaces(node) {
	if (node.type !== AST_NODE_TYPES.JSXText) return false;
	return node.raw.trim() === "" && node.raw.includes("\n");
}

//#endregion
//#region src/get-element-type.ts
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
function getElementFullType(node) {
	if (node.type === AST_NODE_TYPES.JSXFragment) return "";
	function getQualifiedName(node) {
		if (node.type === AST_NODE_TYPES.JSXIdentifier) return node.name;
		if (node.type === AST_NODE_TYPES.JSXNamespacedName) return node.namespace.name + ":" + node.name.name;
		return getQualifiedName(node.object) + "." + getQualifiedName(node.property);
	}
	return getQualifiedName(node.openingElement.name);
}
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
function getElementSelfType(node) {
	return getElementFullType(node).split(".").at(-1) ?? "";
}

//#endregion
//#region src/has-any-attribute.ts
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
function hasAnyAttribute(context, element, names) {
	return names.some((name) => findAttribute(context, element, name) != null);
}

//#endregion
//#region src/has-attribute.ts
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
function hasAttribute(context, element, name) {
	return findAttribute(context, element, name) != null;
}

//#endregion
//#region src/has-children.ts
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
function hasChildren(element) {
	if (element.children.length === 0) return false;
	return !element.children.every((child) => isWhitespaceText$1(child));
}
/**
* Whether a JSX child node is a whitespace-only `JSXText` node.
*
* Any `JSXText` whose raw content consists entirely of whitespace characters
* (spaces, tabs, newlines, etc.) is considered whitespace text.  Non-text
* nodes always return `false`.
* @param node The JSX child node to check.
*/
function isWhitespaceText$1(node) {
	if (node.type !== AST_NODE_TYPES.JSXText) return false;
	return node.raw.trim() === "";
}

//#endregion
//#region src/has-every-attribute.ts
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
function hasEveryAttribute(context, element, names) {
	return names.every((name) => findAttribute(context, element, name) != null);
}

//#endregion
//#region src/is-element.ts
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
function isElement(node, test) {
	if (node == null) return false;
	if (node.type !== AST_NODE_TYPES.JSXElement && node.type !== AST_NODE_TYPES.JSXFragment) return false;
	if (test == null) return true;
	const elementType = getElementFullType(node);
	if (typeof test === "string") return elementType === test;
	if (typeof test === "function") return test(elementType, node);
	return test.includes(elementType);
}

//#endregion
//#region src/is-fragment-element.ts
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
function isFragmentElement(node, jsxFragmentFactory = "React.Fragment") {
	if (node.type === AST_NODE_TYPES.JSXFragment) return true;
	if (node.type !== AST_NODE_TYPES.JSXElement) return false;
	const fragment = jsxFragmentFactory.split(".").at(-1) ?? "Fragment";
	return getElementFullType(node).split(".").at(-1) === fragment;
}

//#endregion
//#region src/is-host-element.ts
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
function isHostElement(node) {
	return node.type === AST_NODE_TYPES.JSXElement && node.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier && /^[a-z]/u.test(node.openingElement.name.name);
}

//#endregion
//#region src/jsx-detection-hint.ts
const JsxDetectionHint = {
	None: 0n,
	DoNotIncludeJsxWithNullValue: 1n << 0n,
	DoNotIncludeJsxWithNumberValue: 1n << 1n,
	DoNotIncludeJsxWithBigIntValue: 1n << 2n,
	DoNotIncludeJsxWithStringValue: 1n << 3n,
	DoNotIncludeJsxWithBooleanValue: 1n << 4n,
	DoNotIncludeJsxWithUndefinedValue: 1n << 5n,
	DoNotIncludeJsxWithEmptyArrayValue: 1n << 6n,
	DoNotIncludeJsxWithCreateElementValue: 1n << 7n,
	RequireAllArrayElementsToBeJsx: 1n << 8n,
	RequireBothSidesOfLogicalExpressionToBeJsx: 1n << 9n,
	RequireBothBranchesOfConditionalExpressionToBeJsx: 1n << 10n
};
/**
* Default JSX detection configuration.
*
* Skips number, bigint, boolean, string, and undefined literals –
* the value types that are commonly returned alongside JSX in React
* components but are not themselves renderable elements.
*/
const DEFAULT_JSX_DETECTION_HINT = 0n | JsxDetectionHint.DoNotIncludeJsxWithNumberValue | JsxDetectionHint.DoNotIncludeJsxWithBigIntValue | JsxDetectionHint.DoNotIncludeJsxWithBooleanValue | JsxDetectionHint.DoNotIncludeJsxWithStringValue | JsxDetectionHint.DoNotIncludeJsxWithUndefinedValue;

//#endregion
//#region src/is-jsx-like.ts
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
function isJsxLike(context, node, hint = DEFAULT_JSX_DETECTION_HINT) {
	if (node == null) return false;
	if (ast.isJSX(node)) return true;
	switch (node.type) {
		case AST_NODE_TYPES.Literal:
			switch (typeof node.value) {
				case "boolean": return !(hint & JsxDetectionHint.DoNotIncludeJsxWithBooleanValue);
				case "string": return !(hint & JsxDetectionHint.DoNotIncludeJsxWithStringValue);
				case "number": return !(hint & JsxDetectionHint.DoNotIncludeJsxWithNumberValue);
				case "bigint": return !(hint & JsxDetectionHint.DoNotIncludeJsxWithBigIntValue);
			}
			if (node.value == null) return !(hint & JsxDetectionHint.DoNotIncludeJsxWithNullValue);
			return false;
		case AST_NODE_TYPES.TemplateLiteral: return !(hint & JsxDetectionHint.DoNotIncludeJsxWithStringValue);
		case AST_NODE_TYPES.ArrayExpression:
			if (node.elements.length === 0) return !(hint & JsxDetectionHint.DoNotIncludeJsxWithEmptyArrayValue);
			if (hint & JsxDetectionHint.RequireAllArrayElementsToBeJsx) return node.elements.every((n) => isJsxLike(context, n, hint));
			return node.elements.some((n) => isJsxLike(context, n, hint));
		case AST_NODE_TYPES.LogicalExpression:
			if (hint & JsxDetectionHint.RequireBothSidesOfLogicalExpressionToBeJsx) return isJsxLike(context, node.left, hint) && isJsxLike(context, node.right, hint);
			return isJsxLike(context, node.left, hint) || isJsxLike(context, node.right, hint);
		case AST_NODE_TYPES.ConditionalExpression: {
			const consequentIsJsx = Array.isArray(node.consequent) ? checkArray(context, node.consequent, hint) : isJsxLike(context, node.consequent, hint);
			const alternateIsJsx = isJsxLike(context, node.alternate, hint);
			if (hint & JsxDetectionHint.RequireBothBranchesOfConditionalExpressionToBeJsx) return consequentIsJsx && alternateIsJsx;
			return consequentIsJsx || alternateIsJsx;
		}
		case AST_NODE_TYPES.SequenceExpression: return isJsxLike(context, node.expressions.at(-1) ?? null, hint);
		case AST_NODE_TYPES.CallExpression:
			if (hint & JsxDetectionHint.DoNotIncludeJsxWithCreateElementValue) return false;
			switch (node.callee.type) {
				case AST_NODE_TYPES.Identifier: return node.callee.name === "createElement";
				case AST_NODE_TYPES.MemberExpression: return node.callee.property.type === AST_NODE_TYPES.Identifier && node.callee.property.name === "createElement";
			}
			return false;
		case AST_NODE_TYPES.Identifier:
			if (node.name === "undefined") return !(hint & JsxDetectionHint.DoNotIncludeJsxWithUndefinedValue);
			if (ast.isJSXTagNameExpression(node)) return true;
			return isJsxLike(context, resolve(context, node), hint);
	}
	return false;
}
function checkArray(context, elements, hint) {
	if (elements.length === 0) return !(hint & JsxDetectionHint.DoNotIncludeJsxWithEmptyArrayValue);
	if (hint & JsxDetectionHint.RequireAllArrayElementsToBeJsx) return elements.every((n) => isJsxLike(context, n, hint));
	return elements.some((n) => isJsxLike(context, n, hint));
}

//#endregion
//#region src/is-jsx-text.ts
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
function isJsxText(node) {
	if (node == null) return false;
	return node.type === AST_NODE_TYPES.JSXText || node.type === AST_NODE_TYPES.Literal;
}

//#endregion
//#region src/is-whitespace.ts
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
function isWhitespace(node) {
	if (node.type !== AST_NODE_TYPES.JSXText) return false;
	return node.raw.trim() === "" && node.raw.includes("\n");
}
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
function isWhitespaceText(node) {
	if (node.type !== AST_NODE_TYPES.JSXText) return false;
	return node.raw.trim() === "";
}

//#endregion
//#region src/jsx-config.ts
/**
* TypeScript `jsx` compiler option values.
*
* Mirrors `ts.JsxEmit` so that consumers do not need a direct dependency on
* the TypeScript compiler.
*/
const JsxEmit = {
	None: 0,
	Preserve: 1,
	React: 2,
	ReactNative: 3,
	ReactJSX: 4,
	ReactJSXDev: 5
};
/**
* Weak‑map cache keyed by `sourceCode` so that the (potentially expensive)
* pragma‑scanning pass runs at most once per file.
*/
const annotationCache = /* @__PURE__ */ new WeakMap();
/**
* Weak‑map cache for the fully‑merged config (compiler options + annotation).
*/
const mergedCache = /* @__PURE__ */ new WeakMap();
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
function getJsxConfigFromCompilerOptions(context) {
	const options = context.sourceCode.parserServices?.program?.getCompilerOptions() ?? {};
	return {
		jsx: options.jsx ?? JsxEmit.ReactJSX,
		jsxFactory: options.jsxFactory ?? "React.createElement",
		jsxFragmentFactory: options.jsxFragmentFactory ?? "React.Fragment",
		jsxImportSource: options.jsxImportSource ?? "react"
	};
}
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
function getJsxConfigFromAnnotation(context) {
	const cached = annotationCache.get(context.sourceCode);
	if (cached != null) return cached;
	const options = {};
	if (!context.sourceCode.text.includes("@jsx")) {
		annotationCache.set(context.sourceCode, options);
		return options;
	}
	let jsx, jsxFrag, jsxRuntime, jsxImportSource;
	for (const comment of context.sourceCode.getAllComments().reverse()) {
		const value = comment.value;
		jsx ??= value.match(RE_ANNOTATION_JSX)?.[1];
		jsxFrag ??= value.match(RE_ANNOTATION_JSX_FRAG)?.[1];
		jsxRuntime ??= value.match(RE_ANNOTATION_JSX_RUNTIME)?.[1];
		jsxImportSource ??= value.match(RE_ANNOTATION_JSX_IMPORT_SOURCE)?.[1];
	}
	if (jsx != null) options.jsxFactory = jsx;
	if (jsxFrag != null) options.jsxFragmentFactory = jsxFrag;
	if (jsxRuntime != null) options.jsx = jsxRuntime === "classic" ? JsxEmit.React : JsxEmit.ReactJSX;
	if (jsxImportSource != null) options.jsxImportSource = jsxImportSource;
	annotationCache.set(context.sourceCode, options);
	return options;
}
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
function getJsxConfig(context) {
	const cached = mergedCache.get(context.sourceCode);
	if (cached != null) return cached;
	const merged = {
		...getJsxConfigFromCompilerOptions(context),
		...getJsxConfigFromAnnotation(context)
	};
	mergedCache.set(context.sourceCode, merged);
	return merged;
}

//#endregion
export { DEFAULT_JSX_DETECTION_HINT, JsxDetectionHint, JsxEmit, findAttribute, findParentAttribute, getAttributeName, getAttributeStaticValue, getAttributeValue, getChildren, getElementFullType, getElementSelfType, getJsxConfig, getJsxConfigFromAnnotation, getJsxConfigFromCompilerOptions, hasAnyAttribute, hasAttribute, hasChildren, hasEveryAttribute, isElement, isFragmentElement, isHostElement, isJsxLike, isJsxText, isWhitespace, isWhitespaceText, resolveAttributeValue };