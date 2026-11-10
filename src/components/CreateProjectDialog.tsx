import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, X, FileText, ChevronDown, ChevronUp } from "lucide-react";
import type { Project, Print, Payment, CustomerSource, PaymentMethod } from "@/types";
import { useApp } from "@/context/AppContext";
import { parse3mf, parseGcodeFile, type ParsedImport } from "@/lib/bambuParser";
import {
  PAYMENT_METHOD_TOKENS, CUSTOMER_SOURCE_TOKENS,
  categoryBadgeStyle,
} from "@/lib/categoryColors";
import { CategoryDot } from "@/components/CategoryBadge";
import posthog from "@/lib/posthog";
import { getCurrencySymbol } from "@/types";
import { normalizeMaterial, normalizeColors } from "@/lib/normalize";

const SOURCES: CustomerSource[] = ["Wallapop", "Instagram", "Website", "Other"];
const PAYMENT_METHODS: PaymentMethod[] = ["Cash", "PayPal", "Bank Transfer", "Bizum", "Stripe", "Other"];

function platesToPrints(plates: ParsedImport["plates"]): Print[] {
  return plates.map((plate) => {
    const material = normalizeMaterial(plate.filamentType);
    const colors = normalizeColors(plate.filamentColor, plate.filamentPalette);
    const colorLabel = colors.map((c) => c.label).join(", ");
    return {
      id: crypto.randomUUID(),
      name: plate.modelNames.length
        ? `${plate.name} — ${plate.modelNames.slice(0, 3).join(", ")}${plate.modelNames.length > 3 ? ` +${plate.modelNames.length - 3}` : ""}`
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
      models: plate.modelNames.map((n) => ({ id: crypto.randomUUID(), name: n, material, color: colorLabel })),
    };
  });
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** When true the file input is triggered on first open (for "Start from sliced file" flow). */
  triggerFile?: boolean;
}

interface FormErrors {
  name?: string;
  price?: string;
}

