export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (import.meta.env.MODE === "portfolio") {
    throw new Error("Демо использует только синтетические данные и не подключается к API.");
  }
  return fetch(input, init);
}
