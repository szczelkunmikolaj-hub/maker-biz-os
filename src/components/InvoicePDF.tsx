import { useMemo } from 'react';
import {
  Document, Page, View, Text, StyleSheet, BlobProvider,
} from '@react-pdf/renderer';
import { Project, AppSettings, getCurrencySymbol, getProjectPiecesTotal, getProjectExpensesTotal } from '@/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ─── PDF STYLES ──────────────────────────────────────────────────────────────

const TEAL   = '#2d9e82';
const GRAY   = '#6b7280';
const LIGHT  = '#f9fafb';
const BORDER = '#e5e7eb';
const DARK   = '#111827';
const WHITE  = '#ffffff';

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingTop: 44,
    paddingBottom: 56,
    paddingLeft: 48,
    paddingRight: 48,
  },
  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  logoBox: { width: 44, height: 44, borderRadius: 10, backgroundColor: TEAL, alignItems: 'center', justifyContent: 'center' },
  logoInitials: { fontFamily: 'Helvetica-Bold', fontSize: 16, color: WHITE },
  businessName: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: TEAL, marginTop: 6 },
  businessAddress: { fontSize: 9, color: GRAY, marginTop: 2, lineHeight: 1.4 },
  invoiceTitle: { fontFamily: 'Helvetica-Bold', fontSize: 26, color: TEAL, textAlign: 'right' },
  invoiceNum: { fontSize: 10, color: GRAY, textAlign: 'right', marginTop: 4 },
  invoiceDate: { fontSize: 9, color: GRAY, textAlign: 'right', marginTop: 2 },
  // Divider
  divider: { borderBottomWidth: 1, borderBottomColor: BORDER, marginBottom: 20 },
  // Bill To
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  sectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GRAY, marginBottom: 4, letterSpacing: 0.8 },
  customerName: { fontFamily: 'Helvetica-Bold', fontSize: 13 },
  metaText: { fontSize: 9, color: GRAY, marginTop: 2 },
  dueDateValue: { fontFamily: 'Helvetica-Bold', fontSize: 11, textAlign: 'right' },
  // Project name
  projectLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GRAY, marginBottom: 4, letterSpacing: 0.8 },
  projectName: { fontFamily: 'Helvetica-Bold', fontSize: 12, marginBottom: 16 },
  // Table
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: TEAL,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  thText: { fontFamily: 'Helvetica-Bold', fontSize: 9, color: WHITE },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: LIGHT },
  tdText: { fontSize: 9 },
  // Column layout
  colDesc:  { flex: 3 },
  colMat:   { flex: 1.5, textAlign: 'center' },
  colQty:   { flex: 0.7, textAlign: 'center' },
  colUnit:  { flex: 1.5, textAlign: 'right' },
  colTotal: { flex: 1.5, textAlign: 'right' },
  // Expenses header
  expensesSectionLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GRAY, letterSpacing: 0.8, marginTop: 14, marginBottom: 6, paddingHorizontal: 8 },
  // Totals
  totalsBlock: { alignItems: 'flex-end', marginTop: 14 },
  subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4, width: 200 },
  subtotalLabel: { fontSize: 9, color: GRAY },
  subtotalValue: { fontSize: 9 },
  grandRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: TEAL, borderRadius: 4,
    paddingVertical: 8, paddingHorizontal: 14,
    marginTop: 6, width: 200,
  },
  grandLabel: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: WHITE },
  grandValue: { fontFamily: 'Helvetica-Bold', fontSize: 11, color: WHITE },
  // Notes
  notesBox: { marginTop: 24, borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10 },
  notesLabel: { fontFamily: 'Helvetica-Bold', fontSize: 8, color: GRAY, letterSpacing: 0.8, marginBottom: 4 },
  notesText: { fontSize: 9, color: GRAY, lineHeight: 1.5 },
  // Footer (fixed on every page)
  footer: {
    position: 'absolute', bottom: 24, left: 48, right: 48,
    borderTopWidth: 1, borderTopColor: BORDER,
    paddingTop: 7,
    flexDirection: 'row', justifyContent: 'space-between',
  },
  footerText: { fontSize: 8, color: GRAY },
});

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function formatDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  } catch { return iso; }
}

