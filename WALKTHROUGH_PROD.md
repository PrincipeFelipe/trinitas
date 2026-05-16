# Guía de Implementación en Producción - Trinitas

Esta guía detalla los pasos necesarios para desplegar los últimos cambios, incluyendo la unificación global de IDs y las mejoras en exportación PDF.

## ⚠️ IMPORTANTE: Backup previo
Antes de realizar cualquier cambio en producción, realiza un backup de la base de datos actual:
```bash
mysqldump -u [usuario] -p [base_de_datos] > backup_antes_migracion.sql
```

## Pasos para el Despliegue

### 1. Actualizar Código
En el servidor de producción, sitúate en la carpeta del proyecto y descarga los cambios:
```bash
git pull origin main
```

### 2. Preparar Base de Datos (Añadir columna empresa)
Es posible que falte la columna `company` en algunas tablas. Ejecuta este script primero:
```bash
node migrate_company.js
```

### 3. Migración de Base de Datos (Unificar IDs)
Ahora ejecuta el script para hacer que los IDs de notificación sean únicos a nivel global:
```bash
node make_id_unique.js
```
*Este script limpiará duplicados y ajustará las claves primarias.*

### 3. Instalación de Dependencias
Asegúrate de tener todas las dependencias actualizadas:
```bash
# En la carpeta backend
npm install

# En la carpeta frontend
npm install
```

### 4. Compilación del Frontend
Genera el nuevo bundle del frontend para producción:
```bash
# En la carpeta frontend
npm run build
```

### 5. Reiniciar Servicios
Reinicia el backend para que cargue el nuevo middleware de seguridad y los nuevos controladores:
```bash
# Si usas PM2
pm2 restart all

# O reinicia el proceso de Node que tengas configurado
```

## Resumen de cambios implementados
- **ID Único Global**: Ya no hay conflictos entre empresas con el mismo ID.
- **Exportación Masiva PDF**: Nuevo botón en el listado que genera un PDF con resumen + acuses individuales.
- **Filtro "Gestionados"**: Opción para ocultar notificaciones pendientes en el listado.
- **Seguridad PDF**: Los enlaces a PDFs ahora incluyen el token de autenticación para evitar errores de acceso.
- **Correcciones UI**: Autocompletado del nombre del receptor y botón de limpieza en la app del repartidor.
