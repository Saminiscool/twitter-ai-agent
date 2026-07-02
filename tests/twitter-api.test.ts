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
    expect.assertions(5);

    const fetchMock = vi.fn(async () => {
      return new Response(JSON.stringify({ success: true, tweetId: "123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
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
      body: JSON.stringify({
        account: "@example",
        text: "Hello from the agent"
      })
    });
  });

  it("does not report pending writes as posted tweets", async () => {
    expect.assertions(3);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({
            error: "x_write_unconfirmed",
            status: "pending_confirmation",
            writeActionId: "42"
          }),
          { status: 202, headers: { "Content-Type": "application/json" } }
        );
      })
    );

    const result = await postTweet("Needs confirmation");

    expect(result.success).toBe(false);
    expect(result.error).toContain("pending confirmation");
    expect(result.url).toBeUndefined();
  });
});
