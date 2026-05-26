import * as ast from "@eslint-react/ast";
import { TSESTree } from "@typescript-eslint/types";
import { RegExpLike, RuleContext } from "@eslint-react/shared";
import { Scope } from "@typescript-eslint/scope-manager";
import { ESLintUtils, TSESTree as TSESTree$1 } from "@typescript-eslint/utils";

//#region src/api/find-import-source.d.ts
/**
 * Find the import source of a variable
 * @param name The variable name
 * @param initialScope The initial scope to search
 * @returns The import source or null if not found
 */
declare function findImportSource(name: string, initialScope: Scope): string | null;
//#endregion
//#region src/api/is-from-react.d.ts
/**
 * Check if a variable is initialized from React import
 * @param name The variable name
 * @param initialScope The initial scope
 * @param importSource Alternative import source of React (ex: "preact/compat")
 * @returns True if the variable is initialized or derived from React import
 */
declare function isInitializedFromReact(name: string, initialScope: Scope, importSource?: string): boolean;
//#endregion
//#region src/api/is-from-react-native.d.ts
/**
 * if a variable is initialized from React Native import
 * @param name The variable name
 * @param initialScope The initial scope
 * @param importSource Alternative import source of React Native (ex: "react-native-web")
 * @returns True if the variable is initialized from React Native import
 */
declare function isInitializedFromReactNative(name: string, initialScope: Scope, importSource?: string): boolean;
//#endregion
//#region src/api/is-react-api.d.ts
declare namespace isReactAPI {
  type ReturnType = {
    (context: RuleContext, node: null | TSESTree.Node): boolean;
    (context: RuleContext): (node: null | TSESTree.Node) => boolean;
  };
}
/**
 * Check if the node is a React API identifier or member expression
 * @param api The React API name to check against (ex: "useState", "React.memo")
 * @returns A predicate function to check if a node matches the API
 */
declare function isReactAPI(api: string): isReactAPI.ReturnType;
declare namespace isReactAPICall {
  type ReturnType = {
    (context: RuleContext, node: null | TSESTree.Node): node is TSESTree.CallExpression;
    (context: RuleContext): (node: null | TSESTree.Node) => node is TSESTree.CallExpression;
  };
}
/**
 * Check if the node is a call expression to a specific React API
 * @param api The React API name to check against
 * @returns A predicate function to check if a node is a call to the API
 */
declare function isReactAPICall(api: string): isReactAPICall.ReturnType;
declare const isCaptureOwnerStack: isReactAPI.ReturnType;
declare const isChildrenCount: isReactAPI.ReturnType;
declare const isChildrenForEach: isReactAPI.ReturnType;
declare const isChildrenMap: isReactAPI.ReturnType;
declare const isChildrenOnly: isReactAPI.ReturnType;
declare const isChildrenToArray: isReactAPI.ReturnType;
declare const isCloneElement: isReactAPI.ReturnType;
declare const isCreateContext: isReactAPI.ReturnType;
declare const isCreateElement: isReactAPI.ReturnType;
declare const isCreateRef: isReactAPI.ReturnType;
declare const isForwardRef: isReactAPI.ReturnType;
declare const isMemo: isReactAPI.ReturnType;
declare const isLazy: isReactAPI.ReturnType;
declare const isCaptureOwnerStackCall: isReactAPICall.ReturnType;
declare const isChildrenCountCall: isReactAPICall.ReturnType;
declare const isChildrenForEachCall: isReactAPICall.ReturnType;
declare const isChildrenMapCall: isReactAPICall.ReturnType;
declare const isChildrenOnlyCall: isReactAPICall.ReturnType;
declare const isChildrenToArrayCall: isReactAPICall.ReturnType;
declare const isCloneElementCall: isReactAPICall.ReturnType;
declare const isCreateContextCall: isReactAPICall.ReturnType;
declare const isCreateElementCall: isReactAPICall.ReturnType;
declare const isCreateRefCall: isReactAPICall.ReturnType;
declare const isForwardRefCall: isReactAPICall.ReturnType;
declare const isMemoCall: isReactAPICall.ReturnType;
declare const isLazyCall: isReactAPICall.ReturnType;
//#endregion
//#region src/component/component-detection.d.ts
type ComponentDetectionHint = bigint;
/**
 * Hints for component collector
 */
