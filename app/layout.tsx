import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Montserrat, Crimson_Text } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

const crimsonText = Crimson_Text({
  variable: "--font-crimson",
  weight: ["400", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StayOps",
  description: "Chat-first property operations for short-term rentals",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const inner = (
    <html
      lang="en"
      className={`${montserrat.variable} ${crimsonText.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );

  // T0: Clerk is optional until the Clerk app is provisioned and keys land in
  // .env.local — remove this gate at milestone M1 (owner surface live).
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return inner;

  return <ClerkProvider>{inner}</ClerkProvider>;
}
