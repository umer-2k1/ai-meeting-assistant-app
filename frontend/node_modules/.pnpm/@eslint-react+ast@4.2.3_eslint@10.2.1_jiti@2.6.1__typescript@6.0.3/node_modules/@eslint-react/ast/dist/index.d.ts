import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/types";
import { TSESTree as TSESTree$1 } from "@typescript-eslint/utils";

//#region src/node-types.d.ts
/**
 * Represents function expressions and declarations in TSESTree
 */
type TSESTreeFunction = TSESTree$1.ArrowFunctionExpression | TSESTree$1.FunctionDeclaration | TSESTree$1.FunctionExpression;
/**
 * Represents all function-related types including TypeScript function types
 */
type TSESTreeFunctionType = TSESTree$1.TSCallSignatureDeclaration | TSESTree$1.TSConstructSignatureDeclaration | TSESTree$1.TSDeclareFunction | TSESTree$1.TSEmptyBodyFunctionExpression | TSESTree$1.TSFunctionType | TSESTree$1.TSMethodSignature | TSESTreeFunction;
/**
 * Represents class declarations and expressions in TSESTree
 */
type TSESTreeClass = TSESTree$1.ClassDeclaration | TSESTree$1.ClassExpression;
/**
 * Represents method definitions and property definitions in classes
 */
type TSESTreeMethodOrProperty = TSESTree$1.PropertyDefinition | TSESTree$1.MethodDefinition;
/**
 * Represents loop statements in TSESTree
 */
type TSESTreeLoop = TSESTree$1.DoWhileStatement | TSESTree$1.ForInStatement | TSESTree$1.ForOfStatement | TSESTree$1.ForStatement | TSESTree$1.WhileStatement;
/**
 * Represents TypeScript array and tuple types
 */
type TSESTreeArrayTupleType = TSESTree$1.TSArrayType | TSESTree$1.TSTupleType;
/**
 * Represents property-like nodes in TSESTree
 */
type TSESTreeProperty = TSESTree$1.PropertyDefinition | TSESTree$1.TSIndexSignature | TSESTree$1.TSParameterProperty | TSESTree$1.TSPropertySignature;
/**
 * Represents all JSX-related nodes in TSESTree
 * Note: This type is for type-level operations. The isJSX() runtime guard in node-is.ts
 * has a slightly different set of nodes as it includes JSXExpressionContainer which is
 * commonly needed for runtime checks but not included in this type union.
 */
type TSESTreeJSX = TSESTree$1.JSXAttribute | TSESTree$1.JSXChild | TSESTree$1.JSXClosingElement | TSESTree$1.JSXClosingFragment | TSESTree$1.JSXEmptyExpression | TSESTree$1.JSXIdentifierToken | TSESTree$1.JSXOpeningElement | TSESTree$1.JSXOpeningFragment | TSESTree$1.JSXSpreadAttribute | TSESTree$1.JSXTagNameExpression | TSESTree$1.JSXTextToken;
type TSESTreeJSXElementLike = TSESTree$1.JSXElement | TSESTree$1.JSXFragment;
/**
 * Represents JSX attribute-like nodes (attributes and spread attributes)
 */
type TSESTreeJSXAttributeLike = TSESTree$1.JSXAttribute | TSESTree$1.JSXSpreadAttribute;
/**
 * Represents destructuring patterns in variable declarations
 */
type TSESTreeDestructuringPattern = TSESTree$1.ArrayPattern | TSESTree$1.AssignmentPattern | TSESTree$1.ObjectPattern | TSESTree$1.RestElement;
/**
 * Represents TypeScript type declaration nodes
 */
type TSESTreeTypeDeclaration = TSESTree$1.TSInterfaceDeclaration | TSESTree$1.TSTypeAliasDeclaration;
/**
 * Represents TypeScript type expression nodes (type assertions, non-null expressions, etc.)
 */
