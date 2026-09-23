export interface PrintModel {
  id: string;
  name: string;
  material?: string;
  color?: string;
  grams?: number;
  timeHours?: number;
}

export interface Print {
  id: string;
  name: string;
  estimatedPrintTime: number;
  materialUsed: number;
  printer: string;
  status: 'not-printed' | 'printing' | 'completed';
  quantity: number;
  completedQuantity: number;
  color: string;
  material: string;
  pricePerPiece: number;
  /** Optional list of individual models (parts) on this plate. Backwards-compatible: legacy prints have empty/undefined. */
  models?: PrintModel[];
  /** Ordered hex palette captured at import (one entry per filament slot). Used to resolve "Color 1/2/3". */
  colorPalette?: string[];
  /** Embedded preview thumbnail (data URL) extracted from .3mf. */
  thumbnail?: string;
}

export type KanbanStatus = 'new-order' | 'printing' | 'finished' | 'paid' | 'shipped';
export type ProductionStage = 'new' | 'in-design' | 'awaiting-approval' | 'printing' | 'ready' | 'delivered';
export type CustomerSource = 'Wallapop' | 'Instagram' | 'Website' | 'Other';
export type PaymentMethod = 'Cash' | 'PayPal' | 'Bank Transfer' | 'Bizum' | 'Other';
export type ExpenseCategory = 'Filament' | 'Shipping' | 'Equipment' | 'Tools' | 'Project Expense' | 'Other';
export type DesignItemStatus = 'not-started' | 'in-progress' | 'awaiting-approval' | 'approved';

export interface DesignItem {
  id: string;
  description: string;
  estimatedHours: number;
  actualHours: number;
  status: DesignItemStatus;
}

export interface TimelineEvent {
  id: string;
  type: 'created' | 'stage-changed' | 'payment' | 'payment-undone' | 'file-imported' | 'note' | 'delivered';
  date: string;
  label: string;
  note?: string;
}

export interface Payment {
  id: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  notes?: string;
}

export interface FilamentPurchase {
  id: string;
  purchaseDate: string;
  materialType: string;
  brand: string;
  spoolWeight: number; // grams per spool
  numberOfSpools: number;
  totalCost: number;
  notes: string;
  color?: string;    // human-readable colour name e.g. "Arctic White"
  colorSwatch?: string; // hex colour for the swatch e.g. "#F5F5F5"
}

export interface ProjectExpense {
  id: string;
  name: string;
  amount: number;
  category: string;
  notes: string;
}

export interface Project {
  id: string;
  name: string;
  customerName: string;
  customerSource: CustomerSource;
  paymentMethod: PaymentMethod;
  orderDate: string;
  dueDate: string;
  totalPrice: number;
  printed: boolean;
  paid: boolean;
  sent: boolean;
  shippingDate: string;
  notes: string;
  prints: Print[];
  kanbanStatus: KanbanStatus;
  /** New production stage — normalizeStage() reads this, falls back to kanbanStatus mapping. */
  stage?: ProductionStage;
  projectExpenses: ProjectExpense[];
  /** Design work items stored in project JSONB. */
  designItems?: DesignItem[];
  /** Timeline events for the project (created, stage changed, payment, etc.). */
  timelineEvents?: TimelineEvent[];
  /** Payment log — each entry is one deposit/payment. paid is DERIVED from this. */
  payments?: Payment[];
  completedAt?: string;
  paidAt?: string;
  isRecurringCustomer?: boolean;
  // Smart Import metadata (Bambu Studio / GCODE)
  importSource?: 'bambu-studio' | 'manual';
  importFileType?: '3mf' | 'gcode';
  originalFileName?: string;
  /** Cover thumbnail (data URL) auto-extracted from .3mf import. */
  coverThumbnail?: string;
  /** Customer email for shipping notifications and Stripe receipts. */
  customerEmail?: string;
  /** Stripe Payment Link ID stored after generating a payment link. */
  stripePaymentLinkId?: string;
  /** Stripe Payment Link URL stored after generating a payment link. */
  stripePaymentLinkUrl?: string;
}

/** Get the effective date for analytics: shippingDate > completedAt > paidAt > orderDate */
export function getEffectiveDate(p: Project): string | null {
  return p.shippingDate || p.completedAt || p.paidAt || p.orderDate || null;
}

