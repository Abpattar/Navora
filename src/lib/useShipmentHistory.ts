'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ShipmentResult } from '@/lib/types';
import { readHistory, writeHistory } from '@/lib/storage';

export function useShipmentHistory() {
  const [history, setHistory] = useState<ShipmentResult[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setHistory(readHistory());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) writeHistory(history);
  }, [history, loaded]);

  const addResult = useCallback((result: ShipmentResult) => {
    setHistory((previous) => [result, ...previous.filter((item) => item.id !== result.id)].slice(0, 200));
  }, []);
  const removeResult = useCallback((id: string) => setHistory((previous) => previous.filter((item) => item.id !== id)), []);
  const clearHistory = useCallback(() => setHistory([]), []);

  return { history, addResult, removeResult, clearHistory, loaded };
}
