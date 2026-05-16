const normalizeBaseUrl = (url) => String(url || "http://127.0.0.1:5123").replace(/\/+$/, "");

const configValue = (config, key, fallback = "") => config?.[key]?.valor ?? fallback;

const appendScaleParams = (url, scaleConfig = {}) => {
  url.searchParams.set("profile", configValue(scaleConfig, "bascula.modelo", "moresco_hy_918"));
  url.searchParams.set("mode", configValue(scaleConfig, "bascula.modo", "manual"));
  url.searchParams.set("port", configValue(scaleConfig, "bascula.puerto", "COM3"));
  url.searchParams.set("baudRate", configValue(scaleConfig, "bascula.baudios", 9600));
  url.searchParams.set("dataBits", configValue(scaleConfig, "bascula.bits_datos", 8));
  url.searchParams.set("stopBits", configValue(scaleConfig, "bascula.bits_parada", 1));
  url.searchParams.set("parity", configValue(scaleConfig, "bascula.paridad", "none"));
  url.searchParams.set("unit", configValue(scaleConfig, "bascula.unidad", "kg"));
  url.searchParams.set("timeoutMs", configValue(scaleConfig, "bascula.timeout_ms", 1800));
  url.searchParams.set("maxWeight", configValue(scaleConfig, "bascula.peso_maximo", 30));
  return url;
};

const buildScaleReadUrl = ({ baseUrl, scaleConfig = {} }) => {
  return appendScaleParams(new URL(`${normalizeBaseUrl(baseUrl)}/scale/read`), scaleConfig);
};

const buildScaleStatusUrl = ({ baseUrl, scaleConfig = {} }) => {
  return appendScaleParams(new URL(`${normalizeBaseUrl(baseUrl)}/scale/status`), scaleConfig);
};

const readConnectorError = async (response, fallback) => {
  const data = await response.json().catch(() => ({}));
  return data.message || data.error || fallback;
};

export const obtenerEstadoBascula = async ({ baseUrl, scaleConfig, timeoutMs = 2500 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildScaleStatusUrl({ baseUrl, scaleConfig }), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readConnectorError(response, `Conector no disponible (${response.status})`);
      throw new Error(message);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

export const leerPesoBascula = async ({ baseUrl, scaleConfig, timeoutMs = 2500 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildScaleReadUrl({ baseUrl, scaleConfig }), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      const message = await readConnectorError(response, `Conector no disponible (${response.status})`);
      throw new Error(message);
    }

    const data = await response.json();
    if (!data.ok || data.weight == null) {
      throw new Error(data.message || "La báscula no devolvió un peso válido.");
    }

    return {
      ...data,
      weight: Number(data.weight),
    };
  } finally {
    clearTimeout(timeout);
  }
};

export const imprimirTicketTermico = async ({ baseUrl, ticket, config = {}, timeoutMs = 5000 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl || "http://127.0.0.1:5124")}/print/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ ticket, config }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || `Conector de impresión no disponible (${response.status})`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};

export const obtenerEstadoImpresora = async ({ baseUrl, timeoutMs = 2500 } = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${normalizeBaseUrl(baseUrl || "http://127.0.0.1:5124")}/print/status`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Conector de impresión no disponible (${response.status})`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
};
