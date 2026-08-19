import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { withApiHandler } from '@/lib/api-handler';
import { success } from '@/lib/api-response';

describe('withApiHandler HTTP 304 ETag Caching', () => {
  it('returns 200 with ETag on initial GET request', async () => {
    const handler = withApiHandler(async () => {
      return success({ message: 'hello world' });
    });

    const req = new NextRequest('http://localhost:8081/api/test', {
      method: 'GET',
    });

    const res = await handler(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('etag')).toBeDefined();
    const data = await res.json();
    expect(data.data).toEqual({ message: 'hello world' });
  });

  it('returns 304 Not Modified with empty body when If-None-Match matches ETag', async () => {
    const handler = withApiHandler(async () => {
      return success({ message: 'hello world' });
    });

    // Step 1: Initial request to get ETag
    const initReq = new NextRequest('http://localhost:8081/api/test', { method: 'GET' });
    const initRes = await handler(initReq);
    const etag = initRes.headers.get('etag');
    expect(etag).toBeTruthy();

    // Step 2: Conditional request with If-None-Match
    const condReq = new NextRequest('http://localhost:8081/api/test', {
      method: 'GET',
      headers: {
        'if-none-match': etag!,
      },
    });

    const condRes = await handler(condReq);
    expect(condRes.status).toBe(304);
    expect(condRes.headers.get('etag')).toBe(etag);
  });

  it('returns 200 with fresh body when data has changed and ETag does not match', async () => {
    let count = 1;
    const handler = withApiHandler(async () => {
      return success({ count: count++ });
    });

    const req1 = new NextRequest('http://localhost:8081/api/test', { method: 'GET' });
    const res1 = await handler(req1);
    const etag1 = res1.headers.get('etag');

    const req2 = new NextRequest('http://localhost:8081/api/test', {
      method: 'GET',
      headers: {
        'if-none-match': etag1!,
      },
    });

    const res2 = await handler(req2);
    expect(res2.status).toBe(200);
    const data2 = await res2.json();
    expect(data2.data).toEqual({ count: 2 });
  });

  it('does not apply 304 caching to non-GET requests (e.g. POST)', async () => {
    const handler = withApiHandler(async () => {
      return success({ created: true });
    });

    const postReq = new NextRequest('http://localhost:8081/api/test', {
      method: 'POST',
      headers: {
        'if-none-match': 'any-etag',
      },
    });

    const postRes = await handler(postReq);
    expect(postRes.status).toBe(200);
    const data = await postRes.json();
    expect(data.data).toEqual({ created: true });
  });
});