type TSESTreeTypeExpression = TSESTree$1.TSAsExpression | TSESTree$1.TSNonNullExpression | TSESTree$1.TSSatisfiesExpression | TSESTree$1.TSTypeAssertion | TSESTree$1.TSInstantiationExpression;
/**
 * Represents TypeScript type assertion expressions (excluding instantiation expressions)
 */
type TSESTreeTypeAssertionExpression = TSESTree$1.TSAsExpression | TSESTree$1.TSNonNullExpression | TSESTree$1.TSSatisfiesExpression | TSESTree$1.TSTypeAssertion;
/**
 * Represents a directive expression statement in TSESTree (ex: "use strict";)
 */
type TSESTreeDirective = TSESTree$1.ExpressionStatement & {
  directive: string;
  expression: TSESTree$1.StringLiteral;
};
/**
 * Represents a directive-like expression statement in TSESTree
 */
type TSESTreeDirectiveLike = TSESTree$1.ExpressionStatement & {
  expression: TSESTree$1.StringLiteral;
};
//#endregion
//#region src/class-id.d.ts
/**
 * Get the class identifier of a class node
 * @param node The class node to get the identifier from
 * @returns The class identifier or null if not found
 */
declare function getClassId(node: TSESTreeClass): TSESTree.BindingName | null;
//#endregion
//#region src/directive-is.d.ts
/**
 * Check if a node is a directive expression statement
 * @param node The node to check
 * @returns True if the node is a directive, false otherwise
 */
declare function isDirective(node: TSESTree.Node): node is TSESTreeDirective;
/**
 * Check if a node is a directive-like expression statement
 * @param node The node to check
 * @returns True if the node is a directive, false otherwise
 */
declare function isDirectiveLike(node: TSESTree.Node): node is TSESTreeDirectiveLike;
//#endregion
//#region src/directive-kind.d.ts
/**
 * Known directive kinds in React
 */
type DirectiveKind = "use client" | "use server" | "use memo" | "use no memo";
/**
 * Check if a node is a directive kind
 * @param kind The kind to check
 * @returns True if the kind is a directive kind, false otherwise
 */
declare function isDirectiveKind(kind: string): kind is DirectiveKind;
//#endregion
//#region src/directive-name.d.ts
/**
 * Check if a string is a directive name (heuristic check)
 * Note: This is a broad check that matches any string starting with "use ".
 * For strict validation against known directives, use isDirectiveKind.
 * @param name The string to check
 * @returns True if the string looks like a directive name, false otherwise
 * @see isDirectiveKind
 */
declare function isDirectiveName(name: string): boolean;
//#endregion
//#region src/expression-is.d.ts
/**
 * Check if the given expression is a 'this' expression
 * Unwraps any type expressions before checking
 *
 * @param node The expression node to check
 * @returns True if the expression is a 'this' expression, false otherwise
 */
declare function isThisExpressionLoose(node: TSESTree.Expression): boolean;
//#endregion
//#region src/expression-nested.d.ts
/**
 * Get all nested identifiers in a expression like node
 * @param node The node to get the nested identifiers from
 * @returns All nested identifiers
 */
declare function getNestedIdentifiers(node: TSESTree.Node): readonly TSESTree.Identifier[];
/**
 * Gets the nested return statements in the node that are within the same function
 * @param node The AST node
 * @returns The nested return statements in the node
 */
declare function getNestedReturnStatements(node: TSESTree.Node): readonly TSESTree.ReturnStatement[];
/**
 * Get all nested expressions of type T in an expression like node
 * @param type The type of the expression to retrieve within the node
 * @returns A partially applied function bound to a predicate of type AST. The returned function can be called passing a
 * node, and it will return an array of all nested expressions of type AST.
 */
declare function getNestedExpressionsOfType<TNodeType extends AST_NODE_TYPES>(type: TNodeType): (node: TSESTree.Node) => Extract<TSESTree.Node, {
  type: TNodeType;
}>[];
/**
 * Get all nested new expressions in an expression like node
 * @param node The node to get the nested new expressions from
 * @returns All nested new expressions
 */
