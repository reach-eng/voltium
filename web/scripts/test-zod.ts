import { zodToJsonSchema } from 'zod-to-json-schema';
import * as validators from '../src/lib/validators';

const schemas: Record<string, any> = {};

for (const [key, schema] of Object.entries(validators)) {
  if (key.endsWith('Schema')) {
    const name = key.replace('Schema', 'Request');
    const capitalizedName = name.charAt(0).toUpperCase() + name.slice(1);
    const jsonSchema = zodToJsonSchema(schema as any, {
      target: 'openApi3',
      name: capitalizedName,
    });
    schemas[capitalizedName] =
      (jsonSchema as any).components?.schemas?.[capitalizedName] || jsonSchema;
  }
}

const firstKey = Object.keys(schemas)[0];
console.log(JSON.stringify({ [firstKey]: schemas[firstKey] }, null, 2));
