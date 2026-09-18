import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        "error-container": "#ffdad6",
        "tertiary-fixed-dim": "#bec6e0",
        "secondary-container": "#fe932c",
        "surface-container-lowest": "#ffffff",
        "background": "#f8f9ff",
        "on-tertiary-fixed-variant": "#3f465c",
        "primary-fixed-dim": "#b4c5ff",
        "on-primary-fixed-variant": "#003ea8",
        "on-secondary-fixed-variant": "#6e3900",
        "on-secondary-container": "#663500",
        "on-error": "#ffffff",
        "surface-container-low": "#eff4ff",
        "secondary-fixed": "#ffdcc3",
        "outline-variant": "#c3c6d7",
        "on-surface": "#0b1c30",
        "on-surface-variant": "#434655",
        "on-background": "#0b1c30",
        "on-error-container": "#93000a",
        "outline": "#737686",
        "inverse-primary": "#b4c5ff",
        "on-primary-container": "#eeefff",
        "primary-container": "#2563eb",
        "tertiary-container": "#656d84",
        "error": "#ba1a1a",
        "surface": "#f8f9ff",
        "surface-container-highest": "#d3e4fe",
        "on-tertiary-container": "#eef0ff",
        "surface-bright": "#f8f9ff",
        "on-secondary-fixed": "#2f1500",
        "surface-tint": "#0053db",
        "surface-container": "#e5eeff",
        "secondary-fixed-dim": "#ffb77d",
        "tertiary": "#4d556b",
        "primary-fixed": "#dbe1ff",
        "secondary": "#904d00",
        "surface-variant": "#d3e4fe",
        "on-primary": "#ffffff",
        "inverse-on-surface": "#eaf1ff",
        "tertiary-fixed": "#dae2fd",
        "on-primary-fixed": "#00174b",
        "on-secondary": "#ffffff",
        "surface-container-high": "#dce9ff",
        "on-tertiary-fixed": "#131b2e",
        "primary": "#004ac6",
        "inverse-surface": "#213145",
        "on-tertiary": "#ffffff",
        "surface-dim": "#cbdbf5"
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      spacing: {
        "space-xs": "0.25rem",
        "margin": "1rem",
        "space-md": "0.75rem",
        "space-lg": "1rem",
        "space-xl": "1.5rem",
        "gutter": "0.75rem",
        "space-sm": "0.375rem"
      },
      fontFamily: {
        "label-caps": ["Geist"],
        "headline-lg": ["Geist"],
        "body-lg": ["Geist"],
        "headline-md": ["Geist"],
        "headline-xl": ["Geist"],
        "code-sm": ["JetBrains Mono"],
        "numeric-table": ["JetBrains Mono"],
        "body-md": ["Geist"],
        "body-sm": ["Geist"],
        "numeric-metric-md": ["JetBrains Mono"],
        "numeric-metric-lg": ["JetBrains Mono"]
      },
      fontSize: {
        "label-caps": ["11px", { lineHeight: "14px", letterSpacing: "0.04em", fontWeight: "600" }],
        "headline-lg": ["22px", { lineHeight: "28px", letterSpacing: "-0.015em", fontWeight: "600" }],
        "body-lg": ["14px", { lineHeight: "20px", letterSpacing: "-0.005em", fontWeight: "400" }],
        "headline-md": ["16px", { lineHeight: "22px", letterSpacing: "-0.01em", fontWeight: "600" }],
        "headline-xl": ["28px", { lineHeight: "34px", letterSpacing: "-0.02em", fontWeight: "600" }],
        "code-sm": ["11px", { lineHeight: "14px", letterSpacing: "0em", fontWeight: "400" }],
        "numeric-table": ["12px", { lineHeight: "16px", letterSpacing: "0em", fontWeight: "400" }],
        "body-md": ["13px", { lineHeight: "18px", letterSpacing: "0em", fontWeight: "400" }],
        "body-sm": ["12px", { lineHeight: "16px", letterSpacing: "0em", fontWeight: "400" }],
        "numeric-metric-md": ["14px", { lineHeight: "18px", letterSpacing: "-0.01em", fontWeight: "500" }],
        "numeric-metric-lg": ["24px", { lineHeight: "28px", letterSpacing: "-0.02em", fontWeight: "600" }]
      }
    }
  }
};
export default config;
