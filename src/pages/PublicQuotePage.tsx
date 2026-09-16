import { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Calculator, Upload, Weight, Clock, TrendingUp, Package, CheckCircle, Loader2, X, DollarSign } from "lucide-react";

// ── Material density lookup (g/cm³) ───────────────────────────────────────────
const MATERIALS = [
  { value: "PLA",   label: "PLA",   density: 1.24 },
  { value: "PETG",  label: "PETG",  density: 1.27 },
  { value: "ABS",   label: "ABS",   density: 1.04 },
  { value: "ASA",   label: "ASA",   density: 1.07 },
  { value: "TPU",   label: "TPU",   density: 0.92 },
  { value: "PC",    label: "PC",    density: 1.20 },
  { value: "Nylon", label: "Nylon", density: 1.14 },
  { value: "PVA",   label: "PVA",   density: 1.23 },
  { value: "HIPS",  label: "HIPS",  density: 1.04 },
] as const;

function densityFor(material: string): number {
  return MATERIALS.find(m => m.value === material)?.density ?? 1.24;
}

function estimateWeightFromVolume(volumeMm3: number, material: string): number {
  // volume mm³ → cm³ ÷ 1000, × density g/cm³
  return Math.round((volumeMm3 / 1000) * densityFor(material));
}

// ── Pricing logic (mirrors QuoteGenerator) ────────────────────────────────────
function calcPrice(
  grams: number,
  hours: number,
  quantity: number,
  filamentCostKg = 20,
  electricityRate = 0.10,
  margin = 30,
): { materialCost: number; electricityCost: number; totalCost: number; suggestedPrice: number; profit: number } {
  const materialCost    = (grams * (filamentCostKg / 1000)) * quantity;
  const electricityCost = hours * electricityRate * quantity;
  const totalCost       = materialCost + electricityCost;
  const suggestedPrice  = margin < 100 ? totalCost / (1 - margin / 100) : totalCost;
  const profit          = suggestedPrice - totalCost;
  return { materialCost, electricityCost, totalCost, suggestedPrice, profit };
}

