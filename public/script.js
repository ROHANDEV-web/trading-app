// =====================================================
// TRADINGSIM PRO - Frontend Logic (Auth, API, TradingView)
// =====================================================

const API_BASE = window.location.origin;

const cryptoList = ["bitcoin", "ethereum", "solana", "dogecoin", "litecoin", "ripple"];
const stockList = ["AAPL", "TSLA", "MSFT", "GOOGL", "AMZN", "NVDA"];
const forexList = ["USDINR", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD"];

// --- Coin/Forex Configuration ---
const COINS = {
    bitcoin: { name: 'Bitcoin', symbol: 'BTC', icon: '₿', color: 'linear-gradient(135deg, #f7931a, #bd6c0a)', tv: 'BINANCE:BTCUSDT' },
    ethereum: { name: 'Ethereum', symbol: 'ETH', icon: 'Ξ', color: 'linear-gradient(135deg, #627eea, #3a4b8c)', tv: 'BINANCE:ETHUSDT' },
    solana: { name: 'Solana', symbol: 'SOL', icon: 'S', color: 'linear-gradient(135deg, #14F195, #9945FF)', tv: 'BINANCE:SOLUSDT' },
    dogecoin: { name: 'Dogecoin', symbol: 'DOGE', icon: 'Ð', color: '#c2a633', tv: 'BINANCE:DOGEUSDT' },
    litecoin: { name: 'Litecoin', symbol: 'LTC', icon: 'Ł', color: '#315d9e', tv: 'BINANCE:LTCUSDT' },
    ripple: { name: 'Ripple', symbol: 'XRP', icon: '✕', color: '#23292f', tv: 'BINANCE:XRPUSDT' },
    USDINR: { name: 'USD / INR', symbol: 'USDINR', icon: '💵', color: '#10b981', tv: 'FX_IDC:USDINR' },
    EURUSD: { name: 'EUR / USD', symbol: 'EURUSD', icon: '💶', color: '#3b82f6', tv: 'FX:EURUSD' },
    GBPUSD: { name: 'GBP / USD', symbol: 'GBPUSD', icon: '💷', color: '#f59e0b', tv: 'FX:GBPUSD' },
    USDJPY: { name: 'USD / JPY', symbol: 'USDJPY', icon: '💴', color: '#ef4444', tv: 'FX:USDJPY' },
    AUDUSD: { name: 'AUD / USD', symbol: 'AUDUSD', icon: '🇦🇺', color: '#2dd4bf', tv: 'FX:AUDUSD' },
    AAPL: { name: 'Apple Inc.', symbol: 'AAPL', icon: '🍎', color: '#A3AAAE', tv: 'NASDAQ:AAPL' },
    TSLA: { name: 'Tesla Inc.', symbol: 'TSLA', icon: '⚡', color: '#E31937', tv: 'NASDAQ:TSLA' },
    MSFT: { name: 'Microsoft', symbol: 'MSFT', icon: '🪟', color: '#00A4EF', tv: 'NASDAQ:MSFT' },
    GOOGL: { name: 'Alphabet Inc.', symbol: 'GOOGL', icon: 'G', color: '#34A853', tv: 'NASDAQ:GOOGL' },
    AMZN: { name: 'Amazon.com', symbol: 'AMZN', icon: 'A', color: '#FF9900', tv: 'NASDAQ:AMZN' },
    NVDA: { name: 'NVIDIA Corp', symbol: 'NVDA', icon: 'N', color: '#76B900', tv: 'NASDAQ:NVDA' }
};

// --- Application State ---
let user = null;
let selectedMarket = 'crypto';
let selectedCoin = cryptoList[0];

let prices = {};
let previousPrices = {};
let stockPrices = {};
let isLoadingPrices = true;

const ALL_ASSETS = [...cryptoList, ...forexList, ...stockList];
ALL_ASSETS.forEach(asset => {
    prices[asset] = 0;
    previousPrices[asset] = 0;
});

// TV Widget instance
let tvWidget = null;
let priceInterval = null;
let stockInterval = null;

// --- DOM Elements ---
const authView       = document.getElementById('auth-view');
const dashboardView  = document.getElementById('dashboard-view');
const toastContainer = document.getElementById('toast-container');

// Auth Forms
const loginForm      = document.getElementById('login-form');
const registerForm   = document.getElementById('register-form');
const goRegisterBtn  = document.getElementById('go-to-register');
const goLoginBtn     = document.getElementById('go-to-login');
const logoutBtn      = document.getElementById('logout-btn');
const usernameDisplay= document.getElementById('username-display');

// Dashboard Elements
const balanceEl      = document.getElementById('balance');
const holdingsEl     = document.getElementById('holdings');
const holdingsLabel  = document.getElementById('holdings-label');
const holdingsSymbol = document.getElementById('holdings-symbol');
const portfolioEl    = document.getElementById('portfolio-value');

const coinIconEl     = document.getElementById('coin-icon');
const coinNameEl     = document.getElementById('coin-name');
const coinTickerEl   = document.getElementById('coin-ticker');
const priceEl        = document.getElementById('price');
const trendEl        = document.getElementById('price-trend');
const lastUpdatedEl  = document.getElementById('last-updated');

const amountInput    = document.getElementById('amount-input');
const coinPreviewEl  = document.getElementById('coin-preview');

const buyBtn         = document.getElementById('buy-btn');
const sellBtn        = document.getElementById('sell-btn');
const buyText        = document.getElementById('buy-text');
const sellText       = document.getElementById('sell-text');

const marketTabs     = document.querySelectorAll('.market-tab');
const cryptoSelector = document.getElementById('crypto-selector');
const forexSelector  = document.getElementById('forex-selector');
const stocksSelector  = document.getElementById('stocks-selector');

// ======================
// UTILS & UI GENERATOR
// ======================

const renderSelectors = () => {
    const createTabs = (list, container) => {
        container.innerHTML = '';
        list.forEach((coin, idx) => {
            const data = COINS[coin];
            if (!data) return;
            const btn = document.createElement('button');
            btn.className = 'coin-tab';
            if (coin === selectedCoin) btn.classList.add('active');
            btn.dataset.coin = coin;
            btn.dataset.symbol = data.tv;
            btn.textContent = data.symbol;
            btn.addEventListener('click', handleCoinSelect);
            container.appendChild(btn);
        });
    };
    createTabs(cryptoList, cryptoSelector);
    createTabs(forexList, forexSelector);
    createTabs(stockList, stocksSelector);
};

const handleCoinSelect = (e) => {
    const parentId = e.target.closest('.coin-selector').id;
    document.querySelectorAll(`#${parentId} .coin-tab`).forEach(t => t.classList.remove('active'));
    e.target.classList.add('active');
    
    selectedCoin = e.target.dataset.coin;
    initTradingView(e.target.dataset.symbol);
    updateDashboardUI();
    updatePreview();
};

const showToast = (message, type = 'error') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'error' ? '⚠️' : '✅'}</span> ${message}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

