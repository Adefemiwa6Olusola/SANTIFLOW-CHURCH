import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../../store/appStore';

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

export default function ToastContainer() {
  const toasts = useAppStore(s => s.toasts);
  const removeToast = useAppStore(s => s.removeToast);

  return (
    <div className="toast-container">
      <AnimatePresence>
        {toasts.map(toast => (
          <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function Toast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  return (
    <motion.div
      className={`toast toast-${toast.type || 'info'}`}
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      onClick={onDismiss}
      style={{ cursor: 'pointer' }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{icons[toast.type] || icons.info}</span>
      <div style={{ flex: 1 }}>
        {toast.title && <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: '2px' }}>{toast.title}</div>}
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{toast.message}</div>
      </div>
    </motion.div>
  );
}
