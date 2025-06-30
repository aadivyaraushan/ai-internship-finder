import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        'meteor-effect': 'meteor 5s linear infinite',
        spotlight: 'spotlight 2s ease .75s 1 forwards',
        shimmer: 'shimmer 2s linear infinite',
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
      keyframes: {
        meteor: {
          '0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
          '70%': { opacity: '1' },
          '100%': {
            transform: 'rotate(215deg) translateX(-500px)',
            opacity: '0',
          },
        },
        spotlight: {
          '0%': {
            opacity: '0',
            transform: 'translate(-72%, -62%) scale(0.5)',
          },
          '100%': {
            opacity: '1',
            transform: 'translate(-50%,-40%) scale(1)',
          },
        },
        shimmer: {
          from: {
            backgroundPosition: '0 0',
          },
          to: {
            backgroundPosition: '-200% 0',
          },
        },
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/aspect-ratio'),
    require('tailwindcss-animate'),
    function ({ addBase, theme }: { addBase: Function; theme: Function }) {
      const colors = theme('colors') as Record<
        string,
        string | Record<string, string>
      >;
      const cssVariables = Object.entries(colors).reduce(
        (acc, [key, value]) => {
          if (typeof value === 'object') {
            return {
              ...acc,
              ...Object.entries(value).reduce(
                (shadeAcc, [shade, color]) => ({
                  ...shadeAcc,
                  [`--${key}-${shade}`]: color,
                }),
                {}
              ),
            };
          }
          return {
            ...acc,
            [`--${key}`]: value,
          };
        },
        {} as Record<string, string>
      );

      addBase({
        ':root': cssVariables,
      });
    },
  ],
};

export default config;