const formatCurrency = (amt) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
const formatCrypto = (amt) => amt.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 });

// ======================
// AUTHENTICATION
// ======================

const getToken = () => localStorage.getItem('trade_token');
const setToken = (t) => localStorage.setItem('trade_token', t);
const clearToken = () => localStorage.removeItem('trade_token');

const checkAuth = async () => {
    const token = getToken();
    if (!token) return showAuthView();

    try {
        const res = await fetch(`${API_BASE}/user`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Session expired');
        
        user = await res.json();
        showDashboardView();
        
    } catch (err) {
        clearToken();
        showAuthView();
    }
};

const showAuthView = () => {
    authView.style.display = 'flex';
    dashboardView.style.display = 'none';
    if(priceInterval) clearInterval(priceInterval);
    if(stockInterval) clearInterval(stockInterval);
};

const showDashboardView = () => {
    authView.style.display = 'none';
    dashboardView.style.display = 'flex';
    usernameDisplay.textContent = user.username;
    
    initTradingView('BINANCE:BTCUSDT');
    fetchPrices();
    fetchStockPrices();
    priceInterval = setInterval(fetchPrices, 5000);
    stockInterval = setInterval(fetchStockPrices, 10000);
};

// Form toggles
goRegisterBtn.addEventListener('click', () => {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
});
goLoginBtn.addEventListener('click', () => {
    registerForm.style.display = 'none';
    loginForm.style.display = 'flex';
});

// Login
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        setToken(data.token);
        showToast('Logged in successfully', 'success');
        checkAuth();
    } catch (err) {
        showToast(err.message);
    }
});

