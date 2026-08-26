/**
 * L-1b — legal_publish permission enforcement tests.
 *
 * Covers the HTTP surface of the publish gate split:
 *   - legal_manage only -> 403 Forbidden
 *   - legal_publish (SUPER_ADMIN) -> 200 PUBLISHED
 *   - audit action legal.publish recorded with correct actor
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  publish: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({ logger: mocks.logger }));
vi.mock("@/lib/rbac", () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));
vi.mock("@/lib/auth", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/server/modules/legal/legal.use-cases", () => ({
  legalUseCases: { publish: mocks.publish },
}));

vi.mock("@/lib/api-response", () => ({
  success: (data: unknown, msg: string) =>
    new Response(JSON.stringify({ success: true, data, message: msg }), { status: 200 }),
  errors: {
    notFound: (msg: string) =>
      new Response(JSON.stringify({ success: false, error: msg }), { status: 404 }),
    internal: (msg: string) =>
      new Response(JSON.stringify({ success: false, error: msg }), { status: 500 }),
  },
}));

const makeRequest = () =>
  new NextRequest("http://localhost:8081/api/admin/legal/terms/publish", { method: "POST" });

const makeParams = () => Promise.resolve({ type: "terms" });

describe("L-1b: POST /api/admin/legal/[type]/publish - legal_publish gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminUnauthorized.mockReturnValue(
      new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401 })
    );
    mocks.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ success: false, error: "Forbidden" }), { status: 403 })
    );
  });

  it("returns 403 when admin has legal_manage but NOT legal_publish", async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: "ops_admin_1", role: "OPERATIONS_ADMIN" });
    mocks.hasPermission.mockReturnValue(false);

    const { POST } = await import("@/app/api/admin/legal/[type]/publish/route");
    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith(expect.anything(), "legal_publish");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("returns 200 and PUBLISHED status when admin has legal_publish", async () => {
    const actorId = "super_admin_1";
    mocks.requireAdmin.mockResolvedValue({ adminId: actorId, role: "SUPER_ADMIN" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.publish.mockResolvedValue({
      type: "terms",
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
    });

    const { POST } = await import("@/app/api/admin/legal/[type]/publish/route");
    const res = await POST(makeRequest(), { params: makeParams() });

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { status: string } };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe("PUBLISHED");
    expect(mocks.publish).toHaveBeenCalledWith("terms", actorId);
  });

  it("publish use-case is called with the correct actor ID for audit", async () => {
    const actorId = "super_admin_2";
    mocks.requireAdmin.mockResolvedValue({ adminId: actorId, role: "SUPER_ADMIN" });
    mocks.hasPermission.mockReturnValue(true);
    mocks.publish.mockResolvedValue({
      type: "terms",
      status: "PUBLISHED",
      publishedAt: new Date().toISOString(),
    });

    const { POST } = await import("@/app/api/admin/legal/[type]/publish/route");
    await POST(makeRequest(), { params: makeParams() });

    expect(mocks.publish).toHaveBeenCalledWith("terms", actorId);
  });
});
