import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Settle</h1>
      <p className="text-muted-foreground">
        Web app starting point — replace this page with your landing page.
      </p>
    </main>
  );
}
