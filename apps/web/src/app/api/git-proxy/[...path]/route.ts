// ═══════════════════════════════════════════════════════════════════════════
// iTECify — Git CORS Proxy
// Relays Git HTTP packets between browser and GitHub to bypass CORS.
// isomorphic-git constructs URLs as: /api/git-proxy/{targetUrl}
// so this is a catch-all route that reconstructs the target URL from the path.
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server"

// Hosts we allow proxying to
const ALLOWED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, "GET", await params)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return handleProxyRequest(request, "POST", await params)
}

async function handleProxyRequest(
  request: NextRequest,
  method: "GET" | "POST",
  { path }: { path: string[] }
): Promise<NextResponse> {
  try {
    // isomorphic-git strips the protocol and sends:
    //   /api/git-proxy/github.com/user/repo.git/info/refs?service=git-upload-pack
    // path segments: ["github.com", "user", "repo.git", "info", "refs"]
    // We reconstruct by adding https:// back.
    const targetUrlString = "https://" + path.join("/")

    // Preserve query string (e.g. ?service=git-upload-pack)
    const search = request.nextUrl.search
    const fullUrl = targetUrlString + search

    let targetUrl: URL
    try {
      targetUrl = new URL(fullUrl)
    } catch {
      return NextResponse.json(
        { error: "Invalid target URL" },
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

    const contentType = request.headers.get("content-type")
    if (contentType) headers["Content-Type"] = contentType

    const gitProtocol = request.headers.get("git-protocol")
    if (gitProtocol) headers["Git-Protocol"] = gitProtocol

    const authorization = request.headers.get("authorization")
    if (authorization) headers["Authorization"] = authorization

    headers["User-Agent"] = "isomorphic-git/1.0"

    const fetchOptions: RequestInit = { method, headers }
    if (method === "POST") {
      fetchOptions.body = await request.arrayBuffer()
    }

    const response = await fetch(targetUrl.toString(), fetchOptions)
    const responseBody = await response.arrayBuffer()

    const proxyResponse = new NextResponse(responseBody, {
      status: response.status,
      statusText: response.statusText,
    })

    // Copy relevant response headers
    const responseContentType = response.headers.get("content-type")
    if (responseContentType) proxyResponse.headers.set("Content-Type", responseContentType)

    const cacheControl = response.headers.get("cache-control")
    if (cacheControl) proxyResponse.headers.set("Cache-Control", cacheControl)

    const gitProtocolResponse = response.headers.get("git-protocol")
    if (gitProtocolResponse) proxyResponse.headers.set("Git-Protocol", gitProtocolResponse)

    // CORS headers
    proxyResponse.headers.set("Access-Control-Allow-Origin", "*")
    proxyResponse.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    proxyResponse.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Git-Protocol")
    proxyResponse.headers.set("Access-Control-Expose-Headers", "Content-Type, Git-Protocol")

    return proxyResponse
  } catch (error) {
    console.error("Git proxy error:", error)
    return NextResponse.json({ error: "Proxy error" }, { status: 500 })
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
