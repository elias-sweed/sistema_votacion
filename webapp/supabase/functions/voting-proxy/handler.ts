// Logica HTTP de voting-proxy separada del arranque de Deno para poder
// verificarla con Node en un entorno sin Docker, Supabase CLI ni Deno.
// No contiene secretos: el cliente Supabase se inyecta desde index.ts.

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface VerifyRequest {
  action: "verificar";
  dni: string;
}

interface VoteRequest {
  action: "votar";
  dni: string;
  candidato_id: string;
}

interface StatusRequest {
  action: "estado";
}

interface CandidatesRequest {
  action: "candidatos";
}

type RequestBody = VerifyRequest | VoteRequest | StatusRequest | CandidatesRequest;

interface DbError {
  message: string;
  code?: string;
}

interface DbResult {
  data: unknown;
  error: DbError | null;
}

// Solo se usa la parte de supabase-js que necesita este proxy. La interfaz
// permite inyectar un doble en las pruebas sin acoplar la logica a Deno.
export interface SupabaseLike {
  from: (table: string) => any;
  rpc: (name: string, params: Record<string, unknown>) => Promise<DbResult>;
}

export interface ProxyDependencies {
  supabase: SupabaseLike | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function logError(context: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`${context}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseRequest(value: unknown): RequestBody | null {
  if (!isRecord(value) || typeof value.action !== "string") return null;
  if (value.action === "estado") return { action: "estado" };
  if (value.action === "candidatos") return { action: "candidatos" };
  if (value.action === "verificar" && typeof value.dni === "string") {
    return { action: "verificar", dni: value.dni };
  }
  if (value.action === "votar" && typeof value.dni === "string" && typeof value.candidato_id === "string") {
    return { action: "votar", dni: value.dni, candidato_id: value.candidato_id };
  }
  return null;
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const address = forwarded.split(",")[0].trim();
    if (address) return address;
  }
  const realIp = req.headers.get("x-real-ip");
  return realIp?.trim() || "127.0.0.1";
}

export async function hashDni(dni: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dni);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function validateDni(dni: string): boolean {
  return /^\d{8}$/.test(dni);
}

export function validateUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

async function handleStatus(supabase: SupabaseLike): Promise<Response> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("eleccion_abierta, titulo")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    logError("Error al consultar el estado electoral", error);
    return json({ error: "No se pudo consultar el estado electoral" }, 500);
  }

  if (!isRecord(data)) {
    return json({ error: "No existe configuración electoral" }, 503);
  }

  return json({
    eleccion_abierta: data.eleccion_abierta === true,
    titulo: typeof data.titulo === "string" ? data.titulo : "",
  });
}

async function handleCandidates(supabase: SupabaseLike): Promise<Response> {
  const { data, error } = await supabase
    .from("candidatos")
    .select("id, nombre, foto_url")
    .eq("activo", true)
    .order("creado_en", { ascending: true });

  if (error) {
    logError("Error al consultar candidatos activos", error);
    return json({ error: "No se pudieron consultar las opciones electorales" }, 500);
  }

  const candidates = Array.isArray(data)
    ? data
      .filter((row) => isRecord(row) && typeof row.id === "string" && typeof row.nombre === "string")
      .map((row) => ({
        id: row.id,
        nombre: row.nombre,
        foto_url: typeof row.foto_url === "string" ? row.foto_url : null,
      }))
    : [];

  return json({ candidatos: candidates });
}

async function handleVerify(supabase: SupabaseLike, body: VerifyRequest, clientIp: string): Promise<Response> {
  const { dni } = body;

  if (!validateDni(dni)) {
    return json({ error: "DNI inválido" }, 400);
  }

  const dniHash = await hashDni(dni);

  const { data, error } = await supabase.rpc("verificar_votante_con_limite", {
    p_dni: dni,
    p_client_ip: clientIp,
    p_dni_hash: dniHash,
  });

  if (error) {
    logError("Error en verificar_votante_con_limite", error);
    return json({ error: "Error al verificar votante" }, 500);
  }

  const result = Array.isArray(data) && isRecord(data[0]) ? data[0] : null;

  if (!result) {
    return json({
      existe: false,
      nombre: null,
      puede_votar: false,
      rate_limited: false,
    });
  }

  const nombre = typeof result.nombre === "string" && result.nombre.length > 0
    ? result.nombre
    : null;

  return json({
    existe: nombre !== null,
    nombre,
    puede_votar: result.puede_votar === true,
    rate_limited: result.rate_limited === true,
  });
}

async function handleVote(supabase: SupabaseLike, body: VoteRequest, clientIp: string): Promise<Response> {
  const { dni, candidato_id } = body;

  if (!validateDni(dni)) {
    return json({ error: "DNI inválido" }, 400);
  }

  if (!validateUuid(candidato_id)) {
    return json({ error: "Candidato inválido", code: "P0005" }, 400);
  }

  const dniHash = await hashDni(dni);

  const { error } = await supabase.rpc("emitir_voto_con_limite", {
    p_dni: dni,
    p_candidato_id: candidato_id,
    p_client_ip: clientIp,
    p_dni_hash: dniHash,
  });

  if (error) {
    logError("Error en emitir_voto_con_limite", error);
    let message = "Error al procesar el voto";
    if (error.code === "P0003") message = "La elección está cerrada";
    else if (error.code === "P0004") message = "Este votante ya emitió su voto";
    else if (error.code === "P0005") message = "Candidato inválido";
    else if (error.code === "P0007") message = "Demasiados intentos. Espere un momento";

    return json({
      error: message,
      ...(error.code ? { code: error.code } : {}),
      confirmed: false,
    }, 400);
  }

  return json({ success: true });
}

export async function handleProxyRequest(req: Request, deps: ProxyDependencies): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ error: "JSON inválido" }, 400);
  }

  const body = parseRequest(rawBody);
  if (!body) {
    return json({ error: "Solicitud inválida" }, 400);
  }

  const clientIp = extractClientIp(req);

  if (!deps.supabase) {
    console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return json({ error: "Error de configuración del servidor" }, 500);
  }

  try {
    if (body.action === "estado") return await handleStatus(deps.supabase);
    if (body.action === "candidatos") return await handleCandidates(deps.supabase);
    if (body.action === "verificar") return await handleVerify(deps.supabase, body, clientIp);
    return await handleVote(deps.supabase, body, clientIp);
  } catch (error) {
    logError("Error inesperado en voting-proxy", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}
