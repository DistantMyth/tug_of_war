import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { useUiStore } from "../../store/useUiStore.js";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUiStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isError = toast.type === "error";
        const isWarning = toast.type === "warning";
        const isSuccess = toast.type === "success";

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 ${
              isError
                ? "bg-red-950/90 border-red-500/50 text-red-100"
                : isWarning
                  ? "bg-amber-950/90 border-amber-500/50 text-amber-100"
                  : isSuccess
                    ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-100"
                    : "bg-slate-900/90 border-slate-700/50 text-slate-100"
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isError && <AlertCircle className="w-5 h-5 text-red-400" />}
              {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400" />}
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              {!isError && !isWarning && !isSuccess && <Info className="w-5 h-5 text-cyan-400" />}
            </div>
            <div className="flex-1 text-sm">
              <div className="font-bold tracking-wide">{toast.title}</div>
              {toast.description && <div className="mt-0.5 text-xs opacity-80">{toast.description}</div>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="opacity-60 hover:opacity-100 transition-opacity p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
