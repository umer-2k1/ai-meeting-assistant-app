import { DEFAULT_ESLINT_REACT_SETTINGS, IMPURE_CTORS, IMPURE_FUNCS, WEBSITE_URL, defineRuleListener, getSettingsFromContext, report, toRegExp } from "@eslint-react/shared";
import * as ast from "@eslint-react/ast";
import * as core from "@eslint-react/core";
import { isUseRefCall } from "@eslint-react/core";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { ESLintUtils } from "@typescript-eslint/utils";
import { P, isMatching, match } from "ts-pattern";
import ts from "typescript";
import { JsxDetectionHint, findParentAttribute, getElementFullType, hasAttribute, isJsxLike } from "@eslint-react/jsx";
import { computeObjectType, findEnclosingAssignmentTarget, isAssignmentTargetEqual, resolve } from "@eslint-react/var";
import { DefinitionType } from "@typescript-eslint/scope-manager";
import { findVariable, getStaticValue, isIdentifier, isVariableDeclarator } from "@typescript-eslint/utils/ast-utils";
import { compare } from "compare-versions";
import { getConstrainedTypeAtLocation } from "@typescript-eslint/type-utils";
import { unionConstituents } from "ts-api-utils";
import { snakeCase } from "string-ts";

//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) {
		__defProp(target, name, {
			get: all[name],
			enumerable: true
		});
	}
	if (!no_symbols) {
		__defProp(target, Symbol.toStringTag, { value: "Module" });
	}
	return target;
};

//#endregion
//#region src/configs/disable-conflict-eslint-plugin-react.ts
var disable_conflict_eslint_plugin_react_exports = /* @__PURE__ */ __exportAll({
	name: () => name$10,
	rules: () => rules$10
});
const conflictingRules$1 = [
	"react/button-has-type",
	"react/destructuring-assignment",
	"react/display-name",
	"react/forbid-prop-types",
	"react/forward-ref-uses-ref",
	"react/hook-use-state",
	"react/iframe-missing-sandbox",
	"react/jsx-boolean-value",
	"react/jsx-filename-extension",
	"react/jsx-fragments",
	"react/jsx-key",
	"react/jsx-no-comment-textnodes",
	"react/jsx-no-constructed-context-values",
	"react/jsx-no-leaked-render",
	"react/jsx-no-script-url",
	"react/jsx-no-target-blank",
	"react/jsx-no-useless-fragment",
	"react/jsx-pascal-case",
	"react/no-access-state-in-setstate",
	"react/no-array-index-key",
	"react/no-children-prop",
	"react/no-danger",
	"react/no-danger-with-children",
	"react/no-deprecated",
	"react/no-did-mount-set-state",
	"react/no-did-update-set-state",
	"react/no-direct-mutation-state",
	"react/no-find-dom-node",
	"react/no-namespace",
	"react/no-object-type-as-default-prop",
	"react/no-redundant-should-component-update",
	"react/no-render-return-value",
	"react/no-string-refs",
	"react/no-unknown-property",
	"react/no-unsafe",
	"react/no-unstable-nested-components",
	"react/no-unused-class-component-members",
	"react/no-unused-state",
	"react/no-will-update-set-state",
	"react/prop-types",
	"react/void-dom-elements-no-children"
];
const name$10 = "react-x/disable-conflict-eslint-plugin-react";
const rules$10 = Object.fromEntries(conflictingRules$1.map((key) => [key, "off"]));

//#endregion
//#region src/configs/disable-conflict-eslint-plugin-react-hooks.ts
var disable_conflict_eslint_plugin_react_hooks_exports = /* @__PURE__ */ __exportAll({
	name: () => name$9,
	rules: () => rules$9
});
const conflictingRules = [
	"react-hooks/exhaustive-deps",
	"react-hooks/rules-of-hooks",
	"react-hooks/component-hook-factories",
	"react-hooks/error-boundaries",
	"react-hooks/immutability",
	"react-hooks/purity",
	"react-hooks/refs",
	"react-hooks/set-state-in-effect",
	"react-hooks/set-state-in-render",
	"react-hooks/static-components",
	"react-hooks/unsupported-syntax",
	"react-hooks/use-memo"
];
const name$9 = "react-x/disable-conflict-eslint-plugin-react-hooks";
const rules$9 = Object.fromEntries(conflictingRules.map((key) => [key, "off"]));

//#endregion
//#region src/configs/disable-experimental.ts
var disable_experimental_exports = /* @__PURE__ */ __exportAll({
	name: () => name$8,
	rules: () => rules$8
});
const name$8 = "react-x/disable-experimental";
const rules$8 = {
	"react-x/immutability": "off",
	"react-x/no-duplicate-key": "off",
	"react-x/no-implicit-children": "off",
	"react-x/no-implicit-key": "off",
	"react-x/no-implicit-ref": "off",
	"react-x/no-misused-capture-owner-stack": "off",
	"react-x/no-unnecessary-use-callback": "off",
	"react-x/no-unnecessary-use-memo": "off",
	"react-x/no-unused-props": "off",
	"react-x/refs": "off",
	"react-x/set-state-in-render": "off"
};

//#endregion
//#region src/configs/disable-type-checked.ts
var disable_type_checked_exports = /* @__PURE__ */ __exportAll({
	name: () => name$7,
	rules: () => rules$7
});
const name$7 = "react-x/disable-type-checked";
const rules$7 = {
	"react-x/no-implicit-children": "off",
	"react-x/no-implicit-key": "off",
	"react-x/no-implicit-ref": "off",
	"react-x/no-leaked-conditional-rendering": "off",
	"react-x/no-unused-props": "off"
};

//#endregion
//#region package.json
var name$6 = "eslint-plugin-react-x";
var version = "4.2.3";

//#endregion
//#region src/utils/create-rule.ts
function getDocsUrl(ruleName) {
	return `${WEBSITE_URL}/docs/rules/${ruleName}`;
}
const createRule = ESLintUtils.RuleCreator(getDocsUrl);

//#endregion
//#region src/utils/type-is.ts
function isFlagSet(allFlags, flag) {
	return (allFlags & flag) !== 0;
}
function isFlagSetOnObject(obj, flag) {
	return isFlagSet(obj.flags, flag);
}
const isTypeFlagSet = isFlagSetOnObject;
function isBooleanLiteralType(type) {
	return isTypeFlagSet(type, ts.TypeFlags.BooleanLiteral);
}
/** @internal */
const isFalseLiteralType = (type) => isBooleanLiteralType(type) && type.intrinsicName === "false";
/** @internal */
const isTrueLiteralType = (type) => isBooleanLiteralType(type) && type.intrinsicName === "true";
/** @internal */
const isAnyType = (type) => isTypeFlagSet(type, ts.TypeFlags.TypeParameter | ts.TypeFlags.Any);
/** @internal */
const isBigIntType = (type) => isTypeFlagSet(type, ts.TypeFlags.BigIntLike);
/** @internal */
const isBooleanType = (type) => isTypeFlagSet(type, ts.TypeFlags.BooleanLike);
/** @internal */
const isEnumType = (type) => isTypeFlagSet(type, ts.TypeFlags.EnumLike);
/** @internal */
const isFalsyBigIntType = (type) => type.isLiteral() && isMatching({ value: { base10Value: "0" } }, type);
/** @internal */
const isFalsyNumberType = (type) => type.isNumberLiteral() && type.value === 0;
/** @internal */
const isFalsyStringType = (type) => type.isStringLiteral() && type.value === "";
/** @internal */
const isNeverType = (type) => isTypeFlagSet(type, ts.TypeFlags.Never);
/** @internal */
const isNullishType = (type) => isTypeFlagSet(type, ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.VoidLike);
/** @internal */
const isNumberType = (type) => isTypeFlagSet(type, ts.TypeFlags.NumberLike);
/** @internal */
const isObjectType = (type) => !isTypeFlagSet(type, ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.VoidLike | ts.TypeFlags.BooleanLike | ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BigIntLike | ts.TypeFlags.TypeParameter | ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never);
/** @internal */
const isStringType = (type) => isTypeFlagSet(type, ts.TypeFlags.StringLike);
/** @internal */
const isTruthyBigIntType = (type) => type.isLiteral() && isMatching({ value: { base10Value: P.not("0") } }, type);
/** @internal */
const isTruthyNumberType = (type) => type.isNumberLiteral() && type.value !== 0;
/** @internal */
const isTruthyStringType = (type) => type.isStringLiteral() && type.value !== "";
/** @internal */
const isUnknownType = (type) => isTypeFlagSet(type, ts.TypeFlags.Unknown);

//#endregion
//#region src/utils/type-name.ts
/**
* An enhanced version of getFullyQualifiedName that handles cases that original function does not handle
* @param checker TypeScript type checker
* @param symbol Symbol to get fully qualified name for
* @returns Fully qualified name of the symbol
*/
function getFullyQualifiedNameEx(checker, symbol) {
	let name = symbol.name;
	let parent = symbol.declarations?.at(0)?.parent;
	if (parent == null) return checker.getFullyQualifiedName(symbol);
	while (parent.kind !== ts.SyntaxKind.SourceFile) {
		switch (true) {
			case ts.isInterfaceDeclaration(parent):
			case ts.isTypeAliasDeclaration(parent):
			case ts.isEnumDeclaration(parent):
			case ts.isModuleDeclaration(parent):
			case ts.isNamespaceImport(parent):
			case ts.isNamespaceExport(parent):
			case ts.isNamespaceExportDeclaration(parent):
				name = `${parent.name.text}.${name}`;
				break;
			case ts.isPropertySignature(parent) && ts.isIdentifier(parent.name):
			case ts.isPropertyDeclaration(parent) && ts.isIdentifier(parent.name):
			case ts.isMethodDeclaration(parent) && ts.isIdentifier(parent.name):
			case ts.isMethodSignature(parent) && ts.isIdentifier(parent.name):
			case ts.isPropertyAssignment(parent) && ts.isIdentifier(parent.name):
				name = `${parent.name.text}.${name}`;
				break;
			case ts.isFunctionDeclaration(parent) && parent.name != null:
			case ts.isClassExpression(parent) && parent.name != null:
			case ts.isClassDeclaration(parent) && parent.name != null:
				name = `${parent.name.text}.${name}`;
				break;
			case ts.isEnumMember(parent):
				name = `${parent.name.getText()}.${name}`;
				break;
			case ts.isTypeLiteralNode(parent):
			case ts.isMappedTypeNode(parent):
			case ts.isObjectLiteralExpression(parent):
			case ts.isIntersectionTypeNode(parent):
			case ts.isUnionTypeNode(parent): break;
			default: break;
		}
		parent = parent.parent;
	}
	const namespace = parent.getSourceFile().statements.find((n) => ts.isNamespaceExportDeclaration(n))?.name.text;
	if (namespace == null) return name;
	if (name.startsWith(`${namespace}.`)) return name;
	return `${namespace}.${name}`;
}

//#endregion
//#region src/utils/type-variant.ts
/**
* Ported from https://github.com/typescript-eslint/typescript-eslint/blob/eb736bbfc22554694400e6a4f97051d845d32e0b/packages/eslint-plugin/src/rules/strict-boolean-expressions.ts#L826 with some enhancements
* Get the variants of an array of types.
* @param types The types to get the variants of
* @returns The variants of the types
* @internal
*/
function getTypeVariants(types) {
	const variants = /* @__PURE__ */ new Set();
	if (types.some(isUnknownType)) {
		variants.add("unknown");
		return variants;
	}
	if (types.some(isNullishType)) variants.add("nullish");
	const booleans = types.filter(isBooleanType);
	const boolean0 = booleans[0];
	if (booleans.length === 1 && boolean0 != null) {
		if (isFalseLiteralType(boolean0)) variants.add("falsy boolean");
		else if (isTrueLiteralType(boolean0)) variants.add("truthy boolean");
	} else if (booleans.length === 2) variants.add("boolean");
	const strings = types.filter(isStringType);
	if (strings.length > 0) {
		const evaluated = match(strings).when((types) => types.every(isTruthyStringType), () => "truthy string").when((types) => types.every(isFalsyStringType), () => "falsy string").otherwise(() => "string");
		variants.add(evaluated);
	}
	const bigints = types.filter(isBigIntType);
	if (bigints.length > 0) {
		const evaluated = match(bigints).when((types) => types.every(isTruthyBigIntType), () => "truthy bigint").when((types) => types.every(isFalsyBigIntType), () => "falsy bigint").otherwise(() => "bigint");
		variants.add(evaluated);
	}
	const numbers = types.filter(isNumberType);
	if (numbers.length > 0) {
		const evaluated = match(numbers).when((types) => types.every(isTruthyNumberType), () => "truthy number").when((types) => types.every(isFalsyNumberType), () => "falsy number").otherwise(() => "number");
		variants.add(evaluated);
	}
	if (types.some(isEnumType)) variants.add("enum");
	if (types.some(isObjectType)) variants.add("object");
	if (types.some(isAnyType)) variants.add("any");
	if (types.some(isNeverType)) variants.add("never");
	return variants;
}

//#endregion
//#region src/rules/component-hook-factories/component-hook-factories.ts
const RULE_NAME$54 = "component-hook-factories";
var component_hook_factories_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows higher order functions that define components or hooks inside them." },
		messages: {
			component: "Do not define component '{{name}}' inside a function. Components should be defined at the module level. Move it to the top level.",
			hook: "Do not define hook '{{name}}' inside a function. Hooks should be defined at the module level. Move it to the top level."
		},
		schema: []
	},
	name: RULE_NAME$54,
	create: create$54,
	defaultOptions: []
});
/**
* Check if a function parameter has a type annotation that looks like a React component type.
* Matches types like ComponentType, React.ComponentType, FC, React.FC, etc.
* @param param The parameter to check.
*/
function hasComponentTypeAnnotation(param) {
	if (param.type !== AST_NODE_TYPES.Identifier || param.typeAnnotation == null) return false;
	const annotation = param.typeAnnotation.typeAnnotation;
	if (annotation.type === AST_NODE_TYPES.TSTypeReference) return isComponentTypeName(annotation.typeName);
	return false;
}
/**
* Check if a type name refers to a known React component type.
* @param typeName The type name to check.
*/
function isComponentTypeName(typeName) {
	if (typeName.type === AST_NODE_TYPES.Identifier) return /^(ComponentType|FC|ComponentClass|FunctionComponent|Component)$/.test(typeName.name);
	if (typeName.type === AST_NODE_TYPES.TSQualifiedName) {
		if (typeName.left.type === AST_NODE_TYPES.Identifier && typeName.left.name === "React") return isComponentTypeName(typeName.right);
	}
	return false;
}
/**
* Heuristically check if a function is a Higher Order Component (HOC) based on its parameters.
* Considers a function an HOC if it takes a parameter that looks like a React component
* (by name or type annotation). This does not validate that the function actually returns
* a React component.
* @param fn The function to check.
*/
function isHigherOrderComponent(fn) {
	return fn.params.some((param) => {
		if (param.type === AST_NODE_TYPES.Identifier && core.isComponentNameLoose(param.name)) return true;
		if (hasComponentTypeAnnotation(param)) return true;
		return false;
	});
}
/**
* Check if a node is inside a test mock callback (vi.mock or jest.mock).
* @param node The node to check.
*/
function isInsideTestMockCallback(node) {
	return ast.findParent(node, ast.isTestMockCallback) != null;
}
function create$54(context) {
	const hint = core.ComponentDetectionHint.DoNotIncludeJsxWithNumberValue | core.ComponentDetectionHint.DoNotIncludeJsxWithBooleanValue | core.ComponentDetectionHint.DoNotIncludeJsxWithNullValue | core.ComponentDetectionHint.DoNotIncludeJsxWithStringValue | core.ComponentDetectionHint.DoNotIncludeJsxWithUndefinedValue | core.ComponentDetectionHint.RequireBothSidesOfLogicalExpressionToBeJsx | core.ComponentDetectionHint.RequireBothBranchesOfConditionalExpressionToBeJsx | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayPatternElement | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayExpressionElement | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayMapCallback;
	const fCollector = core.getComponentCollector(context, { hint });
	const cCollector = core.getComponentCollectorLegacy(context);
	const hCollector = core.getHookCollector(context);
	const reported = /* @__PURE__ */ new Set();
	return defineRuleListener(fCollector.visitor, cCollector.visitor, hCollector.visitor, { "Program:exit"(program) {
		const fComponents = [...fCollector.api.getAllComponents(program)];
		const cComponents = [...cCollector.api.getAllComponents(program)];
		const hooks = [...hCollector.api.getAllHooks(program)];
		for (const { name, node } of fComponents) {
			if (name == null) continue;
			const parentFn = ast.findParent(node, ast.isFunction);
			if (parentFn == null) continue;
			if (isInsideTestMockCallback(node)) continue;
			if (isHigherOrderComponent(parentFn)) continue;
			if (reported.has(node)) continue;
			context.report({
				data: { name },
				messageId: "component",
				node
			});
			reported.add(node);
		}
		for (const { name = "unknown", node } of cComponents) {
			const parentFn = ast.findParent(node, ast.isFunction);
			if (parentFn == null) continue;
			if (isInsideTestMockCallback(node)) continue;
			if (isHigherOrderComponent(parentFn)) continue;
			context.report({
				data: { name },
				messageId: "component",
				node
			});
		}
		for (const { name, node } of hooks) {
			if (ast.findParent(node, ast.isFunction) == null) continue;
			if (isInsideTestMockCallback(node)) continue;
			if (reported.has(node)) continue;
			context.report({
				data: { name },
				messageId: "hook",
				node
			});
			reported.add(node);
		}
	} });
}

//#endregion
//#region src/rules/error-boundaries/error-boundaries.ts
const RULE_NAME$53 = "error-boundaries";
var error_boundaries_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates usage of Error Boundaries instead of try/catch for errors in child components." },
		messages: {
			tryCatchWithJsx: "Use an Error Boundary to catch errors in child components. Try/catch can't catch errors during React's rendering process.",
			tryCatchWithUse: "Use an Error Boundary instead of try/catch around the 'use' hook. The 'use' hook suspends the component, and its errors can only be caught by Error Boundaries."
		},
		schema: []
	},
	name: RULE_NAME$53,
	create: create$53,
	defaultOptions: []
});
function create$53(context) {
	if (!context.sourceCode.text.includes("try")) return {};
	const hint = JsxDetectionHint.DoNotIncludeJsxWithNullValue | JsxDetectionHint.DoNotIncludeJsxWithNumberValue | JsxDetectionHint.DoNotIncludeJsxWithBigIntValue | JsxDetectionHint.DoNotIncludeJsxWithStringValue | JsxDetectionHint.DoNotIncludeJsxWithBooleanValue | JsxDetectionHint.DoNotIncludeJsxWithUndefinedValue | JsxDetectionHint.DoNotIncludeJsxWithEmptyArrayValue;
	const { api, visitor } = core.getComponentCollector(context);
	const reported = /* @__PURE__ */ new Set();
	return defineRuleListener(visitor, {
		CallExpression(node) {
			if (!core.isUseCall(node)) return;
			const stmt = ast.findParent(node, ast.is(AST_NODE_TYPES.TryStatement));
			if (stmt != null && !reported.has(stmt)) {
				context.report({
					messageId: "tryCatchWithUse",
					node
				});
				reported.add(stmt);
			}
		},
		"Program:exit"(node) {
			for (const { rets } of api.getAllComponents(node)) for (const ret of rets) {
				if (ret == null) continue;
				if (!isJsxLike(context, ret, hint)) continue;
				const stmt = ast.findParent(ret, ast.is(AST_NODE_TYPES.TryStatement));
				if (stmt != null && !reported.has(stmt)) {
					context.report({
						messageId: "tryCatchWithJsx",
						node: stmt
					});
					reported.add(stmt);
				}
			}
		}
	});
}

