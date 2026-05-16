import http from "node:http";

const PORT = Number(process.env.MARKETSYS_SCALE_CONNECTOR_PORT || 5123);
const HOST = process.env.MARKETSYS_SCALE_CONNECTOR_HOST || "127.0.0.1";

const defaultScaleProfile = {
  profile: process.env.MARKETSYS_SCALE_PROFILE || "moresco_hy_918",
  mode: process.env.MARKETSYS_SCALE_MODE || "mock",
  port: process.env.MARKETSYS_SCALE_PORT || "COM3",
  baudRate: Number(process.env.MARKETSYS_SCALE_BAUD_RATE || 9600),
  dataBits: Number(process.env.MARKETSYS_SCALE_DATA_BITS || 8),
  stopBits: Number(process.env.MARKETSYS_SCALE_STOP_BITS || 1),
  parity: process.env.MARKETSYS_SCALE_PARITY || "none",
  unit: process.env.MARKETSYS_SCALE_UNIT || "kg",
  timeoutMs: Number(process.env.MARKETSYS_SCALE_TIMEOUT_MS || 1800),
  maxWeight: Number(process.env.MARKETSYS_SCALE_MAX_WEIGHT || 30),
  mockWeight: process.env.MARKETSYS_SCALE_MOCK_WEIGHT,
};

const numericParam = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const getScaleProfile = (url) => ({
  profile: url.searchParams.get("profile") || defaultScaleProfile.profile,
  mode: url.searchParams.get("mode") || defaultScaleProfile.mode,
  port: url.searchParams.get("port") || defaultScaleProfile.port,
  baudRate: numericParam(url.searchParams.get("baudRate"), defaultScaleProfile.baudRate),
  dataBits: numericParam(url.searchParams.get("dataBits"), defaultScaleProfile.dataBits),
  stopBits: numericParam(url.searchParams.get("stopBits"), defaultScaleProfile.stopBits),
  parity: url.searchParams.get("parity") || defaultScaleProfile.parity,
  unit: url.searchParams.get("unit") || defaultScaleProfile.unit,
  timeoutMs: numericParam(url.searchParams.get("timeoutMs"), defaultScaleProfile.timeoutMs),
  maxWeight: numericParam(url.searchParams.get("maxWeight"), defaultScaleProfile.maxWeight),
  mockWeight: numericParam(url.searchParams.get("mockWeight"), numericParam(defaultScaleProfile.mockWeight, null)),
});

const sendJson = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(data));
};

const parseMockWeight = (raw = process.env.MARKETSYS_SCALE_MOCK_WEIGHT) => {
  if (!raw) return null;
  const weight = Number(raw);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
};

const normalizeSerialText = (value) => String(value || "").replace(/\u0002|\u0003/g, " ").replace(/\s+/g, " ").trim();

const parseWeightFromFrame = (frame, { maxWeight = 30 } = {}) => {
  const text = normalizeSerialText(frame).replace(/,/g, ".");
  const matches = [...text.matchAll(/[-+]?\d+(?:\.\d+)?/g)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= maxWeight);

  if (matches.length === 0) return null;

  const positive = matches.filter((value) => value > 0);
  return positive.length > 0 ? positive[positive.length - 1] : matches[matches.length - 1];
};

const loadSerialPort = async () => {
  try {
    const serial = await import("serialport");
    return serial.SerialPort;
  } catch (error) {
    const friendly = new Error("La dependencia serialport no esta instalada. Ejecuta npm install en tools/scale-connector.");
    friendly.cause = error;
    throw friendly;
  }
};

const closePortQuietly = (port) => {
  if (!port || !port.isOpen) return;
  port.close((error) => {
    if (error) console.warn("No se pudo cerrar el puerto serial:", error.message);
  });
};