function buildInvoiceNumber(settings: AppSettings, project: Project): string {
  const prefix = settings.invoicePrefix || 'INV';
  const ym = (project.orderDate || new Date().toISOString().slice(0, 10)).slice(0, 7).replace('-', '');
  const id = project.id.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${prefix}-${ym}-${id}`;
}

function getInitials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || 'MB';
}

// ─── PDF DOCUMENT ─────────────────────────────────────────────────────────────

interface DocProps {
  project: Project;
  settings: AppSettings;
  invoiceNumber: string;
  sym: string;
}

function InvoicePDFDocument({ project: p, settings, invoiceNumber, sym }: DocProps) {
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  const piecesTotal = getProjectPiecesTotal(p);
  const effectiveTotal = piecesTotal > 0 ? piecesTotal : (p.totalPrice || 0);
  const expTotal = getProjectExpensesTotal(p);
  const bizName = settings.businessName || 'PrintTrack';
  const today = formatDate(new Date().toISOString().slice(0, 10));
  const dueFormatted = formatDate(p.dueDate || '');
  const initials = getInitials(bizName);

  return (
    <Document title={`${invoiceNumber}`} author={bizName}>
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <View style={s.logoBox}>
              <Text style={s.logoInitials}>{initials}</Text>
            </View>
            <Text style={s.businessName}>{bizName}</Text>
            {settings.businessAddress ? (
              <Text style={s.businessAddress}>{settings.businessAddress}</Text>
            ) : null}
          </View>
          <View>
            <Text style={s.invoiceTitle}>INVOICE</Text>
            <Text style={s.invoiceNum}>{invoiceNumber}</Text>
            <Text style={s.invoiceDate}>{today}</Text>
          </View>
        </View>

        <View style={s.divider} />

        {/* ── Bill To + Due Date ── */}
        <View style={s.billRow}>
          <View>
            <Text style={s.sectionLabel}>BILL TO</Text>
            <Text style={s.customerName}>{p.customerName || 'Customer'}</Text>
            {p.orderDate ? <Text style={s.metaText}>Order date: {p.orderDate}</Text> : null}
          </View>
          {dueFormatted ? (
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={s.sectionLabel}>DUE DATE</Text>
              <Text style={s.dueDateValue}>{dueFormatted}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Project name ── */}
        <Text style={s.projectLabel}>PROJECT</Text>
        <Text style={s.projectName}>{p.name || 'Unnamed Project'}</Text>

        {/* ── Print items table ── */}
        {p.prints.length > 0 && (
          <View>
            <View style={s.tableHeader}>
              <Text style={[s.thText, s.colDesc]}>Description</Text>
              <Text style={[s.thText, s.colMat]}>Material</Text>
              <Text style={[s.thText, s.colQty]}>Qty</Text>
              <Text style={[s.thText, s.colUnit]}>Unit Price</Text>
              <Text style={[s.thText, s.colTotal]}>Subtotal</Text>
            </View>
            {p.prints.map((pr, idx) => {
              const lineTotal = (pr.pricePerPiece || 0) * (pr.quantity || 1);
              return (
                <View key={pr.id} style={idx % 2 === 1 ? [s.tableRow, s.tableRowAlt] : s.tableRow}>
                  <Text style={[s.tdText, s.colDesc]}>{pr.name || `Item ${idx + 1}`}</Text>
                  <Text style={[s.tdText, s.colMat]}>{pr.material || '—'}</Text>
                  <Text style={[s.tdText, s.colQty]}>{pr.quantity || 1}</Text>
                  <Text style={[s.tdText, s.colUnit]}>{pr.pricePerPiece ? fmt(pr.pricePerPiece) : '—'}</Text>
                  <Text style={[s.tdText, s.colTotal]}>{lineTotal > 0 ? fmt(lineTotal) : '—'}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Project expenses ── */}
        {(p.projectExpenses || []).length > 0 && (
          <View>
            <Text style={s.expensesSectionLabel}>ADDITIONAL EXPENSES</Text>
            {p.projectExpenses.map((pe, idx) => (
              <View key={pe.id} style={idx % 2 === 0 ? s.tableRow : [s.tableRow, s.tableRowAlt]}>
                <Text style={[s.tdText, s.colDesc]}>{pe.name || 'Expense'}</Text>
                <Text style={[s.tdText, s.colMat]}>{pe.category}</Text>
                <Text style={[s.tdText, s.colQty]}>1</Text>
                <Text style={[s.tdText, s.colUnit]}>{fmt(pe.amount || 0)}</Text>
                <Text style={[s.tdText, s.colTotal]}>{fmt(pe.amount || 0)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Totals ── */}
        <View style={s.totalsBlock}>
          {expTotal > 0 && (
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>Items subtotal</Text>
              <Text style={s.subtotalValue}>{fmt(effectiveTotal - expTotal)}</Text>
            </View>
          )}
          {expTotal > 0 && (
            <View style={s.subtotalRow}>
              <Text style={s.subtotalLabel}>Expenses</Text>
              <Text style={s.subtotalValue}>{fmt(expTotal)}</Text>
            </View>
          )}
          <View style={s.grandRow}>
            <Text style={s.grandLabel}>TOTAL</Text>
            <Text style={s.grandValue}>{fmt(effectiveTotal)}</Text>
          </View>
        </View>

        {/* ── Notes ── */}
        {p.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>NOTES</Text>
            <Text style={s.notesText}>{p.notes}</Text>
          </View>
        ) : null}

        {/* ── Footer (fixed) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>{bizName}</Text>
          <Text style={s.footerText}>{invoiceNumber} · PrintTrack</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── MODAL ───────────────────────────────────────────────────────────────────

interface ModalProps {
  project: Project;
  settings: AppSettings;
  open: boolean;
  onClose: () => void;
}

export function InvoiceModal({ project, settings, open, onClose }: ModalProps) {
  const { t } = useTranslation();

  const sym = getCurrencySymbol(settings.currency);
  const invoiceNumber = useMemo(
    () => buildInvoiceNumber(settings, project),
    [project.id, project.orderDate, settings.invoicePrefix],
  );

  const pdfDoc = useMemo(
    () => (
      <InvoicePDFDocument
        project={project}
        settings={settings}
        invoiceNumber={invoiceNumber}
        sym={sym}
      />
    ),
    [project, settings, invoiceNumber, sym],
  );

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t('invoice.previewTitle')} — {invoiceNumber}</DialogTitle>
        </DialogHeader>

        {open && (
          <BlobProvider document={pdfDoc}>
            {({ url, loading, error }) => (
              <div className="flex flex-col gap-3 flex-1 min-h-0">
                {loading && (
                  <div className="h-[60vh] flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">{t('invoice.preparing')}</span>
                  </div>
                )}
                {error && (
                  <div className="h-[60vh] flex items-center justify-center text-destructive text-sm">
                    {t('common.somethingWentWrong')}
                  </div>
                )}
                {!loading && !error && url && (
                  <iframe
                    src={url}
                    className="w-full rounded-lg border bg-muted"
                    style={{ height: '60vh', minHeight: 400 }}
                    title="Invoice Preview"
                  />
                )}
                <div className="flex justify-end">
                  <Button asChild disabled={loading || !!error}>
                    <a href={url || '#'} download={`${invoiceNumber}.pdf`}>
                      <Download className="h-4 w-4 mr-1" />
                      {t('invoice.downloadBtn')}
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </BlobProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}