//#endregion
//#region src/rules/exhaustive-deps/exhaustive-deps.ts
const rule$1 = {
	meta: {
		type: "suggestion",
		docs: {
			description: "Verifies the list of dependencies for Hooks like 'useEffect' and similar.",
			recommended: true,
			url: "https://github.com/facebook/react/issues/14920"
		},
		fixable: "code",
		hasSuggestions: true,
		schema: [{
			type: "object",
			additionalProperties: false,
			enableDangerousAutofixThisMayCauseInfiniteLoops: false,
			properties: {
				additionalHooks: { type: "string" },
				enableDangerousAutofixThisMayCauseInfiniteLoops: { type: "boolean" },
				experimental_autoDependenciesHooks: {
					type: "array",
					items: { type: "string" }
				},
				requireExplicitEffectDeps: { type: "boolean" }
			}
		}]
	},
	create(context) {
		const rawOptions = context.options && context.options[0];
		const additionalHooks = rawOptions && rawOptions.additionalHooks ? new RegExp(rawOptions.additionalHooks) : getSettingsFromContext(context).additionalEffectHooks;
		const enableDangerousAutofixThisMayCauseInfiniteLoops = rawOptions && rawOptions.enableDangerousAutofixThisMayCauseInfiniteLoops || false;
		const options = {
			additionalHooks,
			experimental_autoDependenciesHooks: rawOptions && Array.isArray(rawOptions.experimental_autoDependenciesHooks) ? rawOptions.experimental_autoDependenciesHooks : [],
			enableDangerousAutofixThisMayCauseInfiniteLoops,
			requireExplicitEffectDeps: rawOptions && rawOptions.requireExplicitEffectDeps || false
		};
		function reportProblem(problem) {
			if (enableDangerousAutofixThisMayCauseInfiniteLoops) {
				if (Array.isArray(problem.suggest) && problem.suggest.length > 0 && problem.suggest[0]) problem.fix = problem.suggest[0].fix;
			}
			context.report(problem);
		}
		/**
		* SourceCode that also works down to ESLint 3.0.0
		*/
		const getSourceCode = typeof context.getSourceCode === "function" ? () => {
			return context.getSourceCode();
		} : () => {
			return context.sourceCode;
		};
		/**
		* SourceCode#getScope that also works down to ESLint 3.0.0
		*/
		const getScope = typeof context.getScope === "function" ? () => {
			return context.getScope();
		} : (node) => {
			return context.sourceCode.getScope(node);
		};
		const scopeManager = getSourceCode().scopeManager;
		const setStateCallSites = /* @__PURE__ */ new WeakMap();
		const stateVariables = /* @__PURE__ */ new WeakSet();
		const stableKnownValueCache = /* @__PURE__ */ new WeakMap();
		const functionWithoutCapturedValueCache = /* @__PURE__ */ new WeakMap();
		const useEffectEventVariables = /* @__PURE__ */ new WeakSet();
		function memoizeWithWeakMap(fn, map) {
			return function(arg) {
				if (map.has(arg)) return map.get(arg);
				const result = fn(arg);
				map.set(arg, result);
				return result;
			};
		}
		/**
		* Visitor for both function expressions and arrow function expressions.
		*/
		function visitFunctionWithDependencies(node, declaredDependenciesNode, reactiveHook, reactiveHookName, isEffect, isAutoDepsHook) {
			if (isEffect && node.async) reportProblem({
				node,
				message: "Effect callbacks are synchronous to prevent race conditions. Put the async function inside:\n\nuseEffect(() => {\n  async function fetchData() {\n    // You can await here\n    const response = await MyAPI.getData(someId);\n    // ...\n  }\n  fetchData();\n}, [someId]); // Or [] if effect doesn't need props or state\n\nLearn more about data fetching with Hooks: https://react.dev/link/hooks-data-fetching"
			});
			const scope = scopeManager.acquire(node);
			if (!scope) throw new Error("Unable to acquire scope for the current node. This is a bug in eslint-plugin-react-hooks, please file an issue.");
			const pureScopes = /* @__PURE__ */ new Set();
			let componentScope = null;
			{
				let currentScope = scope.upper;
				while (currentScope) {
					pureScopes.add(currentScope);
					if (currentScope.type === "function" || currentScope.type === "hook" || currentScope.type === "component") break;
					currentScope = currentScope.upper;
				}
				if (!currentScope) return;
				componentScope = currentScope;
			}
			const isArray = Array.isArray;
			function isStableKnownHookValue(resolved) {
				if (!isArray(resolved.defs)) return false;
				const def = resolved.defs[0];
				if (def == null) return false;
				const defNode = def.node;
				if (defNode.type !== "VariableDeclarator") return false;
				let init = defNode.init;
				if (init == null) return false;
				while (init.type === "TSAsExpression" || init.type === "AsExpression") init = init.expression;
				let declaration = defNode.parent;
				if (declaration == null && componentScope != null) {
					fastFindReferenceWithParent(componentScope.block, def.node.id);
					declaration = def.node.parent;
					if (declaration == null) return false;
				}
				if (declaration != null && "kind" in declaration && declaration.kind === "const" && init.type === "Literal" && (typeof init.value === "string" || typeof init.value === "number" || init.value === null)) return true;
				if (init.type !== "CallExpression") return false;
				let callee = init.callee;
				if (callee.type === "MemberExpression" && "name" in callee.object && callee.object.name === "React" && callee.property != null && !callee.computed) callee = callee.property;
				if (callee.type !== "Identifier") return false;
				const id = def.node.id;
				const { name } = callee;
				if (name === "useRef" && id.type === "Identifier") return true;
				else if (isUseEffectEventIdentifier$1(callee) && id.type === "Identifier") {
					for (const ref of resolved.references) if (ref !== id) useEffectEventVariables.add(ref.identifier);
					return true;
				} else if (name === "useState" || name === "useReducer" || name === "useActionState") {
					if (id.type === "ArrayPattern" && id.elements.length === 2 && isArray(resolved.identifiers)) {
						if (id.elements[1] === resolved.identifiers[0]) {
							if (name === "useState") {
								const references = resolved.references;
								let writeCount = 0;
								for (const reference of references) {
									if (reference.isWrite()) writeCount++;
									if (writeCount > 1) return false;
									setStateCallSites.set(reference.identifier, id.elements[0]);
								}
							}
							return true;
						} else if (id.elements[0] === resolved.identifiers[0]) {
							if (name === "useState") {
								const references = resolved.references;
								for (const reference of references) stateVariables.add(reference.identifier);
							}
							return false;
						}
					}
				} else if (name === "useTransition") {
					if (id.type === "ArrayPattern" && id.elements.length === 2 && Array.isArray(resolved.identifiers)) {
						if (id.elements[1] === resolved.identifiers[0]) return true;
					}
				}
				return false;
			}
			function isFunctionWithoutCapturedValues(resolved) {
				if (!isArray(resolved.defs)) return false;
				const def = resolved.defs[0];
				if (def == null) return false;
				if (def.node == null || def.node.id == null) return false;
				const fnNode = def.node;
				const childScopes = componentScope?.childScopes || [];
				let fnScope = null;
				for (const childScope of childScopes) {
					const childScopeBlock = childScope.block;
					if (fnNode.type === "FunctionDeclaration" && childScopeBlock === fnNode || fnNode.type === "VariableDeclarator" && childScopeBlock.parent === fnNode) {
						fnScope = childScope;
						break;
					}
				}
				if (fnScope == null) return false;
				for (const ref of fnScope.through) {
					if (ref.resolved == null) continue;
					if (pureScopes.has(ref.resolved.scope) && !memoizedIsStableKnownHookValue(ref.resolved)) return false;
				}
				return true;
			}
			const memoizedIsStableKnownHookValue = memoizeWithWeakMap(isStableKnownHookValue, stableKnownValueCache);
			const memoizedIsFunctionWithoutCapturedValues = memoizeWithWeakMap(isFunctionWithoutCapturedValues, functionWithoutCapturedValueCache);
			const currentRefsInEffectCleanup = /* @__PURE__ */ new Map();
			function isInsideEffectCleanup(reference) {
				let curScope = reference.from;
				let isInReturnedFunction = false;
				while (curScope != null && curScope.block !== node) {
					if (curScope.type === "function") isInReturnedFunction = curScope.block.parent != null && curScope.block.parent.type === "ReturnStatement";
					curScope = curScope.upper;
				}
				return isInReturnedFunction;
			}
			const dependencies = /* @__PURE__ */ new Map();
			const optionalChains = /* @__PURE__ */ new Map();
			gatherDependenciesRecursively(scope);
			function gatherDependenciesRecursively(currentScope) {
				for (const reference of currentScope.references) {
					if (!reference.resolved) continue;
					if (!pureScopes.has(reference.resolved.scope)) continue;
					const referenceNode = fastFindReferenceWithParent(node, reference.identifier);
					if (referenceNode == null) continue;
					const dependencyNode = getDependency(referenceNode);
					const dependency = analyzePropertyChain(dependencyNode, optionalChains);
					if (isEffect && dependencyNode.type === "Identifier" && (dependencyNode.parent?.type === "MemberExpression" || dependencyNode.parent?.type === "OptionalMemberExpression") && !dependencyNode.parent.computed && dependencyNode.parent.property.type === "Identifier" && dependencyNode.parent.property.name === "current" && isInsideEffectCleanup(reference)) currentRefsInEffectCleanup.set(dependency, {
						reference,
						dependencyNode
					});
					if (dependencyNode.parent?.type === "TSTypeQuery" || dependencyNode.parent?.type === "TSTypeReference") continue;
					const def = reference.resolved.defs[0];
					if (def == null) continue;
					if (def.node != null && def.node.init === node.parent) continue;
					if (def.type === "TypeParameter" || dependencyNode.parent?.type === "GenericTypeAnnotation") continue;
					if (!dependencies.has(dependency)) {
						const resolved = reference.resolved;
						const isStable = memoizedIsStableKnownHookValue(resolved) || memoizedIsFunctionWithoutCapturedValues(resolved);
						dependencies.set(dependency, {
							isStable,
							references: [reference]
						});
					} else dependencies.get(dependency)?.references.push(reference);
				}
				for (const childScope of currentScope.childScopes) gatherDependenciesRecursively(childScope);
			}
			currentRefsInEffectCleanup.forEach(({ reference, dependencyNode }, dependency) => {
				const references = reference.resolved?.references || [];
				let foundCurrentAssignment = false;
				for (const ref of references) {
					const { identifier } = ref;
					const { parent } = identifier;
					if (parent != null && parent.type === "MemberExpression" && !parent.computed && parent.property.type === "Identifier" && parent.property.name === "current" && parent.parent?.type === "AssignmentExpression" && parent.parent.left === parent) {
						foundCurrentAssignment = true;
						break;
					}
				}
				if (foundCurrentAssignment) return;
				reportProblem({
					node: dependencyNode.parent.property,
					message: `The ref value '${dependency}.current' will likely have changed by the time this effect cleanup function runs. If this ref points to a node rendered by React, copy '${dependency}.current' to a variable inside the effect, and use that variable in the cleanup function.`
				});
			});
			const staleAssignments = /* @__PURE__ */ new Set();
			function reportStaleAssignment(writeExpr, key) {
				if (staleAssignments.has(key)) return;
				staleAssignments.add(key);
				reportProblem({
					node: writeExpr,
					message: `Assignments to the '${key}' variable from inside React Hook ${getSourceCode().getText(reactiveHook)} will be lost after each render. To preserve the value over time, store it in a useRef Hook and keep the mutable value in the '.current' property. Otherwise, you can move this variable directly inside ${getSourceCode().getText(reactiveHook)}.`
				});
			}
			const stableDependencies = /* @__PURE__ */ new Set();
			dependencies.forEach(({ isStable, references }, key) => {
				if (isStable) stableDependencies.add(key);
				references.forEach((reference) => {
					if (reference.writeExpr) reportStaleAssignment(reference.writeExpr, key);
				});
			});
			if (staleAssignments.size > 0) return;
			if (!declaredDependenciesNode) {
				if (isAutoDepsHook) return;
				let setStateInsideEffectWithoutDeps = null;
				dependencies.forEach(({ references }, key) => {
					if (setStateInsideEffectWithoutDeps) return;
					references.forEach((reference) => {
						if (setStateInsideEffectWithoutDeps) return;
						const id = reference.identifier;
						if (!setStateCallSites.has(id)) return;
						let fnScope = reference.from;
						while (fnScope != null && fnScope.type !== "function") fnScope = fnScope.upper;
						if (fnScope?.block === node) setStateInsideEffectWithoutDeps = key;
					});
				});
				if (setStateInsideEffectWithoutDeps) {
					const { suggestedDependencies } = collectRecommendations({
						dependencies,
						declaredDependencies: [],
						stableDependencies,
						externalDependencies: /* @__PURE__ */ new Set(),
						isEffect: true
					});
					reportProblem({
						node: reactiveHook,
						message: `React Hook ${reactiveHookName} contains a call to '${setStateInsideEffectWithoutDeps}'. Without a list of dependencies, this can lead to an infinite chain of updates. To fix this, pass [` + suggestedDependencies.join(", ") + `] as a second argument to the ${reactiveHookName} Hook.`,
						suggest: [{
							desc: `Add dependencies array: [${suggestedDependencies.join(", ")}]`,
							fix(fixer) {
								return fixer.insertTextAfter(node, `, [${suggestedDependencies.join(", ")}]`);
							}
						}]
					});
				}
				return;
			}
			if (isAutoDepsHook && declaredDependenciesNode.type === "Literal" && declaredDependenciesNode.value === null) return;
			const declaredDependencies = [];
			const externalDependencies = /* @__PURE__ */ new Set();
			const isArrayExpression = declaredDependenciesNode.type === "ArrayExpression";
			const isTSAsArrayExpression = declaredDependenciesNode.type === "TSAsExpression" && declaredDependenciesNode.expression.type === "ArrayExpression";
			if (!isArrayExpression && !isTSAsArrayExpression) reportProblem({
				node: declaredDependenciesNode,
				message: `React Hook ${getSourceCode().getText(reactiveHook)} was passed a dependency list that is not an array literal. This means we can't statically verify whether you've passed the correct dependencies.`
			});
			else (isTSAsArrayExpression ? declaredDependenciesNode.expression : declaredDependenciesNode).elements.forEach((declaredDependencyNode) => {
				if (declaredDependencyNode === null) return;
				if (declaredDependencyNode.type === "SpreadElement") {
					reportProblem({
						node: declaredDependencyNode,
						message: `React Hook ${getSourceCode().getText(reactiveHook)} has a spread element in its dependency array. This means we can't statically verify whether you've passed the correct dependencies.`
					});
					return;
				}
				if (useEffectEventVariables.has(declaredDependencyNode)) reportProblem({
					node: declaredDependencyNode,
					message: `Functions returned from \`useEffectEvent\` must not be included in the dependency array. Remove \`${getSourceCode().getText(declaredDependencyNode)}\` from the list.`,
					suggest: [{
						desc: `Remove the dependency \`${getSourceCode().getText(declaredDependencyNode)}\``,
						fix(fixer) {
							return fixer.removeRange(declaredDependencyNode.range);
						}
					}]
				});
				let declaredDependency;
				try {
					declaredDependency = analyzePropertyChain(declaredDependencyNode, null);
				} catch (error) {
					if (error instanceof Error && /Unsupported node type/.test(error.message)) {
						if (declaredDependencyNode.type === "Literal") if (declaredDependencyNode.value && dependencies.has(declaredDependencyNode.value)) reportProblem({
							node: declaredDependencyNode,
							message: `The ${declaredDependencyNode.raw} literal is not a valid dependency because it never changes. Did you mean to include ${declaredDependencyNode.value} in the array instead?`
						});
						else reportProblem({
							node: declaredDependencyNode,
							message: `The ${declaredDependencyNode.raw} literal is not a valid dependency because it never changes. You can safely remove it.`
						});
						else reportProblem({
							node: declaredDependencyNode,
							message: `React Hook ${getSourceCode().getText(reactiveHook)} has a complex expression in the dependency array. Extract it to a separate variable so it can be statically checked.`
						});
						return;
					} else throw error;
				}
				let maybeID = declaredDependencyNode;
				while (maybeID.type === "MemberExpression" || maybeID.type === "OptionalMemberExpression" || maybeID.type === "ChainExpression") maybeID = maybeID.object || maybeID.expression.object;
				const isDeclaredInComponent = !componentScope.through.some((ref) => ref.identifier === maybeID);
				declaredDependencies.push({
					key: declaredDependency,
					node: declaredDependencyNode
				});
				if (!isDeclaredInComponent) externalDependencies.add(declaredDependency);
			});
			const { suggestedDependencies, unnecessaryDependencies, missingDependencies, duplicateDependencies } = collectRecommendations({
				dependencies,
				declaredDependencies,
				stableDependencies,
				externalDependencies,
				isEffect
			});
			let suggestedDeps = suggestedDependencies;
			if (duplicateDependencies.size + missingDependencies.size + unnecessaryDependencies.size === 0) {
				scanForConstructions({
					declaredDependencies,
					declaredDependenciesNode,
					componentScope,
					scope
				}).forEach(({ construction, isUsedOutsideOfHook, depType }) => {
					const wrapperHook = depType === "function" ? "useCallback" : "useMemo";
					const constructionType = depType === "function" ? "definition" : "initialization";
					const defaultAdvice = `wrap the ${constructionType} of '${construction.name.name}' in its own ${wrapperHook}() Hook.`;
					const advice = isUsedOutsideOfHook ? `To fix this, ${defaultAdvice}` : `Move it inside the ${reactiveHookName} callback. Alternatively, ${defaultAdvice}`;
					const causation = depType === "conditional" || depType === "logical expression" ? "could make" : "makes";
					const message = `The '${construction.name.name}' ${depType} ${causation} the dependencies of ${reactiveHookName} Hook (at line ${declaredDependenciesNode.loc?.start.line}) change on every render. ${advice}`;
					let suggest;
					if (isUsedOutsideOfHook && construction.type === "Variable" && depType === "function") suggest = [{
						desc: `Wrap the ${constructionType} of '${construction.name.name}' in its own ${wrapperHook}() Hook.`,
						fix(fixer) {
							const [before, after] = wrapperHook === "useMemo" ? [`useMemo(() => { return `, "; })"] : ["useCallback(", ")"];
							return [fixer.insertTextBefore(construction.node.init, before), fixer.insertTextAfter(construction.node.init, after)];
						}
					}];
					reportProblem({
						node: construction.node,
						message,
						suggest
					});
				});
				return;
			}
			if (!isEffect && missingDependencies.size > 0) suggestedDeps = collectRecommendations({
				dependencies,
				declaredDependencies: [],
				stableDependencies,
				externalDependencies,
				isEffect
			}).suggestedDependencies;
			function areDeclaredDepsAlphabetized() {
				if (declaredDependencies.length === 0) return true;
				const declaredDepKeys = declaredDependencies.map((dep) => dep.key);
				const sortedDeclaredDepKeys = declaredDepKeys.slice().sort();
				return declaredDepKeys.join(",") === sortedDeclaredDepKeys.join(",");
			}
			if (areDeclaredDepsAlphabetized()) suggestedDeps.sort();
			function formatDependency(path) {
				const members = path.split(".");
				let finalPath = "";
				for (let i = 0; i < members.length; i++) {
					if (i !== 0) {
						const pathSoFar = members.slice(0, i + 1).join(".");
						const isOptional = optionalChains.get(pathSoFar) === true;
						finalPath += isOptional ? "?." : ".";
					}
					finalPath += members[i];
				}
				return finalPath;
			}
			function getWarningMessage(deps, singlePrefix, label, fixVerb) {
				if (deps.size === 0) return null;
				return (deps.size > 1 ? "" : singlePrefix + " ") + label + " " + (deps.size > 1 ? "dependencies" : "dependency") + ": " + joinEnglish(Array.from(deps).sort().map((name) => "'" + formatDependency(name) + "'")) + `. Either ${fixVerb} ${deps.size > 1 ? "them" : "it"} or remove the dependency array.`;
			}
			let extraWarning = "";
			if (unnecessaryDependencies.size > 0) {
				let badRef = null;
				Array.from(unnecessaryDependencies.keys()).forEach((key) => {
					if (badRef !== null) return;
					if (key.endsWith(".current")) badRef = key;
				});
				if (badRef !== null) extraWarning = ` Mutable values like '${badRef}' aren't valid dependencies because mutating them doesn't re-render the component.`;
				else if (externalDependencies.size > 0) {
					const dep = Array.from(externalDependencies)[0];
					if (!scope.set.has(dep)) extraWarning = ` Outer scope values like '${dep}' aren't valid dependencies because mutating them doesn't re-render the component.`;
				}
			}
			if (!extraWarning && missingDependencies.has("props")) {
				const propDep = dependencies.get("props");
				if (propDep == null) return;
				const refs = propDep.references;
				if (!Array.isArray(refs)) return;
				let isPropsOnlyUsedInMembers = true;
				for (const ref of refs) {
					const id = fastFindReferenceWithParent(componentScope.block, ref.identifier);
					if (!id) {
						isPropsOnlyUsedInMembers = false;
						break;
					}
					const parent = id.parent;
					if (parent == null) {
						isPropsOnlyUsedInMembers = false;
						break;
					}
					if (parent.type !== "MemberExpression" && parent.type !== "OptionalMemberExpression") {
						isPropsOnlyUsedInMembers = false;
						break;
					}
				}
				if (isPropsOnlyUsedInMembers) extraWarning = ` However, 'props' will change when *any* prop changes, so the preferred fix is to destructure the 'props' object outside of the ${reactiveHookName} call and refer to those specific props inside ${getSourceCode().getText(reactiveHook)}.`;
			}
			if (!extraWarning && missingDependencies.size > 0) {
				let missingCallbackDep = null;
				missingDependencies.forEach((missingDep) => {
					if (missingCallbackDep) return;
					const topScopeRef = componentScope.set.get(missingDep);
					const usedDep = dependencies.get(missingDep);
					if (!usedDep?.references || usedDep?.references[0]?.resolved !== topScopeRef) return;
					const def = topScopeRef?.defs[0];
					if (def == null || def.name == null || def.type !== "Parameter") return;
					let isFunctionCall = false;
					let id;
					for (const reference of usedDep.references) {
						id = reference.identifier;
						if (id != null && id.parent != null && (id.parent.type === "CallExpression" || id.parent.type === "OptionalCallExpression") && id.parent.callee === id) {
							isFunctionCall = true;
							break;
						}
					}
					if (!isFunctionCall) return;
					missingCallbackDep = missingDep;
				});
				if (missingCallbackDep !== null) extraWarning = ` If '${missingCallbackDep}' changes too often, find the parent component that defines it and wrap that definition in useCallback.`;
			}
			if (!extraWarning && missingDependencies.size > 0) {
				let setStateRecommendation = null;
				for (const missingDep of missingDependencies) {
					if (setStateRecommendation !== null) break;
					const references = dependencies.get(missingDep).references;
					let id;
					let maybeCall;
					for (const reference of references) {
						id = reference.identifier;
						maybeCall = id.parent;
						while (maybeCall != null && maybeCall !== componentScope.block) {
							if (maybeCall.type === "CallExpression") {
								const correspondingStateVariable = setStateCallSites.get(maybeCall.callee);
								if (correspondingStateVariable != null) {
									if ("name" in correspondingStateVariable && correspondingStateVariable.name === missingDep) setStateRecommendation = {
										missingDep,
										setter: "name" in maybeCall.callee ? maybeCall.callee.name : "",
										form: "updater"
									};
									else if (stateVariables.has(id)) setStateRecommendation = {
										missingDep,
										setter: "name" in maybeCall.callee ? maybeCall.callee.name : "",
										form: "reducer"
									};
									else {
										const resolved = reference.resolved;
										if (resolved != null) {
											const def = resolved.defs[0];
											if (def != null && def.type === "Parameter") setStateRecommendation = {
												missingDep,
												setter: "name" in maybeCall.callee ? maybeCall.callee.name : "",
												form: "inlineReducer"
											};
										}
									}
									break;
								}
							}
							maybeCall = maybeCall.parent;
						}
						if (setStateRecommendation !== null) break;
					}
				}
				if (setStateRecommendation !== null) switch (setStateRecommendation.form) {
					case "reducer":
						extraWarning = ` You can also replace multiple useState variables with useReducer if '${setStateRecommendation.setter}' needs the current value of '${setStateRecommendation.missingDep}'.`;
						break;
					case "inlineReducer":
						extraWarning = ` If '${setStateRecommendation.setter}' needs the current value of '${setStateRecommendation.missingDep}', you can also switch to useReducer instead of useState and read '${setStateRecommendation.missingDep}' in the reducer.`;
						break;
					case "updater":
						extraWarning = ` You can also do a functional update '${setStateRecommendation.setter}(${setStateRecommendation.missingDep.slice(0, 1)} => ...)' if you only need '${setStateRecommendation.missingDep}' in the '${setStateRecommendation.setter}' call.`;
						break;
					default: throw new Error("Unknown case.");
				}
			}
			reportProblem({
				node: declaredDependenciesNode,
				message: `React Hook ${getSourceCode().getText(reactiveHook)} has ` + (getWarningMessage(missingDependencies, "a", "missing", "include") || getWarningMessage(unnecessaryDependencies, "an", "unnecessary", "exclude") || getWarningMessage(duplicateDependencies, "a", "duplicate", "omit")) + extraWarning,
				suggest: [{
					desc: `Update the dependencies array to be: [${suggestedDeps.map(formatDependency).join(", ")}]`,
					fix(fixer) {
						return fixer.replaceText(declaredDependenciesNode, `[${suggestedDeps.map(formatDependency).join(", ")}]`);
					}
				}]
			});
		}
		function visitCallExpression(node) {
			const callbackIndex = getReactiveHookCallbackIndex(node.callee, options);
			if (callbackIndex === -1) return;
			let callback = node.arguments[callbackIndex];
			const reactiveHook = node.callee;
			const nodeWithoutNamespace = getNodeWithoutReactNamespace$1(reactiveHook);
			const reactiveHookName = "name" in nodeWithoutNamespace ? nodeWithoutNamespace.name : "";
			const maybeNode = node.arguments[callbackIndex + 1];
			const declaredDependenciesNode = maybeNode && !(maybeNode.type === "Identifier" && maybeNode.name === "undefined") ? maybeNode : void 0;
			const isEffect = /Effect($|[^a-z])/g.test(reactiveHookName);
			if (!callback) {
				reportProblem({
					node: reactiveHook,
					message: `React Hook ${reactiveHookName} requires an effect callback. Did you forget to pass a callback to the hook?`
				});
				return;
			}
			if (!maybeNode && isEffect && options.requireExplicitEffectDeps) reportProblem({
				node: reactiveHook,
				message: `React Hook ${reactiveHookName} always requires dependencies. Please add a dependency array or an explicit \`undefined\``
			});
			const isAutoDepsHook = options.experimental_autoDependenciesHooks.includes(reactiveHookName);
			if ((!declaredDependenciesNode || isAutoDepsHook && declaredDependenciesNode.type === "Literal" && declaredDependenciesNode.value === null) && !isEffect) {
				if (reactiveHookName === "useMemo" || reactiveHookName === "useCallback") reportProblem({
					node: reactiveHook,
					message: `React Hook ${reactiveHookName} does nothing when called with only one argument. Did you forget to pass an array of dependencies?`
				});
				return;
			}
			while (callback.type === "TSAsExpression" || callback.type === "AsExpression") callback = callback.expression;
			switch (callback.type) {
				case "FunctionExpression":
				case "ArrowFunctionExpression":
					visitFunctionWithDependencies(callback, declaredDependenciesNode, reactiveHook, reactiveHookName, isEffect, isAutoDepsHook);
					return;
				case "Identifier":
					if (!declaredDependenciesNode || isAutoDepsHook && declaredDependenciesNode.type === "Literal" && declaredDependenciesNode.value === null) return;
					if ("elements" in declaredDependenciesNode && declaredDependenciesNode.elements && declaredDependenciesNode.elements.some((el) => el && el.type === "Identifier" && el.name === callback.name)) return;
					const variable = getScope(callback).set.get(callback.name);
					if (variable == null || variable.defs == null) return;
					const def = variable.defs[0];
					if (!def || !def.node) break;
					if (def.type === "Parameter") {
						reportProblem({
							node: reactiveHook,
							message: getUnknownDependenciesMessage(reactiveHookName)
						});
						return;
					}
					if (def.type !== "Variable" && def.type !== "FunctionName") break;
					switch (def.node.type) {
						case "FunctionDeclaration":
							visitFunctionWithDependencies(def.node, declaredDependenciesNode, reactiveHook, reactiveHookName, isEffect, isAutoDepsHook);
							return;
						case "VariableDeclarator":
							const init = def.node.init;
							if (!init) break;
							switch (init.type) {
								case "ArrowFunctionExpression":
								case "FunctionExpression":
									visitFunctionWithDependencies(init, declaredDependenciesNode, reactiveHook, reactiveHookName, isEffect, isAutoDepsHook);
									return;
							}
							break;
					}
					break;
				default:
					reportProblem({
						node: reactiveHook,
						message: getUnknownDependenciesMessage(reactiveHookName)
					});
					return;
			}
			reportProblem({
				node: reactiveHook,
				message: `React Hook ${reactiveHookName} has a missing dependency: '${callback.name}'. Either include it or remove the dependency array.`,
				suggest: [{
					desc: `Update the dependencies array to be: [${callback.name}]`,
					fix(fixer) {
						return fixer.replaceText(declaredDependenciesNode, `[${callback.name}]`);
					}
				}]
			});
		}
		return { CallExpression: visitCallExpression };
	}
};
function collectRecommendations({ dependencies, declaredDependencies, stableDependencies, externalDependencies, isEffect }) {
	const depTree = createDepTree();
	function createDepTree() {
		return {
			isUsed: false,
			isSatisfiedRecursively: false,
			isSubtreeUsed: false,
			children: /* @__PURE__ */ new Map()
		};
	}
	dependencies.forEach((_, key) => {
		const node = getOrCreateNodeByPath(depTree, key);
		node.isUsed = true;
		markAllParentsByPath(depTree, key, (parent) => {
			parent.isSubtreeUsed = true;
		});
	});
	declaredDependencies.forEach(({ key }) => {
		const node = getOrCreateNodeByPath(depTree, key);
		node.isSatisfiedRecursively = true;
	});
	stableDependencies.forEach((key) => {
		const node = getOrCreateNodeByPath(depTree, key);
		node.isSatisfiedRecursively = true;
	});
	function getOrCreateNodeByPath(rootNode, path) {
		const keys = path.split(".");
		let node = rootNode;
		for (const key of keys) {
			let child = node.children.get(key);
			if (!child) {
				child = createDepTree();
				node.children.set(key, child);
			}
			node = child;
		}
		return node;
	}
	function markAllParentsByPath(rootNode, path, fn) {
		const keys = path.split(".");
		let node = rootNode;
		for (const key of keys) {
			const child = node.children.get(key);
			if (!child) return;
			fn(child);
			node = child;
		}
	}
	const missingDependencies = /* @__PURE__ */ new Set();
	const satisfyingDependencies = /* @__PURE__ */ new Set();
	scanTreeRecursively(depTree, missingDependencies, satisfyingDependencies, (key) => key);
	function scanTreeRecursively(node, missingPaths, satisfyingPaths, keyToPath) {
		node.children.forEach((child, key) => {
			const path = keyToPath(key);
			if (child.isSatisfiedRecursively) {
				if (child.isSubtreeUsed) satisfyingPaths.add(path);
				return;
			}
			if (child.isUsed) {
				missingPaths.add(path);
				return;
			}
			scanTreeRecursively(child, missingPaths, satisfyingPaths, (childKey) => path + "." + childKey);
		});
	}
	const suggestedDependencies = [];
	const unnecessaryDependencies = /* @__PURE__ */ new Set();
	const duplicateDependencies = /* @__PURE__ */ new Set();
	declaredDependencies.forEach(({ key }) => {
		if (satisfyingDependencies.has(key)) if (suggestedDependencies.indexOf(key) === -1) suggestedDependencies.push(key);
		else duplicateDependencies.add(key);
		else if (isEffect && !key.endsWith(".current") && !externalDependencies.has(key)) {
			if (suggestedDependencies.indexOf(key) === -1) suggestedDependencies.push(key);
		} else unnecessaryDependencies.add(key);
	});
	missingDependencies.forEach((key) => {
		suggestedDependencies.push(key);
	});
	return {
		suggestedDependencies,
		unnecessaryDependencies,
		duplicateDependencies,
		missingDependencies
	};
}
function getConstructionExpressionType(node) {
	switch (node.type) {
		case "ObjectExpression": return "object";
		case "ArrayExpression": return "array";
		case "ArrowFunctionExpression":
		case "FunctionExpression": return "function";
		case "ClassExpression": return "class";
		case "ConditionalExpression":
			if (getConstructionExpressionType(node.consequent) != null || getConstructionExpressionType(node.alternate) != null) return "conditional";
			return null;
		case "LogicalExpression":
			if (getConstructionExpressionType(node.left) != null || getConstructionExpressionType(node.right) != null) return "logical expression";
			return null;
		case "JSXFragment": return "JSX fragment";
		case "JSXElement": return "JSX element";
		case "AssignmentExpression":
			if (getConstructionExpressionType(node.right) != null) return "assignment expression";
			return null;
		case "NewExpression": return "object construction";
		case "Literal":
			if (node.value instanceof RegExp) return "regular expression";
			return null;
		case "TypeCastExpression":
		case "AsExpression":
		case "TSAsExpression": return getConstructionExpressionType(node.expression);
	}
	return null;
}
function scanForConstructions({ declaredDependencies, declaredDependenciesNode, componentScope, scope }) {
	const constructions = declaredDependencies.map(({ key }) => {
		const ref = componentScope.variables.find((v) => v.name === key);
		if (ref == null) return null;
		const node = ref.defs[0];
		if (node == null) return null;
		if (node.type === "Variable" && node.node.type === "VariableDeclarator" && node.node.id.type === "Identifier" && node.node.init != null) {
			const constantExpressionType = getConstructionExpressionType(node.node.init);
			if (constantExpressionType) return [ref, constantExpressionType];
		}
		if (node.type === "FunctionName" && node.node.type === "FunctionDeclaration") return [ref, "function"];
		if (node.type === "ClassName" && node.node.type === "ClassDeclaration") return [ref, "class"];
		return null;
	}).filter(Boolean);
	function isUsedOutsideOfHook(ref) {
		let foundWriteExpr = false;
		for (const reference of ref.references) {
			if (reference.writeExpr) if (foundWriteExpr) return true;
			else {
				foundWriteExpr = true;
				continue;
			}
			let currentScope = reference.from;
			while (currentScope !== scope && currentScope != null) currentScope = currentScope.upper;
			if (currentScope !== scope) {
				if (!isAncestorNodeOf(declaredDependenciesNode, reference.identifier)) return true;
			}
		}
		return false;
	}
	return constructions.map(([ref, depType]) => ({
		construction: ref.defs[0],
		depType,
		isUsedOutsideOfHook: isUsedOutsideOfHook(ref)
	}));
}
/**
* Assuming () means the passed/returned node:
* (props) => (props)
* props.(foo) => (props.foo)
* props.foo.(bar) => (props).foo.bar
* props.foo.bar.(baz) => (props).foo.bar.baz
*/
function getDependency(node) {
	if (node.parent && (node.parent.type === "MemberExpression" || node.parent.type === "OptionalMemberExpression") && node.parent.object === node && "name" in node.parent.property && node.parent.property.name !== "current" && !node.parent.computed && !(node.parent.parent != null && (node.parent.parent.type === "CallExpression" || node.parent.parent.type === "OptionalCallExpression") && node.parent.parent.callee === node.parent)) return getDependency(node.parent);
	else if (node.type === "MemberExpression" && node.parent && node.parent.type === "AssignmentExpression" && node.parent.left === node) return node.object;
	else return node;
}
/**
* Mark a node as either optional or required.
* Note: If the node argument is an OptionalMemberExpression, it doesn't necessarily mean it is optional.
* It just means there is an optional member somewhere inside.
* This particular node might still represent a required member, so check .optional field.
*/
function markNode(node, optionalChains, result) {
	if (optionalChains) if ("optional" in node && node.optional) {
		if (!optionalChains.has(result)) optionalChains.set(result, true);
	} else optionalChains.set(result, false);
}
/**
* Assuming () means the passed node.
* (foo) -> 'foo'
* foo(.)bar -> 'foo.bar'
* foo.bar(.)baz -> 'foo.bar.baz'
* Otherwise throw.
*/
function analyzePropertyChain(node, optionalChains) {
	if (node.type === "Identifier" || node.type === "JSXIdentifier") {
		const result = node.name;
		if (optionalChains) optionalChains.set(result, false);
		return result;
	} else if (node.type === "MemberExpression" && !node.computed) {
		const result = `${analyzePropertyChain(node.object, optionalChains)}.${analyzePropertyChain(node.property, null)}`;
		markNode(node, optionalChains, result);
		return result;
	} else if (node.type === "OptionalMemberExpression" && !node.computed) {
		const result = `${analyzePropertyChain(node.object, optionalChains)}.${analyzePropertyChain(node.property, null)}`;
		markNode(node, optionalChains, result);
		return result;
	} else if (node.type === "ChainExpression" && (!("computed" in node) || !node.computed)) {
		const expression = node.expression;
		if (expression.type === "CallExpression") throw new Error(`Unsupported node type: ${expression.type}`);
		const result = `${analyzePropertyChain(expression.object, optionalChains)}.${analyzePropertyChain(expression.property, null)}`;
		markNode(expression, optionalChains, result);
		return result;
	} else throw new Error(`Unsupported node type: ${node.type}`);
}
function getNodeWithoutReactNamespace$1(node) {
	if (node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "React" && node.property.type === "Identifier" && !node.computed) return node.property;
	return node;
}
function getReactiveHookCallbackIndex(calleeNode, options) {
	const node = getNodeWithoutReactNamespace$1(calleeNode);
	if (node.type !== "Identifier") return -1;
	switch (node.name) {
		case "useEffect":
		case "useLayoutEffect":
		case "useCallback":
		case "useMemo": return 0;
		case "useImperativeHandle": return 1;
		default: if (node === calleeNode && options && options.additionalHooks) {
			let name;
			try {
				name = analyzePropertyChain(node, null);
			} catch (error) {
				if (error instanceof Error && /Unsupported node type/.test(error.message)) return 0;
				else throw error;
			}
			return options.additionalHooks.test(name) ? 0 : -1;
		} else return -1;
	}
}
/**
* ESLint won't assign node.parent to references from context.getScope()
*
* So instead we search for the node from an ancestor assigning node.parent
* as we go. This mutates the AST.
*
* This traversal is:
* - optimized by only searching nodes with a range surrounding our target node
* - agnostic to AST node types, it looks for `{ type: string, ... }`
*/
function fastFindReferenceWithParent(start, target) {
	const queue = [start];
	let item;
	while (queue.length) {
		item = queue.shift();
		if (isSameIdentifier(item, target)) return item;
		if (!isAncestorNodeOf(item, target)) continue;
		for (const [key, value] of Object.entries(item)) {
			if (key === "parent") continue;
			if (isNodeLike(value)) {
				value.parent = item;
				queue.push(value);
			} else if (Array.isArray(value)) value.forEach((val) => {
				if (isNodeLike(val)) {
					val.parent = item;
					queue.push(val);
				}
			});
		}
	}
	return null;
}
function joinEnglish(arr) {
	let s = "";
	for (let i = 0; i < arr.length; i++) {
		s += arr[i];
		if (i === 0 && arr.length === 2) s += " and ";
		else if (i === arr.length - 2 && arr.length > 2) s += ", and ";
		else if (i < arr.length - 1) s += ", ";
	}
	return s;
}
function isNodeLike(val) {
	return typeof val === "object" && val !== null && !Array.isArray(val) && "type" in val && typeof val.type === "string";
}
function isSameIdentifier(a, b) {
	return (a.type === "Identifier" || a.type === "JSXIdentifier") && a.type === b.type && a.name === b.name && !!a.range && !!b.range && a.range[0] === b.range[0] && a.range[1] === b.range[1];
}
function isAncestorNodeOf(a, b) {
	return !!a.range && !!b.range && a.range[0] <= b.range[0] && a.range[1] >= b.range[1];
}
function isUseEffectEventIdentifier$1(node) {
	return node.type === "Identifier" && node.name === "useEffectEvent";
}
function getUnknownDependenciesMessage(reactiveHookName) {
	return `React Hook ${reactiveHookName} received a function whose dependencies are unknown. Pass an inline function instead.`;
}

//#endregion
//#region src/rules/immutability/immutability.ts
const RULE_NAME$52 = "immutability";
/**
* Array methods that mutate the array in place.
* @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
*/
const MUTATING_ARRAY_METHODS = new Set([
	"copyWithin",
	"fill",
	"pop",
	"push",
	"reverse",
	"shift",
	"sort",
	"splice",
	"unshift"
]);
var immutability_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates against mutating props, state, and other values that are immutable." },
		messages: {
			mutatingArrayMethod: "Do not call '{{method}}()' on '{{name}}'. Props and state are immutable — create a new array instead.",
			mutatingAssignment: "Do not mutate '{{name}}' directly. Props and state are immutable — create a new object instead."
		},
		schema: []
	},
	name: RULE_NAME$52,
	create: create$52,
	defaultOptions: []
});
function create$52(context) {
	const { additionalStateHooks } = getSettingsFromContext(context);
	const hCollector = core.getHookCollector(context);
	const cCollector = core.getComponentCollector(context);
	/**
	* Violations accumulated while traversing. Each entry records the node to
	* report and the enclosing function so we can filter at Program:exit.
	*/
	const violations = [];
	function isUseStateCall(node) {
		return core.isUseStateLikeCall(node, additionalStateHooks);
	}
	/**
	* Return true when `id` is the *value* variable (index 0) produced by a
	* `useState(…)` call, i.e. the first element of `const [value, setter] = useState(…)`.
	* @param id The identifier to check. May be a reference to the state variable, e.g. used inside an event handler nested in the component body — scope resolution will trace it back to the original declaration.
	* @returns True if `id` is a state variable, false otherwise.
	*/
	function isStateValue(id) {
		const initNode = resolve(context, id);
		if (initNode == null || initNode.type !== AST_NODE_TYPES.CallExpression) return false;
		if (!isUseStateCall(initNode)) return false;
		const declarator = initNode.parent;
		if (!("id" in declarator) || declarator.id?.type !== AST_NODE_TYPES.ArrayPattern) return true;
		return declarator.id.elements.findIndex((el) => el?.type === AST_NODE_TYPES.Identifier && el.name === id.name) === 0;
	}
	/**
	* Return the function node when `id` is a direct (non-destructured) props
	* parameter at position 0 of any ancestor function; otherwise return `null`.
	*
	* The caller must later verify (at Program:exit) that the returned function
	* is actually a component or hook — event handler parameters share the same
	* syntactic shape but should **not** be treated as React props.
	*
	* Uses scope resolution so that references to `props` inside nested arrow
	* functions (ex: event handlers) are correctly traced back to the component
	* parameter, e.g.:
	*
	*   function Component(props) {        // ← props defined here
	*     const handleClick = () => {
	*       props.items.push(4); // ← props resolved via scope to Component's param
	*     };
	*   }
	* @param id The identifier to check. May be a reference to the props parameter, e.g. used inside an event handler nested in the component body — scope resolution will trace it back to the original declaration.
	* @returns The function node where `id` is the first parameter, or `null`.
	*/
	function getPropsDefiningFunction(id) {
		const variable = findVariable(context.sourceCode.getScope(id), id);
		if (variable == null) return null;
		for (const def of variable.defs) {
			if (def.type !== DefinitionType.Parameter) continue;
			if (!ast.isFunction(def.node)) continue;
			const fn = def.node;
			const firstParam = fn.params.at(0);
			if (firstParam?.type === AST_NODE_TYPES.Identifier && firstParam.name === id.name) return fn;
		}
		return null;
	}
	return defineRuleListener(hCollector.visitor, cCollector.visitor, {
		CallExpression(node) {
			if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
			const { object, property } = node.callee;
			if (property.type !== AST_NODE_TYPES.Identifier) return;
			if (!MUTATING_ARRAY_METHODS.has(property.name)) return;
			const rootId = ast.getRootIdentifier(object);
			if (rootId == null) return;
			if (rootId.name === "draft") return;
			const enclosingFn = ast.findParent(node, ast.isFunction);
			if (enclosingFn == null) return;
			const isState = isStateValue(rootId);
			const propsDefiningFunc = !isState ? getPropsDefiningFunction(rootId) : null;
			if (!isState && propsDefiningFunc == null) return;
			violations.push({
				data: {
					name: context.sourceCode.getText(object),
					method: property.name
				},
				func: enclosingFn,
				messageId: "mutatingArrayMethod",
				node,
				...propsDefiningFunc != null ? { propsDefiningFunc } : {}
			});
		},
		AssignmentExpression(node) {
			if (node.left.type !== AST_NODE_TYPES.MemberExpression) return;
			const rootId = ast.getRootIdentifier(node.left);
			if (rootId == null) return;
			if (rootId.name === "draft") return;
			const enclosingFn = ast.findParent(node, ast.isFunction);
			if (enclosingFn == null) return;
			const isState = isStateValue(rootId);
			const propsDefiningFunc = !isState ? getPropsDefiningFunction(rootId) : null;
			if (!isState && propsDefiningFunc == null) return;
			violations.push({
				data: { name: context.sourceCode.getText(node.left.object) },
				func: enclosingFn,
				messageId: "mutatingAssignment",
				node,
				...propsDefiningFunc != null ? { propsDefiningFunc } : {}
			});
		},
		"Program:exit"(node) {
			const comps = cCollector.api.getAllComponents(node);
			const hooks = hCollector.api.getAllHooks(node);
			const funcs = [...comps, ...hooks];
			for (const { data, func, messageId, node, propsDefiningFunc } of violations) {
				let current = func;
				let insideComponentOrHook = false;
				while (current != null) {
					if (funcs.some((f) => f.node === current)) {
						insideComponentOrHook = true;
						break;
					}
					current = ast.findParent(current, ast.isFunction);
				}
				if (!insideComponentOrHook) continue;
				if (propsDefiningFunc != null) {
					if (!funcs.some((f) => f.node === propsDefiningFunc)) continue;
				}
				context.report({
					data,
					messageId,
					node
				});
			}
		}
	});
}

