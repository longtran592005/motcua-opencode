/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1320px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border) / <alpha-value>)',
        input: 'hsl(var(--input) / <alpha-value>)',
        ring: 'hsl(var(--ring) / <alpha-value>)',
        background: 'hsl(var(--background) / <alpha-value>)',
        foreground: 'hsl(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)',
          soft: 'hsl(var(--destructive-soft) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'hsl(var(--success) / <alpha-value>)',
          foreground: 'hsl(var(--success-foreground) / <alpha-value>)',
          soft: 'hsl(var(--success-soft) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
          foreground: 'hsl(var(--warning-foreground) / <alpha-value>)',
          soft: 'hsl(var(--warning-soft) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'hsl(var(--card) / <alpha-value>)',
          foreground: 'hsl(var(--card-foreground) / <alpha-value>)',
        },
        /* Thương hiệu Trường Đại học Thái Bình */
        brand: {
          DEFAULT: 'hsl(var(--brand) / <alpha-value>)',
          foreground: 'hsl(var(--brand-foreground) / <alpha-value>)',
          dark: 'hsl(var(--brand-dark) / <alpha-value>)',
          light: 'hsl(var(--brand-light) / <alpha-value>)',
          soft: 'hsl(var(--brand-soft) / <alpha-value>)',
          heading: 'hsl(var(--brand-heading) / <alpha-value>)',
        },
        surface: 'hsl(var(--surface) / <alpha-value>)',
        /* Bề mặt đậm thương hiệu: thanh trên, chatbot, sidebar, footer */
        topbar: {
          DEFAULT: 'hsl(var(--topbar) / <alpha-value>)',
          foreground: 'hsl(var(--topbar-foreground) / <alpha-value>)',
        },
        /* Hero: nền gradient đậm + chữ trắng */
        hero: {
          DEFAULT: 'hsl(var(--hero) / <alpha-value>)',
          2: 'hsl(var(--hero-2) / <alpha-value>)',
          foreground: 'hsl(var(--hero-foreground) / <alpha-value>)',
          muted: 'hsl(var(--hero-muted) / <alpha-value>)',
          card: 'hsl(var(--hero-card) / <alpha-value>)',
          'card-foreground': 'hsl(var(--hero-card-foreground) / <alpha-value>)',
        },
        /* Trạng thái hồ sơ */
        status: {
          draft: 'hsl(var(--status-draft) / <alpha-value>)',
          'draft-soft': 'hsl(var(--status-draft-soft) / <alpha-value>)',
          submitted: 'hsl(var(--status-submitted) / <alpha-value>)',
          'submitted-soft': 'hsl(var(--status-submitted-soft) / <alpha-value>)',
          pending: 'hsl(var(--status-pending) / <alpha-value>)',
          'pending-soft': 'hsl(var(--status-pending-soft) / <alpha-value>)',
          supplement: 'hsl(var(--status-supplement) / <alpha-value>)',
          'supplement-soft': 'hsl(var(--status-supplement-soft) / <alpha-value>)',
          rejected: 'hsl(var(--status-rejected) / <alpha-value>)',
          'rejected-soft': 'hsl(var(--status-rejected-soft) / <alpha-value>)',
          completed: 'hsl(var(--status-completed) / <alpha-value>)',
          'completed-soft': 'hsl(var(--status-completed-soft) / <alpha-value>)',
          cancelled: 'hsl(var(--status-cancelled) / <alpha-value>)',
          'cancelled-soft': 'hsl(var(--status-cancelled-soft) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'Roboto', 'system-ui', 'sans-serif'],
        serif: ['"Times New Roman"', 'Tinos', 'Times', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(11 60 111 / 0.06), 0 4px 16px -8px rgb(11 60 111 / 0.18)',
        brand: '0 8px 24px -12px hsl(var(--brand) / 0.6)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