// Register
registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;

    try {
        const res = await fetch(`${API_BASE}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();
        
        if (!res.ok) throw new Error(data.error);
        
        showToast('Registered successfully! Please login.', 'success');
        goLoginBtn.click();
    } catch (err) {
        showToast(err.message);
    }
});

logoutBtn.addEventListener('click', () => {
    clearToken();
    user = null;
    showAuthView();
});

// ======================
// TRADING VIEW INTEGRATION
// ======================

const initTradingView = (symbol) => {
    document.getElementById('tv_chart_container').innerHTML = ''; // Clear old chart
    tvWidget = new TradingView.widget({
        "autosize": true,
        "symbol": symbol,
        "interval": "D",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "#151e32", /* Matches our bg-surface */
        "gridColor": "rgba(255, 255, 255, 0.06)",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tv_chart_container"
    });
};

// ======================
// UI UPDATES & PRICES
// ======================

const updatePreview = () => {
    const amount = parseFloat(amountInput.value);
    const p = prices[selectedCoin];
    const sym = COINS[selectedCoin].symbol;
    if (!isNaN(amount) && amount > 0 && p > 0) {
        coinPreviewEl.textContent = `≈ ${(amount / p).toFixed(6)} ${sym}`;
    } else {
        coinPreviewEl.textContent = `≈ 0.000000 ${sym}`;
    }
};

const updateDashboardUI = () => {
    if(!user) return;
    
    const coin = COINS[selectedCoin];
    coinIconEl.textContent = coin.icon;
    coinIconEl.style.background = coin.color;
    coinNameEl.textContent = coin.name;
    coinTickerEl.textContent = `${coin.symbol} / INR`;
    holdingsLabel.textContent = `${coin.symbol} Holdings`;
    holdingsSymbol.textContent = coin.symbol;
    buyText.textContent = `Buy ${coin.symbol}`;
    sellText.textContent = `Sell ${coin.symbol}`;

    const p = prices[selectedCoin];
    const prevP = previousPrices[selectedCoin];
    const holding = user.holdings[selectedCoin] || 0;

    balanceEl.textContent = formatCurrency(user.balance);
    holdingsEl.childNodes[0].nodeValue = formatCrypto(holding) + ' ';
    portfolioEl.textContent = `≈ ${formatCurrency(holding * p)}`;

    priceEl.textContent = isLoadingPrices ? "..." : formatCurrency(p);
    priceEl.classList.remove('price-up', 'price-down');
    if (p > prevP && prevP > 0) {
        priceEl.classList.add('price-up');
        trendEl.textContent = '↗';
        trendEl.className = 'price-trend price-up';
    } else if (p < prevP && prevP > 0) {
        priceEl.classList.add('price-down');
        trendEl.textContent = '↘';
        trendEl.className = 'price-trend price-down';
    } else {
        trendEl.textContent = '−';
        trendEl.className = 'price-trend';
    }
    updatePreview();
};

const fetchPrices = async () => {
    try {
        // Fetch Crypto dynamically
        const cryptoIds = cryptoList.join(',');
        const cryptoRes = fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoIds}&vs_currencies=inr`).then(r => r.ok ? r.json() : null);
        
        // Fetch Forex using user's API key
        const forexRes = fetch('https://v6.exchangerate-api.com/v6/72d810937812d5cb7835372a/latest/USD').then(r => r.ok ? r.json() : null);
        
        const [cryptoData, forexData] = await Promise.all([cryptoRes, forexRes]);
        
        previousPrices = { ...prices };
        
        if (cryptoData) {
            cryptoList.forEach(coin => {
                if(cryptoData[coin] && cryptoData[coin].inr) prices[coin] = cryptoData[coin].inr;
            });
        }
        
        if (forexData && forexData.conversion_rates) {
            const rates = forexData.conversion_rates;
            if(prices['USDINR'] !== undefined) prices.USDINR = rates.INR;
            if(prices['EURUSD'] !== undefined) prices.EURUSD = 1 / rates.EUR;
            if(prices['GBPUSD'] !== undefined) prices.GBPUSD = 1 / rates.GBP;
            if(prices['USDJPY'] !== undefined) prices.USDJPY = rates.JPY;
            if(prices['AUDUSD'] !== undefined) prices.AUDUSD = 1 / rates.AUD;
        }
        
        if(isLoadingPrices) {
            previousPrices = { ...prices };
            isLoadingPrices = false;
        }

        lastUpdatedEl.textContent = `Updated at ${new Date().toLocaleTimeString('en-IN')}`;
        updateDashboardUI();
    } catch(err) {
        console.warn('Price fetch failed:', err);
    }
};

