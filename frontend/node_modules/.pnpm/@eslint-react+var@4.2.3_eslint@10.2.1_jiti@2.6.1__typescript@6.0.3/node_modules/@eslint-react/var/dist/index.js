import * as ast from "@eslint-react/ast";
import { isIdentifier } from "@eslint-react/ast";
import { DefinitionType } from "@typescript-eslint/scope-manager";
import { AST_NODE_TYPES } from "@typescript-eslint/types";
import { findVariable, getStaticValue } from "@typescript-eslint/utils/ast-utils";

//#region src/resolve.ts
/**
* Resolves an identifier to the AST node that represents its value,
* suitable for use in ESLint rule analysis.
*
* The resolution follows these rules per definition type:
*
* | Definition type          | `def.node`                                   | Returns                            |
* |--------------------------|----------------------------------------------|------------------------------------|
* | `Variable`               | `VariableDeclarator`                         | `def.node.init` (or `null`)        |
* | `FunctionName`           | `FunctionDeclaration` / `FunctionExpression` | `def.node`                         |
* | `ClassName`              | `ClassDeclaration` / `ClassExpression`       | `def.node`                         |
* | `Parameter`              | containing function node                     | `def.node` (if a real function)    |
* | `TSEnumName`             | `TSEnumDeclaration`                          | `def.node`                         |
* | `TSEnumMember`           | `TSEnumMember`                               | `def.node.initializer` (or `null`) |
* | `ImportBinding`          | import specifier                             | `null`                             |
* | `CatchClause`            | `CatchClause`                                | `null`                             |
* | `TSModuleName`           | `TSModuleDeclaration`                        | `null`                             |
* | `Type`                   | type alias node                              | `null`                             |
* | `ImplicitGlobalVariable` | any node                                     | `null`                             |
*
* @param context The ESLint rule context used for scope lookup.
* @param node The identifier to resolve.
* @param options Optional settings:
* - `at`: Index of the definition to resolve (default: `0` for the first definition).
* - `localOnly`: If `true`, only consider variables declared in the same scope as the identifier
*   will miss variables declared in an outer scope). When `false` (default), traverse the scope
*   chain upward via `findVariable` so that references to outer-scope bindings are resolved
*   correctly.
* @returns The resolved node, or `null` if the identifier cannot be resolved to a value node.
*/
function resolve(context, node, options) {
	const { at = 0, localOnly = false } = options ?? {};
	const scope = context.sourceCode.getScope(node);
	const variable = localOnly ? scope.set.get(node.name) : findVariable(scope, node);
	if (variable == null) return null;
	const def = variable.defs.at(at);
	if (def == null) return null;
	switch (def.type) {
		case DefinitionType.FunctionName: return def.node;
		case DefinitionType.ClassName: return def.node;
		case DefinitionType.Variable: {
			const { init } = def.node;
			if (init == null) return null;
			if ("declarations" in init) return null;
			return init;
		}
		case DefinitionType.Parameter: return ast.isFunction(def.node) ? def.node : null;
		case DefinitionType.TSEnumName: return def.node;
		case DefinitionType.TSEnumMember: return def.node.initializer ?? null;
		case DefinitionType.ImportBinding: return null;
		case DefinitionType.CatchClause: return null;
		case DefinitionType.TSModuleName: return null;
		case DefinitionType.Type: return null;
		case DefinitionType.ImplicitGlobalVariable: return null;
		default: return null;
	}
}

