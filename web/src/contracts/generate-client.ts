import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

interface OpenApiSchema {
  type?: string;
  properties?: Record<string, any>;
  required?: string[];
  items?: any;
  enum?: string[];
  $ref?: string;
  description?: string;
  nullable?: boolean;
}

function mapType(prop: any): { typeStr: string; isPrimitive: boolean } {
  if (prop.$ref) {
    const className = prop.$ref.split('/').pop()!;
    return { typeStr: className, isPrimitive: false };
  }

  const type = prop.type;
  if (type === 'string') {
    return { typeStr: 'String', isPrimitive: true };
  }
  if (type === 'integer') {
    return { typeStr: 'int', isPrimitive: true };
  }
  if (type === 'number') {
    return { typeStr: 'double', isPrimitive: true };
  }
  if (type === 'boolean') {
    return { typeStr: 'bool', isPrimitive: true };
  }
  if (type === 'array') {
    const itemType = mapType(prop.items);
    return { typeStr: `List<${itemType.typeStr}>`, isPrimitive: false };
  }
  if (type === 'object') {
    return { typeStr: 'Map<String, dynamic>', isPrimitive: true };
  }
  return { typeStr: 'dynamic', isPrimitive: true };
}

function getFromJsonExpr(propName: string, prop: any, isReq: boolean): string {
  const cast = isReq ? '' : '?';

  if (prop.$ref) {
    const className = prop.$ref.split('/').pop()!;
    if (isReq) {
      return `${className}.fromJson(json['${propName}'] as Map<String, dynamic>)`;
    } else {
      return `json['${propName}'] != null ? ${className}.fromJson(json['${propName}'] as Map<String, dynamic>) : null`;
    }
  }

  const type = prop.type;
  if (type === 'string') {
    return `json['${propName}'] as String${cast}`;
  }
  if (type === 'integer') {
    return `json['${propName}'] as int${cast}`;
  }
  if (type === 'number') {
    if (isReq) {
      return `(json['${propName}'] as num).toDouble()`;
    } else {
      return `json['${propName}'] != null ? (json['${propName}'] as num).toDouble() : null`;
    }
  }
  if (type === 'boolean') {
    return `json['${propName}'] as bool${cast}`;
  }
  if (type === 'array') {
    const items = prop.items;
    if (items.$ref) {
      const itemClass = items.$ref.split('/').pop()!;
      if (isReq) {
        return `(json['${propName}'] as List).map((e) => ${itemClass}.fromJson(e as Map<String, dynamic>)).toList()`;
      } else {
        return `json['${propName}'] != null ? (json['${propName}'] as List).map((e) => ${itemClass}.fromJson(e as Map<String, dynamic>)).toList() : null`;
      }
    } else {
      const typeInfo = mapType(items);
      const itemType = typeInfo.typeStr;
      if (isReq) {
        return `(json['${propName}'] as List).map((e) => e as ${itemType}).toList()`;
      } else {
        return `json['${propName}'] != null ? (json['${propName}'] as List).map((e) => e as ${itemType}).toList() : null`;
      }
    }
  }
  if (type === 'object') {
    return `json['${propName}'] as Map<String, dynamic>${cast}`;
  }
  return `json['${propName}']`;
}

function getToJsonExpr(propName: string, prop: any, isReq: boolean): string {
  if (prop.$ref) {
    return isReq ? `${propName}.toJson()` : `${propName}?.toJson()`;
  }
  const type = prop.type;
  if (type === 'array') {
    const items = prop.items;
    if (items.$ref) {
      return isReq
        ? `${propName}.map((e) => e.toJson()).toList()`
        : `${propName}?.map((e) => e.toJson()).toList()`;
    }
  }
  return propName;
}

