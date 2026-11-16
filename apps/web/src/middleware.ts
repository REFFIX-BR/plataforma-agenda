import { NextResponse, type NextRequest } from "next/server"

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type, authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  }
}

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/api")) return NextResponse.next()
  if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: cors() })
  const response = NextResponse.next()
  for (const [key, value] of Object.entries(cors())) response.headers.set(key, value)
  return response
}

export const config = { matcher: "/api/:path*" }
