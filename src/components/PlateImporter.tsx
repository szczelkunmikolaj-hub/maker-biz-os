import { useCallback, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Project, Print } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Layers,
  Clock,
  Weight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Upload,
} from "lucide-react";
import {
  parse3mf,
  parseGcodeFile,
  combineGcodeImports,
  ParsedImport,
  ParsedPlate,
} from "@/lib/bambuParser";
import { normalizeMaterial, normalizeColors } from "@/lib/normalize";
import { ColorPills } from "@/components/ColorPills";

type Mode = "add-new" | "merge-existing" | "replace-plate" | "append-models";

type Stage = "idle" | "reading" | "parsing" | "extracting" | "preview" | "applying" | "done";

interface Props {
  /** Project to import into. If omitted, only "create new project" is supported. */
  project?: Project;
  /** Compact dropzone style (used inside ProjectDetail). */
  compact?: boolean;
  /** Optional callback after a successful import. */
  onImported?: () => void;
}

function platesToPrints(plates: ParsedPlate[]): Print[] {
  return plates.map((plate) => {
    const material = normalizeMaterial(plate.filamentType);
    const colors = normalizeColors(plate.filamentColor, plate.filamentPalette);
    const colorLabel = colors.map((c) => c.label).join(", ");
    return {
      id: crypto.randomUUID(),
      name: plate.modelNames.length
        ? `${plate.name} — ${plate.modelNames.slice(0, 3).join(", ")}${
            plate.modelNames.length > 3 ? ` +${plate.modelNames.length - 3}` : ""
          }`
        : plate.name,
      estimatedPrintTime: plate.printTimeHours,
      materialUsed: plate.filamentGrams,
      printer: "",
      status: "not-printed" as const,
      quantity: 1,
      completedQuantity: 0,
      color: colorLabel,
      material,
      pricePerPiece: 0,
      colorPalette: plate.filamentPalette,
      thumbnail: plate.thumbnail,
      models: plate.modelNames.map((n) => ({
        id: crypto.randomUUID(),
        name: n,
        material,
        color: colorLabel,
      })),
    };
  });
}

