import CyberCandleChart from './CyberCandleChart'
import type { TVPoint } from './CyberCandleChart'

interface Props {
  data: TVPoint[]
  height?: number
}

export default function TVChart({ data, height = 520 }: Props) {
  return <CyberCandleChart data={data} height={height} />
}

export type { TVPoint }