declare const getNestedNewExpressions: (node: TSESTree.Node) => TSESTree.NewExpression[];
/**
 * Get all nested call expressions in a expression like node
 * @param node The node to get the nested call expressions from
 * @returns All nested call expressions
 */
declare const getNestedCallExpressions: (node: TSESTree.Node) => TSESTree.CallExpression[];
//#endregion
//#region src/file-directive.d.ts
/**
 * Get all directive expression statements from the top of a program AST node
 * @param node The program AST node
 * @returns The array of directive string literals (ex: "use strict")
 */
declare function getFileDirectives(node: TSESTree.Program): TSESTreeDirective[];
/**
 * Check if a directive with the given name exists in the file directives
 * @param node The program AST node
 * @param name The directive name to check (ex: "use strict", "use memo", "use no memo")
 * @returns True if the directive exists, false otherwise
 */
declare function isDirectiveInFile(node: TSESTree.Program, name: string): boolean;
//#endregion
//#region src/function-directive.d.ts
/**
 * Get all directive expression statements from the top of a function AST node
 * @param node The function AST node
 * @returns The array of directive string literals (ex: "use memo", "use no memo")
 */
declare function getFunctionDirectives(node: TSESTreeFunction): TSESTreeDirective[];
/**
 * Check if a directive with the given name exists in the function directives
 * @param node The function AST node
 * @param name The directive name to check (ex: "use memo", "use no memo")
 * @returns True if the directive exists, false otherwise
 */
declare function isDirectiveInFunction(node: TSESTreeFunction, name: string): boolean;
//#endregion
//#region src/function-id.d.ts
/**
 * Gets the static name of a function AST node. For function declarations it is
 * easy. For anonymous function expressions it is much harder. If you search for
 * `IsAnonymousFunctionDefinition()` in the ECMAScript spec you'll find places
 * where JS gives anonymous function expressions names. We roughly detect the
 * same AST nodes with some exceptions to better fit our use case.
 */
declare function getFunctionId(node: TSESTree.Expression | TSESTreeFunction): TSESTree.ArrayExpression | TSESTree.ArrayPattern | TSESTree.ArrowFunctionExpression | TSESTree.AssignmentExpression | TSESTree.AwaitExpression | TSESTree.PrivateInExpression | TSESTree.SymmetricBinaryExpression | TSESTree.CallExpression | TSESTree.ChainExpression | TSESTree.ClassExpression | TSESTree.ConditionalExpression | TSESTree.FunctionExpression | TSESTree.Identifier | TSESTree.ImportExpression | TSESTree.JSXElement | TSESTree.JSXFragment | TSESTree.BigIntLiteral | TSESTree.BooleanLiteral | TSESTree.NullLiteral | TSESTree.NumberLiteral | TSESTree.RegExpLiteral | TSESTree.StringLiteral | TSESTree.LogicalExpression | TSESTree.MemberExpressionComputedName | TSESTree.MemberExpressionNonComputedName | TSESTree.MetaProperty | TSESTree.NewExpression | TSESTree.ObjectExpression | TSESTree.ObjectPattern | TSESTree.PrivateIdentifier | TSESTree.SequenceExpression | TSESTree.Super | TSESTree.TaggedTemplateExpression | TSESTree.TemplateLiteral | TSESTree.ThisExpression | TSESTree.TSAsExpression | TSESTree.TSInstantiationExpression | TSESTree.TSNonNullExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSTypeAssertion | TSESTree.UnaryExpressionBitwiseNot | TSESTree.UnaryExpressionDelete | TSESTree.UnaryExpressionMinus | TSESTree.UnaryExpressionNot | TSESTree.UnaryExpressionPlus | TSESTree.UnaryExpressionTypeof | TSESTree.UnaryExpressionVoid | TSESTree.UpdateExpression | TSESTree.YieldExpression | null;
/**
 * Type representing the return type of getFunctionId
 */
type FunctionID = ReturnType<typeof getFunctionId>;
//#endregion
//#region src/function-init-path.d.ts
/**
 * Represents various AST paths for React component function declarations
 * Each tuple type represents a specific component definition pattern
 */
