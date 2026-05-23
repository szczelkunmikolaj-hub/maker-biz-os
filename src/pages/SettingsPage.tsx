import { useRef } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import posthog from "@/lib/posthog";
import { useTranslation } from "react-i18next";

export default function SettingsPage() {
  const { settings, updateSettings } = useApp();
  const { t } = useTranslation();
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (key: string, value: number) => {
    updateSettings({ ...settings, [key]: value });
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      posthog.capture('settings_updated', { setting_key: key, new_value: value });
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.materialPricing')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('settings.filamentCostPerGram')}</Label>
            <Input type="number" step="0.001" value={settings.filamentCostPerGram}
              onChange={e => update('filamentCostPerGram', parseFloat(e.target.value) || 0)} />
            <p className="text-xs text-muted-foreground mt-1">{t('settings.filamentCostDefault')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.printCapacity')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('settings.printerCount')}</Label>
            <Input type="number" min="1" step="1" value={settings.printerCount}
              onChange={e => update('printerCount', Math.max(1, parseInt(e.target.value) || 1))} />
            <p className="text-xs text-muted-foreground mt-1">{t('settings.printerCountDesc')}</p>
          </div>
          <div>
            <Label>{t('settings.bufferMinutes')}</Label>
            <Input type="number" min="0" step="5" value={settings.bufferMinutes}
              onChange={e => update('bufferMinutes', Math.max(0, parseInt(e.target.value) || 0))} />
            <p className="text-xs text-muted-foreground mt-1">{t('settings.bufferMinutesDesc')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('settings.workloadThresholds')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('settings.lowModerateThreshold')}</Label>
            <Input type="number" min="1" value={settings.lowLoadThreshold}
              onChange={e => update('lowLoadThreshold', Math.max(1, parseInt(e.target.value) || 24))} />
            <p className="text-xs text-muted-foreground mt-1">{t('settings.lowModerateDesc')}</p>
          </div>
          <div>
            <Label>{t('settings.moderateHighThreshold')}</Label>
            <Input type="number" min="1" value={settings.moderateLoadThreshold}
              onChange={e => update('moderateLoadThreshold', Math.max(1, parseInt(e.target.value) || 72))} />
            <p className="text-xs text-muted-foreground mt-1">{t('settings.moderateHighDesc')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
