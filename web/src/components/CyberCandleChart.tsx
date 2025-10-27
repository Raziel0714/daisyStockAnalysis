import React, { useEffect, useRef } from 'react'

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
  RSI14?: number | null
}

interface Props {
  data: TVPoint[]
  height?: number
  showMA10?: boolean
  showMA30?: boolean
  showRSI14?: boolean
}

const CyberCandleChart: React.FC<Props> = ({ data, height = 520, showMA10 = true, showMA30 = true, showRSI14 = false }) => {
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
    const rsiPaneHeight = showRSI14 ? Math.max(60, Math.floor(height * 0.22)) : 0
    const paneGap = showRSI14 ? 10 : 0
    const chartHeight = height - 60 - (rsiPaneHeight + paneGap) // 主图高度，底部留给RSI和时间
    const chartLeft = 50
    const chartTop = 20
    const xAxisY = chartTop + chartHeight + (showRSI14 ? paneGap + rsiPaneHeight : 0) + 14

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
      if (showMA10 && d.MA10 != null) {
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
      if (showMA30 && d.MA30 != null) {
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

      // BUY (enhanced)
      if ((d.BRK_BUY ?? 0) >= 1) {
        // subtle vertical highlight
        ctx.save()
        ctx.strokeStyle = 'rgba(0, 230, 118, 0.12)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, chartTop)
        ctx.lineTo(x, chartTop + chartHeight)
        ctx.stroke()
        ctx.restore()

        // large up arrow with white outline and glow
        const tipY = lowY - 16
        const half = 8
        ctx.save()
        ctx.shadowColor = 'rgba(0, 230, 118, 0.6)'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#00e676'
        ctx.beginPath()
        ctx.moveTo(x, tipY)
        ctx.lineTo(x - half, tipY + 10)
        ctx.lineTo(x + half, tipY + 10)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
        ctx.restore()
      }

      // SELL (enhanced)
      if ((d.BRK_SELL ?? 0) >= 1) {
        // subtle vertical highlight
        ctx.save()
        ctx.strokeStyle = 'rgba(255, 23, 68, 0.12)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(x, chartTop)
        ctx.lineTo(x, chartTop + chartHeight)
        ctx.stroke()
        ctx.restore()

        // large down arrow with white outline and glow
        const tipY = highY + 16
        const half = 8
        ctx.save()
        ctx.shadowColor = 'rgba(255, 23, 68, 0.6)'
        ctx.shadowBlur = 8
        ctx.fillStyle = '#ff1744'
        ctx.beginPath()
        ctx.moveTo(x, tipY)
        ctx.lineTo(x - half, tipY - 10)
        ctx.lineTo(x + half, tipY - 10)
        ctx.closePath()
        ctx.fill()
        ctx.shadowBlur = 0
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ffffff'
        ctx.stroke()
        ctx.restore()
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

    // RSI pane (optional)
    if (showRSI14 && rsiPaneHeight > 0) {
      const rsiTop = chartTop + chartHeight + paneGap
      const rsiHeight = rsiPaneHeight
      const scaleRSI = (val: number) => rsiTop + rsiHeight - ((val - 0) / 100) * rsiHeight

      // background grid
      ctx.strokeStyle = '#333'
      ctx.lineWidth = 1
      for (let i = 0; i <= 4; i++) {
        const y = rsiTop + (rsiHeight / 4) * i
        ctx.beginPath()
        ctx.moveTo(chartLeft, y)
        ctx.lineTo(chartLeft + chartWidth, y)
        ctx.stroke()
      }

      // 30/70 lines
      ctx.strokeStyle = '#555'
      ;[30, 70].forEach(level => {
        const y = scaleRSI(level)
        ctx.beginPath()
        ctx.moveTo(chartLeft, y)
        ctx.lineTo(chartLeft + chartWidth, y)
        ctx.stroke()
      })

      // RSI line
      ctx.strokeStyle = '#ffca28'
      ctx.lineWidth = 1.5
      let lastY: number | null = null
      data.forEach((d, i) => {
        if (d.RSI14 == null) return
        const x = chartLeft + i * barSpacing + barSpacing / 2
        const y = scaleRSI(d.RSI14)
        if (lastY != null) {
          ctx.beginPath()
          ctx.moveTo(chartLeft + (i - 1) * barSpacing + barSpacing / 2, lastY)
          ctx.lineTo(x, y)
          ctx.stroke()
        }
        lastY = y
      })
    }

    // Time labels (X-axis)
    ctx.fillStyle = '#999'
    ctx.font = '10px Arial'
    ctx.textAlign = 'center'

    // 判断是否主要为日线数据（大多数时间为午夜）
    const sampleCount = Math.min(50, data.length)
    const dailyLikeCount = data.slice(0, sampleCount).reduce((acc, d) => {
      const dt = new Date(d.time)
      return acc + (dt.getHours() === 0 && dt.getMinutes() === 0 ? 1 : 0)
    }, 0)
    const isDaily = dailyLikeCount >= Math.max(5, Math.floor(sampleCount * 0.7))

    if (isDaily) {
      // 日线：尽量每个月一个刻度，避免重叠
      const monthTicks: Array<{ index: number; label: string }> = []
      let lastMonth = -1
      for (let i = 0; i < data.length; i++) {
        const t = data[i].time
        if (!t) continue
        const dt = new Date(t)
        const month = dt.getMonth()
        if (month !== lastMonth) {
          // 标签仅显示月份（跨年时间距足够会自然显示多个月份）
          const label = dt.toLocaleDateString([], { month: 'short' })
          monthTicks.push({ index: i, label })
          lastMonth = month
        }
      }
      // 基于像素间距去重，避免重叠
      const minPixelGap = 60 // 每个标签至少间隔60像素
      let lastX = -Infinity
      for (const tick of monthTicks) {
        const x = chartLeft + tick.index * barSpacing + barSpacing / 2
        if (x - lastX >= minPixelGap) {
          ctx.fillText(tick.label, x, xAxisY)
          lastX = x
        }
      }
    } else {
      // 分钟/小时等：根据宽度动态设置刻度数量，避免过稀
      const approxCount = Math.max(6, Math.min(20, Math.floor(chartWidth / 80)))
      const labelCount = Math.max(5, approxCount)
      for (let i = 0; i <= labelCount; i++) {
        const index = Math.floor((data.length - 1) * (i / labelCount))
        const t = data[index]?.time
        if (!t) continue
        const date = new Date(t)
        const label = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        const x = chartLeft + index * barSpacing + barSpacing / 2
        ctx.fillText(label, x, xAxisY)
      }
    }

  }, [data, height, showMA10, showMA30, showRSI14])

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
        {data.length} candles
        {showMA10 ? (
          <>
            {' '}| MA10: <span style={{ color: '#42a5f5' }}>Blue</span>
          </>
        ) : null}
        {showMA30 ? (
          <>
            {' '}| MA30: <span style={{ color: '#ba68c8' }}>Purple</span>
          </>
        ) : null}
        {showRSI14 ? (
          <>
            {' '}| RSI14: <span style={{ color: '#ffca28' }}>Gold</span>
          </>
        ) : null}
        {' '}| <span style={{ color: '#00e676' }}>BUY ▲</span> |{' '}
        <span style={{ color: '#ff1744' }}>SELL ▼</span>
      </div>
    </div>
  )
}

export default CyberCandleChart