type FunctionInitPath = readonly [TSESTree.FunctionDeclaration] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTreeFunction] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTree.CallExpression, TSESTreeFunction] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTree.CallExpression, TSESTree.CallExpression, TSESTreeFunction] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTree.ObjectExpression, TSESTree.Property, TSESTreeFunction] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTree.ObjectExpression, TSESTree.Property, TSESTree.CallExpression, TSESTreeFunction] | readonly [TSESTree.VariableDeclaration, TSESTree.VariableDeclarator, TSESTree.ObjectExpression, TSESTree.Property, TSESTree.CallExpression, TSESTree.CallExpression, TSESTreeFunction] | readonly [TSESTree.ClassDeclaration | TSESTree.ClassExpression, TSESTree.ClassBody, TSESTree.MethodDefinition, TSESTreeFunction] | readonly [TSESTree.ClassDeclaration | TSESTree.ClassExpression, TSESTree.ClassBody, TSESTree.PropertyDefinition, TSESTreeFunction];
/**
 * Identifies the initialization path of a function node in the ast.
 * Determine what kind of component declaration pattern the function belongs to.
 *
 * @param node The function node to analyze
 * @returns The function initialization path or null if not identifiable
 */
declare function getFunctionInitPath(node: TSESTreeFunction): null | FunctionInitPath;
/**
 * Check if a specific function call exists in the function initialization path.
 * Useful for detecting HOCs like React.memo, React.forwardRef, etc.
 *
 * @param callName The name of the call to check for (ex: "memo", "forwardRef")
 * @param initPath The function initialization path to search in
 * @returns True if the call exists in the path, false otherwise
 */
declare function hasCallInFunctionInitPath(callName: string, initPath: FunctionInitPath): boolean;
//#endregion
//#region src/function-is.d.ts
/**
 * Check if a function is empty
 * @param node The function node to check
 * @returns True if the function is empty, false otherwise
 */
declare function isFunctionEmpty(node: TSESTreeFunction): boolean;
/**
 * Check if a function is immediately invoked
 * @param node The function node to check
 * @returns True if the function is immediately invoked, false otherwise
 */
declare function isFunctionImmediatelyInvoked(node: TSESTreeFunction): boolean;
//#endregion
//#region src/identifier-is.d.ts
/**
 * Check if the given node is an identifier
 * @param node The node to check
 * @param name The name to check
 * @returns True if the node is an identifier, false otherwise
 */
declare function isIdentifier(node: TSESTree.Node | null, name?: string): node is TSESTree.Identifier;
//#endregion
//#region src/identifier-name.d.ts
/**
 * Check if a string is a valid JavaScript identifier name
 * Note: This only checks for ASCII identifiers. Unicode identifiers (e.g., `const 变量 = 1`)
 * are not supported by this simple regex check.
 * @param name The string to check
 * @returns True if the string is a valid ASCII identifier name
 */
declare function isIdentifierName(name: string): boolean;
//#endregion
//#region src/identifier-traverse.d.ts
/**
 * Get the root identifier of a (possibly nested) member expression.
 * For `a.b.c`, returns the `a` Identifier node.
 * @param node The expression to analyze
 * @returns The root Identifier node, or null if it cannot be determined (ex: non-identifier root)
 */
declare function getRootIdentifier(node: TSESTree.Expression | TSESTree.PrivateIdentifier): TSESTree.Identifier | null;
//#endregion
//#region src/literal-is.d.ts
/**
 * Check if a node is a literal value
 * @param node The node to check
 * @returns True if the node is a literal
 */
declare function isLiteral(node: TSESTree.Node): node is TSESTree.Literal;
declare function isLiteral(node: TSESTree.Node, type: "boolean"): node is TSESTree.BooleanLiteral;
declare function isLiteral(node: TSESTree.Node, type: "null"): node is TSESTree.NullLiteral;
declare function isLiteral(node: TSESTree.Node, type: "number"): node is TSESTree.NumberLiteral;
declare function isLiteral(node: TSESTree.Node, type: "regexp"): node is TSESTree.RegExpLiteral;
declare function isLiteral(node: TSESTree.Node, type: "string"): node is TSESTree.StringLiteral;
//#endregion
//#region src/node-equality.d.ts
/**
 * Check if two nodes are equal
 * @param a node to compare
 * @param b node to compare
 * @returns `true` if node equal
 * @see https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/util/isNodeEqual.ts
 */
