'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fr } from './i18n/fr';
import { en } from './i18n/en';
import { ar } from './i18n/ar';

const LanguageContext = createContext(null);
const translations = { fr, en, ar };
const SUPPORTED = Object.keys(translations);

function applyToDocument(lang) {
    const direction = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    document.documentElement.dir = direction;
    return direction;
}

export function LanguageProvider({ children }) {
    const [language, setLanguage] = useState('fr'); // Default to French

    // Hydrate the persisted language once on the client (server always renders 'fr')
    useEffect(() => {
        const saved = localStorage.getItem('portal-lang');
        const initial = SUPPORTED.includes(saved) ? saved : 'fr';
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLanguage(initial);
        applyToDocument(initial);
    }, []);

    const changeLanguage = useCallback((lang) => {
        if (!SUPPORTED.includes(lang)) return;
        setLanguage(lang);
        applyToDocument(lang);
        localStorage.setItem('portal-lang', lang);
    }, []);

    const value = useMemo(() => ({
        language,
        changeLanguage,
        t: translations[language] || translations.fr,
        dir: language === 'ar' ? 'rtl' : 'ltr',
    }), [language, changeLanguage]);

    return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
}