declare const ComponentDetectionHint: {
  readonly DoNotIncludeFunctionDefinedAsClassMethod: bigint;
  readonly DoNotIncludeFunctionDefinedAsClassProperty: bigint;
  readonly DoNotIncludeFunctionDefinedAsObjectMethod: bigint;
  readonly DoNotIncludeFunctionDefinedAsArrayExpressionElement: bigint;
  readonly DoNotIncludeFunctionDefinedAsArrayPatternElement: bigint;
  readonly DoNotIncludeFunctionDefinedAsArbitraryCallExpressionCallback: bigint;
  readonly DoNotIncludeFunctionDefinedAsArrayFlatMapCallback: bigint;
  readonly DoNotIncludeFunctionDefinedAsArrayMapCallback: bigint;
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
 * Default component detection hint
 */
declare const DEFAULT_COMPONENT_DETECTION_HINT: bigint;
/**
 * Determine if a function node represents a valid React component definition
 *
 * @param context The rule context
 * @param node The function node to analyze
 * @param hint Component detection hints (bit flags) to customize detection logic
 * @returns `true` if the node is considered a component definition
 */
declare function isComponentDefinition(context: RuleContext, node: ast.TSESTreeFunction, hint: bigint): boolean;
//#endregion
//#region src/semantic/semantic-node.d.ts
/**
 * Represents a semantic node in the AST
 * This is the base interface for all semantic nodes in the React semantic analysis
 */
interface SemanticNode {
  /** The identifier of the node */
  id: null | TSESTree.Node;
  /** The unique key of the node */
  key: string;
  /** The kind of the node */
  kind: string;
  /** The name of the node */
  name: null | string;
  /** The flag of the node */
  flag: bigint;
  /** The hint of the node */
  hint: bigint;
  /** The AST node */
  node: TSESTree.Node;
}
//#endregion
//#region src/semantic/semantic-func.d.ts
/**
 * Represents a semantic function node in the AST
 * This interface extends SemanticNode and provides additional properties for function analysis
 */
interface SemanticFunc extends SemanticNode {
  /** The identifier of the function */
  id: ast.FunctionID;
  /** The AST node of the function */
  node: ast.TSESTreeFunction;
  /** The name of the function */
  name: string | null;
  /** The return type annotation of the function */
  type: TSESTree.TSTypeAnnotation | null;
  /** The body of the function */
  body: TSESTree.BlockStatement | TSESTree.Expression;
  /** The directives of the function (ex: "use strict", "use client", "use server", etc.) */
  directives: ast.TSESTreeDirective[];
  /** The parameters of the function */
  parameters: TSESTree.Parameter[];
  /** The type parameters of the function */
  typeParameters: TSESTree.TSTypeParameterDeclaration | null;
}
//#endregion
//#region src/component/component-semantic-node.d.ts
/**
 * Represents a React Function Component
 */
interface FunctionComponentSemanticNode extends SemanticNode {
  /**
   * The identifier or identifier sequence of the component
   */
  id: ast.FunctionID;
  /**
   * The kind of component
   */
  kind: "component";
  /**
   * The AST node of the function
   */
  node: ast.TSESTreeFunction;
  /**
   * Flags describing the component's characteristics
   */
  flag: bigint;
  /**
   * Hint for how the component was detected
   */
  hint: bigint;
  /**
   * List of expressions returned by the component
   */
  rets: TSESTree.ReturnStatement["argument"][];
  /**
   * The initialization path of the function
   */
  initPath: null | ast.FunctionInitPath;
  /**
   * Indicates if the component is inside an export default declaration
   */
  isExportDefault: boolean;
  /**
   * Indicates if the component is itself an export default declaration
   */
  isExportDefaultDeclaration: boolean;
  /**
   * List of hook calls within the component
   */
  hookCalls: TSESTree.CallExpression[];
  /**
   * The display name of the component
   */
  displayName: null | TSESTree.Expression;
  /**
   * The directives used in the function (ex: "use strict", "use client", etc.)
   */
  directives: ast.TSESTreeDirective[];
}
/**
 * Represents a React Class Component
 */
interface ClassComponentSemanticNode extends SemanticNode {
  /**
   * The identifier of the component
   */
  id: null | TSESTree.BindingName;
  /**
   * The kind of component
   */
  kind: "class-component";
  /**
   * The AST node of the class
   */
  node: ast.TSESTreeClass;
  /**
   * Flags describing the component's characteristics
   */
  flag: bigint;
  /**
   * Hint for how the component was detected
   */
  hint: bigint;
  /**
   * List of methods and properties in the class
   */
  methods: ast.TSESTreeMethodOrProperty[];
  /**
   * The display name of the component
   */
  displayName: null | TSESTree.Expression;
}
/**
 * Represents a React Component
 */
type ComponentSemanticNode = ClassComponentSemanticNode | FunctionComponentSemanticNode;
//#endregion
//#region src/component/component-collector.d.ts
declare namespace getComponentCollector {
  type Options = {
    collectDisplayName?: boolean;
    hint?: ComponentDetectionHint;
  };
  type ReturnType = {
    api: {
      getAllComponents: (node: TSESTree.Program) => FunctionComponentSemanticNode[];
    };
    visitor: ESLintUtils.RuleListener;
  };
}
/**
 * Get an api and visitor object for the rule to collect function components
 * @param context The ESLint rule context
 * @param options The options to use
 * @returns The api and visitor of the collector
 */
declare function getComponentCollector(context: RuleContext, options?: getComponentCollector.Options): getComponentCollector.ReturnType;
//#endregion
//#region src/component/component-collector-legacy.d.ts
declare namespace getComponentCollectorLegacy {
  type ReturnType = {
    api: {
      getAllComponents: (node: TSESTree$1.Program) => ClassComponentSemanticNode[];
    };
    visitor: ESLintUtils.RuleListener;
  };
}
/**
 * Get an api and visitor object for the rule to collect class components
 * @param context The ESLint rule context
 * @returns The api and visitor of the collector
 */
declare function getComponentCollectorLegacy(context: RuleContext): getComponentCollectorLegacy.ReturnType;
//#endregion
//#region src/component/component-detection-legacy.d.ts
/**
 * Check if a node is a React class component
 * @param node The AST node to check
 * @returns `true` if the node is a class component, `false` otherwise
 */
declare function isClassComponent(node: TSESTree.Node): node is ast.TSESTreeClass;
declare function isClassComponent(node: TSESTree.Node, context: RuleContext): node is ast.TSESTreeClass;
/**
 * Check if a node is a React PureComponent
 * @param node The AST node to check
 * @returns `true` if the node is a PureComponent, `false` otherwise
 */
declare function isPureComponent(node: TSESTree.Node): boolean;
declare const isRender: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentDidCatch: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentDidMount: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentDidUpdate: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentWillMount: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentWillReceiveProps: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentWillUnmount: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isComponentWillUpdate: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetChildContext: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetInitialState: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetSnapshotBeforeUpdate: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isShouldComponentUpdate: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isUnsafeComponentWillMount: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isUnsafeComponentWillReceiveProps: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isUnsafeComponentWillUpdate: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetDefaultProps: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetDerivedStateFromProps: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
declare const isGetDerivedStateFromError: (node: TSESTree.Node) => node is ast.TSESTreeMethodOrProperty;
/**
 * Check if the given node is a componentDidMount callback
 * @param node The node to check
 * @returns True if the node is a componentDidMount callback, false otherwise
 */
declare function isComponentDidMountCallback(node: TSESTree.Node): boolean;
/**
 * Check if the given node is a componentWillUnmount callback
 * @param node The node to check
 * @returns True if the node is a componentWillUnmount callback, false otherwise
 */
declare function isComponentWillUnmountCallback(node: TSESTree.Node): boolean;
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
declare function isRenderMethodLike(node: TSESTree.Node): node is ast.TSESTreeMethodOrProperty;
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
declare function isRenderMethodCallback(node: ast.TSESTreeFunction): boolean;
/**
 * Check whether the given node is a this.setState() call
 * @param node The node to check
 * @internal
 */
declare function isThisSetStateCall(node: TSESTree.CallExpression): boolean;
/**
 * Check whether the given node is an assignment to this.state
 * @param node The node to check
 * @internal
 */
declare function isAssignmentToThisState(node: TSESTree.AssignmentExpression): boolean;
//#endregion
//#region src/component/component-flag.d.ts
/**
 * Component flag constants
 */
declare const ComponentFlag: {
  /** No flags set */None: bigint; /** Indicates the component is a pure component (ex: extends PureComponent) */
  PureComponent: bigint; /** Indicates the component creates elements using `createElement` instead of JSX */
  CreateElement: bigint; /** Indicates the component is memoized (ex: React.memo) */
  Memo: bigint; /** Indicates the component forwards a ref (ex: React.forwardRef) */
  ForwardRef: bigint;
};
/**
 * Get component flag from init path
 * @param initPath The init path of the function component
 * @returns The component flag
 */
declare function getComponentFlagFromInitPath(initPath: FunctionComponentSemanticNode["initPath"]): bigint;
//#endregion
//#region src/component/component-id.d.ts
/**
 * Get function component identifier from `const Component = memo(() => {});`
 * @param context The rule context
 * @param node The function node to analyze
 * @returns The function identifier or `null` if not found
 */
declare function getFunctionComponentId(context: RuleContext, node: ast.TSESTreeFunction): ast.FunctionID;
//#endregion
//#region src/component/component-name.d.ts
/**
 * Check if a string matches the strict component name pattern
 * @param name The name to check
 */
declare function isComponentName(name: string): boolean;
/**
 * Check if a string matches the loose component name pattern
 * @param name The name to check
 */
declare function isComponentNameLoose(name: string): boolean;
/**
 * Check if a function has a loose component name
 * @param context The rule context
 * @param fn The function to check
 * @param allowNone Whether to allow no name
 * @returns Whether the function has a loose component name
 */
declare function isFunctionWithLooseComponentName(context: RuleContext, fn: ast.TSESTreeFunction, allowNone?: boolean): boolean;
//#endregion
//#region src/component/component-wrapper.d.ts
/**
 * Check if the node is a call expression for a component wrapper
 * @param context The ESLint rule context
 * @param node The node to check
 * @returns `true` if the node is a call expression for a component wrapper
 */
declare function isComponentWrapperCall(context: RuleContext, node: TSESTree.Node): boolean;
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
declare function isComponentWrapperCallLoose(context: RuleContext, node: TSESTree.Node): boolean;
/**
 * Check if the node is a callback function passed to a component wrapper
 * @param context The ESLint rule context
 * @param node The node to check
 * @returns `true` if the node is a callback function passed to a component wrapper
 */
declare function isComponentWrapperCallback(context: RuleContext, node: TSESTree.Node): boolean;
/**
 * Check if the node is a callback function passed to a component wrapper loosely
 * @param context The ESLint rule context
 * @param node The node to check
 * @returns `true` if the node is a callback function passed to a component wrapper loosely
 */
declare function isComponentWrapperCallbackLoose(context: RuleContext, node: TSESTree.Node): boolean;
//#endregion
//#region src/function/function-kind.d.ts
/**
 * Represents the kind of a React function
 */
type FunctionKind = "client-function" | "server-function";
//#endregion
//#region src/function/function-semantic-node.d.ts
/**
 * Represents a React Client Function
 */
interface ClientFunctionSemanticNode extends SemanticFunc {
  /**
   * The kind of function
   */
  kind: "client-function";
}
/**
 * Represents a React Server Function
 */
interface ServerFunctionSemanticNode extends SemanticFunc {
  /**
   * The kind of function
   */
  kind: "server-function";
}
/**
 * Represents a React Function
 */
type FunctionSemanticNode = ClientFunctionSemanticNode | ServerFunctionSemanticNode;
//#endregion
//#region src/hook/hook-callback.d.ts
/**
 * Determine if a node is the setup function passed to a useEffect-like hook
 * @param node The AST node to check
 */
declare function isUseEffectSetupCallback(node: TSESTree.Node | null): boolean;
/**
 * Determine if a node is the cleanup function returned by a useEffect-like hook's setup function
 * @param node The AST node to check
 */
declare function isUseEffectCleanupCallback(node: TSESTree.Node | null): boolean;
//#endregion
//#region src/hook/hook-semantic-node.d.ts
/**
 * Represents a semantic hook node in the AST
 * This interface extends SemanticNode and provides additional properties for React hook analysis
 */
interface HookSemanticNode extends SemanticNode {
  /** The identifier of the hook */
  id: ast.FunctionID;
  /** The AST node of the hook */
  node: ast.TSESTreeFunction;
  /** The name of the hook */
  name: string;
  /** The kind of hook */
  kind: "hook";
  /** The other hooks called by the hook */
  hookCalls: TSESTree.CallExpression[];
  /** The directives used in the function (ex: "use strict", "use client", etc.) */
  directives: ast.TSESTreeDirective[];
}
//#endregion
//#region src/hook/hook-collector.d.ts
declare namespace getHookCollector {
  type ReturnType = {
    api: {
      getAllHooks(node: TSESTree$1.Program): HookSemanticNode[];
    };
    visitor: ESLintUtils.RuleListener;
  };
}
/**
 * Get an api and visitor object for the rule to collect hooks
 * @param context The ESLint rule context
 * @returns The api and visitor of the collector
 */
declare function getHookCollector(context: RuleContext): getHookCollector.ReturnType;
//#endregion
//#region src/hook/hook-id.d.ts
/**
 * Checks if the given node is a hook identifier
 * @param id The AST node to check
 * @returns `true` if the node is a hook identifier or member expression with hook name, `false` otherwise
 */
declare function isHookId(id: TSESTree.Node): id is TSESTree.Identifier | TSESTree.MemberExpression;
//#endregion
//#region src/hook/hook-is.d.ts
/**
 * Determine if a function node is a React Hook based on its name.
 * @param node The function node to check
 * @returns True if the function is a React Hook, false otherwise
 */
declare function isHookDefinition(node: ast.TSESTreeFunction | null): boolean;
/**
 * Check if the given node is a React Hook call by its name.
 * @param node The node to check.
 * @returns `true` if the node is a React Hook call, `false` otherwise.
 */
declare function isHookCall(node: TSESTree.Node | null): node is TSESTree.CallExpression;
/**
 * Detect useEffect calls and variations (useLayoutEffect, etc.) using a regex pattern
 * @param node The AST node to check
 * @param additionalEffectHooks Regex pattern matching custom hooks that should be treated as effect hooks
 * @returns True if the node is a useEffect-like call
 */
declare function isUseEffectLikeCall(node: TSESTree.Node | null, additionalEffectHooks?: RegExpLike): node is TSESTree.CallExpression;
/**
 * Detect useState calls and variations (useCustomState, etc.) using a regex pattern
 * @param node The AST node to check
 * @param additionalStateHooks Regex pattern matching custom hooks that should be treated as state hooks
 * @returns True if the node is a useState-like call
 */
declare function isUseStateLikeCall(node: TSESTree.Node | null, additionalStateHooks?: RegExpLike): node is TSESTree.CallExpression;
declare const isUseCall: (node: TSESTree.Node | null) => boolean;
declare const isUseActionStateCall: (node: TSESTree.Node | null) => boolean;
declare const isUseCallbackCall: (node: TSESTree.Node | null) => boolean;
declare const isUseContextCall: (node: TSESTree.Node | null) => boolean;
declare const isUseDebugValueCall: (node: TSESTree.Node | null) => boolean;
declare const isUseDeferredValueCall: (node: TSESTree.Node | null) => boolean;
declare const isUseEffectCall: (node: TSESTree.Node | null) => boolean;
declare const isUseFormStatusCall: (node: TSESTree.Node | null) => boolean;
declare const isUseIdCall: (node: TSESTree.Node | null) => boolean;
declare const isUseImperativeHandleCall: (node: TSESTree.Node | null) => boolean;
declare const isUseInsertionEffectCall: (node: TSESTree.Node | null) => boolean;
declare const isUseLayoutEffectCall: (node: TSESTree.Node | null) => boolean;
declare const isUseMemoCall: (node: TSESTree.Node | null) => boolean;
declare const isUseOptimisticCall: (node: TSESTree.Node | null) => boolean;
declare const isUseReducerCall: (node: TSESTree.Node | null) => boolean;
declare const isUseRefCall: (node: TSESTree.Node | null) => boolean;
declare const isUseStateCall: (node: TSESTree.Node | null) => boolean;
declare const isUseSyncExternalStoreCall: (node: TSESTree.Node | null) => boolean;
declare const isUseTransitionCall: (node: TSESTree.Node | null) => boolean;
//#endregion
//#region src/hook/hook-name.d.ts
declare const REACT_BUILTIN_HOOK_NAMES: readonly ["use", "useActionState", "useCallback", "useContext", "useDebugValue", "useDeferredValue", "useEffect", "useFormStatus", "useId", "useImperativeHandle", "useInsertionEffect", "useLayoutEffect", "useMemo", "useOptimistic", "useReducer", "useRef", "useState", "useSyncExternalStore", "useTransition"];
/**
 * Catch all identifiers that begin with "use" followed by an uppercase Latin
 * character to exclude identifiers like "user".
 * @param name The name of the identifier to check.
 * @see https://github.com/facebook/react/blob/1d6c8168db1d82713202e842df3167787ffa00ed/packages/eslint-plugin-react-hooks/src/rules/RulesOfHooks.ts#L16
 */
declare function isHookName(name: string): boolean;
//#endregion
export { ClassComponentSemanticNode, ClientFunctionSemanticNode, ComponentDetectionHint, ComponentFlag, ComponentSemanticNode, DEFAULT_COMPONENT_DETECTION_HINT, FunctionComponentSemanticNode, FunctionKind, FunctionSemanticNode, HookSemanticNode, REACT_BUILTIN_HOOK_NAMES, SemanticFunc, SemanticNode, ServerFunctionSemanticNode, findImportSource, getComponentCollector, getComponentCollectorLegacy, getComponentFlagFromInitPath, getFunctionComponentId, getHookCollector, isAssignmentToThisState, isCaptureOwnerStack, isCaptureOwnerStackCall, isChildrenCount, isChildrenCountCall, isChildrenForEach, isChildrenForEachCall, isChildrenMap, isChildrenMapCall, isChildrenOnly, isChildrenOnlyCall, isChildrenToArray, isChildrenToArrayCall, isClassComponent, isCloneElement, isCloneElementCall, isComponentDefinition, isComponentDidCatch, isComponentDidMount, isComponentDidMountCallback, isComponentDidUpdate, isComponentName, isComponentNameLoose, isComponentWillMount, isComponentWillReceiveProps, isComponentWillUnmount, isComponentWillUnmountCallback, isComponentWillUpdate, isComponentWrapperCall, isComponentWrapperCallLoose, isComponentWrapperCallback, isComponentWrapperCallbackLoose, isCreateContext, isCreateContextCall, isCreateElement, isCreateElementCall, isCreateRef, isCreateRefCall, isForwardRef, isForwardRefCall, isFunctionWithLooseComponentName, isGetChildContext, isGetDefaultProps, isGetDerivedStateFromError, isGetDerivedStateFromProps, isGetInitialState, isGetSnapshotBeforeUpdate, isHookCall, isHookDefinition, isHookId, isHookName, isInitializedFromReact, isInitializedFromReactNative, isLazy, isLazyCall, isMemo, isMemoCall, isPureComponent, isReactAPI, isReactAPICall, isRender, isRenderMethodCallback, isRenderMethodLike, isShouldComponentUpdate, isThisSetStateCall, isUnsafeComponentWillMount, isUnsafeComponentWillReceiveProps, isUnsafeComponentWillUpdate, isUseActionStateCall, isUseCall, isUseCallbackCall, isUseContextCall, isUseDebugValueCall, isUseDeferredValueCall, isUseEffectCall, isUseEffectCleanupCallback, isUseEffectLikeCall, isUseEffectSetupCallback, isUseFormStatusCall, isUseIdCall, isUseImperativeHandleCall, isUseInsertionEffectCall, isUseLayoutEffectCall, isUseMemoCall, isUseOptimisticCall, isUseReducerCall, isUseRefCall, isUseStateCall, isUseStateLikeCall, isUseSyncExternalStoreCall, isUseTransitionCall };