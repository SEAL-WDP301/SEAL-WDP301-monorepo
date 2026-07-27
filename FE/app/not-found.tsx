"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center rounded-full bg-red-500/10 dark:bg-red-500/20">
        <div className="absolute inset-0 animate-ping rounded-full bg-red-500/20" />
        <AlertCircle className="relative h-16 w-16 text-red-500" />
      </div>
      
      <h1 className="mb-3 text-7xl font-extrabold tracking-tight lg:text-9xl text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">
        404
      </h1>
      
      <h2 className="mb-4 text-2xl font-bold md:text-3xl">
        Page Not Found
      </h2>
      
      <p className="mx-auto mb-8 max-w-md text-muted-foreground md:text-lg">
        Oops! The page you're looking for doesn't exist, has been moved, or is temporarily unavailable.
      </p>
      
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link 
          href="/" 
          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:scale-105 shadow-lg shadow-primary/25"
        >
          <Home className="h-4 w-4" />
          Back to Home
        </Link>
        <button 
          onClick={() => window.history.back()}
          className="flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-8 py-3.5 text-sm font-medium transition-all hover:bg-muted hover:scale-105"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back
        </button>
      </div>
    </div>
  );
}
