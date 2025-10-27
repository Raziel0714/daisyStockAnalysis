import { useState, useEffect } from 'react'
import axios from 'axios'
import TVChart from './components/TVChart'
import type { TVPoint } from './components/TVChart'
import './App.css'

interface AppProps {}

function App({}: AppProps) {
  const [ticker, setTicker] = useState('TSLA')
  const [interval, setInterval] = useState('1d')
  const [strategy, setStrategy] = useState<'break_retest' | 'ma_crossover'>('break_retest')
  const [brkLookback, setBrkLookback] = useState(20)
  const [brkTolerance, setBrkTolerance] = useState(0.003)
  const [brkConfirm, setBrkConfirm] = useState(1)
  const [startDate, setStartDate] = useState('2024-01-01')
  const [endDate, setEndDate] = useState('')
  const [data, setData] = useState<TVPoint[]>([])
  const [showMA10, setShowMA10] = useState(true)
  const [showMA30, setShowMA30] = useState(true)
  const [showRSI14, setShowRSI14] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchData()
  }, [ticker, interval, brkLookback, brkTolerance, brkConfirm, startDate, endDate, strategy])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = {
        ticker,
        interval,
        strategy,
        brk_lookback: brkLookback,
        brk_tolerance: brkTolerance,
        brk_confirm: brkConfirm,
        start: startDate,
      }
      if (endDate) params.end = endDate
      const resp = await axios.get('/api/ohlc', { params })
      setData(resp.data?.data ?? [])
    } catch (err) {
      setError('Failed to fetch data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // 计算统计数据
  const stats = {
    totalBars: data.length,
    buySignals: data.filter(d => (d.BRK_BUY ?? 0) >= 1).length,
    sellSignals: data.filter(d => (d.BRK_SELL ?? 0) >= 1).length,
    lastPrice: data.length > 0 ? data[data.length - 1].Close?.toFixed(2) : '-',
    priceChange: data.length > 1 && data[data.length - 1].Close != null && data[data.length - 2].Close != null
      ? ((data[data.length - 1].Close! - data[data.length - 2].Close!) / data[data.length - 2].Close! * 100).toFixed(2)
      : '-'
  }

  return (
    <div className="app-container">
      <header className="header">
        <h1>Stock Analysis</h1>
        <div className="cyber-button">
          {loading ? 'Updating...' : 'Live'}
        </div>
      </header>

      {/* Indicators on its own row (separate card) */}
      <div className="controls">
        <div className="control-group">
          <label>Indicators</label>
          <div style={{ display: 'flex', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showMA10} onChange={(e) => setShowMA10(e.target.checked)} /> MA10
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showMA30} onChange={(e) => setShowMA30(e.target.checked)} /> MA30
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="checkbox" checked={showRSI14} onChange={(e) => setShowRSI14(e.target.checked)} /> RSI14
            </label>
          </div>
        </div>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>Strategy</label>
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as 'break_retest' | 'ma_crossover')}
          >
            <option value="break_retest">Break & Retest</option>
            <option value="ma_crossover">MA Crossover (MA10/MA30)</option>
          </select>
        </div>
        <div className="control-group">
          <label>Ticker</label>
          <input
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
          />
        </div>

        <div className="control-group">
          <label>Interval</label>
          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          >
            <option value="1m">1 Minute</option>
            <option value="5m">5 Minutes</option>
            <option value="15m">15 Minutes</option>
            <option value="30m">30 Minutes</option>
            <option value="1h">1 Hour</option>
            <option value="1d">1 Day</option>
          </select>
        </div>

        <div className="control-group">
          <label>Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="control-group">
          <label>Lookback Period</label>
          <input
            type="number"
            value={brkLookback}
            onChange={(e) => setBrkLookback(Number(e.target.value))}
          />
        </div>

        <div className="control-group">
          <label>Tolerance</label>
          <input
            type="number"
            value={brkTolerance}
            onChange={(e) => setBrkTolerance(Number(e.target.value))}
            step="0.001"
          />
        </div>

        <div className="control-group">
          <label>Confirmation Bars</label>
          <input
            type="number"
            value={brkConfirm}
            onChange={(e) => setBrkConfirm(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-title">Total Bars</div>
          <div className="stat-value">{stats.totalBars}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Buy Signals</div>
          <div className="stat-value">{stats.buySignals}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Sell Signals</div>
          <div className="stat-value">{stats.sellSignals}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Last Price</div>
          <div className="stat-value">${stats.lastPrice}</div>
        </div>
        <div className="stat-card">
          <div className="stat-title">Price Change</div>
          <div className="stat-value">{stats.priceChange}%</div>
        </div>
      </div>

      <div className="chart-section">
        <div className="chart-header">
          <h2 className="chart-title">{ticker} Chart</h2>
          <button className="cyber-button" onClick={fetchData}>
            Refresh
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        
        {loading ? (
          <div className="loading">Loading...</div>
        ) : data.length > 0 ? (
          <TVChart data={data} height={520} showMA10={showMA10} showMA30={showMA30} showRSI14={showRSI14} />
        ) : (
          <div className="loading">No data available</div>
        )}
      </div>
    </div>
  )
}

export default App