//#endregion
//#region src/compute-object-type.ts
/**
* Detect the ObjectType of a given node
* @param context The context of the rule
* @param node The node to check
* @returns The ObjectType of the node, or undefined if not detected
*/
function computeObjectType(context, node) {
	if (node == null) return null;
	switch (node.type) {
		case AST_NODE_TYPES.JSXElement:
		case AST_NODE_TYPES.JSXFragment: return {
			kind: "jsx",
			node
		};
		case AST_NODE_TYPES.ArrayExpression: return {
			kind: "array",
			node
		};
		case AST_NODE_TYPES.ObjectExpression: return {
			kind: "plain",
			node
		};
		case AST_NODE_TYPES.ClassExpression: return {
			kind: "class",
			node
		};
		case AST_NODE_TYPES.NewExpression:
		case AST_NODE_TYPES.ThisExpression: return {
			kind: "instance",
			node
		};
		case AST_NODE_TYPES.FunctionDeclaration:
		case AST_NODE_TYPES.FunctionExpression:
		case AST_NODE_TYPES.ArrowFunctionExpression: return {
			kind: "function",
			node
		};
		case AST_NODE_TYPES.Literal:
			if ("regex" in node) return {
				kind: "regexp",
				node
			};
			return null;
		case AST_NODE_TYPES.Identifier: {
			if ((context.sourceCode.getScope(node).set.get(node.name)?.defs.at(-1))?.type === DefinitionType.Parameter) return null;
			const initNode = resolve(context, node, {
				at: -1,
				localOnly: true
			});
			if (initNode == null) return null;
			return computeObjectType(context, initNode);
		}
		case AST_NODE_TYPES.MemberExpression: return computeObjectType(context, node.object);
		case AST_NODE_TYPES.AssignmentExpression:
		case AST_NODE_TYPES.AssignmentPattern: return computeObjectType(context, node.right);
		case AST_NODE_TYPES.LogicalExpression: return computeObjectType(context, node.left) ?? computeObjectType(context, node.right);
		case AST_NODE_TYPES.ConditionalExpression: return computeObjectType(context, node.consequent) ?? computeObjectType(context, node.alternate);
		case AST_NODE_TYPES.SequenceExpression:
			if (node.expressions.length === 0) return null;
			return computeObjectType(context, node.expressions[node.expressions.length - 1] ?? null);
		case AST_NODE_TYPES.CallExpression:
			switch (true) {
				case isIdentifier(node.callee, "Boolean"): return null;
				case isIdentifier(node.callee, "String"): return null;
				case isIdentifier(node.callee, "Number"): return null;
				case isIdentifier(node.callee, "Object"): return {
					kind: "plain",
					node
				};
				case isIdentifier(node.callee, "Array"): return {
					kind: "array",
					node
				};
				case isIdentifier(node.callee, "RegExp"): return {
					kind: "regexp",
					node
				};
			}
			if (node.callee.type === AST_NODE_TYPES.MemberExpression && isIdentifier(node.callee.object) && isIdentifier(node.callee.property)) {
				const objName = node.callee.object.name;
				const methodName = node.callee.property.name;
				switch (objName) {
					case "Array":
						if (methodName === "from" || methodName === "of") return {
							kind: "array",
							node
						};
						break;
					case "Object":
						if (methodName === "create" || methodName === "assign" || methodName === "fromEntries") return {
							kind: "plain",
							node
						};
						break;
				}
			}
			return {
				kind: "unknown",
				node,
				reason: "call-expression"
			};
		default:
			if (!("expression" in node) || typeof node.expression !== "object") return null;
			return computeObjectType(context, node.expression);
	}
}

//#endregion
//#region src/find-enclosing-assignment-target.ts
/**
* Finds the enclosing assignment target (variable, property, etc.) for a given node
*
* @param node The starting node
* @returns The enclosing assignment target node, or null if not found
*/
function findEnclosingAssignmentTarget(node) {
	switch (true) {
		case node.type === AST_NODE_TYPES.VariableDeclarator: return node.id;
		case node.type === AST_NODE_TYPES.AssignmentExpression: return node.left;
		case node.type === AST_NODE_TYPES.PropertyDefinition: return node.key;
		case node.type === AST_NODE_TYPES.ExportDefaultDeclaration: return node.declaration;
		case node.type === AST_NODE_TYPES.BlockStatement || node.type === AST_NODE_TYPES.Program: return null;
		default: return findEnclosingAssignmentTarget(node.parent);
	}
}

