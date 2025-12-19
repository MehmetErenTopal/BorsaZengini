
import React, { useState, useEffect, useMemo } from 'react';
import { GeminiService } from './services/geminiService';
import { SupabaseService } from './services/supabaseService';
import { Stock, UserAccount, Transaction } from './types';
import { INITIAL_STOCKS } from './constants';
import StockChart from './components/StockChart';

const App: React.FC = () => {
  // Services
  const gemini = useMemo(() => new GeminiService(), []);
  const db = useMemo(() => SupabaseService.getInstance(), []);

  // State: Auth
  const [user, setUser] = useState<UserAccount | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // State: Core
  const [stocks, setStocks] = useState<Stock[]>(INITIAL_STOCKS);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [insight, setInsight] = useState<{ text: string, sources: any[] } | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [view, setView] = useState<'market' | 'portfolio' | 'leaderboard'>('market');
  const [aiProverb, setAiProverb] = useState('');
  const [globalLeaderboard, setGlobalLeaderboard] = useState<any[]>([]);
  
  // State: Trading
  const [tradeAmount, setTradeAmount] = useState<number>(1);

  // DETERMINISTIC PRICE CALCULATION (Syncs across all devices)
  const getDeterministicChange = (symbol: string, category: string) => {
    const minuteTimestamp = Math.floor(Date.now() / 3000); 
    const seed = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0) + minuteTimestamp;
    const x = Math.sin(seed) * 10000;
    const random = x - Math.floor(x); 
    const volatility = category === 'Crypto' ? 0.04 : 0.01;
    return (random - 0.5) * volatility;
  };

  const liveSelectedStock = useMemo(() => {
    return stocks.find(s => s.symbol === selectedSymbol) || null;
  }, [stocks, selectedSymbol]);

  const liveNetWorth = useMemo(() => {
    if (!user) return 0;
    const portfolioValue = user.portfolio.reduce((acc, p) => {
      const stock = stocks.find(s => s.symbol === p.symbol);
      return acc + (stock ? stock.price * p.shares : 0);
    }, 0);
    return user.balance + portfolioValue;
  }, [user?.balance, user?.portfolio, stocks]);

  useEffect(() => {
    const interval = setInterval(() => {
      setStocks(currentStocks => 
        currentStocks.map(s => {
          const changeFactor = getDeterministicChange(s.symbol, s.category);
          const newPrice = Math.max(0.01, s.price * (1 + changeFactor));
          const change = newPrice - s.price;
          const newHistory = [...s.history.slice(1), { 
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 
            price: newPrice 
          }];
          return { ...s, price: newPrice, change, changePercent: (change / s.price) * 100, history: newHistory };
        })
      );

      if (view === 'leaderboard') {
        db.getGlobalLeaderboard().then(setGlobalLeaderboard);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [view, db]);

  useEffect(() => {
    const initData = async () => {
      gemini.getDailyProverb().then(setAiProverb);
      setStocks(prev => prev.map(s => ({
        ...s,
        history: Array.from({ length: 20 }, (_, i) => ({
          time: `${i}:00`,
          price: s.price
        }))
      })));
    };
    initData();

    const activeUserId = localStorage.getItem('active_user_id');
    if (activeUserId) {
      const accounts: UserAccount[] = JSON.parse(localStorage.getItem('borsa_accounts') || '[]');
      const found = accounts.find(a => a.id === activeUserId);
      if (found) setUser(found);
    }
  }, [gemini]);

  useEffect(() => {
    if (user) {
      const updatedUser = { ...user, netWorth: liveNetWorth };
      db.syncUserData(updatedUser);
    }
  }, [user?.balance, user?.portfolio, liveNetWorth, db]);

  const handleAuth = async () => {
    setError('');
    const accounts: UserAccount[] = JSON.parse(localStorage.getItem('borsa_accounts') || '[]');
    if (authMode === 'register') {
      if (accounts.some(a => a.username === username)) {
        setError('Bu kullanıcı adı alınmış!');
        return;
      }
      const newUser: UserAccount = {
        id: Math.random().toString(36).substr(2, 9),
        username,
        password,
        balance: 10000,
        portfolio: [],
        netWorth: 10000,
        transactions: []
      };
      await db.syncUserData(newUser);
      localStorage.setItem('active_user_id', newUser.id);
      setUser(newUser);
    } else {
      const found = accounts.find(a => a.username === username && a.password === password);
      if (found) {
        localStorage.setItem('active_user_id', found.id);
        setUser(found);
      } else {
        setError('Kullanıcı bulunamadı.');
      }
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('active_user_id');
  };

  const fetchInsight = async (symbol: string) => {
    setLoadingInsight(true);
    setInsight(null);
    const res = await gemini.getMarketInsight(symbol);
    setInsight(res);
    setLoadingInsight(false);
  };

  const setMaxBuyAmount = () => {
    if (!user || !liveSelectedStock) return;
    const maxShares = Math.floor(user.balance / liveSelectedStock.price);
    setTradeAmount(Math.max(1, maxShares));
  };

  const buyStock = () => {
    if (!user || !liveSelectedStock || tradeAmount <= 0) return;
    const cost = liveSelectedStock.price * tradeAmount;
    if (user.balance < cost) {
      alert("Yetersiz bakiye!");
      return;
    }
    const updatedPortfolio = [...user.portfolio];
    const existingIndex = updatedPortfolio.findIndex(p => p.symbol === liveSelectedStock.symbol);
    if (existingIndex > -1) {
      const existing = updatedPortfolio[existingIndex];
      const newTotalShares = existing.shares + tradeAmount;
      const newAvgPrice = (existing.avgPrice * existing.shares + cost) / newTotalShares;
      updatedPortfolio[existingIndex] = { ...existing, shares: newTotalShares, avgPrice: newAvgPrice };
    } else {
      updatedPortfolio.push({ symbol: liveSelectedStock.symbol, shares: tradeAmount, avgPrice: liveSelectedStock.price });
    }
    setUser({
      ...user,
      balance: user.balance - cost,
      portfolio: updatedPortfolio,
      transactions: [{ id: Math.random().toString(), symbol: liveSelectedStock.symbol, type: 'BUY', shares: tradeAmount, price: liveSelectedStock.price, timestamp: Date.now() }, ...user.transactions]
    });
  };

  const sellStock = () => {
    if (!user || !liveSelectedStock || tradeAmount <= 0) return;
    const existingIndex = user.portfolio.findIndex(p => p.symbol === liveSelectedStock.symbol);
    if (existingIndex === -1 || user.portfolio[existingIndex].shares < tradeAmount) {
      alert("Yetersiz hisse!");
      return;
    }
    const credit = liveSelectedStock.price * tradeAmount;
    let updatedPortfolio = user.portfolio.map((p, idx) => 
      idx === existingIndex ? { ...p, shares: p.shares - tradeAmount } : p
    ).filter(p => p.shares > 0);
    setUser({
      ...user,
      balance: user.balance + credit,
      portfolio: updatedPortfolio,
      transactions: [{ id: Math.random().toString(), symbol: liveSelectedStock.symbol, type: 'SELL', shares: tradeAmount, price: liveSelectedStock.price, timestamp: Date.now() }, ...user.transactions]
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020408] p-4 font-inter">
        <div className="max-w-sm w-full bg-slate-900/40 backdrop-blur-2xl rounded-3xl p-8 border border-white/5 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
               <span className="text-2xl">💎</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-1 tracking-tighter">BorsaZengini</h1>
            <p className="text-slate-500 font-bold text-[10px] tracking-widest uppercase opacity-60">Bulut Tabanlı Yatırım</p>
          </div>
          <div className="space-y-4">
            <div className="flex bg-slate-950/60 p-1 rounded-xl border border-white/5">
              <button onClick={() => setAuthMode('login')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${authMode === 'login' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Giriş</button>
              <button onClick={() => setAuthMode('register')} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${authMode === 'register' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>Kayıt</button>
            </div>
            <div className="space-y-3">
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full bg-slate-950 border border-white/5 text-white rounded-xl p-3.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-700" placeholder="Kullanıcı Adı" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-950 border border-white/5 text-white rounded-xl p-3.5 text-sm focus:ring-1 focus:ring-emerald-500 outline-none placeholder:text-slate-700" placeholder="Şifre" />
            </div>
            {error && <p className="text-[9px] text-rose-500 font-black text-center uppercase tracking-widest">{error}</p>}
            <button onClick={handleAuth} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition-all active:scale-[0.98] uppercase tracking-widest text-xs">Terminali Aç</button>
            <p className="text-[9px] text-center text-slate-600 font-medium italic mt-4 uppercase tracking-tighter">{aiProverb}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020408] flex flex-col lg:flex-row overflow-hidden font-inter text-slate-300">
      {/* Sidebar Compact */}
      <nav className="w-full lg:w-20 bg-slate-900/20 backdrop-blur-3xl border-b lg:border-r border-white/5 flex lg:flex-col items-center justify-around lg:justify-start lg:py-8 z-[100] p-2 lg:p-0">
        <div className="text-2xl font-black text-emerald-500 hidden lg:block mb-10 tracking-tighter">BZ</div>
        <NavItem active={view === 'market'} onClick={() => setView('market')} icon="📈" label="Market" />
        <NavItem active={view === 'portfolio'} onClick={() => setView('portfolio')} icon="💼" label="Portföy" />
        <NavItem active={view === 'leaderboard'} onClick={() => setView('leaderboard')} icon="🏆" label="Zirve" />
        <div className="lg:mt-auto">
          <button onClick={logout} className="w-10 h-10 hover:bg-rose-500/20 text-rose-500 rounded-xl transition-all flex items-center justify-center border border-rose-500/10 mb-4" title="Çıkış">🚪</button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-slate-950/20 backdrop-blur-xl border-b border-white/5 p-4 lg:px-8 lg:py-4 flex items-center justify-between z-50">
          <div className="flex gap-8">
            <div>
              <p className="text-slate-500 text-[8px] uppercase font-black tracking-widest mb-0.5 opacity-60">Toplam Varlık</p>
              <div className="text-lg lg:text-xl font-black text-white tabular-nums tracking-tighter">
                ${liveNetWorth.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="border-l border-white/5 pl-8">
              <p className="text-slate-500 text-[8px] uppercase font-black tracking-widest mb-0.5 opacity-60">Cüzdan</p>
              <div className="text-lg lg:text-xl font-black text-slate-400 tabular-nums tracking-tighter">
                ${user.balance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-emerald-500/5 px-3 py-1 rounded-lg border border-emerald-500/10">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Live Terminal Sync</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scroll p-4 lg:p-6 pb-24 lg:pb-6">
          {view === 'market' && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
              <div className="xl:col-span-8 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                  {stocks.map(stock => (
                    <StockCard 
                      key={stock.symbol} 
                      stock={stock} 
                      active={selectedSymbol === stock.symbol}
                      onClick={() => {
                        setSelectedSymbol(stock.symbol);
                        setTradeAmount(1);
                        fetchInsight(stock.symbol);
                      }} 
                    />
                  ))}
                </div>
              </div>

              <div className="xl:col-span-4">
                <div className="sticky top-0 space-y-4">
                  {liveSelectedStock ? (
                    <div className="bg-slate-900/30 border border-white/10 rounded-2xl p-5 shadow-xl">
                      <div className="flex justify-between items-center mb-4">
                        <div>
                          <h4 className="text-xl font-black text-white tracking-tighter">{liveSelectedStock.name}</h4>
                          <span className="text-emerald-500 font-black text-[8px] tracking-widest uppercase">{liveSelectedStock.symbol} Market</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-white tabular-nums">${liveSelectedStock.price.toFixed(2)}</div>
                          <div className={`text-[10px] font-black ${liveSelectedStock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {liveSelectedStock.change >= 0 ? '▲' : '▼'} {Math.abs(liveSelectedStock.changePercent).toFixed(2)}%
                          </div>
                        </div>
                      </div>

                      <div className="bg-black/20 rounded-xl p-3 border border-white/5 mb-4">
                        <StockChart 
                          data={liveSelectedStock.history} 
                          color={liveSelectedStock.change >= 0 ? '#10b981' : '#f43f5e'} 
                          height={140}
                        />
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <button onClick={() => setTradeAmount(Math.max(1, tradeAmount - 1))} className="w-10 h-10 bg-slate-800 rounded-lg text-lg font-bold hover:bg-slate-700">-</button>
                           <div className="flex-1 relative">
                             <input 
                                type="number" 
                                value={tradeAmount}
                                onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="w-full bg-slate-950 border border-white/10 text-center text-white font-black py-2 rounded-lg text-sm focus:outline-none tabular-nums"
                             />
                             <button onClick={setMaxBuyAmount} className="absolute right-2 top-1.5 text-[8px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase font-black">Max</button>
                           </div>
                           <button onClick={() => setTradeAmount(tradeAmount + 1)} className="w-10 h-10 bg-slate-800 rounded-lg text-lg font-bold hover:bg-slate-700">+</button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={buyStock} className="bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Satın Al</button>
                          <button onClick={sellStock} className="bg-slate-800 hover:bg-slate-700 text-white font-black py-3 rounded-xl text-xs uppercase tracking-widest border border-white/5 active:scale-95 transition-all">Satış Yap</button>
                        </div>
                      </div>

                      <div className="mt-6 pt-4 border-t border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                          <span className="w-4 h-4 bg-emerald-500/10 rounded flex items-center justify-center text-[8px]">G</span> 
                          Terminal Insight (Lite Mode)
                        </p>
                        {loadingInsight ? (
                          <div className="h-20 flex items-center justify-center"><div className="w-4 h-4 border-2 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div></div>
                        ) : (
                          <div className="text-[11px] text-slate-400 leading-relaxed max-h-32 overflow-y-auto custom-scroll pr-2 ai-content">
                            {insight?.text}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-64 border-2 border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center opacity-40">
                      <span className="text-3xl mb-4">📉</span>
                      <p className="text-[9px] uppercase font-black tracking-widest">Hisse Seçiniz</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {view === 'portfolio' && (
            <div className="max-w-5xl mx-auto space-y-6">
               <h3 className="text-xl font-black text-white italic">Pozisyonlarım</h3>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {user.portfolio.map(p => {
                    const stock = stocks.find(s => s.symbol === p.symbol);
                    if (!stock) return null;
                    const currentValue = p.shares * stock.price;
                    const profit = currentValue - (p.shares * p.avgPrice);
                    return (
                      <div key={p.symbol} className="bg-slate-900/30 border border-white/5 p-4 rounded-2xl">
                        <div className="flex justify-between items-start mb-4">
                          <span className="text-lg font-black text-white">{stock.symbol}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${profit >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {profit >= 0 ? '+' : ''}{((profit / (p.shares * p.avgPrice)) * 100).toFixed(2)}%
                          </span>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-500 text-[9px] uppercase font-black">Varlık Değeri</p>
                          <p className="text-lg font-black text-white tracking-tighter">${currentValue.toLocaleString('tr-TR')}</p>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
                           <div className="bg-black/20 p-2 rounded-lg"><p className="opacity-50">Lot</p><p className="font-bold">{p.shares}</p></div>
                           <div className="bg-black/20 p-2 rounded-lg"><p className="opacity-50">Maliyet</p><p className="font-bold">${p.avgPrice.toFixed(2)}</p></div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          )}

          {view === 'leaderboard' && (
            <div className="max-w-2xl mx-auto space-y-8 py-4">
              <div className="text-center">
                <h3 className="text-2xl font-black text-white tracking-tighter mb-2">Global Sıralama</h3>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest opacity-60">Dünya çapında en zengin yatırımcılar</p>
              </div>
              <div className="space-y-2">
                {globalLeaderboard.map((entry, idx) => (
                  <div key={idx} className={`bg-slate-900/30 border ${entry.username === user.username ? 'border-emerald-500/40' : 'border-white/5'} p-4 rounded-xl flex items-center justify-between`}>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-black text-slate-700 w-6">#{idx + 1}</span>
                      <div className="w-8 h-8 bg-slate-800 rounded-lg flex items-center justify-center text-xs">
                         {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '👤'}
                      </div>
                      <span className="font-black text-sm uppercase">{entry.username}</span>
                    </div>
                    <span className="text-sm font-black text-white tabular-nums">${entry.netWorth.toLocaleString('tr-TR')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col w-14 h-14 items-center justify-center rounded-2xl transition-all duration-300 gap-1 group ${active ? 'bg-emerald-600 text-white shadow-lg' : 'hover:bg-white/5 text-slate-600'}`}>
    <span className="text-2xl">{icon}</span>
    <span className="text-[7px] font-black uppercase tracking-tighter lg:hidden">{label}</span>
  </button>
);

const StockCard: React.FC<{ stock: Stock; active: boolean; onClick: () => void }> = ({ stock, active, onClick }) => (
  <button onClick={onClick} className={`bg-slate-900/20 border ${active ? 'border-emerald-500/50 bg-slate-900/40' : 'border-white/5'} p-4 rounded-2xl text-left hover:border-white/10 transition-all group overflow-hidden relative`}>
    <div className="flex justify-between items-start relative z-10">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg transition-all ${active ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-emerald-500'}`}>
          {stock.symbol.charAt(0)}
        </div>
        <div>
          <h4 className="font-black text-white text-xs leading-none tracking-tight">{stock.name}</h4>
          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mt-1 block">{stock.symbol}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-black text-white tabular-nums">${stock.price.toFixed(2)}</div>
        <div className={`text-[9px] font-black mt-0.5 ${stock.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
          {stock.change >= 0 ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
        </div>
      </div>
    </div>
    <div className="mt-3 opacity-20 group-hover:opacity-50 transition-all">
       <StockChart data={stock.history.slice(-10)} color={stock.change >= 0 ? '#10b981' : '#f43f5e'} isMini={true} height={40} />
    </div>
  </button>
);

export default App;
