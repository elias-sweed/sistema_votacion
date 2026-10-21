import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
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

type RequestBody = VerifyRequest | VoteRequest;

function extractClientIp(req: Request): string {
  // Prioridad de headers para obtener IP real detrás de proxy
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for puede tener múltiples IPs: "client, proxy1, proxy2"
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  // Fallback (no debería ocurrir en producción con proxy correcto)
  return "127.0.0.1";
}

async function hashDni(dni: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dni);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateDni(dni: string): boolean {
  // Solo dígitos, longitud 8
  return /^\d{8}$/.test(dni);
}

function validateUuid(uuid: string): boolean {
  // UUID v4 básico
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método no permitido" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verificar que venga de un origen permitido (opcional, según configuración)
  // const origin = req.headers.get("origin");
  // if (!allowedOrigins.includes(origin)) { ... }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON inválido" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = extractClientIp(req);

  // Crear cliente Supabase con service_role (solo en Edge Function)
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltan variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    return new Response(JSON.stringify({ error: "Error de configuración del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (body.action === "verificar") {
      const { dni } = body as VerifyRequest;

      if (!validateDni(dni)) {
        return new Response(JSON.stringify({ error: "DNI inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dniHash = await hashDni(dni);

      const { data, error } = await supabase.rpc("verificar_votante_con_limite", {
        p_dni: dni,
        p_client_ip: clientIp,
        p_dni_hash: dniHash,
      });

      if (error) {
        console.error("Error en verificar_votante_con_limite:", error);
        // No exponer detalles internos
        return new Response(JSON.stringify({ error: "Error al verificar votante" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // data es un array con un elemento: { nombre, mesa, puede_votar, rate_limited }
      const result = data?.[0] || { nombre: null, mesa: null, puede_votar: false, rate_limited: false };

      return new Response(JSON.stringify({
        nombre: result.nombre,
        mesa: result.mesa,
        puede_votar: result.puede_votar,
        rate_limited: result.rate_limited,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (body.action === "votar") {
      const { dni, candidato_id } = body as VoteRequest;

      if (!validateDni(dni)) {
        return new Response(JSON.stringify({ error: "DNI inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!validateUuid(candidato_id)) {
        return new Response(JSON.stringify({ error: "Candidato inválido" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dniHash = await hashDni(dni);

      const { error } = await supabase.rpc("emitir_voto_con_limite", {
        p_dni: dni,
        p_candidato_id: candidato_id,
        p_client_ip: clientIp,
        p_dni_hash: dniHash,
      });

      if (error) {
        console.error("Error en emitir_voto_con_limite:", error);
        // Mapear códigos de error a mensajes amigables
        let message = "Error al procesar el voto";
        if (error.code === "P0003") message = "La elección está cerrada";
        else if (error.code === "P0004") message = "Este votante ya emitió su voto";
        else if (error.code === "P0005") message = "Candidato inválido";
        else if (error.code === "P0007") message = "Demasiados intentos. Espere un momento";

        return new Response(JSON.stringify({ error: message, code: error.code }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else {
      return new Response(JSON.stringify({ error: "Acción no válida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Error inesperado en voting-proxy:", err);
    return new Response(JSON.stringify({ error: "Error interno del servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});