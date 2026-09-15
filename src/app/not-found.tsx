import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-4xl font-semibold tracking-tight">404</p>
      <p className="text-fg-muted">That page does not exist.</p>
      <Link href="/" className="text-accent hover:underline">
        Back to Capture
      </Link>
    </main>
  );
}
