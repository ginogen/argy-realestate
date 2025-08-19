#!/bin/bash

# Script para forzar rebuild de better-sqlite3 en Render
echo "🔨 Forzando rebuild de better-sqlite3 para arquitectura Linux..."

# Eliminar cualquier build previo
rm -rf node_modules/better-sqlite3/build/ 2>/dev/null || true
rm -rf node_modules/better-sqlite3/lib/*.node 2>/dev/null || true

# Rebuild específico para better-sqlite3
npm rebuild better-sqlite3 --build-from-source

# Crear directorio de datos
mkdir -p data

echo "✅ Rebuild completado"