export default function PublicQuotePage() {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  const [material, setMaterial]         = useState("PLA");
  const [weightGrams, setWeightGrams]   = useState(100);
  const [printHours, setPrintHours]     = useState(2);
  const [quantity, setQuantity]         = useState(1);
  const [filamentCostKg, setFilamentCostKg] = useState(20);
  const [margin, setMargin]             = useState(40); // default 40%; mirrors AppSettings.targetMarginPercent

  // ── STL parsing ──────────────────────────────────────────────────────────────
  const [stlFile, setStlFile]           = useState<File | null>(null);
  const [stlParsing, setStlParsing]     = useState(false);
  const [stlVolumeMm3, setStlVolumeMm3] = useState<number | null>(null);
  const [stlDimensions, setStlDimensions] = useState<{ w: number; h: number; d: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Request form ─────────────────────────────────────────────────────────────
  const [customerName, setCustomerName]   = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes]                 = useState("");
  const [submitting, setSubmitting]       = useState(false);
  const [submitted, setSubmitted]         = useState(false);
  const [submitError, setSubmitError]     = useState("");

  // ── Derived pricing ───────────────────────────────────────────────────────────
  const pricing = calcPrice(weightGrams, printHours, quantity, filamentCostKg, 0.10, margin);

  const handleStlFile = useCallback(async (file: File) => {
    setStlFile(file);
    setStlParsing(true);
    setStlVolumeMm3(null);
    setStlDimensions(null);
    try {
      const buffer = await file.arrayBuffer();
      const { parseSTL, getSTLInfo } = await import("@/components/STLViewer");
      const geometry = await parseSTL(buffer);
      const info = getSTLInfo(geometry);
      setStlVolumeMm3(info.volume);
      setStlDimensions({ w: info.width, h: info.height, d: info.depth });
      const estimated = estimateWeightFromVolume(info.volume, material);
      setWeightGrams(Math.max(1, estimated));
    } catch {
      // Could not parse STL — user can still enter weight manually
    } finally {
      setStlParsing(false);
    }
  }, [material]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleStlFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.toLowerCase().endsWith(".stl")) handleStlFile(f);
  };

  // Re-estimate weight when material changes and STL volume is known
  const handleMaterialChange = (val: string) => {
    setMaterial(val);
    if (stlVolumeMm3 !== null) {
      const estimated = estimateWeightFromVolume(stlVolumeMm3, val);
      setWeightGrams(Math.max(1, estimated));
    }
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !customerEmail.trim()) {
      setSubmitError("Please enter your name and email.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-quote-request", {
        body: {
          customerName:   customerName.trim(),
          customerEmail:  customerEmail.trim(),
          materialType:   material,
          weightGrams,
          printHours,
          quantity,
          estimatedPrice: parseFloat(pricing.suggestedPrice.toFixed(2)),
          notes:          notes.trim() || undefined,
        },
      });
      if (error || data?.error) throw new Error(error?.message ?? data?.error);
      setSubmitted(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setSubmitError(msg || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-green-500/10 mb-2">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold">Request sent!</h1>
          <p className="text-muted-foreground text-sm">
            We've received your quote request and will be in touch at <strong>{customerEmail}</strong> shortly.
          </p>
          <Button variant="outline" onClick={() => setSubmitted(false)}>Submit another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Calculator className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">3D Print Quote Calculator</h1>
            <p className="text-sm text-muted-foreground">Get an instant price estimate, then request your order.</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Left — Inputs */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Print parameters</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Material */}
                <div className="space-y-1.5">
                  <Label>Material type</Label>
                  <Select value={material} onValueChange={handleMaterialChange}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATERIALS.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label} <span className="text-muted-foreground text-xs ml-1">({m.density} g/cm³)</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* STL Upload */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Upload .STL file <span className="text-muted-foreground font-normal">(optional — auto-fills weight)</span>
                  </Label>
                  {!stlFile ? (
                    <div
                      className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      onDragOver={e => e.preventDefault()}
                      onDrop={onDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1.5" />
                      <p className="text-xs text-muted-foreground">Drag & drop or click to upload .STL</p>
                      <input ref={fileInputRef} type="file" accept=".stl" className="hidden" onChange={onFileChange} />
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border rounded-lg px-3 py-2 text-sm bg-muted/30">
                      {stlParsing ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                      ) : (
                        <Package className="h-4 w-4 text-primary shrink-0" />
                      )}
                      <span className="flex-1 truncate text-xs">{stlFile.name}</span>
                      {stlDimensions && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {stlDimensions.w}×{stlDimensions.h}×{stlDimensions.d} mm
                        </span>
                      )}
                      <button onClick={() => { setStlFile(null); setStlVolumeMm3(null); setStlDimensions(null); }}>
                        <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  )}
                  {stlVolumeMm3 !== null && (
                    <p className="text-xs text-muted-foreground">
                      Volume: {stlVolumeMm3.toLocaleString()} mm³ → estimated weight auto-filled below
                    </p>
                  )}
                </div>

                {/* Weight */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Weight className="h-3.5 w-3.5" />Estimated weight (grams)</Label>
                  <Input type="number" min={1} value={weightGrams} onChange={e => setWeightGrams(Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>

                {/* Print hours */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />Estimated print hours</Label>
                  <Input type="number" step={0.5} min={0} value={printHours} onChange={e => setPrintHours(Math.max(0, parseFloat(e.target.value) || 0))} />
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={quantity} onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </CardContent>
            </Card>

            {/* Advanced pricing params */}
            <details className="text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors py-1 select-none">
                Advanced pricing settings
              </summary>
              <Card className="mt-2">
                <CardContent className="pt-4 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5" />Filament cost (€/kg)</Label>
                    <Input type="number" step={0.5} min={0} value={filamentCostKg} onChange={e => setFilamentCostKg(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5" />Target profit margin (%)</Label>
                    <Input type="number" min={0} max={99} value={margin} onChange={e => setMargin(parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground">Price = cost ÷ (1 − margin%)</p>
                  </div>
                </CardContent>
              </Card>
            </details>
          </div>

          {/* Right — Results + Request */}
          <div className="space-y-4">
            <Card className="border-primary/30 bg-accent/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Price estimate</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cost breakdown */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Material cost</span>
                    <span className="font-mono">€{pricing.materialCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Electricity</span>
                    <span className="font-mono">€{pricing.electricityCost.toFixed(2)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="font-medium">Raw cost</span>
                    <span className="font-mono font-bold">€{pricing.totalCost.toFixed(2)}</span>
                  </div>
                </div>

                {/* Formula chain */}
                <div className="rounded-lg bg-muted/40 border px-3 py-2 text-xs text-muted-foreground space-y-0.5">
                  <p className="font-medium text-foreground">Price formula</p>
                  <p>Cost = €{pricing.totalCost.toFixed(2)} · Margin = {margin}%</p>
                  <p className="font-mono">Price = €{pricing.totalCost.toFixed(2)} ÷ (1 − {margin}%) = <span className="text-primary font-semibold">€{isFinite(pricing.suggestedPrice) ? pricing.suggestedPrice.toFixed(2) : "—"}</span></p>
                </div>

                {/* Suggested price */}
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Suggested price</span>
                    <span className="font-mono font-bold text-2xl text-primary">
                      €{isFinite(pricing.suggestedPrice) ? pricing.suggestedPrice.toFixed(2) : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-2 text-sm">
                    <span className="text-muted-foreground">Profit</span>
                    <span className="font-mono text-primary">€{isFinite(pricing.profit) ? pricing.profit.toFixed(2) : "—"}</span>
                  </div>
                  {quantity > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      for {quantity} pieces (€{isFinite(pricing.suggestedPrice) ? (pricing.suggestedPrice / quantity).toFixed(2) : "—"} each)
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Request form */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Request this order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Your name *</Label>
                  <Input placeholder="Jane Smith" value={customerName} onChange={e => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Your email *</Label>
                  <Input type="email" placeholder="jane@example.com" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Additional notes</Label>
                  <Textarea
                    placeholder="Any special requirements, colours, file links…"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
                {submitError && <p className="text-xs text-destructive">{submitError}</p>}
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={submitting || !customerName.trim() || !customerEmail.trim()}
                >
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Package className="h-4 w-4 mr-2" />}
                  {submitting ? "Sending…" : "Request this order"}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center">
                  This sends a quote request to the shop owner for review. No payment is taken now.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          Powered by{" "}
          <Link to="/about" className="underline underline-offset-2 hover:text-foreground transition-colors">
            PrintTrack
          </Link>
        </p>
      </div>
    </div>
  );
}
