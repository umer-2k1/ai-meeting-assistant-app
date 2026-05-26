import * as ast from "@eslint-react/ast";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { findVariable } from "@typescript-eslint/utils/ast-utils";
import { P, match } from "ts-pattern";
import { JsxDetectionHint, isJsxLike } from "@eslint-react/jsx";
import { IdGenerator, RE_COMPONENT_NAME, RE_COMPONENT_NAME_LOOSE } from "@eslint-react/shared";

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
* Reverses the order of arguments for a curried function.
*
* @param f - The function to flip.
* @returns A new function with the argument order reversed.
* @example
* ```ts
* import * as assert from "node:assert"
* import { flip } from "effect/Function"
*
* const f = (a: number) => (b: string) => a - b.length
*
* assert.deepStrictEqual(flip(f)('aaa')(2), -1)
* ```
*
* @since 1.0.0
*/
const flip = (f) => (...b) => (...a) => f(...a)(...b);
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

//#endregion
//#region src/api/find-import-source.ts
/**
* Get the arguments of a require expression
* @param node The node to match
* @returns The require expression arguments or null if the node is not a require expression
* @internal
*/
function getRequireExpressionArguments(node) {
	return match(node).with({
		type: AST_NODE_TYPES.CallExpression,
		arguments: P.select(),
		callee: {
			type: AST_NODE_TYPES.Identifier,
			name: "require"
		}
	}, identity).with({
		type: AST_NODE_TYPES.MemberExpression,
		object: P.select()
	}, getRequireExpressionArguments).otherwise(() => null);
}
/**
* Find the import source of a variable
* @param name The variable name
* @param initialScope The initial scope to search
* @returns The import source or null if not found
*/
function findImportSource(name, initialScope) {
	return findImportSourceImpl(name, initialScope, /* @__PURE__ */ new Set());
}
function findImportSourceImpl(name, initialScope, visited) {
	if (visited.has(name)) return null;
	visited.add(name);
	const latestDef = findVariable(initialScope, name)?.defs.at(-1);
	if (latestDef == null) return null;
	const { node, parent } = latestDef;
	if (node.type === AST_NODE_TYPES.VariableDeclarator && node.init != null) {
		const { init } = node;
		if (init.type === AST_NODE_TYPES.MemberExpression && init.object.type === AST_NODE_TYPES.Identifier) return findImportSourceImpl(init.object.name, initialScope, visited);
		if (init.type === AST_NODE_TYPES.Identifier) return findImportSourceImpl(init.name, initialScope, visited);
		const arg0 = getRequireExpressionArguments(init)?.[0];
		if (arg0 == null || !ast.isLiteral(arg0, "string")) return null;
		return arg0.value;
	}
	if (parent?.type === AST_NODE_TYPES.ImportDeclaration) return parent.source.value;
	return null;
}

//#endregion
//#region src/api/is-from-react.ts
/**
* Check if a variable is initialized from React import
* @param name The variable name
* @param initialScope The initial scope
* @param importSource Alternative import source of React (ex: "preact/compat")
* @returns True if the variable is initialized or derived from React import
*/
function isInitializedFromReact(name, initialScope, importSource = "react") {
	return name.toLowerCase() === "react" || Boolean(findImportSource(name, initialScope)?.startsWith(importSource));
}

//#endregion
//#region src/api/is-from-react-native.ts
/**
* if a variable is initialized from React Native import
* @param name The variable name
* @param initialScope The initial scope
* @param importSource Alternative import source of React Native (ex: "react-native-web")
* @returns True if the variable is initialized from React Native import
*/
function isInitializedFromReactNative(name, initialScope, importSource = "react-native") {
	return [
		"react_native",
		"reactnative",
		"rn"
	].includes(name.toLowerCase()) || Boolean(findImportSource(name, initialScope)?.startsWith(importSource));
}

