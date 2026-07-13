import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import validator  # noqa: E402


CASES = [
    ("01_VALIDO_base_full_217.txt", "01/2026", "VALID"),
    ("02_VALIDO_cuit_con_ceros_padding.txt", "01/2026", "VALID"),
    ("10_MAL_fecha_comprobante_posterior_retencion.txt", "01/2026", "INVALID"),
    ("11_MAL_base_menor_importe_retencion.txt", "01/2026", "INVALID"),
    ("20_MIXTO_regresion_reglas_originales.txt", "01/2026", "INVALID"),
    ("30_VALIDO_julio_acrovia_217_sin_extendidos.txt", "05/2026", "VALID"),
    ("31_VALIDO_julio_delta_importes_siap.txt", "05/2026", "VALID"),
    ("40_MAL_julio_jm_sport_condicion_04_lite.txt", "05/2026", "INVALID"),
]


def main():
    base = Path(__file__).resolve().parent
    all_ok = True
    print("archivo\tperiodo\tstatus_esperado\tstatus_real\terrores\tlineas\tdetalle")

    for file_name, period, expected_status in CASES:
        result = validator.validate_sicore_file(str(base / file_name), period)
        ok = result["status"] == expected_status
        all_ok = all_ok and ok
        details = ",".join(
            f"{err['line']}:{err['field']}:{err['rule']}"
            for err in result["errors"][:8]
        )
        print(
            f"{file_name}\t{period}\t{expected_status}\t{result['status']}\t"
            f"{result['error_count']}\t{result['processed_lines']}\t{details}"
        )

    print(f"RESULTADO_GLOBAL\t{'OK' if all_ok else 'FALLO'}")
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