export function PlateImporter({ project, compact = false, onImported }: Props) {
  const { addProject, updateProject, settings } = useApp();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [projectName, setProjectName] = useState("");
  const [mode, setMode] = useState<Mode>(project ? "add-new" : "add-new");
  const [replaceTarget, setReplaceTarget] = useState("");
  const [pendingGcode, setPendingGcode] = useState<File[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const allGcode = files.every((f) => f.name.toLowerCase().endsWith(".gcode"));
      if (allGcode && files.length > 1) {
        setPendingGcode(files);
        return;
      }

      const file = files[0];
      const lower = file.name.toLowerCase();
      try {
        setStage("reading");
        let result: ParsedImport;
        if (lower.endsWith(".3mf")) {
          setStage("parsing");
          result = await parse3mf(file);
          setStage("extracting");
        } else if (lower.endsWith(".gcode")) {
          setStage("extracting");
          result = await parseGcodeFile(file);
        } else {
          toast({ title: "Unsupported file", description: "Drop a .3mf or .gcode file.", variant: "destructive" });
          setStage("idle");
          return;
        }
        setParsed(result);
        setProjectName(result.projectName);
        setMode(project ? "add-new" : "add-new");
        if (project && project.prints.length > 0) setReplaceTarget(project.prints[0].id);
        setStage("preview");
      } catch (err) {
        toast({ title: "Parse failed", description: (err as Error).message, variant: "destructive" });
        setStage("idle");
      }
    },
    [toast, project],
  );

  const finishGcodeBatch = useCallback(
    async (combine: "combine" | "separate") => {
      const files = pendingGcode!;
      setPendingGcode(null);
      setStage("parsing");
      try {
        const imports = await Promise.all(files.map((f) => parseGcodeFile(f)));
        if (combine === "combine") {
          const combined = combineGcodeImports(imports, project ? `${project.name} batch` : "GCODE Batch");
          setParsed(combined);
          setProjectName(combined.projectName);
          setStage("preview");
        } else {
          if (project) {
            const newPrints = imports.flatMap((imp) => platesToPrints(imp.plates));
            updateProject({ ...project, prints: [...project.prints, ...newPrints] });
            toast({ title: "Plates added", description: `${newPrints.length} plates appended.` });
          } else {
            imports.forEach((imp) => createNewProject(imp, imp.projectName));
            toast({ title: "Imported", description: `${imports.length} projects created.` });
          }
          setStage("done");
          setTimeout(() => setStage("idle"), 1000);
          onImported?.();
        }
      } catch (err) {
        toast({ title: "Parse failed", description: (err as Error).message, variant: "destructive" });
        setStage("idle");
      }
    },
    [pendingGcode, project, updateProject, toast, onImported],
  );

  const createNewProject = useCallback(
    (data: ParsedImport, name: string) => {
      const costPerGram = settings.filamentCostPerGram || 0;
      const prints = platesToPrints(data.plates);
      const placeholderPrice = Math.round(data.totalFilamentGrams * costPerGram * 100) / 100;
      const newProject: Project = {
        id: crypto.randomUUID(),
        name,
        customerName: "",
        customerSource: "Other",
        paymentMethod: "Other",
        orderDate: new Date().toISOString().split("T")[0],
        dueDate: "",
        totalPrice: placeholderPrice,
        printed: false,
        paid: false,
        sent: false,
        shippingDate: "",
        notes: `Imported from ${data.originalFileName} · ${data.plates.length} plate${data.plates.length > 1 ? "s" : ""}`,
        prints,
        kanbanStatus: "new-order",
        projectExpenses: [],
        importSource: "bambu-studio",
        importFileType: data.source,
        originalFileName: data.originalFileName,
        coverThumbnail: data.coverThumbnail,
      };
      addProject(newProject);
    },
    [addProject, settings.filamentCostPerGram],
  );

  const applyToExisting = useCallback(() => {
    if (!parsed || !project) return;
    const incoming = platesToPrints(parsed.plates);

    let updated: Print[];
    let summary = "";
    if (mode === "add-new") {
      const baseIdx = project.prints.length;
      const renamed = incoming.map((pr, i) => ({
        ...pr,
        name: pr.name.startsWith("Plate ") ? `Plate ${baseIdx + i + 1}` : pr.name,
      }));
      updated = [...project.prints, ...renamed];
      summary = `${incoming.length} new plate${incoming.length > 1 ? "s" : ""} added`;
    } else if (mode === "merge-existing") {
      updated = [...project.prints];
      incoming.forEach((inc, i) => {
        if (i < updated.length) {
          const ex = updated[i];
          updated[i] = {
            ...ex,
            estimatedPrintTime: Math.max(ex.estimatedPrintTime, inc.estimatedPrintTime),
            materialUsed: Math.max(ex.materialUsed, inc.materialUsed),
            material: ex.material || inc.material,
            color: ex.color || inc.color,
            models: [...(ex.models || []), ...(inc.models || [])],
          };
        } else {
          updated.push(inc);
        }
      });
      summary = `${incoming.length} plate${incoming.length > 1 ? "s" : ""} merged`;
    } else if (mode === "replace-plate") {
      updated = project.prints.map((pr) =>
        pr.id === replaceTarget ? { ...incoming[0], id: pr.id, quantity: pr.quantity, completedQuantity: pr.completedQuantity, pricePerPiece: pr.pricePerPiece } : pr,
      );
      summary = `Plate replaced`;
    } else {
      const targetId = replaceTarget || project.prints[0]?.id;
      const allModels = incoming.flatMap((p) => p.models || []);
      updated = project.prints.map((pr) =>
        pr.id === targetId ? { ...pr, models: [...(pr.models || []), ...allModels] } : pr,
      );
      summary = `${allModels.length} model${allModels.length > 1 ? "s" : ""} appended`;
    }

    setStage("applying");
    updateProject({ ...project, prints: updated });
    toast({ title: "Project updated", description: summary });
    setStage("done");
    setTimeout(() => {
      setStage("idle");
      setParsed(null);
    }, 800);
    onImported?.();
  }, [parsed, project, mode, replaceTarget, updateProject, toast, onImported]);

  const confirmCreateNew = useCallback(() => {
    if (!parsed) return;
    setStage("applying");
    createNewProject(parsed, projectName.trim() || parsed.projectName);
    toast({ title: "Project created", description: `${projectName} · ${parsed.plates.length} plates` });
    setStage("done");
    setTimeout(() => {
      setStage("idle");
      setParsed(null);
    }, 800);
    onImported?.();
  }, [parsed, projectName, createNewProject, toast, onImported]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const isWorking = stage === "reading" || stage === "parsing" || stage === "extracting" || stage === "applying";
  const stageLabel: Record<Stage, string> = {
    idle: "",
    reading: "Reading file…",
    parsing: "Parsing plates…",
    extracting: "Extracting filament usage…",
    preview: "Ready",
    applying: "Applying…",
    done: "Done",
  };

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={
          "border-2 border-dashed border-primary/30 hover:border-primary/60 hover:bg-primary/5 transition-all rounded-xl cursor-pointer text-center " +
          (compact ? "p-5" : "p-10")
        }
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !isWorking && inputRef.current?.click()}
      >
        <div className={"mx-auto rounded-xl bg-primary/10 flex items-center justify-center mb-3 " + (compact ? "w-9 h-9" : "w-12 h-12")}>
          {isWorking ? (
            <Loader2 className={"text-primary animate-spin " + (compact ? "h-4 w-4" : "h-6 w-6")} />
          ) : project ? (
            <Upload className={"text-primary " + (compact ? "h-4 w-4" : "h-6 w-6")} />
          ) : (
            <Sparkles className={"text-primary " + (compact ? "h-4 w-4" : "h-6 w-6")} />
          )}
        </div>
        <h3 className={"font-semibold " + (compact ? "text-sm" : "text-base")}>
          {project ? "Add Plates / Models" : "Smart Print Project Importer"}
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Drop <code className="bg-muted px-1 rounded">.3mf</code> or{" "}
          <code className="bg-muted px-1 rounded">.gcode</code>
        </p>
        {isWorking && <p className="text-xs text-primary mt-2 font-medium">{stageLabel[stage]}</p>}
        {stage === "done" && (
          <p className="text-xs text-success mt-2 font-medium flex items-center justify-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Done
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".3mf,.gcode"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      <Dialog
        open={stage === "preview" && !!parsed}
        onOpenChange={(open) => {
          if (!open) {
            setParsed(null);
            setStage("idle");
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {project ? "Add to Project" : "Confirm Smart Import"}
            </DialogTitle>
            <DialogDescription>
              {project
                ? `Choose how to merge into "${project.name}". Existing edits are preserved.`
                : "Review detected plates before creating the project. Everything stays editable."}
            </DialogDescription>
          </DialogHeader>

          {parsed && (
            <div className="space-y-4">
              {!project && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Project name</Label>
                  <Input value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>
              )}

              {project && (
                <div className="space-y-2">
                  <Label className="text-xs">Apply mode</Label>
                  <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="add-new">Add as NEW plates</SelectItem>
                      <SelectItem value="merge-existing">Merge into EXISTING plates (by index)</SelectItem>
                      <SelectItem value="replace-plate" disabled={project.prints.length === 0}>Replace selected plate</SelectItem>
                      <SelectItem value="append-models" disabled={project.prints.length === 0}>Append models only</SelectItem>
                    </SelectContent>
                  </Select>

                  {(mode === "replace-plate" || mode === "append-models") && project.prints.length > 0 && (
                    <Select value={replaceTarget} onValueChange={setReplaceTarget}>
                      <SelectTrigger><SelectValue placeholder="Choose target plate" /></SelectTrigger>
                      <SelectContent>
                        {project.prints.map((pr) => (
                          <SelectItem key={pr.id} value={pr.id}>{pr.name || "Untitled plate"}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Plates</div>
                  <div className="text-lg font-semibold flex items-center gap-1">
                    <Layers className="h-4 w-4 text-primary" />
                    {parsed.plates.length}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Time</div>
                  <div className="text-lg font-semibold flex items-center gap-1">
                    <Clock className="h-4 w-4 text-primary" />
                    {parsed.totalTimeHours}h
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wide">Filament</div>
                  <div className="text-lg font-semibold flex items-center gap-1">
                    <Weight className="h-4 w-4 text-primary" />
                    {parsed.totalFilamentGrams}g
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {parsed.plates.map((p) => (
                  <div key={p.index} className="flex items-center justify-between rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <Layers className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium">{p.name}</span>
                      {p.modelNames.length > 0 && (
                        <span className="text-muted-foreground truncate">
                          · {p.modelNames.length} model{p.modelNames.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {p.filamentType && <Badge variant="secondary" className="text-[10px]">{p.filamentType}</Badge>}
                      <span className="text-muted-foreground">{p.printTimeHours}h</span>
                      <span className="text-muted-foreground">{p.filamentGrams}g</span>
                    </div>
                  </div>
                ))}
              </div>

              {parsed.totalTimeHours === 0 && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>Some metadata could not be detected. You can fill missing values manually after import.</span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setParsed(null); setStage("idle"); }}>Cancel</Button>
            <Button onClick={project ? applyToExisting : confirmCreateNew}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {project ? "Apply" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingGcode} onOpenChange={(open) => !open && setPendingGcode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Multiple GCODE files</DialogTitle>
            <DialogDescription>
              You dropped {pendingGcode?.length} .gcode files. How should they be imported?
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button onClick={() => finishGcodeBatch("combine")} className="justify-start h-auto py-3">
              <Layers className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Combine into one {project ? "import" : "project"}</div>
                <div className="text-xs opacity-80">Each file becomes a plate.</div>
              </div>
            </Button>
            <Button variant="outline" onClick={() => finishGcodeBatch("separate")} className="justify-start h-auto py-3">
              <Upload className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">{project ? "Append each as a plate" : "Create separate projects"}</div>
                <div className="text-xs opacity-80">{project ? "Adds each file as its own plate." : "One project per file."}</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
