import { useEffect, useMemo, useState } from 'react'
import axios from 'axios'
import TVChart from './components/TVChart'

interface DataPoint {
  time: string
  Open?: number | null
  High?: number | null
  Low?: number | null
  Close?: number | null
  Volume?: number | null
  MA10?: number | null
  MA30?: number | null
  BRK_BUY?: number | null
  BRK_SELL?: number | null
  MACD?: number | null
  MACD_signal?: number | null
  MACD_hist?: number | null
}

function formatTimeLabel(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleString()
  } catch {
    return ts
  }
}

function App() {
  const [ticker, setTicker] = useState('TSLA')
  const [interval, setInterval] = useState('1d')
  const todayIso = useMemo(() => new Date().toISOString().slice(0,10), [])
  const [start, setStart] = useState('2024-01-01')
  const [end, setEnd] = useState('')
  const [lookback, setLookback] = useState(20)
  const [tolerance, setTolerance] = useState(0.003)
  const [confirmBars, setConfirmBars] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DataPoint[]>([])

  // Use same-origin when the app is served by FastAPI on one port
  const backendBase = useMemo(() => '', [])

  const fetchData = async () => {
    setLoading(true)
    try {
      setError(null)
      const params: Record<string, string | number> = {
        ticker,
        interval,
        brk_lookback: lookback,
        brk_tolerance: tolerance,
        brk_confirm: confirmBars,
      }
      // Validate dates: if end < start, clear end
      const effEnd = end && end >= start ? end : ''
      if (start) params.start = start
      if (effEnd) params.end = effEnd
      const resp = await axios.get(`${backendBase}/api/ohlc`, { params })
      setData(resp.data?.data ?? [])
    } catch (e) {
      console.error(e)
      setError('Failed to load data')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // derive basic summary
  const rows = data.length
  const firstTs = rows ? data[0].time : ''
  const lastTs = rows ? data[rows - 1].time : ''

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Daisy Stock Analysis</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          Ticker:
          <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} style={{ marginLeft: 6 }} />
        </label>
        <label>
          Interval:
          <select value={interval} onChange={e => setInterval(e.target.value)} style={{ marginLeft: 6 }}>
            <option value="1d">1d</option>
            <option value="1h">1h</option>
            <option value="30m">30m</option>
            <option value="15m">15m</option>
            <option value="5m">5m</option>
            <option value="1m">1m</option>
          </select>
        </label>
        <label>
          Start:
          <input type="date" value={start} onChange={e => setStart(e.target.value)} style={{ marginLeft: 6 }} />
        </label>
        <label>
          End:
          <input type="date" value={end} max={todayIso} onChange={e => setEnd(e.target.value)} style={{ marginLeft: 6 }} />
        </label>
        <label>
          Lookback:
          <input type="number" min={5} max={200} value={lookback} onChange={e => setLookback(parseInt(e.target.value || '20'))} style={{ width: 80, marginLeft: 6 }} />
        </label>
        <label>
          Tolerance:
          <input type="number" step={0.001} value={tolerance} onChange={e => setTolerance(parseFloat(e.target.value || '0.003'))} style={{ width: 100, marginLeft: 6 }} />
        </label>
        <label>
          Confirm:
          <input type="number" min={1} max={5} value={confirmBars} onChange={e => setConfirmBars(parseInt(e.target.value || '1'))} style={{ width: 80, marginLeft: 6 }} />
        </label>
        <button onClick={fetchData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      <div style={{ fontSize: 13, color: '#555' }}>
        {error && <span style={{ color: '#d32f2f', marginRight: 12 }}>{error}</span>}
        <span>Rows: {rows}</span>
        {rows > 0 && <span style={{ marginLeft: 12 }}>Range: {formatTimeLabel(firstTs)} → {formatTimeLabel(lastTs)}</span>}
      </div>

      <div style={{ height: 520, border: '1px solid #ddd' }}>
        {data.length > 0 ? (
          <TVChart data={data} />
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#666' }}>
            {loading ? 'Loading...' : 'No data available'}
          </div>
        )}
      </div>

      {rows === 0 && !loading && !error && (
        <div style={{ color: '#777', fontSize: 14 }}>No data for the selected range/interval. Try clearing End or changing Interval.</div>
      )}
    </div>
  )
}

export default App