declare const isNodeEqual: {
  (a: TSESTree.Node): (b: TSESTree.Node) => boolean;
  (a: TSESTree.Node, b: TSESTree.Node): boolean;
};
//#endregion
//#region src/node-is.d.ts
/**
 * Type guard to check if a node is of a specific AST node type
 * @param nodeType The AST node type to check against
 * @returns A type guard function that narrows the node type
 */
declare const is: <NodeType extends TSESTree.AST_NODE_TYPES>(nodeType: NodeType) => (node: TSESTree.Node | null | undefined) => node is Extract<TSESTree.Node, {
  type: NodeType;
}>;
/**
 * Type guard to check if a node is one of multiple AST node types
 * @param nodeTypes Array of AST node types to check against
 * @returns A type guard function that narrows the node type
 */
declare const isOneOf: <NodeTypes extends readonly TSESTree.AST_NODE_TYPES[]>(nodeTypes: NodeTypes) => (node: TSESTree.Node | null | undefined) => node is Extract<TSESTree.Node, {
  type: NodeTypes[number];
}>;
/**
 * Check if a node is a function (arrow, declaration, or expression)
 * @param node The node to check
 * @returns True if the node is a function
 */
declare const isFunction: (node: TSESTree.Node | null | undefined) => node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclarationWithName | TSESTree.FunctionDeclarationWithOptionalName | TSESTree.FunctionExpression;
/**
 * Check if a node is a function type (including TypeScript function types)
 * @param node The node to check
 * @returns True if the node is a function type
 */
declare const isFunctionType: (node: TSESTree.Node | null | undefined) => node is TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclarationWithName | TSESTree.FunctionDeclarationWithOptionalName | TSESTree.FunctionExpression | TSESTree.TSCallSignatureDeclaration | TSESTree.TSConstructSignatureDeclaration | TSESTree.TSDeclareFunctionNoDeclare | TSESTree.TSDeclareFunctionWithDeclare | TSESTree.TSEmptyBodyFunctionExpression | TSESTree.TSFunctionType | TSESTree.TSMethodSignatureComputedName | TSESTree.TSMethodSignatureNonComputedName;
/**
 * Check if a node is a class declaration or expression
 * @param node The node to check
 * @returns True if the node is a class
 */
declare const isClass: (node: TSESTree.Node | null | undefined) => node is TSESTree.ClassDeclarationWithName | TSESTree.ClassDeclarationWithOptionalName | TSESTree.ClassExpression;
/**
 * Check if a node is a method or property definition
 * @param node The node to check
 * @returns True if the node is a method or property definition
 */
declare const isMethodOrProperty: (node: TSESTree.Node | null | undefined) => node is TSESTree.MethodDefinitionComputedName | TSESTree.MethodDefinitionNonComputedName | TSESTree.PropertyDefinitionComputedName | TSESTree.PropertyDefinitionNonComputedName;
/**
 * Check if a node is a property-like node (including TypeScript property signatures)
 * @param node The node to check
 * @returns True if the node is a property
 */
declare const isProperty: (node: TSESTree.Node | null | undefined) => node is TSESTree.PropertyDefinitionComputedName | TSESTree.PropertyDefinitionNonComputedName | TSESTree.TSIndexSignature | TSESTree.TSParameterProperty | TSESTree.TSPropertySignatureComputedName | TSESTree.TSPropertySignatureNonComputedName;
/**
 * Check if a node is a JSX element
 * @param node The node to check
 * @returns True if the node is a JSX element
 */
declare const isJSXElement: (node: TSESTree.Node | null | undefined) => node is TSESTree.JSXElement;
/**
 * Check if a node is a JSX fragment
 * @param node The node to check
 * @returns True if the node is a JSX fragment
 */
