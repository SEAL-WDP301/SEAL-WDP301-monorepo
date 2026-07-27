import { ThemeToggle } from "@/components/layout/dashboard/theme-toggle";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300 dark:bg-[#0b0604]">
      <div className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,112,34,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,112,34,0.1)_1px,transparent_1px)] bg-[size:128px_128px] dark:bg-[linear-gradient(rgba(255,112,34,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,112,34,0.07)_1px,transparent_1px)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,112,34,0.14),transparent_36%),radial-gradient(circle_at_50%_60%,rgba(255,112,34,0.06),transparent_42%)] dark:bg-[radial-gradient(circle_at_50%_0%,rgba(255,112,34,0.18),transparent_36%),radial-gradient(circle_at_50%_60%,rgba(255,112,34,0.09),transparent_42%)]" />
        <div className="absolute right-5 top-5 z-20 sm:right-8 sm:top-8">
          <ThemeToggle />
        </div>
        <div className="relative z-10 w-full">{children}</div>
      </div>
    </main>
  );
}