const fetchStockPrices = async () => {
    try {
        const token = 'd7ag8phr01qmvlmfsc3gd7ag8phr01qmvlmfsc40';
        
        const promises = stockList.map(symbol => 
            fetch(`https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${token}`)
                .then(r => r.ok ? r.json() : null)
        );
        
        const results = await Promise.all(promises);
        
        results.forEach((data, i) => {
            if (data && typeof data.c === 'number') {
                const symbol = stockList[i];
                stockPrices[symbol] = { c: data.c, h: data.h, l: data.l };
                
                previousPrices[symbol] = prices[symbol];
                prices[symbol] = data.c;
            }
        });
        
        if(isLoadingPrices) {
            previousPrices = { ...prices };
            isLoadingPrices = false;
        }

        lastUpdatedEl.textContent = `Updated at ${new Date().toLocaleTimeString('en-IN')}`;
        updateDashboardUI();
    } catch (err) {
        console.warn('Stock price fetch failed:', err);
    }
};

// ======================
// TRADING LOGIC
// ======================

const executeTrade = async (action, amount) => {
    if (!amount || amount <= 0) return showToast('Enter valid amount!');
    if (isLoadingPrices || prices[selectedCoin] <= 0) return showToast('Waiting for live price...');
    
    // Optimistic UI could go here, but let's wait for actual backend confirmation
    try {
        let currentMarket = 'crypto';
        if (forexList.includes(selectedCoin)) currentMarket = 'forex';
        if (stockList.includes(selectedCoin)) currentMarket = 'stocks';

        const payload = {
            coin: selectedCoin,
            amount: amount,
            price: prices[selectedCoin],
            marketType: currentMarket
        };

        const res = await fetch(`${API_BASE}/${action}`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getToken()}`
            },
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);

        // Update local user state mapping to what the server saved
        user = data.user; 
        updateDashboardUI();
        amountInput.value = '';
        updatePreview();
        showToast(data.message, 'success');
        
    } catch (err) {
        showToast(err.message);
    }
};

buyBtn.addEventListener('click', () => executeTrade('buy', parseFloat(amountInput.value)));
sellBtn.addEventListener('click', () => executeTrade('sell', parseFloat(amountInput.value)));

// ======================
// EVENTS
// ======================

marketTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        marketTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const market = e.target.dataset.market;
        cryptoSelector.style.display = 'none';
        forexSelector.style.display = 'none';
        stocksSelector.style.display = 'none';

        if (market === 'crypto') {
            cryptoSelector.style.display = 'flex';
            document.querySelector('#crypto-selector .coin-tab').click();
        } else if (market === 'forex') {
            forexSelector.style.display = 'flex';
            document.querySelector('#forex-selector .coin-tab').click();
        } else if (market === 'stocks') {
            stocksSelector.style.display = 'flex';
            document.querySelector('#stocks-selector .coin-tab').click();
        }
    });
});



document.querySelectorAll('.quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        amountInput.value = btn.dataset.amount;
        updatePreview();
    });
});

amountInput.addEventListener('input', updatePreview);

// Boot up
window.onload = () => {
    renderSelectors();
    checkAuth();
};

