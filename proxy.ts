import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Next 16 file convention: proxy.ts replaces the deprecated middleware.ts.
// Clerk runs on every non-static request; route protection is opt-in per
// route group ((app) is Clerk-gated, (public) is token-gated — see PLAN.md).
// T0: pass through when Clerk keys aren't fully provisioned (clerkMiddleware
// needs the secret key as well) — remove gate at M1.
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
process.env.CLERK_SECRET_KEY
  ? clerkMiddleware()
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
