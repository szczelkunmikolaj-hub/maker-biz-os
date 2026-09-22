import { useRef, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import { getProjectBalance, getProjectPiecesTotal, getCurrencySymbol, type Project, type Payment } from "@/types";
import { appToast } from "@/hooks/useToast";

export function useMarkAsPaid() {
  const { projects, updateProject, settings } = useApp();
  const currency = getCurrencySymbol(settings.currency);
  const projectsRef = useRef(projects);

  useEffect(() => {
    projectsRef.current = projects;
  }, [projects]);

  return useCallback((project: Project) => {
    const balance = getProjectBalance(project);
    if (balance <= 0) return;

    const paymentId = crypto.randomUUID();
    const payment: Payment = {
      id: paymentId,
      amount: balance,
      date: new Date().toISOString().split('T')[0],
      method: project.paymentMethod || 'Other',
    };

    updateProject({ ...project, payments: [...(project.payments || []), payment] });

    appToast.success(`Marked as paid · ${currency}${balance.toFixed(2)}`, {
      duration: 6000,
      action: {
        label: 'Undo',
        onClick: () => {
          const latest = projectsRef.current.find(p => p.id === project.id);
          if (!latest) return;
          updateProject({ ...latest, payments: (latest.payments || []).filter(p => p.id !== paymentId) });
        },
      },
    });
  }, [currency, updateProject]);
}
