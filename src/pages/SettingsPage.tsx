import { useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import posthog from "@/lib/posthog";
import { useTranslation } from "react-i18next";
import { FileSpreadsheet, Wand2, MessageSquare, Share2, Check, Zap, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { useTier } from "@/context/TierContext";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ImportFromSpreadsheet } from "@/components/ImportFromSpreadsheet";
import { ImportFromAI } from "@/components/ImportFromAI";
import { FeedbackModal } from "@/components/FeedbackModal";
import { UpgradeModal } from "@/components/UpgradeModal";
import { useToast } from "@/hooks/useToast";
import { CURRENCIES } from "@/types";
import type { Project } from "@/types";

const API_KEY_LS = 'pt_anthropic_key';

export default function SettingsPage() {
  const { settings, updateSettings, addProject } = useApp();
  const { t } = useTranslation();
  const { effectiveTier, trialDaysLeft, isTrialActive, trialExpired, trialStartedAt, isPro, isAdmin, adminPreviewFree, setAdminPreviewFree } = useTier();
  const toast = useToast();
  const captureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showSpreadsheetImport, setShowSpreadsheetImport] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
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

  const handleShare = () => {
    const msg = "I use PrintTrack to manage my 3D printing business — it's free! printrack.xyz";
    navigator.clipboard.writeText(msg).then(() => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2500);
    });
  };

  const update = (key: string, value: number) => {
    updateSettings({ ...settings, [key]: value });
    if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
    captureTimerRef.current = setTimeout(() => {
      posthog.capture('settings_updated', { setting_key: key, new_value: value });
    }, 1500);
  };

  const updateStr = (key: string, value: string) => {
    updateSettings({ ...settings, [key]: value });
  };

  return (
    <div className="space-y-6 w-full max-w-lg">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      {/* Subscription card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            {t('tier.settingsSubscriptionTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('tier.settingsCurrentPlan')}:</span>
            <Badge variant={effectiveTier === 'free' ? 'secondary' : 'default'}>
              {effectiveTier === 'free' ? t('tier.tierFree') :
               effectiveTier === 'pro_trial' ? t('tier.tierProTrial') :
               effectiveTier === 'pro' ? t('tier.tierPro') : t('tier.tierBusiness')}
            </Badge>
          </div>
          {isTrialActive && (
            <p className="text-sm text-muted-foreground">
              {t('tier.settingsTrialDaysLeft', { days: trialDaysLeft })}
              {trialStartedAt && (
                <> · {t('tier.settingsTrialEndsOn', { date: new Date(new Date(trialStartedAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString() })}</>
              )}
            </p>
          )}
          {trialExpired && (
            <p className="text-sm text-orange-600 dark:text-orange-400">{t('tier.trialEndedBanner')}</p>
          )}
          {(effectiveTier === 'free' || isTrialActive || trialExpired) && (
            <Button size="sm" asChild className="gap-1">
              <Link to="/pricing"><Zap className="h-3.5 w-3.5" />{t('tier.settingsUpgradeToPro')}</Link>
            </Button>
          )}
        </CardContent>
      </Card>

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
        <CardHeader><CardTitle className="text-base">{t('settings.invoiceSettings')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>{t('settings.businessName')}</Label>
            <Input
              value={settings.businessName || ''}
              onChange={e => updateStr('businessName', e.target.value)}
              placeholder={t('settings.businessNamePlaceholder')}
            />
          </div>
          <div>
            <Label>{t('settings.businessAddress')}</Label>
            <Textarea
              value={settings.businessAddress || ''}
              onChange={e => updateStr('businessAddress', e.target.value)}
              placeholder={t('settings.businessAddressPlaceholder')}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t('settings.invoicePrefix')}</Label>
              <Input
                value={settings.invoicePrefix || 'INV'}
                onChange={e => updateStr('invoicePrefix', e.target.value)}
                placeholder="INV"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('settings.invoicePrefixHint')}</p>
            </div>
            <div>
              <Label>{t('settings.currency')}</Label>
              <Select value={settings.currency || 'EUR'} onValueChange={v => updateStr('currency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => (
                    <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <Button variant="outline" onClick={() => { if (!isPro) { setShowUpgrade(true); return; } setShowSpreadsheetImport(true); }}>
              {!isPro ? <Zap className="h-4 w-4 mr-1" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}{t('settings.importFromSpreadsheet')}
            </Button>
            <Button variant="outline" onClick={() => { if (!isPro) { setShowUpgrade(true); return; } setShowAIImport(true); }}>
              {!isPro ? <Zap className="h-4 w-4 mr-1" /> : <Wand2 className="h-4 w-4 mr-1" />}{t('settings.importFromAI')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            {t('settings.shareTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleShare} className="gap-2">
            {shareCopied ? <Check className="h-4 w-4 text-green-600" /> : <Share2 className="h-4 w-4" />}
            {shareCopied ? t('settings.shareCopied') : t('settings.shareButton')}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('feedback.button')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setFeedbackOpen(true)} className="gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('feedback.title')}
          </Button>
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
      {isAdmin && (
        <Card className="border-dashed border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <ShieldCheck className="h-4 w-4" />
              Admin Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Preview as Free user</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {adminPreviewFree ? 'Showing Free tier view — feature gates active' : 'Showing Business tier view (your real access)'}
                </p>
              </div>
              <Switch checked={adminPreviewFree} onCheckedChange={setAdminPreviewFree} />
            </div>
          </CardContent>
        </Card>
      )}

      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <UpgradeModal open={showUpgrade} onClose={() => setShowUpgrade(false)} feature="excel_csv_import" />
    </div>
  );
}
