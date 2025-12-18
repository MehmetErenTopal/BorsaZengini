
import { Stock } from './types';

export const INITIAL_STOCKS: Stock[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', price: 185.42, change: 1.25, changePercent: 0.68, category: 'Tech', history: [] },
  { symbol: 'TSLA', name: 'Tesla Motors', price: 242.11, change: -4.30, changePercent: -1.74, category: 'Tech', history: [] },
  { symbol: 'BTC', name: 'Bitcoin', price: 64200.00, change: 1250.00, changePercent: 1.98, category: 'Crypto', history: [] },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', price: 822.45, change: 15.30, changePercent: 1.89, category: 'Tech', history: [] },
  { symbol: 'GOLD', name: 'Gold Spot', price: 2150.50, change: 5.20, changePercent: 0.24, category: 'Finance', history: [] },
  { symbol: 'LVMH', name: 'LVMH Moet Hennessy', price: 780.20, change: -2.10, changePercent: -0.27, category: 'Luxury', history: [] },
  { symbol: 'XOM', name: 'Exxon Mobil', price: 112.15, change: 0.85, changePercent: 0.76, category: 'Energy', history: [] },
  { symbol: 'JPM', name: 'JPMorgan Chase', price: 188.32, change: 1.12, changePercent: 0.60, category: 'Finance', history: [] },
];

export const MOCK_LEADERBOARD = [
  { username: 'BorsaKrali', netWorth: 2500000, rank: 1 },
  { username: 'InvestPro', netWorth: 1850000, rank: 2 },
  { username: 'WallStreetYoda', netWorth: 1200000, rank: 3 },
  { username: 'CryptoMoon', netWorth: 950000, rank: 4 },
  { username: 'SafeBet', netWorth: 820000, rank: 5 },
];