//#endregion
//#region src/api/is-react-api.ts
/**
* Check if the node is a React API identifier or member expression
* @param api The React API name to check against (ex: "useState", "React.memo")
* @returns A predicate function to check if a node matches the API
*/
function isReactAPI(api) {
	const func = (context, node) => {
		if (node == null) return false;
		const getText = (n) => context.sourceCode.getText(n);
		const name = ast.getFullyQualifiedName(node, getText);
		if (name === api) return true;
		if (name.endsWith(`.${api}`)) return true;
		return false;
	};
	return dual(2, func);
}
/**
* Check if the node is a call expression to a specific React API
* @param api The React API name to check against
* @returns A predicate function to check if a node is a call to the API
*/
function isReactAPICall(api) {
	const func = (context, node) => {
		if (node == null) return false;
		if (node.type !== AST_NODE_TYPES.CallExpression) return false;
		return isReactAPI(api)(context, ast.getUnderlyingExpression(node.callee));
	};
	return dual(2, func);
}
const isCaptureOwnerStack = isReactAPI("captureOwnerStack");
const isChildrenCount = isReactAPI("Children.count");
const isChildrenForEach = isReactAPI("Children.forEach");
const isChildrenMap = isReactAPI("Children.map");
const isChildrenOnly = isReactAPI("Children.only");
const isChildrenToArray = isReactAPI("Children.toArray");
const isCloneElement = isReactAPI("cloneElement");
const isCreateContext = isReactAPI("createContext");
const isCreateElement = isReactAPI("createElement");
const isCreateRef = isReactAPI("createRef");
const isForwardRef = isReactAPI("forwardRef");
const isMemo = isReactAPI("memo");
const isLazy = isReactAPI("lazy");
const isCaptureOwnerStackCall = isReactAPICall("captureOwnerStack");
const isChildrenCountCall = isReactAPICall("Children.count");
const isChildrenForEachCall = isReactAPICall("Children.forEach");
const isChildrenMapCall = isReactAPICall("Children.map");
const isChildrenOnlyCall = isReactAPICall("Children.only");
const isChildrenToArrayCall = isReactAPICall("Children.toArray");
const isCloneElementCall = isReactAPICall("cloneElement");
const isCreateContextCall = isReactAPICall("createContext");
const isCreateElementCall = isReactAPICall("createElement");
const isCreateRefCall = isReactAPICall("createRef");
const isForwardRefCall = isReactAPICall("forwardRef");
const isMemoCall = isReactAPICall("memo");
const isLazyCall = isReactAPICall("lazy");

//#endregion
//#region src/hook/hook-name.ts
const REACT_BUILTIN_HOOK_NAMES = [
	"use",
	"useActionState",
	"useCallback",
	"useContext",
	"useDebugValue",
	"useDeferredValue",
	"useEffect",
	"useFormStatus",
	"useId",
	"useImperativeHandle",
	"useInsertionEffect",
	"useLayoutEffect",
	"useMemo",
	"useOptimistic",
	"useReducer",
	"useRef",
	"useState",
	"useSyncExternalStore",
	"useTransition"
];
/**
* Catch all identifiers that begin with "use" followed by an uppercase Latin
* character to exclude identifiers like "user".
* @param name The name of the identifier to check.
* @see https://github.com/facebook/react/blob/1d6c8168db1d82713202e842df3167787ffa00ed/packages/eslint-plugin-react-hooks/src/rules/RulesOfHooks.ts#L16
*/
function isHookName(name) {
	return name === "use" || /^use[A-Z0-9]/.test(name);
}

