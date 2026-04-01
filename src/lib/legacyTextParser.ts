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

function extractRevenue(line: string): number {
  // Match numbers before "euro" or "euros" or "€" or standalone numbers
  const euroMatch = line.match(/(\d+(?:[.,]\d+)?)\s*(?:euros?|€)/i);
  if (euroMatch) return parseFloat(euroMatch[1].replace(',', '.'));
  // Try standalone number
  const numMatch = line.match(/(\d+(?:[.,]\d+)?)/);
  return numMatch ? parseFloat(numMatch[1].replace(',', '.')) : 0;
}

function getMonthEndDate(month: number, referenceYear?: number): string {
  // Determine year: if month > current month, use previous year
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
    if (/^expenses?/i.test(line)) {
      inExpenses = true;
      continue;
    }

    if (currentMonth === null) continue;

    const completedAt = getMonthEndDate(currentMonth);

    // Handle expenses
    if (inExpenses) {
      const amount = extractRevenue(line);
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
