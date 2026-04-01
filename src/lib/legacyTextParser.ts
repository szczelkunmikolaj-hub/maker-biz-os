import type { Project, Expense } from '@/types';
import { endOfMonth } from 'date-fns';

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const SOURCES = ['cash', 'wallapop', 'bizum', 'vinted'] as const;

interface ParseResult {
  projects: Project[];
  expenses: Expense[];
}

function detectSource(line: string): string {
  const lower = line.toLowerCase();
  for (const s of SOURCES) {
    if (lower.includes(s)) return s.charAt(0).toUpperCase() + s.slice(1);
  }
  return 'Other';
}

function extractAllPositiveNumbers(line: string): number[] {
  // Remove source keywords so "50 bizum 50 wallapop" doesn't lose numbers
  // Match all number patterns (with optional comma/dot decimals)
  const matches = line.match(/\d+(?:[.,]\d+)?/g);
  if (!matches) return [];
  return matches.map(m => parseFloat(m.replace(',', '.'))).filter(n => n > 0);
}

function extractRevenue(line: string): number {
  // Sum ALL positive numbers found in the line
  const numbers = extractAllPositiveNumbers(line);
  return numbers.reduce((sum, n) => sum + n, 0);
}

function extractExpenseAmount(line: string): number {
  // For expenses, also sum all positive numbers
  const numbers = extractAllPositiveNumbers(line);
  return numbers.reduce((sum, n) => sum + n, 0);
}

function getMonthEndDate(month: number, referenceYear?: number): string {
  const now = new Date();
  let year = referenceYear || now.getFullYear();
  if (month > now.getMonth() && !referenceYear) {
    year = now.getFullYear() - 1;
  }
  const d = endOfMonth(new Date(year, month, 1));
  return d.toISOString();
}

export function parseLegacyText(text: string): ParseResult {
  const lines = text.split('\n');
  const projects: Project[] = [];
  const expenses: Expense[] = [];

  let currentMonth: number | null = null;
  let inExpenses = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Detect month headers
    const monthLower = line.toLowerCase().replace(/[^a-z]/g, '');
    if (MONTHS[monthLower] !== undefined) {
      currentMonth = MONTHS[monthLower];
      inExpenses = false;
      continue;
    }

    // Detect expenses section
    if (/^expenses?:?\s*$/i.test(line) || /^expenses?$/i.test(line)) {
      inExpenses = true;
      continue;
    }

    // A new [x] or [ ] line after expenses section means we're back to items
    if (inExpenses && (line.startsWith('[x]') || line.startsWith('[X]') || line.startsWith('[ ]'))) {
      inExpenses = false;
      // fall through to handle below
    }

    if (currentMonth === null) continue;

    const completedAt = getMonthEndDate(currentMonth);

    // Handle expenses
    if (inExpenses) {
      const amount = extractExpenseAmount(line);
      if (amount > 0) {
        const name = line.replace(/(\d+(?:[.,]\d+)?)\s*(?:euros?|€)?/gi, '').replace(/[-–:]/g, '').trim() || 'Expense';
        expenses.push({
          id: crypto.randomUUID(),
          date: completedAt.slice(0, 10),
          name,
          category: 'Other',
          amount,
          notes: `Imported from legacy text`,
        });
      }
      continue;
    }

    // [ ] = not completed → IGNORE
    if (line.startsWith('[ ]')) continue;

    // Only process completed items [x]
    if (!line.startsWith('[x]') && !line.startsWith('[X]')) continue;

    const content = line.replace(/^\[x\]\s*/i, '');
    const revenue = extractRevenue(content);
    const name = content.split(/[:\-–]/)[0]?.trim() || content.replace(/\d+.*$/, '').trim() || 'Unnamed Project';
    const source = detectSource(content);

    if (revenue <= 0) continue;

    projects.push({
      id: crypto.randomUUID(),
      name,
      customerName: '',
      customerSource: source as any,
      paymentMethod: source === 'Cash' ? 'Cash' : source === 'Bizum' ? 'Bizum' : 'Other' as any,
      orderDate: completedAt.slice(0, 10),
      dueDate: '',
      totalPrice: revenue,
      printed: true,
      paid: true,
      sent: true,
      shippingDate: completedAt.slice(0, 10),
      notes: `Imported from legacy text`,
      prints: [],
      kanbanStatus: 'shipped',
      projectExpenses: [],
      completedAt,
      paidAt: completedAt,
    });
  }

  return { projects, expenses };
}