/** Idempotent stage normalizer: reads p.stage, falls back to kanbanStatus mapping. */
export function normalizeStage(p: Project): ProductionStage {
  if (p.stage) return p.stage;
  switch (p.kanbanStatus) {
    case 'new-order': return 'new';
    case 'printing':  return 'printing';
    case 'finished':  return 'ready';
    case 'paid':      return 'ready';
    case 'shipped':   return 'delivered';
    default:          return 'new';
  }
}

export const STAGE_ORDER: ProductionStage[] = ['new', 'in-design', 'awaiting-approval', 'printing', 'ready', 'delivered'];

export interface StageMeta {
  key: ProductionStage;
  label: string;
  token: string;
  next?: ProductionStage;
}

export const STAGE_META: Record<ProductionStage, StageMeta> = {
  'new':               { key: 'new',               label: 'New',               token: '--stage-new',      next: 'printing' },
  'in-design':         { key: 'in-design',          label: 'In design',         token: '--stage-design',   next: 'awaiting-approval' },
  'awaiting-approval': { key: 'awaiting-approval',  label: 'Awaiting approval', token: '--stage-approval', next: 'printing' },
  'printing':          { key: 'printing',            label: 'Printing',          token: '--stage-printing', next: 'ready' },
  'ready':             { key: 'ready',               label: 'Ready',             token: '--stage-ready',    next: 'delivered' },
  'delivered':         { key: 'delivered',           label: 'Delivered',         token: '--stage-delivered' },
};

export interface Expense {
  id: string;
  date: string;
  name: string;
  category: ExpenseCategory;
  amount: number;
  notes: string;
  linkedProject?: string;
}

export interface PrintTemplate {
  id: string;
  name: string;
  estimatedPrintTime: number;
  materialUsed: number;
  notes: string;
}

export interface AppSettings {
  filamentCostPerGram: number;
  printerCount: number;
  bufferMinutes: number;
  lowLoadThreshold: number;
  moderateLoadThreshold: number;
  // Business / invoice
  businessName?: string;
  businessAddress?: string;
  invoicePrefix?: string;
  currency?: string;
  // Onboarding
  printerModels?: string;
  notificationEmail?: string;
  onboardingCompleted?: boolean;
  // Quote calculator
  targetMarginPercent?: number;
  /** Design rate in €/hour (default 20). */
  designRate?: number;
  hourlyRate?: number;
}

export const CURRENCIES = [
  { code: 'EUR', symbol: '€',   label: 'Euro' },
  { code: 'USD', symbol: '$',   label: 'US Dollar' },
  { code: 'GBP', symbol: '£',   label: 'British Pound' },
  { code: 'PLN', symbol: 'zl',  label: 'Polish Zloty' },
  { code: 'BRL', symbol: 'R$',  label: 'Brazilian Real' },
  { code: 'CHF', symbol: 'Fr.', label: 'Swiss Franc' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$',  label: 'Australian Dollar' },
  { code: 'SEK', symbol: 'kr',  label: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr',  label: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr',  label: 'Danish Krone' },
  { code: 'JPY', symbol: '¥',   label: 'Japanese Yen' },
  { code: 'CZK', symbol: 'Kc',  label: 'Czech Koruna' },
  { code: 'HUF', symbol: 'Ft',  label: 'Hungarian Forint' },
  { code: 'MXN', symbol: '$',   label: 'Mexican Peso' },
] as const;

export function getCurrencySymbol(currency?: string): string {
  const found = CURRENCIES.find(c => c.code === (currency || 'EUR'));
  return found ? found.symbol : (currency || '€');
}

export type WorkloadLevel = 'low' | 'moderate' | 'high';

// ── Filename cleaning utilities ──────────────────────────────────────────────

/** Strip 3D print file extensions from a name (for display only). */
export function cleanDisplayName(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/(\.(gcode|3mf|stl|obj|amf|step|stp))+$/gi, '')
    .replace(/\.gcode\.3mf$/gi, '')
    .trim();
}

/**
 * Clean a plate name for display.
 * If the stored name is a Bambu-generated filename list
 * (e.g. "Plate 1 — model.stl_A, model.stl_B"), shows "Plate N · M models" instead.
 */
