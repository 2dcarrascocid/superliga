import { reactive, toRefs } from 'vue';

const state = reactive({
  visible: false,
  mode: 'alert', // 'alert' | 'confirm' | 'prompt'
  type: 'info', // 'info' | 'success' | 'error' | 'warning' | 'question'
  title: '',
  message: '',
  confirmText: 'Aceptar',
  cancelText: 'Cancelar',
  isDestructive: false,
  inputValue: '',
  inputType: 'text',
  inputPlaceholder: '',
  _resolve: null,
});

export const useNotifyStore = () => {
  const openModal = ({
    mode = 'alert',
    type = 'info',
    title = '',
    message = '',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    isDestructive = false,
    inputValue = '',
    inputType = 'text',
    inputPlaceholder = '',
  } = {}) => {
    // Si había una promesa pendiente previa, resolverla de forma segura
    if (state._resolve) {
      state._resolve(state.mode === 'prompt' ? null : false);
    }

    state.mode = mode;
    state.type = type;
    state.title = title;
    state.message = message;
    state.confirmText = confirmText;
    state.cancelText = cancelText;
    state.isDestructive = isDestructive;
    state.inputValue = inputValue != null ? String(inputValue) : '';
    state.inputType = inputType;
    state.inputPlaceholder = inputPlaceholder;
    state.visible = true;

    return new Promise((resolve) => {
      state._resolve = resolve;
    });
  };

  const notify = (messageOrOpts, opts = {}) => {
    if (typeof messageOrOpts === 'string') {
      return openModal({
        mode: 'alert',
        message: messageOrOpts,
        type: opts.type || 'info',
        title: opts.title || '',
        confirmText: opts.confirmText || 'Aceptar',
      });
    }
    return openModal({
      mode: 'alert',
      ...messageOrOpts,
    });
  };

  const notifySuccess = (message, title = '¡Listo!', opts = {}) =>
    notify(message, { type: 'success', title, ...opts });

  const notifyError = (message, title = 'Ocurrió un error', opts = {}) =>
    notify(message, { type: 'error', title, ...opts });

  const notifyWarning = (message, title = 'Advertencia', opts = {}) =>
    notify(message, { type: 'warning', title, ...opts });

  const notifyInfo = (message, title = 'Información', opts = {}) =>
    notify(message, { type: 'info', title, ...opts });

  const confirm = (messageOrOpts, opts = {}) => {
    if (typeof messageOrOpts === 'string') {
      return openModal({
        mode: 'confirm',
        type: opts.type || (opts.isDestructive ? 'warning' : 'question'),
        title: opts.title || '¿Estás seguro?',
        message: messageOrOpts,
        confirmText: opts.confirmText || (opts.isDestructive ? 'Eliminar' : 'Confirmar'),
        cancelText: opts.cancelText || 'Cancelar',
        isDestructive: opts.isDestructive ?? false,
      });
    }
    return openModal({
      mode: 'confirm',
      type: messageOrOpts.type || (messageOrOpts.isDestructive ? 'warning' : 'question'),
      title: messageOrOpts.title || '¿Estás seguro?',
      message: messageOrOpts.message || '',
      confirmText: messageOrOpts.confirmText || (messageOrOpts.isDestructive ? 'Eliminar' : 'Confirmar'),
      cancelText: messageOrOpts.cancelText || 'Cancelar',
      isDestructive: messageOrOpts.isDestructive ?? false,
    });
  };

  const prompt = (messageOrOpts, defaultValue = '', opts = {}) => {
    if (typeof messageOrOpts === 'string') {
      return openModal({
        mode: 'prompt',
        type: opts.type || 'info',
        title: opts.title || 'Ingresar valor',
        message: messageOrOpts,
        inputValue: defaultValue || opts.defaultValue || '',
        inputType: opts.inputType || 'text',
        inputPlaceholder: opts.placeholder || '',
        confirmText: opts.confirmText || 'Aceptar',
        cancelText: opts.cancelText || 'Cancelar',
      });
    }
    return openModal({
      mode: 'prompt',
      type: messageOrOpts.type || 'info',
      title: messageOrOpts.title || 'Ingresar valor',
      message: messageOrOpts.message || '',
      inputValue: messageOrOpts.defaultValue ?? defaultValue ?? '',
      inputType: messageOrOpts.inputType || 'text',
      inputPlaceholder: messageOrOpts.placeholder || '',
      confirmText: messageOrOpts.confirmText || 'Aceptar',
      cancelText: messageOrOpts.cancelText || 'Cancelar',
    });
  };

  const handleConfirm = () => {
    state.visible = false;
    if (state._resolve) {
      const res = state._resolve;
      state._resolve = null;
      if (state.mode === 'prompt') {
        res(state.inputValue);
      } else {
        res(true);
      }
    }
  };

  const handleCancel = () => {
    state.visible = false;
    if (state._resolve) {
      const res = state._resolve;
      state._resolve = null;
      if (state.mode === 'prompt') {
        res(null);
      } else {
        res(false);
      }
    }
  };

  const close = handleCancel;

  return {
    ...toRefs(state),
    state,
    notify,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    confirm,
    prompt,
    handleConfirm,
    handleCancel,
    close,
  };
};
