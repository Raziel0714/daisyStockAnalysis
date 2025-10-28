import pandas as pd
from abc import ABC, abstractmethod

class DataProvider(ABC):
    @abstractmethod
    def get_ohlc(self, ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
        """返回含列 ['Open','High','Low','Close','Volume'] 的 DataFrame，索引为 DatetimeIndex"""
        raise NotImplementedError

    @abstractmethod
    def get_recent_ohlc(self, ticker: str, period: str = "2d", interval: str = "1m") -> pd.DataFrame:
        """按 period/interval 获取近段 OHLC（用于前端recent刷新）"""
        raise NotImplementedError

    async def stream_bars(self, *args, **kwargs):  # pragma: no cover
        """可选：异步流式bars，子类可实现"""
        raise NotImplementedError
