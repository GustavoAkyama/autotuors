/** Calls the local server; failures throw with the server's message and status. */
export async function api(method, url, body) {
  const response = await fetch(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body && JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "Algo deu errado."), {
      status: response.status,
    });
  return data;
}

export const getState = () => api("GET", "/api/state");
export const getChoices = () => api("GET", "/api/choices");
export const getTour = (name) =>
  api("GET", `/api/tours/${encodeURIComponent(name)}`);
export const saveTour = (name, edits) =>
  api("PUT", `/api/tours/${encodeURIComponent(name)}`, edits);
export const deleteTour = (name) =>
  api("DELETE", `/api/tours/${encodeURIComponent(name)}`);
export const deleteSession = (name) =>
  api("DELETE", `/api/sessions/${encodeURIComponent(name)}`);
export const startLogin = (body) => api("POST", "/api/login", body);
export const startRecording = (body) => api("POST", "/api/record", body);
export const startVideo = (name) => api("POST", "/api/play", { name });
export const stopJob = () => api("POST", "/api/stop");
export const cancelJob = () => api("POST", "/api/cancel");
