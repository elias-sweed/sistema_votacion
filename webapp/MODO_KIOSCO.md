# Modo kiosco — guía operativa

Esta guía deja una computadora lista para que los votantes emitan su voto a
pantalla completa, sin acceso al panel de administración.

> Requisitos previos: la elección debe estar **abierta**, la mesa **activa** y
> `voting-proxy` desplegada en Supabase. Cada mesa tiene su propio enlace
> `/votar/<token>`.

---

## 1. Enlace correcto por mesa

1. Entrar al panel como administrador → **Mesas**.
2. En la mesa del salón, usar **Copiar enlace**.
3. Abrir ese enlace en la máquina del salón. El voto quedará asociado a esa
   mesa.
4. Si se usa el enlace de otra mesa, el voto se contabiliza en la mesa
   equivocada. No reutilizar enlaces entre salones.

Si se regenera el enlace, el anterior deja de funcionar y la máquina debe
abrir el nuevo.

---

## 2. Abrir Chrome o Edge en modo kiosco

### Windows (recomendado)

Chrome:

```powershell
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk "https://TU-DOMINIO/votar/TOKEN"
```

Edge:

```powershell
& "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --kiosk "https://TU-DOMINIO/votar/TOKEN"
```

Atajo incluido en este repo (detecta Chrome o Edge automáticamente):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\kiosco-windows.ps1 -Url "https://TU-DOMINIO/votar/TOKEN"
```

Opciones del script:

| Parámetro | Uso |
|---|---|
| `-Url` | URL del kiosco (obligatorio). |
| `-Navegador Chrome\|Edge` | Fuerza un navegador. Por defecto busca Chrome y luego Edge. |
| `-Perfil "C:\Ruta"` | Perfil dedicado para el kiosco. Por defecto `%LOCALAPPDATA%\SistemaVotacion\kiosco`. |
| `-SinPerfil` | Usa el perfil normal del usuario (menos recomendado). |

### macOS

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk "https://TU-DOMINIO/votar/TOKEN"
```

### Linux

```bash
google-chrome --kiosk "https://TU-DOMINIO/votar/TOKEN"
```

Para salir del modo kiosco: `Alt + F4` (Windows/Linux) o `Cmd + Q` (macOS).
El personal electoral debe conocer esta combinación.

---

## 3. Perfil dedicado y sesión limpia

Usar un perfil exclusivo evita que la sesión del administrador quede abierta
en la máquina del salón:

- El script usa `--user-data-dir=%LOCALAPPDATA%\SistemaVotacion\kiosco`.
- En ese perfil no se debe iniciar sesión en `/admin`.
- Alternativa: crear un usuario de Windows exclusivo para votación.

Al terminar la jornada:

1. Cerrar el kiosco.
2. Cerrar sesión del administrador en el navegador del panel (si se usó el
   mismo equipo).
3. Si corresponde, usar **Configuración → Zona peligrosa** para limpiar el
   padrón después de la elección.

---

## 4. Preparación de la máquina

- Conectar a corriente y desactivar la suspensión/apagado de pantalla:
  **Configuración → Sistema → Inicio/apagado → Suspensión: Nunca**.
- Desactivar el protector de pantalla.
- Configurar el enlace como página de inicio o acceso directo de inicio
  automático (ver sección 5).
- Ocultar o bloquear el acceso a otras aplicaciones si el equipo es compartido.
- Verificar que la zona horaria y la fecha sean correctas.

---

## 5. Inicio automático en Windows

### Opción A — carpeta de inicio

1. `Win + R` → `shell:startup`.
2. Crear un acceso directo con destino:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "C:\ruta\al\repo\webapp\scripts\kiosco-windows.ps1" -Url "https://TU-DOMINIO/votar/TOKEN"
```

### Opción B — Programador de tareas

1. Abrir **Programador de tareas** → **Crear tarea básica**.
2. Desencadenador: **Al iniciar sesión**.
3. Acción: iniciar programa `powershell.exe` con argumentos:

```
-NoProfile -ExecutionPolicy Bypass -File "C:\ruta\al\repo\webapp\scripts\kiosco-windows.ps1" -Url "https://TU-DOMINIO/votar/TOKEN"
```

4. Desmarcar “Detener la tarea si se ejecuta más de…”.

---

## 6. Instalar como aplicación (PWA)

El sistema es instalable desde Chrome/Edge:

1. Abrir el enlace del kiosco.
2. Menú del navegador → **Instalar aplicación** / **Instalar Sistema de
   Votación**.
3. Se abre en una ventana propia, sin barra de direcciones.

El service worker cachea el shell de la app para que la pantalla cargue aunque
falle internet. **La votación sigue requiriendo conexión**: si se cae la red,
el kiosco muestra un aviso y bloquea la confirmación del voto; no se guardan
votos ni DNI en el equipo.

---

## 7. Checklist del día de la elección

- [ ] Elección abierta en **Configuración**.
- [ ] Cada mesa activa y con su enlace correcto.
- [ ] Kiosco abierto a pantalla completa y sin sesión de administrador.
- [ ] Conexión a internet verificada (abrir el enlace y ver la pantalla del DNI).
- [ ] Suspensión y protector de pantalla desactivados.
- [ ] Personal electoral sabe cómo salir del modo kiosco y a quién avisar.
- [ ] Panel de administración abierto solo en el equipo del responsable.

---

## 8. Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| “Abre el enlace de tu mesa” | URL sin token o token vacío | Usar el enlace completo de **Mesas**. |
| “Este enlace no es válido o la mesa está inactiva” | Mesa desactivada o enlace regenerado | Activar la mesa o copiar el enlace nuevo. |
| “La votación está cerrada” | `eleccion_abierta = false` | Abrir la elección en **Configuración**. |
| “No se pudo cargar la información electoral” | Sin internet o `voting-proxy` no desplegada | Revisar conexión y `npm run verify:prod`. |
| Aviso “Sin conexión” | Se perdió la red | Esperar a que vuelva; el kiosco se habilita solo. |
| El voto quedó “sin confirmación del servidor” | Respuesta de red ambigua | No reintentar: el personal debe verificar el estado del votante. |
