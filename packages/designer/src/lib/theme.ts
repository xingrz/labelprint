import { computed, reactive, ref, watchEffect } from 'vue';

export type Theme = 'light' | 'dark';
export type ThemeChoice = 'auto' | Theme;

const themeChoices: ThemeChoice[] = ['auto', 'light', 'dark'];

function savedThemeChoice(): ThemeChoice {
  const v = typeof localStorage === 'undefined' ? null : localStorage.getItem('lp.theme');
  return themeChoices.includes(v as ThemeChoice) ? (v as ThemeChoice) : 'auto';
}

const systemDark = ref(false);

export const themeState = reactive({
  themeChoice: savedThemeChoice(),
});

export const currentTheme = computed<Theme>(() =>
  themeState.themeChoice === 'auto' ? (systemDark.value ? 'dark' : 'light') : themeState.themeChoice,
);

export function setThemeChoice(choice: ThemeChoice): void {
  themeState.themeChoice = choice;
  localStorage.setItem('lp.theme', choice);
}

export function syncDocumentTheme(): void {
  if (typeof window !== 'undefined') {
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark.value = query.matches;
    query.addEventListener('change', (e) => {
      systemDark.value = e.matches;
    });
  }
  watchEffect(() => {
    document.documentElement.dataset.theme = currentTheme.value;
    document.documentElement.style.colorScheme = currentTheme.value;
  });
}
