import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react';
import { AlertModal } from '@/components/ui/AlertSystem/AlertModal';
import { ToastContainer, type ToastContainerRef } from '@/components/ui/AlertSystem/ToastContainer';
import { LoadingOverlay } from '@/components/ui/AlertSystem/LoadingOverlay';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface AlertButton {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

export interface AlertConfig {
  type: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
  /** Auto-dismiss after N ms — best for success-only alerts */
  autoDismiss?: number;
  onDismiss?: () => void;
}

export interface ToastConfig {
  type: ToastType;
  message: string;
  duration?: number;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface AlertContextValue {
  /** Show a centered dialog. Clears previous alert. */
  alert: (config: AlertConfig) => void;
  /** Show a lightweight toast from the top. Stacks up to 3. */
  toast: (config: ToastConfig) => void;
  /** Show the branded loading overlay. */
  showLoading: (message?: string) => void;
  /** Hide the loading overlay. */
  hideLoading: () => void;
  /** Programmatically dismiss the current dialog. */
  dismiss: () => void;
}

const AlertContext = createContext<AlertContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [loadingVisible, setLoadingVisible] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState<string | undefined>();
  const toastRef = useRef<ToastContainerRef>(null);

  const alert = useCallback((config: AlertConfig) => {
    setAlertConfig(config);
    setAlertVisible(true);
  }, []);

  const toast = useCallback((config: ToastConfig) => {
    toastRef.current?.addToast(config);
  }, []);

  const showLoading = useCallback((message?: string) => {
    setLoadingMessage(message);
    setLoadingVisible(true);
  }, []);

  const hideLoading = useCallback(() => {
    setLoadingVisible(false);
  }, []);

  // Called by AlertModal after its dismiss animation completes
  const handleModalDismissed = useCallback(() => {
    setAlertVisible(false);
    alertConfig?.onDismiss?.();
    setTimeout(() => setAlertConfig(null), 50);
  }, [alertConfig]);

  const dismiss = useCallback(() => {
    // Signal the modal to animate out (it calls handleModalDismissed when done)
    setAlertVisible(false);
  }, []);

  return (
    <AlertContext.Provider value={{ alert, toast, showLoading, hideLoading, dismiss }}>
      {children}
      <ToastContainer ref={toastRef} />
      <AlertModal
        config={alertConfig}
        visible={alertVisible}
        onDismiss={handleModalDismissed}
      />
      <LoadingOverlay visible={loadingVisible} message={loadingMessage} />
    </AlertContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAlert(): AlertContextValue {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlert must be used inside <AlertProvider>');
  return ctx;
}
