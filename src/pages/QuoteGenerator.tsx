import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import posthog from "@/lib/posthog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { DollarSign, Clock, Weight, TrendingUp, Calculator, Zap, User, FolderPlus, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Project, Print } from "@/types";

export default function QuoteGenerator({ isPublic = false }: { isPublic?: boolean }) {
  const { settings, filamentPurchases, addProject } = useApp();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [grams, setGrams] = useState(100);
  const [filamentCostKg, setFilamentCostKg] = useState(20);
  const [hours, setHours] = useState(2);
  const [electricityRate, setElectricityRate] = useState(0.10);
  const [labourRate, setLabourRate] = useState(0);
  const [margin, setMargin] = useState(20);

  // For logged-in users, sync filament cost from settings on first load
  useEffect(() => {
    if (!isPublic && settings.filamentCostPerGram > 0) {
      setFilamentCostKg(Math.round(settings.filamentCostPerGram * 1000 * 100) / 100);
    }
  }, [settings.filamentCostPerGram, isPublic]);

  const avgFilamentCostFromPurchases = (() => {
    if (!filamentPurchases || filamentPurchases.length === 0) return null;
    const totalGrams = filamentPurchases.reduce((s, fp) => s + (fp.spoolWeight || 0) * (fp.numberOfSpools || 1), 0);
    const totalCost = filamentPurchases.reduce((s, fp) => s + (fp.totalCost || 0), 0);
    if (totalGrams === 0) return null;
    return (totalCost / totalGrams) * 1000; // cost per kg
  })();

  const applyMyFilamentCost = () => {
    if (avgFilamentCostFromPurchases) {
      setFilamentCostKg(Math.round(avgFilamentCostFromPurchases * 100) / 100);
      toast({ title: "Filament cost updated", description: `Set to €${(avgFilamentCostFromPurchases).toFixed(2)}/kg from your purchases.` });
    }
  };

  const saveAsProject = () => {
    if (!isFinite(suggestedPrice) || suggestedPrice <= 0) return;
    const print: Print = {
      id: crypto.randomUUID(),
      name: "Print",
      estimatedPrintTime: hours,
      materialUsed: grams,
      printer: "",
      status: "not-printed",
      quantity: 1,
      completedQuantity: 0,
      color: "",
      material: "",
      pricePerPiece: parseFloat(suggestedPrice.toFixed(2)),
    };
    const project: Project = {
      id: crypto.randomUUID(),
      name: `Quote — ${grams}g · ${hours}h`,
      customerName: "",
      customerSource: "Other",
      paymentMethod: "Other",
      orderDate: new Date().toISOString().split("T")[0],
      dueDate: "",
      totalPrice: parseFloat(suggestedPrice.toFixed(2)),
      printed: false,
      paid: false,
      sent: false,
      shippingDate: "",
      notes: `Filament: €${filamentCostKg}/kg · Electricity: €${electricityRate}/kWh · Labour: €${labourRate}/h · Margin: ${margin}%`,
      prints: [print],
      kanbanStatus: "new-order",
      projectExpenses: [],
    };
    addProject(project);
    posthog.capture('quote_saved_as_project', { suggested_price: suggestedPrice });
    toast({ title: "Project created", description: `"${project.name}" saved. Tap to open it.` });
    navigate(`/projects?id=${project.id}`);
  };

  const filamentCostPerGram = filamentCostKg / 1000;
  const materialCost = grams * filamentCostPerGram;
  const electricityCost = hours * electricityRate;
  const labourCost = hours * labourRate;
  const totalCost = materialCost + electricityCost + labourCost;
  const suggestedPrice = margin < 100 ? totalCost / (1 - margin / 100) : totalCost;
  const profit = suggestedPrice - totalCost;
  const profitMarginActual = suggestedPrice > 0 ? (profit / suggestedPrice * 100) : 0;

  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isFinite(suggestedPrice) || suggestedPrice <= 0) return;
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      posthog.capture('quote_calculated', {
        grams,
        hours,
        filament_cost_kg: filamentCostKg,
        electricity_rate: electricityRate,
        labour_rate: labourRate,
        margin_percent: margin,
        suggested_price: parseFloat(suggestedPrice.toFixed(2)),
        total_cost: parseFloat(totalCost.toFixed(2)),
        is_public: isPublic,
      });
    }, 2000);
    return () => { if (captureTimerRef.current) clearTimeout(captureTimerRef.current); };
  }, [grams, hours, filamentCostKg, electricityRate, labourRate, margin, suggestedPrice, totalCost, isPublic]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('quote.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('quote.description')}</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t('quote.printParameters')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.material')}
              </Label>
              <Input
                type="number"
                min="0"
                placeholder="100"
                value={grams || ""}
                onChange={e => setGrams(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.filamentCostKg')}
              </Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={filamentCostKg || ""}
                  onChange={e => setFilamentCostKg(parseFloat(e.target.value) || 0)}
                  className="flex-1"
                />
                {!isPublic && avgFilamentCostFromPurchases && (
                  <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={applyMyFilamentCost} title={`Avg cost from your purchases: €${avgFilamentCostFromPurchases.toFixed(2)}/kg`}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1" />My cost
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.printTime')}
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                placeholder="2"
                value={hours || ""}
                onChange={e => setHours(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.electricityRate')}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={electricityRate || ""}
                onChange={e => setElectricityRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.labourRate')}
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={labourRate || ""}
                onChange={e => setLabourRate(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">{t('quote.labourRateHint')}</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                {t('quote.profitMargin')}
              </Label>
              <Input
                type="number"
                min="0"
                max="99"
                value={margin}
                onChange={e => setMargin(parseFloat(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="border-primary/30 bg-accent/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">{t('quote.quoteResult')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('quote.materialCost')}</span>
                <span className="font-mono font-semibold">€{materialCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('quote.electricityCost')}</span>
                <span className="font-mono font-semibold">€{electricityCost.toFixed(2)}</span>
              </div>
              {labourRate > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">{t('quote.labourCost')}</span>
                  <span className="font-mono font-semibold">€{labourCost.toFixed(2)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{t('quote.totalCost')}</span>
                <span className="font-mono font-bold">€{totalCost.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{t('quote.suggestedPrice')}</span>
                <span className="font-mono font-bold text-2xl text-primary">
                  €{isFinite(suggestedPrice) && suggestedPrice >= 0 ? suggestedPrice.toFixed(2) : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('quote.estimatedProfit')}</span>
                <span className="font-mono font-semibold text-primary">
                  €{isFinite(profit) && profit >= 0 ? profit.toFixed(2) : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('quote.profitMargin')}</span>
                <span className="font-mono font-semibold text-primary">
                  {isFinite(profitMarginActual) ? profitMarginActual.toFixed(1) : "—"}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isPublic && isFinite(suggestedPrice) && suggestedPrice > 0 && (
        <div className="flex justify-end">
          <Button onClick={saveAsProject} className="gap-2">
            <FolderPlus className="h-4 w-4" />Save as project
          </Button>
        </div>
      )}

      {isPublic && (
        <Card className="border-primary/40 bg-primary/5">
          <CardContent className="py-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('quote.ctaDesc')}
            </p>
            <Button asChild size="lg">
              <Link to="/auth?mode=signup">{t('quote.signUpCta')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
