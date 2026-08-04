"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, ExternalLink, Download, FileCode } from "lucide-react";
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

function guessKind(url: string): "image" | "pdf" | "office" | "other" {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.(png|jpe?g|gif|webp|bmp|svg)$/.test(clean)) return "image";
  if (/\.pdf$/.test(clean) || clean.includes("/pdf") || clean.includes("application/pdf"))
    return "pdf";
  if (/\.(docx?|xlsx?|pptx?)$/.test(clean) || clean.includes("/docx") || clean.includes("/doc"))
    return "office";
  return "other";
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

  // Extract clean filename from URL
  const filename = useMemo(() => {
    try {
      const pathname = new URL(fileUrl).pathname;
      const name = pathname.split("/").pop();
      return name ? decodeURIComponent(name) : "Problem_Statement";
    } catch {
      return "Problem_Statement";
    }
  }, [fileUrl]);

  // For office files (docx, xlsx, pptx) or non-PDFs, use Google Docs embedded viewer to prevent auto-downloads
  const embedUrl = useMemo(() => {
    if (kind === "office" || kind === "other") {
      return `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
    }
    return fileUrl;
  }, [fileUrl, kind]);

  // Viewer iframe/img ONLY rendered when modal is open to prevent background auto-download
  const renderViewer = () => (
    <div className="w-full min-h-[60vh] rounded-xl border border-border bg-background overflow-hidden flex items-center justify-center">
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
          src={embedUrl}
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
                "inline-flex items-center gap-1.5 text-xs text-orange-500 hover:text-orange-600 font-semibold underline underline-offset-4",
                className,
              )}
            />
          }
        >
          <Eye className="h-3.5 w-3.5" />
          View Topic{trackName ? ` · ${trackName}` : ""}
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
          {open && renderViewer()}
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
              </a>
            </Button>
            <Button variant="orange" size="sm" asChild className="gap-1.5">
              <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-3.5 w-3.5" /> Download File
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
              View problem statement online or download for offline access.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="orange"
                  size="sm"
                  className="rounded-xl gap-2 shadow-md font-semibold"
                />
              }
            >
              <Eye className="h-4 w-4" /> View Document
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
              {open && renderViewer()}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" size="sm" asChild className="gap-1.5">
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
                  </a>
                </Button>
                <Button variant="orange" size="sm" asChild className="gap-1.5">
                  <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                    <Download className="h-3.5 w-3.5" /> Download File
                  </a>
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" asChild className="rounded-xl gap-2 font-medium">
            <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 text-orange-500" /> Download
            </a>
          </Button>
        </div>
      </div>

      {/* Inline Preview / Info Strip (No background iframe auto-load!) */}
      <div className="rounded-2xl border border-border/60 overflow-hidden bg-background p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        {kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={title}
            className="max-h-[350px] w-full object-contain rounded-xl bg-muted/20"
          />
        ) : (
          <div className="flex items-center gap-3.5 w-full min-w-0">
            <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl shrink-0">
              <FileCode className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground truncate">{filename}</p>
              <p className="text-xs text-muted-foreground">
                Document File ({filename.endsWith(".docx") || filename.endsWith(".doc") ? "Word Document" : "Attachment"}) · Click &quot;View Document&quot; to preview online.
              </p>
            </div>
            <Button
              variant="soft"
              size="sm"
              onClick={() => setOpen(true)}
              className="gap-2 shrink-0 rounded-xl"
            >
              <Eye className="h-4 w-4 text-orange-500" /> Quick View
            </Button>
          </div>
        )}
      </div>
    </GlassCard>
  );
}
