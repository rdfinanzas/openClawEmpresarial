#!/usr/bin/env node
/**
 * Servidor de API Mock para probar OpenClaw Empresarial
 * 
 * Simula un almacén con productos, stock y pedidos
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = 9999;

// Base de datos mock
const productos = {
  'arroz': { id: 1, nombre: 'Arroz', precio: 2.50, stock: 50, categoria: 'alimentos' },
  'fideos': { id: 2, nombre: 'Fideos', precio: 1.80, stock: 30, categoria: 'alimentos' },
  'aceite': { id: 3, nombre: 'Aceite', precio: 4.20, stock: 0, categoria: 'alimentos' },
  'azucar': { id: 4, nombre: 'Azúcar', precio: 2.00, stock: 100, categoria: 'alimentos' },
  'leche': { id: 5, nombre: 'Leche', precio: 1.50, stock: 20, categoria: 'lacteos' },
};

const pedidos = new Map();
let nextPedidoId = 1000;

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  
  console.log(`📥 ${req.method} ${path}`);

  // RUTAS
  if (path === '/v1/stock' && req.method === 'GET') {
    // Consultar stock: /v1/stock?producto=arroz
    const producto = url.searchParams.get('producto')?.toLowerCase();
    
    if (!producto || !productos[producto]) {
      res.statusCode = 404;
      res.end(JSON.stringify({ 
        error: 'Producto no encontrado',
        disponible: false 
      }));
      return;
    }
    
    const p = productos[producto];
    res.end(JSON.stringify({
      producto: p.nombre,
      disponible: p.stock > 0,
      stock: p.stock,
      precio: p.precio,
      categoria: p.categoria
    }));
    return;
  }

  if (path === '/v1/prices' && req.method === 'GET') {
    // Consultar precio: /v1/prices?producto=arroz
    const producto = url.searchParams.get('producto')?.toLowerCase();
    
    if (!producto || !productos[producto]) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Producto no encontrado' }));
      return;
    }
    
    const p = productos[producto];
    res.end(JSON.stringify({
      producto: p.nombre,
      precio: p.precio,
      precio_formateado: `$${p.precio.toFixed(2)}`
    }));
    return;
  }

  if (path === '/v1/products' && req.method === 'GET') {
    // Ver catálogo: /v1/products?categoria=alimentos
    const categoria = url.searchParams.get('categoria')?.toLowerCase();
    
    let lista = Object.values(productos);
    if (categoria) {
      lista = lista.filter(p => p.categoria === categoria);
    }
    
    res.end(JSON.stringify({
      total: lista.length,
      categoria: categoria || 'todas',
      productos: lista.map(p => ({
        nombre: p.nombre,
        precio: `$${p.precio.toFixed(2)}`,
        stock: p.stock > 0 ? 'Disponible' : 'Sin stock',
        categoria: p.categoria
      }))
    }));
    return;
  }

  if (path === '/v1/orders' && req.method === 'POST') {
    // Crear pedido
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const pedidoId = `PED-${nextPedidoId++}`;
        
        const pedido = {
          id: pedidoId,
          cliente: data.cliente,
          productos: data.productos,
          direccion: data.direccion,
          estado: 'recibido',
          fecha: new Date().toISOString()
        };
        
        pedidos.set(pedidoId, pedido);
        
        res.end(JSON.stringify({
          success: true,
          pedido_id: pedidoId,
          mensaje: `Pedido ${pedidoId} creado exitosamente`,
          estado: 'recibido'
        }));
      } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Datos inválidos' }));
      }
    });
    return;
  }

  if (path === '/v1/orders/status' && req.method === 'GET') {
    // Consultar estado: /v1/orders/status?pedido_id=PED-1000
    const pedidoId = url.searchParams.get('pedido_id');
    
    const pedido = pedidos.get(pedidoId);
    if (!pedido) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'Pedido no encontrado' }));
      return;
    }
    
    res.end(JSON.stringify({
      pedido_id: pedido.id,
      estado: pedido.estado,
      cliente: pedido.cliente,
      productos: pedido.productos,
      fecha: pedido.fecha
    }));
    return;
  }

  // Ruta no encontrada
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Ruta no encontrada' }));
});

server.listen(PORT, () => {
  console.log('\n🏪 API Mock de Almacén iniciado\n');
  console.log(`📍 URL base: http://localhost:${PORT}`);
  console.log('\nEndpoints disponibles:');
  console.log(`  GET  http://localhost:${PORT}/v1/stock?producto=arroz`);
  console.log(`  GET  http://localhost:${PORT}/v1/prices?producto=arroz`);
  console.log(`  GET  http://localhost:${PORT}/v1/products`);
  console.log(`  POST http://localhost:${PORT}/v1/orders`);
  console.log(`  GET  http://localhost:${PORT}/v1/orders/status?pedido_id=PED-1000`);
  console.log('\nProductos de prueba:');
  console.log('  • arroz, fideos, aceite, azucar, leche');
  console.log('\nPresiona Ctrl+C para detener\n');
});
