# Fair Play Chile - Frontend

Frontend moderno para la aplicación de gestión de clubes deportivos Fair Play Chile.

## 🚀 Características

- ✨ **Diseño Moderno**: Interfaz oscura con gradientes vibrantes y animaciones suaves
- 🔐 **Autenticación Completa**: Login, registro y gestión de sesiones
- ⚽ **Gestión de Partidos**: Crear, listar y gestionar partidos deportivos
- 👥 **Sistema de Jugadores**: Administración de jugadores y equipos
- 🏆 **Clubes Deportivos**: Gestión de clubes y organizaciones
- 📱 **Responsive**: Diseño adaptable a todos los dispositivos
- 🎨 **Animaciones**: Transiciones y efectos visuales premium

## 🛠️ Tecnologías

- **Vue 3**: Framework JavaScript progresivo
- **Vite**: Build tool ultrarrápido
- **Vue Router**: Navegación SPA
- **Axios**: Cliente HTTP
- **CSS Variables**: Sistema de diseño modular

## 📦 Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar variables de entorno**:
Copia el archivo `.env.example` a `.env` y configura tus variables:
```bash
cp .env.example .env
```

Edita el archivo `.env`:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_API_KEY=tu-api-key-aqui
```

3. **Iniciar servidor de desarrollo**:
```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## 🏗️ Build para Producción

```bash
npm run build
```

Los archivos optimizados se generarán en la carpeta `dist/`.

## 📁 Estructura del Proyecto

```
frontend-miclub/
├── src/
│   ├── api/              # Configuración de API y endpoints
│   ├── components/       # Componentes reutilizables
│   ├── router/          # Configuración de rutas
│   ├── stores/          # Estado global (auth)
│   ├── views/           # Páginas de la aplicación
│   ├── App.vue          # Componente principal
│   ├── main.js          # Punto de entrada
│   └── style.css        # Estilos globales
├── public/              # Archivos estáticos
├── .env                 # Variables de entorno
└── package.json         # Dependencias
```

## 🎨 Páginas Disponibles

- **Login** (`/login`): Inicio de sesión
- **Register** (`/register`): Registro de nuevos usuarios
- **Dashboard** (`/dashboard`): Panel principal
- **Partidos** (`/matches`): Lista de partidos
- **Crear Partido** (`/matches/create`): Formulario de creación
- **Detalle Partido** (`/matches/:id`): Información detallada
- **Jugadores** (`/players`): Gestión de jugadores
- **Clubes** (`/clubs`): Gestión de clubes
- **Perfil** (`/profile`): Perfil de usuario

## 🔑 Autenticación

El sistema de autenticación incluye:
- Login con email/password
- Registro de nuevos usuarios
- Refresh token automático
- Persistencia de sesión en localStorage
- Guards de navegación

## 🌐 API Integration

El frontend se conecta al backend a través de axios con:
- Interceptores para autenticación
- Manejo automático de tokens
- Refresh token en caso de expiración
- Endpoints organizados por módulos

## 🎯 Próximas Funcionalidades

- [ ] Edición de perfil de usuario
- [ ] Búsqueda avanzada de partidos
- [ ] Sistema de notificaciones
- [ ] Chat entre jugadores
- [ ] Estadísticas detalladas
- [ ] Integración con mapas
- [ ] Modo claro/oscuro

## 📝 Notas de Desarrollo

- El proyecto usa Vue 3 Composition API
- Los estilos siguen un sistema de diseño con CSS Variables
- Las animaciones están optimizadas para rendimiento
- El código está organizado por características

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto es privado y confidencial.

## 👨‍💻 Autor

Fair Play Chile Team

---

**¡Disfruta construyendo con Fair Play Chile! ⚽🏆**
