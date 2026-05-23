import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

const EXTERNAL_URL = 'https://prints-barcelona-pro.lovable.app/admin-orders';

export default function CustomerOrdersPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // Open the external admin panel in the same tab and go back to dashboard.
    // AdminRoute already ensures only the admin email can reach this component.
    window.location.href = EXTERNAL_URL;
  }, [navigate]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}
