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

export default function CyberCandleChart({ data, height = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = height * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)

    ctx.clearRect(0, 0, canvas.offsetWidth, height)

    const prices = data
      .map(d => [d.High, d.Low, d.Close])
      .flat()
      .filter(p => p != null) as number[]
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1

    const chartWidth = canvas.offsetWidth - 60
    const chartHeight = height - 60 // 留出空间放时间标签
    const chartLeft = 50
    const chartTop = 20

    ctx.strokeStyle = '#444'
    ctx.lineWidth = 1
    for (let i = 0; i <= 5; i++) {
      const y = chartTop + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(chartLeft, y)
      ctx.lineTo(chartLeft + chartWidth, y)
      ctx.stroke()
    }

    const barWidth = (chartWidth / data.length) * 0.8
    const barSpacing = chartWidth / data.length

    let lastMA10Y: number | null = null
    let lastMA30Y: number | null = null

    data.forEach((d, i) => {
      if (d.Open == null || d.High == null || d.Low == null || d.Close == null) return

      const x = chartLeft + i * barSpacing + barSpacing / 2
      const scaleY = (val: number) =>
        chartTop +
        chartHeight -
        ((val - minPrice + padding) / (priceRange + padding * 2)) * chartHeight

      const openY = scaleY(d.Open)
      const closeY = scaleY(d.Close)
      const highY = scaleY(d.High)
      const lowY = scaleY(d.Low)

      const isUp = d.Close >= d.Open
      ctx.strokeStyle = isUp ? '#00e676' : '#ff1744'
      ctx.fillStyle = isUp ? '#00e676' : '#ff1744'

      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.abs(closeY - openY)
      ctx.fillRect(x - barWidth / 2, bodyTop, barWidth, Math.max(bodyHeight, 1))

      // MA10
      if (d.MA10 != null) {
        const y = scaleY(d.MA10)
        ctx.strokeStyle = '#42a5f5'
        ctx.lineWidth = 1.5
        if (lastMA10Y != null) {
          ctx.beginPath()
          ctx.moveTo(chartLeft + (i - 1) * barSpacing + barSpacing / 2, lastMA10Y)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        lastMA10Y = y
      }

      // MA30
      if (d.MA30 != null) {
        const y = scaleY(d.MA30)
        ctx.strokeStyle = '#ba68c8'
        ctx.lineWidth = 1.5
        if (lastMA30Y != null) {
          ctx.beginPath()
          ctx.moveTo(chartLeft + (i - 1) * barSpacing + barSpacing / 2, lastMA30Y)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        lastMA30Y = y
      }

      // BUY
      if ((d.BRK_BUY ?? 0) >= 1) {
        ctx.fillStyle = '#00e676'
        ctx.beginPath()
        ctx.moveTo(x, lowY - 10)
        ctx.lineTo(x - 5, lowY - 3)
        ctx.lineTo(x + 5, lowY - 3)
        ctx.closePath()
        ctx.fill()
      }

      // SELL
      if ((d.BRK_SELL ?? 0) >= 1) {
        ctx.fillStyle = '#ff1744'
        ctx.beginPath()
        ctx.moveTo(x, highY + 10)
        ctx.lineTo(x - 5, highY + 3)
        ctx.lineTo(x + 5, highY + 3)
        ctx.closePath()
        ctx.fill()
      }
    })

    // Price labels (Y-axis)
    ctx.fillStyle = '#999'
    ctx.font = '12px Arial'
    ctx.textAlign = 'left'
    for (let i = 0; i <= 5; i++) {
      const price = maxPrice - (priceRange / 5) * i
      const y = chartTop + (chartHeight / 5) * i
      ctx.fillText(price.toFixed(2), 5, y + 4)
    }

    // Time labels (X-axis)
    ctx.fillStyle = '#999'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'
    const labelCount = 5
    for (let i = 0; i <= labelCount; i++) {
      const index = Math.floor((data.length - 1) * (i / labelCount))
      const t = data[index].time
      if (!t) continue
      const label = new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      const x = chartLeft + index * barSpacing + barSpacing / 2
      ctx.fillText(label, x, chartTop + chartHeight + 14)
    }

  }, [data, height])

  return (
    <div style={{ width: '100%', height, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          borderRadius: '6px',
          backgroundColor: '#111',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          background: 'rgba(0,0,0,0.6)',
          padding: '6px 10px',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
          fontWeight: 500,
          letterSpacing: '0.5px',
        }}
      >
        {data.length} candles | MA10: <span style={{ color: '#42a5f5' }}>Blue</span> | MA30:{' '}
        <span style={{ color: '#ba68c8' }}>Purple</span> |{' '}
        <span style={{ color: '#00e676' }}>BUY ▲</span> |{' '}
        <span style={{ color: '#ff1744' }}>SELL ▼</span>
      </div>
    </div>
  )
}
