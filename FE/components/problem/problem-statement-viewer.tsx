"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ui/glass-card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  fileUrl: string;
  title?: string;
  trackName?: string | null;
  roundName?: string | null;
  /** Compact link+dialog for judge header */
  compact?: boolean;
  className?: string;
};

function guessKind(url: string): "pdf" | "image" | "other" {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean)) return "image";
  if (/\.pdf$/.test(clean) || clean.includes("/pdf") || clean.includes("application/pdf"))
    return "pdf";
  // Many storage URLs omit extension — prefer PDF iframe (works for most topic uploads)
  return "pdf";
}

export function ProblemStatementViewer({
  fileUrl,
  title = "Problem Statement & Guidelines",
  trackName,
  roundName,
  compact = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const kind = useMemo(() => guessKind(fileUrl), [fileUrl]);

  const viewer = (
    <div className="w-full min-h-[60vh] rounded-xl border border-border bg-background overflow-hidden">
      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={fileUrl}
          alt={title}
          className="max-h-[75vh] w-full object-contain bg-muted/30"
        />
      ) : (
        <iframe
          title={title}
          src={fileUrl}
          className="h-[75vh] w-full border-0"
        />
      )}
    </div>
  );

  if (compact) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 text-xs text-orange-500 hover:text-orange-600 font-semibold underline underline-offset-4",
                className,
              )}
            />
          }
        >
          <Eye className="h-3.5 w-3.5" />
          Xem đề{trackName ? ` · ${trackName}` : ""}
        </DialogTrigger>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              {title}
              {trackName && (
                <Badge variant="outline" className="border-orange-500/40 text-orange-600">
                  Track: {trackName}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {viewer}
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Mở tab mới
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <GlassCard
      className={cn(
        "p-6 rounded-[24px] border-orange-500/30 bg-orange-500/5 shadow-sm space-y-4",
        className,
      )}
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-2xl bg-orange-500/20 flex items-center justify-center shrink-0">
            <FileText className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <Badge
                variant="outline"
                className="border-orange-500/40 text-orange-500 text-[10px] uppercase tracking-wider font-bold"
              >
                Official Topic
              </Badge>
              {trackName && (
                <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-0">
                  Track: {trackName}
                </Badge>
              )}
              {roundName && (
                <span className="text-xs text-muted-foreground">· {roundName}</span>
              )}
            </div>
            <h3 className="font-bold text-lg text-foreground">📌 {title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Xem đề ngay trên trang — không cần tải về trước.
            </p>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                variant="orange"
                size="sm"
                className="rounded-xl gap-2 shrink-0 shadow-md"
              />
            }
          >
            <Eye className="h-4 w-4" /> Xem đề
          </DialogTrigger>
          <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                {title}
                {trackName && (
                  <Badge variant="outline" className="border-orange-500/40 text-orange-600">
                    Track: {trackName}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {viewer}
            <div className="flex justify-end">
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" /> Mở tab mới
                </a>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inline preview strip so đề is visible without clicking */}
      <div className="rounded-xl border border-border/60 overflow-hidden bg-background">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={title}
            className="max-h-[420px] w-full object-contain bg-muted/20"
          />
        ) : (
          <iframe
            title={`${title} preview`}
            src={fileUrl}
            className="h-[420px] w-full border-0"
          />
        )}
      </div>
    </GlassCard>
  );
}