//#endregion
//#region ../../../.pkgs/eff/dist/index.js
function not(predicate) {
	return (data) => !predicate(data);
}
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
* Do nothing and return `void`.
*/
function constVoid() {}
/**
* Do nothing and return `true`.
*
* @returns true
*/
function constTrue() {
	return true;
}
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
function flow(ab, bc, cd, de, ef, fg, gh, hi, ij) {
	switch (arguments.length) {
		case 1: return ab;
		case 2: return function() {
			return bc(ab.apply(this, arguments));
		};
		case 3: return function() {
			return cd(bc(ab.apply(this, arguments)));
		};
		case 4: return function() {
			return de(cd(bc(ab.apply(this, arguments))));
		};
		case 5: return function() {
			return ef(de(cd(bc(ab.apply(this, arguments)))));
		};
		case 6: return function() {
			return fg(ef(de(cd(bc(ab.apply(this, arguments))))));
		};
		case 7: return function() {
			return gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))));
		};
		case 8: return function() {
			return hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments))))))));
		};
		case 9: return function() {
			return ij(hi(gh(fg(ef(de(cd(bc(ab.apply(this, arguments)))))))));
		};
	}
}
function getOrInsertComputed(map, key, callback) {
	if (map.has(key)) return map.get(key);
	const value = callback(key);
	map.set(key, value);
	return value;
}

//#endregion
//#region src/rules/no-access-state-in-setstate/no-access-state-in-setstate.ts
const RULE_NAME$51 = "no-access-state-in-setstate";
function isKeyLiteral$2(node, key) {
	return match(key).with({ type: AST_NODE_TYPES.Literal }, constTrue).with({
		type: AST_NODE_TYPES.TemplateLiteral,
		expressions: []
	}, constTrue).with({ type: AST_NODE_TYPES.Identifier }, () => !node.computed).otherwise(constFalse);
}
var no_access_state_in_setstate_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows accessing 'this.state' inside 'setState' calls." },
		messages: { default: "Do not access 'this.state' within 'setState'. Use the update function instead." },
		schema: []
	},
	name: RULE_NAME$51,
	create: create$51,
	defaultOptions: []
});
function create$51(context) {
	if (!context.sourceCode.text.includes("setState")) return {};
	const classStack = [];
	const methodStack = [];
	const setStateStack = [];
	return defineRuleListener({
		CallExpression(node) {
			if (!core.isThisSetStateCall(node)) return;
			setStateStack.push([node, false]);
		},
		"CallExpression:exit"(node) {
			if (!core.isThisSetStateCall(node)) return;
			setStateStack.pop();
		},
		ClassDeclaration(node) {
			classStack.push([node, core.isClassComponent(node)]);
		},
		"ClassDeclaration:exit"() {
			classStack.pop();
		},
		ClassExpression(node) {
			classStack.push([node, core.isClassComponent(node)]);
		},
		"ClassExpression:exit"() {
			classStack.pop();
		},
		MemberExpression(node) {
			if (!ast.isThisExpressionLoose(node.object)) return;
			const [currClass, isComponent = false] = classStack.at(-1) ?? [];
			if (currClass == null || !isComponent) return;
			const [currMethod, isStatic = false] = methodStack.at(-1) ?? [];
			if (currMethod == null || isStatic) return;
			const [setState, hasThisState = false] = setStateStack.at(-1) ?? [];
			if (setState == null || hasThisState) return;
			if (ast.getPropertyName(node.property) !== "state") return;
			context.report({
				messageId: "default",
				node
			});
		},
		MethodDefinition(node) {
			methodStack.push([node, node.static]);
		},
		"MethodDefinition:exit"() {
			methodStack.pop();
		},
		PropertyDefinition(node) {
			methodStack.push([node, node.static]);
		},
		"PropertyDefinition:exit"() {
			methodStack.pop();
		},
		VariableDeclarator(node) {
			const [currClass, isComponent = false] = classStack.at(-1) ?? [];
			if (currClass == null || !isComponent) return;
			const [currMethod, isStatic = false] = methodStack.at(-1) ?? [];
			if (currMethod == null || isStatic) return;
			const [setState, hasThisState = false] = setStateStack.at(-1) ?? [];
			if (setState == null || hasThisState) return;
			if (node.init == null || !ast.isThisExpressionLoose(node.init) || node.id.type !== AST_NODE_TYPES.ObjectPattern) return;
			if (!node.id.properties.some((prop) => prop.type === AST_NODE_TYPES.Property && isKeyLiteral$2(prop, prop.key) && ast.getPropertyName(prop.key) === "state")) return;
			context.report({
				messageId: "default",
				node
			});
		}
	});
}

//#endregion
//#region src/rules/no-array-index-key/no-array-index-key.ts
const RULE_NAME$50 = "no-array-index-key";
function getIndexParamPosition(methodName) {
	switch (methodName) {
		case "every":
		case "filter":
		case "find":
		case "findIndex":
		case "findLast":
		case "findLastIndex":
		case "flatMap":
		case "forEach":
		case "map":
		case "some": return 1;
		case "reduce":
		case "reduceRight": return 2;
		default: return -1;
	}
}
function getMapIndexParamName(context, node) {
	const { callee } = node;
	if (callee.type !== AST_NODE_TYPES.MemberExpression) return null;
	if (callee.property.type !== AST_NODE_TYPES.Identifier) return null;
	const { name } = callee.property;
	const indexPosition = getIndexParamPosition(name);
	if (indexPosition === -1) return null;
	const callbackArg = node.arguments[core.isChildrenMap(context, callee) || core.isChildrenForEach(context, callee) ? 1 : 0];
	if (callbackArg == null) return null;
	if (!ast.isOneOf([AST_NODE_TYPES.ArrowFunctionExpression, AST_NODE_TYPES.FunctionExpression])(callbackArg)) return null;
	const { params } = callbackArg;
	if (params.length < indexPosition + 1) return null;
	const param = params.at(indexPosition);
	return param != null && "name" in param ? param.name : null;
}
function getIdentifiersFromBinaryExpression(side) {
	if (side.type === AST_NODE_TYPES.Identifier) return [side];
	if (side.type === AST_NODE_TYPES.BinaryExpression) return [...getIdentifiersFromBinaryExpression(side.left), ...getIdentifiersFromBinaryExpression(side.right)];
	return [];
}
var no_array_index_key_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows using an item's index in the array as its key." },
		messages: { default: "Do not use item index in the array as its key." },
		schema: []
	},
	name: RULE_NAME$50,
	create: create$50,
	defaultOptions: []
});
function create$50(context) {
	const indexParamNames = [];
	function isArrayIndex(node) {
		return node.type === AST_NODE_TYPES.Identifier && indexParamNames.some((name) => name != null && name === node.name);
	}
	function isCreateOrCloneElementCall(node) {
		return core.isCreateElementCall(context, node) || core.isCloneElementCall(context, node);
	}
	function getReportDescriptors(node) {
		switch (node.type) {
			case AST_NODE_TYPES.Identifier:
				if (indexParamNames.some((name) => name != null && name === node.name)) return [{
					messageId: "default",
					node
				}];
				return [];
			case AST_NODE_TYPES.TemplateLiteral:
			case AST_NODE_TYPES.BinaryExpression: {
				const descriptors = [];
				const expressions = node.type === AST_NODE_TYPES.TemplateLiteral ? node.expressions : getIdentifiersFromBinaryExpression(node);
				for (const expression of expressions) if (isArrayIndex(expression)) descriptors.push({
					messageId: "default",
					node: expression
				});
				return descriptors;
			}
			case AST_NODE_TYPES.CallExpression: switch (true) {
				case node.callee.type === AST_NODE_TYPES.MemberExpression && node.callee.property.type === AST_NODE_TYPES.Identifier && node.callee.property.name === "toString" && isArrayIndex(node.callee.object): return [{
					messageId: "default",
					node: node.callee.object
				}];
				case node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === "String" && node.arguments[0] != null && isArrayIndex(node.arguments[0]): return [{
					messageId: "default",
					node: node.arguments[0]
				}];
			}
		}
		return [];
	}
	return defineRuleListener({
		CallExpression(node) {
			indexParamNames.push(getMapIndexParamName(context, node));
			if (node.arguments.length === 0) return;
			if (!isCreateOrCloneElementCall(node)) return;
			const [, props] = node.arguments;
			if (props?.type !== AST_NODE_TYPES.ObjectExpression) return;
			for (const prop of props.properties) {
				if (!isMatching({ key: { name: "key" } })(prop)) continue;
				if (!("value" in prop)) continue;
				for (const descriptor of getReportDescriptors(prop.value)) report(context)(descriptor);
			}
		},
		"CallExpression:exit"() {
			indexParamNames.pop();
		},
		JSXAttribute(node) {
			if (node.name.name !== "key") return;
			if (indexParamNames.length === 0) return;
			if (node.value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
			for (const descriptor of getReportDescriptors(node.value.expression)) report(context)(descriptor);
		}
	});
}

//#endregion
//#region src/rules/no-children-count/no-children-count.ts
const RULE_NAME$49 = "no-children-count";
var no_children_count_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows the use of 'Children.count' from the 'react' package." },
		messages: { default: "Using 'Children.count' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$49,
	create: create$49,
	defaultOptions: []
});
function create$49(context) {
	return defineRuleListener({ MemberExpression(node) {
		if (core.isChildrenCount(context, node)) context.report({
			messageId: "default",
			node: node.property
		});
	} });
}

//#endregion
//#region src/rules/no-children-for-each/no-children-for-each.ts
const RULE_NAME$48 = "no-children-for-each";
var no_children_for_each_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows the use of 'Children.forEach' from the 'react' package." },
		messages: { default: "Using 'Children.forEach' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$48,
	create: create$48,
	defaultOptions: []
});
function create$48(context) {
	return defineRuleListener({ MemberExpression(node) {
		if (core.isChildrenForEach(context, node)) context.report({
			messageId: "default",
			node: node.property
		});
	} });
}

//#endregion
//#region src/rules/no-children-map/no-children-map.ts
const RULE_NAME$47 = "no-children-map";
var no_children_map_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows the use of 'Children.map' from the 'react' package." },
		messages: { default: "Using 'Children.map' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$47,
	create: create$47,
	defaultOptions: []
});
function create$47(context) {
	return defineRuleListener({ MemberExpression(node) {
		if (core.isChildrenMap(context, node)) context.report({
			messageId: "default",
			node: node.property
		});
	} });
}

//#endregion
//#region src/rules/no-children-only/no-children-only.ts
const RULE_NAME$46 = "no-children-only";
var no_children_only_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows the use of 'Children.only' from the 'react' package." },
		messages: { default: "Using 'Children.only' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$46,
	create: create$46,
	defaultOptions: []
});
function create$46(context) {
	return defineRuleListener({ MemberExpression(node) {
		if (core.isChildrenOnly(context, node)) context.report({
			messageId: "default",
			node: node.property
		});
	} });
}

//#endregion
//#region src/rules/no-children-to-array/no-children-to-array.ts
const RULE_NAME$45 = "no-children-to-array";
var no_children_to_array_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows the use of 'Children.toArray' from the 'react' package." },
		messages: { default: "Using 'Children.toArray' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$45,
	create: create$45,
	defaultOptions: []
});
function create$45(context) {
	return defineRuleListener({ MemberExpression(node) {
		if (core.isChildrenToArray(context, node)) context.report({
			messageId: "default",
			node: node.property
		});
	} });
}

//#endregion
//#region src/rules/no-class-component/no-class-component.ts
const RULE_NAME$44 = "no-class-component";
var no_class_component_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows class components except for error boundaries." },
		messages: { default: "Avoid using class components. Use function components instead." },
		schema: []
	},
	name: RULE_NAME$44,
	create: create$44,
	defaultOptions: []
});
function create$44(context) {
	if (!context.sourceCode.text.includes("Component")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { name = "anonymous", node: component } of api.getAllComponents(program)) {
			if (component.body.body.some((m) => core.isComponentDidCatch(m) || core.isGetDerivedStateFromError(m))) continue;
			context.report({
				data: { name },
				messageId: "default",
				node: component
			});
		}
	} });
}

//#endregion
//#region src/rules/no-clone-element/no-clone-element.ts
const RULE_NAME$43 = "no-clone-element";
var no_clone_element_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows 'cloneElement'." },
		messages: { default: "Using 'cloneElement' is uncommon and can lead to fragile code. Use alternatives instead." },
		schema: []
	},
	name: RULE_NAME$43,
	create: create$43,
	defaultOptions: []
});
function create$43(context) {
	return defineRuleListener({ CallExpression(node) {
		if (core.isCloneElementCall(context, node)) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-component-will-mount/no-component-will-mount.ts
const RULE_NAME$42 = "no-component-will-mount";
var no_component_will_mount_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Replaces usage of 'componentWillMount' with 'UNSAFE_componentWillMount'." },
		fixable: "code",
		messages: { default: "[Deprecated] Use 'UNSAFE_componentWillMount' instead." },
		schema: []
	},
	name: RULE_NAME$42,
	create: create$42,
	defaultOptions: []
});
function create$42(context) {
	if (!context.sourceCode.text.includes("componentWillMount")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isComponentWillMount(member)) context.report({
				fix(fixer) {
					if (!("key" in member)) return null;
					return fixer.replaceText(member.key, "UNSAFE_componentWillMount");
				},
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-component-will-receive-props/no-component-will-receive-props.ts
const RULE_NAME$41 = "no-component-will-receive-props";
var no_component_will_receive_props_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Replaces usage of 'componentWillReceiveProps' with 'UNSAFE_componentWillReceiveProps'." },
		fixable: "code",
		messages: { default: "[Deprecated] Use 'UNSAFE_componentWillReceiveProps' instead." },
		schema: []
	},
	name: RULE_NAME$41,
	create: create$41,
	defaultOptions: []
});
function create$41(context) {
	if (!context.sourceCode.text.includes("componentWillReceiveProps")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isComponentWillReceiveProps(member)) context.report({
				fix(fixer) {
					if (!("key" in member)) return null;
					return fixer.replaceText(member.key, "UNSAFE_componentWillReceiveProps");
				},
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-component-will-update/no-component-will-update.ts
const RULE_NAME$40 = "no-component-will-update";
var no_component_will_update_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Replaces usage of 'componentWillUpdate' with 'UNSAFE_componentWillUpdate'." },
		fixable: "code",
		messages: { default: "[Deprecated] Use 'UNSAFE_componentWillUpdate' instead." },
		schema: []
	},
	name: RULE_NAME$40,
	create: create$40,
	defaultOptions: []
});
function create$40(context) {
	if (!context.sourceCode.text.includes("componentWillUpdate")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isComponentWillUpdate(member)) context.report({
				fix(fixer) {
					if (!("key" in member)) return null;
					return fixer.replaceText(member.key, "UNSAFE_componentWillUpdate");
				},
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-context-provider/no-context-provider.ts
const RULE_NAME$39 = "no-context-provider";
var no_context_provider_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Replaces usage of '<Context.Provider>' with '<Context>'." },
		fixable: "code",
		hasSuggestions: true,
		messages: {
			default: "In React 19, you can render '<Context>' as a provider instead of '<Context.Provider>'.",
			replace: "Replace '<Context.Provider>' with '<Context>'."
		},
		schema: []
	},
	name: RULE_NAME$39,
	create: create$39,
	defaultOptions: []
});
function create$39(context) {
	if (!context.sourceCode.text.includes("Provider")) return {};
	const { version } = getSettingsFromContext(context);
	if (compare(version, "19.0.0", "<")) return {};
	return defineRuleListener({ JSXElement(node) {
		const parts = getElementFullType(node).split(".");
		const selfName = parts.pop();
		const contextFullName = parts.join(".");
		const contextSelfName = parts.pop();
		if (selfName !== "Provider") return;
		if (contextSelfName == null || !contextSelfName.endsWith("Context")) return;
		context.report({
			messageId: "default",
			node,
			suggest: [{
				fix(fixer) {
					if (!core.isComponentNameLoose(contextSelfName)) return null;
					const openingElement = node.openingElement;
					const closingElement = node.closingElement;
					if (closingElement == null) return fixer.replaceText(openingElement.name, contextFullName);
					return [fixer.replaceText(openingElement.name, contextFullName), fixer.replaceText(closingElement.name, contextFullName)];
				},
				messageId: "replace"
			}]
		});
	} });
}

//#endregion
//#region src/rules/no-create-ref/no-create-ref.ts
const RULE_NAME$38 = "no-create-ref";
var no_create_ref_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows 'createRef' in function components." },
		messages: { default: "[Deprecated] Use 'useRef' instead." },
		schema: []
	},
	name: RULE_NAME$38,
	create: create$38,
	defaultOptions: []
});
function create$38(context) {
	return defineRuleListener({ CallExpression(node) {
		if (core.isCreateRefCall(context, node) && ast.findParent(node, core.isClassComponent) == null) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-direct-mutation-state/no-direct-mutation-state.ts
const RULE_NAME$37 = "no-direct-mutation-state";
function isConstructorFunction(node) {
	return ast.isOneOf([AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.FunctionExpression])(node) && ast.isMethodOrProperty(node.parent) && node.parent.key.type === AST_NODE_TYPES.Identifier && node.parent.key.name === "constructor";
}
var no_direct_mutation_state_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows direct mutation of 'this.state'." },
		messages: { default: "Do not mutate state directly. Use 'setState()' instead." },
		schema: []
	},
	name: RULE_NAME$37,
	create: create$37,
	defaultOptions: []
});
function create$37(context) {
	return defineRuleListener({ AssignmentExpression(node) {
		if (!core.isAssignmentToThisState(node)) return;
		const parentClass = ast.findParent(node, ast.isOneOf([AST_NODE_TYPES.ClassDeclaration, AST_NODE_TYPES.ClassExpression]));
		if (parentClass == null) return;
		if (core.isClassComponent(parentClass) && context.sourceCode.getScope(node).block !== ast.findParent(node, isConstructorFunction)) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-duplicate-key/no-duplicate-key.ts
const RULE_NAME$36 = "no-duplicate-key";
var no_duplicate_key_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents duplicate 'key' props on sibling elements when rendering lists." },
		messages: { default: "The 'key' prop must be unique to its sibling elements." },
		schema: []
	},
	name: RULE_NAME$36,
	create: create$36,
	defaultOptions: []
});
function create$36(context) {
	if (!context.sourceCode.text.includes("key=")) return {};
	const keyedEntries = /* @__PURE__ */ new Map();
	function isKeyValueEqual(a, b) {
		const aValue = a.value;
		const bValue = b.value;
		if (aValue == null || bValue == null) return false;
		return ast.isNodeEqual(aValue, bValue);
	}
	return defineRuleListener({
		"JSXAttribute[name.name='key']"(node) {
			const jsxElement = node.parent.parent;
			switch (jsxElement.parent.type) {
				case AST_NODE_TYPES.ArrayExpression:
				case AST_NODE_TYPES.JSXElement:
				case AST_NODE_TYPES.JSXFragment: {
					const root = jsxElement.parent;
					const prevKeys = keyedEntries.get(root)?.keys ?? [];
					keyedEntries.set(root, {
						hasDuplicate: prevKeys.some((prevKey) => isKeyValueEqual(prevKey, node)),
						keys: [...prevKeys, node],
						root: jsxElement.parent
					});
					break;
				}
				default: {
					const call = ast.findParent(jsxElement, (n) => n.type === AST_NODE_TYPES.CallExpression && n.callee.type === AST_NODE_TYPES.MemberExpression && n.callee.property.type === AST_NODE_TYPES.Identifier && n.callee.property.name === "map");
					const iter = ast.findParent(jsxElement, (n) => n === call || ast.isFunction(n));
					if (!ast.isFunction(iter)) return;
					const arg0 = call?.arguments[0];
					if (call == null || arg0 == null) return;
					if (ast.getUnderlyingExpression(arg0) !== iter) return;
					keyedEntries.set(call, {
						hasDuplicate: node.value?.type === AST_NODE_TYPES.Literal,
						keys: [node],
						root: call
					});
				}
			}
		},
		"Program:exit"() {
			for (const { hasDuplicate, keys } of keyedEntries.values()) {
				if (!hasDuplicate) continue;
				for (const key of keys) context.report({
					data: { value: context.sourceCode.getText(key) },
					messageId: "default",
					node: key
				});
			}
		}
	});
}

//#endregion
//#region src/rules/no-forward-ref/no-forward-ref.ts
const RULE_NAME$35 = "no-forward-ref";
var no_forward_ref_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Replaces usage of 'forwardRef' with passing 'ref' as a prop." },
		fixable: "code",
		hasSuggestions: true,
		messages: {
			default: "In React 19, 'forwardRef' is no longer necessary. Pass 'ref' as a prop instead.",
			replace: "Replace 'forwardRef' with passing 'ref' as a prop."
		},
		schema: []
	},
	name: RULE_NAME$35,
	create: create$35,
	defaultOptions: []
});
function create$35(context) {
	if (!context.sourceCode.text.includes("forwardRef")) return {};
	const { version } = getSettingsFromContext(context);
	if (compare(version, "19.0.0", "<")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isForwardRefCall(context, node)) return;
		const id = ast.getFunctionId(node);
		const suggest = canFix(context, node) ? [{
			fix: getFix(context, node),
			messageId: "replace"
		}] : [];
		context.report({
			messageId: "default",
			node: id ?? node,
			suggest
		});
	} });
}
/**
* Determine whether the given CallExpression can be safely auto-fixed by replacing
* the usage of `forwardRef` with passing `ref` as a prop
*
* @param context The rule context object
* @param node The CallExpression node to check
* @returns True if the call can be auto-fixed, false otherwise
*/
function canFix(context, node) {
	const { importSource } = getSettingsFromContext(context);
	const initialScope = context.sourceCode.getScope(node);
	switch (node.callee.type) {
		case AST_NODE_TYPES.Identifier: return core.isInitializedFromReact(node.callee.name, initialScope, importSource);
		case AST_NODE_TYPES.MemberExpression: return node.callee.object.type === AST_NODE_TYPES.Identifier && core.isInitializedFromReact(node.callee.object.name, initialScope, importSource);
		default: return false;
	}
}
/**
* Generates the fix for the `forwardRef` call
* @param context The rule context
* @param node The `forwardRef` call expression
* @returns A fixer function that applies the changes
*/
function getFix(context, node) {
	return (fixer) => {
		const [componentNode] = node.arguments;
		if (componentNode == null || !ast.isFunction(componentNode)) return [];
		return [
			fixer.removeRange([node.range[0], componentNode.range[0]]),
			fixer.removeRange([componentNode.range[1], node.range[1]]),
			...getComponentPropsFixes(context, fixer, componentNode, node.typeArguments?.params ?? [])
		];
	};
}
/**
* Generates fixes for the component's props and ref arguments
* @param context The rule context
* @param fixer The rule fixer
* @param node The function component node
* @param typeArguments The type arguments from the `forwardRef` call
* @returns An array of fixes for the component's signature
*/
function getComponentPropsFixes(context, fixer, node, typeArguments) {
	const getText = (node) => context.sourceCode.getText(node);
	const [arg0, arg1] = node.params;
	const [typeArg0, typeArg1] = typeArguments;
	if (arg0 == null) {
		const openParen = context.sourceCode.getFirstToken(node, { filter: (t) => t.value === "(" });
		if (openParen == null) return [];
		if (typeArg0 == null || typeArg1 == null) return [];
		const typeArg0Text = getText(typeArg0);
		const typeArg1Text = getText(typeArg1);
		return [fixer.insertTextAfter(openParen, `{ ref }: ${typeArg1Text} & { ref?: React.RefObject<${typeArg0Text} | null> }`)];
	}
	const fixedArg0Text = match(arg0).with({ type: AST_NODE_TYPES.Identifier }, (n) => `...${n.name}`).with({ type: AST_NODE_TYPES.ObjectPattern }, (n) => n.properties.map(getText).join(", ")).otherwise(() => null);
	const fixedArg1Text = match(arg1).with(P.nullish, () => "ref").with({
		type: AST_NODE_TYPES.Identifier,
		name: "ref"
	}, () => "ref").with({
		type: AST_NODE_TYPES.Identifier,
		name: P.string
	}, (n) => `ref: ${n.name}`).otherwise(() => null);
	if (fixedArg0Text == null || fixedArg1Text == null) return [];
	if (typeArg0 == null || typeArg1 == null) return [fixer.replaceText(arg0, [
		"{",
		fixedArg1Text + ",",
		fixedArg0Text,
		"}"
	].join(" ")), ...arg1 == null ? [] : [fixer.remove(arg1), fixer.removeRange([arg0.range[1], arg1.range[0]])]];
	const typeArg0Text = getText(typeArg0);
	const typeArg1Text = getText(typeArg1);
	return [fixer.replaceText(arg0, [
		"{",
		fixedArg1Text + ",",
		fixedArg0Text,
		"}:",
		typeArg1Text,
		"&",
		"{",
		`ref?:`,
		`React.RefObject<${typeArg0Text} | null>`,
		"}"
	].join(" ")), ...arg1 == null ? [] : [fixer.remove(arg1), fixer.removeRange([arg0.range[1], arg1.range[0]])]];
}

//#endregion
//#region src/rules/no-implicit-children/no-implicit-children.ts
const RULE_NAME$34 = "no-implicit-children";
const RE_REACT_CHILDREN_TYPE = /react\.(reactnode|reactelement|reactportal)$/i;
var no_implicit_children_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents implicitly passing the 'children' prop to components." },
		messages: { default: "This spread attribute implicitly passes the 'children' prop to a component, this could lead to unexpected behavior. If you intend to pass the 'children' prop, use 'children={value}'." },
		schema: []
	},
	name: RULE_NAME$34,
	create: create$34,
	defaultOptions: []
});
function create$34(context) {
	const services = ESLintUtils.getParserServices(context, false);
	const checker = services.program.getTypeChecker();
	return defineRuleListener({ JSXSpreadAttribute(node) {
		for (const type of unionConstituents(getConstrainedTypeAtLocation(services, node.argument))) {
			const children = type.getProperty("children");
			if (children == null) continue;
			const fqn = getFullyQualifiedNameEx(checker, children).toLowerCase();
			if (fqn.endsWith("attributes.children") || fqn.endsWith("propswithchildren.children")) continue;
			const childrenType = checker.getTypeOfSymbol(children);
			const typeSymbol = childrenType.aliasSymbol ?? childrenType.symbol;
			if (typeSymbol != null) {
				const typeFqn = checker.getFullyQualifiedName(typeSymbol);
				if (RE_REACT_CHILDREN_TYPE.test(typeFqn) || /^JSX\.Element$/i.test(typeFqn)) continue;
			}
			context.report({
				messageId: "default",
				node
			});
		}
	} });
}

//#endregion
//#region src/rules/no-implicit-key/no-implicit-key.ts
const RULE_NAME$33 = "no-implicit-key";
var no_implicit_key_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents implicitly passing the 'key' prop to components." },
		messages: { default: "This spread attribute implicitly passes the 'key' prop to a component, this could lead to unexpected behavior. If you intend to pass the 'key' prop, use 'key={value}'." },
		schema: []
	},
	name: RULE_NAME$33,
	create: create$33,
	defaultOptions: []
});
function create$33(context) {
	const services = ESLintUtils.getParserServices(context, false);
	const checker = services.program.getTypeChecker();
	return defineRuleListener({ JSXSpreadAttribute(node) {
		for (const type of unionConstituents(getConstrainedTypeAtLocation(services, node.argument))) {
			const key = type.getProperty("key");
			if (key == null) continue;
			if (getFullyQualifiedNameEx(checker, key).toLowerCase().endsWith("react.attributes.key")) continue;
			const keyType = checker.getTypeOfSymbol(key);
			if (keyType.aliasSymbol != null) {
				if (checker.getFullyQualifiedName(keyType.aliasSymbol).toLowerCase().endsWith("react.key")) continue;
			}
			context.report({
				messageId: "default",
				node
			});
		}
	} });
}

//#endregion
//#region src/rules/no-implicit-ref/no-implicit-ref.ts
const RULE_NAME$32 = "no-implicit-ref";
const RE_REACT_REF_TYPE = /react\.(ref|legacyref|refcallback|refobject)$/i;
var no_implicit_ref_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents implicitly passing the 'ref' prop to components." },
		messages: { default: "This spread attribute implicitly passes the 'ref' prop to a component, this could lead to unexpected behavior. If you intend to pass the 'ref' prop, use 'ref={value}'." },
		schema: []
	},
	name: RULE_NAME$32,
	create: create$32,
	defaultOptions: []
});
function create$32(context) {
	const services = ESLintUtils.getParserServices(context, false);
	const checker = services.program.getTypeChecker();
	return defineRuleListener({ JSXSpreadAttribute(node) {
		for (const type of unionConstituents(getConstrainedTypeAtLocation(services, node.argument))) {
			const ref = type.getProperty("ref");
			if (ref == null) continue;
			if (getFullyQualifiedNameEx(checker, ref).toLowerCase().endsWith("attributes.ref")) continue;
			const refType = checker.getTypeOfSymbol(ref);
			const typeSymbol = refType.aliasSymbol ?? refType.symbol;
			if (typeSymbol != null) {
				const typeFqn = checker.getFullyQualifiedName(typeSymbol);
				if (RE_REACT_REF_TYPE.test(typeFqn)) continue;
			}
			context.report({
				messageId: "default",
				node
			});
		}
	} });
}

//#endregion
//#region src/rules/no-leaked-conditional-rendering/no-leaked-conditional-rendering.ts
const RULE_NAME$31 = "no-leaked-conditional-rendering";
var no_leaked_conditional_rendering_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents problematic leaked values from being rendered." },
		messages: { default: "Potential leaked value {{value}} that might cause unintentionally rendered values or rendering crashes." },
		schema: []
	},
	name: RULE_NAME$31,
	create: create$31,
	defaultOptions: []
});
function create$31(context) {
	if (!context.sourceCode.text.includes("&&")) return {};
	const { version } = getSettingsFromContext(context);
	const allowedVariants = [
		"any",
		"boolean",
		"nullish",
		"object",
		"enum",
		"falsy boolean",
		"truthy bigint",
		"truthy boolean",
		"truthy number",
		"truthy string",
		...compare(version, "18.0.0", "<") ? [] : ["string", "falsy string"]
	];
	const services = ESLintUtils.getParserServices(context, false);
	/**
	* Recursively inspects a node to find potential leaked conditional rendering
	* @param node The AST node to inspect
	* @returns A report descriptor if a problem is found, otherwise `null`
	*/
	function getReportDescriptor(node) {
		if (node == null) return null;
		if (ast.is(AST_NODE_TYPES.JSXExpressionContainer)(node)) return getReportDescriptor(node.expression);
		if (ast.isJSX(node)) return null;
		if (ast.isTypeExpression(node)) return getReportDescriptor(node.expression);
		return match(node).with({
			type: AST_NODE_TYPES.LogicalExpression,
			operator: "&&"
		}, ({ left, right }) => {
			if (left.type === AST_NODE_TYPES.UnaryExpression && left.operator === "!") return getReportDescriptor(right);
			const initialScope = context.sourceCode.getScope(left);
			if (ast.isIdentifier(left, "NaN") || getStaticValue(left, initialScope)?.value === "NaN") return {
				data: { value: context.sourceCode.getText(left) },
				messageId: "default",
				node: left
			};
			const leftTypeVariants = getTypeVariants(unionConstituents(getConstrainedTypeAtLocation(services, left)));
			if (Array.from(leftTypeVariants.values()).every((type) => allowedVariants.some((allowed) => allowed === type))) return getReportDescriptor(right);
			return {
				data: { value: context.sourceCode.getText(left) },
				messageId: "default",
				node: left
			};
		}).with({ type: AST_NODE_TYPES.ConditionalExpression }, ({ alternate, consequent }) => {
			return getReportDescriptor(consequent) ?? getReportDescriptor(alternate);
		}).with({ type: AST_NODE_TYPES.Identifier }, (n) => {
			const variableDefNode = findVariable(context.sourceCode.getScope(n), n.name)?.defs.at(0)?.node;
			return match(variableDefNode).with({ init: P.select({ type: P.not(AST_NODE_TYPES.VariableDeclaration) }) }, getReportDescriptor).otherwise(() => null);
		}).otherwise(() => null);
	}
	return defineRuleListener({ JSXExpressionContainer: flow(getReportDescriptor, report(context)) });
}

//#endregion
//#region src/rules/no-missing-component-display-name/no-missing-component-display-name.ts
const RULE_NAME$30 = "no-missing-component-display-name";
var no_missing_component_display_name_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Enforces that all components have a 'displayName' that can be used in DevTools." },
		messages: { default: "Add missing 'displayName' for component." },
		schema: []
	},
	name: RULE_NAME$30,
	create: create$30,
	defaultOptions: []
});
function create$30(context) {
	if (!context.sourceCode.text.includes("memo") && !context.sourceCode.text.includes("forwardRef")) return {};
	const { api, visitor } = core.getComponentCollector(context, {
		collectDisplayName: true,
		hint: core.DEFAULT_COMPONENT_DETECTION_HINT
	});
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { displayName, flag, node } of api.getAllComponents(program)) {
			const id = ast.getFunctionId(node);
			const isMemoOrForwardRef = (flag & (core.ComponentFlag.ForwardRef | core.ComponentFlag.Memo)) > 0n;
			if (id != null) continue;
			if (!isMemoOrForwardRef) continue;
			if (displayName == null) context.report({
				messageId: "default",
				node
			});
		}
	} });
}

