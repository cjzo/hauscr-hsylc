/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: 'var(--color-bg-primary)',
                surface: 'var(--color-bg-secondary)',
                surfaceHover: 'var(--color-bg-tertiary)',
                border: 'var(--color-border)',
                primary: 'var(--color-text-primary)',
                secondary: 'var(--color-text-secondary)',
                muted: 'var(--color-text-muted)',
                accent: 'var(--color-accent)',
                'accent-hover': 'var(--color-accent-hover)',
            },
            boxShadow: {
                'stripe': '0 2px 5px rgba(0, 0, 0, 0.04), 0 1px 1px rgba(0, 0, 0, 0.02)',
                'stripe-hover': '0 5px 15px rgba(0,0,0,0.08), 0 3px 6px rgba(0,0,0,0.04)',
                'stripe-focus': '0 0 0 2px #fff, 0 0 0 4px #635bff',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
            },
            transitionTimingFunction: {
                'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
            }
        },
    },
    plugins: [],
}