export function CreateProjectDialog({ open, onClose, triggerFile = false }: Props) {
  const { addProject, projects, settings } = useApp();
  const navigate = useNavigate();
  const currency = getCurrencySymbol(settings.currency);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().split("T")[0];

  // Form fields
  const [name, setName] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [orderDate, setOrderDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [customerSource, setCustomerSource] = useState<CustomerSource>("Other");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Other");
  const [paymentStatus, setPaymentStatus] = useState<"unpaid" | "paid" | "deposit">("unpaid");
  const [depositAmount, setDepositAmount] = useState("");
  const [depositType, setDepositType] = useState<"fixed" | "percent">("fixed");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [showOptional, setShowOptional] = useState(false);
  // null = follow auto-detection from past orders; true/false = the user chose explicitly
  const [recurringChoice, setRecurringChoice] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  // File import
  const [parsedImport, setParsedImport] = useState<ParsedImport | null>(null);
  const [importPrints, setImportPrints] = useState<Print[]>([]);
  const [fileParseState, setFileParseState] = useState<"idle" | "parsing" | "error">("idle");
  const [fileParseError, setFileParseError] = useState("");

  const reset = useCallback(() => {
    setName(""); setCustomerName(""); setTotalPrice(""); setOrderDate(today);
    setDueDate(""); setCustomerSource("Other"); setPaymentMethod("Other");
    setPaymentStatus("unpaid"); setDepositAmount(""); setDepositType("fixed");
    setCustomerEmail(""); setNotes(""); setShowOptional(false); setErrors({}); setRecurringChoice(null);
    setParsedImport(null); setImportPrints([]); setFileParseState("idle"); setFileParseError("");
  }, [today]);

  // Trigger file input on first open when requested
  useEffect(() => {
    if (open && triggerFile) {
      const timer = setTimeout(() => fileInputRef.current?.click(), 120);
      return () => clearTimeout(timer);
    }
  }, [open, triggerFile]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const handleFiles = useCallback(async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    const file = files[0];
    if (!file) return;
    const lower = file.name.toLowerCase();
    setFileParseState("parsing");
    try {
      let result: ParsedImport;
      if (lower.endsWith(".3mf")) {
        result = await parse3mf(file);
      } else if (lower.endsWith(".gcode")) {
        result = await parseGcodeFile(file);
      } else {
        setFileParseState("error");
        setFileParseError("Unsupported format — drop a .3mf or .gcode file.");
        return;
      }
      const prints = platesToPrints(result.plates);
      const costPerGram = settings.filamentCostPerGram || 0;
      const totalCost = result.totalFilamentGrams * costPerGram;
      const targetMargin = (settings.targetMarginPercent ?? 40) / 100;
      const suggestedPrice = totalCost > 0 && targetMargin < 1
        ? Math.round((totalCost / (1 - targetMargin)) * 100) / 100
        : Math.round(totalCost * 100) / 100;

      setParsedImport(result);
      setImportPrints(prints);
      if (!name) setName(result.projectName);
      if (!totalPrice && suggestedPrice > 0) setTotalPrice(suggestedPrice.toFixed(2));
      setFileParseState("idle");
    } catch (err) {
      setFileParseState("error");
      setFileParseError((err as Error).message || "Parse failed.");
    }
  }, [settings, name, totalPrice]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  };

  const numPrice = parseFloat(totalPrice) || 0;
  const resolvedDeposit = depositType === "percent"
    ? (parseFloat(depositAmount) || 0) / 100 * numPrice
    : parseFloat(depositAmount) || 0;

  const validate = (): boolean => {
    const errs: FormErrors = {};
    if (!name.trim()) errs.name = "Project name is required.";
    if (totalPrice && numPrice < 0) errs.price = "Price cannot be negative.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Past customers, most frequent first — used for name suggestions and returning-customer detection
  const knownCustomers = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    projects.forEach(p => {
      const n = (p.customerName || "").trim();
      if (!n) return;
      const k = n.toLowerCase();
      const cur = counts.get(k);
      if (cur) cur.count += 1; else counts.set(k, { name: n, count: 1 });
    });
    return Array.from(counts.values()).sort((a, b) => b.count - a.count);
  }, [projects]);
  const pastOrderCount = knownCustomers.find(c => c.name.toLowerCase() === customerName.toLowerCase().trim())?.count ?? 0;
  const isRecurring = recurringChoice ?? pastOrderCount > 0;

  const handleCreate = () => {
    if (!validate()) return;

    const payments: Payment[] = [];
    if (paymentStatus === "paid" && numPrice > 0) {
      payments.push({ id: crypto.randomUUID(), amount: numPrice, date: orderDate, method: paymentMethod });
    } else if (paymentStatus === "deposit" && resolvedDeposit > 0) {
      payments.push({ id: crypto.randomUUID(), amount: resolvedDeposit, date: orderDate, method: paymentMethod });
    }

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim(),
      customerName: customerName.trim(),
      customerSource,
      paymentMethod,
      orderDate,
      dueDate: dueDate || "",
      totalPrice: numPrice,
      printed: false,
      paid: payments.length > 0 && paymentStatus === "paid",
      sent: false,
      shippingDate: "",
      notes: notes.trim(),
      prints: importPrints,
      kanbanStatus: "new-order",
      projectExpenses: [],
      isRecurringCustomer: isRecurring,
      payments,
      customerEmail: customerEmail.trim() || undefined,
      ...(parsedImport ? {
        importSource: "bambu-studio" as const,
        importFileType: parsedImport.source,
        originalFileName: parsedImport.originalFileName,
        coverThumbnail: parsedImport.coverThumbnail,
      } : {}),
    };

    addProject(newProject);
    posthog.capture("project_created", {
      customer_source: customerSource,
      payment_method: paymentMethod,
      payment_status: paymentStatus,
      has_file_import: importPrints.length > 0,
      is_recurring_customer: isRecurring,
    });

    onClose();
    navigate(`/projects?id=${newProject.id}`, { state: { from: window.location.pathname } });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pb-1">
          {/* File import section */}
          <div
            className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-3 transition-colors hover:border-primary/40"
            onDragOver={e => e.preventDefault()}
            onDrop={onDrop}
          >
            {parsedImport ? (
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{parsedImport.originalFileName}</p>
                  <p className="text-[10px] text-muted-foreground">{parsedImport.plates.length} plate{parsedImport.plates.length !== 1 ? "s" : ""} · {importPrints.length} plate{importPrints.length !== 1 ? "s" : ""} imported</p>
                </div>
                <button
                  className="text-muted-foreground hover:text-foreground shrink-0"
                  onClick={() => { setParsedImport(null); setImportPrints([]); setFileParseState("idle"); setFileParseError(""); }}
                  title="Remove file"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                className="w-full flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={fileParseState === "parsing"}
                type="button"
              >
                {fileParseState === "parsing" ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Parsing file…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5" /> Start from a sliced file (.3mf / .gcode / .stl)</>
                )}
              </button>
            )}
            {fileParseState === "error" && (
              <p className="text-[10px] text-destructive mt-1 text-center">{fileParseError}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".3mf,.gcode,.stl"
              className="hidden"
              onChange={e => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {/* Project name */}
          <div>
            <Label className="text-xs">Project name <span className="text-destructive">*</span></Label>
            <Input
              autoFocus={!triggerFile}
              placeholder="e.g. Miniature set for Maria"
              value={name}
              onChange={e => { setName(e.target.value); if (errors.name) setErrors(prev => ({ ...prev, name: undefined })); }}
              className={errors.name ? "border-destructive" : ""}
            />
            {errors.name && <p className="text-[11px] text-destructive mt-1">{errors.name}</p>}
          </div>

          {/* Customer name */}
          <div>
            <Label className="text-xs">Customer name</Label>
            <Input
              placeholder="e.g. Maria García"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              list="create-project-customers"
              autoComplete="off"
            />
            <datalist id="create-project-customers">
              {knownCustomers.map(c => <option key={c.name} value={c.name} />)}
            </datalist>
            <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer select-none">
              <Checkbox checked={isRecurring} onCheckedChange={v => setRecurringChoice(!!v)} />
              <span>Recurring customer</span>
              {pastOrderCount > 0 && recurringChoice === null && (
                <span className="text-muted-foreground">
                  · {pastOrderCount} previous {pastOrderCount === 1 ? "order" : "orders"} found
                </span>
              )}
            </label>
          </div>

          {/* Price + Order date (2-col) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Total price ({currency})</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={totalPrice}
                onChange={e => { setTotalPrice(e.target.value); if (errors.price) setErrors(prev => ({ ...prev, price: undefined })); }}
                className={errors.price ? "border-destructive" : ""}
              />
              {errors.price && <p className="text-[11px] text-destructive mt-1">{errors.price}</p>}
            </div>
            <div>
              <Label className="text-xs">Order date</Label>
              <Input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} />
            </div>
          </div>

          {/* Due date */}
          <div>
            <Label className="text-xs">Delivery / due date <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          {/* Source + Payment method (2-col) */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Customer source</Label>
              <Select value={customerSource} onValueChange={v => setCustomerSource(v as CustomerSource)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCES.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-1.5">
                        <CategoryDot token={CUSTOMER_SOURCE_TOKENS[s]} />
                        {s}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment method</Label>
              <Select value={paymentMethod} onValueChange={v => setPaymentMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>
                      <span className="flex items-center gap-1.5">
                        <CategoryDot token={PAYMENT_METHOD_TOKENS[m]} />
                        {m}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Payment status */}
          <div>
            <Label className="text-xs">Payment status</Label>
            <div className="flex gap-2 mt-1.5">
              {(["unpaid", "paid", "deposit"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPaymentStatus(s)}
                  className={`flex-1 text-xs px-2 py-1.5 rounded-md border transition-colors font-medium ${
                    paymentStatus === s
                      ? s === "paid" ? "bg-[color-mix(in_srgb,var(--pay-paid)_15%,transparent)] text-[var(--pay-paid)] border-[color-mix(in_srgb,var(--pay-paid)_30%,transparent)]"
                      : s === "deposit" ? "bg-[color-mix(in_srgb,var(--pay-partial)_15%,transparent)] text-[var(--pay-partial)] border-[color-mix(in_srgb,var(--pay-partial)_30%,transparent)]"
                      : "bg-[color-mix(in_srgb,var(--pay-unpaid)_15%,transparent)] text-[var(--pay-unpaid)] border-[color-mix(in_srgb,var(--pay-unpaid)_30%,transparent)]"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {s === "unpaid" ? "Unpaid" : s === "paid" ? "Paid in full" : "Deposit received"}
                </button>
              ))}
            </div>
          </div>

          {/* Deposit amount — shown only when deposit is selected */}
          {paymentStatus === "deposit" && (
            <div>
              <Label className="text-xs">Deposit amount</Label>
              <div className="flex gap-1.5 mt-1">
                <div className="flex rounded-md border border-border overflow-hidden shrink-0">
                  <button
                    type="button"
                    className={`text-xs px-2 py-1 transition-colors ${depositType === "fixed" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                    onClick={() => setDepositType("fixed")}
                  >{currency}</button>
                  <button
                    type="button"
                    className={`text-xs px-2 py-1 border-l border-border transition-colors ${depositType === "percent" ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"} disabled:opacity-40`}
                    onClick={() => setDepositType("percent")}
                    disabled={numPrice <= 0}
                  >%</button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  placeholder={depositType === "percent" ? "50" : "0.00"}
                  value={depositAmount}
                  onChange={e => setDepositAmount(e.target.value)}
                  className="flex-1"
                />
                {depositType === "percent" && numPrice > 0 && (
                  <span className="text-xs text-muted-foreground self-center shrink-0">
                    = {currency}{resolvedDeposit.toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Optional fields toggle */}
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowOptional(v => !v)}
          >
            {showOptional ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {showOptional ? "Hide optional fields" : "Show optional fields (email, notes)"}
          </button>

          {showOptional && (
            <>
              <div>
                <Label className="text-xs">Customer email</Label>
                <Input
                  type="email"
                  placeholder="customer@example.com"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  placeholder="Any notes about this order…"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="resize-none min-h-[72px]"
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-row">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleCreate} className="flex-1">Create project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
