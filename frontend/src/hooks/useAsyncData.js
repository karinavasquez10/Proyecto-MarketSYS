import { useCallback, useEffect, useState } from "react";

const DEFAULT_INITIAL_DATA = [];
const defaultMapData = (data) => data;

export default function useAsyncData({
  request,
  mapData = defaultMapData,
  initialData = DEFAULT_INITIAL_DATA,
  errorMessage = "Error de conexión al servidor",
  logMessage = "Error al cargar datos:",
  onSuccess,
}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(
    async (...args) => {
      try {
        setError(null);
        const response = await request(...args);
        const nextData = mapData(response, ...args);
        setData(nextData);
        if (typeof onSuccess === "function") onSuccess(nextData, ...args);
        return nextData;
      } catch (err) {
        console.error(logMessage, err);
        setError(err.message || errorMessage);
        setData(initialData);
        return initialData;
      } finally {
        setLoading(false);
      }
    },
    [errorMessage, initialData, logMessage, mapData, onSuccess, request]
  );

  useEffect(() => {
    setLoading(true);
    refetch();
  }, [refetch]);

  return {
    data,
    setData,
    loading,
    error,
    setError,
    refetch,
  };
}
