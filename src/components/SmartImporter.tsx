import { useCallback, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Project, Print } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Layers,
  Clock,
  Weight,
  Loader2,
  Box,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import {
  parse3mf,
  parseGcodeFile,
  combineGcodeImports,
  ParsedImport,
} from "@/lib/bambuParser";

type Stage =
  | "idle"
  | "reading"
  | "parsing"
  | "extracting"
  | "creating"
  | "preview"
  | "done";

const STAGE_LABEL: Record<Stage, string> = {
  idle: "",
  reading: "Reading file…",
  parsing: "Parsing plates…",
  extracting: "Extracting filament usage…",
  creating: "Creating project…",
  preview: "Ready",
  done: "Done",
};

export function SmartImporter() {
  const { addProject, settings } = useApp();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("idle");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [projectName, setProjectName] = useState("");
  const [pendingGcode, setPendingGcode] = useState<File[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Multiple .gcode files → ask combine vs separate
    const allGcode = files.every((f) => f.name.toLowerCase().endsWith(".gcode"));
    if (allGcode && files.length > 1) {
      setPendingGcode(files);
      return;
    }

    // Single file flow
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
        toast({
          title: "Unsupported file",
          description: "Drop a .3mf or .gcode file.",
          variant: "destructive",
        });
        setStage("idle");
        return;
      }
      setParsed(result);
      setProjectName(result.projectName);
      setStage("preview");
    } catch (err) {
      toast({
        title: "Parse failed",
        description: (err as Error).message,
        variant: "destructive",
      });
      setStage("idle");
    }
  }, [toast]);

  const finishGcodeBatch = useCallback(
    async (mode: "combine" | "separate") => {
      const files = pendingGcode!;
      setPendingGcode(null);
      setStage("parsing");
      try {
        const imports = await Promise.all(files.map((f) => parseGcodeFile(f)));
        if (mode === "combine") {
          const combined = combineGcodeImports(imports, "GCODE Batch");
          setParsed(combined);
          setProjectName(combined.projectName);
          setStage("preview");
        } else {
          // Create one project per file directly
          imports.forEach((imp) => createProjectFromParsed(imp, imp.projectName));
          toast({
            title: "Imported",
            description: `${imports.length} project${imports.length > 1 ? "s" : ""} created.`,
          });
          setStage("done");
          setTimeout(() => setStage("idle"), 1200);
        }
      } catch (err) {
        toast({
          title: "Parse failed",
          description: (err as Error).message,
          variant: "destructive",
        });
        setStage("idle");
      }
    },
    [pendingGcode]
  );

  const createProjectFromParsed = useCallback(
    (data: ParsedImport, name: string) => {
      const costPerGram = settings.filamentCostPerGram || 0;
      const prints: Print[] = data.plates.map((plate) => ({
        id: crypto.randomUUID(),
        name: plate.modelNames.length
          ? `${plate.name} — ${plate.modelNames.slice(0, 3).join(", ")}${
              plate.modelNames.length > 3 ? ` +${plate.modelNames.length - 3}` : ""
            }`
          : plate.name,
        estimatedPrintTime: plate.printTimeHours,
        materialUsed: plate.filamentGrams,
        printer: "",
        status: "not-printed",
        quantity: 1,
        completedQuantity: 0,
        color: plate.filamentColor,
        material: plate.filamentType,
        pricePerPiece: 0,
      }));

      const placeholderPrice =
        Math.round(data.totalFilamentGrams * costPerGram * 100) / 100;

      const project: Project = {
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
        notes: `Imported from ${data.originalFileName} · ${data.plates.length} plate${
          data.plates.length > 1 ? "s" : ""
        }`,
        prints,
        kanbanStatus: "new-order",
        projectExpenses: [],
        importSource: "bambu-studio",
        importFileType: data.source,
        originalFileName: data.originalFileName,
      };
      addProject(project);
    },
    [addProject, settings.filamentCostPerGram]
  );

  const confirmImport = useCallback(() => {
    if (!parsed) return;
    setStage("creating");
    createProjectFromParsed(parsed, projectName.trim() || parsed.projectName);
    toast({
      title: "Project created",
      description: `${projectName} · ${parsed.plates.length} plate${
        parsed.plates.length > 1 ? "s" : ""
      }`,
    });
    setStage("done");
    setTimeout(() => {
      setStage("idle");
      setParsed(null);
      setProjectName("");
    }, 1000);
  }, [parsed, projectName, createProjectFromParsed, toast]);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const isWorking =
    stage === "reading" || stage === "parsing" || stage === "extracting" || stage === "creating";

  return (
    <>
      <Card
        className="border-2 border-dashed border-primary/30 hover:border-primary/60 transition-colors cursor-pointer relative overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
        onClick={() => !isWorking && inputRef.current?.click()}
      >
        <CardContent className="p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            {isWorking ? (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
          </div>
          <h3 className="text-base font-semibold">Smart Print Project Importer</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Drop a Bambu Studio project (<code className="bg-muted px-1 rounded">.3mf</code>) or{" "}
            <code className="bg-muted px-1 rounded">.gcode</code> file
          </p>
          {isWorking && (
            <p className="text-xs text-primary mt-3 font-medium">{STAGE_LABEL[stage]}</p>
          )}
          {stage === "done" && (
            <p className="text-xs text-success mt-3 font-medium flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Project created
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
        </CardContent>
      </Card>

      {/* Preview dialog */}
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
              Confirm Smart Import
            </DialogTitle>
            <DialogDescription>
              Review detected plates before creating the project. Everything stays editable.
            </DialogDescription>
          </DialogHeader>

          {parsed && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Project name</label>
                <Input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Project name"
                />
              </div>

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

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {parsed.plates.map((p) => (
                  <div
                    key={p.index}
                    className="flex items-center justify-between rounded-lg border p-2.5 text-xs"
                  >
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
                      {p.filamentType && (
                        <Badge variant="secondary" className="text-[10px]">
                          {p.filamentType}
                        </Badge>
                      )}
                      {p.filamentColor && (
                        <span
                          className="w-3 h-3 rounded-full border"
                          style={{
                            backgroundColor: p.filamentColor.startsWith("#")
                              ? p.filamentColor
                              : undefined,
                          }}
                          title={p.filamentColor}
                        />
                      )}
                      <span className="text-muted-foreground">{p.printTimeHours}h</span>
                      <span className="text-muted-foreground">{p.filamentGrams}g</span>
                    </div>
                  </div>
                ))}
              </div>

              {parsed.totalTimeHours === 0 && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Some metadata could not be detected. The project will be created and you can
                    fill in the missing values manually.
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <Box className="h-3 w-3" />
                Source: {parsed.source.toUpperCase()} · {parsed.originalFileName}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setParsed(null);
                setStage("idle");
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmImport}>
              <CheckCircle2 className="h-4 w-4 mr-1" /> Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-gcode mode dialog */}
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
                <div className="font-medium">Combine into one project</div>
                <div className="text-xs opacity-80">Each file becomes a plate.</div>
              </div>
            </Button>
            <Button
              variant="outline"
              onClick={() => finishGcodeBatch("separate")}
              className="justify-start h-auto py-3"
            >
              <Box className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Create separate projects</div>
                <div className="text-xs opacity-80">One project per file.</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