export function cleanPlateName(raw: string | null | undefined, idx: number, models?: { name: string }[]): string {
  if (!raw) return `Plate ${idx + 1}`;
  // Bambu Studio auto-generated pattern: contains .stl_ / .3mf_ suffixes or "Plate N — "
  const isBambuList = /\.(stl|obj|amf|3mf|gcode)_/i.test(raw) || /^Plate \d+\s*—/.test(raw);
  if (isBambuList) {
    const numMatch = raw.match(/^Plate (\d+)/i);
    const num = numMatch ? numMatch[1] : String(idx + 1);
    const count = (models || []).length;
    return `Plate ${num}${count > 0 ? ` · ${count} model${count !== 1 ? 's' : ''}` : ''}`;
  }
  return cleanDisplayName(raw) || `Plate ${idx + 1}`;
}

// ── Print helpers ────────────────────────────────────────────────────────────

/** Derive a display status for a print plate from its quantities. */
export function getPrintDerivedStatus(pr: Pick<Print, 'completedQuantity' | 'quantity'>): { label: string; done: boolean; partial: boolean } {
  const qty = pr.quantity || 1;
  const done = pr.completedQuantity || 0;
  if (done >= qty) return { label: 'Printed', done: true, partial: false };
  if (done > 0) return { label: `In progress (${done}/${qty})`, done: false, partial: true };
  return { label: 'Not printed', done: false, partial: false };
}

// Normalize legacy prints that may lack quantity/status fields
export function normalizePrint(pr: Partial<Print> & { id: string; name: string }): Print {
  const qty = pr.quantity && pr.quantity >= 1 ? pr.quantity : 1;
  let completedQty = pr.completedQuantity || 0;

  // Migration: trust completedQuantity if > 0; otherwise derive from explicit status
  if (completedQty === 0 && pr.status === 'completed') {
    completedQty = qty;
  }
  completedQty = Math.min(qty, Math.max(0, completedQty));

  // Derive status from completedQuantity
  const derivedStatus: Print['status'] =
    completedQty >= qty ? 'completed' : completedQty > 0 ? 'printing' : 'not-printed';

  return {
    id: pr.id,
    name: pr.name || '',
    estimatedPrintTime: pr.estimatedPrintTime || 0,
    materialUsed: pr.materialUsed || 0,
    printer: pr.printer || '',
    status: derivedStatus,
    quantity: qty,
    completedQuantity: completedQty,
    color: pr.color || '',
    material: pr.material || '',
    pricePerPiece: pr.pricePerPiece || 0,
    models: pr.models || [],
    colorPalette: pr.colorPalette,
    thumbnail: pr.thumbnail,
  };
}

// Calculate project total from piece prices (sum of pricePerPiece × quantity)
export const getProjectPiecesTotal = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.pricePerPiece || 0) * (pr.quantity || 1), 0);

// Get total pieces count
export const getProjectTotalPieces = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.quantity || 1), 0);

// ── Payment helpers ──────────────────────────────────────────────────────────

export const getProjectPaymentsTotal = (p: Project): number =>
  (p.payments || []).reduce((s, pay) => s + (pay.amount || 0), 0);

export const getProjectBalance = (p: Project): number => {
  const price = getProjectPiecesTotal(p) || (p.totalPrice || 0);
  return price - getProjectPaymentsTotal(p);
};

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export const getProjectPaymentStatus = (p: Project): PaymentStatus => {
  const price = getProjectPiecesTotal(p) || (p.totalPrice || 0);
  if (price <= 0) return 'paid';
  const paid = getProjectPaymentsTotal(p);
  if (paid <= 0) return 'unpaid';
  if (paid >= price) return 'paid';
  return 'partial';
};

