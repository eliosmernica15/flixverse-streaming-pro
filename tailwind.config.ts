import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			screens: {
				xs: '480px',
				'3xl': '1920px',
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
			sidebar: {
				DEFAULT: 'hsl(var(--sidebar-background))',
				foreground: 'hsl(var(--sidebar-foreground))',
				primary: 'hsl(var(--sidebar-primary))',
				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
				accent: 'hsl(var(--sidebar-accent))',
				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
				border: 'hsl(var(--sidebar-border))',
				ring: 'hsl(var(--sidebar-ring))'
			},
			brand: {
				DEFAULT: 'hsl(var(--brand))',
				foreground: 'hsl(var(--brand-foreground))'
			},
			gold: 'hsl(var(--gold))',
			'cinema-red': 'hsl(var(--cinema-red))',
			'neon-purple': 'hsl(var(--neon-purple))',
			'neon-blue': 'hsl(var(--neon-blue))',
			surface: {
				0: 'hsl(var(--surface-0))',
				1: 'hsl(var(--surface-1))',
				2: 'hsl(var(--surface-2))',
				3: 'hsl(var(--surface-3))'
			}
		},
		boxShadow: {
			'elevated': 'var(--surface-elevated-shadow)',
			'pop': 'var(--surface-pop-shadow)',
			'glow': '0 0 0 1px rgba(239,68,68,0.4), 0 0 24px rgba(239,68,68,0.18)'
		},
		transitionTimingFunction: {
			'premium': 'var(--ease-premium)',
			'out-expo': 'var(--ease-out-expo)',
			'ease': 'cubic-bezier(0.16,1,0.3,1)'
		},
		borderRadius: {
			lg: 'var(--radius)',
			md: 'calc(var(--radius) - 2px)',
			sm: 'calc(var(--radius) - 4px)'
		},
		keyframes: {
			'accordion-down': {
				from: {
					height: '0'
				},
				to: {
					height: 'var(--radix-accordion-content-height)'
				}
			},
			'accordion-up': {
				from: {
					height: 'var(--radix-accordion-content-height)'
				},
				to: {
					height: '0'
				}
			},
			'fade-in': {
				from: { opacity: '0' },
				to: { opacity: '1' }
			},
			'fade-in-up': {
				from: { opacity: '0', transform: 'translateY(30px) scale(0.98)' },
				to: { opacity: '1', transform: 'translateY(0) scale(1)' }
			},
			'slide-up': {
				from: { opacity: '0', transform: 'translateY(40px)' },
				to: { opacity: '1', transform: 'translateY(0)' }
			},
			'scale-in': {
				from: { opacity: '0', transform: 'scale(0.92)' },
				to: { opacity: '1', transform: 'scale(1)' }
			},
			'shimmer': {
				from: { backgroundPosition: '-200% 0' },
				to: { backgroundPosition: '200% 0' }
			},
			'ken-burns': {
				from: { transform: 'scale(1.06)' },
				to: { transform: 'scale(1)' }
			},
			'glow-pulse': {
				'0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)' },
				'50%': { boxShadow: '0 0 40px 10px rgba(239,68,68,0.15)' }
			},
			'gradient-shift': {
				'0%': { backgroundPosition: '0% 50%' },
				'50%': { backgroundPosition: '100% 50%' },
				'100%': { backgroundPosition: '0% 50%' }
			},
			'float': {
				'0%, 100%': { transform: 'translateY(0px)' },
				'50%': { transform: 'translateY(-12px)' }
			},
			'pulse-glow': {
				'0%, 100%': { boxShadow: '0 0 0 0 rgba(239,68,68,0)', opacity: '1' },
				'50%': { boxShadow: '0 0 30px 6px rgba(239,68,68,0.25)', opacity: '0.85' }
			},
			'spin-slow': {
				to: { transform: 'rotate(360deg)' }
			},
			'pop-in': {
				'0%': { opacity: '0', transform: 'scale(0.9)' },
				'60%': { opacity: '1', transform: 'scale(1.02)' },
				'100%': { opacity: '1', transform: 'scale(1)' }
			},
			'slide-in-left': {
				from: { opacity: '0', transform: 'translateX(-20px)' },
				to: { opacity: '1', transform: 'translateX(0)' }
			},
			'slide-in-right-soft': {
				from: { opacity: '0', transform: 'translateX(20px)' },
				to: { opacity: '1', transform: 'translateX(0)' }
			},
			'letter-fade': {
				from: { opacity: '0', transform: 'translateY(8px)' },
				to: { opacity: '1', transform: 'translateY(0)' }
			},
			'netflix-card-in': {
				from: { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
				to: { opacity: '1', transform: 'translateY(0) scale(1)' }
			},
			'badge-pulse': {
				'0%, 100%': { transform: 'scale(1)', opacity: '1' },
				'50%': { transform: 'scale(1.06)', opacity: '0.92' }
			},
			'shimmer-fast': {
				'0%': { backgroundPosition: '-200% 0' },
				'100%': { backgroundPosition: '200% 0' }
			}
		},
		animation: {
			'accordion-down': 'accordion-down 0.2s ease-out',
			'accordion-up': 'accordion-up 0.2s ease-out',
			'fade-in-up': 'fade-in-up 0.7s var(--ease-premium) forwards',
			'scale-in': 'scale-in 0.5s var(--ease-premium) forwards',
			'shimmer': 'shimmer 2s linear infinite',
			'ken-burns': 'ken-burns 18s ease-out forwards',
			'fade-in': 'fade-in 0.6s ease-out forwards',
			'slide-up': 'slide-up 0.8s var(--ease-premium) forwards',
			'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
			'gradient-shift': 'gradient-shift 8s ease infinite',
			'float': 'float 6s ease-in-out infinite',
			'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
			'spin-slow': 'spin-slow 3s linear infinite',
			'pop-in': 'pop-in 0.45s var(--ease-premium) forwards',
			'slide-in-left': 'slide-in-left 0.7s var(--ease-premium) forwards',
			'slide-in-right-soft': 'slide-in-right-soft 0.7s var(--ease-premium) forwards',
			'letter-fade': 'letter-fade 0.5s var(--ease-premium) forwards',
			'netflix-card-in': 'netflix-card-in 0.6s var(--ease-premium) forwards',
			'badge-pulse': 'badge-pulse 2.4s ease-in-out infinite',
			'shimmer-fast': 'shimmer-fast 1.4s linear infinite'
		}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