declare const isJSXFragment: (node: TSESTree.Node | null | undefined) => node is TSESTree.JSXFragment;
/**
 * Check if a node is a JSX element or JSX fragment
 */
declare const isJSXElementLike: (data: TSESTree.Node | null | undefined) => data is TSESTree.JSXElement | TSESTree.JSXFragment;
/**
 * Check if a node is a JSX tag name expression (identifier, member expression, or namespaced name)
 * @param node The node to check
 * @returns True if the node is a JSX tag name expression
 */
declare const isJSXTagNameExpression: (node: TSESTree.Node | null | undefined) => node is TSESTree.JSXIdentifier | TSESTree.JSXMemberExpression | TSESTree.JSXNamespacedName;
/**
 * Check if a node is a JSX-related node
 * Note: This runtime guard includes JSXExpressionContainer which is commonly needed
 * for AST traversals but not included in the TSESTreeJSX type union.
 * @param node The node to check
 * @returns True if the node is a JSX node
 * @see TSESTreeJSX
 */
declare const isJSX: (node: TSESTree.Node | null | undefined) => node is TSESTree.JSXAttribute | TSESTree.JSXClosingElement | TSESTree.JSXClosingFragment | TSESTree.JSXElement | TSESTree.JSXEmptyExpression | TSESTree.JSXExpressionContainer | TSESTree.JSXFragment | TSESTree.JSXIdentifier | TSESTree.JSXMemberExpression | TSESTree.JSXNamespacedName | TSESTree.JSXOpeningElement | TSESTree.JSXOpeningFragment | TSESTree.JSXSpreadAttribute | TSESTree.JSXSpreadChild | TSESTree.JSXText;
/**
 * Check if a node is a loop statement
 * @param node The node to check
 * @returns True if the node is a loop
 */
declare const isLoop: (node: TSESTree.Node | null | undefined) => node is TSESTree.DoWhileStatement | TSESTree.ForInStatement | TSESTree.ForOfStatement | TSESTree.ForStatement | TSESTree.WhileStatement;
/**
 * Check if a node is a control flow statement (loop, if, or switch)
 * @param node The node to check
 * @returns True if the node is a control flow statement
 */
declare const isControlFlow: (data: TSESTree.Node | null | undefined) => data is TSESTree.DoWhileStatement | TSESTree.ForInStatement | TSESTree.ForOfStatement | TSESTree.ForStatement | TSESTree.IfStatement | TSESTree.SwitchStatement | TSESTree.WhileStatement;
/**
 * Check if a node is a conditional expression or control flow statement
 * @param node The node to check
 * @returns True if the node is conditional
 */
declare const isConditional: (data: TSESTree.Node | null | undefined) => data is TSESTree.ConditionalExpression | TSESTree.DoWhileStatement | TSESTree.ForInStatement | TSESTree.ForOfStatement | TSESTree.ForStatement | TSESTree.IfStatement | TSESTree.LogicalExpression | TSESTree.SwitchStatement | TSESTree.WhileStatement;
/**
 * Check if a node is a TypeScript type expression
 * @param node The node to check
 * @returns True if the node is a type expression
 */
declare const isTypeExpression: (node: TSESTree.Node | null | undefined) => node is TSESTree.TSAsExpression | TSESTree.TSInstantiationExpression | TSESTree.TSNonNullExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSTypeAssertion;
/**
 * Check if a node is a TypeScript type assertion expression
 * @param node The node to check
 * @returns True if the node is a type assertion expression
 */
declare const isTypeAssertionExpression: (node: TSESTree.Node | null | undefined) => node is TSESTree.TSAsExpression | TSESTree.TSNonNullExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSTypeAssertion;
//#endregion
//#region src/node-kind.d.ts
declare function getHumanReadableKind(node: TSESTree.Node, delimiter?: string): "RegExp literal" | Lowercase<string> | `JSX ${Lowercase<string>}`;
//#endregion
//#region src/node-line.d.ts
declare function isMultiLine(node: TSESTree.Node): boolean;
declare function isLineBreak(node: TSESTree.Node): boolean;
//#endregion
//#region src/node-name.d.ts
declare function getFullyQualifiedName(node: TSESTree.Node, getText: (node: TSESTree.Node) => string): string;
//#endregion
//#region src/node-selectors.d.ts
/**
 * Represents an arrow function expression with an implicit return
 */
