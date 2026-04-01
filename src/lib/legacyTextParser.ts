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
  const matches = line.match(/\d+(?:[.,]\d+)?/g);
  if (!matches) return [];
  return matches.map(m => parseFloat(m.replace(',', '.'))).filter(n => n > 0);
}

function extractRevenue(line: string): number {
  const numbers = extractAllPositiveNumbers(line);
  return numbers.reduce((sum, n) => sum + n, 0);
}

function getMonthEndDate(month: number, year: number): string {
  const d = endOfMonth(new Date(year, month, 1));
  return d.toISOString();
}

/** Detect "Month: September 2025" or "September 2025" or just "September" */
function parseMonthHeader(line: string): { month: number; year: number | null } | null {
  // "Month: September 2025" format
  const headerMatch = line.match(/^month:\s*(\w+)\s*(\d{4})?\s*$/i);
  if (headerMatch) {
    const m = MONTHS[headerMatch[1].toLowerCase()];
    if (m !== undefined) return { month: m, year: headerMatch[2] ? parseInt(headerMatch[2]) : null };
  }
  // "September 2025" or just "September"
  const words = line.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().split(/\s+/);
  if (words.length <= 2) {
    const m = MONTHS[words[0]];
    if (m !== undefined) {
      const yr = words[1] ? parseInt(words[1]) : null;
      return { month: m, year: yr && yr > 2000 ? yr : null };
    }
  }
  return null;
}

function inferYear(month: number, explicitYear: number | null): number {
  if (explicitYear) return explicitYear;
  const now = new Date();
  return month > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
}

export function parseLegacyText(text: string): ParseResult {
  const lines = text.split('\n');
  const projects: Project[] = [];
  const expenses: Expense[] = [];

  let currentMonth: number | null = null;
  let currentYear: number | null = null;
  let inExpenses = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip "Total ..." summary lines to avoid double-counting
    if (/^total\s/i.test(line)) continue;

    // Detect month headers
    const monthInfo = parseMonthHeader(line);
    if (monthInfo) {
      currentMonth = monthInfo.month;
      currentYear = monthInfo.year;
      inExpenses = false;
      continue;
    }

    // Detect expenses section header
    if (/^expenses?:?\s*$/i.test(line)) {
      inExpenses = true;
      continue;
    }

    if (currentMonth === null) continue;

    const year = inferYear(currentMonth, currentYear);
    const completedAt = getMonthEndDate(currentMonth, year);
    const dateStr = completedAt.slice(0, 10);

    // Strip leading "- " for bullet-style lines
    const stripped = line.replace(/^-\s*/, '');

    // [x] = completed project → REVENUE
    if (/^\[x\]/i.test(stripped)) {
      inExpenses = false; // back to projects mode
      const content = stripped.replace(/^\[x\]\s*/i, '');
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
        orderDate: dateStr,
        dueDate: '',
        totalPrice: revenue,
        printed: true,
        paid: true,
        sent: true,
        shippingDate: dateStr,
        notes: 'Imported from legacy text',
        prints: [{
          id: crypto.randomUUID(),
          name: name,
          estimatedPrintTime: 0,
          materialUsed: 0,
          printer: '',
          status: 'completed' as const,
          quantity: 1,
          completedQuantity: 1,
          color: '',
          material: '',
          pricePerPiece: revenue,
        }],
        kanbanStatus: 'shipped',
        projectExpenses: [],
        completedAt,
        paidAt: completedAt,
      });
      continue;
    }

    // [ ] = expense (NEW: [ ] is now treated as expense, not ignored)
    if (/^\[\s?\]/.test(stripped)) {
      const content = stripped.replace(/^\[\s?\]\s*/, '');
      const amount = extractRevenue(content);
      if (amount > 0) {
        const name = content.replace(/(\d+(?:[.,]\d+)?)\s*(?:euros?|€)?/gi, '').replace(/[-–:+]/g, '').trim() || 'Expense';
        expenses.push({
          id: crypto.randomUUID(),
          date: dateStr,
          name,
          category: 'Other',
          amount,
          notes: 'Imported from legacy text',
        });
      }
      continue;
    }

    // Lines inside "Expenses:" section (no checkbox) → also expense
    if (inExpenses) {
      const amount = extractRevenue(line);
      if (amount > 0) {
        const name = line.replace(/(\d+(?:[.,]\d+)?)\s*(?:euros?|€)?/gi, '').replace(/[-–:+]/g, '').trim() || 'Expense';
        expenses.push({
          id: crypto.randomUUID(),
          date: dateStr,
          name,
          category: 'Other',
          amount,
          notes: 'Imported from legacy text',
        });
      }
    }
  }

  return { projects, expenses };
}
