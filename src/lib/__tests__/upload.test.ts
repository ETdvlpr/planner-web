import { describe, expect, it, vi, beforeEach } from "vitest";

const create = vi.fn();
const confirm = vi.fn();
vi.mock("@/lib/api", () => ({
  attachments: {
    create: (...a: unknown[]) => create(...a),
    confirm: (...a: unknown[]) => confirm(...a),
  },
}));

import { kindFor, uploadAttachment } from "../upload";

describe("kindFor", () => {
  it("treats a nameless or generically named image as a screenshot", () => {
    expect(kindFor(new File([""], "", { type: "image/png" }))).toBe(
      "screenshot",
    );
    expect(kindFor(new File([""], "image.png", { type: "image/png" }))).toBe(
      "screenshot",
    );
    expect(kindFor(new File([""], "holiday.jpg", { type: "image/jpeg" }))).toBe(
      "image",
    );
    expect(
      kindFor(new File([""], "spec.pdf", { type: "application/pdf" })),
    ).toBe("file");
  });
});

describe("uploadAttachment", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    create.mockReset();
    confirm.mockReset();
    fetchMock.mockReset();
  });

  it("creates the row, PUTs the bytes without Content-Length, then confirms", async () => {
    create.mockResolvedValue({
      attachment: { id: "att" },
      upload: {
        objectKey: "u/x/y.png",
        uploadUrl: "https://r2/put",
        expiresIn: 900,
        headers: { "Content-Type": "image/png", "Content-Length": "3" },
      },
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    confirm.mockResolvedValue({ id: "att", objectKey: "u/x/y.png" });

    const file = new File(["abc"], "", { type: "image/png" });
    const result = await uploadAttachment(file, { meetingId: "m1" });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "screenshot",
        mimeType: "image/png",
        sizeBytes: 3,
        meetingId: "m1",
      }),
    );
    expect(create.mock.calls[0][0].fileName).toMatch(/^screenshot-.*\.png$/);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://r2/put");
    expect(init.method).toBe("PUT");
    expect(init.headers).toEqual({ "Content-Type": "image/png" });
    expect(confirm).toHaveBeenCalledWith("att", "u/x/y.png");
    expect(result.objectKey).toBe("u/x/y.png");
  });

  it("does not confirm when storage rejects the PUT", async () => {
    create.mockResolvedValue({
      attachment: { id: "att" },
      upload: {
        objectKey: "k",
        uploadUrl: "https://r2/put",
        expiresIn: 1,
        headers: {},
      },
    });
    fetchMock.mockResolvedValue(new Response(null, { status: 403 }));

    await expect(
      uploadAttachment(new File(["x"], "a.txt"), {}),
    ).rejects.toThrow(/403/);
    expect(confirm).not.toHaveBeenCalled();
  });
});
