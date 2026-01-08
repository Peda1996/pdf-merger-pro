// PDF Merger Pro - Internationalization Module

const i18n = {
    currentLang: 'en',
    translations: {},
    supportedLanguages: ['en', 'de', 'fr', 'es', 'it', 'pt'],

    async init() {
        // Load all translations
        await this.loadAllTranslations();

        const stored = localStorage.getItem('app-language');
        const browser = navigator.language.split('-')[0];
        this.currentLang = (stored && this.translations[stored]) ? stored : (this.translations[browser] ? browser : 'en');
        this.apply();
    },

    async loadAllTranslations() {
        const loadPromises = this.supportedLanguages.map(async (lang) => {
            try {
                const response = await fetch(`locales/${lang}.json`);
                if (response.ok) {
                    this.translations[lang] = await response.json();
                }
            } catch (e) {
                console.warn(`Could not load locale: ${lang}`, e);
            }
        });
        await Promise.all(loadPromises);
    },

    set(lang) {
        if(this.translations[lang]) {
            this.currentLang = lang;
            localStorage.setItem('app-language', lang);
            this.apply();
        }
    },

    t(key) {
        const keys = key.split('.');
        let val = this.translations[this.currentLang];
        for(const k of keys) val = val ? val[k] : key;
        return val || key;
    },

    apply() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const text = this.t(el.dataset.i18n);
            if (text) el.textContent = text;
        });
        const langSelect = document.getElementById('langSelect');
        if (langSelect) langSelect.value = this.currentLang;
    }
};
