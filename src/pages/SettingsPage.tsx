import { useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import posthog from "@/lib/posthog";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Wand2 } from "lucide-react";
import { ImportFromSpreadsheet } from "@/components/ImportFromSpreadsheet";
import { ImportFromAI } from "@/components/ImportFromAI";
import { useToast } from "@/hooks/useToast";
import type { Project } from "@/types";

const API_KEY_LS = 'pt_anthropic_key';

export default function SettingsPage() {
  const { settings, updateSettings, addProject } = useApp();
  const { t } = useTranslation();
  const toast = useToast();
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const storedKey = localStorage.getItem(API_KEY_LS);

  const handleBulkImport = (projects: Project[]) => {
    projects.forEach(p => addProject(p));
    posthog.capture('projects_bulk_imported', { count: projects.length, source: 'settings' });
  };

  const saveApiKey = () => {
    const trimmed = apiKeyInput.trim();
    if (!trimmed) return;
    localStorage.setItem(API_KEY_LS, trimmed);
    setApiKeyInput('');
    toast.success(t('importAI.keySaved'));
  };

  const update = (key: string, value: number) => {
    updateSettings({ ...settings, [key]: value });
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      posthog.capture('settings_updated', { setting_key: key, new_value: value });
    }, 1500);
  };

  return (
    <div className="space-y-6 w-full max-w-lg">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.importData')}</CardTitle>
          <CardDescription>{t('settings.importDataDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>{t('settings.aiApiKey')}</Label>
            {storedKey ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground flex-1">
                  {t('settings.aiApiKeySet')} ({storedKey.slice(0, 10)}…)
                </span>
                <Button size="sm" variant="outline" onClick={() => { localStorage.removeItem(API_KEY_LS); setApiKeyInput(''); window.location.reload(); }}>
                  {t('settings.aiApiKeyUpdate')}
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder={t('settings.aiApiKeyPlaceholder')}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                  className="text-sm"
                />
                <Button onClick={saveApiKey} disabled={!apiKeyInput.trim()}>{t('importAI.saveKey')}</Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">{t('settings.aiApiKeyDesc')}</p>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <Button variant="outline" onClick={() => setShowSpreadsheetImport(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-1" />{t('settings.importFromSpreadsheet')}
            </Button>
            <Button variant="outline" onClick={() => setShowAIImport(true)}>
              <Wand2 className="h-4 w-4 mr-1" />{t('settings.importFromAI')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ImportFromSpreadsheet
        open={showSpreadsheetImport}
        onClose={() => setShowSpreadsheetImport(false)}
        onImport={handleBulkImport}
      />
      <ImportFromAI
        open={showAIImport}
        onClose={() => setShowAIImport(false)}
        onImport={handleBulkImport}
      />
    </div>
  );
}