// Normalize a project ensuring all fields exist
export function normalizeProject(p: any): Project {
  const base: any = {
    ...p,
    orderDate: p.orderDate || '',
    dueDate: p.dueDate || '',
    shippingDate: p.shippingDate || '',
    prints: (p.prints || []).map(normalizePrint),
    projectExpenses: p.projectExpenses || [],
    payments: p.payments || [],
    paymentMethod: p.paymentMethod || 'Other',
    kanbanStatus: p.kanbanStatus || 'new-order',
    // Preserve stage if already set; will be written on first save after normalizeStage
    stage: p.stage || undefined,
    designItems: p.designItems || [],
    timelineEvents: p.timelineEvents || [],
    completedAt: p.completedAt || '',
    paidAt: p.paidAt || '',
    isRecurringCustomer: p.isRecurringCustomer || false,
  };

  const allPrintsComplete = base.prints.length > 0 &&
    base.prints.every((pr: any) => (pr.completedQuantity || 0) >= (pr.quantity || 1));

  // Derive printed from plate completion
  if (allPrintsComplete) base.printed = true;

  if (!base.completedAt && (base.printed || base.sent || allPrintsComplete)) {
    base.completedAt = base.orderDate;
  }

  // Derive paid from payments if payments exist
  if (base.payments.length > 0) {
    const paymentsTotal = base.payments.reduce((s: number, pay: any) => s + (pay.amount || 0), 0);
    const effectiveTotal = base.prints.reduce((s: number, pr: any) => s + (pr.pricePerPiece || 0) * (pr.quantity || 1), 0) || (base.totalPrice || 0);
    base.paid = effectiveTotal <= 0 || paymentsTotal >= effectiveTotal;
  }

  if (!base.paidAt && base.paid) {
    base.paidAt = base.orderDate;
  }
  if (base.paidAt && !base.paid) base.paidAt = '';
  if (!base.shippingDate && base.sent) {
    base.shippingDate = base.orderDate;
  }
  return base;
}

// Real profit: revenue minus actual filament purchases and other expenses (NOT estimated material cost)
export const getProjectRealProfit = (p: Project, _costPerGram: number) =>
  (p.totalPrice || 0) - getProjectExpensesTotal(p);

// Estimated material cost (informational only, NOT used in real profit)
export const getEstimatedMaterialCost = (p: Project, costPerGram: number) =>
  getProjectTotalMaterial(p) * (costPerGram || 0);

// Real profit margin based on real expenses only
export const getRealProfitMargin = (totalRevenue: number, totalFilamentPurchases: number, totalOtherExpenses: number) => {
  if (totalRevenue === 0) return 0;
  return ((totalRevenue - totalFilamentPurchases - totalOtherExpenses) / totalRevenue) * 100;
};

export function getWorkloadStats(projects: Project[], settings: AppSettings) {
  // Only count prints from projects that are NOT fully done (printed/finished/shipped)
  const activeProjects = projects.filter(p => !p.printed);
  const remainingPrints = activeProjects.flatMap(p => p.prints).filter(pr => pr.status !== 'completed');
  const totalHours = remainingPrints.reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * ((pr.quantity || 1) - (pr.completedQuantity || 0)), 0);
  const totalMaterial = remainingPrints.reduce((s, pr) => s + (pr.materialUsed || 0) * ((pr.quantity || 1) - (pr.completedQuantity || 0)), 0);
  const count = remainingPrints.reduce((s, pr) => s + ((pr.quantity || 1) - (pr.completedQuantity || 0)), 0);
  const bufferHours = count > 0 ? ((count - 1) * (settings.bufferMinutes || 0)) / 60 : 0;
  const grossHours = totalHours + bufferHours;
  const effectiveHours = settings.printerCount > 0 ? grossHours / settings.printerCount : grossHours;

  let level: WorkloadLevel = 'low';
  if (effectiveHours >= (settings.moderateLoadThreshold || 72)) level = 'high';
  else if (effectiveHours >= (settings.lowLoadThreshold || 24)) level = 'moderate';

  return { remainingPrints: count, totalHours, totalMaterial, bufferHours, grossHours, effectiveHours, level };
}

// Helpers — all quantity-aware, with safe defaults
export const getProjectTotalPrintTime = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.estimatedPrintTime || 0) * (pr.quantity || 1), 0);

export const getProjectTotalMaterial = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.materialUsed || 0) * (pr.quantity || 1), 0);

export const getProjectMaterialCost = (p: Project, costPerGram: number) =>
  getProjectTotalMaterial(p) * (costPerGram || 0);

export const getProjectExpensesTotal = (p: Project) =>
  (p.projectExpenses || []).reduce((s, e) => s + (e.amount || 0), 0);

export const getProjectProfit = (p: Project, costPerGram: number) =>
  (p.totalPrice || 0) - getProjectMaterialCost(p, costPerGram) - getProjectExpensesTotal(p);

export const getProjectProfitMargin = (p: Project, costPerGram: number) => {
  if (!p.totalPrice || p.totalPrice === 0) return 0;
  return (getProjectProfit(p, costPerGram) / p.totalPrice) * 100;
};

export const getProjectDesignHours = (p: Project): number =>
  (p.designItems || []).reduce((s, d) => s + (d.actualHours || d.estimatedHours || 0), 0);

