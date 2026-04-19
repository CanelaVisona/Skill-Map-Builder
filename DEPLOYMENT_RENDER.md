# Deployment to Render (for cross-device access)

Este archivo contiene las instrucciones para desplegar la aplicación en Render, permitiendo acceso desde múltiples dispositivos (móvil y desktop).

## Pasos para Desplegar en Render

### 1. Crear una Cuenta en Render
- Ve a https://render.com
- Crea una cuenta con tu email
- Verifica tu email

### 2. Conectar tu Repositorio
- Inicia sesión en Render
- Ve a Dashboard → New → Web Service
- Selecciona "Build and deploy from a Git repository"
- Conecta tu repositorio de GitHub (o GitLab)

### 3. Configurar el Servicio
Si usas el archivo `render.yaml`:
- Render automáticamente detectará y usará la configuración
- Se creará:
  - Un servicio web (servidor Express)
  - Una base de datos PostgreSQL

Si configuras manualmente:
- **Name**: skill-map-builder
- **Runtime**: Node
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - DATABASE_URL: Se generará automáticamente si incluyes la BD
  - SESSION_SECRET: Genera un valor aleatorio largo
  - NODE_ENV: production
  - PORT: 3001

### 4. Crear la Base de Datos PostgreSQL
Si no lo hace automáticamente:
- Ve a Dashboard → New → PostgreSQL
- Configura:
  - **Name**: skill_map_db
  - **Database Name**: skill_map
  - **User**: skill_map_user
  - **Region**: Ohio (o la más cercana)
  - **Plan**: Free tier funciona para desarrollo

### 5. Conectar la Base de Datos al Servicio
- En el servicio web, ve a Environment
- Añade la variable `DATABASE_URL` con la cadena de conexión de PostgreSQL
- O usa `fromDatabase` si está configurado

### 6. Ejecutar Migraciones
Una vez desplegado:
- En Render, ve a tu servicio
- Abre la terminal Web Shell o Shell
- Ejecuta: `npm run db:push`
- Esto sincroniza el schema de Drizzle con PostgreSQL

### 7. Probar la Aplicación
- Abre la URL que Render te proporciona
- La app debería estar funcionando
- Los cambios que hagas se guardarán en la BD de Render

### 8. Usar desde Múltiples Dispositivos
**En Desktop**:
- Abre https://tu-app.render.com en el navegador

**En Móvil**:
- Abre https://tu-app.render.com en el navegador del celular
- Los datos se sincronizan automáticamente a través de la base de datos compartida

## Sincronización de Cambios Automática

Cuando haces cambios en la rama main:
1. El código se despliega automáticamente en Render
2. Las llamadas a `/api/*` siempre usan la BD compartida
3. Los cambios se reflejan instantáneamente en todos tus dispositivos

## Troubleshooting

### La BD no se conecta
- Verifica que `DATABASE_URL` esté configurado correctamente
- En el Shell de Render, ejecuta: `echo $DATABASE_URL`

### Los cambios no se ven en la otra app
- Recarga la página
- Si usas localStorage, limpia: `localStorage.clear()`
- Los datos de BD deberían sincronizarse automáticamente

### La app no inicia
- Ve a Logs en Render
- Busca errores de conexión a BD
- Verifica que `npm run build` completa exitosamente

## Variables de Entorno Importantes

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | Cadena de conexión PostgreSQL | postgresql://user:pass@host/db |
| `SESSION_SECRET` | Clave para sesiones | (generada automáticamente por Render) |
| `NODE_ENV` | Entorno | production |
| `PORT` | Puerto del servidor | 3001 |

## Nota: Sincronización en Tiempo Real

La sincronización se realiza a través de:
1. **Base de Datos Compartida**: Todos los cambios se guardan en PostgreSQL
2. **APIs REST**: Cada dispositivo consulta la BD cuando carga datos
3. **No hay WebSockets**: Por simplicidad, usa refresh manual si necesitas ver cambios inmediatos

Si necesitas actualizaciones en tiempo real sin recargar, considera agregar Socket.io en futuras versiones.
