
export interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  history: { time: string; price: number }[];
  category: 'Tech' | 'Energy' | 'Finance' | 'Crypto' | 'Luxury';
}

export interface UserPortfolio {
  symbol: string;
  shares: number;
  avgPrice: number;
}

export interface UserAccount {
  id: string;
  username: string;
  password?: string; // Sadece local depolama için
  balance: number;
  portfolio: UserPortfolio[];
  netWorth: number;
  transactions: Transaction[];
}

export interface Transaction {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  shares: number;
  price: number;
  timestamp: number;
}

export interface LeaderboardEntry {
  username: string;
  netWorth: number;
  rank: number;
}
