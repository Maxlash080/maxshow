import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useLockBodyScroll } from '../utils/useLockBodyScroll';

const ModalContext = createContext({
  showConfirmModal: async () => false,
});

export const ModalProvider = ({ children }) => {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    icon: '⚠️',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'danger', // 'danger' | 'logout' | 'primary'
  });

  useLockBodyScroll(modalState.isOpen);

  const resolverRef = useRef(null);

  const showConfirmModal = useCallback(({
    title = 'Confirm Action',
    message = 'Are you sure you want to proceed?',
    icon = '⚠️',
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'danger',
  } = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title,
        message,
        icon,
        confirmText,
        cancelText,
        type,
      });
    });
  }, []);

  const handleClose = (result) => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  };

  return (
    <ModalContext.Provider value={{ showConfirmModal }}>
      {children}
      {modalState.isOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/75 backdrop-blur-sm p-4 flex items-center justify-center animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleClose(false);
          }}
        >
          <div className="relative w-full max-w-md rounded-[2.5rem] bg-white p-6 sm:p-8 shadow-2xl dark:bg-[#1c2733] border border-stone-200 dark:border-slate-700 text-center animate-in zoom-in-95 duration-150">
            <div
              className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl text-3xl shadow-sm ${
                modalState.type === 'danger'
                  ? 'bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                  : 'bg-coral/10 text-coral dark:bg-coral/20'
              }`}
            >
              <span>{modalState.icon}</span>
            </div>
            <h3 className="mt-5 text-xl sm:text-2xl font-black text-ink dark:text-white">{modalState.title}</h3>
            <p className="mt-2.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              {modalState.message}
            </p>
            <div className="mt-7 flex flex-col-reverse sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-stone-50 dark:border-slate-700 dark:bg-[#101820] dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {modalState.cancelText}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className={`w-full rounded-2xl px-5 py-3 text-sm font-bold text-white shadow-lg transition ${
                  modalState.type === 'danger'
                    ? 'bg-red-600 shadow-red-600/25 hover:bg-red-700'
                    : 'bg-coral shadow-coral/25 hover:bg-[#df503c]'
                }`}
              >
                {modalState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
};

export const useConfirmModal = () => useContext(ModalContext);
