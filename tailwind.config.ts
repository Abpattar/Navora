import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101214',
        panel: '#171a1d',
        line: '#2b3035',
        amber: '#f4a340',
        muted: '#929ba5',
      },
      boxShadow: { soft: '0 18px 50px rgba(0,0,0,.18)' },
    },
  },
  plugins: [],
};
export default config;
