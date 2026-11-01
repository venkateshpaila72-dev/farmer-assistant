import { Component } from "react";
import { useLocation } from "react-router-dom";
import { ServerCrash } from "lucide-react";

/**
 * Catches React rendering/runtime errors (thrown during render, lifecycle, or
 * event handlers that React re-throws). This is completely separate from API
 * errors — those are handled by each feature's own catch handler.
 *
 * Shows the same design tokens as the rest of the app so the fallback UI
 * feels native. Offers a simple "Reload page" button since rendering errors
 * are usually not recoverable without a fresh mount.
 */
class ErrorBoundaryInner extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, errorMessage: null };
    }

    static getDerivedStateFromError(err) {
        return {
            hasError: true,
            errorMessage: err?.message ?? "An unexpected error occurred.",
        };
    }

    componentDidCatch(err, info) {
        // Log to console in development so engineers can see the stack trace.
        // In production you could forward this to an error monitoring service.
        console.error("[ErrorBoundary] Uncaught rendering error:", err, info);
    }

    componentDidUpdate(prevProps) {
        if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
            this.setState({ hasError: false, errorMessage: null });
        }
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-bg flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 rounded-full bg-primary-tint text-primary flex items-center justify-center mb-5">
                        <ServerCrash size={28} />
                    </div>
                    <h1 className="font-display text-3xl font-bold text-ink">
                        Something went wrong
                    </h1>
                    <p className="text-ink-soft mt-2 max-w-sm">
                        The page crashed unexpectedly. Please reload to continue.
                    </p>
                    {this.state.errorMessage && (
                        <p className="mt-3 text-xs text-ink-soft font-mono max-w-sm truncate">
                            {this.state.errorMessage}
                        </p>
                    )}
                    <div className="mt-6 flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => window.location.reload()}
                            className="inline-flex items-center gap-2 rounded-sm bg-primary text-white px-5 py-2.5 text-sm font-semibold hover:bg-primary-dark transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px"
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            className="inline-flex items-center gap-2 rounded-sm bg-white border border-ink/10 text-ink px-5 py-2.5 text-sm font-semibold hover:bg-bg transition-all duration-200 ease-out-expo active:scale-[0.97] hover:-translate-y-px"
                        >
                            Go to home
                        </a>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export function ErrorBoundary({ children }) {
    const location = useLocation();
    return <ErrorBoundaryInner resetKey={location.pathname}>{children}</ErrorBoundaryInner>;
}

