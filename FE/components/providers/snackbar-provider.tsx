"use client";

import { SnackbarProvider as NotistackProvider } from "notistack";

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  return (
    <NotistackProvider 
      maxSnack={3} 
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      style={{ 
        backgroundColor: "var(--foreground)", 
        color: "var(--background)", 
        border: "1px solid var(--border)",
        borderRadius: "12px",
        fontFamily: "var(--font-inter)",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {children}
    </NotistackProvider>
  );
}