//#endregion
//#region src/hook/hook-is.ts
/**
* Determine if a function node is a React Hook based on its name.
* @param node The function node to check
* @returns True if the function is a React Hook, false otherwise
*/
function isHookDefinition(node) {
	if (node == null) return false;
	const id = ast.getFunctionId(node);
	switch (id?.type) {
		case AST_NODE_TYPES.Identifier: return isHookName(id.name);
		case AST_NODE_TYPES.MemberExpression: return "name" in id.property && isHookName(id.property.name);
		default: return false;
	}
}
/**
* Check if the given node is a React Hook call by its name.
* @param node The node to check.
* @returns `true` if the node is a React Hook call, `false` otherwise.
*/
function isHookCall(node) {
	if (node == null) return false;
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	if (node.callee.type === AST_NODE_TYPES.Identifier) return isHookName(node.callee.name);
	if (node.callee.type === AST_NODE_TYPES.MemberExpression) return node.callee.property.type === AST_NODE_TYPES.Identifier && isHookName(node.callee.property.name);
	return false;
}
/**
* Check if a node is a call to a specific React hook.
* Returns a function that accepts a hook name to check against.
* @param node The AST node to check
* @returns A function that takes a hook name and returns boolean
*/
function isHookCallWithName(node) {
	if (node == null || node.type !== AST_NODE_TYPES.CallExpression) return constFalse;
	return (name) => {
		switch (node.callee.type) {
			case AST_NODE_TYPES.Identifier: return node.callee.name === name;
			case AST_NODE_TYPES.MemberExpression: return node.callee.property.type === AST_NODE_TYPES.Identifier && node.callee.property.name === name;
			default: return false;
		}
	};
}
/**
* Detect useEffect calls and variations (useLayoutEffect, etc.) using a regex pattern
* @param node The AST node to check
* @param additionalEffectHooks Regex pattern matching custom hooks that should be treated as effect hooks
* @returns True if the node is a useEffect-like call
*/
function isUseEffectLikeCall(node, additionalEffectHooks = { test: constFalse }) {
	if (node == null) return false;
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	return [/^use\w*Effect$/u, additionalEffectHooks].some((regexp) => {
		if (node.callee.type === AST_NODE_TYPES.Identifier) return regexp.test(node.callee.name);
		if (node.callee.type === AST_NODE_TYPES.MemberExpression) return node.callee.property.type === AST_NODE_TYPES.Identifier && regexp.test(node.callee.property.name);
		return false;
	});
}
/**
* Detect useState calls and variations (useCustomState, etc.) using a regex pattern
* @param node The AST node to check
* @param additionalStateHooks Regex pattern matching custom hooks that should be treated as state hooks
* @returns True if the node is a useState-like call
*/
function isUseStateLikeCall(node, additionalStateHooks = { test: constFalse }) {
	if (node == null) return false;
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	switch (true) {
		case node.callee.type === AST_NODE_TYPES.Identifier: return node.callee.name === "useState" || additionalStateHooks.test(node.callee.name);
		case node.callee.type === AST_NODE_TYPES.MemberExpression && node.callee.property.type === AST_NODE_TYPES.Identifier: return ast.getPropertyName(node.callee.property) === "useState" || additionalStateHooks.test(node.callee.property.name);
	}
	return false;
}
const isUseCall = flip(isHookCallWithName)("use");
const isUseActionStateCall = flip(isHookCallWithName)("useActionState");
const isUseCallbackCall = flip(isHookCallWithName)("useCallback");
const isUseContextCall = flip(isHookCallWithName)("useContext");
const isUseDebugValueCall = flip(isHookCallWithName)("useDebugValue");
const isUseDeferredValueCall = flip(isHookCallWithName)("useDeferredValue");
const isUseEffectCall = flip(isHookCallWithName)("useEffect");
const isUseFormStatusCall = flip(isHookCallWithName)("useFormStatus");
const isUseIdCall = flip(isHookCallWithName)("useId");
const isUseImperativeHandleCall = flip(isHookCallWithName)("useImperativeHandle");
const isUseInsertionEffectCall = flip(isHookCallWithName)("useInsertionEffect");
const isUseLayoutEffectCall = flip(isHookCallWithName)("useLayoutEffect");
const isUseMemoCall = flip(isHookCallWithName)("useMemo");
const isUseOptimisticCall = flip(isHookCallWithName)("useOptimistic");
const isUseReducerCall = flip(isHookCallWithName)("useReducer");
const isUseRefCall = flip(isHookCallWithName)("useRef");
const isUseStateCall = flip(isHookCallWithName)("useState");
const isUseSyncExternalStoreCall = flip(isHookCallWithName)("useSyncExternalStore");
const isUseTransitionCall = flip(isHookCallWithName)("useTransition");

//#endregion
//#region src/hook/hook-callback.ts
/**
* Determine if a node is the setup function passed to a useEffect-like hook
* @param node The AST node to check
*/
function isUseEffectSetupCallback(node) {
	if (node == null) return false;
	return node.parent?.type === AST_NODE_TYPES.CallExpression && node.parent.arguments.at(0) === node && isUseEffectLikeCall(node.parent);
}
/**
* Determine if a node is the cleanup function returned by a useEffect-like hook's setup function
* @param node The AST node to check
*/
function isUseEffectCleanupCallback(node) {
	if (node == null) return false;
	const returnStatement = ast.findParent(node, ast.is(AST_NODE_TYPES.ReturnStatement));
	const enclosingFunction = ast.findParent(node, ast.isFunction);
	if (enclosingFunction !== ast.findParent(returnStatement, ast.isFunction)) return false;
	return isUseEffectSetupCallback(enclosingFunction);
}

//#endregion
//#region src/hook/hook-id.ts
/**
* Checks if the given node is a hook identifier
* @param id The AST node to check
* @returns `true` if the node is a hook identifier or member expression with hook name, `false` otherwise
*/
function isHookId(id) {
	switch (id.type) {
		case AST_NODE_TYPES.Identifier: return isHookName(id.name);
		case AST_NODE_TYPES.MemberExpression: return "name" in id.property && isHookName(id.property.name);
		default: return false;
	}
}

