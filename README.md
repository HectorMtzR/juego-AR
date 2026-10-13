# MeteGol AR

Juego de realidad aumentada para navegador móvil, activado por un marcador QR personalizado. Sobre el marcador aparece una mini cancha: patea las pelotas de fut para meter gol, y no patees ni la pelota de playa ni la roca.

**Jugar:** https://juego-ar.hectormarey145.workers.dev/

> En desarrollo. Estado actual: Fase 1 (base): MindAR + three.js mostrando un cubo sobre el marcador. El README completo (reglas, capturas y créditos) se escribe en la Fase 7; el diseño está en [SPEC.md](SPEC.md).

## Tecnologías

- HTML + CSS + JavaScript (ES modules), sin paso de build
- [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 (image tracking) + [three.js](https://threejs.org/) 0.160.0, desde CDN
- Cloudflare Workers (assets estáticos)

## Ejecución local

Es un sitio estático: basta servir la raíz del repositorio.

```bash
npx wrangler dev
```

La cámara solo funciona en `localhost` o por HTTPS. Para probar desde el celular se usa la versión publicada.

## Despliegue

```bash
npx wrangler deploy
```
