/**
 * Twitter API utilities for OAuth 1.0a authentication
 * Handles tweet posting and user timeline retrieval
 */

type PostTweetResult = {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  tweetId?: string;
  url?: string;
};

type UserTweetsResponse = {
  data?: Array<{
    id?: string;
    text?: string;
    created_at?: string;
    public_metrics?: {
      like_count?: number;
      retweet_count?: number;
      reply_count?: number;
    };
  }>;
};

function tweetUrlFromId(tweetId: string): string {
  return `https://x.com/i/web/status/${tweetId}`;
}

function getXquikBaseUrl(): string {
  return process.env.XQUIK_BASE_URL || "https://xquik.com";
}

async function readJsonObject(
  response: Response
): Promise<Record<string, unknown>> {
  const data = await response.json();
  return data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : {};
}

function readStringField(
  data: Record<string, unknown>,
  field: string
): string | undefined {
  const value = data[field];
  return typeof value === "string" ? value : undefined;
}

function readNestedStringField(
  data: Record<string, unknown>,
  objectField: string,
  stringField: string
): string | undefined {
  const nested = data[objectField];
  if (!nested || typeof nested !== "object") {
    return undefined;
  }

  return readStringField(nested as Record<string, unknown>, stringField);
}

// OAuth 1.0a signature generation using Web Crypto API
async function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string
): Promise<string> {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`
    )
    .join("&");

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join("&");

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBaseString);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);

  // Convert to base64
  const signatureArray = new Uint8Array(signature);
  const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

  return signatureBase64;
}

// Generate OAuth authorization header
async function generateOAuthHeader(
  method: string,
  url: string,
  params: Record<string, string> = {}
): Promise<string> {
  const consumerKey = process.env.TWITTER_API_KEY!;
  const consumerSecret = process.env.TWITTER_API_KEY_SECRET!;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN!;
  const tokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET!;

  // Generate random nonce
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: nonce,
    oauth_version: "1.0"
  };

  // Combine OAuth params with request params for signature
  const allParams = { ...oauthParams, ...params };

  // Generate signature
  const signature = await generateOAuthSignature(
    method,
    url,
    allParams,
    consumerSecret,
    tokenSecret
  );
  oauthParams["oauth_signature" as keyof typeof oauthParams] = signature;

  // Build authorization header
  const authHeader =
    "OAuth " +
    Object.keys(oauthParams)
      .map(
        (key) =>
          `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`
      )
      .join(", ");

  return authHeader;
}

async function postTweetWithTwitter(content: string): Promise<PostTweetResult> {
  try {
    const url = "https://api.twitter.com/2/tweets";
    const method = "POST";

    const authHeader = await generateOAuthHeader(method, url);

    const response = await fetch(url, {
      method,
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: content })
    });

    if (!response.ok) {
      const errorData = await readJsonObject(response);
      return {
        success: false,
        error: `Twitter API error: ${response.status} - ${errorData.detail || JSON.stringify(errorData)}`
      };
    }

    const data = await readJsonObject(response);
    const tweetId = readNestedStringField(data, "data", "id");
    return {
      success: true,
      data,
      tweetId,
      url: tweetId ? tweetUrlFromId(tweetId) : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

async function postTweetWithXquik(content: string): Promise<PostTweetResult> {
  const apiKey = process.env.XQUIK_API_KEY;
  const account = process.env.XQUIK_ACCOUNT;

  if (!apiKey || !account) {
    return {
      success: false,
      error: "Xquik posting requires XQUIK_API_KEY and XQUIK_ACCOUNT."
    };
  }

  try {
    const response = await fetch(`${getXquikBaseUrl()}/api/v1/x/tweets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ account, text: content })
    });

    const data = await readJsonObject(response);

    if (response.status === 202) {
      return {
        success: false,
        data,
        error: `Xquik write is pending confirmation. Check write action ${readStringField(data, "writeActionId") || "status"} before retrying.`
      };
    }

    if (!response.ok) {
      return {
        success: false,
        data,
        error: `Xquik API error: ${response.status} - ${readStringField(data, "message") || JSON.stringify(data)}`
      };
    }

    const tweetId = readStringField(data, "tweetId");
    return {
      success: true,
      data,
      tweetId,
      url: tweetId ? tweetUrlFromId(tweetId) : undefined
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}

export async function postTweet(content: string): Promise<PostTweetResult> {
  if (process.env.X_POST_BACKEND === "xquik") {
    return postTweetWithXquik(content);
  }

  return postTweetWithTwitter(content);
}

export async function getUserTweets(
  userId: string = "252099921",
  maxResults: number = 5
): Promise<{ success: boolean; data?: UserTweetsResponse; error?: string }> {
  try {
    // For reading tweets, we can use Bearer Token (simpler)
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics,text`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      const errorData = await readJsonObject(response);
      return {
        success: false,
        error: `Twitter API error: ${response.status} - ${errorData.detail || JSON.stringify(errorData)}`
      };
    }

    const data = await readJsonObject(response);
    return { success: true, data: data as UserTweetsResponse };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
