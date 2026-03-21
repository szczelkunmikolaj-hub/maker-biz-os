import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();

  const update = (key: string, value: number) =>
    updateSettings({ ...settings, [key]: value });

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">Settings</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Material Pricing</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Filament Cost per Gram (€)</Label>
            <Input type="number" step="0.001" value={settings.filamentCostPerGram}
              onChange={e => update('filamentCostPerGram', parseFloat(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground mt-1">Default: €16/kg = €0.016 per gram</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Print Capacity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Number of Printers Available</Label>
            <Input type="number" min="1" step="1" value={settings.printerCount}
              onChange={e => update('printerCount', Math.max(1, parseInt(e.target.value) || 1))} />
            <p className="text-xs text-muted-foreground mt-1">Total queue time is divided by this number.</p>
          </div>
          <div>
            <Label>Buffer Between Prints (minutes)</Label>
            <Input type="number" min="0" step="5" value={settings.bufferMinutes}
              onChange={e => update('bufferMinutes', Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-muted-foreground mt-1">Cooldown / setup time added between consecutive prints.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workload Thresholds (hours)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Low → Moderate Threshold</Label>
            <Input type="number" min="1" value={settings.lowLoadThreshold}
              onChange={e => update('lowLoadThreshold', Math.max(1, parseInt(e.target.value) || 24))} />
            <p className="text-xs text-muted-foreground mt-1">Below this = Low Load (accept orders freely).</p>
          </div>
          <div>
            <Label>Moderate → High Threshold</Label>
            <Input type="number" min="1" value={settings.moderateLoadThreshold}
              onChange={e => update('moderateLoadThreshold', Math.max(1, parseInt(e.target.value) || 72))} />
            <p className="text-xs text-muted-foreground mt-1">Above this = High Load (avoid accepting orders).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
