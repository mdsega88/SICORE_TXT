# Set de regresion - Julio 2026

Este set verifica que las reglas originales sigan funcionando y que las mejoras de julio queden cubiertas.

## Como correrlo

Desde esta carpeta:

```bash
python run_regression.py
```

En esta maquina, si no hay `python` en PATH, usar el Python del runtime de Codex o correrlo desde la app web cargando los archivos manualmente.

## Archivos y resultado esperado

| Archivo | Periodo | Esperado | Cobertura |
| --- | --- | --- | --- |
| `01_VALIDO_base_full_217.txt` | `01/2026` | `VALID` | Caso base FULL de reglas originales. |
| `02_VALIDO_cuit_con_ceros_padding.txt` | `01/2026` | `VALID` | CUIT con ceros de padding adelante. |
| `10_MAL_fecha_comprobante_posterior_retencion.txt` | `01/2026` | `INVALID` | Fecha de comprobante posterior a fecha de retencion. |
| `11_MAL_base_menor_importe_retencion.txt` | `01/2026` | `INVALID` | Base de calculo menor al importe de retencion. |
| `20_MIXTO_regresion_reglas_originales.txt` | `01/2026` | `INVALID` | Integral original: valores cero, campos vacios y reglas cruzadas. Esperado: 27 lineas y 28 observaciones. |
| `30_VALIDO_julio_acrovia_217_sin_extendidos.txt` | `05/2026` | `VALID` | Impuesto 217 sin campos extendidos obligatorios. |
| `31_VALIDO_julio_delta_importes_siap.txt` | `05/2026` | `VALID` | Importes aceptados por SIAP con un decimal. |
| `40_MAL_julio_jm_sport_condicion_04_lite.txt` | `05/2026` | `INVALID` | Formato LITE con condicion `04` no homologada en lineas 31 y 32. |

## Ultima validacion

- Python/backend: `RESULTADO_GLOBAL OK`.
- JavaScript/frontend: `RESULTADO_JS OK`.
- Suite unitaria general: `19 tests OK`.
