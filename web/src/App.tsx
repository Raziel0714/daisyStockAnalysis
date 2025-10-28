import { useState, useEffect } from 'react'
import axios from 'axios'
import TVChart from './components/TVChart'
import type { TVPoint } from './components/TVChart'
import './App.css'

interface AppProps {}

function App({}: AppProps) {
  const [ticker, setTicker] = useState('TSLA')
  const [interval, setInterval] = useState('1d')
  // force alpaca
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
  // always streaming via WS (no toggle)
  const [wsRef, setWsRef] = useState<WebSocket | null>(null)
  const [btLoading, setBtLoading] = useState(false)
  const [btError, setBtError] = useState('')
  const [btStats, setBtStats] = useState<{ final_equity?: number; max_drawdown?: number; initial_capital?: number; final_value?: number; profit?: number; return_pct?: number } | null>(null)
  const [btEquity, setBtEquity] = useState<{ time: string; Equity?: number }[]>([])
  const [initCapital, setInitCapital] = useState(10000)

  useEffect(() => {
    fetchData()
  }, [ticker, interval, brkLookback, brkTolerance, brkConfirm, startDate, endDate, strategy])
  // Always-on WS streaming with Alpaca
  useEffect(() => {
    if (wsRef) {
      wsRef.close()
      setWsRef(null)
    }
    const url = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/bars?ticker=${encodeURIComponent(ticker)}&interval=${encodeURIComponent(interval)}&strategy=${encodeURIComponent(strategy)}&brk_lookback=${brkLookback}&brk_tolerance=${brkTolerance}&brk_confirm=${brkConfirm}`
    const ws = new WebSocket(url)
    setWsRef(ws)
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        if (msg.type === 'snapshot' && Array.isArray(msg.data)) {
          setData(msg.data)
        } else if (msg.type === 'bar' && msg.data) {
          setData(prev => {
            const copy = [...prev]
            const last = copy[copy.length - 1]
            if (last && last.time === msg.data.time) {
              copy[copy.length - 1] = msg.data
            } else {
              copy.push(msg.data)
            }
            return copy
          })
        }
      } catch {}
    }
    ws.onerror = () => {
      console.error('WS error')
    }
    ws.onclose = () => {
      setWsRef(null)
    }
    return () => {
      ws.close()
    }
  }, [ticker, interval, strategy, brkLookback, brkTolerance, brkConfirm])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const params: any = {
        ticker,
        interval,
        source: 'alpaca',
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

  // 已移除基础统计卡片

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
          <label>Backtest</label>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            Init Capital
            <input type="number" value={initCapital} onChange={(e) => setInitCapital(Number(e.target.value))} style={{ width: 120 }} />
          </label>
          <button
            className="cyber-button"
            onClick={async () => {
              setBtLoading(true)
              setBtError('')
              try {
                const params: any = {
                  ticker,
                  start: startDate,
                  end: endDate || undefined,
                  interval,
                  source: 'alpaca',
                  strategy,
                  fee_bp: 10,
                  init_capital: initCapital,
                }
                const resp = await axios.get('/api/backtest', { params })
                setBtStats(resp.data?.stats ?? null)
                setBtEquity(resp.data?.equity ?? [])
              } catch (e) {
                setBtError('Backtest failed')
                console.error(e)
              } finally {
                setBtLoading(false)
              }
            }}
          >
            Run Backtest
          </button>
          </div>
        </div>
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

      {btStats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-title">Backtest Final Equity</div>
            <div className="stat-value">{btStats.final_value?.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Max Drawdown</div>
            <div className="stat-value">{((btStats.max_drawdown || 0) * 100).toFixed(2)}%</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Profit</div>
            <div className="stat-value">{btStats.profit?.toFixed(2)}</div>
          </div>
          <div className="stat-card">
            <div className="stat-title">Return %</div>
            <div className="stat-value">{btStats.return_pct?.toFixed(2)}%</div>
          </div>
        </div>
      )}

      {btLoading && <div className="loading">Backtesting...</div>}
      {btError && <div className="error">{btError}</div>}

      {btEquity.length > 0 && (
        <div className="chart-section">
          <div className="chart-header">
            <h2 className="chart-title">Equity Curve</h2>
          </div>
          <div style={{ width: '100%', height: 120, position: 'relative', background: '#111', borderRadius: 6 }}>
            {(() => {
              const values = btEquity.map(p => {
                const v = (p as any).Equity
                return typeof v === 'number' ? v : Number(v ?? 1)
              })
              const min = Math.min(...values)
              const max = Math.max(...values)
              const w = 800
              const h = 100
              const pts = values.map((v, i) => {
                const x = (i / Math.max(1, values.length - 1)) * w
                const y = h - ((v - min) / Math.max(1e-9, (max - min))) * h
                return `${x},${y}`
              }).join(' ')
              return (
                <svg width="100%" height="120" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
                  <polyline fill="none" stroke="#42a5f5" strokeWidth="2" points={pts} />
                </svg>
              )
            })()}
          </div>
        </div>
      )}

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