//#endregion
//#region src/hook/hook-collector.ts
const idGen$2 = new IdGenerator("hook:");
/**
* Get an api and visitor object for the rule to collect hooks
* @param context The ESLint rule context
* @returns The api and visitor of the collector
*/
function getHookCollector(context) {
	const hooks = /* @__PURE__ */ new Map();
	const functionEntries = [];
	const getText = (n) => context.sourceCode.getText(n);
	const getCurrentEntry = () => functionEntries.at(-1) ?? null;
	const onFunctionEnter = (node) => {
		const id = ast.getFunctionId(node);
		const key = idGen$2.next();
		functionEntries.push({
			key,
			node
		});
		if (id == null || !isHookId(id)) return;
		hooks.set(key, {
			id,
			key,
			kind: "hook",
			name: ast.getFullyQualifiedName(id, getText),
			directives: [],
			flag: 0n,
			hint: 0n,
			hookCalls: [],
			node
		});
	};
	const onFunctionExit = () => {
		functionEntries.pop();
	};
	return {
		api: { getAllHooks(node) {
			return [...hooks.values()];
		} },
		visitor: {
			":function": onFunctionEnter,
			":function:exit": onFunctionExit,
			CallExpression(node) {
				if (!isHookCall(node)) return;
				const entry = getCurrentEntry();
				if (entry == null) return;
				hooks.get(entry.key)?.hookCalls.push(node);
			}
		}
	};
}

//#endregion
//#region src/component/component-detection-legacy.ts
function isClassComponent(node, context) {
	if ("superClass" in node && node.superClass != null) {
		const re = /^(?:Pure)?Component$/u;
		switch (true) {
			case node.superClass.type === AST_NODE_TYPES.Identifier:
				if (!re.test(node.superClass.name)) return false;
				if (context == null) return true;
				return isInitializedFromReact(node.superClass.name, context.sourceCode.getScope(node), "react");
			case node.superClass.type === AST_NODE_TYPES.MemberExpression && node.superClass.property.type === AST_NODE_TYPES.Identifier:
				if (!re.test(node.superClass.property.name)) return false;
				if (context == null) return true;
				if (node.superClass.object.type === AST_NODE_TYPES.Identifier) return isInitializedFromReact(node.superClass.object.name, context.sourceCode.getScope(node), "react");
				return true;
		}
	}
	return false;
}
/**
* Check if a node is a React PureComponent
* @param node The AST node to check
* @returns `true` if the node is a PureComponent, `false` otherwise
*/
function isPureComponent(node) {
	if ("superClass" in node && node.superClass != null) {
		const re = /^PureComponent$/u;
		switch (true) {
			case node.superClass.type === AST_NODE_TYPES.Identifier: return re.test(node.superClass.name);
			case node.superClass.type === AST_NODE_TYPES.MemberExpression && node.superClass.property.type === AST_NODE_TYPES.Identifier: return re.test(node.superClass.property.name);
		}
	}
	return false;
}
/**
* Create a lifecycle method checker function
* @param methodName The lifecycle method name
* @param isStatic Whether the method is static
*/
function createLifecycleChecker(methodName, isStatic = false) {
	return (node) => ast.isMethodOrProperty(node) && node.static === isStatic && node.key.type === AST_NODE_TYPES.Identifier && node.key.name === methodName;
}
const isRender = createLifecycleChecker("render");
const isComponentDidCatch = createLifecycleChecker("componentDidCatch");
const isComponentDidMount = createLifecycleChecker("componentDidMount");
const isComponentDidUpdate = createLifecycleChecker("componentDidUpdate");
const isComponentWillMount = createLifecycleChecker("componentWillMount");
const isComponentWillReceiveProps = createLifecycleChecker("componentWillReceiveProps");
const isComponentWillUnmount = createLifecycleChecker("componentWillUnmount");
const isComponentWillUpdate = createLifecycleChecker("componentWillUpdate");
const isGetChildContext = createLifecycleChecker("getChildContext");
const isGetInitialState = createLifecycleChecker("getInitialState");
const isGetSnapshotBeforeUpdate = createLifecycleChecker("getSnapshotBeforeUpdate");
const isShouldComponentUpdate = createLifecycleChecker("shouldComponentUpdate");
const isUnsafeComponentWillMount = createLifecycleChecker("UNSAFE_componentWillMount");
const isUnsafeComponentWillReceiveProps = createLifecycleChecker("UNSAFE_componentWillReceiveProps");
const isUnsafeComponentWillUpdate = createLifecycleChecker("UNSAFE_componentWillUpdate");
const isGetDefaultProps = createLifecycleChecker("getDefaultProps", true);
const isGetDerivedStateFromProps = createLifecycleChecker("getDerivedStateFromProps", true);
const isGetDerivedStateFromError = createLifecycleChecker("getDerivedStateFromError", true);
/**
* Check if the given node is a componentDidMount callback
* @param node The node to check
* @returns True if the node is a componentDidMount callback, false otherwise
*/
function isComponentDidMountCallback(node) {
	return ast.isFunction(node) && isComponentDidMount(node.parent) && node.parent.value === node;
}
/**
* Check if the given node is a componentWillUnmount callback
* @param node The node to check
* @returns True if the node is a componentWillUnmount callback, false otherwise
*/
function isComponentWillUnmountCallback(node) {
	return ast.isFunction(node) && isComponentWillUnmount(node.parent) && node.parent.value === node;
}
/**
* Check whether given node is a render method of a class component
* @example
* ```tsx
* class Component extends React.Component {
*   renderHeader = () => <div />;
*   renderFooter = () => <div />;
* }
* ```
* @param node The AST node to check
* @returns `true` if node is a render function, `false` if not
*/
function isRenderMethodLike(node) {
	return ast.isMethodOrProperty(node) && node.key.type === AST_NODE_TYPES.Identifier && node.key.name.startsWith("render") && ast.isOneOf([AST_NODE_TYPES.ClassDeclaration, AST_NODE_TYPES.ClassExpression])(node.parent.parent);
}
/**
* Check if the given node is a function within a render method of a class component
*
* @param node The AST node to check
* @returns `true` if the node is a render function inside a class component
*
* @example
* ```tsx
* class Component extends React.Component {
*   renderHeader = () => <div />; // Returns true
* }
* ```
*/
function isRenderMethodCallback(node) {
	const parent = node.parent;
	const greatGrandparent = parent.parent?.parent;
	return greatGrandparent != null && isRenderMethodLike(parent) && isClassComponent(greatGrandparent);
}
/**
* Check whether the given node is a this.setState() call
* @param node The node to check
* @internal
*/
function isThisSetStateCall(node) {
	const { callee } = node;
	return callee.type === AST_NODE_TYPES.MemberExpression && ast.isThisExpressionLoose(callee.object) && callee.property.type === AST_NODE_TYPES.Identifier && callee.property.name === "setState";
}
/**
* Check whether the given node is an assignment to this.state
* @param node The node to check
* @internal
*/
function isAssignmentToThisState(node) {
	const { left } = node;
	return left.type === AST_NODE_TYPES.MemberExpression && ast.isThisExpressionLoose(left.object) && ast.getPropertyName(left.property) === "state";
}

