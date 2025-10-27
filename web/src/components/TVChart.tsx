import React from 'react'
import CyberCandleChart from './CyberCandleChart'
import type { TVPoint } from './CyberCandleChart'

interface Props {
  data: TVPoint[]
  height?: number
  showMA10?: boolean
  showMA30?: boolean
  showRSI14?: boolean
}

export default function TVChart({ data, height = 520, showMA10 = true, showMA30 = true, showRSI14 = false }: Props) {
  type ChartProps = { data: TVPoint[]; height?: number; showMA10?: boolean; showMA30?: boolean; showRSI14?: boolean }
  const ChartComp = CyberCandleChart as unknown as React.FC<ChartProps>
  return <ChartComp data={data} height={height} showMA10={showMA10} showMA30={showMA30} showRSI14={showRSI14} />
}

export type { TVPoint }
