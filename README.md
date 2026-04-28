# Authentiq — AI-Powered Trading Dashboard

A full-stack trading assistant built for the **Indian stock market (NSE/BSE)**, combining real-time sentiment analysis, technical indicators, and a Gemini AI chatbot to generate intelligent trading signals.

---

## 🚀 Features

### Frontend
- **Live Dashboard** — Real-time price charts, sentiment overview, and recent trading signals
- **AI Chat Assistant** — Conversational trading advisor powered by Google Gemini 1.5 Flash, with full market context (portfolio, news, signals)
- **News & Sentiment Panel** — Financial news articles with per-article sentiment scoring (positive / negative / neutral) and impact rating
- **Portfolio Management** — Tracks positions, unrealised P&L, daily P&L, and overall performance metrics
- **Trade History** — Log of all generated BUY/SELL/HOLD signals with confidence scores and reasoning
- **Backtesting Panel** — Historical strategy simulation with equity curve and performance stats
- **Alerts Panel** — Configurable alerts system
- **Config Panel** — API key management, risk tolerance, signal thresholds, and paper trading toggle
- **Dark / Light Theme** — Full theme support across all views
- **Responsive Design** — Mobile-friendly with a collapsible sidebar and mobile header

### Backend
- **JWT Authentication** — Secure login and token-based access
- **Trading Signals API** — Generates BUY/SELL/HOLD recommendations combining sentiment and technical scores
- **Market Data API** — Price data with technical indicators (RSI, MACD, Bollinger Bands, SMA)
- **News API** — Fetches and scores financial news via sentiment analysis
- **Portfolio API** — Manages positions and performance tracking
- **Chat API** — Proxies AI chat requests with market context injection
- **Alpaca Integration** — Order execution via Alpaca Markets API (paper and live)

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| Lucide React | Icons |
| Google Generative AI SDK | Gemini chatbot integration |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI (Python) | REST API server |
| SQLAlchemy + PostgreSQL | Primary database |
| Redis | Caching and background task queue |
| Celery | Async background tasks |
| Hugging Face Transformers | Sentiment analysis models |
| TA-Lib + pandas-ta | Technical indicators |
| yfinance | Market data fetching |
| Alpaca Trade API | Order execution |
| JWT (python-jose) | Authentication |

---

## 📁 Project Structure

```
Authentiq-main/
├── src/                          # React frontend
│   ├── App.tsx                   # Root component, tab routing
│   ├── components/               # UI components
│   │   ├── Dashboard.tsx
│   │   ├── ChatAssistant.tsx
│   │   ├── NewsPanel.tsx
│   │   ├── Portfolio.tsx
│   │   ├── TradeHistory.tsx
│   │   ├── BacktestPanel.tsx
│   │   ├── AlertsPanel.tsx
│   │   ├── ConfigPanel.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MobileHeader.tsx
│   │   ├── PriceChart.tsx
│   │   ├── TechnicalIndicators.tsx
│   │   ├── SentimentOverview.tsx
│   │   ├── MarketSummary.tsx
│   │   ├── RecentSignals.tsx
│   │   └── WatchlistPanel.tsx
│   ├── contexts/
│   │   ├── ThemeContext.tsx       # Dark/light mode
│   │   └── TradingContext.tsx    # Global trading state
│   ├── services/
│   │   └── aiService.ts          # Gemini API integration
│   ├── types/
│   │   └── trading.ts            # TypeScript interfaces
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Helper utilities
│   └── data/                     # Mock/static data
│
├── backend/                      # FastAPI backend
│   ├── app/
│   │   ├── main.py               # App entrypoint, lifespan, CORS
│   │   ├── database.py           # SQLAlchemy engine setup
│   │   ├── config.py             # Pydantic settings (reads .env)
│   │   ├── api/v1/
│   │   │   ├── api.py            # Route registration
│   │   │   └── endpoints/
│   │   │       ├── auth.py
│   │   │       ├── trading.py
│   │   │       ├── portfolio.py
│   │   │       ├── news.py
│   │   │       ├── chat.py
│   │   │       └── market_data.py
│   │   ├── services/
│   │   │   ├── ai_service.py
│   │   │   ├── alpaca_service.py
│   │   │   ├── news_service.py
│   │   │   ├── sentiment_service.py
│   │   │   ├── trading_service.py
│   │   │   └── notification_service.py
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   └── utils/
│   ├── requirements.txt
│   └── Dockerfile
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## ⚙️ Getting Started

### Prerequisites
- Node.js 18+
- Python 3.9+
- PostgreSQL
- Redis

### 1. Clone the repository
```bash
git clone https://github.com/your-username/authentiq.git
cd authentiq
```

### 2. Frontend Setup
```bash
npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

### 3. Frontend Environment Variables
Create a `.env` file in the project root:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_NEWS_API_KEY=your_news_api_key
VITE_ALPACA_API_KEY=your_alpaca_api_key
```

### 4. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Backend Environment Variables
Create a `.env` file inside the `backend/` directory:
```env
API_KEY=your_internal_api_key
DATABASE_URL=postgresql://user:password@localhost:5432/authentiq
REDIS_URL=redis://localhost:6379
ALPACA_API_KEY=your_alpaca_key
ALPACA_SECRET_KEY=your_alpaca_secret
NEWS_API_KEY=your_news_api_key
GEMINI_API_KEY=your_gemini_api_key
SECRET_KEY=your_jwt_secret_key
```

### 6. Run the Backend
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at `http://localhost:8000/api/v1/openapi.json` and Swagger UI at `http://localhost:8000/docs`.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/auth/login` | User login, returns JWT |
| GET | `/api/v1/market-data/{symbol}` | Price data + technical indicators |
| GET | `/api/v1/news/{symbol}` | News articles with sentiment scores |
| POST | `/api/v1/trading/signals` | Generate BUY/SELL/HOLD signal |
| GET | `/api/v1/portfolio` | Portfolio positions and P&L |
| POST | `/api/v1/chat` | AI chat with market context |

---

## AI Integration

### Chat Assistant (Gemini 1.5 Flash)
The `ChatAssistant` component uses the `aiService` to call `gemini-1.5-flash` with a rich system prompt that includes:
- Current symbol and portfolio value (in INR ₹)
- Recent BUY/SELL/HOLD signals with confidence and sentiment scores
- Latest news headlines and their sentiment labels
- All open portfolio positions and unrealised P&L

The model is tuned to respond in the context of the **Indian market (NSE/BSE)**, using IST trading hours (9:15 AM – 3:30 PM) and INR currency.

### Sentiment Analysis (Backend)
The backend `sentiment_service` uses Hugging Face Transformer models (e.g. FinBERT) to score news articles on a scale of -1 (bearish) to +1 (bullish).

### Signal Generation
Trading signals combine:
- `sentimentWeight` × sentiment score
- `technicalWeight` × technical score (RSI, MACD, Bollinger Bands)

Both weights are configurable per user in the Config Panel.

---

## Docker

```bash
# Backend
docker build -t authentiq-backend ./backend
docker run -p 8000:8000 --env-file backend/.env authentiq-backend
```

A `docker-compose.yml` can be added to orchestrate PostgreSQL, Redis, and the API server together.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'Add your feature'`
4. Push and open a Pull Request