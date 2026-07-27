"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
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
  Track?: string;
  "Track*"?: string;
  "Rubric Name"?: string;
  "Rubric Name*"?: string;
  Description?: string;
  "Max Score"?: number | string;
  "Max Score*"?: number | string;
  Weight?: number | string;
  "Weight*"?: number | string;
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

  const isTrackSpecific = round.isTrackSpecific;
  const tracks = event.tracks || [];

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    
    // Instructions sheet
    const wsInstructions = XLSX.utils.aoa_to_sheet([
      ["RUBRIC IMPORT INSTRUCTIONS"],
      ["--------------------------"],
      ["1. DO NOT change the column headers in the 'Template' sheet."],
      ["2. * indicates a REQUIRED field."],
      ["3. 'Max Score' and 'Weight' must be positive numbers."],
      ["4. 'Rubric Name' must be unique within the same Round (and Track)."],
      isTrackSpecific ? ["5. 'Track' must exactly match one of the tracks listed below."] : [""],
      [""],
      ["Available Tracks:"],
      ...tracks.map(t => [`- ${t.name}`])
    ]);
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions");

    // Template sheet
    const headers = isTrackSpecific
      ? ["Track*", "Rubric Name*", "Description", "Max Score*", "Weight*"]
      : ["Rubric Name*", "Description", "Max Score*", "Weight*"];

    const wsTemplate = XLSX.utils.aoa_to_sheet([headers]);
    
    // Auto-size columns slightly
    wsTemplate["!cols"] = headers.map(() => ({ wch: 20 }));
    
    XLSX.utils.book_append_sheet(wb, wsTemplate, "Template");

    // File name
    const cleanEventName = event.name.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanRoundName = round.name.replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `${cleanEventName}_${cleanRoundName}_Rubrics_Template.xlsx`);
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
      
      const name = row["Rubric Name*"]?.trim() || row["Rubric Name"]?.trim();
      const desc = row["Description"]?.trim();
      const rawMaxScore = row["Max Score*"] ?? row["Max Score"];
      const rawWeight = row["Weight*"] ?? row["Weight"];
      const trackName = row["Track*"]?.trim() || row["Track"]?.trim();

      if (!name && !rawMaxScore && !rawWeight && !trackName) {
        // Skip completely empty rows
        return;
      }

      if (!name) {
        newErrors.push({ row: rowNum, message: "Rubric Name is required." });
        return;
      }

      const maxScore = Number(rawMaxScore);
      if (isNaN(maxScore) || maxScore <= 0) {
        newErrors.push({ row: rowNum, message: "Max Score must be a positive number." });
        return;
      }

      const weight = Number(rawWeight);
      if (isNaN(weight) || weight <= 0) {
        newErrors.push({ row: rowNum, message: "Weight must be a positive number." });
        return;
      }

      let trackId: number | null = null;
      if (isTrackSpecific) {
        if (!trackName) {
          newErrors.push({ row: rowNum, message: "Track is required for this round." });
          return;
        }
        const matchedTrack = tracks.find(t => t.name.toLowerCase() === trackName.toLowerCase());
        if (!matchedTrack) {
          newErrors.push({ row: rowNum, message: `Track '${trackName}' not found in this event.` });
          return;
        }
        trackId = matchedTrack.id;
      }

      // Check collision with existing
      const collisionExists = existingRubrics.some(r => 
        r.name.toLowerCase() === name.toLowerCase() && r.trackId === trackId
      );
      if (collisionExists) {
        newErrors.push({ row: rowNum, message: `Rubric '${name}' already exists in this ${isTrackSpecific ? "track" : "round"}.` });
        return;
      }

      // Check collision within file
      const fileKey = `${name.toLowerCase()}_${trackId}`;
      if (usedNames.has(fileKey)) {
        newErrors.push({ row: rowNum, message: `Duplicate Rubric '${name}' inside the uploaded file.` });
        return;
      }
      usedNames.add(fileKey);

      validRows.push({
        name,
        description: desc || undefined,
        maxScore,
        weight,
        roundId: round.id,
        trackId,
      });
    });

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
                  Download the Excel template pre-configured for this round. Read the instructions in the first sheet carefully before filling out the data.
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
