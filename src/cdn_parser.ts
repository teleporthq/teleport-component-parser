import * as parser from "@babel/parser";
import traverse from "@babel/traverse";
import * as types from "@babel/types";

const traverseForElemensts = (ast: types.File, result: AnalyzedResult) => {
  traverse(ast, {
    CallExpression: path => {
      const expression = path.node.callee as types.MemberExpression;
      const args: [types.StringLiteral, types.Identifier] = path.node
        .arguments as [types.StringLiteral, types.Identifier];
      if (
        expression &&
        expression?.type === "MemberExpression" &&
        args &&
        args.length === 2 &&
        expression?.object
      ) {
        const identifier = expression.object as types.Identifier;
        if (identifier && identifier.name === "customElements") {
          result[args[0].value] = {
            name: args[0].value,
            className: args[1].name,
            properties: []
          };
        }
      }
    }
  });
};

const traverseForAttributes = (ast: types.File, result: AnalyzedResult) => {
  /* Checks only for immediate parent, may be we can check 
   extends and then parse the parent too*/
  traverse(ast, {
    ClassDeclaration: path => {
      const className = path.node?.id?.name;
      const customElm = Object.values(result).find(
        tag => tag.className === className
      );
      const shouldParse = Boolean(customElm);
      if (className && shouldParse) {
        const body = path.node?.body?.body;
        if (body) {
          const properties = body.find(
            (method: types.ClassMethod) =>
              method.kind === "get" &&
              (method.key as types.Identifier).name === "properties"
          ) as types.ClassMethod;
          if (properties && properties.body.type === "BlockStatement") {
            const returnBody = properties.body.body[0] as types.ReturnStatement;
            if (
              returnBody &&
              (returnBody.argument as types.ObjectExpression)?.properties
            ) {
              (returnBody.argument as types.ObjectExpression)?.properties.forEach(
                (prop: types.ObjectProperty) => {
                  const property = prop.key as types.Identifier;
                  result[customElm.name].properties.push(property.name);
                }
              );
            }
          }
        }
      }
    }
  });
};

export interface ParsedResult {
  name: string;
  className: string;
  properties: string[];
}

export type AnalyzedResult = Record<string, ParsedResult>;

export const cdnParser = (code: string) => {
  const result: AnalyzedResult = {};
  const ast: types.File = parser.parse(code, { sourceType: "module" });
  // Traversing for the custom-element names
  traverseForElemensts(ast, result);
  // Traverse for fetching attributes
  traverseForAttributes(ast, result);

  return result;
};
