import { useState, useCallback, useRef, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { Project, Print } from "@/types";
import { ImportedFileEntry, BuildPlate, BuildPlateWithFiles } from "@/types/buildPlate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FileText, Check, AlertTriangle, Clock, Weight, Box,
  Plus, Trash2, Layers, Eye, Clipboard, File, Grid3X3, Sparkles,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SmartImporter } from "@/components/SmartImporter";
// PAYMENTS_TODO: import { useTier } from "@/context/TierContext";
// PAYMENTS_TODO: import { UpgradeModal } from "@/components/UpgradeModal";
import React from "react";

// Lazy load the 3D viewer
const STLViewer = React.lazy(() =>
  import("@/components/STLViewer").then(m => ({ default: m.STLViewer }))
);

const ACCEPTED_EXTENSIONS = [".3mf", ".stl", ".gcode", ".json"];
const PRINT_FILE_EXTENSIONS = [".3mf", ".stl", ".gcode"];

function getFileExtension(name: string) {
  return name.slice(name.lastIndexOf(".")).toLowerCase();
}

function getProjectNameFromFile(filename: string) {
  const base = filename.replace(/\.(gcode|3mf|stl)$/i, "");
  return base.split(/[\s_-]/)[0] || base;
}

// Parse gcode for metadata
function parseGcodeMetadata(text: string) {
  let time = 0;
  let grams = 0;
  let material = "";
  let color = "";

  const lines = text.split("\n").slice(0, 200); // only scan header
  for (const line of lines) {
    const l = line.toLowerCase();
    if (l.includes("estimated printing time") || l.includes("print time")) {
      const match = line.match(/(\d+)\s*h\s*(\d+)?\s*m?/i);
      if (match) time = parseInt(match[1]) + (parseInt(match[2] || "0") / 60);
    }
    if (l.includes("filament used") && l.includes("g")) {
      const match = line.match(/([\d.]+)\s*g/i);
      if (match) grams = parseFloat(match[1]);
    }
    if (l.includes("filament_type") || l.includes("material")) {
      const match = line.match(/=\s*(.+)/);
      if (match) material = match[1].trim();
    }
    if (l.includes("filament_colour") || l.includes("filament_color") || l.includes("color")) {
      const match = line.match(/=\s*(.+)/);
      if (match) color = match[1].trim();
    }
  }
  return { time: Math.round(time * 100) / 100, grams: Math.round(grams), material, color };
}

interface ImportedJsonProject {
  name: string;
  files: {
    filename: string;
    project_name: string;
    detected_at: string;
    print_time_hours: number;
    filament_grams: number;
    filament_type: string;
    filament_color: string;
  }[];
  total_print_time_hours: number;
  total_filament_grams: number;
  printed: boolean;
  paid: boolean;
  shipped: boolean;
}