type ImplicitReturnArrowFunctionExpression = TSESTree$1.ArrowFunctionExpression & {
  body: TSESTree$1.Expression;
};
/**
 * Represents a variable declarator with object destructuring and an identifier initializer
 */
type ObjectDestructuringVariableDeclarator = TSESTree$1.VariableDeclarator & {
  id: TSESTree$1.ObjectPattern;
  init: TSESTree$1.Identifier;
};
/**
 * Represents an assignment expression that assigns to a displayName property
 */
type DisplayNameAssignmentExpression = TSESTree$1.AssignmentExpression & {
  type: "AssignmentExpression";
  left: TSESTree$1.MemberExpression & {
    property: TSESTree$1.Identifier & {
      name: "displayName";
    };
  };
  operator: "=";
  right: TSESTree$1.Literal;
};
/**
 * Selector for arrow function expressions with implicit return
 */
declare const SEL_IMPLICIT_RETURN_ARROW_FUNCTION_EXPRESSION = "ArrowFunctionExpression[body.type!='BlockStatement']";
/**
 * Selector for variable declarators with object destructuring
 */
declare const SEL_OBJECT_DESTRUCTURING_VARIABLE_DECLARATOR: string;
/**
 * Selector for assignment expressions that set displayName
 */
declare const SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION: string;
//#endregion
//#region src/node-traverse.d.ts
/**
 * Find the parent node that satisfies the test function
 * @param node The AST node
 * @param test The test function
 * @returns The parent node that satisfies the test function or `null` if not found
 */
declare function findParent<A extends TSESTree.Node>(node: TSESTree.Node | null, test: (n: TSESTree.Node) => n is A): A | null;
/**
 * Find the parent node that satisfies the test function or `null` if not found
 * @param node The AST node
 * @param test The test function
 * @returns The parent node that satisfies the test function
 */
declare function findParent(node: TSESTree.Node | null, test: (node: TSESTree.Node) => boolean): TSESTree.Node | null;
//#endregion
//#region src/node-unwrap.d.ts
/**
 * Unwraps any type expressions to get the underlying JavaScript expression node.
 * Recursively processes nodes until a non-type expression is found.
 * @param node The AST node to unwrap
 * @returns The underlying JavaScript expression node
 */
declare function getUnderlyingExpression(node: TSESTree.Node): Exclude<TSESTree.Node, TSESTreeTypeExpression>;
//#endregion
//#region src/pattern-process-env-node-env.d.ts
/**
 * Check if the given node is a member expression that accesses `process.env.NODE_ENV`
 * @param node The AST node
 * @returns True if the node is a member expression that accesses `process.env.NODE_ENV`, false otherwise
 */
declare function isProcessEnvNodeEnv(node: TSESTree.Node | null): node is TSESTree.MemberExpression;
/**
 * Check if the given node is a binary expression that compares `process.env.NODE_ENV` with a string literal.
 * @param node The AST node
 * @param operator The operator used in the comparison
 * @param value The string literal value to compare against
 * @returns True if the node is a binary expression that compares `process.env.NODE_ENV` with the specified value, false otherwise
 */
declare function isProcessEnvNodeEnvCompare(node: TSESTree.Node | null, operator: "===" | "!==", value: "development" | "production"): node is TSESTree.BinaryExpression;
//#endregion
//#region src/pattern-test-mock.d.ts
/**
 * Check if the given node is a `vi.mock`.
 * @param node The node to check
 * @returns `true` if the node is a `vi.mock`, otherwise `false`.
 * @internal
 */
