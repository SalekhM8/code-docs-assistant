import { Fraunces, Inter } from "next/font/google";

// The house's two families (palmer-clone src/lib/fonts.ts and src/app/layout.tsx).
export const fraunces = Fraunces({ subsets: ["latin"], weight: ["300", "400"], style: ["normal", "italic"], display: "swap", variable: "--font-fraunces" });
export const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-inter" });
