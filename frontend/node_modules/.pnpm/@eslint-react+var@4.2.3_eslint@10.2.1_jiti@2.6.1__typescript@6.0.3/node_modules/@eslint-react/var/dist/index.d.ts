import { TSESTree } from "@typescript-eslint/types";
import { RuleContext } from "@eslint-react/shared";

//#region src/compute-object-type.d.ts
/**
 * Represents the type classification of an object node
 */
type ObjectType = {
  kind: "jsx";
  node: TSESTree.JSXElement | TSESTree.JSXFragment;
} | {
  kind: "array";
  node: TSESTree.ArrayExpression | TSESTree.CallExpression;
} | {
  kind: "plain";
  node: TSESTree.ObjectExpression | TSESTree.CallExpression;
} | {
  kind: "class";
  node: TSESTree.ClassExpression;
} | {
  kind: "instance";
  node: TSESTree.NewExpression | TSESTree.ThisExpression;
} | {
  kind: "function";
  node: TSESTree.FunctionDeclaration | TSESTree.FunctionExpression | TSESTree.ArrowFunctionExpression;
} | {
  kind: "regexp";
  node: TSESTree.RegExpLiteral | TSESTree.CallExpression;
} | {
  kind: "unknown";
  node: TSESTree.Node;
  reason?: string;
};
/**
 * Detect the ObjectType of a given node
 * @param context The context of the rule
 * @param node The node to check
 * @returns The ObjectType of the node, or undefined if not detected
 */
declare function computeObjectType(context: RuleContext, node: TSESTree.Node | null): ObjectType | null;
//#endregion
//#region src/find-enclosing-assignment-target.d.ts
/**
 * Finds the enclosing assignment target (variable, property, etc.) for a given node
 *
 * @param node The starting node
 * @returns The enclosing assignment target node, or null if not found
 */
declare function findEnclosingAssignmentTarget(node: TSESTree.Node): TSESTree.ArrayExpression | TSESTree.ArrayPattern | TSESTree.ArrowFunctionExpression | TSESTree.AssignmentExpression | TSESTree.AwaitExpression | TSESTree.PrivateInExpression | TSESTree.SymmetricBinaryExpression | TSESTree.CallExpression | TSESTree.ChainExpression | TSESTree.ClassDeclarationWithOptionalName | TSESTree.ClassExpression | TSESTree.ConditionalExpression | TSESTree.FunctionDeclarationWithName | TSESTree.FunctionDeclarationWithOptionalName | TSESTree.FunctionExpression | TSESTree.Identifier | TSESTree.ImportExpression | TSESTree.JSXElement | TSESTree.JSXFragment | TSESTree.BigIntLiteral | TSESTree.BooleanLiteral | TSESTree.NullLiteral | TSESTree.NumberLiteral | TSESTree.RegExpLiteral | TSESTree.StringLiteral | TSESTree.LogicalExpression | TSESTree.MemberExpressionComputedName | TSESTree.MemberExpressionNonComputedName | TSESTree.MetaProperty | TSESTree.NewExpression | TSESTree.ObjectExpression | TSESTree.ObjectPattern | TSESTree.PrivateIdentifier | TSESTree.SequenceExpression | TSESTree.Super | TSESTree.TaggedTemplateExpression | TSESTree.TemplateLiteral | TSESTree.ThisExpression | TSESTree.TSAsExpression | TSESTree.TSDeclareFunctionNoDeclare | TSESTree.TSDeclareFunctionWithDeclare | TSESTree.TSEnumDeclaration | TSESTree.TSInstantiationExpression | TSESTree.TSInterfaceDeclaration | TSESTree.TSModuleDeclarationGlobal | TSESTree.TSModuleDeclarationModuleWithIdentifierId | TSESTree.TSModuleDeclarationModuleWithStringIdDeclared | TSESTree.TSModuleDeclarationModuleWithStringIdNotDeclared | TSESTree.TSModuleDeclarationNamespace | TSESTree.TSNonNullExpression | TSESTree.TSSatisfiesExpression | TSESTree.TSTypeAliasDeclaration | TSESTree.TSTypeAssertion | TSESTree.UnaryExpressionBitwiseNot | TSESTree.UnaryExpressionDelete | TSESTree.UnaryExpressionMinus | TSESTree.UnaryExpressionNot | TSESTree.UnaryExpressionPlus | TSESTree.UnaryExpressionTypeof | TSESTree.UnaryExpressionVoid | TSESTree.UpdateExpression | TSESTree.ConstDeclaration | TSESTree.LetOrVarDeclaredDeclaration | TSESTree.LetOrVarNonDeclaredDeclaration | TSESTree.UsingInForOfDeclaration | TSESTree.UsingInNormalContextDeclaration | TSESTree.YieldExpression | null;
/**
 * Type representing the possible assignment targets returned by `findEnclosingAssignmentTarget`
 */
type AssignmentTarget = ReturnType<typeof findEnclosingAssignmentTarget>;
//#endregion
//#region src/is-assignment-target-equal.d.ts
/**
 * Check if two assignment targets are equal
 * Compares nodes directly or by their values
 * @param context The rule context
 * @param a The first node to compare
 * @param b The second node to compare
 * @returns True if the assignment targets are equal
 * @internal
 */
declare function isAssignmentTargetEqual(context: RuleContext, a: TSESTree.Node, b: TSESTree.Node): boolean;
//#endregion
//#region src/is-value-equal.d.ts
/**
 * Determine whether node value equals to another node value
 * @param context rule context
 * @param a node to compare
 * @param b node to compare
 * @returns `true` if node value equal
 */
declare function isValueEqual(context: RuleContext, a: TSESTree.Node, b: TSESTree.Node): boolean;
//#endregion
//#region src/resolve.d.ts
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
declare function resolve(context: RuleContext, node: TSESTree.Identifier, options?: Partial<{
  at: number;
  localOnly: boolean;
}>): TSESTree.Node | null;
//#endregion
export { AssignmentTarget, ObjectType, computeObjectType, findEnclosingAssignmentTarget, isAssignmentTargetEqual, isValueEqual, resolve };