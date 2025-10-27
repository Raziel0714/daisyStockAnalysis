import pandas as pd
from abc import ABC, abstractmethod

class DataProvider(ABC):
    @abstractmethod
    def get_ohlc(self, ticker: str, start: str, end: str, interval: str = "1d") -> pd.DataFrame:
        """返回含列 ['Open','High','Low','Close','Volume'] 的 DataFrame，索引为 DatetimeIndex"""
        raise NotImplementedError
