import yahooFinance from 'yahoo-finance2';

const TICKER_CACHE = new Map();
const CACHE_TTL = 60 * 1000; // 1 minute cache

export async function getStockPrice(ticker) {
  const cacheKey = ticker.toUpperCase();
  const cached = TICKER_CACHE.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    // Add .JK suffix for Indonesian stocks
    const jkTicker = ticker.toUpperCase().endsWith('.JK') ? ticker : `${ticker}.JK`;
    
    const quote = await yahooFinance.quote(jkTicker, {
      fields: ['regularMarketPrice', 'regularMarketChange', 'regularMarketChangePercent', 
               'regularMarketVolume', 'regularMarketCap', 'fiftyTwoWeekHigh', 
               'fiftyTwoWeekLow', 'trailingPE', 'forwardPE', 'priceToBook',
               'earningsPerShare', 'dividendYield', 'dividendRate', 'averageAnalystRating']
    });

    if (!quote || !quote.regularMarketPrice) {
      return { error: `Ticker ${jkTicker} not found` };
    }

    const result = {
      ticker: jkTicker,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange || 0,
      changePercent: quote.regularMarketChangePercent || 0,
      volume: quote.regularMarketVolume || 0,
      marketCap: quote.marketCap || 0,
      high52w: quote.fiftyTwoWeekHigh || 0,
      low52w: quote.fiftyTwoWeekLow || 0,
      pe: quote.trailingPE || 0,
      forwardPE: quote.forwardPE || 0,
      pb: quote.priceToBook || 0,
      eps: quote.epsTrailingTwelveMonths || 0,
      dividendYield: quote.dividendYield || 0,
      dividendRate: quote.dividendRate || 0,
      analystRating: quote.averageAnalystRating || 'N/A',
      formattedPrice: formatCurrency(quote.regularMarketPrice),
      formattedCap: formatLargeNumber(quote.marketCap || 0),
      formattedVolume: formatLargeNumber(quote.regularMarketVolume || 0),
    };

    TICKER_CACHE.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;

  } catch (err) {
    console.error(`[StockTools] Error fetching ${ticker}:`, err.message);
    return { error: `Gagal mengambil data ${ticker}: ${err.message}` };
  }
}

export async function getMultipleStocks(tickers) {
  const results = await Promise.all(
    tickers.map(ticker => getStockPrice(ticker))
  );
  
  return tickers.reduce((acc, ticker, i) => {
    acc[ticker.toUpperCase()] = results[i];
    return acc;
  }, {});
}

export async function getMarketSummary() {
  try {
    const [idx, bca, bri, tlkm] = await Promise.all([
      yahooFinance.quote('^JKSE'),
      yahooFinance.quote('BBCA.JK'),
      yahooFinance.quote('BBRI.JK'),
      yahooFinance.quote('TLKM.JK'),
    ]);

    return {
      idx: {
        name: 'IHSG',
        price: idx.regularMarketPrice,
        change: idx.regularMarketChange,
        changePercent: idx.regularMarketChangePercent,
      },
      banking: {
        bca: { price: bca.regularMarketPrice, change: bca.regularMarketChangePercent },
        bri: { price: bri.regularMarketPrice, change: bri.regularMarketChangePercent },
        tlkm: { price: tlkm.regularMarketPrice, change: tlkm.regularMarketChangePercent },
      }
    };
  } catch (err) {
    console.error('[StockTools] Market summary error:', err.message);
    return { error: 'Gagal mengambil data pasar' };
  }
}

function formatCurrency(num) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatLargeNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  return num.toString();
}

export function formatStockData(data) {
  if (data.error) return `❌ ${data.error}`;
  
  const emoji = data.change >= 0 ? '🟢' : '🔴';
  
  return `${emoji} **${data.ticker}**
━━━━━━━━━━━━━━━━━━
💰 Harga: ${data.formattedPrice} (${data.change >= 0 ? '+' : ''}${data.change.toFixed(0)} / ${data.changePercent?.toFixed(2)}%)
📊 Market Cap: ${data.formattedCap}
📈 Volume: ${data.formattedVolume}
━━━━━━━━━━━━━━━━━━
Valuasi:
• P/E: ${data.pe?.toFixed(2) || 'N/A'}
• P/B: ${data.pb?.toFixed(2) || 'N/A'}
• EPS: Rp${data.eps?.toFixed(0) || 'N/A'}
52W Range: Rp${data.low52w?.toFixed(0)} - Rp${data.high52w?.toFixed(0)}
Dividend: ${data.dividendYield ? (data.dividendYield * 100).toFixed(2) + '%' : 'N/A'}`;
}
