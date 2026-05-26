import { AST_NODE_TYPES, TSESTree } from "@typescript-eslint/types";
import { ASTUtils } from "@typescript-eslint/utils";
import { simpleTraverse } from "@typescript-eslint/typescript-estree";
import { delimiterCase, replace, toLowerCase } from "string-ts";

//#region src/class-id.ts
/**
* Get the class identifier of a class node
* @param node The class node to get the identifier from
* @returns The class identifier or null if not found
*/
function getClassId(node) {
	if (node.id != null) return node.id;
	if (node.parent.type === AST_NODE_TYPES.VariableDeclarator) return node.parent.id;
	return null;
}

//#endregion
//#region src/directive-name.ts
/**
* Check if a string is a directive name (heuristic check)
* Note: This is a broad check that matches any string starting with "use ".
* For strict validation against known directives, use isDirectiveKind.
* @param name The string to check
* @returns True if the string looks like a directive name, false otherwise
* @see isDirectiveKind
*/
function isDirectiveName(name) {
	return name.startsWith("use ") && name.length > 4;
}

//#endregion
//#region src/literal-is.ts
function isLiteral(node, type) {
	if (node.type !== AST_NODE_TYPES.Literal) return false;
	if (type == null) return true;
	switch (type) {
		case "boolean": return typeof node.value === "boolean";
		case "null": return node.value === null;
		case "number": return typeof node.value === "number";
		case "regexp": return "regex" in node;
		case "string": return typeof node.value === "string";
	}
}

//#endregion
//#region src/directive-is.ts
/**
* Check if a node is a directive expression statement
* @param node The node to check
* @returns True if the node is a directive, false otherwise
*/
function isDirective(node) {
	return node.type === AST_NODE_TYPES.ExpressionStatement && node.directive != null;
}
/**
* Check if a node is a directive-like expression statement
* @param node The node to check
* @returns True if the node is a directive, false otherwise
*/
function isDirectiveLike(node) {
	return node.type === AST_NODE_TYPES.ExpressionStatement && isLiteral(node.expression, "string") && isDirectiveName(node.expression.value);
}

//#endregion
//#region src/directive-kind.ts
/**
* Check if a node is a directive kind
* @param kind The kind to check
* @returns True if the kind is a directive kind, false otherwise
*/
function isDirectiveKind(kind) {
	return kind === "use client" || kind === "use server" || kind === "use memo" || kind === "use no memo";
}

