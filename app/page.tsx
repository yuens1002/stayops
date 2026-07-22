import { SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  // T0: header renders only when Clerk is fully configured — auth() needs the
  // secret key, so a publishable-only environment must not call it.
  const clerkEnabled =
    !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
    !!process.env.CLERK_SECRET_KEY;
  const { userId } = clerkEnabled ? await auth() : { userId: null };

  return (
    <div className="flex flex-1 flex-col">
      {clerkEnabled && (
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          {userId ? (
            <UserButton />
          ) : (
            <SignInButton mode="modal">
              <button className="rounded-md border px-3 py-1.5 text-sm">
                Sign in
              </button>
            </SignInButton>
          )}
        </header>
      )}
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">StayOps</h1>
          <p className="text-muted-foreground">
            Chat-first property operations — T0 scaffold
          </p>
        </div>
      </main>
    </div>
  );
}