export const getProjectEstimatedCost = (
  p: Project,
  settings: Pick<AppSettings, 'filamentCostPerGram' | 'hourlyRate' | 'designRate'>
) =>
  getProjectTotalMaterial(p) * (settings.filamentCostPerGram || 0)
  + getProjectTotalPrintTime(p) * (settings.hourlyRate ?? 2)
  + getProjectDesignHours(p) * (settings.designRate ?? 20)
  + getProjectExpensesTotal(p);

export const getProjectEstimatedMargin = (
  p: Project,
  settings: Pick<AppSettings, 'filamentCostPerGram' | 'hourlyRate' | 'designRate'>
): number | null => {
  const effectivePrice = getProjectPiecesTotal(p) || (p.totalPrice || 0);
  // No material, time, or design data → can't estimate margin
  if (effectivePrice <= 0) return null;
  const totalMat = getProjectTotalMaterial(p);
  const totalTime = getProjectTotalPrintTime(p);
  const designHours = getProjectDesignHours(p);
  if (totalMat === 0 && totalTime === 0 && designHours === 0) return null;
  return (effectivePrice - getProjectEstimatedCost(p, settings)) / effectivePrice * 100;
};

export const getProjectProgress = (p: Project) => {
  const prints = p.prints || [];
  const totalPieces = prints.reduce((s, pr) => s + (pr.quantity || 1), 0);
  const completedPieces = prints.reduce((s, pr) => s + Math.min(pr.completedQuantity || 0, pr.quantity || 1), 0);

  // If project is shipped, treat as 100%
  if (p.sent) {
    return { totalPieces, completedPieces: totalPieces, percent: 100 };
  }

  // Check if all individual prints are completed
  const allCompleted = totalPieces > 0 && prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
  if (allCompleted || p.printed) {
    return { totalPieces, completedPieces: totalPieces, percent: 100 };
  }

  return { totalPieces, completedPieces, percent: totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0 };
};

/** Human-readable progress summary, e.g. "Printing 2 of 3 plates" or "Design approved · Printing 1 of 2 plates" */
export function getProgressSummary(p: Project): string {
  const stage = normalizeStage(p);
  const prints = p.prints || [];
  const totalPlates = prints.length;
  const completedPlates = prints.filter(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1)).length;
  const designItems = p.designItems || [];
  const allDesignApproved = designItems.length > 0 && designItems.every(d => d.status === 'approved');

  const printPart = totalPlates > 0
    ? `Printing ${completedPlates} of ${totalPlates} plate${totalPlates !== 1 ? 's' : ''}`
    : '';

  if (stage === 'delivered') return 'Delivered';
  if (stage === 'ready') return totalPlates > 0 ? 'All plates done · Ready' : 'Ready';
  if (stage === 'printing' || (stage === 'new' && totalPlates > 0)) {
    return allDesignApproved ? `Design approved · ${printPart}` : printPart;
  }
  if (stage === 'awaiting-approval') return 'Awaiting client approval';
  if (stage === 'in-design') {
    if (designItems.length === 0) return 'In design';
    const done = designItems.filter(d => d.status === 'approved').length;
    return `Design ${done}/${designItems.length} approved`;
  }
  return totalPlates > 0 ? printPart : 'New project';
}

export const getGlobalPrintProgress = (projects: Project[]) => {
  let totalHours = 0;
  let completedHours = 0;

  projects.forEach(p => {
    const projectTime = (p.prints || []).reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * (pr.quantity || 1), 0);
    totalHours += projectTime;

    if (p.printed) {
      // Fully printed/finished/shipped → all hours count as completed
      completedHours += projectTime;
    } else {
      // Use per-print completedQuantity for partial progress
      completedHours += (p.prints || []).reduce((s, pr) => s + (pr.estimatedPrintTime || 0) * (pr.completedQuantity || 0), 0);
    }
  });

  const remainingHours = totalHours - completedHours;
  const percent = totalHours > 0 ? Math.round((completedHours / totalHours) * 100) : 0;
  return { totalHours, completedHours, remainingHours, percent };
};

// Suggestions engine
export interface PrintSuggestion {
  type: 'batch' | 'next-print';
  message: string;
  printNames: string[];
}