//#endregion
//#region src/rules/no-missing-context-display-name/no-missing-context-display-name.ts
const RULE_NAME$29 = "no-missing-context-display-name";
var no_missing_context_display_name_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Enforces that all contexts have a 'displayName' that can be used in DevTools." },
		fixable: "code",
		messages: { default: "Add missing 'displayName' for context." },
		schema: []
	},
	name: RULE_NAME$29,
	create: create$29,
	defaultOptions: []
});
function create$29(context) {
	if (!context.sourceCode.text.includes("createContext")) return {};
	const createCalls = [];
	const displayNameAssignments = [];
	return defineRuleListener({
		[ast.SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION](node) {
			displayNameAssignments.push(node);
		},
		CallExpression(node) {
			if (!core.isCreateContextCall(context, node)) return;
			createCalls.push(node);
		},
		"Program:exit"() {
			for (const call of createCalls) {
				const id = findEnclosingAssignmentTarget(call);
				if (id == null) {
					context.report({
						messageId: "default",
						node: call
					});
					continue;
				}
				if (!displayNameAssignments.some((node) => {
					const left = node.left;
					if (left.type !== AST_NODE_TYPES.MemberExpression) return false;
					const object = left.object;
					return isAssignmentTargetEqual(context, id, object);
				})) context.report({
					fix(fixer) {
						if (id.type !== AST_NODE_TYPES.Identifier || id.parent !== call.parent) return [];
						return fixer.insertTextAfter(context.sourceCode.getTokenAfter(call) ?? call, [
							"\n",
							id.name,
							".",
							"displayName",
							" ",
							"=",
							" ",
							JSON.stringify(id.name),
							";"
						].join(""));
					},
					messageId: "default",
					node: id
				});
			}
		}
	});
}

//#endregion
//#region src/rules/no-missing-key/no-missing-key.ts
const RULE_NAME$28 = "no-missing-key";
var no_missing_key_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows missing 'key' on items in list rendering." },
		messages: {
			default: "Missing 'key' for element when rendering list.",
			unexpectedFragmentSyntax: "Use fragment component instead of '<>' because it does not support `key`."
		},
		schema: []
	},
	name: RULE_NAME$28,
	create: create$28,
	defaultOptions: []
});
function create$28(ctx) {
	let inChildrenToArray = false;
	function check(node) {
		if (node.type === AST_NODE_TYPES.JSXElement) return !hasAttribute(ctx, node, "key") ? {
			messageId: "default",
			node
		} : null;
		if (node.type === AST_NODE_TYPES.JSXFragment) return {
			messageId: "unexpectedFragmentSyntax",
			node
		};
		return null;
	}
	function checkExpr(node) {
		switch (node.type) {
			case AST_NODE_TYPES.ConditionalExpression: return check(node.consequent) ?? check(node.alternate);
			case AST_NODE_TYPES.LogicalExpression: return check(node.left) ?? check(node.right);
			case AST_NODE_TYPES.JSXElement:
			case AST_NODE_TYPES.JSXFragment: return check(node);
			default: return null;
		}
	}
	function checkBlock(node) {
		const descriptors = [];
		for (const stmt of ast.getNestedReturnStatements(node)) {
			if (stmt.argument == null) continue;
			const desc = check(stmt.argument);
			if (desc == null) continue;
			descriptors.push(desc);
		}
		return descriptors;
	}
	return defineRuleListener({
		ArrayExpression(node) {
			if (inChildrenToArray) return;
			const elements = node.elements.filter(ast.is(AST_NODE_TYPES.JSXElement));
			if (elements.length === 0) return;
			for (const el of elements) if (!hasAttribute(ctx, el, "key")) ctx.report({
				messageId: "default",
				node: el
			});
		},
		CallExpression(node) {
			inChildrenToArray ||= core.isChildrenToArrayCall(ctx, node);
			if (inChildrenToArray) return;
			if (node.callee.type !== AST_NODE_TYPES.MemberExpression) return;
			if (node.callee.property.type !== AST_NODE_TYPES.Identifier) return;
			const name = node.callee.property.name;
			const idx = name === "from" ? 1 : name === "map" ? 0 : -1;
			if (idx < 0) return;
			const cb = node.arguments[idx];
			if (!ast.isFunction(cb)) return;
			if (cb.body.type === AST_NODE_TYPES.BlockStatement) checkBlock(cb.body).forEach(report(ctx));
			else report(ctx)(checkExpr(cb.body));
		},
		"CallExpression:exit"(node) {
			if (core.isChildrenToArrayCall(ctx, node)) inChildrenToArray = false;
		},
		JSXFragment(node) {
			if (inChildrenToArray) return;
			if (node.parent.type === AST_NODE_TYPES.ArrayExpression) ctx.report({
				messageId: "unexpectedFragmentSyntax",
				node
			});
		}
	});
}

//#endregion
//#region src/rules/no-misused-capture-owner-stack/no-misused-capture-owner-stack.ts
const RULE_NAME$27 = "no-misused-capture-owner-stack";
var no_misused_capture_owner_stack_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents incorrect usage of 'captureOwnerStack'." },
		messages: {
			missingDevelopmentOnlyCheck: `Don't call 'captureOwnerStack' directly. Use 'if (process.env.NODE_ENV !== "production") {...}' to conditionally access it.`,
			useNamespaceImport: "Don't use named imports of 'captureOwnerStack' in files that are bundled for development and production. Use a namespace import instead."
		},
		schema: []
	},
	name: RULE_NAME$27,
	create: create$27,
	defaultOptions: []
});
function create$27(context) {
	if (!context.sourceCode.text.includes("captureOwnerStack")) return {};
	const { importSource } = getSettingsFromContext(context);
	return defineRuleListener({
		CallExpression(node) {
			if (!core.isCaptureOwnerStackCall(context, node)) return;
			if (ast.findParent(node, isDevelopmentOnlyCheck) == null) context.report({
				messageId: "missingDevelopmentOnlyCheck",
				node
			});
		},
		ImportDeclaration(node) {
			if (node.source.value !== importSource) return;
			for (const specifier of node.specifiers) {
				if (specifier.type !== AST_NODE_TYPES.ImportSpecifier) continue;
				if (specifier.imported.type !== AST_NODE_TYPES.Identifier) continue;
				if (specifier.imported.name === "captureOwnerStack") context.report({
					messageId: "useNamespaceImport",
					node: specifier
				});
			}
		}
	});
}
function isDevelopmentOnlyCheck(node) {
	if (node.type !== AST_NODE_TYPES.IfStatement) return false;
	return ast.isProcessEnvNodeEnvCompare(node.test, "!==", "production");
}

//#endregion
//#region src/rules/no-nested-component-definitions/no-nested-component-definitions.ts
const RULE_NAME$26 = "no-nested-component-definitions";
var no_nested_component_definitions_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows nesting component definitions inside other components." },
		messages: { default: "Do not nest component definitions inside other components or props. {{suggestion}}" },
		schema: []
	},
	name: RULE_NAME$26,
	create: create$26,
	defaultOptions: []
});
function create$26(context) {
	const hint = core.ComponentDetectionHint.DoNotIncludeJsxWithNumberValue | core.ComponentDetectionHint.DoNotIncludeJsxWithBooleanValue | core.ComponentDetectionHint.DoNotIncludeJsxWithNullValue | core.ComponentDetectionHint.DoNotIncludeJsxWithStringValue | core.ComponentDetectionHint.DoNotIncludeJsxWithUndefinedValue | core.ComponentDetectionHint.RequireBothSidesOfLogicalExpressionToBeJsx | core.ComponentDetectionHint.RequireBothBranchesOfConditionalExpressionToBeJsx | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayPatternElement | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayExpressionElement | core.ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayMapCallback;
	const fCollector = core.getComponentCollector(context, { hint });
	const cCollector = core.getComponentCollectorLegacy(context);
	return defineRuleListener(fCollector.visitor, cCollector.visitor, { "Program:exit"(program) {
		const fComponents = [...fCollector.api.getAllComponents(program)];
		const cComponents = [...cCollector.api.getAllComponents(program)];
		function findEnclosingComponent(node) {
			return ast.findParent(node, (n) => {
				if (ast.isFunction(n)) return fComponents.some((c) => c.node === n);
				if (ast.isClass(n)) return cComponents.some((c) => c.node === n);
				return false;
			});
		}
		for (const { name, node: component } of fComponents) {
			if (name == null) continue;
			if (isInsideJSXAttributeValue(component)) {
				context.report({
					data: {
						name,
						suggestion: "Move it to the top level or pass it as a prop."
					},
					messageId: "default",
					node: component
				});
				continue;
			}
			if (isInsideCreateElementProps(context, component)) {
				context.report({
					data: {
						name,
						suggestion: "Move it to the top level or pass it as a prop."
					},
					messageId: "default",
					node: component
				});
				continue;
			}
			if (findEnclosingComponent(component) != null) {
				context.report({
					data: {
						name,
						suggestion: component.parent.type === AST_NODE_TYPES.Property ? "Move it to the top level or pass it as a prop." : "Move it to the top level."
					},
					messageId: "default",
					node: component
				});
				continue;
			}
			if (isInsideRenderMethod(component)) context.report({
				data: {
					name,
					suggestion: "Move it to the top level."
				},
				messageId: "default",
				node: component
			});
		}
		for (const { name = "unknown", node: component } of cComponents) {
			if (findEnclosingComponent(component) == null) continue;
			context.report({
				data: {
					name,
					suggestion: component.parent.type === AST_NODE_TYPES.Property ? "Move it to the top level or pass it as a prop." : "Move it to the top level."
				},
				messageId: "default",
				node: component
			});
		}
	} });
}
/**
* Determine whether the node is inside JSX attribute value
* @param node The AST node to check
* @returns `true` if the node is inside JSX attribute value
*/
function isInsideJSXAttributeValue(node) {
	return node.parent.type === AST_NODE_TYPES.JSXAttribute || findParentAttribute(node, (n) => n.value?.type === AST_NODE_TYPES.JSXExpressionContainer) != null;
}
/**
* Check whether a given node is declared inside a class component's render block
* Ex: class C extends React.Component { render() { const Nested = () => <div />; } }
* @param node The AST node being checked
* @returns `true` if the node is inside a class component's render block
*/
function isInsideRenderMethod(node) {
	return ast.findParent(node, (n) => core.isRenderMethodLike(n) && core.isClassComponent(n.parent.parent)) != null;
}
/**
* Determine whether the node is inside `createElement`'s props argument
* @param context The rule context
* @param node The AST node to check
* @returns `true` if the node is inside `createElement`'s props
*/
function isInsideCreateElementProps(context, node) {
	const call = ast.findParent(node, core.isCreateElementCall(context));
	if (call == null) return false;
	const prop = ast.findParent(node, ast.is(AST_NODE_TYPES.ObjectExpression));
	if (prop == null) return false;
	return prop === call.arguments[1];
}

//#endregion
//#region src/rules/no-nested-lazy-component-declarations/no-nested-lazy-component-declarations.ts
const RULE_NAME$25 = "no-nested-lazy-component-declarations";
var no_nested_lazy_component_declarations_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows nesting lazy component declarations inside other components or hooks." },
		messages: { default: "Do not declare lazy components inside other components or hooks. Instead, always declare them at the top level of your module." },
		schema: []
	},
	name: RULE_NAME$25,
	create: create$25,
	defaultOptions: []
});
function create$25(context) {
	const fCollector = core.getComponentCollector(context);
	const cCollector = core.getComponentCollectorLegacy(context);
	const hCollector = core.getHookCollector(context);
	const lazyCalls = /* @__PURE__ */ new Set();
	return defineRuleListener(fCollector.visitor, cCollector.visitor, hCollector.visitor, {
		ImportExpression(node) {
			const lazyCall = ast.findParent(node, (n) => core.isLazyCall(context, n));
			if (lazyCall != null) lazyCalls.add(lazyCall);
		},
		"Program:exit"(program) {
			const significantParents = [
				...fCollector.api.getAllComponents(program),
				...hCollector.api.getAllHooks(program),
				...cCollector.api.getAllComponents(program)
			];
			for (const lazy of lazyCalls) if (ast.findParent(lazy, (n) => significantParents.some((p) => p.node === n))) context.report({
				messageId: "default",
				node: lazy
			});
		}
	});
}

//#endregion
//#region src/rules/no-redundant-should-component-update/no-redundant-should-component-update.ts
const RULE_NAME$24 = "no-redundant-should-component-update";
function isShouldComponentUpdate(node) {
	return ast.isMethodOrProperty(node) && node.key.type === AST_NODE_TYPES.Identifier && node.key.name === "shouldComponentUpdate";
}
var no_redundant_should_component_update_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows 'shouldComponentUpdate' when extending 'React.PureComponent'." },
		messages: { default: "'{{componentName}}' does not need 'shouldComponentUpdate' when extending 'React.PureComponent'." },
		schema: []
	},
	name: RULE_NAME$24,
	create: create$24,
	defaultOptions: []
});
function create$24(context) {
	if (!context.sourceCode.text.includes("shouldComponentUpdate")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { name = "PureComponent", flag, node: component } of api.getAllComponents(program)) {
			if ((flag & core.ComponentFlag.PureComponent) === 0n) continue;
			const { body } = component.body;
			for (const member of body) if (isShouldComponentUpdate(member)) context.report({
				data: { componentName: name },
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-set-state-in-component-did-mount/no-set-state-in-component-did-mount.ts
const RULE_NAME$23 = "no-set-state-in-component-did-mount";
var no_set_state_in_component_did_mount_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows calling 'this.setState' in 'componentDidMount' outside functions such as callbacks." },
		messages: { default: "Do not call `this.setState` in `componentDidMount` outside functions such as callbacks." },
		schema: []
	},
	name: RULE_NAME$23,
	create: create$23,
	defaultOptions: []
});
function create$23(context) {
	if (!context.sourceCode.text.includes("componentDidMount")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isThisSetStateCall(node)) return;
		const enclosingClassNode = ast.findParent(node, core.isClassComponent);
		const enclosingMethodNode = ast.findParent(node, (n) => n === enclosingClassNode || core.isComponentDidMount(n));
		if (enclosingClassNode == null || enclosingMethodNode == null || enclosingMethodNode === enclosingClassNode) return;
		const enclosingMethodScope = context.sourceCode.getScope(enclosingMethodNode);
		const setStateCallParentScope = context.sourceCode.getScope(node).upper;
		if (enclosingMethodNode.parent === enclosingClassNode.body && setStateCallParentScope === enclosingMethodScope) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-set-state-in-component-did-update/no-set-state-in-component-did-update.ts
const RULE_NAME$22 = "no-set-state-in-component-did-update";
var no_set_state_in_component_did_update_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows calling 'this.setState' in 'componentDidUpdate' outside functions such as callbacks." },
		messages: { default: "Do not call `this.setState` in `componentDidUpdate` outside functions such as callbacks." },
		schema: []
	},
	name: RULE_NAME$22,
	create: create$22,
	defaultOptions: []
});
function create$22(context) {
	if (!context.sourceCode.text.includes("componentDidUpdate")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isThisSetStateCall(node)) return;
		const enclosingClassNode = ast.findParent(node, core.isClassComponent);
		const enclosingMethodNode = ast.findParent(node, (n) => n === enclosingClassNode || core.isComponentDidUpdate(n));
		if (enclosingClassNode == null || enclosingMethodNode == null || enclosingMethodNode === enclosingClassNode) return;
		const enclosingMethodScope = context.sourceCode.getScope(enclosingMethodNode);
		const setStateCallParentScope = context.sourceCode.getScope(node).upper;
		if (enclosingMethodNode.parent === enclosingClassNode.body && setStateCallParentScope === enclosingMethodScope) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-set-state-in-component-will-update/no-set-state-in-component-will-update.ts
const RULE_NAME$21 = "no-set-state-in-component-will-update";
var no_set_state_in_component_will_update_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Disallows calling 'this.setState' in 'componentWillUpdate' outside functions such as callbacks." },
		messages: { default: "Do not call `this.setState` in `componentWillUpdate` outside functions such as callbacks." },
		schema: []
	},
	name: RULE_NAME$21,
	create: create$21,
	defaultOptions: []
});
function create$21(context) {
	if (!context.sourceCode.text.includes("componentWillUpdate")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isThisSetStateCall(node)) return;
		const enclosingClassNode = ast.findParent(node, core.isClassComponent);
		const enclosingMethodNode = ast.findParent(node, (n) => n === enclosingClassNode || core.isComponentWillUpdate(n));
		if (enclosingClassNode == null || enclosingMethodNode == null || enclosingMethodNode === enclosingClassNode) return;
		const enclosingMethodScope = context.sourceCode.getScope(enclosingMethodNode);
		const setStateCallParentScope = context.sourceCode.getScope(node).upper;
		if (enclosingMethodNode.parent === enclosingClassNode.body && setStateCallParentScope === enclosingMethodScope) context.report({
			messageId: "default",
			node
		});
	} });
}

//#endregion
//#region src/rules/no-unnecessary-use-callback/no-unnecessary-use-callback.ts
const RULE_NAME$20 = "no-unnecessary-use-callback";
var no_unnecessary_use_callback_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows unnecessary usage of 'useCallback'." },
		messages: {
			default: "An 'useCallback' with empty deps and no references to the component scope may be unnecessary.",
			noUnnecessaryUseCallbackInsideUseEffect: "{{name}} is only used inside 1 useEffect, which may be unnecessary. You can move the computation into useEffect directly and merge the dependency arrays."
		},
		schema: []
	},
	name: RULE_NAME$20,
	create: create$20,
	defaultOptions: []
});
function create$20(context) {
	if (!context.sourceCode.text.includes("useCallback")) return {};
	return defineRuleListener({ VariableDeclarator(node) {
		const { id, init } = node;
		if (id.type !== AST_NODE_TYPES.Identifier || init?.type !== AST_NODE_TYPES.CallExpression || !core.isUseCallbackCall(init)) return;
		const [cbk, ...rest] = context.sourceCode.getDeclaredVariables(node);
		if (cbk == null || rest.length > 0) return;
		const checkForUsageInsideUseEffectReport = checkForUsageInsideUseEffect$1(context.sourceCode, init);
		context.sourceCode.getScope(init);
		const component = context.sourceCode.getScope(init).block;
		if (!ast.isFunction(component)) return;
		const [arg0, arg1] = init.arguments;
		if (arg0 == null || arg1 == null) return;
		if (!match(arg1).with({ type: AST_NODE_TYPES.ArrayExpression }, (n) => n.elements.length === 0).with({ type: AST_NODE_TYPES.Identifier }, (n) => {
			const initNode = resolve(context, n);
			if (initNode?.type !== AST_NODE_TYPES.ArrayExpression) return false;
			return initNode.elements.length === 0;
		}).otherwise(() => false)) {
			report(context)(checkForUsageInsideUseEffectReport);
			return;
		}
		const arg0Node = match(arg0).with({ type: AST_NODE_TYPES.ArrowFunctionExpression }, (n) => {
			if (n.body.type === AST_NODE_TYPES.ArrowFunctionExpression) return n.body;
			return n;
		}).with({ type: AST_NODE_TYPES.FunctionExpression }, identity).with({ type: AST_NODE_TYPES.Identifier }, (n) => {
			const initNode = resolve(context, n);
			if (initNode?.type !== AST_NODE_TYPES.ArrowFunctionExpression && initNode?.type !== AST_NODE_TYPES.FunctionExpression) return null;
			return initNode;
		}).otherwise(() => null);
		if (arg0Node == null) return;
		function getChildScopes(scope) {
			return scope.childScopes.reduce((acc, child) => [...acc, ...getChildScopes(child)], [scope]);
		}
		if (!getChildScopes(context.sourceCode.getScope(arg0Node)).flatMap((x) => x.references).some((x) => x.resolved?.scope.block === component)) {
			context.report({
				messageId: "default",
				node
			});
			return;
		}
		report(context)(checkForUsageInsideUseEffectReport);
	} });
}
function checkForUsageInsideUseEffect$1(sourceCode, node) {
	if (!/use\w*Effect/u.test(sourceCode.text)) return null;
	if (!isVariableDeclarator(node.parent)) return null;
	if (!isIdentifier(node.parent.id)) return null;
	const usages = (sourceCode.getDeclaredVariables(node.parent)[0]?.references ?? []).filter((ref) => ref.init !== true);
	if (usages.length === 0) return null;
	const effectSet = /* @__PURE__ */ new Set();
	for (const usage of usages) {
		const effect = ast.findParent(usage.identifier, core.isUseEffectLikeCall);
		if (effect == null) return null;
		effectSet.add(effect);
		if (effectSet.size > 1) return null;
	}
	return {
		data: { name: node.parent.id.name },
		messageId: "noUnnecessaryUseCallbackInsideUseEffect",
		node
	};
}

//#endregion
//#region src/rules/no-unnecessary-use-memo/no-unnecessary-use-memo.ts
const RULE_NAME$19 = "no-unnecessary-use-memo";
var no_unnecessary_use_memo_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Disallows unnecessary usage of 'useMemo'." },
		messages: {
			default: "An 'useMemo' with empty deps and no references to the component scope may be unnecessary.",
			noUnnecessaryUseMemoInsideUseEffect: "{{name}} is only used inside 1 useEffect, which may be unnecessary. You can move the computation into useEffect directly and merge the dependency arrays."
		},
		schema: []
	},
	name: RULE_NAME$19,
	create: create$19,
	defaultOptions: []
});
function create$19(context) {
	if (!context.sourceCode.text.includes("useMemo")) return {};
	return defineRuleListener({ VariableDeclarator(node) {
		const { id, init } = node;
		if (id.type !== AST_NODE_TYPES.Identifier || init?.type !== AST_NODE_TYPES.CallExpression || !core.isUseMemoCall(init)) return;
		const [mem, ...rest] = context.sourceCode.getDeclaredVariables(node);
		if (mem == null || rest.length > 0) return;
		const checkForUsageInsideUseEffectReport = checkForUsageInsideUseEffect(context.sourceCode, init);
		const component = context.sourceCode.getScope(init).block;
		if (!ast.isFunction(component)) return;
		const [arg0, arg1] = init.arguments;
		if (arg0 == null || arg1 == null) return;
		if (ast.isFunction(arg0) && [...ast.getNestedCallExpressions(arg0.body), ...ast.getNestedNewExpressions(arg0.body)].length > 0) {
			report(context)(checkForUsageInsideUseEffectReport);
			return;
		}
		if (!match(arg1).with({ type: AST_NODE_TYPES.ArrayExpression }, (n) => n.elements.length === 0).with({ type: AST_NODE_TYPES.Identifier }, (n) => {
			const initNode = resolve(context, n);
			if (initNode?.type !== AST_NODE_TYPES.ArrayExpression) return false;
			return initNode.elements.length === 0;
		}).otherwise(() => false)) {
			report(context)(checkForUsageInsideUseEffectReport);
			return;
		}
		const arg0Node = match(arg0).with({ type: AST_NODE_TYPES.ArrowFunctionExpression }, (n) => {
			if (n.body.type === AST_NODE_TYPES.ArrowFunctionExpression) return n.body;
			return n;
		}).with({ type: AST_NODE_TYPES.FunctionExpression }, identity).with({ type: AST_NODE_TYPES.Identifier }, (n) => {
			const initNode = resolve(context, n);
			if (initNode?.type !== AST_NODE_TYPES.ArrowFunctionExpression && initNode?.type !== AST_NODE_TYPES.FunctionExpression) return null;
			return initNode;
		}).otherwise(() => null);
		if (arg0Node == null) return;
		function getChildScopes(scope) {
			return scope.childScopes.reduce((acc, child) => [...acc, ...getChildScopes(child)], [scope]);
		}
		if (!getChildScopes(context.sourceCode.getScope(arg0Node)).flatMap((x) => x.references).some((x) => x.resolved?.scope.block === component)) {
			context.report({
				messageId: "default",
				node
			});
			return;
		}
		report(context)(checkForUsageInsideUseEffectReport);
	} });
}
function checkForUsageInsideUseEffect(sourceCode, node) {
	if (!/use\w*Effect/u.test(sourceCode.text)) return null;
	if (!isVariableDeclarator(node.parent)) return null;
	if (!isIdentifier(node.parent.id)) return null;
	const usages = (sourceCode.getDeclaredVariables(node.parent)[0]?.references ?? []).filter((ref) => ref.init !== true);
	if (usages.length === 0) return null;
	const effectSet = /* @__PURE__ */ new Set();
	for (const usage of usages) {
		const effect = ast.findParent(usage.identifier, core.isUseEffectLikeCall);
		if (effect == null) return null;
		effectSet.add(effect);
		if (effectSet.size > 1) return null;
	}
	return {
		data: { name: node.parent.id.name },
		messageId: "noUnnecessaryUseMemoInsideUseEffect",
		node
	};
}

//#endregion
//#region src/rules/no-unnecessary-use-prefix/no-unnecessary-use-prefix.ts
const RULE_NAME$18 = "no-unnecessary-use-prefix";
const WELL_KNOWN_HOOKS = ["useMDXComponents"];
function containsUseComments(context, node) {
	return context.sourceCode.getCommentsInside(node).some(({ value }) => /use\([\s\S]*?\)/u.test(value) || /use[A-Z0-9]\w*\([\s\S]*?\)/u.test(value));
}
var no_unnecessary_use_prefix_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Enforces that a function with the 'use' prefix uses at least one Hook inside it." },
		messages: { default: "If your function doesn't call any Hooks, avoid the 'use' prefix. Instead, write it as a regular function without the 'use' prefix." },
		schema: []
	},
	name: RULE_NAME$18,
	create: create$18,
	defaultOptions: []
});
function create$18(context) {
	const { api, visitor } = core.getHookCollector(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { id, name, hookCalls, node } of api.getAllHooks(program)) {
			if (hookCalls.length > 0) continue;
			if (ast.isFunctionEmpty(node)) continue;
			if (WELL_KNOWN_HOOKS.includes(name)) continue;
			if (containsUseComments(context, node)) continue;
			if (ast.findParent(node, ast.isViMockCallback) != null) continue;
			context.report({
				data: { name },
				messageId: "default",
				node: id ?? node
			});
		}
	} });
}

//#endregion
//#region src/rules/no-unsafe-component-will-mount/no-unsafe-component-will-mount.ts
const RULE_NAME$17 = "no-unsafe-component-will-mount";
var no_unsafe_component_will_mount_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Warns about the use of 'UNSAFE_componentWillMount' in class components." },
		messages: { default: "Do not use 'UNSAFE_componentWillMount'." },
		schema: []
	},
	name: RULE_NAME$17,
	create: create$17,
	defaultOptions: []
});
function create$17(context) {
	if (!context.sourceCode.text.includes("UNSAFE_componentWillMount")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isUnsafeComponentWillMount(member)) context.report({
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-unsafe-component-will-receive-props/no-unsafe-component-will-receive-props.ts
const RULE_NAME$16 = "no-unsafe-component-will-receive-props";
var no_unsafe_component_will_receive_props_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Warns about the use of 'UNSAFE_componentWillReceiveProps' in class components." },
		messages: { default: "Do not use 'UNSAFE_componentWillReceiveProps'." },
		schema: []
	},
	name: RULE_NAME$16,
	create: create$16,
	defaultOptions: []
});
function create$16(context) {
	if (!context.sourceCode.text.includes("UNSAFE_componentWillReceiveProps")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isUnsafeComponentWillReceiveProps(member)) context.report({
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-unsafe-component-will-update/no-unsafe-component-will-update.ts
const RULE_NAME$15 = "no-unsafe-component-will-update";
var no_unsafe_component_will_update_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Warns about the use of 'UNSAFE_componentWillUpdate' in class components." },
		messages: { default: "Do not use 'UNSAFE_componentWillUpdate'." },
		schema: []
	},
	name: RULE_NAME$15,
	create: create$15,
	defaultOptions: []
});
function create$15(context) {
	if (!context.sourceCode.text.includes("UNSAFE_componentWillUpdate")) return {};
	const { api, visitor } = core.getComponentCollectorLegacy(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const { node: component } of api.getAllComponents(program)) {
			const { body } = component.body;
			for (const member of body) if (core.isUnsafeComponentWillUpdate(member)) context.report({
				messageId: "default",
				node: member
			});
		}
	} });
}

//#endregion
//#region src/rules/no-unstable-context-value/no-unstable-context-value.ts
const RULE_NAME$14 = "no-unstable-context-value";
var no_unstable_context_value_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents non-stable values (i.e., object literals) from being used as a value for 'Context.Provider'." },
		messages: { unstableContextValue: "A/an '{{kind}}' passed as the value prop to the context provider should not be constructed. It will change on every render. {{suggestion}}" },
		schema: []
	},
	name: RULE_NAME$14,
	create: create$14,
	defaultOptions: []
});
function create$14(context) {
	const { compilationMode, version } = getSettingsFromContext(context);
	if (compilationMode === "infer" || compilationMode === "all") return {};
	if (compilationMode === "annotation" && ast.isDirectiveInFile(context.sourceCode.ast, "use memo")) return {};
	const isReact18OrBelow = compare(version, "19.0.0", "<");
	const { api, visitor } = core.getComponentCollector(context);
	const constructions = /* @__PURE__ */ new WeakMap();
	return defineRuleListener(visitor, {
		JSXOpeningElement(node) {
			const selfName = getElementFullType(node.parent).split(".").at(-1);
			if (selfName == null) return;
			if (!isContextName(selfName, isReact18OrBelow)) return;
			const enclosingFunction = ast.findParent(node, ast.isFunction);
			if (enclosingFunction == null) return;
			if (compilationMode === "annotation" && ast.isDirectiveInFunction(enclosingFunction, "use memo")) return;
			const attribute = node.attributes.find((attribute) => attribute.type === AST_NODE_TYPES.JSXAttribute && attribute.name.name === "value");
			if (attribute == null || !("value" in attribute)) return;
			const value = attribute.value;
			if (value?.type !== AST_NODE_TYPES.JSXExpressionContainer) return;
			const valueExpression = value.expression;
			const construction = computeObjectType(context, valueExpression);
			if (construction == null) return;
			if (core.isHookCall(construction.node)) return;
			getOrInsertComputed(constructions, enclosingFunction, () => []).push(construction);
		},
		"Program:exit"(program) {
			for (const { directives, node: component } of api.getAllComponents(program)) {
				if (compilationMode === "annotation" && directives.some((d) => d.directive === "use memo")) continue;
				for (const construction of constructions.get(component) ?? []) {
					const { kind, node: constructionNode } = construction;
					const suggestion = kind === "function" ? "Consider wrapping it in a useCallback hook." : "Consider wrapping it in a useMemo hook.";
					context.report({
						data: {
							kind: ast.getHumanReadableKind(constructionNode),
							suggestion
						},
						messageId: "unstableContextValue",
						node: constructionNode
					});
				}
			}
		}
	});
}
function isContextName(name, isReact18OrBelow) {
	if (name === "Provider") return true;
	if (!isReact18OrBelow) return name.endsWith("Context") || name.endsWith("CONTEXT");
	return false;
}

//#endregion
//#region src/rules/no-unstable-default-props/no-unstable-default-props.ts
const RULE_NAME$13 = "no-unstable-default-props";
const defaultOptions$1 = [{ safeDefaultProps: [] }];
const schema$1 = [{
	type: "object",
	additionalProperties: false,
	properties: { safeDefaultProps: {
		type: "array",
		items: { type: "string" }
	} }
}];
var no_unstable_default_props_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Prevents using referential-type values as default props in object destructuring." },
		messages: { default: "A/an '{{kind}}' as default prop. This could lead to potential infinite render loop in React. Use a variable instead of '{{kind}}'." },
		schema: schema$1
	},
	name: RULE_NAME$13,
	create: create$13,
	defaultOptions: defaultOptions$1
});
function extractIdentifier(node) {
	if (node.type === AST_NODE_TYPES.NewExpression && node.callee.type === AST_NODE_TYPES.Identifier) return node.callee.name;
	if (node.type === AST_NODE_TYPES.CallExpression && node.callee.type === AST_NODE_TYPES.MemberExpression) {
		const { object } = node.callee;
		if (object.type === AST_NODE_TYPES.Identifier) return object.name;
	}
	return null;
}
function create$13(context, [options]) {
	const { compilationMode } = getSettingsFromContext(context);
	if (compilationMode === "infer" || compilationMode === "all") return {};
	if (compilationMode === "annotation" && ast.isDirectiveInFile(context.sourceCode.ast, "use memo")) return {};
	const { api, visitor } = core.getComponentCollector(context);
	const declarators = /* @__PURE__ */ new WeakMap();
	const { safeDefaultProps = [] } = options;
	const safePatterns = safeDefaultProps.map((s) => toRegExp(s));
	return defineRuleListener(visitor, {
		[ast.SEL_OBJECT_DESTRUCTURING_VARIABLE_DECLARATOR](node) {
			const enclosingFunction = ast.findParent(node, ast.isFunction);
			if (enclosingFunction == null) return;
			getOrInsertComputed(declarators, enclosingFunction, () => []).push(node);
		},
		"Program:exit"(program) {
			for (const { node: component } of api.getAllComponents(program)) {
				const { params } = component;
				const [props] = params;
				if (props == null) continue;
				const properties = match(props).with({ type: AST_NODE_TYPES.ObjectPattern }, ({ properties }) => properties).with({ type: AST_NODE_TYPES.Identifier }, ({ name }) => {
					return declarators.get(component)?.filter((d) => d.init.name === name).flatMap((d) => d.id.properties) ?? [];
				}).otherwise(() => []);
				for (const prop of properties) {
					if (prop.type !== AST_NODE_TYPES.Property || prop.value.type !== AST_NODE_TYPES.AssignmentPattern) continue;
					const { value } = prop;
					const { right } = value;
					const construction = computeObjectType(context, value);
					if (construction == null) continue;
					if (core.isHookCall(construction.node)) continue;
					if (safePatterns.length > 0) {
						const identifier = extractIdentifier(right);
						if (identifier != null && safePatterns.some((pattern) => pattern.test(identifier))) continue;
					}
					context.report({
						data: { kind: ast.getHumanReadableKind(right) },
						messageId: "default",
						node: right
					});
				}
			}
		}
	});
}