//#endregion
//#region ../../../.pkgs/eff/dist/index.js
function or(a, b) {
	return (data) => a(data) || b(data);
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
//#region src/node-is.ts
/**
* Type guard to check if a node is of a specific AST node type
* @param nodeType The AST node type to check against
* @returns A type guard function that narrows the node type
*/
const is = ASTUtils.isNodeOfType;
/**
* Type guard to check if a node is one of multiple AST node types
* @param nodeTypes Array of AST node types to check against
* @returns A type guard function that narrows the node type
*/
const isOneOf = ASTUtils.isNodeOfTypes;
/**
* Check if a node is a function (arrow, declaration, or expression)
* @param node The node to check
* @returns True if the node is a function
*/
const isFunction = isOneOf([
	AST_NODE_TYPES.ArrowFunctionExpression,
	AST_NODE_TYPES.FunctionDeclaration,
	AST_NODE_TYPES.FunctionExpression
]);
/**
* Check if a node is a function type (including TypeScript function types)
* @param node The node to check
* @returns True if the node is a function type
*/
const isFunctionType = isOneOf([
	AST_NODE_TYPES.ArrowFunctionExpression,
	AST_NODE_TYPES.FunctionDeclaration,
	AST_NODE_TYPES.FunctionExpression,
	AST_NODE_TYPES.TSCallSignatureDeclaration,
	AST_NODE_TYPES.TSConstructSignatureDeclaration,
	AST_NODE_TYPES.TSDeclareFunction,
	AST_NODE_TYPES.TSEmptyBodyFunctionExpression,
	AST_NODE_TYPES.TSFunctionType,
	AST_NODE_TYPES.TSMethodSignature
]);
/**
* Check if a node is a class declaration or expression
* @param node The node to check
* @returns True if the node is a class
*/
const isClass = isOneOf([AST_NODE_TYPES.ClassDeclaration, AST_NODE_TYPES.ClassExpression]);
/**
* Check if a node is a method or property definition
* @param node The node to check
* @returns True if the node is a method or property definition
*/
const isMethodOrProperty = isOneOf([AST_NODE_TYPES.PropertyDefinition, AST_NODE_TYPES.MethodDefinition]);
/**
* Check if a node is a property-like node (including TypeScript property signatures)
* @param node The node to check
* @returns True if the node is a property
*/
const isProperty = isOneOf([
	AST_NODE_TYPES.PropertyDefinition,
	AST_NODE_TYPES.TSIndexSignature,
	AST_NODE_TYPES.TSParameterProperty,
	AST_NODE_TYPES.TSPropertySignature
]);
/**
* Check if a node is a JSX element
* @param node The node to check
* @returns True if the node is a JSX element
*/
const isJSXElement = is(AST_NODE_TYPES.JSXElement);
/**
* Check if a node is a JSX fragment
* @param node The node to check
* @returns True if the node is a JSX fragment
*/
const isJSXFragment = is(AST_NODE_TYPES.JSXFragment);
/**
* Check if a node is a JSX element or JSX fragment
*/
const isJSXElementLike = or(isJSXElement, isJSXFragment);
/**
* Check if a node is a JSX tag name expression (identifier, member expression, or namespaced name)
* @param node The node to check
* @returns True if the node is a JSX tag name expression
*/
const isJSXTagNameExpression = isOneOf([
	AST_NODE_TYPES.JSXIdentifier,
	AST_NODE_TYPES.JSXMemberExpression,
	AST_NODE_TYPES.JSXNamespacedName
]);
/**
* Check if a node is a JSX-related node
* Note: This runtime guard includes JSXExpressionContainer which is commonly needed
* for AST traversals but not included in the TSESTreeJSX type union.
* @param node The node to check
* @returns True if the node is a JSX node
* @see TSESTreeJSX
*/
const isJSX = isOneOf([
	AST_NODE_TYPES.JSXAttribute,
	AST_NODE_TYPES.JSXClosingElement,
	AST_NODE_TYPES.JSXClosingFragment,
	AST_NODE_TYPES.JSXElement,
	AST_NODE_TYPES.JSXEmptyExpression,
	AST_NODE_TYPES.JSXExpressionContainer,
	AST_NODE_TYPES.JSXFragment,
	AST_NODE_TYPES.JSXIdentifier,
	AST_NODE_TYPES.JSXMemberExpression,
	AST_NODE_TYPES.JSXNamespacedName,
	AST_NODE_TYPES.JSXOpeningElement,
	AST_NODE_TYPES.JSXOpeningFragment,
	AST_NODE_TYPES.JSXSpreadAttribute,
	AST_NODE_TYPES.JSXSpreadChild,
	AST_NODE_TYPES.JSXText
]);
/**
* Check if a node is a loop statement
* @param node The node to check
* @returns True if the node is a loop
*/
const isLoop = isOneOf([
	AST_NODE_TYPES.DoWhileStatement,
	AST_NODE_TYPES.ForInStatement,
	AST_NODE_TYPES.ForOfStatement,
	AST_NODE_TYPES.ForStatement,
	AST_NODE_TYPES.WhileStatement
]);
/**
* Check if a node is a control flow statement (loop, if, or switch)
* @param node The node to check
* @returns True if the node is a control flow statement
*/
const isControlFlow = or(isLoop, isOneOf([AST_NODE_TYPES.IfStatement, AST_NODE_TYPES.SwitchStatement]));
/**
* Check if a node is a conditional expression or control flow statement
* @param node The node to check
* @returns True if the node is conditional
*/
const isConditional = or(isControlFlow, isOneOf([AST_NODE_TYPES.LogicalExpression, AST_NODE_TYPES.ConditionalExpression]));
/**
* Check if a node is a TypeScript type expression
* @param node The node to check
* @returns True if the node is a type expression
*/
const isTypeExpression = isOneOf([
	AST_NODE_TYPES.TSAsExpression,
	AST_NODE_TYPES.TSTypeAssertion,
	AST_NODE_TYPES.TSNonNullExpression,
	AST_NODE_TYPES.TSSatisfiesExpression,
	AST_NODE_TYPES.TSInstantiationExpression
]);
/**
* Check if a node is a TypeScript type assertion expression
* @param node The node to check
* @returns True if the node is a type assertion expression
*/
const isTypeAssertionExpression = isOneOf([
	AST_NODE_TYPES.TSAsExpression,
	AST_NODE_TYPES.TSTypeAssertion,
	AST_NODE_TYPES.TSNonNullExpression,
	AST_NODE_TYPES.TSSatisfiesExpression
]);

//#endregion
//#region src/node-unwrap.ts
/**
* Unwraps any type expressions to get the underlying JavaScript expression node.
* Recursively processes nodes until a non-type expression is found.
* @param node The AST node to unwrap
* @returns The underlying JavaScript expression node
*/
function getUnderlyingExpression(node) {
	if (isTypeExpression(node)) return getUnderlyingExpression(node.expression);
	return node;
}

//#endregion
//#region src/expression-is.ts
/**
* Check if the given expression is a 'this' expression
* Unwraps any type expressions before checking
*
* @param node The expression node to check
* @returns True if the expression is a 'this' expression, false otherwise
*/
function isThisExpressionLoose(node) {
	return getUnderlyingExpression(node).type === AST_NODE_TYPES.ThisExpression;
}

//#endregion
//#region src/node-traverse.ts
function findParent(node, test) {
	if (node == null) return null;
	let parent = node.parent;
	while (parent != null && parent.type !== AST_NODE_TYPES.Program) {
		if (test(parent)) return parent;
		parent = parent.parent;
	}
	return null;
}

//#endregion
//#region src/expression-nested.ts
/**
* Get all nested identifiers in a expression like node
* @param node The node to get the nested identifiers from
* @returns All nested identifiers
*/
function getNestedIdentifiers(node) {
	const identifiers = [];
	if (node.type === AST_NODE_TYPES.Identifier) identifiers.push(node);
	if ("arguments" in node) {
		const chunk = node.arguments.flatMap(getNestedIdentifiers);
		identifiers.push(...chunk);
	}
	if ("elements" in node) {
		const chunk = node.elements.filter((x) => x != null).flatMap(getNestedIdentifiers);
		identifiers.push(...chunk);
	}
	if ("properties" in node) {
		const chunk = node.properties.flatMap(getNestedIdentifiers);
		identifiers.push(...chunk);
	}
	if ("expressions" in node) {
		const chunk = node.expressions.flatMap(getNestedIdentifiers);
		identifiers.push(...chunk);
	}
	if ("left" in node) {
		const chunk = getNestedIdentifiers(node.left);
		identifiers.push(...chunk);
	}
	if ("right" in node) {
		const chunk = getNestedIdentifiers(node.right);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.Property) {
		const chunk = getNestedIdentifiers(node.value);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.SpreadElement) {
		const chunk = getNestedIdentifiers(node.argument);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.MemberExpression) {
		identifiers.push(...getNestedIdentifiers(node.object));
		if (node.computed) identifiers.push(...getNestedIdentifiers(node.property));
	}
	if (node.type === AST_NODE_TYPES.UnaryExpression) {
		const chunk = getNestedIdentifiers(node.argument);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.ChainExpression) {
		const chunk = getNestedIdentifiers(node.expression);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.TSNonNullExpression) {
		const chunk = getNestedIdentifiers(node.expression);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.TSAsExpression) {
		const chunk = getNestedIdentifiers(node.expression);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.TSSatisfiesExpression) {
		const chunk = getNestedIdentifiers(node.expression);
		identifiers.push(...chunk);
	}
	if (node.type === AST_NODE_TYPES.ConditionalExpression) {
		identifiers.push(...getNestedIdentifiers(node.test));
		identifiers.push(...getNestedIdentifiers(node.consequent));
		identifiers.push(...getNestedIdentifiers(node.alternate));
	}
	if (node.type === AST_NODE_TYPES.AwaitExpression) identifiers.push(...getNestedIdentifiers(node.argument));
	if (node.type === AST_NODE_TYPES.YieldExpression && node.argument != null) identifiers.push(...getNestedIdentifiers(node.argument));
	if (node.type === AST_NODE_TYPES.UpdateExpression) identifiers.push(...getNestedIdentifiers(node.argument));
	if (node.type === AST_NODE_TYPES.CallExpression || node.type === AST_NODE_TYPES.NewExpression) identifiers.push(...getNestedIdentifiers(node.callee));
	if (node.type === AST_NODE_TYPES.TaggedTemplateExpression) {
		identifiers.push(...getNestedIdentifiers(node.tag));
		identifiers.push(...getNestedIdentifiers(node.quasi));
	}
	if (node.type === AST_NODE_TYPES.ImportExpression) identifiers.push(...getNestedIdentifiers(node.source));
	if (node.type === AST_NODE_TYPES.TSTypeAssertion) identifiers.push(...getNestedIdentifiers(node.expression));
	if (node.type === AST_NODE_TYPES.TSInstantiationExpression) identifiers.push(...getNestedIdentifiers(node.expression));
	return identifiers;
}
/**
* Gets the nested return statements in the node that are within the same function
* @param node The AST node
* @returns The nested return statements in the node
*/
function getNestedReturnStatements(node) {
	const statements = [];
	const boundaryNode = isFunction(node) ? node : findParent(node, isFunction);
	simpleTraverse(node, { enter(node) {
		if (node.type !== AST_NODE_TYPES.ReturnStatement) return;
		if (findParent(node, isFunction) !== boundaryNode) return;
		statements.push(node);
	} });
	return statements;
}
/**
* Get all nested expressions of type T in an expression like node
* @param type The type of the expression to retrieve within the node
* @returns A partially applied function bound to a predicate of type AST. The returned function can be called passing a
* node, and it will return an array of all nested expressions of type AST.
*/
function getNestedExpressionsOfType(type) {
	const isNodeOfType = is(type);
	const recurse = (node) => {
		const expressions = [];
		if (isNodeOfType(node)) expressions.push(node);
		if ("arguments" in node) {
			const chunk = node.arguments.flatMap(recurse);
			expressions.push(...chunk);
		}
		if ("expression" in node && node.expression !== true && node.expression !== false) {
			const chunk = recurse(node.expression);
			expressions.push(...chunk);
		}
		if ("left" in node) {
			const chunk = recurse(node.left);
			expressions.push(...chunk);
		}
		if ("right" in node) {
			const chunk = recurse(node.right);
			expressions.push(...chunk);
		}
		if ("test" in node && node.test != null) {
			const chunk = recurse(node.test);
			expressions.push(...chunk);
		}
		if ("consequent" in node) {
			const chunk = Array.isArray(node.consequent) ? node.consequent.flatMap(recurse) : recurse(node.consequent);
			expressions.push(...chunk);
		}
		if ("alternate" in node && node.alternate != null) {
			const chunk = Array.isArray(node.alternate) ? node.alternate.flatMap(recurse) : recurse(node.alternate);
			expressions.push(...chunk);
		}
		if ("elements" in node) {
			const chunk = node.elements.filter((x) => x != null).flatMap(recurse);
			expressions.push(...chunk);
		}
		if ("properties" in node) {
			const chunk = node.properties.flatMap(recurse);
			expressions.push(...chunk);
		}
		if ("expressions" in node) {
			const chunk = node.expressions.flatMap(recurse);
			expressions.push(...chunk);
		}
		if (node.type === AST_NODE_TYPES.Property) {
			const chunk = recurse(node.value);
			expressions.push(...chunk);
		}
		if (node.type === AST_NODE_TYPES.SpreadElement) {
			const chunk = recurse(node.argument);
			expressions.push(...chunk);
		}
		if (node.type === AST_NODE_TYPES.MemberExpression) {
			expressions.push(...recurse(node.object));
			if (node.computed) expressions.push(...recurse(node.property));
		}
		if (node.type === AST_NODE_TYPES.UnaryExpression) {
			const chunk = recurse(node.argument);
			expressions.push(...chunk);
		}
		if (node.type === AST_NODE_TYPES.AwaitExpression) expressions.push(...recurse(node.argument));
		if (node.type === AST_NODE_TYPES.YieldExpression && node.argument != null) expressions.push(...recurse(node.argument));
		if (node.type === AST_NODE_TYPES.UpdateExpression) expressions.push(...recurse(node.argument));
		if (node.type === AST_NODE_TYPES.CallExpression || node.type === AST_NODE_TYPES.NewExpression) expressions.push(...recurse(node.callee));
		if (node.type === AST_NODE_TYPES.TaggedTemplateExpression) {
			expressions.push(...recurse(node.tag));
			expressions.push(...recurse(node.quasi));
		}
		if (node.type === AST_NODE_TYPES.ImportExpression) expressions.push(...recurse(node.source));
		return expressions;
	};
	return recurse;
}
/**
* Get all nested new expressions in an expression like node
* @param node The node to get the nested new expressions from
* @returns All nested new expressions
*/
const getNestedNewExpressions = getNestedExpressionsOfType(AST_NODE_TYPES.NewExpression);
/**
* Get all nested call expressions in a expression like node
* @param node The node to get the nested call expressions from
* @returns All nested call expressions
*/
const getNestedCallExpressions = getNestedExpressionsOfType(AST_NODE_TYPES.CallExpression);

//#endregion
//#region src/file-directive.ts
/**
* Get all directive expression statements from the top of a program AST node
* @param node The program AST node
* @returns The array of directive string literals (ex: "use strict")
*/
function getFileDirectives(node) {
	const directives = [];
	for (const stmt of node.body) {
		if (!isDirective(stmt)) continue;
		directives.push(stmt);
	}
	return directives;
}
/**
* Check if a directive with the given name exists in the file directives
* @param node The program AST node
* @param name The directive name to check (ex: "use strict", "use memo", "use no memo")
* @returns True if the directive exists, false otherwise
*/
function isDirectiveInFile(node, name) {
	return getFileDirectives(node).some((d) => d.directive === name);
}

//#endregion
//#region src/function-directive.ts
/**
* Get all directive expression statements from the top of a function AST node
* @param node The function AST node
* @returns The array of directive string literals (ex: "use memo", "use no memo")
*/
function getFunctionDirectives(node) {
	const directives = [];
	if (node.body.type !== AST_NODE_TYPES.BlockStatement) return directives;
	for (const stmt of node.body.body) {
		if (!isDirective(stmt)) continue;
		directives.push(stmt);
	}
	return directives;
}
/**
* Check if a directive with the given name exists in the function directives
* @param node The function AST node
* @param name The directive name to check (ex: "use memo", "use no memo")
* @returns True if the directive exists, false otherwise
*/
function isDirectiveInFunction(node, name) {
	return getFunctionDirectives(node).some((d) => d.directive === name);
}

//#endregion
//#region src/function-id.ts
/**
* Gets the static name of a function AST node. For function declarations it is
* easy. For anonymous function expressions it is much harder. If you search for
* `IsAnonymousFunctionDefinition()` in the ECMAScript spec you'll find places
* where JS gives anonymous function expressions names. We roughly detect the
* same AST nodes with some exceptions to better fit our use case.
*/
function getFunctionId(node) {
	switch (true) {
		case "id" in node && node.id != null: return node.id;
		case node.parent.type === AST_NODE_TYPES.VariableDeclarator && node.parent.init === node: return node.parent.id;
		case node.parent.type === AST_NODE_TYPES.AssignmentExpression && node.parent.right === node && node.parent.operator === "=": return node.parent.left;
		case node.parent.type === AST_NODE_TYPES.Property && node.parent.value === node && !node.parent.computed: return node.parent.key;
		case isMethodOrProperty(node.parent) && node.parent.value === node: return node.parent.key;
		case node.parent.type === AST_NODE_TYPES.AssignmentPattern && node.parent.right === node: return node.parent.left;
		case node.parent.type === AST_NODE_TYPES.ConditionalExpression: return getFunctionId(node.parent);
		case isTypeAssertionExpression(node.parent): return getFunctionId(node.parent);
	}
	return null;
}

//#endregion
//#region src/function-init-path.ts
/**
* Identifies the initialization path of a function node in the ast.
* Determine what kind of component declaration pattern the function belongs to.
*
* @param node The function node to analyze
* @returns The function initialization path or null if not identifiable
*/
function getFunctionInitPath(node) {
	if (node.type === AST_NODE_TYPES.FunctionDeclaration) return [node];
	let parent = node.parent;
	while (isTypeExpression(parent)) parent = parent.parent;
	switch (true) {
		case parent.type === AST_NODE_TYPES.VariableDeclarator: return [
			parent.parent,
			parent,
			node
		];
		case parent.type === AST_NODE_TYPES.CallExpression && parent.parent.type === AST_NODE_TYPES.VariableDeclarator: return [
			parent.parent.parent,
			parent.parent,
			parent,
			node
		];
		case parent.type === AST_NODE_TYPES.CallExpression && parent.parent.type === AST_NODE_TYPES.CallExpression && parent.parent.parent.type === AST_NODE_TYPES.VariableDeclarator: return [
			parent.parent.parent.parent,
			parent.parent.parent,
			parent.parent,
			parent,
			node
		];
		case parent.type === AST_NODE_TYPES.Property && parent.parent.type === AST_NODE_TYPES.ObjectExpression && parent.parent.parent.type === AST_NODE_TYPES.VariableDeclarator: return [
			parent.parent.parent.parent,
			parent.parent.parent,
			parent.parent,
			parent,
			node
		];
		case parent.type === AST_NODE_TYPES.MethodDefinition: return [
			parent.parent.parent,
			parent.parent,
			parent,
			node
		];
		case parent.type === AST_NODE_TYPES.PropertyDefinition: return [
			parent.parent.parent,
			parent.parent,
			parent,
			node
		];
	}
	return null;
}
/**
* Check if a specific function call exists in the function initialization path.
* Useful for detecting HOCs like React.memo, React.forwardRef, etc.
*
* @param callName The name of the call to check for (ex: "memo", "forwardRef")
* @param initPath The function initialization path to search in
* @returns True if the call exists in the path, false otherwise
*/
function hasCallInFunctionInitPath(callName, initPath) {
	return initPath.some((node) => {
		if (node.type !== AST_NODE_TYPES.CallExpression) return false;
		const { callee } = node;
		if (callee.type === AST_NODE_TYPES.Identifier) return callee.name === callName;
		if (callee.type === AST_NODE_TYPES.MemberExpression && "name" in callee.property) return callee.property.name === callName;
		return false;
	});
}

//#endregion
//#region src/function-is.ts
/**
* Check if a function is empty
* @param node The function node to check
* @returns True if the function is empty, false otherwise
*/
function isFunctionEmpty(node) {
	return node.body.type === AST_NODE_TYPES.BlockStatement && node.body.body.length === 0;
}
/**
* Check if a function is immediately invoked
* @param node The function node to check
* @returns True if the function is immediately invoked, false otherwise
*/
function isFunctionImmediatelyInvoked(node) {
	return node.type !== AST_NODE_TYPES.FunctionDeclaration && node.parent.type === AST_NODE_TYPES.CallExpression && node.parent.callee === node;
}

//#endregion
//#region src/identifier-is.ts
/**
* Check if the given node is an identifier
* @param node The node to check
* @param name The name to check
* @returns True if the node is an identifier, false otherwise
*/
function isIdentifier(node, name) {
	return node != null && node.type === AST_NODE_TYPES.Identifier && (name == null || node.name === name);
}

//#endregion
//#region src/identifier-name.ts
/**
* Check if a string is a valid JavaScript identifier name
* Note: This only checks for ASCII identifiers. Unicode identifiers (e.g., `const 变量 = 1`)
* are not supported by this simple regex check.
* @param name The string to check
* @returns True if the string is a valid ASCII identifier name
*/
function isIdentifierName(name) {
	return /^[A-Z$_][\w$]*$/i.test(name);
}

//#endregion
//#region src/identifier-traverse.ts
/**
* Get the root identifier of a (possibly nested) member expression.
* For `a.b.c`, returns the `a` Identifier node.
* @param node The expression to analyze
* @returns The root Identifier node, or null if it cannot be determined (ex: non-identifier root)
*/
function getRootIdentifier(node) {
	const expr = getUnderlyingExpression(node);
	switch (expr.type) {
		case AST_NODE_TYPES.Identifier: return expr;
		case AST_NODE_TYPES.MemberExpression: return getRootIdentifier(expr.object);
		default: return null;
	}
}

//#endregion
//#region src/node-equality.ts
/**
* Check if two nodes are equal
* @param a node to compare
* @param b node to compare
* @returns `true` if node equal
* @see https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/util/isNodeEqual.ts
*/
const isNodeEqual = dual(2, (a, b) => {
	a = isTypeExpression(a) ? getUnderlyingExpression(a) : a;
	b = isTypeExpression(b) ? getUnderlyingExpression(b) : b;
	switch (true) {
		case a === b: return true;
		case a.type !== b.type: return false;
		case a.type === AST_NODE_TYPES.Literal && b.type === AST_NODE_TYPES.Literal: return a.value === b.value;
		case a.type === AST_NODE_TYPES.TemplateElement && b.type === AST_NODE_TYPES.TemplateElement: return a.value.raw === b.value.raw;
		case a.type === AST_NODE_TYPES.TemplateLiteral && b.type === AST_NODE_TYPES.TemplateLiteral: {
			if (a.quasis.length !== b.quasis.length || a.expressions.length !== b.expressions.length) return false;
			let i = a.quasis.length;
			while (i--) if (a.quasis[i]?.value.raw !== b.quasis[i]?.value.raw) return false;
			i = a.expressions.length;
			while (i--) {
				const exprA = a.expressions[i];
				const exprB = b.expressions[i];
				if (!isNodeEqual(exprA, exprB)) return false;
			}
			return true;
		}
		case a.type === AST_NODE_TYPES.Identifier && b.type === AST_NODE_TYPES.Identifier: return a.name === b.name;
		case a.type === AST_NODE_TYPES.PrivateIdentifier && b.type === AST_NODE_TYPES.PrivateIdentifier: return a.name === b.name;
		case a.type === AST_NODE_TYPES.MemberExpression && b.type === AST_NODE_TYPES.MemberExpression: return isNodeEqual(a.property, b.property) && isNodeEqual(a.object, b.object);
		case a.type === AST_NODE_TYPES.JSXIdentifier && b.type === AST_NODE_TYPES.JSXIdentifier: return a.name === b.name;
		case a.type === AST_NODE_TYPES.JSXNamespacedName && b.type === AST_NODE_TYPES.JSXNamespacedName: return isNodeEqual(a.namespace, b.namespace) && isNodeEqual(a.name, b.name);
		case a.type === AST_NODE_TYPES.JSXMemberExpression && b.type === AST_NODE_TYPES.JSXMemberExpression: return isNodeEqual(a.object, b.object) && isNodeEqual(a.property, b.property);
		case a.type === AST_NODE_TYPES.JSXAttribute && b.type === AST_NODE_TYPES.JSXAttribute:
			if (!isNodeEqual(a.name, b.name)) return false;
			if (a.value == null || b.value == null) return a.value === b.value;
			return isNodeEqual(a.value, b.value);
		case a.type === AST_NODE_TYPES.ThisExpression && b.type === AST_NODE_TYPES.ThisExpression: return true;
		default: return false;
	}
});

//#endregion
//#region src/node-kind.ts
function getHumanReadableKind(node, delimiter = " ") {
	if (node.type === AST_NODE_TYPES.Literal) {
		if ("regex" in node) return "RegExp literal";
		if (node.value === null) return "null literal";
		return `${typeof node.value} literal`;
	}
	if (isJSX(node)) return `JSX ${toLowerCase(delimiterCase(replace(node.type, "JSX", ""), delimiter))}`;
	return toLowerCase(delimiterCase(node.type, delimiter));
}

//#endregion
//#region src/node-line.ts
function isMultiLine(node) {
	return node.loc.start.line !== node.loc.end.line;
}
function isLineBreak(node) {
	return isOneOf([AST_NODE_TYPES.Literal, AST_NODE_TYPES.JSXText])(node) && typeof node.value === "string" && node.value.trim() === "" && isMultiLine(node);
}

//#endregion
//#region src/node-name.ts
function getFullyQualifiedName(node, getText) {
	switch (node.type) {
		case AST_NODE_TYPES.Identifier:
		case AST_NODE_TYPES.JSXIdentifier:
		case AST_NODE_TYPES.PrivateIdentifier: return node.name;
		case AST_NODE_TYPES.MemberExpression:
		case AST_NODE_TYPES.JSXMemberExpression: return `${getFullyQualifiedName(node.object, getText)}.${getFullyQualifiedName(node.property, getText)}`;
		case AST_NODE_TYPES.JSXNamespacedName: return `${node.namespace.name}:${node.name.name}`;
		case AST_NODE_TYPES.JSXText: return node.value;
		case AST_NODE_TYPES.Literal: return node.raw;
		default: return getText(node);
	}
}

//#endregion
//#region src/node-selectors.ts
/**
* Selector for arrow function expressions with implicit return
*/
const SEL_IMPLICIT_RETURN_ARROW_FUNCTION_EXPRESSION = "ArrowFunctionExpression[body.type!='BlockStatement']";
/**
* Selector for variable declarators with object destructuring
*/
const SEL_OBJECT_DESTRUCTURING_VARIABLE_DECLARATOR = [
	"VariableDeclarator",
	"[id.type='ObjectPattern']",
	"[init.type='Identifier']"
].join("");
/**
* Selector for assignment expressions that set displayName
*/
const SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION = [
	"AssignmentExpression",
	"[operator='=']",
	"[left.type='MemberExpression']",
	"[left.property.name='displayName']"
].join("");

//#endregion
//#region src/pattern-process-env-node-env.ts
/**
* Check if the given node is a member expression that accesses `process.env.NODE_ENV`
* @param node The AST node
* @returns True if the node is a member expression that accesses `process.env.NODE_ENV`, false otherwise
*/
function isProcessEnvNodeEnv(node) {
	return node != null && node.type === AST_NODE_TYPES.MemberExpression && node.object.type === AST_NODE_TYPES.MemberExpression && node.object.object.type === AST_NODE_TYPES.Identifier && node.object.object.name === "process" && node.object.property.type === AST_NODE_TYPES.Identifier && node.object.property.name === "env" && node.property.type === AST_NODE_TYPES.Identifier && node.property.name === "NODE_ENV";
}
/**
* Check if the given node is a binary expression that compares `process.env.NODE_ENV` with a string literal.
* @param node The AST node
* @param operator The operator used in the comparison
* @param value The string literal value to compare against
* @returns True if the node is a binary expression that compares `process.env.NODE_ENV` with the specified value, false otherwise
*/
function isProcessEnvNodeEnvCompare(node, operator, value) {
	if (node == null) return false;
	if (node.type !== AST_NODE_TYPES.BinaryExpression) return false;
	if (node.operator !== operator) return false;
	if (isProcessEnvNodeEnv(node.left) && isLiteral(node.right, "string")) return node.right.value === value;
	if (isLiteral(node.left, "string") && isProcessEnvNodeEnv(node.right)) return node.left.value === value;
	return false;
}

//#endregion
//#region src/pattern-test-mock.ts
/**
* Check if the given node is a `vi.mock`.
* @param node The node to check
* @returns `true` if the node is a `vi.mock`, otherwise `false`.
* @internal
*/
function isViMock(node) {
	return node != null && node.type === AST_NODE_TYPES.MemberExpression && node.object.type === AST_NODE_TYPES.Identifier && node.object.name === "vi" && node.property.type === AST_NODE_TYPES.Identifier && node.property.name === "mock";
}
/**
* Check if the given node is a `jest.mock`.
* @param node The node to check
* @returns `true` if the node is a `jest.mock`, otherwise `false`.
* @internal
*/
function isJestMock(node) {
	return node != null && node.type === AST_NODE_TYPES.MemberExpression && node.object.type === AST_NODE_TYPES.Identifier && node.object.name === "jest" && node.property.type === AST_NODE_TYPES.Identifier && node.property.name === "mock";
}
/**
* Check if the given node is a `vi.mock` callback.
* @param node The node to check
* @returns `true` if the node is a `vi.mock` callback, otherwise `false`.
* @internal
*/
function isViMockCallback(node) {
	return node != null && isFunction(node) && node.parent.type === AST_NODE_TYPES.CallExpression && isViMock(node.parent.callee) && node.parent.arguments[1] === node;
}
/**
* Check if the given node is a `jest.mock` callback.
* @param node The node to check
* @returns `true` if the node is a `jest.mock` callback, otherwise `false`.
* @internal
*/
function isJestMockCallback(node) {
	return node != null && isFunction(node) && node.parent.type === AST_NODE_TYPES.CallExpression && isJestMock(node.parent.callee) && node.parent.arguments[1] === node;
}
/**
* Check if the given node is a `vi.mock` or `jest.mock` callback.
* @param node The node to check
* @returns `true` if the node is a test mock callback, otherwise `false`.
*/
function isTestMockCallback(node) {
	return isViMockCallback(node) || isJestMockCallback(node);
}

//#endregion
//#region src/property-name.ts
/**
* Get the name of a property from a node
* Handles identifiers, private identifiers, literals, and template literals
* @param node The node to get the property name from
* @returns The property name or null if not determinable
*/
function getPropertyName(node) {
	if (isTypeExpression(node)) return getPropertyName(getUnderlyingExpression(node));
	if (node.type === AST_NODE_TYPES.Identifier || node.type === AST_NODE_TYPES.PrivateIdentifier) return node.name;
	if (node.type === AST_NODE_TYPES.Literal) return String(node.value);
	if (node.type === AST_NODE_TYPES.TemplateLiteral && node.expressions.length === 0) return node.quasis[0]?.value.cooked ?? node.quasis[0]?.value.raw ?? null;
	return null;
}

//#endregion
//#region src/property-traverse.ts
/**
* Recursively traverses an object expression's properties to find a property with the specified name
* Note: This only handles inline object literals in spread elements. Properties from variables
* (e.g., `{...props}` where props is a variable) are not resolved.
* @param properties The properties of the object expression to traverse
* @param name The name of the property to find
* @returns The matching property node, or null if not found
*/
function findProperty(properties, name) {
	for (const prop of properties) {
		if (prop.type === AST_NODE_TYPES.Property && getPropertyName(prop.key) === name) return prop;
		if (prop.type === AST_NODE_TYPES.SpreadElement && prop.argument.type === AST_NODE_TYPES.ObjectExpression) {
			const found = findProperty(prop.argument.properties, name);
			if (found != null) return found;
		}
	}
	return null;
}

//#endregion
export { SEL_DISPLAY_NAME_ASSIGNMENT_EXPRESSION, SEL_IMPLICIT_RETURN_ARROW_FUNCTION_EXPRESSION, SEL_OBJECT_DESTRUCTURING_VARIABLE_DECLARATOR, findParent, findProperty, getClassId, getFileDirectives, getFullyQualifiedName, getFunctionDirectives, getFunctionId, getFunctionInitPath, getHumanReadableKind, getNestedCallExpressions, getNestedExpressionsOfType, getNestedIdentifiers, getNestedNewExpressions, getNestedReturnStatements, getPropertyName, getRootIdentifier, getUnderlyingExpression, hasCallInFunctionInitPath, is, isClass, isConditional, isControlFlow, isDirective, isDirectiveInFile, isDirectiveInFunction, isDirectiveKind, isDirectiveLike, isDirectiveName, isFunction, isFunctionEmpty, isFunctionImmediatelyInvoked, isFunctionType, isIdentifier, isIdentifierName, isJSX, isJSXElement, isJSXElementLike, isJSXFragment, isJSXTagNameExpression, isJestMock, isJestMockCallback, isLineBreak, isLiteral, isLoop, isMethodOrProperty, isMultiLine, isNodeEqual, isOneOf, isProcessEnvNodeEnv, isProcessEnvNodeEnvCompare, isProperty, isTestMockCallback, isThisExpressionLoose, isTypeAssertionExpression, isTypeExpression, isViMock, isViMockCallback };