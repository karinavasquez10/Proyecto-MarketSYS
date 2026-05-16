// src/api.js
import axios from "axios";

const normalizeApiBaseUrl = (rawUrl) => {
  let url = rawUrl || "http://localhost:5000";
  url = url.replace(/\/+$/, "");
  return url.endsWith("/api") ? url : `${url}/api`;
};

export const API_BASE_URL = normalizeApiBaseUrl(import.meta.env.VITE_API_URL);

export const getAuthToken = () => {
  try {
    return localStorage.getItem("token") || localStorage.getItem("authToken");
  } catch {
    return null;
  }
};

export const getApiUrl = (endpoint = "") => {
  if (!endpoint) return API_BASE_URL;
  if (/^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
};

export const apiFetch = (endpoint, options = {}) => {
  const headers = new Headers(options.headers || {});
  const token = getAuthToken();

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(getApiUrl(endpoint), {
    ...options,
    headers,
  });
};

export const apiJson = async (endpoint, options = {}) => {
  const response = await apiFetch(endpoint, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    let parsedMessage = "";

    try {
      const errorData = JSON.parse(errorText);
      parsedMessage = errorData.message || errorData.error || "";
    } catch {
      parsedMessage = "";
    }

    const error = new Error(
      parsedMessage || errorText || `Error HTTP: ${response.status} - ${response.statusText}`
    );
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
};

const api = axios.create({
  baseURL: API_BASE_URL,
});

// Añadir token automáticamente si existe
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