//#endregion
//#region src/rules/no-unused-class-component-members/no-unused-class-component-members.ts
const RULE_NAME$12 = "no-unused-class-component-members";
const LIFECYCLE_METHODS = new Set([
	"componentDidCatch",
	"componentDidMount",
	"componentDidUpdate",
	"componentWillMount",
	"componentWillReceiveProps",
	"componentWillUnmount",
	"componentWillUpdate",
	"constructor",
	"getSnapshotBeforeUpdate",
	"render",
	"shouldComponentUpdate",
	"state",
	"UNSAFE_componentWillMount",
	"UNSAFE_componentWillReceiveProps",
	"UNSAFE_componentWillUpdate"
]);
function isKeyLiteral$1(node, key) {
	return match(key).with({ type: AST_NODE_TYPES.Literal }, constTrue).with({
		type: AST_NODE_TYPES.TemplateLiteral,
		expressions: []
	}, constTrue).with({ type: AST_NODE_TYPES.Identifier }, () => !node.computed).otherwise(constFalse);
}
var no_unused_class_component_members_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Warns about unused class component methods and properties." },
		messages: { default: "Unused method or property '{{methodName}}'' of class '{{className}}'." },
		schema: []
	},
	name: RULE_NAME$12,
	create: create$12,
	defaultOptions: []
});
function create$12(context) {
	const classStack = [];
	const methodStack = [];
	const propertyDefs = /* @__PURE__ */ new WeakMap();
	const propertyUsages = /* @__PURE__ */ new WeakMap();
	function classEnter(node) {
		classStack.push(node);
		if (!core.isClassComponent(node)) return;
		propertyDefs.set(node, /* @__PURE__ */ new Set());
		propertyUsages.set(node, /* @__PURE__ */ new Set());
	}
	function classExit() {
		const currentClass = classStack.pop();
		if (currentClass == null || !core.isClassComponent(currentClass)) return;
		const id = ast.getClassId(currentClass);
		const defs = propertyDefs.get(currentClass);
		const usages = propertyUsages.get(currentClass);
		if (defs == null) return;
		for (const def of defs) {
			const methodName = ast.getPropertyName(def);
			if (methodName == null) continue;
			if ((usages?.has(methodName) ?? false) || LIFECYCLE_METHODS.has(methodName)) continue;
			context.report({
				data: {
					className: id != null ? context.sourceCode.getText(id) : "Component",
					methodName
				},
				messageId: "default",
				node: def
			});
		}
	}
	function methodEnter(node) {
		methodStack.push(node);
		const currentClass = classStack.at(-1);
		if (currentClass == null || !core.isClassComponent(currentClass)) return;
		if (node.static) return;
		if (isKeyLiteral$1(node, node.key)) propertyDefs.get(currentClass)?.add(node.key);
	}
	function methodExit() {
		methodStack.pop();
	}
	return defineRuleListener({
		ClassDeclaration: classEnter,
		"ClassDeclaration:exit": classExit,
		ClassExpression: classEnter,
		"ClassExpression:exit": classExit,
		MemberExpression(node) {
			const currentClass = classStack.at(-1);
			const currentMethod = methodStack.at(-1);
			if (currentClass == null || currentMethod == null) return;
			if (!core.isClassComponent(currentClass) || currentMethod.static) return;
			if (!ast.isThisExpressionLoose(node.object) || !isKeyLiteral$1(node, node.property)) return;
			if (node.parent.type === AST_NODE_TYPES.AssignmentExpression && node.parent.left === node) {
				propertyDefs.get(currentClass)?.add(node.property);
				return;
			}
			const propertyName = ast.getPropertyName(node.property);
			if (propertyName != null) propertyUsages.get(currentClass)?.add(propertyName);
		},
		MethodDefinition: methodEnter,
		"MethodDefinition:exit": methodExit,
		PropertyDefinition: methodEnter,
		"PropertyDefinition:exit": methodExit,
		VariableDeclarator(node) {
			const currentClass = classStack.at(-1);
			const currentMethod = methodStack.at(-1);
			if (currentClass == null || currentMethod == null) return;
			if (!core.isClassComponent(currentClass) || currentMethod.static) return;
			if (node.init != null && ast.isThisExpressionLoose(node.init) && node.id.type === AST_NODE_TYPES.ObjectPattern) {
				for (const prop of node.id.properties) if (prop.type === AST_NODE_TYPES.Property && isKeyLiteral$1(prop, prop.key)) {
					const keyName = ast.getPropertyName(prop.key);
					if (keyName != null) propertyUsages.get(currentClass)?.add(keyName);
				}
			}
		}
	});
}

//#endregion
//#region src/rules/no-unused-props/no-unused-props.ts
const RULE_NAME$11 = "no-unused-props";
var no_unused_props_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Warns about component props that are defined but never used." },
		messages: { default: "Prop `{{name}}` is declared but never used" },
		schema: []
	},
	name: RULE_NAME$11,
	create: create$11,
	defaultOptions: []
});
function create$11(context) {
	const services = ESLintUtils.getParserServices(context, false);
	const checker = services.program.getTypeChecker();
	const { api, visitor } = core.getComponentCollector(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		const totalDeclaredProps = /* @__PURE__ */ new Map();
		const totalUsedDeclarations = /* @__PURE__ */ new Set();
		for (const component of api.getAllComponents(program)) {
			const [props] = component.node.params;
			if (props == null) continue;
			const usedPropKeys = /* @__PURE__ */ new Set();
			if (!collectUsedPropKeysOfParameter(context, usedPropKeys, props)) continue;
			const tsNode = services.esTreeNodeToTSNodeMap.get(props);
			const declaredProps = checker.getTypeAtLocation(tsNode).getProperties();
			for (const declaredProp of declaredProps) {
				const declaration = declaredProp.getDeclarations()?.[0];
				if (declaration == null) continue;
				if (!totalDeclaredProps.has(declaration)) totalDeclaredProps.set(declaration, declaredProp);
				if (usedPropKeys.has(declaredProp.name)) totalUsedDeclarations.add(declaration);
			}
		}
		for (const [declaration, symbol] of totalDeclaredProps.entries()) if (!totalUsedDeclarations.has(declaration)) reportUnusedProp(context, services, symbol);
	} });
}
function collectUsedPropKeysOfParameter(context, usedPropKeys, parameter) {
	switch (parameter.type) {
		case AST_NODE_TYPES.Identifier: return collectUsedPropKeysOfIdentifier(context, usedPropKeys, parameter);
		case AST_NODE_TYPES.ObjectPattern: return collectUsedPropKeysOfObjectPattern(context, usedPropKeys, parameter);
		default: return false;
	}
}
function collectUsedPropKeysOfObjectPattern(context, usedPropKeys, objectPattern) {
	for (const property of objectPattern.properties) switch (property.type) {
		case AST_NODE_TYPES.Property: {
			const key = getKeyOfExpression(property.key);
			if (key == null) return false;
			usedPropKeys.add(key);
			break;
		}
		case AST_NODE_TYPES.RestElement:
			if (!collectUsedPropsOfRestElement(context, usedPropKeys, property)) return false;
			break;
	}
	return true;
}
function collectUsedPropsOfRestElement(context, usedPropKeys, restElement) {
	switch (restElement.argument.type) {
		case AST_NODE_TYPES.Identifier: return collectUsedPropKeysOfIdentifier(context, usedPropKeys, restElement.argument);
		default: return false;
	}
}
function collectUsedPropKeysOfIdentifier(context, usedPropKeys, identifier) {
	const variable = context.sourceCode.getScope(identifier).variables.find((v) => v.name === identifier.name);
	if (variable == null) return false;
	for (const ref of variable.references) {
		if (ref.identifier === identifier) continue;
		if (!collectUsedPropKeysOfReference(context, usedPropKeys, identifier, ref)) return false;
	}
	return true;
}
function collectUsedPropKeysOfReference(context, usedPropKeys, identifier, ref) {
	const { parent } = ref.identifier;
	switch (parent.type) {
		case AST_NODE_TYPES.MemberExpression:
			if (parent.object.type === AST_NODE_TYPES.Identifier && parent.object.name === identifier.name) {
				const key = getKeyOfExpression(parent.property);
				if (key == null) return false;
				usedPropKeys.add(key);
				return true;
			}
			break;
		case AST_NODE_TYPES.VariableDeclarator:
			if (parent.id.type === AST_NODE_TYPES.ObjectPattern && parent.init === ref.identifier) return collectUsedPropKeysOfObjectPattern(context, usedPropKeys, parent.id);
			break;
	}
	return false;
}
function getKeyOfExpression(expr) {
	switch (expr.type) {
		case AST_NODE_TYPES.Identifier: return expr.name;
		case AST_NODE_TYPES.Literal:
			if (typeof expr.value === "string") return expr.value;
			break;
	}
	return null;
}
function reportUnusedProp(context, services, prop) {
	const declaration = prop.getDeclarations()?.[0];
	if (declaration == null) return;
	const declarationNode = services.tsNodeToESTreeNodeMap.get(declaration);
	if (declarationNode == null) return;
	const nodeToReport = declarationNode.type === AST_NODE_TYPES.TSPropertySignature ? declarationNode.key : declarationNode;
	context.report({
		data: { name: prop.name },
		messageId: "default",
		node: nodeToReport
	});
}

//#endregion
//#region src/rules/no-unused-state/no-unused-state.ts
const RULE_NAME$10 = "no-unused-state";
function isKeyLiteral(node, key) {
	return match(key).with({ type: AST_NODE_TYPES.Literal }, constTrue).with({
		type: AST_NODE_TYPES.TemplateLiteral,
		expressions: []
	}, constTrue).with({ type: AST_NODE_TYPES.Identifier }, () => !node.computed).otherwise(constFalse);
}
var no_unused_state_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Warns about unused class component state." },
		messages: { default: "Unused class component state in '{{className}}'" },
		schema: []
	},
	name: RULE_NAME$10,
	create: create$10,
	defaultOptions: []
});
function create$10(context) {
	const classStack = [];
	const methodStack = [];
	const constructorStack = [];
	const stateDefs = /* @__PURE__ */ new WeakMap();
	function classEnter(node) {
		classStack.push(node);
	}
	function classExit() {
		const currentClass = classStack.pop();
		if (currentClass == null || !core.isClassComponent(currentClass)) return;
		const id = ast.getClassId(currentClass);
		const { isUsed = false, node: defNode } = stateDefs.get(currentClass) ?? {};
		if (defNode == null || isUsed) return;
		context.report({
			data: { className: id != null ? context.sourceCode.getText(id) : "Component" },
			messageId: "default",
			node: defNode
		});
	}
	function methodEnter(node) {
		methodStack.push(node);
		const currentClass = classStack.at(-1);
		if (currentClass == null || !core.isClassComponent(currentClass)) return;
		if (node.static) {
			if (core.isGetDerivedStateFromProps(node) && isMatching({ params: [P.nonNullable, ...P.array()] })(node.value)) {
				const defNode = stateDefs.get(currentClass)?.node ?? null;
				stateDefs.set(currentClass, {
					isUsed: true,
					node: defNode
				});
			}
			return;
		}
		if (ast.getPropertyName(node.key) === "state") stateDefs.set(currentClass, {
			isUsed: false,
			node: node.key
		});
	}
	function methodExit() {
		methodStack.pop();
	}
	function constructorEnter(node) {
		constructorStack.push(node);
	}
	function constructorExit() {
		constructorStack.pop();
	}
	return defineRuleListener({
		AssignmentExpression(node) {
			if (!core.isAssignmentToThisState(node)) return;
			const currentClass = classStack.at(-1);
			if (currentClass == null || !core.isClassComponent(currentClass)) return;
			const currentConstructor = constructorStack.at(-1);
			if (currentConstructor == null || !currentClass.body.body.includes(currentConstructor)) return;
			const isUsed = stateDefs.get(currentClass)?.isUsed ?? false;
			stateDefs.set(currentClass, {
				isUsed,
				node: node.left
			});
		},
		ClassDeclaration: classEnter,
		"ClassDeclaration:exit": classExit,
		ClassExpression: classEnter,
		"ClassExpression:exit": classExit,
		MemberExpression(node) {
			if (!ast.isThisExpressionLoose(node.object)) return;
			if (ast.getPropertyName(node.property) !== "state") return;
			const currentClass = classStack.at(-1);
			if (currentClass == null || !core.isClassComponent(currentClass)) return;
			const currentMethod = methodStack.at(-1);
			if (currentMethod == null || currentMethod.static) return;
			if (currentMethod === constructorStack.at(-1)) return;
			if (!currentClass.body.body.includes(currentMethod)) return;
			const defNode = stateDefs.get(currentClass)?.node ?? null;
			stateDefs.set(currentClass, {
				isUsed: true,
				node: defNode
			});
		},
		MethodDefinition: methodEnter,
		"MethodDefinition:exit": methodExit,
		"MethodDefinition[key.name='constructor']": constructorEnter,
		"MethodDefinition[key.name='constructor']:exit": constructorExit,
		PropertyDefinition: methodEnter,
		"PropertyDefinition:exit": methodExit,
		VariableDeclarator(node) {
			const currentClass = classStack.at(-1);
			if (currentClass == null || !core.isClassComponent(currentClass)) return;
			const currentMethod = methodStack.at(-1);
			if (currentMethod == null || currentMethod.static) return;
			if (currentMethod === constructorStack.at(-1)) return;
			if (!currentClass.body.body.includes(currentMethod)) return;
			if (node.init == null || !ast.isThisExpressionLoose(node.init) || node.id.type !== AST_NODE_TYPES.ObjectPattern) return;
			if (!node.id.properties.some((prop) => {
				if (prop.type === AST_NODE_TYPES.Property && isKeyLiteral(prop, prop.key)) return ast.getPropertyName(prop.key) === "state";
				return false;
			})) return;
			const defNode = stateDefs.get(currentClass)?.node ?? null;
			stateDefs.set(currentClass, {
				isUsed: true,
				node: defNode
			});
		}
	});
}

//#endregion
//#region src/rules/no-use-context/no-use-context.ts
const RULE_NAME$9 = "no-use-context";
var no_use_context_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Replaces usage of 'useContext' with 'use'." },
		fixable: "code",
		hasSuggestions: true,
		messages: {
			default: "In React 19, 'use' is preferred over 'useContext' because it is more flexible.",
			replace: "Replace 'useContext' with 'use'."
		},
		schema: []
	},
	name: RULE_NAME$9,
	create: create$9,
	defaultOptions: []
});
function create$9(context) {
	if (!context.sourceCode.text.includes("useContext")) return {};
	const { version } = getSettingsFromContext(context);
	if (compare(version, "19.0.0", "<")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isUseContextCall(node)) return;
		context.report({
			messageId: "default",
			node: node.callee,
			suggest: [{
				fix(fixer) {
					switch (node.callee.type) {
						case AST_NODE_TYPES.Identifier: return fixer.replaceText(node.callee, "use");
						case AST_NODE_TYPES.MemberExpression: return fixer.replaceText(node.callee.property, "use");
					}
					return null;
				},
				messageId: "replace"
			}]
		});
	} });
}

//#endregion
//#region src/rules/prefer-destructuring-assignment/prefer-destructuring-assignment.ts
const RULE_NAME$8 = "prefer-destructuring-assignment";
var prefer_destructuring_assignment_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Enforces destructuring assignment for component props and context." },
		messages: { default: "Use destructuring assignment for component props." },
		schema: []
	},
	name: RULE_NAME$8,
	create: create$8,
	defaultOptions: []
});
function create$8(context) {
	const { api, visitor } = core.getComponentCollector(context);
	return defineRuleListener(visitor, { "Program:exit"(program) {
		for (const component of api.getAllComponents(program)) {
			if (component.name == null || component.isExportDefaultDeclaration) continue;
			const [props] = component.node.params;
			if (props == null) continue;
			if (props.type !== AST_NODE_TYPES.Identifier) continue;
			const propName = props.name;
			const propReferences = context.sourceCode.getScope(component.node).variables.find((v) => v.name === propName)?.references ?? [];
			for (const ref of propReferences) {
				const { parent } = ref.identifier;
				if (parent.type !== AST_NODE_TYPES.MemberExpression) continue;
				context.report({
					messageId: "default",
					node: parent
				});
			}
		}
	} });
}

//#endregion
//#region src/rules/prefer-namespace-import/prefer-namespace-import.ts
const RULE_NAME$7 = "prefer-namespace-import";
var prefer_namespace_import_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Enforces importing React via a namespace import." },
		fixable: "code",
		messages: { default: "Prefer importing React as 'import * as React from \"{{importSource}}\"';" },
		schema: []
	},
	name: RULE_NAME$7,
	create: create$7,
	defaultOptions: []
});
function create$7(context) {
	const { importSource } = getSettingsFromContext(context);
	return defineRuleListener({ [`ImportDeclaration[source.value="${importSource}"] ImportDefaultSpecifier`](node) {
		const hasOtherSpecifiers = node.parent.specifiers.length > 1;
		context.report({
			data: { importSource },
			fix(fixer) {
				const importDeclarationText = context.sourceCode.getText(node.parent);
				const semi = importDeclarationText.endsWith(";") ? ";" : "";
				const quote = node.parent.source.raw.at(0) ?? "'";
				const importStringPrefix = `import${node.parent.importKind === "type" ? " type" : ""}`;
				const importSourceQuoted = `${quote}${importSource}${quote}`;
				if (!hasOtherSpecifiers) return fixer.replaceText(node.parent, `${importStringPrefix} * as ${node.local.name} from ${importSourceQuoted}${semi}`);
				const specifiers = importDeclarationText.slice(importDeclarationText.indexOf("{"), importDeclarationText.indexOf("}") + 1);
				return fixer.replaceText(node.parent, [`${importStringPrefix} * as ${node.local.name} from ${importSourceQuoted}${semi}`, `${importStringPrefix} ${specifiers} from ${importSourceQuoted}${semi}`].join("\n"));
			},
			messageId: "default",
			node: hasOtherSpecifiers ? node : node.parent
		});
	} });
}

//#endregion
//#region src/rules/purity/purity.ts
const RULE_NAME$6 = "purity";
var purity_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates that components and hooks are pure by checking that they do not call known-impure functions during render." },
		messages: { default: "Do not call '{{name}}' during render. Components and hooks must be pure. Move this call into an event handler, effect, or state initializer." },
		schema: []
	},
	name: RULE_NAME$6,
	create: create$6,
	defaultOptions: []
});
function create$6(context) {
	const hCollector = core.getHookCollector(context);
	const cCollector = core.getComponentCollector(context);
	const cEntries = [];
	const nEntries = [];
	return defineRuleListener(hCollector.visitor, cCollector.visitor, {
		CallExpression(node) {
			const expr = ast.getUnderlyingExpression(node.callee);
			switch (true) {
				case expr.type === AST_NODE_TYPES.Identifier: {
					if (!IMPURE_FUNCS.get("globalThis")?.has(expr.name)) return;
					const func = ast.findParent(node, ast.isFunction);
					if (func == null) return;
					cEntries.push({
						func,
						node
					});
					break;
				}
				case expr.type === AST_NODE_TYPES.MemberExpression && expr.object.type === AST_NODE_TYPES.Identifier && expr.property.type === AST_NODE_TYPES.Identifier: {
					const objectName = expr.object.name;
					const propertyName = expr.property.name;
					if (!IMPURE_FUNCS.get(objectName)?.has(propertyName)) return;
					const func = ast.findParent(node, ast.isFunction);
					if (func == null) return;
					cEntries.push({
						func,
						node
					});
					break;
				}
			}
		},
		NewExpression(node) {
			const expr = ast.getUnderlyingExpression(node.callee);
			if (expr.type !== AST_NODE_TYPES.Identifier) return;
			if (!IMPURE_CTORS.has(expr.name)) return;
			if (expr.name === "Date" && node.arguments.length > 0) return;
			const func = ast.findParent(node, ast.isFunction);
			if (func == null) return;
			nEntries.push({
				func,
				node
			});
		},
		"Program:exit"(node) {
			const comps = cCollector.api.getAllComponents(node);
			const hooks = hCollector.api.getAllHooks(node);
			const funcs = [...comps, ...hooks];
			for (const { func, node } of [...cEntries, ...nEntries]) {
				if (!funcs.some((f) => f.node === func)) continue;
				context.report({
					data: { name: context.sourceCode.getText(node) },
					messageId: "default",
					node
				});
			}
		}
	});
}

//#endregion
//#region src/rules/refs/refs.ts
const RULE_NAME$5 = "refs";
var refs_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates correct usage of refs by checking that 'ref.current' is not read or written during render." },
		messages: {
			readDuringRender: "Do not read 'ref.current' during render. Refs are not available during rendering and their values may be stale or inconsistent. Move this read into an effect or event handler.",
			writeDuringRender: "Do not write to 'ref.current' during render. Refs should only be mutated in effects or event handlers. Move this write into an effect or event handler."
		},
		schema: []
	},
	name: RULE_NAME$5,
	create: create$5,
	defaultOptions: []
});
function create$5(context) {
	const hCollector = core.getHookCollector(context);
	const cCollector = core.getComponentCollector(context);
	const refAccesses = [];
	const jsxRefIdentifiers = /* @__PURE__ */ new Set();
	/**
	* Check if the node is the operand of a `ref.current === null` test inside an IfStatement.
	* @param node The MemberExpression node for ref.current
	* @returns true if the node is part of a null check test in an if statement
	*/
	function isInNullCheckTest(node) {
		let parent = node.parent;
		while (ast.isTypeExpression(parent)) parent = parent.parent;
		if (!isMatching({
			type: AST_NODE_TYPES.BinaryExpression,
			operator: P.union("===", "==", "!==", "!=")
		}, parent)) return false;
		const otherSide = parent.left === node || ast.getUnderlyingExpression(parent.left) === node ? parent.right : parent.left;
		if (otherSide.type !== AST_NODE_TYPES.Literal || otherSide.value != null) return false;
		return parent.parent.type === AST_NODE_TYPES.IfStatement && parent.parent.test === parent;
	}
	/**
	* Check if a test expression is a null check on `ref.current` for a given ref name.
	* Matches forms like `ref.current === null`, `null === ref.current`, and their != variants.
	* @param test The test expression to check.
	* @param refName The name of the ref variable.
	*/
	function isRefCurrentNullCheck(test, refName) {
		if (test.type !== AST_NODE_TYPES.BinaryExpression) return false;
		const op = test.operator;
		if (op !== "===" && op !== "==" && op !== "!==" && op !== "!=") return false;
		const { left, right } = test;
		const checkSides = (a, b) => {
			a = ast.isTypeExpression(a) ? ast.getUnderlyingExpression(a) : a;
			return a.type === AST_NODE_TYPES.MemberExpression && a.object.type === AST_NODE_TYPES.Identifier && a.object.name === refName && b.type === AST_NODE_TYPES.Literal && b.value == null && ast.getPropertyName(a.property) === "current";
		};
		return checkSides(left, right) || checkSides(right, left);
	}
	function isInitializedFromRef(name, initialScope) {
		for (const { node } of findVariable(initialScope, name)?.defs ?? []) {
			if (node.type !== AST_NODE_TYPES.VariableDeclarator) continue;
			const init = node.init;
			if (init == null) continue;
			switch (true) {
				case init.type === AST_NODE_TYPES.MemberExpression && init.object.type === AST_NODE_TYPES.Identifier && (init.object.name === "ref" || init.object.name.endsWith("Ref")): return true;
				case init.type === AST_NODE_TYPES.CallExpression && isUseRefCall(init): return true;
			}
		}
		return false;
	}
	return defineRuleListener(hCollector.visitor, cCollector.visitor, {
		JSXAttribute(node) {
			switch (true) {
				case node.name.type === AST_NODE_TYPES.JSXIdentifier && node.name.name === "ref" && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer && node.value.expression.type === AST_NODE_TYPES.Identifier:
					jsxRefIdentifiers.add(node.value.expression.name);
					return;
			}
		},
		MemberExpression(node) {
			if (!ast.isIdentifier(node.property, "current")) return;
			refAccesses.push({
				isWrite: (() => {
					let parent = node.parent;
					while (ast.isTypeExpression(parent)) parent = parent.parent;
					return match(parent).with({ type: AST_NODE_TYPES.AssignmentExpression }, (p) => p.left === node || ast.getUnderlyingExpression(p.left) === node).with({ type: AST_NODE_TYPES.UpdateExpression }, (p) => p.argument === node || ast.getUnderlyingExpression(p.argument) === node).otherwise(() => false);
				})(),
				node
			});
		},
		"Program:exit"(program) {
			const comps = cCollector.api.getAllComponents(program);
			const hooks = hCollector.api.getAllHooks(program);
			const funcs = new Set([...comps.map((c) => c.node), ...hooks.map((h) => h.node)]);
			const isCompOrHookFn = (n) => ast.isFunction(n) && funcs.has(n);
			for (const { isWrite, node } of refAccesses) {
				const obj = node.object;
				if (obj.type !== AST_NODE_TYPES.Identifier) continue;
				switch (true) {
					case obj.name === "ref" || obj.name.endsWith("Ref"):
					case jsxRefIdentifiers.has(obj.name):
					case isInitializedFromRef(obj.name, context.sourceCode.getScope(node.object)): break;
					default: continue;
				}
				const boundary = ast.findParent(node, isCompOrHookFn);
				if (boundary == null) continue;
				if (ast.findParent(node, ast.isFunction) !== boundary) continue;
				const refName = obj.name;
				let isLazyInit = isInNullCheckTest(node);
				if (!isLazyInit) {
					let current = node.parent;
					findIf: while (current != null) {
						if (current.type === AST_NODE_TYPES.IfStatement) {
							if (isRefCurrentNullCheck(current.test, refName)) isLazyInit = true;
							break;
						}
						switch (current.type) {
							case AST_NODE_TYPES.ExpressionStatement:
							case AST_NODE_TYPES.BlockStatement:
							case AST_NODE_TYPES.ReturnStatement:
							case AST_NODE_TYPES.JSXExpressionContainer:
							case AST_NODE_TYPES.JSXElement:
							case AST_NODE_TYPES.JSXOpeningElement:
							case AST_NODE_TYPES.JSXClosingElement:
							case AST_NODE_TYPES.AssignmentExpression:
							case AST_NODE_TYPES.VariableDeclaration:
							case AST_NODE_TYPES.VariableDeclarator:
							case AST_NODE_TYPES.MemberExpression:
							case AST_NODE_TYPES.ChainExpression:
							case AST_NODE_TYPES.CallExpression: break;
							default: break findIf;
						}
						current = current.parent;
					}
				}
				if (!isLazyInit && isWrite) {
					let stmt = node;
					while (stmt.parent != null && stmt.parent.type !== AST_NODE_TYPES.BlockStatement) stmt = stmt.parent;
					if (stmt.parent?.type === AST_NODE_TYPES.BlockStatement) {
						const block = stmt.parent;
						const stmtIdx = block.body.indexOf(stmt);
						if (stmtIdx >= 0) for (let i = stmtIdx - 1; i >= 0; i--) {
							const sibling = block.body[i];
							if (sibling == null) continue;
							if (sibling.type === AST_NODE_TYPES.IfStatement && isRefCurrentNullCheck(sibling.test, refName)) {
								isLazyInit = true;
								break;
							}
						}
					}
				}
				if (isLazyInit) continue;
				context.report({
					messageId: isWrite ? "writeDuringRender" : "readDuringRender",
					node
				});
			}
		}
	});
}

