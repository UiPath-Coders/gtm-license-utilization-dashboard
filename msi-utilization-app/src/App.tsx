import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { AuthProvider } from "./hooks/useAuth";
import { MsiUtilizationPage } from "./components/MsiUtilizationPage";

const DASHBOARD_URL =
  "https://uipathtechnicalaccountmanagementteam.uipath.host/license-utilization";

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; info: string }
> {
  state: { error: Error | null; info: string } = { error: null, info: "" };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack || "" });
    // eslint-disable-next-line no-console
    console.error("MSI Utilization Submission crashed:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <main className="portal">
          <div className="error-boundary">
            <h1>Something went wrong rendering this page</h1>
            <p>
              Copy the details below and share them so this can be fixed —
              this is exactly the information needed to diagnose it.
            </p>
            <pre>
              {this.state.error.name}: {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
              {this.state.info ? `\n\nComponent stack:${this.state.info}` : ""}
            </pre>
            <button onClick={() => window.location.reload()}>Reload</button>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MsiUtilizationPage
          onBack={() => {
            window.location.href = DASHBOARD_URL;
          }}
        />
      </AuthProvider>
    </ErrorBoundary>
  );
}
