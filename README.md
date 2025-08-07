# Athlyze 🏃‍♂️

**Tu compañero para una vida más saludable**

Athlyze es una aplicación web monolítica desarrollada en Node.js que te ayuda a registrar y monitorear tus actividades físicas, alimentación y medidas corporales, proporcionando reportes de progreso y consejos personalizados.

## 🚀 Características

### Plan Starter (Disponible)

- ✅ **US-001**: Registro manual de actividades (ejercicios, alimentación, medidas físicas)
- ✅ **US-002**: Reportes de progreso con gráficos interactivos (Chart.js)
- ✅ **US-003**: Consejos automáticos simples basados en patrones detectados

### Funcionalidades Técnicas

- 🔐 Sistema de autenticación con sesiones
- 📊 Gráficos interactivos con Chart.js
- 📱 Diseño responsive con Bootstrap 5
- 🎨 Interfaz moderna y intuitiva
- 🔍 Filtros y búsqueda de actividades
- 📈 Análisis de patrones para sugerencias automáticas

## 🛠️ Tecnologías Utilizadas

- **Backend**: Node.js, Express.js
- **Base de datos**: PostgreSQL con driver nativo `pg`
- **Frontend**: EJS (plantillas), Bootstrap 5, Chart.js
- **Autenticación**: express-session (sesiones en memoria)
- **Validación**: express-validator
- **Seguridad**: bcryptjs para hash de contraseñas

## 📋 Requisitos Previos

- Node.js (versión 16 o superior)
- PostgreSQL (versión 12 o superior)
- npm o yarn

## 🔧 Instalación y Configuración

### 1. Clonar el repositorio

```bash
git clone <tu-repo-url>
cd athlyze
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar la base de datos PostgreSQL

#### Opción A: Instalación local de PostgreSQL

**En Ubuntu/Debian:**

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**En macOS:**

```bash
brew install postgresql
brew services start postgresql
```

**En Windows:**
Descargar desde: <https://www.postgresql.org/download/windows/>

#### Opción B: Usar Docker

```bash
docker run --name athlyze-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=athlyze -p 5432:5432 -d postgres:15
```

### 4. Crear la base de datos

```bash
# Conectar a PostgreSQL
sudo -u postgres psql

# Crear la base de datos
CREATE DATABASE athlyze;

# Crear usuario (opcional)
CREATE USER athlyze_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE athlyze TO athlyze_user;

# Salir
\q
```

### 5. Ejecutar el script de la base de datos

```bash
# Ejecutar el script SQL
psql -U postgres -d athlyze -f db/schema.sql

# O si creaste un usuario específico:
psql -U athlyze_user -d athlyze -f db/schema.sql
```

### 6. Configurar variables de entorno (opcional)

Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de datos
DB_USER=postgres
DB_HOST=localhost
DB_NAME=athlyze
DB_PASSWORD=password
DB_PORT=5432

# Aplicación
PORT=3000
NODE_ENV=development
```

### 7. Ejecutar la aplicación

#### Modo desarrollo (con reinicio automático)

```bash
npm run dev
```

#### Modo producción

```bash
npm start
```

La aplicación estará disponible en: <http://localhost:3000>

## 🗂️ Estructura del Proyecto

```
athlyze/
├── app.js                 # Archivo principal de la aplicación
├── package.json           # Dependencias y scripts
├── README.md             # Este archivo
├── db/
│   ├── database.js       # Configuración de PostgreSQL
│   └── schema.sql        # Script de creación de tablas
├── routes/
│   ├── auth.js          # Rutas de autenticación
│   ├── dashboard.js     # Dashboard principal
│   ├── activities.js    # Gestión de actividades
│   ├── reports.js       # Reportes y gráficos
│   └── suggestions.js   # Consejos y sugerencias
├── views/
│   ├── index.ejs        # Página de inicio
│   ├── 404.ejs          # Página de error 404
│   ├── 500.ejs          # Página de error 500
│   ├── auth/
│   │   ├── login.ejs    # Formulario de login
│   │   └── register.ejs # Formulario de registro
│   ├── dashboard/
│   │   └── index.ejs    # Dashboard principal
│   └── activities/
│       ├── index.ejs    # Lista de actividades
│       └── new.ejs      # Formulario nueva actividad
└── public/
    ├── css/
    │   └── style.css    # Estilos personalizados
    └── js/
        └── app.js       # JavaScript del cliente
```