//#endregion
//#region src/rules/rules-of-hooks/lib.ts
function assert(cond, message) {
	if (!cond) throw new Error(message ?? "Assertion violated.");
}
/**
* Checks whether or not a given segment is reachable.
*/
function isReachable$1(segment) {
	return segment.reachable;
}
/**
* A code path segment.
*/
var CodePathSegment = class CodePathSegment {
	/**
	* The identifier of this code path.
	* Rules use it to store additional information of each rule.
	*/
	id;
	/** An array of the next reachable segments. */
	nextSegments;
	/** An array of the previous reachable segments. */
	prevSegments;
	/** An array of all next segments (including unreachable). */
	allNextSegments;
	/** An array of all previous segments (including unreachable). */
	allPrevSegments;
	/** Whether this segment is reachable. */
	reachable;
	/** Internal bookkeeping data. */
	internal;
	/**
	* @param id An identifier.
	* @param allPrevSegments An array of the previous segments (including unreachable).
	* @param reachable Whether this segment is reachable.
	*/
	constructor(id, allPrevSegments, reachable) {
		this.id = id;
		this.nextSegments = [];
		this.prevSegments = allPrevSegments.filter(isReachable$1);
		this.allNextSegments = [];
		this.allPrevSegments = allPrevSegments;
		this.reachable = reachable;
		this.internal = {
			used: false,
			loopedPrevSegments: []
		};
	}
	/**
	* Checks if a given previous segment is coming from the end of a loop.
	*/
	isLoopedPrevSegment(segment) {
		return this.internal.loopedPrevSegments.includes(segment);
	}
	/**
	* Creates the root segment.
	*/
	static newRoot(id) {
		return new CodePathSegment(id, [], true);
	}
	/**
	* Creates a segment that follows given segments.
	*/
	static newNext(id, allPrevSegments) {
		return new CodePathSegment(id, CodePathSegment.flattenUnusedSegments(allPrevSegments), allPrevSegments.some(isReachable$1));
	}
	/**
	* Creates an unreachable segment that follows given segments.
	*/
	static newUnreachable(id, allPrevSegments) {
		const segment = new CodePathSegment(id, CodePathSegment.flattenUnusedSegments(allPrevSegments), false);
		CodePathSegment.markUsed(segment);
		return segment;
	}
	/**
	* Creates a segment that follows given segments.
	* This factory method does not connect with `allPrevSegments`.
	* But this inherits `reachable` flag.
	*/
	static newDisconnected(id, allPrevSegments) {
		return new CodePathSegment(id, [], allPrevSegments.some(isReachable$1));
	}
	/**
	* Makes a given segment being used.
	* Also registers the segment into the previous segments as a next.
	*/
	static markUsed(segment) {
		if (segment.internal.used) return;
		segment.internal.used = true;
		let i;
		if (segment.reachable) for (i = 0; i < segment.allPrevSegments.length; ++i) {
			const prevSegment = segment.allPrevSegments[i];
			prevSegment.allNextSegments.push(segment);
			prevSegment.nextSegments.push(segment);
		}
		else for (i = 0; i < segment.allPrevSegments.length; ++i) segment.allPrevSegments[i].allNextSegments.push(segment);
	}
	/**
	* Marks a previous segment as looped.
	*/
	static markPrevSegmentAsLooped(segment, prevSegment) {
		segment.internal.loopedPrevSegments.push(prevSegment);
	}
	/**
	* Replaces unused segments with the previous segments of each unused segment.
	*/
	static flattenUnusedSegments(segments) {
		const done = Object.create(null);
		const retv = [];
		for (let i = 0; i < segments.length; ++i) {
			const segment = segments[i];
			if (done[segment.id]) continue;
			if (!segment.internal.used) for (let j = 0; j < segment.allPrevSegments.length; ++j) {
				const prevSegment = segment.allPrevSegments[j];
				if (!done[prevSegment.id]) {
					done[prevSegment.id] = true;
					retv.push(prevSegment);
				}
			}
			else {
				done[segment.id] = true;
				retv.push(segment);
			}
		}
		return retv;
	}
};
/**
* Gets whether or not a given segment is reachable.
*/
function isReachable(segment) {
	return segment.reachable;
}
/**
* Creates new segments from the specific range of `context.segmentsList`.
*
* When `context.segmentsList` is `[[a, b], [c, d], [e, f]]`, `begin` is `0`, and
* `end` is `-1`, this creates `[g, h]`. This `g` is from `a`, `c`, and `e`.
* This `h` is from `b`, `d`, and `f`.
*/
function makeSegments(context, begin, end, create) {
	const list = context.segmentsList;
	const normalizedBegin = begin >= 0 ? begin : list.length + begin;
	const normalizedEnd = end >= 0 ? end : list.length + end;
	const segments = [];
	for (let i = 0; i < context.count; ++i) {
		const allPrevSegments = [];
		for (let j = normalizedBegin; j <= normalizedEnd; ++j) allPrevSegments.push(list[j][i]);
		segments.push(create(context.idGenerator.next(), allPrevSegments));
	}
	return segments;
}
/**
* `segments` becomes doubly in a `finally` block. Then if a code path exits by a
* control statement (such as `break`, `continue`) from the `finally` block, the
* destination's segments may be half of the source segments. In that case, this
* merges segments.
*/
function mergeExtraSegments(context, segments) {
	let currentSegments = segments;
	while (currentSegments.length > context.count) {
		const merged = [];
		for (let i = 0, length = currentSegments.length / 2 | 0; i < length; ++i) merged.push(CodePathSegment.newNext(context.idGenerator.next(), [currentSegments[i], currentSegments[i + length]]));
		currentSegments = merged;
	}
	return currentSegments;
}
/**
* A class to manage forking.
*/
var ForkContext = class ForkContext {
	idGenerator;
	upper;
	count;
	segmentsList;
	constructor(idGenerator, upper, count) {
		this.idGenerator = idGenerator;
		this.upper = upper;
		this.count = count;
		this.segmentsList = [];
	}
	/** The head segments. */
	get head() {
		const list = this.segmentsList;
		return list.length === 0 ? [] : list[list.length - 1];
	}
	/** Whether the segments list is empty. */
	get empty() {
		return this.segmentsList.length === 0;
	}
	/** Whether any head segment is reachable. */
	get reachable() {
		const segments = this.head;
		return segments.length > 0 && segments.some(isReachable);
	}
	/**
	* Creates new segments from this context.
	*/
	makeNext(begin, end) {
		return makeSegments(this, begin, end, CodePathSegment.newNext);
	}
	/**
	* Creates new unreachable segments from this context.
	*/
	makeUnreachable(begin, end) {
		return makeSegments(this, begin, end, CodePathSegment.newUnreachable);
	}
	/**
	* Creates new disconnected segments from this context.
	* The new segments don't have connections for previous segments,
	* but inherit the reachable flag.
	*/
	makeDisconnected(begin, end) {
		return makeSegments(this, begin, end, CodePathSegment.newDisconnected);
	}
	/**
	* Adds segments into this context. The added segments become the head.
	*/
	add(segments) {
		assert(segments.length >= this.count, `${segments.length} >= ${this.count}`);
		this.segmentsList.push(mergeExtraSegments(this, segments));
	}
	/**
	* Replaces the head segments with given segments.
	* The current head segments are removed.
	*/
	replaceHead(segments) {
		assert(segments.length >= this.count, `${segments.length} >= ${this.count}`);
		this.segmentsList.splice(-1, 1, mergeExtraSegments(this, segments));
	}
	/**
	* Adds all segments of a given fork context into this context.
	*/
	addAll(context) {
		assert(context.count === this.count);
		const source = context.segmentsList;
		for (let i = 0; i < source.length; ++i) this.segmentsList.push(source[i]);
	}
	/**
	* Clears all segments in this context.
	*/
	clear() {
		this.segmentsList = [];
	}
	/**
	* Creates the root fork context.
	*/
	static newRoot(idGenerator) {
		const context = new ForkContext(idGenerator, null, 1);
		context.add([CodePathSegment.newRoot(idGenerator.next())]);
		return context;
	}
	/**
	* Creates an empty fork context preceded by a given context.
	*/
	static newEmpty(parentContext, forkLeavingPath) {
		return new ForkContext(parentContext.idGenerator, parentContext, (forkLeavingPath ? 2 : 1) * parentContext.count);
	}
};
/**
* Adds given segments into the `dest` array.
* If the `others` array does not include the given segments, adds to the `all`
* array as well.
*
* This adds only reachable and used segments.
*/
function addToReturnedOrThrown(dest, others, all, segments) {
	for (let i = 0; i < segments.length; ++i) {
		const segment = segments[i];
		dest.push(segment);
		if (!others.includes(segment)) all.push(segment);
	}
}
/**
* Gets a loop-context for a `continue` statement.
*/
function getContinueContext(state, label) {
	if (!label) return state.loopContext;
	let context = state.loopContext;
	while (context) {
		if (context.label === label) return context;
		context = context.upper;
	}
	/* c8 ignore next */
	return null;
}
/**
* Gets a context for a `break` statement.
*/
function getBreakContext(state, label) {
	let context = state.breakContext;
	while (context) {
		if (label ? context.label === label : context.breakable) return context;
		context = context.upper;
	}
	/* c8 ignore next */
	return null;
}
/**
* Gets a context for a `return` statement.
*/
function getReturnContext(state) {
	let context = state.tryContext;
	while (context) {
		if (context.hasFinalizer && context.position !== "finally") return context;
		context = context.upper;
	}
	return state;
}
/**
* Gets a context for a `throw` statement.
*/
function getThrowContext(state) {
	let context = state.tryContext;
	while (context) {
		if (context.position === "try" || context.hasFinalizer && context.position === "catch") return context;
		context = context.upper;
	}
	return state;
}
/**
* Removes a given element from a given array.
*/
function remove(xs, x) {
	xs.splice(xs.indexOf(x), 1);
}
/**
* Disconnect given segments.
*
* This is used in a process for switch statements.
* If there is the "default" chunk before other cases, the order is different
* between node's and running's.
*/
function removeConnection(prevSegments, nextSegments) {
	for (let i = 0; i < prevSegments.length; ++i) {
		const prevSegment = prevSegments[i];
		const nextSegment = nextSegments[i];
		remove(prevSegment.nextSegments, nextSegment);
		remove(prevSegment.allNextSegments, nextSegment);
		remove(nextSegment.prevSegments, prevSegment);
		remove(nextSegment.allPrevSegments, prevSegment);
	}
}
/**
* Creates looping path.
*/
function makeLooped(state, unflattenedFromSegments, unflattenedToSegments) {
	const fromSegments = CodePathSegment.flattenUnusedSegments(unflattenedFromSegments);
	const toSegments = CodePathSegment.flattenUnusedSegments(unflattenedToSegments);
	const end = Math.min(fromSegments.length, toSegments.length);
	for (let i = 0; i < end; ++i) {
		const fromSegment = fromSegments[i];
		const toSegment = toSegments[i];
		if (toSegment.reachable) fromSegment.nextSegments.push(toSegment);
		if (fromSegment.reachable) toSegment.prevSegments.push(fromSegment);
		fromSegment.allNextSegments.push(toSegment);
		toSegment.allPrevSegments.push(fromSegment);
		if (toSegment.allPrevSegments.length >= 2) CodePathSegment.markPrevSegmentAsLooped(toSegment, fromSegment);
		state.notifyLooped(fromSegment, toSegment);
	}
}
/**
* Finalizes segments of `test` chunk of a ForStatement.
*
* - Adds `false` paths to paths which are leaving from the loop.
* - Sets `true` paths to paths which go to the body.
*/
function finalizeTestSegmentsOfFor(context, choiceContext, head) {
	if (!choiceContext.processed) {
		choiceContext.trueForkContext.add(head);
		choiceContext.falseForkContext.add(head);
		choiceContext.qqForkContext.add(head);
	}
	if (context.test !== true) context.brokenForkContext.addAll(choiceContext.falseForkContext);
	context.endOfTestSegments = choiceContext.trueForkContext.makeNext(0, -1);
}
/**
* A class which manages state to analyze code paths.
*/
var CodePathState = class {
	idGenerator;
	notifyLooped;
	forkContext;
	choiceContext;
	switchContext;
	tryContext;
	loopContext;
	breakContext;
	chainContext;
	currentSegments;
	initialSegment;
	finalSegments;
	returnedForkContext;
	thrownForkContext;
	constructor(idGenerator, onLooped) {
		this.idGenerator = idGenerator;
		this.notifyLooped = onLooped;
		this.forkContext = ForkContext.newRoot(idGenerator);
		this.choiceContext = null;
		this.switchContext = null;
		this.tryContext = null;
		this.loopContext = null;
		this.breakContext = null;
		this.chainContext = null;
		this.currentSegments = [];
		this.initialSegment = this.forkContext.head[0];
		const final = [];
		this.finalSegments = final;
		const returned = [];
		const thrown = [];
		this.returnedForkContext = returned;
		this.thrownForkContext = thrown;
		returned.add = addToReturnedOrThrown.bind(null, returned, thrown, final);
		thrown.add = addToReturnedOrThrown.bind(null, thrown, returned, final);
	}
	/** The head segments. */
	get headSegments() {
		return this.forkContext.head;
	}
	/**
	* The parent forking context.
	* This is used for the root of new forks.
	*/
	get parentForkContext() {
		const current = this.forkContext;
		return current && current.upper;
	}
	/**
	* Creates and stacks new forking context.
	*/
	pushForkContext(forkLeavingPath) {
		this.forkContext = ForkContext.newEmpty(this.forkContext, forkLeavingPath);
		return this.forkContext;
	}
	/**
	* Pops and merges the last forking context.
	*/
	popForkContext() {
		const lastContext = this.forkContext;
		this.forkContext = lastContext.upper;
		this.forkContext.replaceHead(lastContext.makeNext(0, -1));
		return lastContext;
	}
	/**
	* Creates a new path.
	*/
	forkPath() {
		this.forkContext.add(this.parentForkContext.makeNext(-1, -1));
	}
	/**
	* Creates a bypass path.
	* This is used for such as IfStatement which does not have "else" chunk.
	*/
	forkBypassPath() {
		this.forkContext.add(this.parentForkContext.head);
	}
	/**
	* Creates a context for ConditionalExpression, LogicalExpression,
	* AssignmentExpression (logical assignments only), IfStatement,
	* WhileStatement, DoWhileStatement, or ForStatement.
	*
	* @param kind A kind string.
	*   If the new context is LogicalExpression's or AssignmentExpression's,
	*   this is `"&&"` or `"||"` or `"??"`.
	*   If it's IfStatement's or ConditionalExpression's, this is `"test"`.
	*   Otherwise, this is `"loop"`.
	* @param isForkingAsResult A flag that shows that goes different
	*   paths between `true` and `false`.
	*/
	pushChoiceContext(kind, isForkingAsResult) {
		this.choiceContext = {
			upper: this.choiceContext,
			kind,
			isForkingAsResult,
			trueForkContext: ForkContext.newEmpty(this.forkContext),
			falseForkContext: ForkContext.newEmpty(this.forkContext),
			qqForkContext: ForkContext.newEmpty(this.forkContext),
			processed: false
		};
	}
	/**
	* Pops the last choice context and finalizes it.
	*/
	popChoiceContext() {
		const context = this.choiceContext;
		this.choiceContext = context.upper;
		const forkContext = this.forkContext;
		const headSegments = forkContext.head;
		switch (context.kind) {
			case "&&":
			case "||":
			case "??":
				if (!context.processed) {
					context.trueForkContext.add(headSegments);
					context.falseForkContext.add(headSegments);
					context.qqForkContext.add(headSegments);
				}
				if (context.isForkingAsResult) {
					const parentContext = this.choiceContext;
					parentContext.trueForkContext.addAll(context.trueForkContext);
					parentContext.falseForkContext.addAll(context.falseForkContext);
					parentContext.qqForkContext.addAll(context.qqForkContext);
					parentContext.processed = true;
					return context;
				}
				break;
			case "test":
				if (!context.processed) {
					context.trueForkContext.clear();
					context.trueForkContext.add(headSegments);
				} else {
					context.falseForkContext.clear();
					context.falseForkContext.add(headSegments);
				}
				break;
			case "loop": return context;
			default: throw new Error("unreachable");
		}
		const prevForkContext = context.trueForkContext;
		prevForkContext.addAll(context.falseForkContext);
		forkContext.replaceHead(prevForkContext.makeNext(0, -1));
		return context;
	}
	/**
	* Makes a code path segment of the right-hand operand of a logical
	* expression.
	*/
	makeLogicalRight() {
		const context = this.choiceContext;
		const forkContext = this.forkContext;
		if (context.processed) {
			let prevForkContext;
			switch (context.kind) {
				case "&&":
					prevForkContext = context.trueForkContext;
					break;
				case "||":
					prevForkContext = context.falseForkContext;
					break;
				case "??":
					prevForkContext = context.qqForkContext;
					break;
				default: throw new Error("unreachable");
			}
			forkContext.replaceHead(prevForkContext.makeNext(0, -1));
			prevForkContext.clear();
			context.processed = false;
		} else {
			switch (context.kind) {
				case "&&":
					context.falseForkContext.add(forkContext.head);
					break;
				case "||":
					context.trueForkContext.add(forkContext.head);
					break;
				case "??":
					context.trueForkContext.add(forkContext.head);
					context.falseForkContext.add(forkContext.head);
					break;
				default: throw new Error("unreachable");
			}
			forkContext.replaceHead(forkContext.makeNext(-1, -1));
		}
	}
	/**
	* Makes a code path segment of the `if` block.
	*/
	makeIfConsequent() {
		const context = this.choiceContext;
		const forkContext = this.forkContext;
		if (!context.processed) {
			context.trueForkContext.add(forkContext.head);
			context.falseForkContext.add(forkContext.head);
			context.qqForkContext.add(forkContext.head);
		}
		context.processed = false;
		forkContext.replaceHead(context.trueForkContext.makeNext(0, -1));
	}
	/**
	* Makes a code path segment of the `else` block.
	*/
	makeIfAlternate() {
		const context = this.choiceContext;
		const forkContext = this.forkContext;
		context.trueForkContext.clear();
		context.trueForkContext.add(forkContext.head);
		context.processed = true;
		forkContext.replaceHead(context.falseForkContext.makeNext(0, -1));
	}
	/**
	* Push a new `ChainExpression` context to the stack.
	* This method is called on entering to each `ChainExpression` node.
	* This context is used to count forking in the optional chain then merge
	* them on exiting from the `ChainExpression` node.
	*/
	pushChainContext() {
		this.chainContext = {
			upper: this.chainContext,
			countChoiceContexts: 0
		};
	}
	/**
	* Pop a `ChainExpression` context from the stack.
	* This method is called on exiting from each `ChainExpression` node.
	* This merges all forks of the last optional chaining.
	*/
	popChainContext() {
		const context = this.chainContext;
		this.chainContext = context.upper;
		for (let i = context.countChoiceContexts; i > 0; --i) this.popChoiceContext();
	}
	/**
	* Create a choice context for optional access.
	* This method is called on entering to each `(Call|Member)Expression[optional=true]` node.
	* This creates a choice context as similar to `LogicalExpression[operator="??"]` node.
	*/
	makeOptionalNode() {
		if (this.chainContext) {
			this.chainContext.countChoiceContexts += 1;
			this.pushChoiceContext("??", false);
		}
	}
	/**
	* Create a fork.
	* This method is called on entering to the `arguments|property` property
	* of each `(Call|Member)Expression` node.
	*/
	makeOptionalRight() {
		if (this.chainContext) this.makeLogicalRight();
	}
	/**
	* Creates a context object of SwitchStatement and stacks it.
	*/
	pushSwitchContext(hasCase, label) {
		this.switchContext = {
			upper: this.switchContext,
			hasCase,
			defaultSegments: null,
			defaultBodySegments: null,
			foundDefault: false,
			lastIsDefault: false,
			countForks: 0
		};
		this.pushBreakContext(true, label);
	}
	/**
	* Pops the last context of SwitchStatement and finalizes it.
	*
	* - Disposes all forking stack for `case` and `default`.
	* - Creates the next code path segment from `context.brokenForkContext`.
	* - If the last `SwitchCase` node is not a `default` part, creates a path
	*   to the `default` body.
	*/
	popSwitchContext() {
		const context = this.switchContext;
		this.switchContext = context.upper;
		const forkContext = this.forkContext;
		const brokenForkContext = this.popBreakContext().brokenForkContext;
		if (context.countForks === 0) {
			if (!brokenForkContext.empty) {
				brokenForkContext.add(forkContext.makeNext(-1, -1));
				forkContext.replaceHead(brokenForkContext.makeNext(0, -1));
			}
			return;
		}
		const lastSegments = forkContext.head;
		this.forkBypassPath();
		const lastCaseSegments = forkContext.head;
		brokenForkContext.add(lastSegments);
		if (!context.lastIsDefault) if (context.defaultBodySegments) {
			removeConnection(context.defaultSegments, context.defaultBodySegments);
			makeLooped(this, lastCaseSegments, context.defaultBodySegments);
		} else brokenForkContext.add(lastCaseSegments);
		for (let i = 0; i < context.countForks; ++i) this.forkContext = this.forkContext.upper;
		this.forkContext.replaceHead(brokenForkContext.makeNext(0, -1));
	}
	/**
	* Makes a code path segment for a `SwitchCase` node.
	*/
	makeSwitchCaseBody(isEmpty, isDefault) {
		const context = this.switchContext;
		if (!context.hasCase) return;
		const parentForkContext = this.forkContext;
		const forkContext = this.pushForkContext();
		forkContext.add(parentForkContext.makeNext(0, -1));
		if (isDefault) {
			context.defaultSegments = parentForkContext.head;
			if (isEmpty) context.foundDefault = true;
			else context.defaultBodySegments = forkContext.head;
		} else if (!isEmpty && context.foundDefault) {
			context.foundDefault = false;
			context.defaultBodySegments = forkContext.head;
		}
		context.lastIsDefault = isDefault;
		context.countForks += 1;
	}
	/**
	* Creates a context object of TryStatement and stacks it.
	*/
	pushTryContext(hasFinalizer) {
		this.tryContext = {
			upper: this.tryContext,
			position: "try",
			hasFinalizer,
			returnedForkContext: hasFinalizer ? ForkContext.newEmpty(this.forkContext) : null,
			thrownForkContext: ForkContext.newEmpty(this.forkContext),
			lastOfTryIsReachable: false,
			lastOfCatchIsReachable: false
		};
	}
	/**
	* Pops the last context of TryStatement and finalizes it.
	*/
	popTryContext() {
		const context = this.tryContext;
		this.tryContext = context.upper;
		if (context.position === "catch") {
			this.popForkContext();
			return;
		}
		const returned = context.returnedForkContext;
		const thrown = context.thrownForkContext;
		if ((returned == null || returned.empty) && thrown.empty) return;
		const headSegments = this.forkContext.head;
		this.forkContext = this.forkContext.upper;
		const normalSegments = headSegments.slice(0, headSegments.length / 2 | 0);
		const leavingSegments = headSegments.slice(headSegments.length / 2 | 0);
		if (returned && !returned.empty) getReturnContext(this).returnedForkContext.add(leavingSegments);
		if (!thrown.empty) getThrowContext(this).thrownForkContext.add(leavingSegments);
		this.forkContext.replaceHead(normalSegments);
		if (!context.lastOfTryIsReachable && !context.lastOfCatchIsReachable) this.forkContext.makeUnreachable(-1, -1);
	}
	/**
	* Makes a code path segment for a `catch` block.
	*/
	makeCatchBlock() {
		const context = this.tryContext;
		const forkContext = this.forkContext;
		const thrown = context.thrownForkContext;
		context.position = "catch";
		context.thrownForkContext = ForkContext.newEmpty(forkContext);
		context.lastOfTryIsReachable = forkContext.reachable;
		thrown.add(forkContext.head);
		const thrownSegments = thrown.makeNext(0, -1);
		this.pushForkContext();
		this.forkBypassPath();
		this.forkContext.add(thrownSegments);
	}
	/**
	* Makes a code path segment for a `finally` block.
	*
	* In the `finally` block, parallel paths are created. The parallel paths
	* are used as leaving-paths. The leaving-paths are paths from `return`
	* statements and `throw` statements in a `try` block or a `catch` block.
	*/
	makeFinallyBlock() {
		const context = this.tryContext;
		let forkContext = this.forkContext;
		const returned = context.returnedForkContext;
		const thrown = context.thrownForkContext;
		const headOfLeavingSegments = forkContext.head;
		if (context.position === "catch") {
			this.popForkContext();
			forkContext = this.forkContext;
			context.lastOfCatchIsReachable = forkContext.reachable;
		} else context.lastOfTryIsReachable = forkContext.reachable;
		context.position = "finally";
		if (returned.empty && thrown.empty) return;
		const segments = forkContext.makeNext(-1, -1);
		for (let i = 0; i < forkContext.count; ++i) {
			const prevSegsOfLeavingSegment = [headOfLeavingSegments[i]];
			for (let j = 0; j < returned.segmentsList.length; ++j) prevSegsOfLeavingSegment.push(returned.segmentsList[j][i]);
			for (let j = 0; j < thrown.segmentsList.length; ++j) prevSegsOfLeavingSegment.push(thrown.segmentsList[j][i]);
			segments.push(CodePathSegment.newNext(this.idGenerator.next(), prevSegsOfLeavingSegment));
		}
		this.pushForkContext(true);
		this.forkContext.add(segments);
	}
	/**
	* Makes a code path segment from the first throwable node to the `catch`
	* block or the `finally` block.
	*/
	makeFirstThrowablePathInTryBlock() {
		const forkContext = this.forkContext;
		if (!forkContext.reachable) return;
		const context = getThrowContext(this);
		if (context === this || context.position !== "try" || !context.thrownForkContext.empty) return;
		context.thrownForkContext.add(forkContext.head);
		forkContext.replaceHead(forkContext.makeNext(-1, -1));
	}
	/**
	* Creates a context object of a loop statement and stacks it.
	*/
	pushLoopContext(type, label) {
		const forkContext = this.forkContext;
		const breakContext = this.pushBreakContext(true, label);
		switch (type) {
			case "WhileStatement":
				this.pushChoiceContext("loop", false);
				this.loopContext = {
					upper: this.loopContext,
					type: "WhileStatement",
					label,
					test: void 0,
					continueDestSegments: null,
					brokenForkContext: breakContext.brokenForkContext
				};
				break;
			case "DoWhileStatement":
				this.pushChoiceContext("loop", false);
				this.loopContext = {
					upper: this.loopContext,
					type: "DoWhileStatement",
					label,
					test: void 0,
					entrySegments: null,
					continueForkContext: ForkContext.newEmpty(forkContext),
					brokenForkContext: breakContext.brokenForkContext
				};
				break;
			case "ForStatement":
				this.pushChoiceContext("loop", false);
				this.loopContext = {
					upper: this.loopContext,
					type: "ForStatement",
					label,
					test: void 0,
					endOfInitSegments: null,
					testSegments: null,
					endOfTestSegments: null,
					updateSegments: null,
					endOfUpdateSegments: null,
					continueDestSegments: null,
					brokenForkContext: breakContext.brokenForkContext
				};
				break;
			case "ForInStatement":
			case "ForOfStatement":
				this.loopContext = {
					upper: this.loopContext,
					type,
					label,
					prevSegments: null,
					leftSegments: null,
					endOfLeftSegments: null,
					continueDestSegments: null,
					brokenForkContext: breakContext.brokenForkContext
				};
				break;
			default: throw new Error(`unknown type: "${type}"`);
		}
	}
	/**
	* Pops the last context of a loop statement and finalizes it.
	*/
	popLoopContext() {
		const context = this.loopContext;
		this.loopContext = context.upper;
		const forkContext = this.forkContext;
		const brokenForkContext = this.popBreakContext().brokenForkContext;
		switch (context.type) {
			case "WhileStatement":
			case "ForStatement":
				this.popChoiceContext();
				makeLooped(this, forkContext.head, context.continueDestSegments);
				break;
			case "DoWhileStatement": {
				const choiceContext = this.popChoiceContext();
				if (!choiceContext.processed) {
					choiceContext.trueForkContext.add(forkContext.head);
					choiceContext.falseForkContext.add(forkContext.head);
				}
				if (context.test !== true) brokenForkContext.addAll(choiceContext.falseForkContext);
				const segmentsList = choiceContext.trueForkContext.segmentsList;
				for (let i = 0; i < segmentsList.length; ++i) makeLooped(this, segmentsList[i], context.entrySegments);
				break;
			}
			case "ForInStatement":
			case "ForOfStatement":
				brokenForkContext.add(forkContext.head);
				makeLooped(this, forkContext.head, context.leftSegments);
				break;
			default: throw new Error("unreachable");
		}
		if (brokenForkContext.empty) forkContext.replaceHead(forkContext.makeUnreachable(-1, -1));
		else forkContext.replaceHead(brokenForkContext.makeNext(0, -1));
	}
	/**
	* Makes a code path segment for the test part of a WhileStatement.
	*/
	makeWhileTest(test) {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const testSegments = forkContext.makeNext(0, -1);
		context.test = test;
		context.continueDestSegments = testSegments;
		forkContext.replaceHead(testSegments);
	}
	/**
	* Makes a code path segment for the body part of a WhileStatement.
	*/
	makeWhileBody() {
		const context = this.loopContext;
		const choiceContext = this.choiceContext;
		const forkContext = this.forkContext;
		if (!choiceContext.processed) {
			choiceContext.trueForkContext.add(forkContext.head);
			choiceContext.falseForkContext.add(forkContext.head);
		}
		if (context.test !== true) context.brokenForkContext.addAll(choiceContext.falseForkContext);
		forkContext.replaceHead(choiceContext.trueForkContext.makeNext(0, -1));
	}
	/**
	* Makes a code path segment for the body part of a DoWhileStatement.
	*/
	makeDoWhileBody() {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const bodySegments = forkContext.makeNext(-1, -1);
		context.entrySegments = bodySegments;
		forkContext.replaceHead(bodySegments);
	}
	/**
	* Makes a code path segment for the test part of a DoWhileStatement.
	*/
	makeDoWhileTest(test) {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		context.test = test;
		if (!context.continueForkContext.empty) {
			context.continueForkContext.add(forkContext.head);
			const testSegments = context.continueForkContext.makeNext(0, -1);
			forkContext.replaceHead(testSegments);
		}
	}
	/**
	* Makes a code path segment for the test part of a ForStatement.
	*/
	makeForTest(test) {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const endOfInitSegments = forkContext.head;
		const testSegments = forkContext.makeNext(-1, -1);
		context.test = test;
		context.endOfInitSegments = endOfInitSegments;
		context.continueDestSegments = context.testSegments = testSegments;
		forkContext.replaceHead(testSegments);
	}
	/**
	* Makes a code path segment for the update part of a ForStatement.
	*/
	makeForUpdate() {
		const context = this.loopContext;
		const choiceContext = this.choiceContext;
		const forkContext = this.forkContext;
		if (context.testSegments) finalizeTestSegmentsOfFor(context, choiceContext, forkContext.head);
		else context.endOfInitSegments = forkContext.head;
		const updateSegments = forkContext.makeDisconnected(-1, -1);
		context.continueDestSegments = context.updateSegments = updateSegments;
		forkContext.replaceHead(updateSegments);
	}
	/**
	* Makes a code path segment for the body part of a ForStatement.
	*/
	makeForBody() {
		const context = this.loopContext;
		const choiceContext = this.choiceContext;
		const forkContext = this.forkContext;
		if (context.updateSegments) {
			context.endOfUpdateSegments = forkContext.head;
			if (context.testSegments) makeLooped(this, context.endOfUpdateSegments, context.testSegments);
		} else if (context.testSegments) finalizeTestSegmentsOfFor(context, choiceContext, forkContext.head);
		else context.endOfInitSegments = forkContext.head;
		let bodySegments = context.endOfTestSegments;
		if (!bodySegments) {
			const prevForkContext = ForkContext.newEmpty(forkContext);
			prevForkContext.add(context.endOfInitSegments);
			if (context.endOfUpdateSegments) prevForkContext.add(context.endOfUpdateSegments);
			bodySegments = prevForkContext.makeNext(0, -1);
		}
		context.continueDestSegments = context.continueDestSegments || bodySegments;
		forkContext.replaceHead(bodySegments);
	}
	/**
	* Makes a code path segment for the left part of a ForInStatement and a
	* ForOfStatement.
	*/
	makeForInOfLeft() {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const leftSegments = forkContext.makeDisconnected(-1, -1);
		context.prevSegments = forkContext.head;
		context.leftSegments = context.continueDestSegments = leftSegments;
		forkContext.replaceHead(leftSegments);
	}
	/**
	* Makes a code path segment for the right part of a ForInStatement and a
	* ForOfStatement.
	*/
	makeForInOfRight() {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const temp = ForkContext.newEmpty(forkContext);
		temp.add(context.prevSegments);
		const rightSegments = temp.makeNext(-1, -1);
		context.endOfLeftSegments = forkContext.head;
		forkContext.replaceHead(rightSegments);
	}
	/**
	* Makes a code path segment for the body part of a ForInStatement and a
	* ForOfStatement.
	*/
	makeForInOfBody() {
		const context = this.loopContext;
		const forkContext = this.forkContext;
		const temp = ForkContext.newEmpty(forkContext);
		temp.add(context.endOfLeftSegments);
		const bodySegments = temp.makeNext(-1, -1);
		makeLooped(this, forkContext.head, context.leftSegments);
		context.brokenForkContext.add(forkContext.head);
		forkContext.replaceHead(bodySegments);
	}
	/**
	* Creates new context for BreakStatement.
	*/
	pushBreakContext(breakable, label) {
		this.breakContext = {
			upper: this.breakContext,
			breakable,
			label,
			brokenForkContext: ForkContext.newEmpty(this.forkContext)
		};
		return this.breakContext;
	}
	/**
	* Removes the top item of the break context stack.
	*/
	popBreakContext() {
		const context = this.breakContext;
		const forkContext = this.forkContext;
		this.breakContext = context.upper;
		if (!context.breakable) {
			const brokenForkContext = context.brokenForkContext;
			if (!brokenForkContext.empty) {
				brokenForkContext.add(forkContext.head);
				forkContext.replaceHead(brokenForkContext.makeNext(0, -1));
			}
		}
		return context;
	}
	/**
	* Makes a path for a `break` statement.
	*
	* It registers the head segment to a context of `break`.
	* It makes new unreachable segment, then it set the head with the segment.
	*/
	makeBreak(label) {
		const forkContext = this.forkContext;
		if (!forkContext.reachable) return;
		const context = getBreakContext(this, label);
		if (context) context.brokenForkContext.add(forkContext.head);
		/* c8 ignore next */
		forkContext.replaceHead(forkContext.makeUnreachable(-1, -1));
	}
	/**
	* Makes a path for a `continue` statement.
	*
	* It makes a looping path.
	* It makes new unreachable segment, then it set the head with the segment.
	*/
	makeContinue(label) {
		const forkContext = this.forkContext;
		if (!forkContext.reachable) return;
		const context = getContinueContext(this, label);
		if (context) if (context.continueDestSegments != null) {
			makeLooped(this, forkContext.head, context.continueDestSegments);
			if (context.type === "ForInStatement" || context.type === "ForOfStatement") context.brokenForkContext.add(forkContext.head);
		} else context.continueForkContext.add(forkContext.head);
		forkContext.replaceHead(forkContext.makeUnreachable(-1, -1));
	}
	/**
	* Makes a path for a `return` statement.
	*
	* It registers the head segment to a context of `return`.
	* It makes new unreachable segment, then it set the head with the segment.
	*/
	makeReturn() {
		const forkContext = this.forkContext;
		if (forkContext.reachable) {
			getReturnContext(this).returnedForkContext.add(forkContext.head);
			forkContext.replaceHead(forkContext.makeUnreachable(-1, -1));
		}
	}
	/**
	* Makes a path for a `throw` statement.
	*
	* It registers the head segment to a context of `throw`.
	* It makes new unreachable segment, then it set the head with the segment.
	*/
	makeThrow() {
		const forkContext = this.forkContext;
		if (forkContext.reachable) {
			getThrowContext(this).thrownForkContext.add(forkContext.head);
			forkContext.replaceHead(forkContext.makeUnreachable(-1, -1));
		}
	}
	/**
	* Makes the final path.
	*/
	makeFinal() {
		const segments = this.currentSegments;
		if (segments.length > 0 && segments[0].reachable) this.returnedForkContext.add(segments);
	}
};
/**
* A generator for unique ids.
*/
var IdGenerator = class {
	prefix;
	n;
	constructor(prefix) {
		this.prefix = String(prefix);
		this.n = 0;
	}
	/**
	* Generates id.
	*/
	next() {
		this.n = 1 + this.n | 0;
		/* c8 ignore start */
		if (this.n < 0) this.n = 1;
		return this.prefix + this.n;
	}
};
/**
* A code path.
*/
var CodePath = class {
	/** The identifier of this code path. */
	id;
	/**
	* The reason that this code path was started. May be "program",
	* "function", "class-field-initializer", or "class-static-block".
	*/
	origin;
	/** The code path of the upper function scope. */
	upper;
	/** The code paths of nested function scopes. */
	childCodePaths;
	/** Internal state for the code path. */
	internal;
	constructor({ id, origin, upper, onLooped }) {
		this.id = id;
		this.origin = origin;
		this.upper = upper;
		this.childCodePaths = [];
		this.internal = new CodePathState(new IdGenerator(`${id}_`), onLooped);
		if (upper) upper.childCodePaths.push(this);
	}
	/**
	* Gets the state of a given code path.
	*/
	static getState(codePath) {
		return codePath.internal;
	}
	/** The initial code path segment. */
	get initialSegment() {
		return this.internal.initialSegment;
	}
	/**
	* Final code path segments.
	* This array is a mix of `returnedSegments` and `thrownSegments`.
	*/
	get finalSegments() {
		return this.internal.finalSegments;
	}
	/**
	* Final code path segments which is with `return` statements.
	* This array contains the last path segment if it's reachable.
	* Since the reachable last path returns `undefined`.
	*/
	get returnedSegments() {
		return this.internal.returnedForkContext;
	}
	/** Final code path segments which is with `throw` statements. */
	get thrownSegments() {
		return this.internal.thrownForkContext;
	}
	/** Current code path segments. */
	get currentSegments() {
		return this.internal.currentSegments;
	}
	/**
	* Traverses all segments in this code path.
	*
	* This method enumerates segments in order from the head.
	*
	* The `controller` object has two methods:
	* - `controller.skip()` - Skip the following segments in this branch.
	* - `controller.break()` - Skip all following segments.
	*/
	traverseSegments(options, callback) {
		let resolvedOptions;
		let resolvedCallback;
		if (typeof options === "function") {
			resolvedCallback = options;
			resolvedOptions = {};
		} else {
			resolvedOptions = options || {};
			resolvedCallback = callback;
		}
		const startSegment = resolvedOptions.first || this.internal.initialSegment;
		const lastSegment = resolvedOptions.last;
		let item = null;
		let index = 0;
		let end = 0;
		let segment = null;
		const visited = Object.create(null);
		const stack = [[startSegment, 0]];
		let skippedSegment = null;
		let broken = false;
		const controller = {
			skip() {
				if (stack.length <= 1) broken = true;
				else skippedSegment = stack[stack.length - 2][0];
			},
			break() {
				broken = true;
			}
		};
		function isVisited(prevSegment) {
			return visited[prevSegment.id] || segment.isLoopedPrevSegment(prevSegment);
		}
		while (stack.length > 0) {
			item = stack[stack.length - 1];
			segment = item[0];
			index = item[1];
			if (index === 0) {
				if (visited[segment.id]) {
					stack.pop();
					continue;
				}
				if (segment !== startSegment && segment.prevSegments.length > 0 && !segment.prevSegments.every(isVisited)) {
					stack.pop();
					continue;
				}
				if (skippedSegment && segment.prevSegments.includes(skippedSegment)) skippedSegment = null;
				visited[segment.id] = true;
				if (!skippedSegment) {
					resolvedCallback.call(this, segment, controller);
					if (segment === lastSegment) controller.skip();
					if (broken) break;
				}
			}
			end = segment.nextSegments.length - 1;
			if (index < end) {
				item[1] += 1;
				stack.push([segment.nextSegments[index], 0]);
			} else if (index === end) {
				item[0] = segment.nextSegments[index];
				item[1] = 0;
			} else stack.pop();
		}
	}
};
const breakableTypePattern = /^(?:(?:Do)?While|For(?:In|Of)?|Switch)Statement$/u;
/**
* Checks whether or not a given node is a `case` node (not `default` node).
*/
function isCaseNode(node) {
	return Boolean(node.test);
}
/**
* Checks if a given node appears as the value of a PropertyDefinition node.
*/
function isPropertyDefinitionValue(node) {
	const parent = node.parent;
	return parent && parent.type === "PropertyDefinition" && parent.value === node;
}
/**
* Checks whether the given logical operator is taken into account for the code
* path analysis.
*/
function isHandledLogicalOperator(operator) {
	return operator === "&&" || operator === "||" || operator === "??";
}
/**
* Checks whether the given assignment operator is a logical assignment operator.
* Logical assignments are taken into account for the code path analysis
* because of their short-circuiting semantics.
*/
function isLogicalAssignmentOperator(operator) {
	return operator === "&&=" || operator === "||=" || operator === "??=";
}
/**
* Gets the label if the parent node of a given node is a LabeledStatement.
*/
function getLabel(node) {
	if (node.parent.type === "LabeledStatement") return node.parent.label.name;
	return null;
}
/**
* Checks whether or not a given logical expression node goes different path
* between the `true` case and the `false` case.
*/
function isForkingByTrueOrFalse(node) {
	const parent = node.parent;
	switch (parent.type) {
		case "ConditionalExpression":
		case "IfStatement":
		case "WhileStatement":
		case "DoWhileStatement":
		case "ForStatement": return parent.test === node;
		case "LogicalExpression": return isHandledLogicalOperator(parent.operator);
		case "AssignmentExpression": return isLogicalAssignmentOperator(parent.operator);
		default: return false;
	}
}
/**
* Gets the boolean value of a given literal node.
*
* This is used to detect infinity loops (ex: `while (true) {}`).
* Statements preceded by an infinity loop are unreachable if the loop didn't
* have any `break` statement.
*/
function getBooleanValueIfSimpleConstant(node) {
	if (node.type === "Literal") return Boolean(node.value);
}
/**
* Checks that a given identifier node is a reference or not.
*
* This is used to detect the first throwable node in a `try` block.
*/
function isIdentifierReference(node) {
	const parent = node.parent;
	switch (parent.type) {
		case "LabeledStatement":
		case "BreakStatement":
		case "ContinueStatement":
		case "ArrayPattern":
		case "RestElement":
		case "ImportSpecifier":
		case "ImportDefaultSpecifier":
		case "ImportNamespaceSpecifier":
		case "CatchClause": return false;
		case "FunctionDeclaration":
		case "ComponentDeclaration":
		case "HookDeclaration":
		case "FunctionExpression":
		case "ArrowFunctionExpression":
		case "ClassDeclaration":
		case "ClassExpression":
		case "VariableDeclarator": return parent.id !== node;
		case "Property":
		case "PropertyDefinition":
		case "MethodDefinition": return parent.key !== node || parent.computed || parent.shorthand;
		case "AssignmentPattern": return parent.key !== node;
		default: return true;
	}
}
/**
* Updates the current segment with the head segment.
* This is similar to local branches and tracking branches of git.
*
* To separate the current and the head is in order to not make useless segments.
*
* In this process, both "onCodePathSegmentStart" and "onCodePathSegmentEnd"
* events are fired.
*/
function forwardCurrentToHead(analyzer, node) {
	const codePath = analyzer.codePath;
	const state = CodePath.getState(codePath);
	const currentSegments = state.currentSegments;
	const headSegments = state.headSegments;
	const end = Math.max(currentSegments.length, headSegments.length);
	let i;
	let currentSegment;
	let headSegment;
	for (i = 0; i < end; ++i) {
		currentSegment = currentSegments[i];
		headSegment = headSegments[i];
		if (currentSegment !== headSegment && currentSegment) {
			if (currentSegment.reachable) analyzer.emitter.emit("onCodePathSegmentEnd", currentSegment, node);
		}
	}
	state.currentSegments = headSegments;
	for (i = 0; i < end; ++i) {
		currentSegment = currentSegments[i];
		headSegment = headSegments[i];
		if (currentSegment !== headSegment && headSegment) {
			CodePathSegment.markUsed(headSegment);
			if (headSegment.reachable) analyzer.emitter.emit("onCodePathSegmentStart", headSegment, node);
		}
	}
}
/**
* Updates the current segment with empty.
* This is called at the last of functions or the program.
*/
function leaveFromCurrentSegment(analyzer, node) {
	const state = CodePath.getState(analyzer.codePath);
	const currentSegments = state.currentSegments;
	for (let i = 0; i < currentSegments.length; ++i) {
		const currentSegment = currentSegments[i];
		if (currentSegment.reachable) analyzer.emitter.emit("onCodePathSegmentEnd", currentSegment, node);
	}
	state.currentSegments = [];
}
/**
* Updates the code path due to the position of a given node in the parent node
* thereof.
*
* For example, if the node is `parent.consequent`, this creates a fork from the
* current path.
*/
function preprocess(analyzer, node) {
	const codePath = analyzer.codePath;
	const state = CodePath.getState(codePath);
	const parent = node.parent;
	switch (parent.type) {
		case "CallExpression":
			if (parent.optional === true && parent.arguments.length >= 1 && parent.arguments[0] === node) state.makeOptionalRight();
			break;
		case "MemberExpression":
			if (parent.optional === true && parent.property === node) state.makeOptionalRight();
			break;
		case "LogicalExpression":
			if (parent.right === node && isHandledLogicalOperator(parent.operator)) state.makeLogicalRight();
			break;
		case "AssignmentExpression":
			if (parent.right === node && isLogicalAssignmentOperator(parent.operator)) state.makeLogicalRight();
			break;
		case "ConditionalExpression":
		case "IfStatement":
			if (parent.consequent === node) state.makeIfConsequent();
			else if (parent.alternate === node) state.makeIfAlternate();
			break;
		case "SwitchCase":
			if (parent.consequent[0] === node) state.makeSwitchCaseBody(false, !parent.test);
			break;
		case "TryStatement":
			if (parent.handler === node) state.makeCatchBlock();
			else if (parent.finalizer === node) state.makeFinallyBlock();
			break;
		case "WhileStatement":
			if (parent.test === node) state.makeWhileTest(getBooleanValueIfSimpleConstant(node));
			else {
				assert(parent.body === node);
				state.makeWhileBody();
			}
			break;
		case "DoWhileStatement":
			if (parent.body === node) state.makeDoWhileBody();
			else {
				assert(parent.test === node);
				state.makeDoWhileTest(getBooleanValueIfSimpleConstant(node));
			}
			break;
		case "ForStatement":
			if (parent.test === node) state.makeForTest(getBooleanValueIfSimpleConstant(node));
			else if (parent.update === node) state.makeForUpdate();
			else if (parent.body === node) state.makeForBody();
			break;
		case "ForInStatement":
		case "ForOfStatement":
			if (parent.left === node) state.makeForInOfLeft();
			else if (parent.right === node) state.makeForInOfRight();
			else {
				assert(parent.body === node);
				state.makeForInOfBody();
			}
			break;
		case "AssignmentPattern":
			if (parent.right === node) {
				state.pushForkContext();
				state.forkBypassPath();
				state.forkPath();
			}
			break;
		default: break;
	}
}
/**
* Updates the code path due to the type of a given node in entering.
*/
function processCodePathToEnter(analyzer, node) {
	let codePath = analyzer.codePath;
	let state = codePath && CodePath.getState(codePath);
	const parent = node.parent;
	/**
	* Creates a new code path and trigger the onCodePathStart event
	* based on the currently selected node.
	*/
	function startCodePath(origin) {
		if (codePath) forwardCurrentToHead(analyzer, node);
		codePath = analyzer.codePath = new CodePath({
			id: analyzer.idGenerator.next(),
			origin,
			upper: codePath,
			onLooped: analyzer.onLooped
		});
		state = CodePath.getState(codePath);
		analyzer.emitter.emit("onCodePathStart", codePath, node);
	}
	if (isPropertyDefinitionValue(node)) startCodePath("class-field-initializer");
	switch (node.type) {
		case "Program":
			startCodePath("program");
			break;
		case "FunctionDeclaration":
		case "ComponentDeclaration":
		case "HookDeclaration":
		case "FunctionExpression":
		case "ArrowFunctionExpression":
			startCodePath("function");
			break;
		case "StaticBlock":
			startCodePath("class-static-block");
			break;
		case "ChainExpression":
			state.pushChainContext();
			break;
		case "CallExpression":
			if (node.optional === true) state.makeOptionalNode();
			break;
		case "MemberExpression":
			if (node.optional === true) state.makeOptionalNode();
			break;
		case "LogicalExpression":
			if (isHandledLogicalOperator(node.operator)) state.pushChoiceContext(node.operator, isForkingByTrueOrFalse(node));
			break;
		case "AssignmentExpression":
			if (isLogicalAssignmentOperator(node.operator)) state.pushChoiceContext(node.operator.slice(0, -1), isForkingByTrueOrFalse(node));
			break;
		case "ConditionalExpression":
		case "IfStatement":
			state.pushChoiceContext("test", false);
			break;
		case "SwitchStatement":
			state.pushSwitchContext(node.cases.some(isCaseNode), getLabel(node));
			break;
		case "TryStatement":
			state.pushTryContext(Boolean(node.finalizer));
			break;
		case "SwitchCase":
			if (parent.discriminant !== node && parent.cases[0] !== node) state.forkPath();
			break;
		case "WhileStatement":
		case "DoWhileStatement":
		case "ForStatement":
		case "ForInStatement":
		case "ForOfStatement":
			state.pushLoopContext(node.type, getLabel(node));
			break;
		case "LabeledStatement":
			if (!breakableTypePattern.test(node.body.type)) state.pushBreakContext(false, node.label.name);
			break;
		default: break;
	}
	forwardCurrentToHead(analyzer, node);
}
/**
* Updates the code path due to the type of a given node in leaving.
*/
function processCodePathToExit(analyzer, node) {
	const codePath = analyzer.codePath;
	const state = CodePath.getState(codePath);
	let dontForward = false;
	switch (node.type) {
		case "ChainExpression":
			state.popChainContext();
			break;
		case "IfStatement":
		case "ConditionalExpression":
			state.popChoiceContext();
			break;
		case "LogicalExpression":
			if (isHandledLogicalOperator(node.operator)) state.popChoiceContext();
			break;
		case "AssignmentExpression":
			if (isLogicalAssignmentOperator(node.operator)) state.popChoiceContext();
			break;
		case "SwitchStatement":
			state.popSwitchContext();
			break;
		case "SwitchCase":
			if (node.consequent.length === 0) state.makeSwitchCaseBody(true, !node.test);
			if (state.forkContext.reachable) dontForward = true;
			break;
		case "TryStatement":
			state.popTryContext();
			break;
		case "BreakStatement":
			forwardCurrentToHead(analyzer, node);
			state.makeBreak(node.label && node.label.name);
			dontForward = true;
			break;
		case "ContinueStatement":
			forwardCurrentToHead(analyzer, node);
			state.makeContinue(node.label && node.label.name);
			dontForward = true;
			break;
		case "ReturnStatement":
			forwardCurrentToHead(analyzer, node);
			state.makeReturn();
			dontForward = true;
			break;
		case "ThrowStatement":
			forwardCurrentToHead(analyzer, node);
			state.makeThrow();
			dontForward = true;
			break;
		case "Identifier":
			if (isIdentifierReference(node)) {
				state.makeFirstThrowablePathInTryBlock();
				dontForward = true;
			}
			break;
		case "CallExpression":
		case "ImportExpression":
		case "MemberExpression":
		case "NewExpression":
		case "YieldExpression":
			state.makeFirstThrowablePathInTryBlock();
			break;
		case "WhileStatement":
		case "DoWhileStatement":
		case "ForStatement":
		case "ForInStatement":
		case "ForOfStatement":
			state.popLoopContext();
			break;
		case "AssignmentPattern":
			state.popForkContext();
			break;
		case "LabeledStatement":
			if (!breakableTypePattern.test(node.body.type)) state.popBreakContext();
			break;
		default: break;
	}
	if (!dontForward) forwardCurrentToHead(analyzer, node);
}
/**
* Updates the code path to finalize the current code path.
*/
function postprocess(analyzer, node) {
	function endCodePath() {
		const codePath = analyzer.codePath;
		CodePath.getState(codePath).makeFinal();
		leaveFromCurrentSegment(analyzer, node);
		analyzer.emitter.emit("onCodePathEnd", codePath, node);
		analyzer.codePath = analyzer.codePath.upper;
	}
	switch (node.type) {
		case "Program":
		case "FunctionDeclaration":
		case "ComponentDeclaration":
		case "HookDeclaration":
		case "FunctionExpression":
		case "ArrowFunctionExpression":
		case "StaticBlock":
			endCodePath();
			break;
		case "CallExpression":
			if (node.optional === true && node.arguments.length === 0) CodePath.getState(analyzer.codePath).makeOptionalRight();
			break;
		default: break;
	}
	if (isPropertyDefinitionValue(node)) endCodePath();
}
/**
* The class to analyze code paths.
* This class implements the EventGenerator interface.
*/
var CodePathAnalyzer = class {
	emitter;
	codePath;
	idGenerator;
	currentNode;
	onLooped;
	constructor(emitters) {
		this.emitter = { emit(event, ...args) {
			emitters[event]?.(...args);
		} };
		this.codePath = null;
		this.idGenerator = new IdGenerator("s");
		this.currentNode = null;
		this.onLooped = this._onLooped.bind(this);
	}
	/**
	* Does the process to enter a given AST node.
	* This updates state of analysis and calls `enterNode` of the wrapped.
	*/
	enterNode(node) {
		this.currentNode = node;
		if (node.parent) preprocess(this, node);
		processCodePathToEnter(this, node);
		this.currentNode = null;
	}
	/**
	* Does the process to leave a given AST node.
	* This updates state of analysis and calls `leaveNode` of the wrapped.
	*/
	leaveNode(node) {
		this.currentNode = node;
		processCodePathToExit(this, node);
		postprocess(this, node);
		this.currentNode = null;
	}
	/**
	* This is called on a code path looped.
	* Then this raises a looped event.
	*/
	_onLooped(fromSegment, toSegment) {
		if (fromSegment.reachable && toSegment.reachable) this.emitter.emit("onCodePathSegmentLoop", fromSegment, toSegment, this.currentNode);
	}
};

