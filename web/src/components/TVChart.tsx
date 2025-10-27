import { useEffect, useRef } from 'react'

export interface TVPoint {
  time: string
  Open?: number | null
  High?: number | null
  Low?: number | null
  Close?: number | null
  MA10?: number | null
  MA30?: number | null
  BRK_BUY?: number | null
  BRK_SELL?: number | null
}

interface Props {
  data: TVPoint[]
  height?: number
}

export default function TVChart({ data, height = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    // Clear canvas
    ctx.clearRect(0, 0, canvas.offsetWidth, height)

    if (data.length === 0) return

    // Calculate price range
    const prices = data.map(d => [d.High, d.Low, d.Close]).flat().filter(p => p != null) as number[]
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1

    const chartWidth = canvas.offsetWidth - 60
    const chartHeight = height - 40
    const chartLeft = 50
    const chartTop = 20

    // Draw grid
    ctx.strokeStyle = '#eee'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = chartTop + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(chartLeft, y)
      ctx.lineTo(chartLeft + chartWidth, y)
      ctx.stroke()
    }

    // Draw candlesticks
    const barWidth = chartWidth / data.length * 0.8
    const barSpacing = chartWidth / data.length

    data.forEach((d, i) => {
      if (d.Open == null || d.High == null || d.Low == null || d.Close == null) return

      const x = chartLeft + i * barSpacing + barSpacing / 2
      const openY = chartTop + chartHeight - ((d.Open - minPrice + padding) / (priceRange + padding * 2)) * chartHeight
      const closeY = chartTop + chartHeight - ((d.Close - minPrice + padding) / (priceRange + padding * 2)) * chartHeight
      const highY = chartTop + chartHeight - ((d.High - minPrice + padding) / (priceRange + padding * 2)) * chartHeight
      const lowY = chartTop + chartHeight - ((d.Low - minPrice + padding) / (priceRange + padding * 2)) * chartHeight

      // Color based on open vs close
      const isUp = d.Close >= d.Open
      ctx.strokeStyle = isUp ? '#2e7d32' : '#d32f2f'
      ctx.fillStyle = isUp ? '#2e7d32' : '#d32f2f'

      // Draw high-low line
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Draw body
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(closeY - openY)
      ctx.fillRect(x - barWidth/2, bodyTop, barWidth, Math.max(bodyHeight, 1))

      // Draw MA lines
      if (d.MA10 != null) {
        const ma10Y = chartTop + chartHeight - ((d.MA10 - minPrice + padding) / (priceRange + padding * 2)) * chartHeight
        ctx.strokeStyle = '#1976d2'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (i === 0) {
          ctx.moveTo(x, ma10Y)
        } else {
          ctx.lineTo(x, ma10Y)
        }
        ctx.stroke()
      }

      if (d.MA30 != null) {
        const ma30Y = chartTop + chartHeight - ((d.MA30 - minPrice + padding) / (priceRange + padding * 2)) * chartHeight
        ctx.strokeStyle = '#9c27b0'
        ctx.lineWidth = 2
        ctx.beginPath()
        if (i === 0) {
          ctx.moveTo(x, ma30Y)
        } else {
          ctx.lineTo(x, ma30Y)
        }
        ctx.stroke()
      }

      // Draw buy/sell markers
      if ((d.BRK_BUY ?? 0) >= 1) {
        ctx.fillStyle = '#2e7d32'
        ctx.beginPath()
        ctx.moveTo(x, lowY - 10)
        ctx.lineTo(x - 5, lowY - 5)
        ctx.lineTo(x + 5, lowY - 5)
        ctx.closePath()
        ctx.fill()
      }

      if ((d.BRK_SELL ?? 0) >= 1) {
        ctx.fillStyle = '#d32f2f'
        ctx.beginPath()
        ctx.moveTo(x, highY + 10)
        ctx.lineTo(x - 5, highY + 5)
        ctx.lineTo(x + 5, highY + 5)
        ctx.closePath()
        ctx.fill()
      }
    })

    // Draw price labels
    ctx.fillStyle = '#333'
    ctx.font = '12px Arial'
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (priceRange / 5) * i
      const y = chartTop + (chartHeight / 5) * i
      ctx.fillText(price.toFixed(2), 5, y + 4)
    }

  }, [data, height])

  return (
    <div style={{ width: '100%', height, border: '1px solid #ddd', borderRadius: '4px', position: 'relative' }}>
      <canvas 
        ref={canvasRef}
        style={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }}
      />
      <div style={{ 
        position: 'absolute', 
        top: 10, 
        left: 10, 
        background: 'rgba(255,255,255,0.8)', 
        padding: '4px 8px', 
        borderRadius: '4px',
        fontSize: '12px'
      }}>
        {data.length} candles | MA10: Blue | MA30: Purple | BUY: Green ▲ | SELL: Red ▼
      </div>
    </div>
  )
}