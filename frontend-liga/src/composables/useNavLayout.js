import { ref, watch } from 'vue';

const STORAGE_KEY = 'superligas_nav_layout';

// 'top' | 'sidebar'
const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
const navLayout = ref(stored === 'sidebar' ? 'sidebar' : 'top');

function applyLayoutAttr(layout) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-nav-layout', layout);
}

// Aplicar al inicio
applyLayoutAttr(navLayout.value);

watch(navLayout, (val) => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, val);
  }
  applyLayoutAttr(val);
});

export function useNavLayout() {
  const toggleNavLayout = () => {
    navLayout.value = navLayout.value === 'top' ? 'sidebar' : 'top';
  };

  const setNavLayout = (layout) => {
    if (layout === 'top' || layout === 'sidebar') {
      navLayout.value = layout;
    }
  };

  return {
    navLayout,
    toggleNavLayout,
    setNavLayout,
  };
}
