# Contribuir

## Flujo

1. Abre un issue describiendo el problema o la propuesta.
2. Crea una rama corta: `feat/...`, `fix/...` o `docs/...`.
3. Aplica el protocolo spec-first y añade tests.
4. Ejecuta la verificación local.
5. Abre un PR completando la checklist de `.github/pull_request_template.md`.

## Comandos

- `dev`: `tsx src/index.ts`
- `build`: `tsc`
- `start`: `node dist/index.js`
- `package`: `pkg dist/index.js --targets node18-win-x64,node18-linux-x64,node18-macos-x64 --output neural-git`
- `test`: `node --test tests/*.test.mjs`
- `verify`: `npm run build && npm test`

## Reglas

- Conventional commits.
- Sin secretos ni credenciales.
- Un cambio reversible por PR.
- Revisión de `@belentani7` y CI verde.
