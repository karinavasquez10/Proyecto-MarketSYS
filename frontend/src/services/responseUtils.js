export const ensureOk = async (response, fallbackMessage) => {
  if (response.ok) return;

  const errorText = await response.text().catch(() => "");
  let parsedMessage = "";

  try {
    const errorData = JSON.parse(errorText);
    parsedMessage = errorData.message || errorData.error || "";
  } catch {
    parsedMessage = "";
  }

  throw new Error(parsedMessage || errorText || fallbackMessage || `Error HTTP: ${response.status}`);
};
