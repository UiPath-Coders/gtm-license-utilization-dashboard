import { AuthProvider } from "./hooks/useAuth";
import { AdminPortal } from "./components/admin/AdminPortal";
import { AccessGate } from "./components/admin/AccessGate";

// Deployed as its own, separately-authenticated Coded Web App — deliberately
// NOT bundled into the public-facing License Utilization Dashboard, so this
// page always requires a real UiPath login regardless of how the main
// dashboard is shared. Navigation back to the dashboard is a full same-tab
// browser navigation (different deployed app/origin), not in-app routing.
const DASHBOARD_URL =
  "https://uipathtechnicalaccountmanagementteam.uipath.host/license-utilization";

export default function App() {
  return (
    <AuthProvider>
      <AccessGate>
        <AdminPortal
          onBack={() => {
            window.location.href = DASHBOARD_URL;
          }}
        />
      </AccessGate>
    </AuthProvider>
  );
}
