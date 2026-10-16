/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1320px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
          soft: 'hsl(var(--destructive-soft))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        /* Thương hiệu Trường Đại học Thái Bình */
        brand: {
          DEFAULT: 'hsl(var(--brand))',
          foreground: 'hsl(var(--brand-foreground))',
          dark: 'hsl(var(--brand-dark))',
          light: 'hsl(var(--brand-light))',
          soft: 'hsl(var(--brand-soft))',
          heading: 'hsl(var(--brand-heading))',
        },
        surface: 'hsl(var(--surface))',
        /* Trạng thái hồ sơ */
        status: {
          draft: 'hsl(var(--status-draft))',
          'draft-soft': 'hsl(var(--status-draft-soft))',
          submitted: 'hsl(var(--status-submitted))',
          'submitted-soft': 'hsl(var(--status-submitted-soft))',
          pending: 'hsl(var(--status-pending))',
          'pending-soft': 'hsl(var(--status-pending-soft))',
          supplement: 'hsl(var(--status-supplement))',
          'supplement-soft': 'hsl(var(--status-supplement-soft))',
          rejected: 'hsl(var(--status-rejected))',
          'rejected-soft': 'hsl(var(--status-rejected-soft))',
          completed: 'hsl(var(--status-completed))',
          'completed-soft': 'hsl(var(--status-completed-soft))',
          cancelled: 'hsl(var(--status-cancelled))',
          'cancelled-soft': 'hsl(var(--status-cancelled-soft))',
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