//#endregion
//#region src/component/component-wrapper.ts
/**
* Check if the node is a call expression for a component wrapper
* @param context The ESLint rule context
* @param node The node to check
* @returns `true` if the node is a call expression for a component wrapper
*/
function isComponentWrapperCall(context, node) {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	return isMemoCall(context, node) || isForwardRefCall(context, node);
}
/**
* Check if the node is a callback function passed to a component wrapper
* @param context The ESLint rule context
* @param node The node to check
* @returns `true` if the node is a callback function passed to a component wrapper
*/
/**
* Check if the node is a call expression for a component wrapper loosely
* @param context The ESLint rule context
* @param node The node to check
* @returns `true` if the node is a call expression for a component wrapper loosely
*/
function isComponentWrapperCallLoose(context, node) {
	if (node.type !== AST_NODE_TYPES.CallExpression) return false;
	return isComponentWrapperCall(context, node) || isUseCallbackCall(node);
}
/**
* Check if the node is a callback function passed to a component wrapper
* @param context The ESLint rule context
* @param node The node to check
* @returns `true` if the node is a callback function passed to a component wrapper
*/
function isComponentWrapperCallback(context, node) {
	if (!ast.isFunction(node)) return false;
	let parent = node.parent;
	while (ast.isTypeExpression(parent)) parent = parent.parent;
	if (parent.type !== AST_NODE_TYPES.CallExpression) return false;
	return isComponentWrapperCall(context, parent);
}
/**
* Check if the node is a callback function passed to a component wrapper loosely
* @param context The ESLint rule context
* @param node The node to check
* @returns `true` if the node is a callback function passed to a component wrapper loosely
*/
function isComponentWrapperCallbackLoose(context, node) {
	if (!ast.isFunction(node)) return false;
	let parent = node.parent;
	while (ast.isTypeExpression(parent)) parent = parent.parent;
	if (parent.type !== AST_NODE_TYPES.CallExpression) return false;
	return isComponentWrapperCallLoose(context, parent);
}

//#endregion
//#region src/component/component-id.ts
/**
* Get function component identifier from `const Component = memo(() => {});`
* @param context The rule context
* @param node The function node to analyze
* @returns The function identifier or `null` if not found
*/
function getFunctionComponentId(context, node) {
	const functionId = ast.getFunctionId(node);
	if (functionId != null) return functionId;
	let parent = node.parent;
	while (ast.isTypeExpression(parent)) parent = parent.parent;
	if (parent.type === AST_NODE_TYPES.CallExpression && isComponentWrapperCallLoose(context, parent) && parent.parent.type === AST_NODE_TYPES.VariableDeclarator) return parent.parent.id;
	if (parent.type === AST_NODE_TYPES.CallExpression && isComponentWrapperCallLoose(context, parent) && parent.parent.type === AST_NODE_TYPES.CallExpression && isComponentWrapperCallLoose(context, parent.parent) && parent.parent.parent.type === AST_NODE_TYPES.VariableDeclarator) return parent.parent.parent.id;
	return null;
}