function run() {
  const jsonPath = resolve(__dirname, 'openapi.json');
  const spec = JSON.parse(readFileSync(jsonPath, 'utf-8'));

  const outputDir = resolve(__dirname, '../../../flutter/lib/core/network/generated');
  mkdirSync(outputDir, { recursive: true });

  // 1. Generate Models
  let modelsContent = `// GENERATED CODE - DO NOT MODIFY BY HAND
// Generated from OpenAPI spec using generate-client.ts

`;

  const schemas = spec.components.schemas || {};
  for (const [name, schema] of Object.entries(schemas) as [string, OpenApiSchema][]) {
    // Skip generic success/error wrappers if we handle them directly in Client
    if (name === 'ApiError' || name === 'ApiSuccess') continue;

    if (schema.enum) {
      modelsContent += `enum ${name} {\n`;
      for (const val of schema.enum) {
        modelsContent += `  ${val},\n`;
      }
      modelsContent += '}\n\n';
      continue;
    }

    modelsContent += `class ${name} {\n`;

    const props = schema.properties || {};
    const required = schema.required || [];

    // Fields
    for (const [propName, prop] of Object.entries(props)) {
      const isReq = required.includes(propName);
      const typeInfo = mapType(prop);

      modelsContent += `  final ${typeInfo.typeStr}${isReq ? '' : '?'} ${propName};\n`;
    }

    // Constructor
    modelsContent += `\n  ${name}({\n`;
    for (const [propName, prop] of Object.entries(props)) {
      const isReq = required.includes(propName);
      modelsContent += `    ${isReq ? 'required ' : ''}this.${propName},\n`;
    }
    modelsContent += '  });\n\n';

    // fromJson
    modelsContent += `  factory ${name}.fromJson(Map<String, dynamic> json) {\n`;
    modelsContent += `    return ${name}(\n`;
    for (const [propName, prop] of Object.entries(props)) {
      const isReq = required.includes(propName);
      const expr = getFromJsonExpr(propName, prop, isReq);
      modelsContent += `      ${propName}: ${expr},\n`;
    }
    modelsContent += `    );\n`;
    modelsContent += `  }\n\n`;

    // toJson
    modelsContent += `  Map<String, dynamic> toJson() {\n`;
    modelsContent += `    return {\n`;
    for (const [propName, prop] of Object.entries(props)) {
      const isReq = required.includes(propName);
      const expr = getToJsonExpr(propName, prop, isReq);
      modelsContent += `      '${propName}': ${expr},\n`;
    }
    modelsContent += `    };\n`;
    modelsContent += `  }\n`;

    modelsContent += '}\n\n';
  }

  writeFileSync(resolve(outputDir, 'api_models.dart'), modelsContent);
  console.log('✅ Generated api_models.dart');

  // 2. Generate Client
  let clientContent = `// GENERATED CODE - DO NOT MODIFY BY HAND
// Generated from OpenAPI spec using generate-client.ts

import 'dart:convert';
import 'package:flutter/foundation.dart';
import '../api_client.dart';
import 'api_models.dart';

class VoltiumApiClient {
  final ApiClient _client;

  VoltiumApiClient(this._client);

`;

  const paths = spec.paths || {};
  for (const [pathStr, pathObj] of Object.entries(paths) as [string, any][]) {
    for (const [method, operation] of Object.entries(pathObj) as [string, any][]) {
      const tags = operation.tags || [];
      // Skip admin paths not consumed by Flutter client
      if (
        tags.includes('Admin') &&
        ![
          '/api/admin/kyc',
          '/api/admin/deposits',
          '/api/admin/transactions',
          '/api/admin/riders',
          '/api/admin/reconciliation',
          '/api/admin/hubs',
        ].includes(pathStr)
      ) {
        continue;
      }

      const summary = operation.summary || '';
      const operationId =
        operation.operationId ||
        method +
          pathStr
            .replace(/\/api\//, '/')
            .replace(/\/$/, '')
            .replace(/[\/|-]([a-z])/g, (g) => g[1].toUpperCase())
            .replace(/[\/|-]/g, '')
            .replace(/[{}]/g, '');

      // Clean operation name
      let cleanName = operationId.charAt(0).toLowerCase() + operationId.slice(1);
      if (cleanName.startsWith('getApi')) {
        cleanName = 'get' + cleanName.substring(6);
      } else if (cleanName.startsWith('postApi')) {
        cleanName = 'post' + cleanName.substring(7);
      } else if (cleanName.startsWith('putApi')) {
        cleanName = 'put' + cleanName.substring(6);
      } else if (cleanName.startsWith('deleteApi')) {
        cleanName = 'delete' + cleanName.substring(9);
      }

      // Parameters
      const parameters = operation.parameters || [];
      const hasQueryParams = parameters.some((p: any) => p.in === 'query');
      const hasPathParams = parameters.some((p: any) => p.in === 'path');
      const requestBody = operation.requestBody;

      const methodArgs: string[] = [];
      let queryParamsMap = '';

      if (hasPathParams) {
        for (const p of parameters.filter((param: any) => param.in === 'path')) {
          methodArgs.push(`String ${p.name}`);
        }
      }

      if (requestBody) {
        const content = requestBody.content || {};
        const jsonSchema = content['application/json']?.schema || {};
        if (jsonSchema.$ref) {
          const bodyType = jsonSchema.$ref.split('/').pop()!;
          methodArgs.push(`${bodyType} request`);
        } else {
          methodArgs.push('Map<String, dynamic> request');
        }
      }

      if (hasQueryParams) {
        queryParamsMap = '    final queryParams = <String, String>{\n';
        for (const p of parameters.filter((param: any) => param.in === 'query')) {
          const isReq = p.required === true;
          methodArgs.push(
            `${p.schema?.type === 'integer' ? 'int' : 'String'}${isReq ? '' : '?'} ${p.name}`
          );
          queryParamsMap += `      if (${p.name} != null) '${p.name}': ${p.name}.toString(),\n`;
        }
        queryParamsMap += '    };\n';
      }

      // Determine return type
      const response200 = operation.responses?.['200'] || {};
      const responseSchema = response200.content?.['application/json']?.schema;
      let returnType = 'Map<String, dynamic>';
      let mapper = '';

      if (responseSchema) {
        if (responseSchema.$ref) {
          const refName = responseSchema.$ref.split('/').pop()!;
          returnType = refName;
          mapper = `    return ${refName}.fromJson(response);`;
        } else {
          // generic object or map
          returnType = 'Map<String, dynamic>';
          mapper = '    return response;';
        }
      } else {
        returnType = 'Map<String, dynamic>';
        mapper = '    return response;';
      }

      // Construct path URL
      let urlStr = `'${pathStr}'`;
      if (hasPathParams) {
        urlStr = `'${pathStr.replace(/\{(\w+)\}/g, '$$$1')}'`;
      }

      clientContent += `  /// ${summary}\n`;
      clientContent += `  Future<${returnType}> ${cleanName}(${methodArgs.join(', ')}) async {\n`;
      if (hasQueryParams) {
        clientContent += queryParamsMap;
      }

      const queryParamArg = hasQueryParams ? ', queryParams: queryParams' : '';
      const bodyArg = requestBody
        ? `, body: ${methodArgs.some((a) => a.startsWith('Map<String, dynamic>')) ? 'request' : 'request.toJson()'}`
        : '';

      clientContent += `    final response = await _client.${method}(${urlStr}${queryParamArg}${bodyArg});\n`;
      clientContent += mapper ? `${mapper}\n` : '    return response;\n';
      clientContent += `  }\n\n`;
    }
  }

  clientContent += '}\n';
  writeFileSync(resolve(outputDir, 'api_client.dart'), clientContent);
  console.log('✅ Generated api_client.dart');
}

run();
