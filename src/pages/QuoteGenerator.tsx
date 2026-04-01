import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { DollarSign, Clock, Weight, TrendingUp, Calculator } from "lucide-react";

/**
 * Time-based cost with diminishing returns:
 * - First 5 hours: full rate
 * - Next 10 hours: 70% rate
 * - Remaining hours: 40% rate
 */
function calculateTimeCost(hours: number, hourlyRate: number): number {
  if (hours <= 0) return 0;
  let cost = 0;
  const tier1 = Math.min(hours, 5);
  cost += tier1 * hourlyRate;
  const tier2 = Math.min(Math.max(hours - 5, 0), 10);
  cost += tier2 * hourlyRate * 0.7;
  const tier3 = Math.max(hours - 15, 0);
  cost += tier3 * hourlyRate * 0.4;
  return cost;
}

export default function QuoteGenerator() {
  const { settings } = useApp();
  const [grams, setGrams] = useState(0);
  const [hours, setHours] = useState(0);
  const [margin, setMargin] = useState(50);
  const [hourlyRate, setHourlyRate] = useState(2.5);

  const materialCost = grams * settings.filamentCostPerGram;
  const timeCost = calculateTimeCost(hours, hourlyRate);
  const totalCost = materialCost + timeCost;
  const suggestedPrice = margin < 100 ? totalCost / (1 - margin / 100) : totalCost;
  const profit = suggestedPrice - totalCost;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Calculator className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Quote Generator</h1>
          <p className="text-sm text-muted-foreground">Calculate pricing with time-based cost scaling</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Print Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Weight className="h-3.5 w-3.5 text-muted-foreground" />
                Material (grams)
              </Label>
              <Input
                type="number"
                placeholder="0"
                value={grams || ""}
                onChange={e => setGrams(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">€{settings.filamentCostPerGram.toFixed(4)}/g from settings</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Print Time (hours)
              </Label>
              <Input
                type="number"
                step="0.5"
                placeholder="0"
                value={hours || ""}
                onChange={e => setHours(parseFloat(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Tiered rate: 100% first 5h, 70% next 10h, 40% after</p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                Hourly Rate (€/h)
              </Label>
              <Input
                type="number"
                step="0.5"
                value={hourlyRate}
                onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                Profit Margin (%)
              </Label>
              <Input
                type="number"
                value={margin}
                onChange={e => setMargin(parseFloat(e.target.value) || 0)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="border-primary/30 bg-accent/10">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">Quote Result</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Material Cost</span>
                <span className="font-mono font-semibold">€{materialCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Time Cost</span>
                <span className="font-mono font-semibold">€{timeCost.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Total Cost</span>
                <span className="font-mono font-bold">€{totalCost.toFixed(2)}</span>
              </div>
            </div>

            <Separator />

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Suggested Price</span>
                <span className="font-mono font-bold text-2xl text-primary">
                  €{isFinite(suggestedPrice) && suggestedPrice >= 0 ? suggestedPrice.toFixed(2) : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Estimated Profit</span>
                <span className="font-mono font-semibold text-primary">
                  €{isFinite(profit) && profit >= 0 ? profit.toFixed(2) : "—"}
                </span>
              </div>
            </div>

            {hours > 0 && (
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">Time Cost Breakdown</p>
                <div className="text-xs space-y-0.5">
                  {hours > 0 && <p>First {Math.min(hours, 5).toFixed(1)}h × €{hourlyRate.toFixed(2)} = €{(Math.min(hours, 5) * hourlyRate).toFixed(2)}</p>}
                  {hours > 5 && <p>Next {Math.min(hours - 5, 10).toFixed(1)}h × €{(hourlyRate * 0.7).toFixed(2)} = €{(Math.min(hours - 5, 10) * hourlyRate * 0.7).toFixed(2)}</p>}
                  {hours > 15 && <p>Remaining {(hours - 15).toFixed(1)}h × €{(hourlyRate * 0.4).toFixed(2)} = €{((hours - 15) * hourlyRate * 0.4).toFixed(2)}</p>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