export function getSuggestions(projects: Project[]): PrintSuggestion[] {
  const suggestions: PrintSuggestion[] = [];
  const pending = projects.flatMap(p => (p.prints || []).filter(pr => (pr.completedQuantity || 0) < (pr.quantity || 1)))
    .sort((a, b) => (a.estimatedPrintTime || 0) - (b.estimatedPrintTime || 0));

  const smallPrints = pending.filter(pr => (pr.estimatedPrintTime || 0) <= 2 && pr.name);
  if (smallPrints.length >= 2) {
    suggestions.push({
      type: 'batch',
      message: `${smallPrints.length} small prints detected. Consider printing them together for efficiency.`,
      printNames: smallPrints.slice(0, 5).map(pr => pr.name),
    });
  }

  if (pending.length > 0) {
    const next = pending.slice(0, 3);
    suggestions.push({
      type: 'next-print',
      message: 'Recommended next prints (shortest first for quick wins):',
      printNames: next.map(pr => pr.name),
    });
  }

  return suggestions;
}

// Advanced analytics helpers
export function getAdvancedAnalytics(projects: Project[], expenses: Expense[], costPerGram: number) {
  const paidSent = projects.filter(p => p.paid && p.sent);
  const allPrints = projects.flatMap(p => p.prints || []);

  // Averages
  const avgOrderValue = paidSent.length > 0 ? paidSent.reduce((s, p) => s + (p.totalPrice || 0), 0) / paidSent.length : 0;
  // Use real profit margin (revenue - project expenses only, no estimated material cost)
  const avgProfitMargin = paidSent.length > 0 ? paidSent.reduce((s, p) => {
    const price = p.totalPrice || 0;
    const expTotal = getProjectExpensesTotal(p);
    return s + (price > 0 ? ((price - expTotal) / price) * 100 : 0);
  }, 0) / paidSent.length : 0;
  const avgPrintTime = projects.length > 0 ? projects.reduce((s, p) => s + getProjectTotalPrintTime(p), 0) / projects.length : 0;
  const avgMaterial = projects.length > 0 ? projects.reduce((s, p) => s + getProjectTotalMaterial(p), 0) / projects.length : 0;

  // Most profitable print
  const printProfitMap = new Map<string, { name: string; totalProfit: number; count: number }>();
  paidSent.forEach(p => {
    (p.prints || []).forEach(pr => {
      if (!pr.name) return;
      const existing = printProfitMap.get(pr.name) || { name: pr.name, totalProfit: 0, count: 0 };
      const printRevShare = pr.pricePerPiece > 0
        ? pr.pricePerPiece * (pr.quantity || 1)
        : (p.prints.length > 0 ? (p.totalPrice || 0) / p.prints.length : 0);
      const printCost = (pr.materialUsed || 0) * (pr.quantity || 1) * costPerGram;
      existing.totalProfit += printRevShare - printCost;
      existing.count += pr.quantity || 1;
      printProfitMap.set(pr.name, existing);
    });
  });
  const printsByProfit = Array.from(printProfitMap.values()).sort((a, b) => b.totalProfit - a.totalProfit);
  const mostProfitablePrint = printsByProfit[0]?.name || '—';

  // Most ordered print
  const printCountMap = new Map<string, number>();
  projects.forEach(p => (p.prints || []).forEach(pr => {
    if (!pr.name) return;
    printCountMap.set(pr.name, (printCountMap.get(pr.name) || 0) + (pr.quantity || 1));
  }));
  const printsByCount = Array.from(printCountMap.entries()).sort((a, b) => b[1] - a[1]);
  const mostOrderedPrint = printsByCount[0] ? `${printsByCount[0][0]} (${printsByCount[0][1]}×)` : '—';

  // Longest print
  const longestPrint = allPrints.length > 0
    ? allPrints.reduce((best, pr) => (pr.estimatedPrintTime || 0) > (best.estimatedPrintTime || 0) ? pr : best, allPrints[0])
    : null;

  // Most material project
  const projectsByMaterial = [...projects].sort((a, b) => getProjectTotalMaterial(b) - getProjectTotalMaterial(a));
  const mostMaterialProject = projectsByMaterial[0]?.name || '—';

  return {
    avgOrderValue, avgProfitMargin, avgPrintTime, avgMaterial,
    mostProfitablePrint, mostOrderedPrint,
    longestPrint: longestPrint ? `${longestPrint.name} (${longestPrint.estimatedPrintTime}h)` : '—',
    mostMaterialProject,
  };
}
