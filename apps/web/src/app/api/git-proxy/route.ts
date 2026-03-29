// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Git CORS Proxy
// Relays Git HTTP packets between browser and GitHub to bypass CORS
// This is a simple pass-through proxy that handles smart HTTP protocol
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"

// GitHub domains that we proxy to
const ALLOWED_HOSTS = [
  "github.com",
  "gitlab.com",
  "bitbucket.org",
]

export async function GET(request: NextRequest) {
  return handleProxyRequest(request, "GET")
}

export async function POST(request: NextRequest) {
  return handleProxyRequest(request, "POST")
}

async function handleProxyRequest(
  request: NextRequest,
  method: "GET" | "POST"
): Promise<NextResponse> {
  try {
    // The target URL is passed as a query parameter
    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json(
        { error: "Missing 'url' query parameter" },
        { status: 400 }
      )
    }

    // Parse and validate the URL
    let targetUrl: URL
    try {
      targetUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      )
    }

    // Security: Only allow proxying to known Git hosts
    if (!ALLOWED_HOSTS.some((host) => targetUrl.hostname.endsWith(host))) {
      return NextResponse.json(
        { error: "Host not allowed" },
        { status: 403 }
      )
    }

    // Forward relevant headers
    const headers: Record<string, string> = {}

    // Content-Type for POST requests
    const contentType = request.headers.get("content-type")
    if (contentType) {
      headers["Content-Type"] = contentType
    }

    // Git-specific headers
    const gitProtocol = request.headers.get("git-protocol")
    if (gitProtocol) {
      headers["Git-Protocol"] = gitProtocol
    }

    // Authorization
    const authorization = request.headers.get("authorization")
    if (authorization) {
      headers["Authorization"] = authorization
    }

    // User-Agent
    headers["User-Agent"] = "isomorphic-git/1.0"

    // Make the request to the target
    const fetchOptions: RequestInit = {
      method,
      headers,
    }

    if (method === "POST") {
      fetchOptions.body = await request.arrayBuffer()
    }

    const response = await fetch(targetUrl.toString(), fetchOptions)

    // Get response body
    const responseBody = await response.arrayBuffer()

    // Create response with CORS headers
    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    })

    // Copy relevant response headers
    const responseContentType = response.headers.get("content-type")
    if (responseContentType) {
      proxyResponse.headers.set("Content-Type", responseContentType)
    }

    const cacheControl = response.headers.get("cache-control")
    if (cacheControl) {
      proxyResponse.headers.set("Cache-Control", cacheControl)
    }

    // Git-specific response headers
    const gitProtocolResponse = response.headers.get("git-protocol")
    if (gitProtocolResponse) {
      proxyResponse.headers.set("Git-Protocol", gitProtocolResponse)
    }

    // CORS headers
    proxyResponse.headers.set("Access-Control-Allow-Origin", "*")
    proxyResponse.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, OPTIONS"
    )
    proxyResponse.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, Git-Protocol"
    )
    proxyResponse.headers.set(
      "Access-Control-Expose-Headers",
      "Content-Type, Git-Protocol"
    )

    return proxyResponse
  } catch (error) {
    console.error("Git proxy error:", error)
    return NextResponse.json(
      { error: "Proxy error" },
      { status: 500 }
    )
  }
}

// Handle CORS preflight requests
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, Git-Protocol",
      "Access-Control-Max-Age": "86400",
    },
  })
}