//#endregion
//#region src/component/component-name.ts
/**
* Check if a string matches the strict component name pattern
* @param name The name to check
*/
function isComponentName(name) {
	return RE_COMPONENT_NAME.test(name);
}
/**
* Check if a string matches the loose component name pattern
* @param name The name to check
*/
function isComponentNameLoose(name) {
	return RE_COMPONENT_NAME_LOOSE.test(name);
}
/**
* Check if a function has a loose component name
* @param context The rule context
* @param fn The function to check
* @param allowNone Whether to allow no name
* @returns Whether the function has a loose component name
*/
function isFunctionWithLooseComponentName(context, fn, allowNone = false) {
	const id = getFunctionComponentId(context, fn);
	if (id == null) return allowNone;
	if (id.type === AST_NODE_TYPES.Identifier) return isComponentNameLoose(id.name);
	if (id.type === AST_NODE_TYPES.MemberExpression && id.property.type === AST_NODE_TYPES.Identifier) return isComponentNameLoose(id.property.name);
	return false;
}

//#endregion
//#region src/component/component-detection.ts
/**
* Hints for component collector
*/
const ComponentDetectionHint = {
	...JsxDetectionHint,
	DoNotIncludeFunctionDefinedAsClassMethod: 1n << 11n,
	DoNotIncludeFunctionDefinedAsClassProperty: 1n << 12n,
	DoNotIncludeFunctionDefinedAsObjectMethod: 1n << 13n,
	DoNotIncludeFunctionDefinedAsArrayExpressionElement: 1n << 14n,
	DoNotIncludeFunctionDefinedAsArrayPatternElement: 1n << 15n,
	DoNotIncludeFunctionDefinedAsArbitraryCallExpressionCallback: 1n << 18n,
	DoNotIncludeFunctionDefinedAsArrayFlatMapCallback: 1n << 16n,
	DoNotIncludeFunctionDefinedAsArrayMapCallback: 1n << 17n
};
/**
* Default component detection hint
*/
const DEFAULT_COMPONENT_DETECTION_HINT = 0n | ComponentDetectionHint.DoNotIncludeJsxWithBigIntValue | ComponentDetectionHint.DoNotIncludeJsxWithBooleanValue | ComponentDetectionHint.DoNotIncludeJsxWithNumberValue | ComponentDetectionHint.DoNotIncludeJsxWithStringValue | ComponentDetectionHint.DoNotIncludeJsxWithUndefinedValue | ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArbitraryCallExpressionCallback | ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayExpressionElement | ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayFlatMapCallback | ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayMapCallback | ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayPatternElement | ComponentDetectionHint.RequireAllArrayElementsToBeJsx | ComponentDetectionHint.RequireBothBranchesOfConditionalExpressionToBeJsx | ComponentDetectionHint.RequireBothSidesOfLogicalExpressionToBeJsx;
/**
* Determine if a function node represents a valid React component definition
*
* @param context The rule context
* @param node The function node to analyze
* @param hint Component detection hints (bit flags) to customize detection logic
* @returns `true` if the node is considered a component definition
*/
function isComponentDefinition(context, node, hint) {
	if (!isFunctionWithLooseComponentName(context, node, true)) return false;
	switch (true) {
		case node.parent.type === AST_NODE_TYPES.CallExpression && isCreateElementCall(context, node.parent) && node.parent.arguments.slice(2).some((arg) => arg === node): return false;
		case isRenderMethodCallback(node): return false;
	}
	let parent = node.parent;
	while (ast.isTypeExpression(parent)) parent = parent.parent;
	switch (true) {
		case ast.isOneOf([AST_NODE_TYPES.ArrowFunctionExpression, AST_NODE_TYPES.FunctionExpression])(node) && parent.type === AST_NODE_TYPES.Property && parent.parent.type === AST_NODE_TYPES.ObjectExpression:
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsObjectMethod) return false;
			break;
		case ast.isOneOf([AST_NODE_TYPES.ArrowFunctionExpression, AST_NODE_TYPES.FunctionExpression])(node) && parent.type === AST_NODE_TYPES.MethodDefinition:
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsClassMethod) return false;
			break;
		case ast.isOneOf([AST_NODE_TYPES.ArrowFunctionExpression, AST_NODE_TYPES.FunctionExpression])(node) && parent.type === AST_NODE_TYPES.Property:
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsClassProperty) return false;
			break;
		case parent.type === AST_NODE_TYPES.ArrayPattern:
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayPatternElement) return false;
			break;
		case parent.type === AST_NODE_TYPES.ArrayExpression:
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayExpressionElement) return false;
			break;
		case parent.type === AST_NODE_TYPES.CallExpression && parent.callee.type === AST_NODE_TYPES.MemberExpression && parent.callee.property.type === AST_NODE_TYPES.Identifier && parent.callee.property.name === "map":
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayMapCallback) return false;
			break;
		case parent.type === AST_NODE_TYPES.CallExpression && parent.callee.type === AST_NODE_TYPES.MemberExpression && parent.callee.property.type === AST_NODE_TYPES.Identifier && parent.callee.property.name === "flatMap":
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArrayFlatMapCallback) return false;
			break;
		case parent.type === AST_NODE_TYPES.CallExpression && ast.getFunctionId(node) == null && !isComponentWrapperCallLoose(context, parent) && !isCreateElementCall(context, parent):
			if (hint & ComponentDetectionHint.DoNotIncludeFunctionDefinedAsArbitraryCallExpressionCallback) return false;
			break;
	}
	const significantParent = ast.findParent(node, ast.isOneOf([
		AST_NODE_TYPES.JSXExpressionContainer,
		AST_NODE_TYPES.ArrowFunctionExpression,
		AST_NODE_TYPES.FunctionExpression,
		AST_NODE_TYPES.Property,
		AST_NODE_TYPES.ClassBody
	]));
	if (significantParent == null) return true;
	if (significantParent.type === AST_NODE_TYPES.JSXExpressionContainer) return false;
	return true;
}

