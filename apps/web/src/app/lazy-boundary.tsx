import { Component, type ErrorInfo, type ReactNode } from "react";

export class LazyBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("lazy_chunk_failed", { name: error.name, componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return (
      <section className="m-5 rounded-2xl border border-red-500/30 bg-card p-5 text-foreground">
        <p className="font-semibold">Не удалось загрузить раздел</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Сохранённая сессия не потеряется. Проверьте соединение и повторите загрузку.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 min-h-11 rounded-xl bg-primary px-4 font-semibold text-primary-foreground"
        >
          Повторить
        </button>
      </section>
    );
  }
}
