import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function QuoteGenerator() {
  const { settings } = useApp();
  const [grams, setGrams] = useState(0);
  const [hours, setHours] = useState(0);
  const [margin, setMargin] = useState(50);

  const materialCost = grams * settings.filamentCostPerGram;
  const suggestedPrice = materialCost / (1 - margin / 100);

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Quote Generator</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Input</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label>Estimated Grams</Label>
            <Input type="number" value={grams || ""} onChange={e => setGrams(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Estimated Print Hours</Label>
            <Input type="number" step="0.1" value={hours || ""} onChange={e => setHours(parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <Label>Desired Profit Margin (%)</Label>
            <Input type="number" value={margin} onChange={e => setMargin(parseFloat(e.target.value) || 0)} />
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/30 bg-accent/30">
        <CardHeader><CardTitle className="text-base">Quote Result</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Material Cost</span>
            <span className="font-mono font-bold">€{materialCost.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Print Time</span>
            <span className="font-mono">{hours}h</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="font-semibold">Suggested Price</span>
            <span className="font-mono font-bold text-lg text-primary">€{isFinite(suggestedPrice) ? suggestedPrice.toFixed(2) : "—"}</span>
          </div>
          <p className="text-xs text-muted-foreground">Using €{settings.filamentCostPerGram.toFixed(4)}/gram from settings</p>
        </CardContent>
      </Card>
    </div>
  );
}