//#endregion
//#region src/component/component-flag.ts
/**
* Component flag constants
*/
const ComponentFlag = {
	None: 0n,
	PureComponent: 1n << 0n,
	CreateElement: 1n << 1n,
	Memo: 1n << 2n,
	ForwardRef: 1n << 3n
};
/**
* Get component flag from init path
* @param initPath The init path of the function component
* @returns The component flag
*/
function getComponentFlagFromInitPath(initPath) {
	let flag = ComponentFlag.None;
	if (initPath != null && ast.hasCallInFunctionInitPath("memo", initPath)) flag |= ComponentFlag.Memo;
	if (initPath != null && ast.hasCallInFunctionInitPath("forwardRef", initPath)) flag |= ComponentFlag.ForwardRef;
	return flag;
}

//#endregion
//#region src/component/component-collector.ts
const idGen$1 = new IdGenerator("component:");
/**
* Get an api and visitor object for the rule to collect function components
* @param context The ESLint rule context
* @param options The options to use
* @returns The api and visitor of the collector
*/
function getComponentCollector(context, options = {}) {
	const { collectDisplayName = false, hint = DEFAULT_COMPONENT_DETECTION_HINT } = options;
	const functionEntries = [];
	const components = /* @__PURE__ */ new Map();
	const getText = (n) => context.sourceCode.getText(n);
	const getCurrentEntry = () => functionEntries.at(-1) ?? null;
	const onFunctionEnter = (node) => {
		const key = idGen$1.next();
		const exp = ast.findParent(node, (n) => n.type === AST_NODE_TYPES.ExportDefaultDeclaration);
		const isExportDefault = exp != null;
		const isExportDefaultDeclaration = exp != null && ast.getUnderlyingExpression(exp.declaration) === node;
		const id = getFunctionComponentId(context, node);
		const name = id == null ? null : ast.getFullyQualifiedName(id, getText);
		const initPath = ast.getFunctionInitPath(node);
		const directives = ast.getFunctionDirectives(node);
		const entry = {
			id,
			key,
			kind: "component",
			name,
			directives,
			displayName: null,
			flag: getComponentFlagFromInitPath(initPath),
			hint,
			hookCalls: [],
			initPath,
			isComponentDefinition: isComponentDefinition(context, node, hint),
			isExportDefault,
			isExportDefaultDeclaration,
			node,
			rets: []
		};
		functionEntries.push(entry);
		if (!entry.isComponentDefinition || !isFunctionWithLooseComponentName(context, node, false)) return;
		if (directives.some((d) => d.directive === "use memo" || d.directive === "use no memo")) components.set(entry.key, entry);
	};
	const onFunctionExit = () => {
		return functionEntries.pop();
	};
	return {
		api: { getAllComponents(node) {
			return [...components.values()];
		} },
		visitor: {
			":function": onFunctionEnter,
			":function:exit": onFunctionExit,
			"ArrowFunctionExpression[body.type!='BlockStatement']"() {
				const entry = getCurrentEntry();
				if (entry == null) return;
				const { body } = entry.node;
				if (body.type === AST_NODE_TYPES.BlockStatement) return;
				entry.rets.push(body);
				if (!entry.isComponentDefinition) return;
				if (!components.has(entry.key) && !isJsxLike(context, body, hint)) return;
				components.set(entry.key, entry);
			},
			...collectDisplayName ? { [ast.SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION](node) {
				const { left, right } = node;
				if (left.type !== AST_NODE_TYPES.MemberExpression) return;
				const componentName = left.object.type === AST_NODE_TYPES.Identifier ? left.object.name : null;
				const component = [...components.values()].findLast(({ name }) => name != null && name === componentName);
				if (component == null) return;
				component.displayName = right;
			} } : {},
			CallExpression(node) {
				if (!isHookCall(node)) return;
				const entry = getCurrentEntry();
				if (entry == null) return;
				entry.hookCalls.push(node);
				if (!entry.isComponentDefinition) return;
				components.set(entry.key, entry);
			},
			ReturnStatement(node) {
				const entry = getCurrentEntry();
				if (entry == null) return;
				entry.rets.push(node.argument);
				if (!entry.isComponentDefinition) return;
				const { argument } = node;
				if (!components.has(entry.key) && !isJsxLike(context, argument, hint)) return;
				components.set(entry.key, entry);
			}
		}
	};
}