declare function isViMock(node: TSESTree.Node | null): node is TSESTree.MemberExpression;
/**
 * Check if the given node is a `jest.mock`.
 * @param node The node to check
 * @returns `true` if the node is a `jest.mock`, otherwise `false`.
 * @internal
 */
declare function isJestMock(node: TSESTree.Node | null): node is TSESTree.MemberExpression;
/**
 * Check if the given node is a `vi.mock` callback.
 * @param node The node to check
 * @returns `true` if the node is a `vi.mock` callback, otherwise `false`.
 * @internal
 */
declare function isViMockCallback(node: TSESTree.Node | null): boolean;
/**
 * Check if the given node is a `jest.mock` callback.
 * @param node The node to check
 * @returns `true` if the node is a `jest.mock` callback, otherwise `false`.
 * @internal
 */
declare function isJestMockCallback(node: TSESTree.Node | null): boolean;
/**
 * Check if the given node is a `vi.mock` or `jest.mock` callback.
 * @param node The node to check
 * @returns `true` if the node is a test mock callback, otherwise `false`.
 */
declare function isTestMockCallback(node: TSESTree.Node | null): boolean;
//#endregion
//#region src/property-name.d.ts
/**
 * Get the name of a property from a node
 * Handles identifiers, private identifiers, literals, and template literals
 * @param node The node to get the property name from
 * @returns The property name or null if not determinable
 */
declare function getPropertyName(node: TSESTree.Node): string | null;
//#endregion
//#region src/property-traverse.d.ts
/**
 * Recursively traverses an object expression's properties to find a property with the specified name
 * Note: This only handles inline object literals in spread elements. Properties from variables
 * (e.g., `{...props}` where props is a variable) are not resolved.
 * @param properties The properties of the object expression to traverse
 * @param name The name of the property to find
 * @returns The matching property node, or null if not found
 */
declare function findProperty(properties: TSESTree.ObjectLiteralElement[], name: string): TSESTree.Property | null;
//#endregion
export { DirectiveKind, DisplayNameAssignmentExpression, FunctionID, FunctionInitPath, ImplicitReturnArrowFunctionExpression, ObjectDestructuringVariableDeclarator, SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION, SEL_IMPLICIT_RETURN_ARROW_FUNCTION_EXPRESSION, SEL_OBJECT_DESTRUCTURING_VARIABLE_DECLARATOR, TSESTreeArrayTupleType, TSESTreeClass, TSESTreeDestructuringPattern, TSESTreeDirective, TSESTreeDirectiveLike, TSESTreeFunction, TSESTreeFunctionType, TSESTreeJSX, TSESTreeJSXAttributeLike, TSESTreeJSXElementLike, TSESTreeLoop, TSESTreeMethodOrProperty, TSESTreeProperty, TSESTreeTypeAssertionExpression, TSESTreeTypeDeclaration, TSESTreeTypeExpression, findParent, findProperty, getClassId, getFileDirectives, getFullyQualifiedName, getFunctionDirectives, getFunctionId, getFunctionInitPath, getHumanReadableKind, getNestedCallExpressions, getNestedExpressionsOfType, getNestedIdentifiers, getNestedNewExpressions, getNestedReturnStatements, getPropertyName, getRootIdentifier, getUnderlyingExpression, hasCallInFunctionInitPath, is, isClass, isConditional, isControlFlow, isDirective, isDirectiveInFile, isDirectiveInFunction, isDirectiveKind, isDirectiveLike, isDirectiveName, isFunction, isFunctionEmpty, isFunctionImmediatelyInvoked, isFunctionType, isIdentifier, isIdentifierName, isJSX, isJSXElement, isJSXElementLike, isJSXFragment, isJSXTagNameExpression, isJestMock, isJestMockCallback, isLineBreak, isLiteral, isLoop, isMethodOrProperty, isMultiLine, isNodeEqual, isOneOf, isProcessEnvNodeEnv, isProcessEnvNodeEnvCompare, isProperty, isTestMockCallback, isThisExpressionLoose, isTypeAssertionExpression, isTypeExpression, isViMock, isViMockCallback };