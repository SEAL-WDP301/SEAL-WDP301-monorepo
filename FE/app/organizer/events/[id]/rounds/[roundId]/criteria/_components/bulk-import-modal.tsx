"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { Download, UploadCloud, AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrganizerEvent, OrganizerRound, OrganizerRubric, bulkCreateOrganizerRubrics } from "@/lib/api/organizer-events.api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { enqueueSnackbar } from "notistack";

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: OrganizerEvent;
  round: OrganizerRound;
  existingRubrics: OrganizerRubric[];
}

interface ParsedRow {
  "Track Name"?: string;
  "Track Name*"?: string;
  Track?: string;
  "Track*"?: string;
  "Rubric Name"?: string;
  "Rubric Name*"?: string;
  Description?: string;
  Share?: number | string;
  "Share*"?: number | string;
  "Max Score"?: number | string;
  "Max Score*"?: number | string;
  Weight?: number | string;
  "Weight*"?: number | string;
  "Weight %"?: number | string;
  "Weight %*"?: number | string;
  __rowNum__: number;
}

export function BulkImportRubricsModal({
  open,
  onOpenChange,
  event,
  round,
  existingRubrics,
}: BulkImportModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [errors, setErrors] = useState<{ row: number; message: string }[]>([]);
  const [validCount, setValidCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const getSampleRubricForTrack = (trackName: string) => {
    const lower = trackName.toLowerCase();
    if (lower.includes("ai") || lower.includes("ml") || lower.includes("data")) {
      return {
        name: "AI Model Architecture & Accuracy",
        desc: "Appropriate model selection, dataset quality, pipeline efficiency, and RAG/LLM implementation.",
      };
    }
    if (lower.includes("automation") || lower.includes("devops") || lower.includes("software")) {
      return {
        name: "Workflow Automation & System Reliability",
        desc: "End-to-end process automation, error handling, system throughput, and code architecture.",
      };
    }
    if (lower.includes("iot") || lower.includes("embedded") || lower.includes("hardware")) {
      return {
        name: "Hardware Integration & Sensor Performance",
        desc: "Sensor data accuracy, microcontroller communication, low latency, and energy efficiency.",
      };
    }
    if (lower.includes("web") || lower.includes("front") || lower.includes("ui") || lower.includes("ux")) {
      return {
        name: "User Interface & Experience (UI/UX)",
        desc: "Responsive design, visual aesthetics, micro-interactions, and intuitive user workflow.",
      };
    }
    if (lower.includes("security") || lower.includes("cyber")) {
      return {
        name: "Security Architecture & Threat Mitigation",
        desc: "Access control, data encryption, vulnerability resistance, and security best practices.",
      };
    }
    return {
      name: `${trackName} Technical Implementation`,
      desc: `Engineering execution, code quality, technical complexity, and domain innovation for ${trackName}.`,
    };
  };

  const handleDownloadTemplate = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = "SEAL Hackathon Platform";
    wb.lastModifiedBy = "SEAL Hackathon Platform";
    wb.created = new Date();

    const tracks = event.tracks || [];
    const trackNames = tracks.map((t) => t.name);

    // =========================================================================
    // TAB 1: INSTRUCTIONS (Detailed, Structured & Colorful)
    // =========================================================================
    const ws1 = wb.addWorksheet("Instructions", {
      properties: { tabColor: { argb: "FF2563EB" } }, // Royal Blue Tab
    });

    ws1.views = [{ showGridLines: true }];

    ws1.columns = [
      { width: 26 },
      { width: 16 },
      { width: 20 },
      { width: 75 },
    ];

    // Main Header Banner
    const titleRow = ws1.addRow(["SEAL HACKATHON — RUBRIC IMPORT INSTRUCTIONS"]);
    ws1.mergeCells("A1:D1");
    titleRow.height = 36;
    titleRow.getCell(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
    titleRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
    titleRow.getCell(1).alignment = { vertical: "middle", horizontal: "center" };

    // Subheader Context
    const ctxHeader = ws1.addRow(["EVENT & ROUND CONTEXT INFORMATION"]);
    ws1.mergeCells("A3:D3");
    ctxHeader.height = 24;
    ctxHeader.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    ctxHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
    ctxHeader.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const contextRows = [
      ["Event Name:", event.name],
      ["Season / Year:", `${event.season} ${event.year}`],
      ["Round Name:", `${round.name} (Round ${round.roundNumber})`],
      ["Round Scope:", round.isTrackSpecific ? "Track-Specific Criteria" : "General (All Tracks) Criteria"],
      [
        "Configured Event Tracks:",
        trackNames.length > 0
          ? `${trackNames.length} tracks: ${trackNames.join(", ")}`
          : "No specific tracks configured for this event",
      ],
    ];

    contextRows.forEach(([lbl, val]) => {
      const r = ws1.addRow([lbl, val]);
      r.height = 20;
      r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF334155" } };
      r.getCell(2).font = { name: "Calibri", size: 10, bold: false, color: { argb: "FF0F172A" } };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });

    ws1.addRow([]); // Blank spacer

    // Section 2: Column Specifications
    const specHeader = ws1.addRow(["COLUMN FIELD SPECIFICATIONS & GUIDELINES"]);
    ws1.mergeCells("A10:D10");
    specHeader.height = 24;
    specHeader.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    specHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF334155" } };
    specHeader.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const specTableHead = ws1.addRow(["Field Name", "Required?", "Data Type", "Description & Usage Guidelines"]);
    specTableHead.height = 24;
    specTableHead.eachCell((cell) => {
      cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF475569" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });

    const specRows = [
      [
        "Rubric Name*",
        "REQUIRED",
        "Text",
        "Unique name of the evaluation criterion (e.g. 'Technical Architecture'). Must be unique in this round.",
      ],
      [
        "Description",
        "Optional",
        "Text",
        "Detailed guidance for judges explaining what to evaluate and how scores should be awarded.",
      ],
      [
        "Weight %*",
        "REQUIRED",
        "Number (1-100)",
        "Weight percentage for this rubric (decimals e.g. 25.5 allowed). Sum of all rubrics in round must equal 100%.",
      ],
    ];

    specRows.forEach((rowValues, idx) => {
      const r = ws1.addRow(rowValues);
      r.height = 22;
      r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
      r.getCell(2).font = {
        name: "Calibri",
        size: 10,
        bold: true,
        color: { argb: rowValues[1] === "REQUIRED" ? "FFDC2626" : "FF64748B" },
      };
      r.getCell(2).alignment = { horizontal: "center" };
      r.getCell(3).font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF475569" } };
      r.getCell(3).alignment = { horizontal: "center" };
      r.getCell(4).font = { name: "Calibri", size: 10, color: { argb: "FF334155" } };

      const fillHex = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
      r.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillHex } };
        c.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } },
        };
      });
    });

    ws1.addRow([]); // Blank spacer

    // Section 3: Critical Rules Header
    const ruleHeader = ws1.addRow(["CRITICAL IMPORT RULES & WEIGHT CONSTRAINTS"]);
    ws1.mergeCells("A16:D16");
    ruleHeader.height = 24;
    ruleHeader.getCell(1).font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
    ruleHeader.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC2410C" } };
    ruleHeader.getCell(1).alignment = { vertical: "middle", horizontal: "left", indent: 1 };

    const ruleList = [
      "• Do NOT modify or rename column header names in the 'Template' sheet.",
      "• Fields ending with an asterisk (*) are mandatory.",
      "• Total combined weight of all imported and existing rubrics in this round MUST equal 100.00%.",
      "• Maximum score for each rubric is fixed at 10 points for judges.",
      "• You can inspect and edit the pre-filled sample rows in the 'Template' tab before uploading.",
    ];

    ruleList.forEach((ruleText) => {
      const r = ws1.addRow([ruleText]);
      ws1.mergeCells(`A${r.number}:D${r.number}`);
      r.height = 20;
      r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF9A3412" } };
      r.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
    });

    // =========================================================================
    // TAB 2: TEMPLATE (Headers: Rubric Name*, Description, Weight %*)
    // =========================================================================
    const ws2 = wb.addWorksheet("Template", {
      properties: { tabColor: { argb: "FFFF6B2C" } }, // SEAL Orange Tab
    });

    ws2.views = [{ showGridLines: true }];

    ws2.columns = [
      { width: 38 },
      { width: 68 },
      { width: 16 },
    ];

    // Headers: ONLY 3 columns!
    const templateHead = ws2.addRow(["Rubric Name*", "Description", "Weight %*"]);
    templateHead.height = 28;
    templateHead.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF6B2C" } };
      cell.alignment = { vertical: "middle", horizontal: colNumber === 3 ? "right" : "left" };
      cell.border = {
        top: { style: "medium", color: { argb: "FFEA580C" } },
        bottom: { style: "medium", color: { argb: "FFEA580C" } },
        left: { style: "thin", color: { argb: "FFFFFFFF" } },
        right: { style: "thin", color: { argb: "FFFFFFFF" } },
      };
    });

    const TRACK_BG_COLORS = [
      "FFF5F3FF", // Soft Violet
      "FFEFF6FF", // Soft Blue
      "FFFFFBEB", // Soft Amber
      "FFFFF1F2", // Soft Rose
      "FFECFEFF", // Soft Cyan
      "FFF0FDF4", // Soft Emerald
    ];

    if (trackNames.length > 0) {
      const totalTracks = trackNames.length;
      const totalItems = totalTracks + 1;
      const baseWeight = Math.floor(100 / totalItems);
      const remainder = 100 - baseWeight * totalItems;

      // Row 1: General Criterion Example
      const genRow = ws2.addRow([
        "Project Pitch & Presentation",
        "Clear problem statement, effective slide design, team communication, and confident Q&A handling.",
        baseWeight + remainder,
      ]);
      genRow.height = 24;
      genRow.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
      genRow.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
      genRow.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF047857" } };
      genRow.getCell(3).alignment = { horizontal: "right" };

      genRow.eachCell((c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFECFDF5" } };
        c.border = {
          top: { style: "thin", color: { argb: "FFA7F3D0" } },
          bottom: { style: "thin", color: { argb: "FFA7F3D0" } },
          left: { style: "thin", color: { argb: "FFA7F3D0" } },
          right: { style: "thin", color: { argb: "FFA7F3D0" } },
        };
      });

      // Track-based criteria examples (1 row per track)
      trackNames.forEach((trackName, idx) => {
        const sample = getSampleRubricForTrack(trackName);
        const r = ws2.addRow([
          sample.name,
          `[${trackName} Track] ${sample.desc}`,
          baseWeight,
        ]);
        r.height = 24;
        const colorHex = TRACK_BG_COLORS[idx % TRACK_BG_COLORS.length];

        r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
        r.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
        r.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
        r.getCell(3).alignment = { horizontal: "right" };

        r.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: colorHex } };
          c.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });
    } else {
      const fallbackRows = [
        ["Technical Architecture & Code Quality", "Clean project structure, framework usage, error handling, and documentation.", 40],
        ["Innovation & Problem Solving", "Originality of the solution, practical impact, and effective use of modern tech.", 30],
        ["Project Pitch & Demo Presentation", "Clear problem statement, live demonstration, and confident handling of Q&A.", 30],
      ];
      fallbackRows.forEach((rowVals, idx) => {
        const r = ws2.addRow(rowVals);
        r.height = 24;
        const fillHex = idx % 2 === 0 ? "FFFFFFFF" : "FFF8FAFC";
        r.getCell(1).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
        r.getCell(2).font = { name: "Calibri", size: 10, color: { argb: "FF475569" } };
        r.getCell(3).font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
        r.getCell(3).alignment = { horizontal: "right" };

        r.eachCell((c) => {
          c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillHex } };
          c.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
        });
      });
    }

    const cleanEventName = event.name.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanRoundName = round.name.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `${cleanEventName}_${cleanRoundName}_Rubrics_Template.xlsx`;

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        
        const sheetName = workbook.SheetNames.find(s => s === "Template") || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        const rawData = XLSX.utils.sheet_to_json<ParsedRow>(sheet, { defval: "" });
        
        validateData(rawData);
      } catch (err) {
        enqueueSnackbar("Failed to parse the Excel file.", { variant: "error" });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!selectedFile.name.endsWith(".xlsx") && !selectedFile.name.endsWith(".xls")) {
      enqueueSnackbar("Please upload a valid Excel file (.xlsx or .xls)", { variant: "error" });
      return;
    }

    setFile(selectedFile);
    processFile(selectedFile);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;

    if (!droppedFile.name.endsWith(".xlsx") && !droppedFile.name.endsWith(".xls")) {
      enqueueSnackbar("Please upload a valid Excel file (.xlsx or .xls)", { variant: "error" });
      return;
    }

    setFile(droppedFile);
    processFile(droppedFile);
  };

  const validateData = (data: ParsedRow[]) => {
    const newErrors: { row: number; message: string }[] = [];
    const validRows: any[] = [];
    
    const usedNames = new Set<string>();

    data.forEach((row, index) => {
      const rowNum = index + 2; // +1 for 0-index, +1 for header row
      
      const rawTrack =
        row["Track Name"]?.toString().trim() ||
        row["Track Name*"]?.toString().trim() ||
        row["Track"]?.toString().trim() ||
        row["Track*"]?.toString().trim();

      const name = row["Rubric Name*"]?.trim() || row["Rubric Name"]?.trim();
      const desc = row["Description"]?.trim();
      const rawWeight =
        row["Weight %*"] ??
        row["Weight %"] ??
        row["Weight*"] ??
        row["Weight"] ??
        row["Share*"] ??
        row["Share"];

      if (!name && !rawWeight) {
        // Skip completely empty rows
        return;
      }

      if (!name) {
        newErrors.push({ row: rowNum, message: "Rubric Name is required." });
        return;
      }

      let targetTrackId: number | null = null;
      if (
        rawTrack &&
        rawTrack.toLowerCase() !== "all tracks" &&
        rawTrack.toLowerCase() !== "general"
      ) {
        const foundTrack = (event.tracks || []).find(
          (t) => t.name.toLowerCase() === rawTrack.toLowerCase(),
        );
        if (foundTrack) {
          targetTrackId = foundTrack.id;
        } else if ((event.tracks || []).length > 0) {
          newErrors.push({
            row: rowNum,
            message: `Track '${rawTrack}' not found. Available tracks: ${(event.tracks || []).map((t) => t.name).join(", ")}`,
          });
          return;
        }
      }

      const weight = Number(rawWeight);
      if (isNaN(weight) || weight <= 0 || weight > 100) {
        newErrors.push({
          row: rowNum,
          message: "Weight % must be a positive number up to 100 (decimals OK).",
        });
        return;
      }

      const collisionExists = existingRubrics.some(
        (r) =>
          r.name.toLowerCase() === name.toLowerCase() &&
          r.roundId === round.id,
      );
      if (collisionExists) {
        newErrors.push({
          row: rowNum,
          message: `Rubric '${name}' already exists in this round.`,
        });
        return;
      }

      const fileKey = `${targetTrackId ?? "gen"}-${name.toLowerCase()}`;
      if (usedNames.has(fileKey)) {
        newErrors.push({ row: rowNum, message: `Duplicate Rubric '${name}' inside the uploaded file.` });
        return;
      }
      usedNames.add(fileKey);

      validRows.push({
        name,
        description: desc || undefined,
        maxScore: 10,
        weight,
        roundId: round.id,
        trackId: targetTrackId,
      });
    });

    const existingWeight = existingRubrics
      .filter((r) => r.roundId === round.id)
      .reduce((sum, r) => sum + Number(r.weight || 0), 0);
    const importWeight = validRows.reduce(
      (sum, r) => sum + Number(r.weight || 0),
      0,
    );
    const projected = existingWeight + importWeight;
    if (validRows.length > 0 && projected > 100.01) {
      const msg = `Weights exceed 100%: existing ${existingWeight.toFixed(2)}% + import ${importWeight.toFixed(2)}% = ${projected.toFixed(2)}%. Reduce weights in the file or remove existing criteria first.`;
      newErrors.push({
        row: 0,
        message: msg,
      });
      enqueueSnackbar(msg, { variant: "warning" });
    }

    setParsedData(validRows);
    setErrors(newErrors);
    setValidCount(validRows.length);
  };

  const importMutation = useMutation({
    mutationFn: () => bulkCreateOrganizerRubrics(event.id, { rubrics: parsedData }),
    onSuccess: () => {
      enqueueSnackbar(`Successfully imported ${validCount} rubrics!`, { variant: "success" });
      queryClient.invalidateQueries({ queryKey: ["organizerRubrics", String(event.id)] });
      handleReset();
      onOpenChange(false);
    },
    onError: (err: any) => {
      enqueueSnackbar(err.response?.data?.message || "Failed to import rubrics", { variant: "error" });
    }
  });

  const handleReset = () => {
    setFile(null);
    setParsedData([]);
    setErrors([]);
    setValidCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleClose = (openStatus: boolean) => {
    if (!openStatus && !importMutation.isPending) {
      handleReset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Bulk Import Rubrics</DialogTitle>
        </DialogHeader>

        <div className="mt-4 space-y-6 min-w-0">
          {!file && (
            <>
              <div className="bg-muted/30 p-4 rounded-xl border border-border text-sm min-w-0">
                <p className="font-semibold text-foreground mb-2">Step 1: Download Template</p>
                <p className="text-muted-foreground mb-4">
                  Excel template for this round&apos;s rubrics.
                </p>
                <Button onClick={handleDownloadTemplate} variant="outline" className="w-full">
                  <Download className="mr-2 h-4 w-4" /> Download Template
                </Button>
              </div>

              <div className="bg-muted/30 p-4 rounded-xl border border-border text-sm">
                <p className="font-semibold text-foreground mb-2">Step 2: Upload Filled File</p>
                <label 
                  className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                    isDragging ? "border-orange-500 bg-orange-500/10" : "border-border hover:bg-muted/50"
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                    <UploadCloud className={`w-8 h-8 mb-3 ${isDragging ? "text-orange-500" : "text-muted-foreground"}`} />
                    <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                    <p className="text-xs text-muted-foreground">.xlsx or .xls</p>
                  </div>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileChange} />
                </label>
              </div>
            </>
          )}

          {file && (
            <div className="space-y-4 min-w-0">
              <div className="flex items-center justify-between p-3 border border-border rounded-lg bg-background w-full min-w-0">
                <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 pr-4">
                  <div className="bg-blue-500/10 text-blue-500 p-2 rounded-md shrink-0">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon-sm" className="shrink-0" onClick={handleReset} disabled={importMutation.isPending}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {errors.length > 0 ? (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-600 mb-2 font-semibold text-sm">
                    <AlertCircle className="h-4 w-4" />
                    Validation Errors Found
                  </div>
                  <p className="text-xs text-red-600/80 mb-3">Please fix these errors in your Excel file and upload again.</p>
                  <ul className="text-xs text-red-600 space-y-1 max-h-40 overflow-y-auto pr-2">
                    {errors.map((err, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono bg-red-500/20 px-1 rounded">Row {err.row}</span>
                        <span>{err.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : validCount > 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-emerald-600 mb-2 font-semibold text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Ready to Import
                  </div>
                  <p className="text-sm text-emerald-600/90">
                    Successfully validated <span className="font-bold">{validCount}</span> rubric(s). No collisions or errors detected!
                  </p>
                </div>
              ) : (
                <div className="text-center text-sm text-muted-foreground py-4">
                  No data found in the file.
                </div>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <Button variant="outline" onClick={handleReset} disabled={importMutation.isPending}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => importMutation.mutate()} 
                  disabled={errors.length > 0 || validCount === 0 || importMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Import {validCount} Rubric(s)
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
