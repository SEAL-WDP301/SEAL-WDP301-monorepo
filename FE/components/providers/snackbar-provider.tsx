"use client";

import { SnackbarProvider as NotistackProvider } from "notistack";

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotistackProvider
      maxSnack={4}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      className="!mt-14"
      style={{
        borderRadius: "16px",
        fontFamily: "var(--font-inter)",
        boxShadow: "0 10px 25px -5px rgba(0,0,0,0.2), 0 8px 10px -6px rgba(0,0,0,0.1)",
      }}
    >
      {children}
    </NotistackProvider>
  );
}
