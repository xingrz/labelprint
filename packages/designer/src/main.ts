import { createApp } from 'vue';
import App from './App.vue';
import { syncDocumentLocale } from './lib/i18n';
import { syncDocumentTheme } from './lib/theme';
import './style.css';

syncDocumentLocale();
syncDocumentTheme();

createApp(App).mount('#app');
