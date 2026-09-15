import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// The client reads the Firebase session for a token; stub it so these tests
// need neither the SDK nor a signed-in user.
const getIdToken = vi.fn();
vi.mock("@/lib/firebase", () => ({
  firebaseAuth: () => ({ currentUser: { getIdToken } }),
}));

import { ApiError, api, buildQuery, unwrap } from "../client";

describe("buildQuery", () => {
  it("omits empty values and repeats array keys", () => {
    expect(
      buildQuery({
        page: 2,
        q: "",
        projectId: undefined,
        organizationId: null,
        status: ["next", "waiting"],
        openOnly: true,
      }),
    ).toBe("?page=2&status=next&status=waiting&openOnly=true");
  });

  it("returns an empty string with nothing to send", () => {
    expect(buildQuery()).toBe("");
    expect(buildQuery({ q: undefined })).toBe("");
  });
});

describe("unwrap", () => {
  it("returns data from a successful envelope", () => {
    expect(
      unwrap(200, { success: true, data: { id: "x" }, error: null }),
    ).toEqual({ id: "x" });
  });

  it("throws ApiError carrying the API's code and message", () => {
    expect(() =>
      unwrap(404, {
        success: false,
        data: null,
        error: { code: "NOT_FOUND", message: "Record not found" },
      }),
    ).toThrowError(
      expect.objectContaining({
        status: 404,
        code: "NOT_FOUND",
        message: "Record not found",
      }),
    );
  });

  it("falls back to a generic code when the body is not an envelope", () => {
    try {
      unwrap(502, null);
      throw new Error("did not throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("INTERNAL_SERVER_ERROR");
    }
  });
});

describe("api", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    getIdToken.mockReset();
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  const ok = (data: unknown) =>
    new Response(JSON.stringify({ success: true, data, error: null }), {
      status: 200,
    });

  it("sends the bearer token and JSON body", async () => {
    getIdToken.mockResolvedValue("tok");
    fetchMock.mockResolvedValue(ok({ id: "1" }));

    await api("/tasks", { method: "POST", body: { title: "x" } });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/tasks$/);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
    expect(init.body).toBe(JSON.stringify({ title: "x" }));
  });

  it("retries once with a refreshed token on 401", async () => {
    getIdToken.mockResolvedValueOnce("stale").mockResolvedValueOnce("fresh");
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: { code: "UNAUTHORIZED", message: "no" },
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(ok({ id: "me" }));

    await expect(api("/users/me")).resolves.toEqual({ id: "me" });
    expect(getIdToken).toHaveBeenNthCalledWith(1, false);
    expect(getIdToken).toHaveBeenNthCalledWith(2, true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects non-JSON responses with a BAD_RESPONSE error", async () => {
    getIdToken.mockResolvedValue("tok");
    fetchMock.mockResolvedValue(new Response("<html>", { status: 502 }));
    await expect(api("/x")).rejects.toMatchObject({
      code: "BAD_RESPONSE",
      status: 502,
    });
  });
});
