# Daisy Stock Analysis

A real-time stock analysis application with **Break & Retest** trading strategy, built with Python FastAPI backend and React frontend.

## 🚀 Features

- **Real-time Stock Analysis**: Fetch and analyze stock data using YFinance
- **Break & Retest Strategy**: Automated detection of breakout and retest patterns
- **Technical Indicators**: MA, EMA, MACD, RSI, Bollinger Bands
- **Interactive UI**: Modern web interface with candlestick charts
- **Real-time Alerts**: Desktop notifications for buy/sell signals
- **Single-port Deployment**: Frontend and backend served on one port

## 📊 Trading Strategy

The **Break & Retest** strategy identifies:
- **Breakouts**: When price breaks above resistance or below support
- **Retests**: When price returns to test the broken level
- **Confirmation**: Multiple bars confirm the signal before generating alerts

## 🛠️ Tech Stack

### Backend
- **Python 3.13**
- **FastAPI**: REST API framework
- **Pandas**: Data analysis
- **YFinance**: Stock data provider
- **Uvicorn**: ASGI server

### Frontend
- **React 18** with TypeScript
- **Vite**: Build tool
- **Axios**: HTTP client
- **Canvas**: Chart rendering

## 📦 Installation

### 1. Clone the repository
```bash
git clone https://github.com/YOUR_USERNAME/daisyStockAnalysis.git
cd daisyStockAnalysis
```

### 2. Backend Setup
```bash
# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Frontend Setup
```bash
cd web
npm install
npm run build
cd ..
```

## 🚀 Usage

### Option 1: Web UI (Recommended)
Start the server (serves both API and UI):
```bash
source .venv/bin/activate
python3 server.py
```

Open your browser and navigate to: `http://localhost:8000`

### Option 2: Command Line (Real-time alerts)
```bash
source .venv/bin/activate
python3 main.py --ticker TSLA --realtime --rt-interval 1m --poll-secs 30
```

### Command Line Arguments
```
--ticker TSLA              # Stock ticker symbol
--interval 1d              # Data interval (1m, 5m, 15m, 1h, 1d)
--start 2024-01-01         # Start date
--end 2025-01-01           # End date
--realtime                 # Enable real-time monitoring
--rt-interval 1m           # Real-time interval
--rt-period 2d             # Real-time lookback period
--poll-secs 30             # Polling interval in seconds
--brk-lookback 20          # Break strategy lookback period
--brk-tolerance 0.003      # Break tolerance (0.3%)
--brk-confirm 1            # Confirmation bars
```

## 📁 Project Structure

```
daisyStockAnalysis/
├── data_provider/           # Data fetching modules
│   ├── base.py             # Abstract base class
│   └── yfinance_provider.py # YFinance implementation
├── indicators/              # Technical indicators
│   └── indicator_utils.py  # MA, MACD, RSI, BB calculations
├── strategies/              # Trading strategies
│   ├── break_retest.py     # Break & retest strategy
│   └── crossover.py        # Moving average crossover
├── web/                     # React frontend
│   ├── src/
│   │   ├── components/
│   │   │   └── TVChart.tsx # Chart component
│   │   ├── App.tsx         # Main app component
│   │   └── main.tsx        # Entry point
│   └── dist/               # Build output
├── main.py                  # CLI entry point
├── server.py               # FastAPI server
├── requirements.txt        # Python dependencies
└── .gitignore             # Git ignore rules
```

## 📊 API Endpoints

### Get OHLC Data with Indicators
```
GET /api/ohlc?ticker=TSLA&interval=1d&start=2024-01-01&end=2025-01-01
```

### Get Recent OHLC Data
```
GET /api/ohlc/recent?ticker=TSLA&interval=1m&period=1d
```

Response includes:
- OHLC data (Open, High, Low, Close)
- Technical indicators (MA10, MA30, MACD, RSI, Bollinger Bands)
- Buy/sell signals (BRK_BUY, BRK_SELL)

## 🎨 UI Features

- **Ticker Selection**: Choose any stock symbol
- **Time Range**: Select custom date ranges
- **Interval Control**: 1m, 5m, 15m, 30m, 1h, 1d
- **Strategy Parameters**: Adjust lookback, tolerance, confirmation
- **Candlestick Chart**: Interactive price visualization
- **Moving Averages**: MA10 (blue), MA30 (purple)
- **Buy/Sell Markers**: Green ▲ for buy, Red ▼ for sell

## 🔧 Development

### Run frontend in development mode
```bash
cd web
npm run dev
```

### Build frontend for production
```bash
cd web
npm run build
```

### Run backend with auto-reload
```bash
uvicorn server:app --reload
```

## 📝 TODO

- [ ] Add more trading strategies
- [ ] Support multiple data providers
- [ ] Add backtesting features
- [ ] Implement portfolio tracking
- [ ] Add more technical indicators
- [ ] Support real-time WebSocket updates

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## ⚠️ Disclaimer

This software is for educational purposes only. Do not use it for actual trading without proper testing and understanding of the risks involved. The authors are not responsible for any financial losses.

## 📧 Contact

For questions or feedback, please contact: 7huang14@gmail.com

---

**Happy Trading! 📈**