//#endregion
//#region src/component/component-collector-legacy.ts
const idGen = new IdGenerator("class-component:");
/**
* Get an api and visitor object for the rule to collect class components
* @param context The ESLint rule context
* @returns The api and visitor of the collector
*/
function getComponentCollectorLegacy(context) {
	const components = /* @__PURE__ */ new Map();
	const api = { getAllComponents(node) {
		return [...components.values()];
	} };
	const getText = (n) => context.sourceCode.getText(n);
	const collect = (node) => {
		if (!isClassComponent(node)) return;
		const id = ast.getClassId(node);
		const key = idGen.next();
		const name = id == null ? null : ast.getFullyQualifiedName(id, getText);
		const flag = isPureComponent(node) ? ComponentFlag.PureComponent : ComponentFlag.None;
		components.set(key, {
			id,
			key,
			kind: "class-component",
			name,
			displayName: null,
			flag,
			hint: 0n,
			methods: [],
			node
		});
	};
	return {
		api,
		visitor: {
			ClassDeclaration: collect,
			ClassExpression: collect
		}
	};
}

//#endregion
export { ComponentDetectionHint, ComponentFlag, DEFAULT_COMPONENT_DETECTION_HINT, REACT_BUILTIN_HOOK_NAMES, findImportSource, getComponentCollector, getComponentCollectorLegacy, getComponentFlagFromInitPath, getFunctionComponentId, getHookCollector, isAssignmentToThisState, isCaptureOwnerStack, isCaptureOwnerStackCall, isChildrenCount, isChildrenCountCall, isChildrenForEach, isChildrenForEachCall, isChildrenMap, isChildrenMapCall, isChildrenOnly, isChildrenOnlyCall, isChildrenToArray, isChildrenToArrayCall, isClassComponent, isCloneElement, isCloneElementCall, isComponentDefinition, isComponentDidCatch, isComponentDidMount, isComponentDidMountCallback, isComponentDidUpdate, isComponentName, isComponentNameLoose, isComponentWillMount, isComponentWillReceiveProps, isComponentWillUnmount, isComponentWillUnmountCallback, isComponentWillUpdate, isComponentWrapperCall, isComponentWrapperCallLoose, isComponentWrapperCallback, isComponentWrapperCallbackLoose, isCreateContext, isCreateContextCall, isCreateElement, isCreateElementCall, isCreateRef, isCreateRefCall, isForwardRef, isForwardRefCall, isFunctionWithLooseComponentName, isGetChildContext, isGetDefaultProps, isGetDerivedStateFromError, isGetDerivedStateFromProps, isGetInitialState, isGetSnapshotBeforeUpdate, isHookCall, isHookDefinition, isHookId, isHookName, isInitializedFromReact, isInitializedFromReactNative, isLazy, isLazyCall, isMemo, isMemoCall, isPureComponent, isReactAPI, isReactAPICall, isRender, isRenderMethodCallback, isRenderMethodLike, isShouldComponentUpdate, isThisSetStateCall, isUnsafeComponentWillMount, isUnsafeComponentWillReceiveProps, isUnsafeComponentWillUpdate, isUseActionStateCall, isUseCall, isUseCallbackCall, isUseContextCall, isUseDebugValueCall, isUseDeferredValueCall, isUseEffectCall, isUseEffectCleanupCallback, isUseEffectLikeCall, isUseEffectSetupCallback, isUseFormStatusCall, isUseIdCall, isUseImperativeHandleCall, isUseInsertionEffectCall, isUseLayoutEffectCall, isUseMemoCall, isUseOptimisticCall, isUseReducerCall, isUseRefCall, isUseStateCall, isUseStateLikeCall, isUseSyncExternalStoreCall, isUseTransitionCall };