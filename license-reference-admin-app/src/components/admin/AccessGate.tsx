import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { decodeJwtEmail } from "../../lib/currentUser";

// Membership mirrors the "License Reference Administrators" UiPath group
// (Identity group e983f96a-a5dd-4dd8-a7b0-717a2194c376, tam_global/AMER_COE).
// Keep this list in sync with that group's members — it is NOT read from the
// group live, because doing so would require an additional Identity-read
// OAuth scope this app isn't provisioned with yet.
//
// IMPORTANT: this is a client-side UX gate only. The real, tamper-proof
// enforcement must be Data Fabric-level RBAC on the LicenseReference entity
// restricted to the same group — without that, a determined user could still
// call the Data Fabric write APIs directly. See the in-page security note.
const ALLOWED_ADMIN_EMAILS = [
  "hrishi.sarva@gmail.com",
  "logesh.velu@outlook.com",
  // mario: add his email here once he has signed into tam_global/AMER_COE and been added to the group
];

export function AccessGate({ children }: { children: React.ReactNode }) {
  const { sdk, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const token = sdk.getToken();
    if (token) setEmail(decodeJwtEmail(token));
  }, [isAuthenticated, sdk]);

  if (isLoading) {
    return <main className="portal admin-portal state">Signing you in…</main>;
  }

  if (!isAuthenticated) {
    return (
      <main className="portal admin-portal state">Authentication required.</main>
    );
  }

  const isAllowed = email != null && ALLOWED_ADMIN_EMAILS.includes(email);

  if (!isAllowed) {
    return (
      <main className="portal admin-portal">
        <div className="access-denied">
          <ShieldAlert size={32} />
          <h2>Access restricted</h2>
          <p>
            License Reference Administration is limited to a specific group of
            administrators. {email ? `Signed in as ${email}.` : ""} If you
            believe you should have access, ask an org admin to add you to the
            "License Reference Administrators" group.
          </p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
