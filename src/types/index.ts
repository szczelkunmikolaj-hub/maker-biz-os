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
}

export type KanbanStatus = 'new-order' | 'printing' | 'finished' | 'paid' | 'shipped';
export type CustomerSource = 'Wallapop' | 'Instagram' | 'Website' | 'Other';
export type PaymentMethod = 'Cash' | 'PayPal' | 'Bank Transfer' | 'Bizum' | 'Other';
export type ExpenseCategory = 'Filament' | 'Shipping' | 'Equipment' | 'Tools' | 'Project Expense' | 'Other';

export interface FilamentPurchase {
  id: string;
  purchaseDate: string;
  materialType: string;
  brand: string;
  spoolWeight: number; // grams per spool
  numberOfSpools: number;
  totalCost: number;
  notes: string;
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
  projectExpenses: ProjectExpense[];
}

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
}

export type WorkloadLevel = 'low' | 'moderate' | 'high';

// Normalize legacy prints that may lack quantity/status fields
export function normalizePrint(pr: Partial<Print> & { id: string; name: string }): Print {
  return {
    id: pr.id,
    name: pr.name || '',
    estimatedPrintTime: pr.estimatedPrintTime || 0,
    materialUsed: pr.materialUsed || 0,
    printer: pr.printer || '',
    status: pr.status || 'not-printed',
    quantity: pr.quantity && pr.quantity >= 1 ? pr.quantity : 1,
    completedQuantity: pr.completedQuantity || 0,
    color: pr.color || '',
    material: pr.material || '',
    pricePerPiece: pr.pricePerPiece || 0,
  };
}

// Calculate project total from piece prices (sum of pricePerPiece × quantity)
export const getProjectPiecesTotal = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.pricePerPiece || 0) * (pr.quantity || 1), 0);

// Get total pieces count
export const getProjectTotalPieces = (p: Project) =>
  (p.prints || []).reduce((sum, pr) => sum + (pr.quantity || 1), 0);

// Normalize a project ensuring all fields exist
export function normalizeProject(p: any): Project {
  return {
    ...p,
    dueDate: p.dueDate || '',
    prints: (p.prints || []).map(normalizePrint),
    projectExpenses: p.projectExpenses || [],
    paymentMethod: p.paymentMethod || 'Other',
    kanbanStatus: p.kanbanStatus || 'new-order',
  };
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

export const getProjectProgress = (p: Project) => {
  const prints = p.prints || [];
  const totalPieces = prints.reduce((s, pr) => s + (pr.quantity || 1), 0);
  const completedPieces = prints.reduce((s, pr) => s + (pr.completedQuantity || 0), 0);

  // If project is marked as printed/paid/sent, treat as 100%
  if (p.printed || p.paid || p.sent) {
    return { totalPieces, completedPieces: totalPieces, percent: 100 };
  }

  // Check if all individual prints are completed
  const allCompleted = totalPieces > 0 && prints.every(pr => (pr.completedQuantity || 0) >= (pr.quantity || 1));
  if (allCompleted) {
    return { totalPieces, completedPieces: totalPieces, percent: 100 };
  }

  return { totalPieces, completedPieces, percent: totalPieces > 0 ? Math.round((completedPieces / totalPieces) * 100) : 0 };
};

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
      const printRevShare = p.prints.length > 0 ? (p.totalPrice || 0) / p.prints.length : 0;
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
