"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Eye, FileCode, FileText } from "lucide-react";
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
  compact?: boolean;
  streamlined?: boolean;
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

function getDocumentLabel(url: string, kind: ReturnType<typeof guessKind>) {
  const clean = url.split("?")[0].toLowerCase();
  if (/\.docx?$/.test(clean)) return "Word document";
  if (/\.xlsx?$/.test(clean)) return "Spreadsheet";
  if (/\.pptx?$/.test(clean)) return "Presentation";
  if (kind === "pdf") return "PDF document";
  if (kind === "image") return "Image";
  return "Document";
}

export function ProblemStatementViewer({
  fileUrl,
  title = "Problem Statement & Guidelines",
  trackName,
  roundName,
  compact = false,
  streamlined = false,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const kind = useMemo(() => guessKind(fileUrl), [fileUrl]);
  const documentLabel = useMemo(() => getDocumentLabel(fileUrl, kind), [fileUrl, kind]);
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
              title={trackName ? `View topic statement for ${trackName}` : "View topic statement"}
              className={cn(
                "inline-flex items-center gap-1.5 text-xs font-semibold text-orange-500 underline underline-offset-4 hover:text-orange-600",
                className,
              )}
            />
          }
        >
          <Eye className="h-3.5 w-3.5" />
          View Topic
        </DialogTrigger>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
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
          <div className="mt-4 flex justify-end gap-2">
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

  if (!streamlined) {
    return (
      <GlassCard
        className={cn(
          "space-y-4 rounded-[24px] border-orange-500/30 bg-orange-500/5 p-6 shadow-sm",
          className,
        )}
      >
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-orange-500/20">
              <FileText className="h-6 w-6 text-orange-500" />
            </div>
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-orange-500/40 text-[10px] font-bold uppercase tracking-wider text-orange-500"
                >
                  Official Topic
                </Badge>
                {trackName && (
                  <Badge className="border-0 bg-orange-500/15 text-orange-700 dark:text-orange-300">
                    Track: {trackName}
                  </Badge>
                )}
                {roundName && (
                  <span className="text-xs text-muted-foreground">· {roundName}</span>
                )}
              </div>
              <h3 className="text-lg font-bold text-foreground">📌 {title}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                View problem statement online or download for offline access.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger
                render={
                  <Button
                    variant="orange"
                    size="sm"
                    className="gap-2 rounded-xl font-semibold shadow-md"
                  />
                }
              >
                <Eye className="h-4 w-4" /> View Document
              </DialogTrigger>
              <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                <DialogHeader>
                  <DialogTitle className="flex flex-wrap items-center gap-2">
                    {title}
                    {trackName && (
                      <Badge
                        variant="outline"
                        className="border-orange-500/40 text-orange-600"
                      >
                        Track: {trackName}
                      </Badge>
                    )}
                  </DialogTitle>
                </DialogHeader>
                {open && renderViewer()}
                <div className="mt-4 flex justify-end gap-2">
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

            <Button variant="outline" size="sm" asChild className="gap-2 rounded-xl font-medium">
              <a href={fileUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="h-4 w-4 text-orange-500" /> Download
              </a>
            </Button>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 overflow-hidden rounded-2xl border border-border/60 bg-background p-4 md:flex-row">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fileUrl}
              alt={title}
              className="max-h-[350px] w-full rounded-xl bg-muted/20 object-contain"
            />
          ) : (
            <div className="flex w-full min-w-0 items-center gap-3.5">
              <div className="shrink-0 rounded-xl bg-orange-500/10 p-3 text-orange-500">
                <FileCode className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">{filename}</p>
                <p className="text-xs text-muted-foreground">
                  Document File ({filename.endsWith(".docx") || filename.endsWith(".doc") ? "Word Document" : "Attachment"}) · Click &quot;View Document&quot; to preview online.
                </p>
              </div>
              <Button
                variant="soft"
                size="sm"
                onClick={() => setOpen(true)}
                className="shrink-0 gap-2 rounded-xl"
              >
                <Eye className="h-4 w-4 text-orange-500" /> Quick View
              </Button>
            </div>
          )}
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard
      className={cn(
        "rounded-2xl border-orange-500/30 bg-orange-500/5 p-4 shadow-sm",
        className,
      )}
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15">
            <FileText className="h-5 w-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-foreground">{title}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">{documentLabel}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger
              render={
                <Button
                  variant="orange"
                  size="sm"
                  className="gap-2 rounded-xl font-semibold shadow-md"
                />
              }
            >
              <Eye className="h-4 w-4" /> View Document
            </DialogTrigger>
            <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{title}</DialogTitle>
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
    </GlassCard>
  );
}
