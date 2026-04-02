import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

/**
 * Using the 'proxy' convention as required by your terminal/framework.
 * Ensures session refreshing and route protection.
 */
export async function proxy(request: NextRequest) {
  // 1. Initialize the response
  let supabaseResponse = NextResponse.next({
    request,
  });

  // 2. Create the Supabase client specifically for the proxy/middleware context
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies so getUser() sees the refreshed session immediately
          cookiesToSet.forEach(({ name, value, options }) => 
            request.cookies.set({ name, value, ...options })
          );
          
          // Re-initialize the response to ensure headers are propagated correctly
          supabaseResponse = NextResponse.next({
            request,
          });
          
          // Update response cookies so the browser saves the new session
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. IMPORTANT: Refresh session if expired and get the user object
  // Always use getUser() in proxy/middleware for security
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Define route protections
  const isPrivateRoute =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/event-bookings") ||
    pathname.startsWith("/events") ||
    pathname.startsWith("/settings");

  const isLoginPage = pathname === "/login";

  // 4. Handle Redirects
  if (isPrivateRoute && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Important: Use the loginUrl clone to preserve query params if needed
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage && user) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  // 5. Return the response (carrying any refreshed cookies)
  return supabaseResponse;
}

// Ensure the matcher covers all relevant paths
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/event-bookings/:path*",
    "/events/:path*",
    "/settings/:path*",
    "/login",
  ],
};
