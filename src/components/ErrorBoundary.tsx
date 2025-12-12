"use client";

import { Component, ReactNode } from "react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-4 bg-red-900 text-white font-mono rounded overflow-auto h-full">
                    <h1>Something went wrong.</h1>
                    <pre className="mt-2 text-sm">{this.state.error?.message}</pre>
                    <pre className="mt-1 text-xs opacity-75">{this.state.error?.stack}</pre>
                </div>
            );
        }

        return this.props.children;
    }
}
