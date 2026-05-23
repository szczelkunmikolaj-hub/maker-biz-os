import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTranslation } from "react-i18next";
import { MessageSquare } from "lucide-react";

// Contact info stored as char codes — not a plain-text string
const rc = (n: number[]) => n.map(c => String.fromCharCode(c)).join('');

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const { t } = useTranslation();
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');

  const typeLabels: Record<string, string> = {
    bug: t('feedback.bug'),
    feature: t('feedback.feature'),
    general: t('feedback.general'),
  };

  const handleSend = () => {
    const addr = rc([115,122,99,122,101,108,107,117,110,109,105,107,111,108,97,106,64,103,109,97,105,108,46,99,111,109]);
    const subject = encodeURIComponent(`[PrintTrack Feedback] ${typeLabels[type] ?? type}`);
    const body = encodeURIComponent(message);
    window.open(`mailto:${addr}?subject=${subject}&body=${body}`, '_blank');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            {t('feedback.title')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label>{t('feedback.type')}</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">{t('feedback.bug')}</SelectItem>
                <SelectItem value="feature">{t('feedback.feature')}</SelectItem>
                <SelectItem value="general">{t('feedback.general')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('feedback.messagePlaceholder')}
              rows={5}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={handleSend} disabled={!message.trim()}>
            {t('feedback.send')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