//#endregion
//#region src/rules/rules-of-hooks/rules-of-hooks.ts
/**
* Catch all identifiers that begin with "use" followed by an uppercase Latin
* character to exclude identifiers like "user".
*/
function isHookName(s) {
	return s === "use" || /^use[A-Z0-9]/.test(s);
}
/**
* We consider hooks to be a hook name identifier or a member expression
* containing a hook name.
*/
function isHook(node) {
	if (node.type === "Identifier") return isHookName(node.name);
	else if (node.type === "MemberExpression" && !node.computed && isHook(node.property)) {
		const obj = node.object;
		return obj.type === "Identifier" && /^[A-Z].*/.test(obj.name);
	} else return false;
}
/**
* Checks if the node is a React component name. React component names must
* always start with an uppercase letter.
*/
function isComponentName(node) {
	return node.type === "Identifier" && /^[A-Z]/.test(node.name);
}
function isReactFunction(node, functionName) {
	return "name" in node && node.name === functionName || node.type === "MemberExpression" && "name" in node.object && node.object.name === "React" && "name" in node.property && node.property.name === functionName;
}
/**
* Checks if the node is a callback argument of forwardRef. This render function
* should follow the rules of hooks.
*/
function isForwardRefCallback(node) {
	return !!(node.parent && "callee" in node.parent && node.parent.callee && isReactFunction(node.parent.callee, "forwardRef"));
}
/**
* Checks if the node is a callback argument of React.memo. This anonymous
* functional component should follow the rules of hooks.
*/
function isMemoCallback(node) {
	return !!(node.parent && "callee" in node.parent && node.parent.callee && isReactFunction(node.parent.callee, "memo"));
}
function isInsideComponentOrHook(node) {
	while (node) {
		const functionName = getFunctionName(node);
		if (functionName) {
			if (isComponentName(functionName) || isHook(functionName)) return true;
		}
		if (isForwardRefCallback(node) || isMemoCallback(node)) return true;
		node = node.parent;
	}
	return false;
}
function isInsideDoWhileLoop(node) {
	while (node) {
		if (node.type === "DoWhileStatement") return true;
		node = node.parent;
	}
	return false;
}
function isInsideTryCatch(node) {
	while (node) {
		if (node.type === "TryStatement" || node.type === "CatchClause") return true;
		node = node.parent;
	}
	return false;
}
function getNodeWithoutReactNamespace(node) {
	if (node.type === "MemberExpression" && node.object.type === "Identifier" && node.object.name === "React" && node.property.type === "Identifier" && !node.computed) return node.property;
	return node;
}
function isEffectIdentifier(node, additionalHooks) {
	if (node.type === "Identifier" && (node.name === "useEffect" || node.name === "useLayoutEffect" || node.name === "useInsertionEffect")) return true;
	if (additionalHooks && node.type === "Identifier") return additionalHooks.test(node.name);
	return false;
}
function isUseEffectEventIdentifier(node) {
	return node.type === "Identifier" && node.name === "useEffectEvent";
}
function useEffectEventError(fn, called) {
	if (fn === null) return "React Hook \"useEffectEvent\" can only be called at the top level of your component. It cannot be passed down.";
	return `\`${fn}\` is a function created with React Hook "useEffectEvent", and can only be called from Effects and Effect Events in the same component.` + (called ? "" : " It cannot be assigned to a variable or passed down.");
}
function isUseIdentifier(node) {
	return isReactFunction(node, "use");
}
const rule = {
	meta: {
		type: "problem",
		docs: {
			description: "Enforces the Rules of Hooks.",
			recommended: true,
			url: "https://react.dev/reference/rules/rules-of-hooks"
		},
		schema: [{
			type: "object",
			additionalProperties: false,
			properties: { additionalHooks: { type: "string" } }
		}]
	},
	create(context) {
		context.settings;
		const rawOptions = context.options && context.options[0];
		const additionalEffectHooks = rawOptions && rawOptions.additionalHooks ? new RegExp(rawOptions.additionalHooks) : getSettingsFromContext(context).additionalEffectHooks;
		let lastEffect = null;
		const codePathReactHooksMapStack = [];
		const codePathSegmentStack = [];
		const useEffectEventFunctions = /* @__PURE__ */ new WeakSet();
		function recordAllUseEffectEventFunctions(scope) {
			for (const reference of scope.references) {
				const parent = reference.identifier.parent;
				if (parent?.type === "VariableDeclarator" && parent.init && parent.init.type === "CallExpression" && parent.init.callee && isUseEffectEventIdentifier(parent.init.callee)) {
					if (reference.resolved === null) throw new Error("Unexpected null reference.resolved");
					for (const ref of reference.resolved.references) if (ref !== reference) useEffectEventFunctions.add(ref.identifier);
				}
			}
		}
		/**
		* SourceCode that also works down to ESLint 3.0.0
		*/
		const getSourceCode = typeof context.getSourceCode === "function" ? () => {
			return context.getSourceCode();
		} : () => {
			return context.sourceCode;
		};
		/**
		* SourceCode#getScope that also works down to ESLint 3.0.0
		*/
		const getScope = typeof context.getScope === "function" ? () => {
			return context.getScope();
		} : (node) => {
			return getSourceCode().getScope(node);
		};
		function hasFlowSuppression(node, suppression) {
			const comments = getSourceCode().getAllComments();
			const flowSuppressionRegex = new RegExp("\\$FlowFixMe\\[" + suppression + "\\]");
			return comments.some((commentNode) => flowSuppressionRegex.test(commentNode.value) && commentNode.loc != null && node.loc != null && commentNode.loc.end.line === node.loc.start.line - 1);
		}
		const analyzer = new CodePathAnalyzer({
			onCodePathSegmentStart: (segment) => codePathSegmentStack.push(segment),
			onCodePathSegmentEnd: () => codePathSegmentStack.pop(),
			onCodePathStart: () => codePathReactHooksMapStack.push(/* @__PURE__ */ new Map()),
			onCodePathEnd(codePath, codePathNode) {
				const reactHooksMap = codePathReactHooksMapStack.pop();
				if (reactHooksMap?.size === 0) return;
				else if (typeof reactHooksMap === "undefined") throw new Error("Unexpected undefined reactHooksMap");
				const cyclic = /* @__PURE__ */ new Set();
				/**
				* Count the number of code paths from the start of the function to this
				* segment. For example:
				*
				* ```js
				* function MyComponent() {
				*   if (condition) {
				*     // Segment 1
				*   } else {
				*     // Segment 2
				*   }
				*   // Segment 3
				* }
				* ```
				*
				* Segments 1 and 2 have one path to the beginning of `MyComponent` and
				* segment 3 has two paths to the beginning of `MyComponent` since we
				* could have either taken the path of segment 1 or segment 2.
				*
				* Populates `cyclic` with cyclic segments.
				*/
				function countPathsFromStart(segment, pathHistory) {
					const { cache } = countPathsFromStart;
					let paths = cache.get(segment.id);
					const pathList = new Set(pathHistory);
					if (pathList.has(segment.id)) {
						const pathArray = [...pathList];
						const cyclicSegments = pathArray.slice(pathArray.indexOf(segment.id) + 1);
						for (const cyclicSegment of cyclicSegments) cyclic.add(cyclicSegment);
						return BigInt("0");
					}
					pathList.add(segment.id);
					if (paths !== void 0) return paths;
					if (codePath.thrownSegments.includes(segment)) paths = BigInt("0");
					else if (segment.prevSegments.length === 0) paths = BigInt("1");
					else {
						paths = BigInt("0");
						for (const prevSegment of segment.prevSegments) paths += countPathsFromStart(prevSegment, pathList);
					}
					if (segment.reachable && paths === BigInt("0")) cache.delete(segment.id);
					else cache.set(segment.id, paths);
					return paths;
				}
				/**
				* Count the number of code paths from this segment to the end of the
				* function. For example:
				*
				* ```js
				* function MyComponent() {
				*   // Segment 1
				*   if (condition) {
				*     // Segment 2
				*   } else {
				*     // Segment 3
				*   }
				* }
				* ```
				*
				* Segments 2 and 3 have one path to the end of `MyComponent` and
				* segment 1 has two paths to the end of `MyComponent` since we could
				* either take the path of segment 1 or segment 2.
				*
				* Populates `cyclic` with cyclic segments.
				*/
				function countPathsToEnd(segment, pathHistory) {
					const { cache } = countPathsToEnd;
					let paths = cache.get(segment.id);
					const pathList = new Set(pathHistory);
					if (pathList.has(segment.id)) {
						const pathArray = Array.from(pathList);
						const cyclicSegments = pathArray.slice(pathArray.indexOf(segment.id) + 1);
						for (const cyclicSegment of cyclicSegments) cyclic.add(cyclicSegment);
						return BigInt("0");
					}
					pathList.add(segment.id);
					if (paths !== void 0) return paths;
					if (codePath.thrownSegments.includes(segment)) paths = BigInt("0");
					else if (segment.nextSegments.length === 0) paths = BigInt("1");
					else {
						paths = BigInt("0");
						for (const nextSegment of segment.nextSegments) paths += countPathsToEnd(nextSegment, pathList);
					}
					cache.set(segment.id, paths);
					return paths;
				}
				/**
				* Gets the shortest path length to the start of a code path.
				* For example:
				*
				* ```js
				* function MyComponent() {
				*   if (condition) {
				*     // Segment 1
				*   }
				*   // Segment 2
				* }
				* ```
				*
				* There is only one path from segment 1 to the code path start. Its
				* length is one so that is the shortest path.
				*
				* There are two paths from segment 2 to the code path start. One
				* through segment 1 with a length of two and another directly to the
				* start with a length of one. The shortest path has a length of one
				* so we would return that.
				*/
				function shortestPathLengthToStart(segment) {
					const { cache } = shortestPathLengthToStart;
					let length = cache.get(segment.id);
					if (length === null) return Infinity;
					if (length !== void 0) return length;
					cache.set(segment.id, null);
					if (segment.prevSegments.length === 0) length = 1;
					else {
						length = Infinity;
						for (const prevSegment of segment.prevSegments) {
							const prevLength = shortestPathLengthToStart(prevSegment);
							if (prevLength < length) length = prevLength;
						}
						length += 1;
					}
					cache.set(segment.id, length);
					return length;
				}
				countPathsFromStart.cache = /* @__PURE__ */ new Map();
				countPathsToEnd.cache = /* @__PURE__ */ new Map();
				shortestPathLengthToStart.cache = /* @__PURE__ */ new Map();
				const allPathsFromStartToEnd = countPathsToEnd(codePath.initialSegment);
				const codePathFunctionName = getFunctionName(codePathNode);
				const isSomewhereInsideComponentOrHook = isInsideComponentOrHook(codePathNode);
				const isDirectlyInsideComponentOrHook = codePathFunctionName ? isComponentName(codePathFunctionName) || isHook(codePathFunctionName) : isForwardRefCallback(codePathNode) || isMemoCallback(codePathNode);
				let shortestFinalPathLength = Infinity;
				for (const finalSegment of codePath.finalSegments) {
					if (!finalSegment.reachable) continue;
					const length = shortestPathLengthToStart(finalSegment);
					if (length < shortestFinalPathLength) shortestFinalPathLength = length;
				}
				for (const [segment, reactHooks] of reactHooksMap) {
					if (!segment.reachable) continue;
					const possiblyHasEarlyReturn = segment.nextSegments.length === 0 ? shortestFinalPathLength <= shortestPathLengthToStart(segment) : shortestFinalPathLength < shortestPathLengthToStart(segment);
					const pathsFromStartToEnd = countPathsFromStart(segment) * countPathsToEnd(segment);
					const cycled = cyclic.has(segment.id);
					for (const hook of reactHooks) {
						if (hasFlowSuppression(hook, "react-rule-hook")) continue;
						if (isUseIdentifier(hook) && isInsideTryCatch(hook)) context.report({
							node: hook,
							message: `React Hook "${getSourceCode().getText(hook)}" cannot be called in a try/catch block.`
						});
						if ((cycled || isInsideDoWhileLoop(hook)) && !isUseIdentifier(hook)) context.report({
							node: hook,
							message: `React Hook "${getSourceCode().getText(hook)}" may be executed more than once. Possibly because it is called in a loop. React Hooks must be called in the exact same order in every component render.`
						});
						if (isDirectlyInsideComponentOrHook) {
							if (codePathNode.async) context.report({
								node: hook,
								message: `React Hook "${getSourceCode().getText(hook)}" cannot be called in an async function.`
							});
							if (!cycled && pathsFromStartToEnd !== allPathsFromStartToEnd && !isUseIdentifier(hook) && !isInsideDoWhileLoop(hook)) {
								const message = `React Hook "${getSourceCode().getText(hook)}" is called conditionally. React Hooks must be called in the exact same order in every component render.` + (possiblyHasEarlyReturn ? " Did you accidentally call a React Hook after an early return?" : "");
								context.report({
									node: hook,
									message
								});
							}
						} else if (codePathNode.parent != null && (codePathNode.parent.type === "MethodDefinition" || codePathNode.parent.type === "ClassProperty" || codePathNode.parent.type === "PropertyDefinition") && codePathNode.parent.value === codePathNode) {
							const message = `React Hook "${getSourceCode().getText(hook)}" cannot be called in a class component. React Hooks must be called in a React function component or a custom React Hook function.`;
							context.report({
								node: hook,
								message
							});
						} else if (codePathFunctionName) {
							const message = `React Hook "${getSourceCode().getText(hook)}" is called in function "${getSourceCode().getText(codePathFunctionName)}" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use".`;
							context.report({
								node: hook,
								message
							});
						} else if (codePathNode.type === "Program") {
							const message = `React Hook "${getSourceCode().getText(hook)}" cannot be called at the top level. React Hooks must be called in a React function component or a custom React Hook function.`;
							context.report({
								node: hook,
								message
							});
						} else if (isSomewhereInsideComponentOrHook && !isUseIdentifier(hook)) {
							const message = `React Hook "${getSourceCode().getText(hook)}" cannot be called inside a callback. React Hooks must be called in a React function component or a custom React Hook function.`;
							context.report({
								node: hook,
								message
							});
						}
					}
				}
			}
		});
		return {
			"*"(node) {
				analyzer.enterNode(node);
			},
			"*:exit"(node) {
				analyzer.leaveNode(node);
			},
			CallExpression(node) {
				if (isHook(node.callee)) {
					const reactHooksMap = last(codePathReactHooksMapStack);
					const codePathSegment = last(codePathSegmentStack);
					let reactHooks = reactHooksMap.get(codePathSegment);
					if (!reactHooks) {
						reactHooks = [];
						reactHooksMap.set(codePathSegment, reactHooks);
					}
					reactHooks.push(node.callee);
				}
				const nodeWithoutNamespace = getNodeWithoutReactNamespace(node.callee);
				if ((isEffectIdentifier(nodeWithoutNamespace, additionalEffectHooks) || isUseEffectEventIdentifier(nodeWithoutNamespace)) && node.arguments.length > 0) lastEffect = node;
				if (isUseEffectEventIdentifier(nodeWithoutNamespace) && node.parent?.type !== "VariableDeclarator" && node.parent?.type !== "ExpressionStatement") {
					const message = useEffectEventError(null, false);
					context.report({
						node,
						message
					});
				}
			},
			Identifier(node) {
				if (lastEffect == null && useEffectEventFunctions.has(node)) {
					const message = useEffectEventError(getSourceCode().getText(node), node.parent.type === "CallExpression");
					context.report({
						node,
						message
					});
				}
			},
			"CallExpression:exit"(node) {
				if (node === lastEffect) lastEffect = null;
			},
			FunctionDeclaration(node) {
				if (isInsideComponentOrHook(node)) recordAllUseEffectEventFunctions(getScope(node));
			},
			ArrowFunctionExpression(node) {
				if (isInsideComponentOrHook(node)) recordAllUseEffectEventFunctions(getScope(node));
			},
			ComponentDeclaration(node) {
				recordAllUseEffectEventFunctions(getScope(node));
			},
			HookDeclaration(node) {
				recordAllUseEffectEventFunctions(getScope(node));
			}
		};
	}
};
/**
* Gets the static name of a function AST node. For function declarations it is
* easy. For anonymous function expressions it is much harder. If you search for
* `IsAnonymousFunctionDefinition()` in the ECMAScript spec you'll find places
* where JS gives anonymous function expressions names. We roughly detect the
* same AST nodes with some exceptions to better fit our use case.
*/
function getFunctionName(node) {
	if (node.type === "ComponentDeclaration" || node.type === "HookDeclaration" || node.type === "FunctionDeclaration" || node.type === "FunctionExpression" && node.id) return node.id;
	else if (node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression") if (node.parent?.type === "VariableDeclarator" && node.parent.init === node) return node.parent.id;
	else if (node.parent?.type === "AssignmentExpression" && node.parent.right === node && node.parent.operator === "=") return node.parent.left;
	else if (node.parent?.type === "Property" && node.parent.value === node && !node.parent.computed) return node.parent.key;
	else if (node.parent?.type === "AssignmentPattern" && node.parent.right === node && !node.parent.computed) return node.parent.left;
	else return;
	else return;
}
/**
* Convenience function for peeking the last item in a stack.
*/
function last(array) {
	return array[array.length - 1];
}

//#endregion
//#region src/rules/set-state-in-effect/set-state-in-effect.ts
const RULE_NAME$4 = "set-state-in-effect";
var set_state_in_effect_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates against setting state synchronously in an effect, which can lead to re-renders that degrade performance." },
		messages: { default: "Do not call the 'set' function '{{name}}' of 'useState' synchronously in an effect. This can lead to unnecessary re-renders and performance issues." },
		schema: []
	},
	name: RULE_NAME$4,
	create: create$4,
	defaultOptions: []
});
function create$4(context) {
	if (!/use\w*Effect/u.test(context.sourceCode.text)) return {};
	const { additionalEffectHooks, additionalStateHooks } = getSettingsFromContext(context);
	const functionEntries = [];
	const setupFnRef = { current: null };
	const setupFnIds = [];
	const trackedFnCalls = [];
	const setStateCallsByFn = /* @__PURE__ */ new WeakMap();
	const setStateInEffectArg = /* @__PURE__ */ new WeakMap();
	const setStateInEffectSetup = /* @__PURE__ */ new Map();
	const setStateInHookCallbacks = /* @__PURE__ */ new WeakMap();
	const getText = (n) => context.sourceCode.getText(n);
	const onSetupFunctionEnter = (node) => {
		setupFnRef.current = node;
	};
	const onSetupFunctionExit = (node) => {
		if (setupFnRef.current === node) setupFnRef.current = null;
	};
	function isThenCall(node) {
		return node.callee.type === AST_NODE_TYPES.MemberExpression && node.callee.property.type === AST_NODE_TYPES.Identifier && node.callee.property.name === "then";
	}
	function isUseStateCall(node) {
		return core.isUseStateLikeCall(node, additionalStateHooks);
	}
	function isUseEffectCall(node) {
		return core.isUseEffectLikeCall(node, additionalEffectHooks);
	}
	function isUseEffectSetupCallback(node) {
		return node.parent?.type === AST_NODE_TYPES.CallExpression && node.parent.callee !== node && isUseEffectCall(node.parent);
	}
	function getCallName(node) {
		if (node.type === AST_NODE_TYPES.CallExpression) return ast.getFullyQualifiedName(node.callee, getText);
		return ast.getFullyQualifiedName(node, getText);
	}
	function getCallKind(node) {
		return match(node).when(isUseStateCall, () => "useState").when(isUseEffectCall, () => "useEffect").when(isSetStateCall, () => "setState").when(isThenCall, () => "then").otherwise(() => "other");
	}
	function getFunctionKind(node) {
		const parent = ast.findParent(node, not(ast.isTypeExpression)) ?? node.parent;
		switch (true) {
			case node.async:
			case parent.type === AST_NODE_TYPES.CallExpression && isThenCall(parent): return "deferred";
			case node.type !== AST_NODE_TYPES.FunctionDeclaration && parent.type === AST_NODE_TYPES.CallExpression && parent.callee === node: return "immediate";
			case isUseEffectSetupCallback(node): return "setup";
			default: return "other";
		}
	}
	function isIdFromUseStateCall(id, at) {
		const initNode = resolve(context, id);
		if (initNode == null) return false;
		if (initNode.type !== AST_NODE_TYPES.CallExpression) return false;
		if (!isUseStateCall(initNode)) return false;
		const variableNodeParent = initNode.parent;
		if (!("id" in variableNodeParent) || variableNodeParent.id?.type !== AST_NODE_TYPES.ArrayPattern) return true;
		return variableNodeParent.id.elements.findIndex((e) => e?.type === AST_NODE_TYPES.Identifier && e.name === id.name) === at;
	}
	function isSetStateCall(node) {
		switch (node.callee.type) {
			case AST_NODE_TYPES.CallExpression: {
				const { callee } = node.callee;
				if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
				if (!("name" in callee.object)) return false;
				const isAt = callee.property.type === AST_NODE_TYPES.Identifier && callee.property.name === "at";
				const [index] = node.callee.arguments;
				if (!isAt || index == null) return false;
				return getStaticValue(index, context.sourceCode.getScope(node))?.value === 1 && isIdFromUseStateCall(callee.object);
			}
			case AST_NODE_TYPES.Identifier: return isIdFromUseStateCall(node.callee, 1);
			case AST_NODE_TYPES.MemberExpression: {
				if (!("name" in node.callee.object)) return false;
				const property = node.callee.property;
				return getStaticValue(property, context.sourceCode.getScope(node))?.value === 1 && isIdFromUseStateCall(node.callee.object, 1);
			}
			default: return false;
		}
	}
	function isHookDecl(node) {
		if (node.type !== AST_NODE_TYPES.VariableDeclarator) return false;
		if (node.id.type !== AST_NODE_TYPES.Identifier) return false;
		const init = node.init;
		if (init == null || init.type !== AST_NODE_TYPES.CallExpression) return false;
		switch (init.callee.type) {
			case AST_NODE_TYPES.Identifier: return core.isHookName(init.callee.name);
			case AST_NODE_TYPES.MemberExpression: return init.callee.property.type === AST_NODE_TYPES.Identifier && core.isHookName(init.callee.property.name);
			default: return false;
		}
	}
	function isInitializedFromRef(name, initialScope) {
		for (const { node } of findVariable(initialScope, name)?.defs ?? []) {
			if (node.type !== AST_NODE_TYPES.VariableDeclarator) continue;
			const init = node.init;
			if (init == null) continue;
			switch (true) {
				case init.type === AST_NODE_TYPES.MemberExpression && init.object.type === AST_NODE_TYPES.Identifier && (init.object.name === "ref" || init.object.name.endsWith("Ref")): return true;
				case init.type === AST_NODE_TYPES.CallExpression && isUseRefCall(init): return true;
			}
		}
		return false;
	}
	return defineRuleListener({
		":function"(node) {
			const kind = getFunctionKind(node);
			functionEntries.push({
				kind,
				node
			});
			if (kind === "setup") onSetupFunctionEnter(node);
		},
		":function:exit"(node) {
			const { kind } = functionEntries.at(-1) ?? {};
			if (kind === "setup") onSetupFunctionExit(node);
			functionEntries.pop();
		},
		CallExpression(node) {
			const setupFunction = setupFnRef.current;
			const entry = functionEntries.at(-1);
			if (entry == null || entry.node.async) return;
			match(getCallKind(node)).with("setState", () => {
				switch (true) {
					case entry.kind === "deferred":
					case entry.node.async: break;
					case entry.node === setupFunction:
					case entry.kind === "immediate" && ast.findParent(entry.node, ast.isFunction) === setupFunction: {
						const args0 = node.arguments.at(0);
						if (args0 == null) return;
						function isArgumentUsingRefValue(context, node) {
							const isUsingRefValue = (n) => {
								switch (n.type) {
									case AST_NODE_TYPES.Identifier: return isInitializedFromRef(n.name, context.sourceCode.getScope(n));
									case AST_NODE_TYPES.MemberExpression: return isUsingRefValue(n.object);
									case AST_NODE_TYPES.CallExpression: return isUsingRefValue(n.callee) || ast.getNestedIdentifiers(n).some(isUsingRefValue);
									default: return false;
								}
							};
							if (isUsingRefValue(node)) return true;
							return ast.isFunction(node) && context.sourceCode.getScope(node.body).references.some((r) => isUsingRefValue(r.identifier));
						}
						if (isArgumentUsingRefValue(context, args0)) return;
						context.report({
							data: { name: context.sourceCode.getText(node.callee) },
							messageId: "default",
							node
						});
						return;
					}
					default: {
						const init = ast.findParent(node, isHookDecl)?.init;
						if (init == null) getOrInsertComputed(setStateCallsByFn, entry.node, () => []).push(node);
						else getOrInsertComputed(setStateInHookCallbacks, init, () => []).push(node);
					}
				}
			}).with("useEffect", () => {
				if (ast.isFunction(node.arguments.at(0))) return;
				setupFnIds.push(...ast.getNestedIdentifiers(node));
			}).with("other", () => {
				if (entry.node !== setupFunction) return;
				trackedFnCalls.push(node);
			}).otherwise(constVoid);
		},
		Identifier(node) {
			if (node.parent.type === AST_NODE_TYPES.CallExpression && node.parent.callee === node) return;
			if (!isIdFromUseStateCall(node, 1)) return;
			switch (node.parent.type) {
				case AST_NODE_TYPES.ArrowFunctionExpression: {
					const parent = node.parent.parent;
					if (parent.type !== AST_NODE_TYPES.CallExpression) break;
					if (!core.isUseMemoCall(parent)) break;
					const init = ast.findParent(parent, isHookDecl)?.init;
					if (init != null) getOrInsertComputed(setStateInEffectArg, init, () => []).push(node);
					break;
				}
				case AST_NODE_TYPES.CallExpression:
					if (node !== node.parent.arguments.at(0)) break;
					if (core.isUseCallbackCall(node.parent)) {
						const init = ast.findParent(node.parent, isHookDecl)?.init;
						if (init != null) getOrInsertComputed(setStateInEffectArg, init, () => []).push(node);
						break;
					}
					if (isUseEffectCall(node.parent)) getOrInsertComputed(setStateInEffectSetup, node.parent, () => []).push(node);
			}
		},
		"Program:exit"() {
			const getSetStateCalls = (context, id) => {
				const node = resolve(context, id);
				switch (node?.type) {
					case AST_NODE_TYPES.ArrowFunctionExpression:
					case AST_NODE_TYPES.FunctionDeclaration:
					case AST_NODE_TYPES.FunctionExpression: return setStateCallsByFn.get(node) ?? [];
					case AST_NODE_TYPES.CallExpression: return setStateInHookCallbacks.get(node) ?? setStateInEffectArg.get(node) ?? [];
				}
				return [];
			};
			for (const [, calls] of setStateInEffectSetup) for (const call of calls) context.report({
				data: { name: call.name },
				messageId: "default",
				node: call
			});
			for (const { callee } of trackedFnCalls) {
				if (!("name" in callee)) continue;
				const setStateCalls = getSetStateCalls(context, callee);
				for (const setStateCall of setStateCalls) context.report({
					data: { name: getCallName(setStateCall) },
					messageId: "default",
					node: setStateCall
				});
			}
			for (const id of setupFnIds) {
				const setStateCalls = getSetStateCalls(context, id);
				for (const setStateCall of setStateCalls) context.report({
					data: { name: getCallName(setStateCall) },
					messageId: "default",
					node: setStateCall
				});
			}
		}
	});
}

