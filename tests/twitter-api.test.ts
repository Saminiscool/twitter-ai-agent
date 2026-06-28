import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { postTweet } from "../src/twitter-api";

describe("postTweet Xquik backend", () => {
  beforeEach(() => {
    vi.stubEnv("X_POST_BACKEND", "xquik");
    vi.stubEnv("XQUIK_API_KEY", "xq_test");
    vi.stubEnv("XQUIK_ACCOUNT", "@example");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts through the Xquik endpoint when configured", async () => {
    expect.assertions(6);

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          success: true,
          result: { id: "123", type: "tweet" }
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" }
        }
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await postTweet("Hello from the agent");
    const [url, request] = fetchMock.mock.calls[0]!;

    expect(result.success).toBe(true);
    expect(result.tweetId).toBe("123");
    expect(result.url).toBe("https://x.com/i/web/status/123");
    expect(url).toBe("https://xquik.com/api/v1/x/tweets");
    expect(request).toMatchObject({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "xq_test"
      },
      body: JSON.stringify({
        account: "@example",
        text: "Hello from the agent"
      })
    });
    expect(request?.headers).not.toHaveProperty("Authorization");
  });

  it("does not report pending writes as posted tweets", async () => {
    expect.assertions(6);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            status: "accepted",
            writeActionId: "42",
            statusUrl: "/api/v1/x/write-actions/42"
          }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const result = await postTweet("Needs confirmation");

    expect(result.success).toBe(false);
    expect(result.pending).toBe(true);
    expect(result.statusUrl).toBe("/api/v1/x/write-actions/42");
    expect(result.error).toContain("asynchronous completion");
    expect(result.error).toContain("/api/v1/x/write-actions/42");
    expect(result.url).toBeUndefined();
  });

  it("normalizes a custom base URL", async () => {
    expect.assertions(1);
    vi.stubEnv("XQUIK_BASE_URL", "https://example.test/");
    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true, tweetId: "123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await postTweet("Hello from the agent");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.test/api/v1/x/tweets",
      expect.any(Object)
    );
  });

  it("rejects an unknown backend without sending a request", async () => {
    expect.assertions(2);
    vi.stubEnv("X_POST_BACKEND", "typo");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await postTweet("Do not send this");

    expect(result.error).toContain("Unsupported X_POST_BACKEND");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
