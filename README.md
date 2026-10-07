# neural-git-tui

TUI (interfaz de terminal) para explorar repositorios Git con una metafora de **red neuronal**: los commits se representan como neuronas que van "encendiendose" (sinapsis) al recorrer el historial.

Construido en TypeScript sobre [blessed](https://github.com/chjj/blessed), `simple-git` y `d3-force`.

## Que es

- Canvas "neural" central: el historial del repo como grafo animado de actividad.
- Paneles laterales: **commits**, **ramas**, **arbol de ficheros** y **busqueda**.
- Navegacion por teclado, totalmente en terminal (sin GUI).

## Requisitos

- Node.js 18+ (probado con Node 22)
- Git en el PATH (se invoca a traves de `simple-git`)

## Instalacion y uso

```bash
npm install
npm run build
node dist/index.js --repo=<ruta-al-repositorio>
```

Opciones utiles:

- `npm start -- --repo=<ruta>`  (ejecuta `dist/index.js` ya compilado)
- `npm run dev -- --repo=<ruta>`  (desarrollo con `tsx`, sin compilar)
- `npm run package`  (binarios opcionales con `pkg` para win/linux/mac)

Si no se pasa `--repo`, se usa el directorio actual.

## Controles basicos

| Tecla | Accion |
|---|---|
| `c` / `b` / `t` / `f` | Cambiar de panel: commits / ramas / ficheros / busqueda |
| `Tab` | Alternar panel activo |
| `f` o `/` | Buscar |
| `j` `k` / flechas | Navegar |
| `Enter` | Seleccionar |
| `r` | Refrescar |
| `?` | Ayuda |
| `q` / `Esc` / `Ctrl-C` | Salir |

## Estructura

- `src/git/` — parseo del repositorio (commits, diffs, ramas)
- `src/neural/` — construccion del grafo y red "neural"
- `src/ui/` — componentes y paneles (blessed)
- `src/utils/` — tema, terminal, matematicas

## Estado

- v1.0.0: funcional (build `tsc` sin errores); sin tests automatizados todavia.
- Mejoras futuras: tests, empaquetado npm, mas vistas del grafo.

## Licencia

MIT