//#endregion
//#region src/rules/set-state-in-render/set-state-in-render.ts
const RULE_NAME$3 = "set-state-in-render";
var set_state_in_render_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates against unconditionally setting state during render, which can trigger additional renders and potential infinite render loops." },
		messages: { default: "Do not call the 'set' function '{{name}}' unconditionally during render. This will trigger an infinite render loop." },
		schema: []
	},
	name: RULE_NAME$3,
	create: create$3,
	defaultOptions: []
});
function create$3(context) {
	const { additionalStateHooks } = getSettingsFromContext(context);
	const functionEntries = [];
	const componentFnRef = { current: null };
	const componentHasEarlyReturn = { current: false };
	function isUseStateCall(node) {
		return core.isUseStateLikeCall(node, additionalStateHooks);
	}
	function isIdFromUseStateCall(topLevelId, at) {
		const initNode = resolve(context, topLevelId);
		if (initNode == null) return false;
		if (initNode.type !== AST_NODE_TYPES.CallExpression) return false;
		if (!isUseStateCall(initNode)) return false;
		const initNodeParent = initNode.parent;
		if (!("id" in initNodeParent) || initNodeParent.id?.type !== AST_NODE_TYPES.ArrayPattern) return true;
		return initNodeParent.id.elements.findIndex((e) => e?.type === AST_NODE_TYPES.Identifier && e.name === topLevelId.name) === at;
	}
	function isSetStateCall(node) {
		switch (node.callee.type) {
			case AST_NODE_TYPES.CallExpression: {
				const { callee } = node.callee;
				if (callee.type !== AST_NODE_TYPES.MemberExpression) return false;
				if (!("name" in callee.object)) return false;
				const isAt = callee.property.type === AST_NODE_TYPES.Identifier && callee.property.name === "at";
				const [index] = node.callee.arguments;
				if (!isAt || index == null) return false;
				return getStaticValue(index, context.sourceCode.getScope(node))?.value === 1 && isIdFromUseStateCall(callee.object);
			}
			case AST_NODE_TYPES.Identifier: return isIdFromUseStateCall(node.callee, 1);
			case AST_NODE_TYPES.MemberExpression: {
				if (!("name" in node.callee.object)) return false;
				const property = node.callee.property;
				return getStaticValue(property, context.sourceCode.getScope(node))?.value === 1 && isIdFromUseStateCall(node.callee.object, 1);
			}
			default: return false;
		}
	}
	function isInsideConditional(node, stopAt) {
		let current = node.parent;
		while (current != null && current !== stopAt) {
			switch (current.type) {
				case AST_NODE_TYPES.IfStatement:
				case AST_NODE_TYPES.ConditionalExpression:
				case AST_NODE_TYPES.LogicalExpression:
				case AST_NODE_TYPES.SwitchStatement:
				case AST_NODE_TYPES.SwitchCase: return true;
				default: break;
			}
			current = current.parent;
		}
		return false;
	}
	function isInsideEventHandler(node, stopAt) {
		let current = node.parent;
		while (current != null && current !== stopAt) {
			if (ast.isFunction(current) && current !== stopAt) return true;
			current = current.parent;
		}
		return false;
	}
	function isComponentOrHookLikeFunction(node) {
		const id = ast.getFunctionId(node);
		if (id == null) return false;
		if (id.type === AST_NODE_TYPES.Identifier) return core.isComponentName(id.name) || core.isHookName(id.name);
		if (id.type === AST_NODE_TYPES.MemberExpression && id.property.type === AST_NODE_TYPES.Identifier) return core.isComponentName(id.property.name) || core.isHookName(id.property.name);
		return false;
	}
	function getFunctionKind(node) {
		if (isComponentOrHookLikeFunction(node)) return "component";
		const parent = ast.findParent(node, not(ast.isTypeExpression)) ?? node.parent;
		if (parent.type === AST_NODE_TYPES.CallExpression && parent.callee !== node) return "callback";
		return "other";
	}
	return defineRuleListener({
		":function"(node) {
			const kind = getFunctionKind(node);
			functionEntries.push({
				kind,
				node
			});
			if (kind === "component") {
				componentFnRef.current = node;
				componentHasEarlyReturn.current = false;
			}
		},
		":function:exit"(node) {
			if (functionEntries.at(-1)?.kind === "component" && componentFnRef.current === node) {
				componentFnRef.current = null;
				componentHasEarlyReturn.current = false;
			}
			functionEntries.pop();
		},
		CallExpression(node) {
			const componentFn = componentFnRef.current;
			if (componentFn == null) return;
			if (!isSetStateCall(node)) return;
			if (isInsideEventHandler(node, componentFn)) return;
			if (isInsideConditional(node, componentFn)) return;
			if (componentHasEarlyReturn.current) return;
			context.report({
				data: { name: context.sourceCode.getText(node.callee) },
				messageId: "default",
				node
			});
		},
		ReturnStatement(node) {
			const componentFn = componentFnRef.current;
			if (componentFn == null) return;
			const entry = functionEntries.at(-1);
			if (entry == null || entry.node !== componentFn) return;
			if (componentFn.body.type !== AST_NODE_TYPES.BlockStatement) return;
			const body = componentFn.body.body;
			let stmt = node;
			while (stmt.parent !== componentFn.body) {
				if (stmt.parent == null) return;
				stmt = stmt.parent;
			}
			const idx = body.indexOf(stmt);
			if (idx !== -1 && idx < body.length - 1) componentHasEarlyReturn.current = true;
		}
	});
}

//#endregion
//#region src/rules/unsupported-syntax/unsupported-syntax.ts
const RULE_NAME$2 = "unsupported-syntax";
var unsupported_syntax_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates against syntax that React Compiler does not support." },
		messages: {
			eval: "Do not use 'eval' inside components or hooks. 'eval' cannot be statically analyzed and is not supported by React Compiler.",
			iife: "Do not use immediately-invoked function expressions in JSX. IIFEs will not be optimized by React Compiler.",
			with: "Do not use 'with' statements inside components or hooks. 'with' changes scope dynamically and is not supported by React Compiler."
		},
		schema: []
	},
	name: RULE_NAME$2,
	create: create$2,
	defaultOptions: []
});
function isEvalCall(node) {
	return node.callee.type === AST_NODE_TYPES.Identifier && node.callee.name === "eval";
}
function isIifeCall(node) {
	return node.parent.type === AST_NODE_TYPES.CallExpression && node.parent.callee === node;
}
function create$2(context) {
	const hCollector = core.getHookCollector(context);
	const cCollector = core.getComponentCollector(context);
	const evalCalls = [];
	const withStmts = [];
	return defineRuleListener(hCollector.visitor, cCollector.visitor, {
		CallExpression(node) {
			if (!isEvalCall(node)) return;
			const func = ast.findParent(node, ast.isFunction);
			if (func == null) return;
			evalCalls.push({
				func,
				node
			});
		},
		"JSXElement :function"(node) {
			if (isIifeCall(node)) context.report({
				messageId: "iife",
				node: node.parent
			});
		},
		"JSXFragment :function"(node) {
			if (isIifeCall(node)) context.report({
				messageId: "iife",
				node: node.parent
			});
		},
		"Program:exit"(node) {
			const components = cCollector.api.getAllComponents(node);
			const hooks = hCollector.api.getAllHooks(node);
			const funcs = [...components, ...hooks];
			for (const { func, node } of evalCalls) {
				if (!funcs.some((f) => f.node === func)) continue;
				context.report({
					messageId: "eval",
					node
				});
			}
			for (const { func, node } of withStmts) {
				if (!funcs.some((f) => f.node === func)) continue;
				context.report({
					messageId: "with",
					node
				});
			}
		},
		WithStatement(node) {
			const func = ast.findParent(node, ast.isFunction);
			if (func == null) return;
			withStmts.push({
				func,
				node
			});
		}
	});
}

//#endregion
//#region src/rules/use-memo/use-memo.ts
const RULE_NAME$1 = "use-memo";
var use_memo_default = createRule({
	meta: {
		type: "problem",
		docs: { description: "Validates that 'useMemo' is called with a callback that returns a value." },
		messages: {
			missingReturnValue: "The callback passed to 'useMemo' must return a value. Without a return value, 'useMemo' always returns 'undefined', which defeats its purpose.",
			notAssignedToVariable: "The return value of 'useMemo' must be assigned to a variable. Calling 'useMemo' without capturing its return value is likely a mistake — use 'useEffect' for side effects instead."
		},
		schema: []
	},
	name: RULE_NAME$1,
	create: create$1,
	defaultOptions: []
});
function create$1(context) {
	if (!context.sourceCode.text.includes("useMemo")) return {};
	return defineRuleListener({ CallExpression(node) {
		if (!core.isUseMemoCall(node)) return;
		let parent = node.parent;
		while (ast.isTypeExpression(parent)) parent = parent.parent;
		if (!(parent.type === AST_NODE_TYPES.VariableDeclarator || parent.type === AST_NODE_TYPES.AssignmentExpression || parent.type === AST_NODE_TYPES.AssignmentPattern || parent.type === AST_NODE_TYPES.Property || parent.type === AST_NODE_TYPES.ReturnStatement || parent.type === AST_NODE_TYPES.JSXExpressionContainer || parent.type === AST_NODE_TYPES.CallExpression || parent.type === AST_NODE_TYPES.NewExpression || parent.type === AST_NODE_TYPES.ArrayExpression || parent.type === AST_NODE_TYPES.ConditionalExpression || parent.type === AST_NODE_TYPES.LogicalExpression || parent.type === AST_NODE_TYPES.SequenceExpression || parent.type === AST_NODE_TYPES.SpreadElement || parent.type === AST_NODE_TYPES.TemplateLiteral || parent.type === AST_NODE_TYPES.BinaryExpression || parent.type === AST_NODE_TYPES.UnaryExpression || parent.type === AST_NODE_TYPES.MemberExpression || parent.type === AST_NODE_TYPES.TaggedTemplateExpression || parent.type === AST_NODE_TYPES.ChainExpression || parent.type === AST_NODE_TYPES.ArrowFunctionExpression)) {
			context.report({
				messageId: "notAssignedToVariable",
				node
			});
			return;
		}
		const [callbackArg] = node.arguments;
		if (callbackArg == null) return;
		if (!ast.isFunction(callbackArg)) return;
		if (callbackArg.type === AST_NODE_TYPES.ArrowFunctionExpression && callbackArg.body.type !== AST_NODE_TYPES.BlockStatement) return;
		if (callbackArg.body.type !== AST_NODE_TYPES.BlockStatement) return;
		const returnStatements = ast.getNestedReturnStatements(callbackArg);
		if (returnStatements.length === 0) {
			context.report({
				messageId: "missingReturnValue",
				node: callbackArg
			});
			return;
		}
		if (!returnStatements.some((stmt) => stmt.argument != null)) context.report({
			messageId: "missingReturnValue",
			node: callbackArg
		});
	} });
}

//#endregion
//#region src/rules/use-state/use-state.ts
const RULE_NAME = "use-state";
const defaultOptions = [{
	enforceAssignment: true,
	enforceLazyInitialization: true,
	enforceSetterName: true
}];
const schema = [{
	type: "object",
	additionalProperties: false,
	properties: {
		enforceAssignment: {
			type: "boolean",
			default: true
		},
		enforceLazyInitialization: {
			type: "boolean",
			default: true
		},
		enforceSetterName: {
			type: "boolean",
			default: true
		}
	}
}];
const LAZY_INIT_ALLOW_LIST = [
	"Boolean",
	"String",
	"Number"
];
var use_state_default = createRule({
	meta: {
		type: "suggestion",
		docs: { description: "Enforces correct usage of 'useState', including destructuring, symmetric naming of the value and setter, and wrapping expensive initializers in a lazy initializer function." },
		messages: {
			invalidAssignment: "useState should be destructured into a value and setter pair, e.g., const [state, setState] = useState(...).",
			invalidInitialization: "To prevent re-computation, consider using lazy initial state for useState calls that involve function calls. Ex: 'useState(() => getValue())'.",
			invalidSetterName: "The setter should be named 'set' followed by the capitalized state variable name, e.g., 'setState' for 'state'."
		},
		schema
	},
	name: RULE_NAME,
	create,
	defaultOptions
});
function create(context) {
	const { enforceAssignment = true, enforceLazyInitialization = true, enforceSetterName = true } = context.options[0] ?? defaultOptions[0];
	const { additionalStateHooks } = getSettingsFromContext(context);
	return defineRuleListener({ CallExpression(node) {
		if (!core.isUseStateLikeCall(node, additionalStateHooks)) return;
		if (enforceLazyInitialization) {
			const [useStateInput] = node.arguments;
			if (useStateInput != null) {
				for (const expr of ast.getNestedNewExpressions(useStateInput)) {
					if (!("name" in expr.callee)) continue;
					if (LAZY_INIT_ALLOW_LIST.includes(expr.callee.name)) continue;
					if (ast.findParent(expr, core.isUseCall) != null) continue;
					context.report({
						messageId: "invalidInitialization",
						node: expr
					});
				}
				for (const expr of ast.getNestedCallExpressions(useStateInput)) {
					if (!("name" in expr.callee)) continue;
					if (core.isHookName(expr.callee.name)) continue;
					if (LAZY_INIT_ALLOW_LIST.includes(expr.callee.name)) continue;
					if (ast.findParent(expr, core.isUseCall) != null) continue;
					context.report({
						messageId: "invalidInitialization",
						node: expr
					});
				}
			}
		}
		if (node.parent.type !== AST_NODE_TYPES.VariableDeclarator) {
			if (!enforceAssignment) return;
			context.report({
				messageId: "invalidAssignment",
				node
			});
			return;
		}
		const id = findEnclosingAssignmentTarget(node);
		if (id?.type !== AST_NODE_TYPES.ArrayPattern) {
			if (!enforceAssignment) return;
			context.report({
				messageId: "invalidAssignment",
				node: id ?? node
			});
			return;
		}
		const [value, setter] = id.elements;
		if (value == null) {
			if (!enforceAssignment) return;
			context.report({
				messageId: "invalidAssignment",
				node: id
			});
			return;
		}
		if (setter == null || !enforceSetterName) return;
		if (value.type !== AST_NODE_TYPES.Identifier) {
			context.report({
				messageId: "invalidAssignment",
				node: value
			});
			return;
		}
		if (setter.type !== AST_NODE_TYPES.Identifier || !setter.name.startsWith("set")) {
			context.report({
				messageId: "invalidSetterName",
				node: setter
			});
			return;
		}
		if (snakeCase(setter.name) !== `set_${snakeCase(value.name)}`) context.report({
			messageId: "invalidSetterName",
			node: setter
		});
	} });
}

//#endregion
//#region src/plugin.ts
const plugin = {
	meta: {
		name: name$6,
		version
	},
	rules: {
		"component-hook-factories": component_hook_factories_default,
		"error-boundaries": error_boundaries_default,
		"exhaustive-deps": rule$1,
		immutability: immutability_default,
		"no-access-state-in-setstate": no_access_state_in_setstate_default,
		"no-array-index-key": no_array_index_key_default,
		"no-children-count": no_children_count_default,
		"no-children-for-each": no_children_for_each_default,
		"no-children-map": no_children_map_default,
		"no-children-only": no_children_only_default,
		"no-children-to-array": no_children_to_array_default,
		"no-class-component": no_class_component_default,
		"no-clone-element": no_clone_element_default,
		"no-component-will-mount": no_component_will_mount_default,
		"no-component-will-receive-props": no_component_will_receive_props_default,
		"no-component-will-update": no_component_will_update_default,
		"no-context-provider": no_context_provider_default,
		"no-create-ref": no_create_ref_default,
		"no-direct-mutation-state": no_direct_mutation_state_default,
		"no-duplicate-key": no_duplicate_key_default,
		"no-forward-ref": no_forward_ref_default,
		"no-implicit-children": no_implicit_children_default,
		"no-implicit-key": no_implicit_key_default,
		"no-implicit-ref": no_implicit_ref_default,
		"no-leaked-conditional-rendering": no_leaked_conditional_rendering_default,
		"no-missing-component-display-name": no_missing_component_display_name_default,
		"no-missing-context-display-name": no_missing_context_display_name_default,
		"no-missing-key": no_missing_key_default,
		"no-misused-capture-owner-stack": no_misused_capture_owner_stack_default,
		"no-nested-component-definitions": no_nested_component_definitions_default,
		"no-nested-lazy-component-declarations": no_nested_lazy_component_declarations_default,
		"no-redundant-should-component-update": no_redundant_should_component_update_default,
		"no-set-state-in-component-did-mount": no_set_state_in_component_did_mount_default,
		"no-set-state-in-component-did-update": no_set_state_in_component_did_update_default,
		"no-set-state-in-component-will-update": no_set_state_in_component_will_update_default,
		"no-unnecessary-use-callback": no_unnecessary_use_callback_default,
		"no-unnecessary-use-memo": no_unnecessary_use_memo_default,
		"no-unnecessary-use-prefix": no_unnecessary_use_prefix_default,
		"no-unsafe-component-will-mount": no_unsafe_component_will_mount_default,
		"no-unsafe-component-will-receive-props": no_unsafe_component_will_receive_props_default,
		"no-unsafe-component-will-update": no_unsafe_component_will_update_default,
		"no-unstable-context-value": no_unstable_context_value_default,
		"no-unstable-default-props": no_unstable_default_props_default,
		"no-unused-class-component-members": no_unused_class_component_members_default,
		"no-unused-props": no_unused_props_default,
		"no-unused-state": no_unused_state_default,
		"no-use-context": no_use_context_default,
		"prefer-destructuring-assignment": prefer_destructuring_assignment_default,
		"prefer-namespace-import": prefer_namespace_import_default,
		purity: purity_default,
		refs: refs_default,
		"rules-of-hooks": rule,
		"set-state-in-effect": set_state_in_effect_default,
		"set-state-in-render": set_state_in_render_default,
		"unsupported-syntax": unsupported_syntax_default,
		"use-memo": use_memo_default,
		"use-state": use_state_default
	}
};

//#endregion
//#region src/configs/recommended.ts
var recommended_exports = /* @__PURE__ */ __exportAll({
	name: () => name$5,
	plugins: () => plugins$5,
	rules: () => rules$6,
	settings: () => settings$5
});
const name$5 = "react-x/recommended";
const rules$6 = {
	"react-x/component-hook-factories": "error",
	"react-x/error-boundaries": "error",
	"react-x/exhaustive-deps": "warn",
	"react-x/no-access-state-in-setstate": "error",
	"react-x/no-array-index-key": "warn",
	"react-x/no-children-count": "warn",
	"react-x/no-children-for-each": "warn",
	"react-x/no-children-map": "warn",
	"react-x/no-children-only": "warn",
	"react-x/no-children-to-array": "warn",
	"react-x/no-clone-element": "warn",
	"react-x/no-component-will-mount": "error",
	"react-x/no-component-will-receive-props": "error",
	"react-x/no-component-will-update": "error",
	"react-x/no-context-provider": "warn",
	"react-x/no-create-ref": "error",
	"react-x/no-direct-mutation-state": "error",
	"react-x/no-forward-ref": "warn",
	"react-x/no-missing-key": "error",
	"react-x/no-nested-component-definitions": "error",
	"react-x/no-nested-lazy-component-declarations": "error",
	"react-x/no-redundant-should-component-update": "error",
	"react-x/no-set-state-in-component-did-mount": "warn",
	"react-x/no-set-state-in-component-did-update": "warn",
	"react-x/no-set-state-in-component-will-update": "warn",
	"react-x/no-unnecessary-use-prefix": "warn",
	"react-x/no-unsafe-component-will-mount": "warn",
	"react-x/no-unsafe-component-will-receive-props": "warn",
	"react-x/no-unsafe-component-will-update": "warn",
	"react-x/no-unused-class-component-members": "warn",
	"react-x/no-use-context": "warn",
	"react-x/purity": "warn",
	"react-x/rules-of-hooks": "error",
	"react-x/set-state-in-effect": "warn",
	"react-x/set-state-in-render": "error",
	"react-x/unsupported-syntax": "error",
	"react-x/use-memo": "error",
	"react-x/use-state": "warn"
};
const plugins$5 = { "react-x": plugin };
const settings$5 = { "react-x": DEFAULT_ESLINT_REACT_SETTINGS };

//#endregion
//#region src/configs/_ts.ts
/**
* Disables rules that are already handled by TypeScript
*/
const rules$5 = {};

//#endregion
//#region src/configs/recommended-typescript.ts
var recommended_typescript_exports = /* @__PURE__ */ __exportAll({
	name: () => name$4,
	plugins: () => plugins$4,
	rules: () => rules$4,
	settings: () => settings$4
});
const name$4 = "react-x/recommended-typescript";
const rules$4 = {
	...rules$6,
	...rules$5
};
const plugins$4 = { ...plugins$5 };
const settings$4 = { ...settings$5 };

//#endregion
//#region src/configs/recommended-type-checked.ts
var recommended_type_checked_exports = /* @__PURE__ */ __exportAll({
	name: () => name$3,
	plugins: () => plugins$3,
	rules: () => rules$3,
	settings: () => settings$3
});
const name$3 = "react-x/recommended-type-checked";
const rules$3 = {
	...rules$4,
	"react-x/no-leaked-conditional-rendering": "error"
};
const plugins$3 = { ...plugins$4 };
const settings$3 = { ...settings$4 };

//#endregion
//#region src/configs/strict.ts
var strict_exports = /* @__PURE__ */ __exportAll({
	name: () => name$2,
	plugins: () => plugins$2,
	rules: () => rules$2,
	settings: () => settings$2
});
const name$2 = "react-x/strict";
const rules$2 = {
	...rules$6,
	"react-x/no-class-component": "error",
	"react-x/no-misused-capture-owner-stack": "error",
	"react-x/no-unnecessary-use-callback": "warn",
	"react-x/no-unnecessary-use-memo": "warn",
	"react-x/no-unstable-context-value": "warn",
	"react-x/no-unstable-default-props": "warn",
	"react-x/no-unused-state": "warn",
	"react-x/prefer-destructuring-assignment": "warn"
};
const plugins$2 = { ...plugins$5 };
const settings$2 = { ...settings$5 };

//#endregion
//#region src/configs/strict-typescript.ts
var strict_typescript_exports = /* @__PURE__ */ __exportAll({
	name: () => name$1,
	plugins: () => plugins$1,
	rules: () => rules$1,
	settings: () => settings$1
});
const name$1 = "react-x/strict-typescript";
const rules$1 = {
	...rules$2,
	...rules$5
};
const plugins$1 = { ...plugins$2 };
const settings$1 = { ...settings$2 };

//#endregion
//#region src/configs/strict-type-checked.ts
var strict_type_checked_exports = /* @__PURE__ */ __exportAll({
	name: () => name,
	plugins: () => plugins,
	rules: () => rules,
	settings: () => settings
});
const name = "react-x/strict-type-checked";
const rules = {
	...rules$1,
	"react-x/no-leaked-conditional-rendering": "error",
	"react-x/no-unused-props": "warn"
};
const plugins = { ...plugins$1 };
const settings = { ...settings$1 };

//#endregion
//#region src/index.ts
const finalPlugin = {
	...plugin,
	configs: {
		["disable-conflict-eslint-plugin-react"]: disable_conflict_eslint_plugin_react_exports,
		["disable-conflict-eslint-plugin-react-hooks"]: disable_conflict_eslint_plugin_react_hooks_exports,
		["disable-experimental"]: disable_experimental_exports,
		["disable-type-checked"]: disable_type_checked_exports,
		["recommended"]: recommended_exports,
		["recommended-type-checked"]: recommended_type_checked_exports,
		["recommended-typescript"]: recommended_typescript_exports,
		["strict"]: strict_exports,
		["strict-type-checked"]: strict_type_checked_exports,
		["strict-typescript"]: strict_typescript_exports
	}
};

//#endregion
export { finalPlugin as default };