export default function ImportQueue() {
  const { projects, addProject, updateProject } = useApp();
  const { toast } = useToast();
  // PAYMENTS_TODO: const { isPro } = useTier();
  const [files, setFiles] = useState<ImportedFileEntry[]>([]);
  const [buildPlates, setBuildPlates] = useState<BuildPlate[]>([]);
  const [importLog, setImportLog] = useState<string[]>([]);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [pasteText, setPasteText] = useState("");
  // PAYMENTS_TODO: const [showUpgrade, setShowUpgrade] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process uploaded files
  const processFiles = useCallback(async (fileList: FileList) => {
    const newEntries: ImportedFileEntry[] = [];
    const log: string[] = [];

    for (const file of Array.from(fileList)) {
      const ext = getFileExtension(file.name);

      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        log.push(`⚠️ Skipped "${file.name}" — unsupported type`);
        continue;
      }

      if (ext === ".json") {
        // Handle JSON import
        try {
          const text = await file.text();
          const data = JSON.parse(text);
          if (data.projects && Array.isArray(data.projects)) {
            for (const ip of data.projects as ImportedJsonProject[]) {
              for (const f of ip.files) {
                newEntries.push({
                  id: crypto.randomUUID(),
                  filename: f.filename,
                  projectName: f.project_name || ip.name,
                  printTimeHours: f.print_time_hours,
                  filamentGrams: f.filament_grams,
                  filamentType: f.filament_type,
                  filamentColor: f.filament_color,
                  detectedAt: f.detected_at || new Date().toISOString(),
                  source: "json",
                  fileType: "json",
                  quantity: 1,
                });
              }
            }
            log.push(`✅ Parsed JSON: ${data.projects.length} projects`);
          }
        } catch {
          log.push(`❌ Failed to parse "${file.name}"`);
        }
        continue;
      }

      // 3D print file
      const projectName = getProjectNameFromFile(file.name);
      const entry: ImportedFileEntry = {
        id: crypto.randomUUID(),
        filename: file.name,
        projectName,
        printTimeHours: 0,
        filamentGrams: 0,
        filamentType: "",
        filamentColor: "",
        detectedAt: new Date().toISOString(),
        source: "upload",
        fileType: ext.replace(".", "") as any,
        quantity: 1,
      };

      if (ext === ".gcode") {
        const text = await file.text();
        const meta = parseGcodeMetadata(text);
        entry.printTimeHours = meta.time;
        entry.filamentGrams = meta.grams;
        entry.filamentType = meta.material;
        entry.filamentColor = meta.color;
        log.push(`✅ Parsed "${file.name}" — ${meta.time}h, ${meta.grams}g`);
      } else if (ext === ".stl") {
        try {
          const buffer = await file.arrayBuffer();
          const { parseSTL, getSTLInfo } = await import("@/components/STLViewer");
          const geometry = await parseSTL(buffer);
          const info = getSTLInfo(geometry);
          entry.stlGeometry = geometry;
          entry.stlInfo = info;
          log.push(`✅ Parsed "${file.name}" — ${info.width}×${info.height}×${info.depth}mm, ${info.triangles} triangles`);
        } catch {
          log.push(`⚠️ Could not parse STL geometry for "${file.name}"`);
        }
      } else if (ext === ".3mf") {
        log.push(`✅ Added "${file.name}" — metadata extraction limited for .3mf in browser`);
      }

      newEntries.push(entry);
    }

    setFiles(prev => [...prev, ...newEntries]);
    setImportLog(prev => [...prev, ...log]);
  }, []);

  // Drag & drop handlers
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) processFiles(e.dataTransfer.files);
  }, [processFiles]);

  // Paste handler
  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    try {
      const data = JSON.parse(pasteText);
      if (data.projects && Array.isArray(data.projects)) {
        const newEntries: ImportedFileEntry[] = [];
        for (const ip of data.projects as ImportedJsonProject[]) {
          for (const f of ip.files) {
            newEntries.push({
              id: crypto.randomUUID(),
              filename: f.filename,
              projectName: f.project_name || ip.name,
              printTimeHours: f.print_time_hours,
              filamentGrams: f.filament_grams,
              filamentType: f.filament_type,
              filamentColor: f.filament_color,
              detectedAt: f.detected_at || new Date().toISOString(),
              source: "json",
              fileType: "json",
              quantity: 1,
            });
          }
        }
        setFiles(prev => [...prev, ...newEntries]);
        setImportLog(prev => [...prev, `✅ Pasted JSON: ${data.projects.length} projects`]);
        setPasteText("");
      }
    } catch {
      // Try as file paths
      const paths = pasteText.split("\n").map(l => l.trim()).filter(Boolean);
      const newEntries: ImportedFileEntry[] = [];
      for (const path of paths) {
        const filename = path.split("/").pop() || path;
        const ext = getFileExtension(filename);
        if (!PRINT_FILE_EXTENSIONS.includes(ext)) continue;
        newEntries.push({
          id: crypto.randomUUID(),
          filename,
          projectName: getProjectNameFromFile(filename),
          printTimeHours: 0,
          filamentGrams: 0,
          filamentType: "",
          filamentColor: "",
          detectedAt: new Date().toISOString(),
          source: "local",
          fileType: ext.replace(".", "") as any,
          quantity: 1,
        });
      }
      if (newEntries.length) {
        setFiles(prev => [...prev, ...newEntries]);
        setImportLog(prev => [...prev, `✅ Parsed ${newEntries.length} file paths`]);
        setPasteText("");
      } else {
        toast({ title: "Invalid input", description: "Could not parse as JSON or file paths", variant: "destructive" });
      }
    }
  }, [pasteText, toast]);

  // Update file entry
  const updateFile = useCallback((id: string, updates: Partial<ImportedFileEntry>) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  }, []);

  // Build plate management
  const addBuildPlate = useCallback(() => {
    const plate: BuildPlate = {
      id: crypto.randomUUID(),
      name: `Plate ${buildPlates.length + 1}`,
      printIds: [],
    };
    setBuildPlates(prev => [...prev, plate]);
  }, [buildPlates.length]);

  const assignToPlate = useCallback((fileId: string, plateId: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, buildPlateId: plateId } : f));
    setBuildPlates(prev => prev.map(plate =>
      plate.id === plateId && !plate.printIds.includes(fileId)
        ? { ...plate, printIds: [...plate.printIds, fileId] }
        : plate
    ));
  }, []);

  const removePlate = useCallback((plateId: string) => {
    setFiles(prev => prev.map(f => f.buildPlateId === plateId ? { ...f, buildPlateId: undefined } : f));
    setBuildPlates(prev => prev.filter(p => p.id !== plateId));
  }, []);

  // Group files by project
  const groupedByProject = files.reduce<Record<string, ImportedFileEntry[]>>((acc, f) => {
    (acc[f.projectName] = acc[f.projectName] || []).push(f);
    return acc;
  }, {});

  // Build plate views
  const plateViews: BuildPlateWithFiles[] = buildPlates.map(plate => {
    const plateFiles = files.filter(f => f.buildPlateId === plate.id);
    return {
      plate,
      files: plateFiles,
      totalTime: plateFiles.reduce((s, f) => s + f.printTimeHours * f.quantity, 0),
      totalGrams: plateFiles.reduce((s, f) => s + f.filamentGrams * f.quantity, 0),
    };
  });

  // Import all to projects
  const importAll = useCallback(() => {
    const log: string[] = [];
    let created = 0;
    let updated = 0;

    for (const [projectName, projectFiles] of Object.entries(groupedByProject)) {
      const existing = projects.find(p => p.name.toLowerCase() === projectName.toLowerCase());

      const prints: Print[] = projectFiles.map(f => ({
        id: crypto.randomUUID(),
        name: f.filename.replace(/\.(gcode|3mf|stl)$/i, ""),
        estimatedPrintTime: f.printTimeHours,
        materialUsed: f.filamentGrams,
        printer: "",
        status: "not-printed" as const,
        quantity: f.quantity,
        completedQuantity: 0,
        color: f.filamentColor,
        material: f.filamentType,
        pricePerPiece: 0,
      }));

      if (existing) {
        updateProject({ ...existing, prints: [...existing.prints, ...prints] });
        log.push(`📦 Updated "${projectName}" — added ${prints.length} prints`);
        updated++;
      } else {
        const project: Project = {
          id: crypto.randomUUID(),
          name: projectName,
          customerName: "",
          customerSource: "Other",
          paymentMethod: "Other",
          orderDate: new Date().toISOString().split("T")[0],
          dueDate: "",
          totalPrice: 0,
          printed: false,
          paid: false,
          sent: false,
          shippingDate: "",
          notes: `Imported ${projectFiles.length} files`,
          prints,
          kanbanStatus: "new-order",
          projectExpenses: [],
        };
        addProject(project);
        log.push(`✅ Created "${projectName}" with ${prints.length} prints`);
        created++;
      }
    }

    log.push(`\n📊 Done: ${created} created, ${updated} updated`);
    setImportLog(prev => [...prev, ...log]);
    setFiles([]);
    toast({ title: "Import complete", description: `${created} created, ${updated} updated` });
  }, [groupedByProject, projects, addProject, updateProject, toast]);

  const previewFile = files.find(f => f.id === previewFileId);
  const totalTime = files.reduce((s, f) => s + f.printTimeHours * f.quantity, 0);
  const totalGrams = files.reduce((s, f) => s + f.filamentGrams * f.quantity, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Import Queue</h1>
          <p className="text-sm text-muted-foreground">
            Drop <code className="bg-muted px-1 rounded">.stl</code>, <code className="bg-muted px-1 rounded">.3mf</code>, <code className="bg-muted px-1 rounded">.gcode</code>, or <code className="bg-muted px-1 rounded">.json</code> files
          </p>
        </div>
        {files.length > 0 && (
          <Button onClick={importAll} size="sm">
            <Check className="h-4 w-4 mr-1" />Import {Object.keys(groupedByProject).length} Projects
          </Button>
        )}
      </div>

      <Tabs defaultValue="smart">
        <TabsList>
          <TabsTrigger value="smart"><Sparkles className="h-3 w-3 mr-1" />Smart Import</TabsTrigger>
          <TabsTrigger value="upload"><Upload className="h-3 w-3 mr-1" />Upload</TabsTrigger>
          <TabsTrigger value="paste"><Clipboard className="h-3 w-3 mr-1" />Paste</TabsTrigger>
          <TabsTrigger value="plates"><Layers className="h-3 w-3 mr-1" />Build Plates</TabsTrigger>
        </TabsList>

        {/* Smart Importer (Bambu Studio .3mf / .gcode) */}
        <TabsContent value="smart">
          <SmartImporter />
        </TabsContent>

        {/* Upload tab */}
        <TabsContent value="upload">
          <Card
            className="border-2 border-dashed hover:border-primary/50 transition-colors cursor-pointer relative"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">Drag & drop 3D print files or JSON</p>
              <p className="text-xs text-muted-foreground mt-1">.stl, .3mf, .gcode, .json</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,.3mf,.gcode,.json"
                multiple
                onChange={e => e.target.files && processFiles(e.target.files)}
                className="hidden"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Paste tab */}
        <TabsContent value="paste">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Paste JSON or file paths from the watcher script</p>
              <textarea
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={`Paste JSON or file paths here...\n\nExample paths:\n/Users/.../3DPrintQueue/Robot_head.gcode\n/Users/.../3DPrintQueue/Robot_arm.stl`}
                className="w-full h-32 border rounded-lg p-3 text-xs font-mono bg-muted/30 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <Button size="sm" onClick={handlePaste} disabled={!pasteText.trim()}>
                <Clipboard className="h-4 w-4 mr-1" />Parse & Add
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Build Plates tab */}
        <TabsContent value="plates">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Group prints into build plates for efficient printing</p>
              <Button size="sm" variant="outline" onClick={addBuildPlate}>
                <Plus className="h-4 w-4 mr-1" />Add Plate
              </Button>
            </div>

            {plateViews.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  <Grid3X3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No build plates yet. Add a plate and assign files to it.
                </CardContent>
              </Card>
            )}

            {plateViews.map(pv => (
              <Card key={pv.plate.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Layers className="h-4 w-4 text-primary" />
                      <Input
                        value={pv.plate.name}
                        onChange={e => setBuildPlates(prev => prev.map(p =>
                          p.id === pv.plate.id ? { ...p, name: e.target.value } : p
                        ))}
                        className="h-7 w-32 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{pv.totalTime.toFixed(1)}h</span>
                      <span className="flex items-center gap-1"><Weight className="h-3 w-3" />{pv.totalGrams}g</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removePlate(pv.plate.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {pv.files.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2">No files assigned. Use the file list below to assign prints.</p>
                  ) : (
                    <div className="space-y-1">
                      {pv.files.map(f => (
                        <div key={f.id} className="flex items-center justify-between text-xs border rounded p-2">
                          <span className="font-medium">{f.filename}</span>
                          <span className="text-muted-foreground">{f.printTimeHours}h · {f.filamentGrams}g × {f.quantity}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary bar */}
      {files.length > 0 && (
        <div className="flex items-center gap-6 p-3 rounded-lg bg-muted/50 border text-sm">
          <span className="font-medium">{files.length} files</span>
          <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{totalTime.toFixed(1)}h total</span>
          <span className="text-muted-foreground flex items-center gap-1"><Weight className="h-3 w-3" />{totalGrams}g total</span>
          <span className="text-muted-foreground">{Object.keys(groupedByProject).length} projects</span>
        </div>
      )}

      {/* File list grouped by project */}
      {Object.entries(groupedByProject).map(([projectName, projectFiles]) => {
        const exists = projects.some(p => p.name.toLowerCase() === projectName.toLowerCase());
        const projTime = projectFiles.reduce((s, f) => s + f.printTimeHours * f.quantity, 0);
        const projGrams = projectFiles.reduce((s, f) => s + f.filamentGrams * f.quantity, 0);

        return (
          <Card key={projectName}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Box className="h-4 w-4 text-primary" />
                  <span>{projectName}</span>
                  {exists && (
                    <Badge variant="outline" className="text-[10px]">
                      <AlertTriangle className="h-3 w-3 mr-1" />Exists — will merge
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs font-normal text-muted-foreground">
                  <span>{projectFiles.length} files</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{projTime.toFixed(1)}h</span>
                  <span className="flex items-center gap-1"><Weight className="h-3 w-3" />{projGrams}g</span>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-1.5">
              {projectFiles.map(f => (
                <div key={f.id} className="flex items-center justify-between border rounded-lg p-2.5 text-xs hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <File className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{f.filename}</span>
                    <Badge variant="secondary" className="text-[10px] shrink-0">{f.fileType}</Badge>
                    {f.source === "local" && <Badge className="text-[10px] bg-primary/10 text-primary border-0 shrink-0">Local</Badge>}
                    {f.filamentColor && (
                      <span className="flex items-center gap-1 shrink-0">
                        <span className="w-2.5 h-2.5 rounded-full border" style={{ backgroundColor: f.filamentColor.startsWith("#") ? f.filamentColor : undefined }} />
                        <span className="text-muted-foreground">{f.filamentColor}</span>
                      </span>
                    )}
                    {f.stlInfo && (
                      <span className="text-muted-foreground shrink-0">
                        {f.stlInfo.width}×{f.stlInfo.height}×{f.stlInfo.depth}mm
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Input
                      type="number"
                      min={0}
                      step={0.1}
                      value={f.printTimeHours || ""}
                      onChange={e => updateFile(f.id, { printTimeHours: parseFloat(e.target.value) || 0 })}
                      className="h-6 w-16 text-[10px]"
                      placeholder="hours"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={f.filamentGrams || ""}
                      onChange={e => updateFile(f.id, { filamentGrams: parseFloat(e.target.value) || 0 })}
                      className="h-6 w-16 text-[10px]"
                      placeholder="grams"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={f.quantity}
                      onChange={e => updateFile(f.id, { quantity: parseInt(e.target.value) || 1 })}
                      className="h-6 w-12 text-[10px]"
                      placeholder="qty"
                    />
                    {/* Project override */}
                    <Select
                      value={f.projectName}
                      onValueChange={val => updateFile(f.id, { projectName: val })}
                    >
                      <SelectTrigger className="h-6 w-24 text-[10px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[...new Set([f.projectName, ...projects.map(p => p.name)])].filter(Boolean).map(name => (
                          <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Plate assignment */}
                    {buildPlates.length > 0 && (
                      <Select
                        value={f.buildPlateId || "none"}
                        onValueChange={val => val === "none"
                          ? updateFile(f.id, { buildPlateId: undefined })
                          : assignToPlate(f.id, val)
                        }
                      >
                        <SelectTrigger className="h-6 w-20 text-[10px]">
                          <SelectValue placeholder="Plate" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">No plate</SelectItem>
                          {buildPlates.map(pl => (
                            <SelectItem key={pl.id} value={pl.id} className="text-xs">{pl.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {f.stlGeometry && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="3D Preview" onClick={() => setPreviewFileId(f.id)}>
                        <Eye className="h-3 w-3" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFile(f.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}

      {/* 3D Preview modal */}
      {previewFile?.stlGeometry && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Eye className="h-4 w-4" />3D Preview — {previewFile.filename}
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPreviewFileId(null)}>Close</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <React.Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground text-sm">Loading 3D viewer...</div>}>
              <STLViewer geometry={previewFile.stlGeometry} className="w-full h-80 rounded-lg overflow-hidden border bg-muted/20" />
            </React.Suspense>
            {previewFile.stlInfo && (
              <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                <span>Dimensions: {previewFile.stlInfo.width} × {previewFile.stlInfo.height} × {previewFile.stlInfo.depth} mm</span>
                <span>Volume: ~{previewFile.stlInfo.volume} mm³</span>
                <span>Triangles: {previewFile.stlInfo.triangles.toLocaleString()}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Import log */}
      {importLog.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" />Import Log
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs space-y-0.5 max-h-48 overflow-y-auto">
              {importLog.map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </CardContent>
        </Card>
      )}
      {/* PAYMENTS_TODO: <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="stl_viewer" /> */}
    </div>
  );
}