//#endregion
//#region src/is-value-equal.ts
const thisBlockTypes = [
	AST_NODE_TYPES.FunctionDeclaration,
	AST_NODE_TYPES.FunctionExpression,
	AST_NODE_TYPES.ClassBody,
	AST_NODE_TYPES.Program
];
/**
* Determine whether node value equals to another node value
* @param context rule context
* @param a node to compare
* @param b node to compare
* @returns `true` if node value equal
*/
function isValueEqual(context, a, b) {
	a = ast.isTypeExpression(a) ? ast.getUnderlyingExpression(a) : a;
	b = ast.isTypeExpression(b) ? ast.getUnderlyingExpression(b) : b;
	const [aScope, bScope] = [context.sourceCode.getScope(a), context.sourceCode.getScope(b)];
	switch (true) {
		case a === b: return true;
		case a.type === AST_NODE_TYPES.Literal && b.type === AST_NODE_TYPES.Literal: return a.value === b.value;
		case a.type === AST_NODE_TYPES.TemplateElement && b.type === AST_NODE_TYPES.TemplateElement: return a.value.cooked === b.value.cooked;
		case a.type === AST_NODE_TYPES.Identifier && b.type === AST_NODE_TYPES.Identifier: {
			const aDefNode = resolve(context, a);
			const bDefNode = resolve(context, b);
			const aDefNodeParent = aDefNode?.parent;
			const bDefNodeParent = bDefNode?.parent;
			const aVar = findVariable(aScope, a);
			const bVar = findVariable(bScope, b);
			const aDef = aVar?.defs.at(0);
			const bDef = bVar?.defs.at(0);
			const aDefParentParent = aDef?.parent?.parent;
			const bDefParentParent = bDef?.parent?.parent;
			switch (true) {
				case aDefNodeParent?.type === AST_NODE_TYPES.CallExpression && bDefNodeParent?.type === AST_NODE_TYPES.CallExpression && ast.isFunction(aDefNode) && ast.isFunction(bDefNode): {
					if (!ast.isNodeEqual(aDefNodeParent.callee, bDefNodeParent.callee)) return false;
					const aParams = aDefNode.params;
					const bParams = bDefNode.params;
					const aPos = aParams.findIndex((x) => ast.isNodeEqual(x, a));
					const bPos = bParams.findIndex((x) => ast.isNodeEqual(x, b));
					return aPos !== -1 && bPos !== -1 && aPos === bPos;
				}
				case aDefParentParent?.type === AST_NODE_TYPES.ForOfStatement && bDefParentParent?.type === AST_NODE_TYPES.ForOfStatement: {
					const aLeft = aDefParentParent.left;
					const bLeft = bDefParentParent.left;
					if (aLeft.type !== bLeft.type) return false;
					const aRight = aDefParentParent.right;
					const bRight = bDefParentParent.right;
					if (!ast.isNodeEqual(aRight, bRight)) return false;
					if (aDefParentParent === bDefParentParent) return aVar != null && bVar != null && aVar === bVar;
					return true;
				}
				default: return aVar != null && bVar != null && aVar === bVar;
			}
		}
		case a.type === AST_NODE_TYPES.MemberExpression && b.type === AST_NODE_TYPES.MemberExpression: return (a.computed && b.computed ? isValueEqual(context, a.property, b.property) : ast.isNodeEqual(a.property, b.property)) && isValueEqual(context, a.object, b.object);
		case a.type === AST_NODE_TYPES.ThisExpression && b.type === AST_NODE_TYPES.ThisExpression:
			if (aScope.block === bScope.block) return true;
			return ast.findParent(a, ast.isOneOf(thisBlockTypes)) === ast.findParent(b, ast.isOneOf(thisBlockTypes));
		default: {
			const aStatic = getStaticValue(a, aScope);
			const bStatic = getStaticValue(b, bScope);
			return aStatic != null && bStatic != null && aStatic.value === bStatic.value;
		}
	}
}

//#endregion
//#region src/is-assignment-target-equal.ts
/**
* Check if two assignment targets are equal
* Compares nodes directly or by their values
* @param context The rule context
* @param a The first node to compare
* @param b The second node to compare
* @returns True if the assignment targets are equal
* @internal
*/
function isAssignmentTargetEqual(context, a, b) {
	return ast.isNodeEqual(a, b) || isValueEqual(context, a, b);
}

//#endregion
export { computeObjectType, findEnclosingAssignmentTarget, isAssignmentTargetEqual, isValueEqual, resolve };