const readSerialScale = async (scaleProfile) => {
  const SerialPort = await loadSerialPort();

  return new Promise((resolve) => {
    let buffer = "";
    let settled = false;

    const port = new SerialPort({
      path: scaleProfile.port,
      baudRate: scaleProfile.baudRate,
      dataBits: scaleProfile.dataBits,
      stopBits: scaleProfile.stopBits,
      parity: scaleProfile.parity,
      autoOpen: false,
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      closePortQuietly(port);
      resolve({
        ...result,
        raw: normalizeSerialText(buffer),
        unit: scaleProfile.unit,
        profile: scaleProfile.profile,
        port: scaleProfile.port,
        baudRate: scaleProfile.baudRate,
        receivedAt: new Date().toISOString(),
      });
    };

    const timeout = setTimeout(() => {
      const parsed = parseWeightFromFrame(buffer, scaleProfile);
      if (parsed !== null) {
        finish({ ok: true, source: "rs232", weight: parsed });
      } else {
        finish({
          ok: false,
          source: "rs232_timeout",
          weight: null,
          message: "No se recibio un peso valido desde la bascula antes del tiempo limite.",
        });
      }
    }, scaleProfile.timeoutMs);

    port.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const parsed = parseWeightFromFrame(buffer, scaleProfile);
      if (parsed !== null) {
        finish({ ok: true, source: "rs232", weight: parsed });
      }
    });

    port.on("error", (error) => {
      finish({
        ok: false,
        source: "rs232_error",
        weight: null,
        message: error.message,
      });
    });

    port.open((error) => {
      if (error) {
        finish({
          ok: false,
          source: "rs232_open_error",
          weight: null,
          message: error.message,
        });
      }
    });
  });
};

const readScale = async (scaleProfile) => {
  const mockWeight = parseMockWeight() || numericParam(scaleProfile.mockWeight, null);

  if (scaleProfile.mode === "mock") {
    const weight = mockWeight && mockWeight > 0 ? mockWeight : 0.5;
    return {
      ok: true,
      source: "mock",
      weight,
      unit: scaleProfile.unit,
      profile: scaleProfile.profile,
      port: scaleProfile.port,
      receivedAt: new Date().toISOString(),
    };
  }

  if (scaleProfile.mode === "rs232") {
    try {
      return await readSerialScale(scaleProfile);
    } catch (error) {
      return {
        ok: false,
        source: "rs232_setup_error",
        weight: null,
        unit: scaleProfile.unit,
        profile: scaleProfile.profile,
        port: scaleProfile.port,
        baudRate: scaleProfile.baudRate,
        message: error.message,
        receivedAt: new Date().toISOString(),
      };
    }
  }

  return {
    ok: false,
    source: "manual_mode",
    weight: null,
    unit: scaleProfile.unit,
    profile: scaleProfile.profile,
    port: scaleProfile.port,
    baudRate: scaleProfile.baudRate,
    message: "Conector activo en modo manual. Cambia el modo a Simulacion para pruebas o a RS232 para leer el puerto serial real.",
    receivedAt: new Date().toISOString(),
  };
};

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    return sendJson(res, 204, {});
  }

  const url = new URL(req.url || "/", `http://${HOST}:${PORT}`);

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "marketsys-scale-connector",
      ...defaultScaleProfile,
      now: new Date().toISOString(),
    });
  }

  if (req.method === "GET" && url.pathname === "/scale/status") {
    const scaleProfile = getScaleProfile(url);
    return sendJson(res, 200, {
      ok: true,
      connected: scaleProfile.mode === "mock" || scaleProfile.mode === "rs232" || Boolean(parseMockWeight()),
      realSerialEnabled: scaleProfile.mode === "rs232",
      ...scaleProfile,
    });
  }

  if (req.method === "GET" && url.pathname === "/scale/read") {
    const scaleProfile = getScaleProfile(url);
    const result = await readScale(scaleProfile);
    const status = result.ok ? "OK" : "ERROR";
    const detail = result.ok
      ? `${result.weight} ${result.unit || scaleProfile.unit}`
      : result.message || result.source || "Lectura sin detalle";
    console.log(`[scale/read] ${status} mode=${scaleProfile.mode} port=${scaleProfile.port} source=${result.source || "unknown"} detail=${detail}`);
    if (!result.ok && result.raw) {
      console.log(`[scale/read] raw=${result.raw}`);
    }
    return sendJson(res, result.ok ? 200 : 503, result);
  }

  return sendJson(res, 404, {
    ok: false,
    message: "Ruta no encontrada",
  });
});

server.listen(PORT, HOST, () => {
  console.log(`MarketSYS scale connector listening at http://${HOST}:${PORT}`);
  console.log(`Profile: ${defaultScaleProfile.profile}, port: ${defaultScaleProfile.port}, baud: ${defaultScaleProfile.baudRate}, unit: ${defaultScaleProfile.unit}`);
});
