import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, title, children }: ModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-backdrop z-50"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div 
              className="bg-bg-secondary border border-border rounded-xl max-w-md w-full shadow-2xl pointer-events-auto"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, type: 'spring', stiffness: 300, damping: 30 }}
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-bg-tertiary rounded-lg transition-colors text-text-secondary hover:text-text-primary"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="p-4">
                {children}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmButtonClass = variant === 'danger'
    ? 'bg-red-500 hover:bg-red-600'
    : variant === 'warning'
    ? 'bg-yellow-500 hover:bg-yellow-600 text-black'
    : 'bg-blue-500 hover:bg-blue-600';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-text-secondary mb-6">{message}</p>
      
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-bg-tertiary hover:bg-bg-active rounded-lg transition-colors text-text-secondary"
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          className={`px-4 py-2 ${confirmButtonClass} text-white rounded-lg transition-colors font-medium`}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}

interface ErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}

export function ErrorModal({
  isOpen,
  onClose,
  title = 'Error',
  message
}: ErrorModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <p className="text-text-secondary mb-6">{message}</p>
      
      <div className="flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-bg-tertiary hover:bg-bg-active rounded-lg transition-colors text-text-secondary"
        >
          OK
        </button>
      </div>
    </Modal>
  );
}
