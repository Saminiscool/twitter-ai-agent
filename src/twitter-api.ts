/**
 * Twitter API utilities for OAuth 1.0a authentication
 * Handles tweet posting and user timeline retrieval
 */

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
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams)
  ].join('&');

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate signature using Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(signingKey);
  const messageData = encoder.encode(signatureBaseString);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  
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
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_token: accessToken,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: nonce,
    oauth_version: '1.0'
  };

  // Combine OAuth params with request params for signature
  const allParams = { ...oauthParams, ...params };

  // Generate signature
  const signature = await generateOAuthSignature(method, url, allParams, consumerSecret, tokenSecret);
  oauthParams['oauth_signature' as keyof typeof oauthParams] = signature;

  // Build authorization header
  const authHeader = 'OAuth ' + Object.keys(oauthParams)
    .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key as keyof typeof oauthParams])}"`)
    .join(', ');

  return authHeader;
}

export async function postTweet(content: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const url = 'https://api.twitter.com/2/tweets';
    const method = 'POST';
    
    const authHeader = await generateOAuthHeader(method, url);
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: content })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: `Twitter API error: ${response.status} - ${errorData.detail || JSON.stringify(errorData)}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

export async function getUserTweets(userId: string = '252099921', maxResults: number = 5): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // For reading tweets, we can use Bearer Token (simpler)
    const url = `https://api.twitter.com/2/users/${userId}/tweets?max_results=${maxResults}&tweet.fields=created_at,public_metrics,text`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json();
      return {
        success: false,
        error: `Twitter API error: ${response.status} - ${errorData.detail || JSON.stringify(errorData)}`
      };
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
