// ============================================================
// voting-proxy — archivo único para desplegar desde el Dashboard
//
// Generado automáticamente desde handler.ts + index.ts.
// No editar a mano: cambia los archivos originales y regenera con
//   npm run build:function-dashboard
//
// En Supabase: Edge Functions > Deploy a new function > Via Editor
// Nombre: voting-proxy
// Verify JWT: DESACTIVADO
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  token: string;
}

interface VoteRequest {
  action: "votar";
  dni: string;
  candidato_id: string;
  token: string;
}

interface StatusRequest {
  action: "estado";
  token?: string;
}

interface CandidatesRequest {
  action: "candidatos";
  token?: string;
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

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (isRecord(error)) {
    // Los errores de PostgREST/Postgres son objetos planos. String(objeto)
    // produce "[object Object]" y oculta el diagnostico en produccion.
    const fields = [error.message, error.details, error.hint, error.code]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (fields.length > 0) return fields.join(" | ");
  }
  return String(error);
}

function logError(context: string, error: unknown) {
  console.error(`${context}: ${describeError(error)}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Los enlaces usan tokens hexadecimales de 128 bits generados por la base.
// Se acepta cualquier cadena URL-safe suficientemente larga para permitir
// rotaciones futuras sin cambiar el código.
export function validateToken(token: unknown): token is string {
  if (typeof token !== "string") return false;
  const value = token.trim();
  return value.length >= 16 && value.length <= 128 && /^[A-Za-z0-9_-]+$/.test(value);
}

type MesaInfo = { id: string; nombre: string };

async function resolveMesa(
  supabase: SupabaseLike,
  token: string,
): Promise<{ mesa: MesaInfo | null; error: unknown }> {
  const { data, error } = await supabase
    .from("mesas")
    .select("id, nombre, activo")
    .eq("token_acceso", token)
    .maybeSingle();

  if (error) return { mesa: null, error };

  if (
    !isRecord(data)
    || data.activo !== true
    || typeof data.id !== "string"
    || typeof data.nombre !== "string"
  ) {
    return { mesa: null, error: null };
  }

  return { mesa: { id: data.id, nombre: data.nombre }, error: null };
}

export function parseRequest(value: unknown): RequestBody | null {
  if (!isRecord(value) || typeof value.action !== "string") return null;
  if (value.action === "estado") {
    if (value.token === undefined) return { action: "estado" };
    if (!validateToken(value.token)) return null;
    return { action: "estado", token: value.token.trim() };
  }
  if (value.action === "candidatos") {
    if (value.token === undefined) return { action: "candidatos" };
    if (!validateToken(value.token)) return null;
    return { action: "candidatos", token: value.token.trim() };
  }
  if (value.action === "verificar" && typeof value.dni === "string" && validateToken(value.token)) {
    return { action: "verificar", dni: value.dni, token: value.token.trim() };
  }
  if (
    value.action === "votar"
    && typeof value.dni === "string"
    && typeof value.candidato_id === "string"
    && validateToken(value.token)
  ) {
    return {
      action: "votar",
      dni: value.dni,
      candidato_id: value.candidato_id,
      token: value.token.trim(),
    };
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

function mesaInvalida(): Response {
  return json({ error: "Enlace de mesa inválido o inactivo", code: "MESA_INVALIDA" }, 403);
}

async function handleStatus(supabase: SupabaseLike, body: StatusRequest): Promise<Response> {
  const { data, error } = await supabase
    .from("configuracion")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    logError("Error al consultar el estado electoral", error);
    return json({ error: "No se pudo consultar el estado electoral" }, 500);
  }

  if (!isRecord(data)) {
    return json({ error: "No existe configuración electoral" }, 503);
  }

  let mesa: MesaInfo | null = null;
  if (body.token) {
    const resolved = await resolveMesa(supabase, body.token);
    if (resolved.error) {
      logError("Error al validar la mesa del enlace", resolved.error);
      return json({ error: "No se pudo validar la mesa del enlace" }, 500);
    }
    if (!resolved.mesa) return mesaInvalida();
    mesa = resolved.mesa;
  }

  return json({
    eleccion_abierta: data.eleccion_abierta === true,
    titulo: typeof data.titulo === "string" ? data.titulo : "",
    centro: typeof data.centro === "string" ? data.centro : "",
    logo_url: typeof data.logo_url === "string" && data.logo_url.length > 0 ? data.logo_url : null,
    mesa,
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
  const { dni, token } = body;

  if (!validateDni(dni)) {
    return json({ error: "DNI inválido" }, 400);
  }

  const resolved = await resolveMesa(supabase, token);
  if (resolved.error) {
    logError("Error al validar la mesa del enlace", resolved.error);
    return json({ error: "No se pudo validar la mesa del enlace" }, 500);
  }
  if (!resolved.mesa) return mesaInvalida();

  const dniHash = await hashDni(dni);

  const { data, error } = await supabase.rpc("verificar_votante_con_limite", {
    p_dni: dni,
    p_mesa_id: resolved.mesa.id,
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
  const { dni, candidato_id, token } = body;

  if (!validateDni(dni)) {
    return json({ error: "DNI inválido" }, 400);
  }

  if (!validateUuid(candidato_id)) {
    return json({ error: "Candidato inválido", code: "P0005" }, 400);
  }

  const resolved = await resolveMesa(supabase, token);
  if (resolved.error) {
    logError("Error al validar la mesa del enlace", resolved.error);
    return json({ error: "No se pudo validar la mesa del enlace" }, 500);
  }
  if (!resolved.mesa) return mesaInvalida();

  const dniHash = await hashDni(dni);

  const { error } = await supabase.rpc("emitir_voto_con_limite", {
    p_dni: dni,
    p_candidato_id: candidato_id,
    p_mesa_id: resolved.mesa.id,
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
    else if (error.code === "P0012") message = "Mesa inválida o inactiva";
    else if (error.code === "P0013") message = "El votante no pertenece a esta mesa";

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
    if (body.action === "estado") return await handleStatus(deps.supabase, body);
    if (body.action === "candidatos") return await handleCandidates(deps.supabase);
    if (body.action === "verificar") return await handleVerify(deps.supabase, body, clientIp);
    return await handleVote(deps.supabase, body, clientIp);
  } catch (error) {
    logError("Error inesperado en voting-proxy", error);
    return json({ error: "Error interno del servidor" }, 500);
  }
}

serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = supabaseUrl && serviceRoleKey
    ? createClient(supabaseUrl, serviceRoleKey) as unknown as SupabaseLike
    : null;

  return await handleProxyRequest(req, { supabase });
});