## 🔑 Rutas Principales

- `/` - Página de inicio
- `/register` - Registro de usuario
- `/login` - Inicio de sesión
- `/dashboard` - Dashboard principal (requiere autenticación)
- `/activities` - Lista de actividades
- `/activities/new` - Registrar nueva actividad
- `/reports` - Reportes y gráficos
- `/suggestions` - Consejos personalizados

## 👤 Usuario Demo

Para probar la aplicación, puedes usar la cuenta demo:

- **Email**: <demo@athlyze.com>
- **Contraseña**: password

## 🗄️ Base de Datos

### Tablas principales

1. **users** - Información de usuarios
2. **activities** - Registro de actividades (ejercicios, comidas, medidas)
3. **suggestions** - Sugerencias y consejos automáticos

### Datos de ejemplo incluidos

- Usuario demo con actividades de muestra
- Sugerencias automáticas de ejemplo

## 🚀 Funcionalidades Implementadas

### ✅ US-001: Registro Manual de Actividades

- Formulario intuitivo para registrar ejercicios, comidas y medidas
- Campos específicos según el tipo de actividad
- Validación de formularios (cliente y servidor)
- Almacenamiento seguro en PostgreSQL

### ✅ US-002: Reportes de Progreso

- Dashboard con estadísticas generales
- Gráficos interactivos con Chart.js
- Filtros por fecha y tipo de actividad
- Visualización de tendencias y progreso

### ✅ US-003: Consejos Automáticos

- Análisis de patrones de actividad
- Generación automática de sugerencias personalizadas
- Consejos categorizados (ejercicio, nutrición, medidas)
- Sistema de notificaciones de consejos

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt
- Validación de entrada con express-validator
- Sesiones seguras con express-session
- Prevención de inyección SQL con consultas parametrizadas
- Control de acceso basado en sesiones

## 🎨 Interfaz de Usuario

- **Bootstrap 5** para diseño responsive
- **Bootstrap Icons** para iconografía consistente
- **Chart.js** para gráficos interactivos
- Diseño moderno y accesible
- Tema coherente con colores personalizados

## 📊 Reportes Disponibles

1. **Dashboard General**: Resumen de actividades recientes y estadísticas
2. **Gráfico de Actividades**: Tendencia de actividades por día
3. **Distribución por Tipo**: Porcentaje de ejercicios vs alimentación vs medidas
4. **Evolución del Peso**: Tracking de peso corporal (si está registrado)
5. **Top Ejercicios**: Los ejercicios más frecuentes

## 🤖 Sistema de Consejos

Los consejos se generan automáticamente basándose en:

- Frecuencia de ejercicios
- Patrones alimenticios
- Registro de medidas corporales
- Tendencias y constancia
- Objetivos implícitos del usuario

## 🔄 Próximas Funcionalidades (Planes Smart y Pro+)

- Objetivos personalizables
- Rutinas de entrenamiento predefinidas
- Integración con dispositivos wearables
- Análisis nutricional avanzado
- Comparativas y competencias
- Exportación de datos

## 🐛 Solución de Problemas

### Error de conexión a la base de datos

```bash
# Verificar que PostgreSQL está ejecutándose
sudo systemctl status postgresql

# Reiniciar PostgreSQL si es necesario
sudo systemctl restart postgresql
```

### Error "relation does not exist"

```bash
# Ejecutar nuevamente el script de la base de datos
psql -U postgres -d athlyze -f db/schema.sql
```

### Puerto en uso

```bash
# Cambiar el puerto en el archivo .env o usar:
PORT=3001 npm start
```

## 📝 Scripts Disponibles

- `npm start` - Ejecutar en modo producción
- `npm run dev` - Ejecutar en modo desarrollo (nodemon)

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👨‍💻 Desarrollador

Desarrollado por **Milton Pastor** para el ecosistema Athlyze.

---

¡Gracias por usar Athlyze! 🏃‍♂️💪

Para soporte: <support@athlyze.com>
