# -*- coding: utf-8 -*-
"""
Pruebas Unitarias Automatizadas para el Validador SICORE.
Ejecutar con: python -m unittest test_validator.py
"""

import unittest
import os
import tempfile
from pathlib import Path
from validator import (
    parse_amount,
    is_valid_cuit,
    validate_line,
    validate_sicore_file,
    detect_file_type,
    write_execution_log,
    LOG_DIR,
)

class TestSicoreValidator(unittest.TestCase):
    VALID_LINE = (
        "0602/01/2026   00000000114730000006000000,00 217 94100004958677,69"
        "02/01/202601 00000097830,15000,00          8030716967871         "
        "00000000000000                              00000000000000000000000"
    )

    def replace_field(self, line, start, end, value):
        self.assertEqual(len(value), end - start + 1)
        return line[:start - 1] + value + line[end:]

    def write_temp_sicore_file(self, temp_dir, lines_count=1):
        path = os.path.join(temp_dir, "sample_sicore.txt")
        with open(path, "w", encoding="utf-8", newline="\r\n") as f:
            for _ in range(lines_count):
                f.write(self.VALID_LINE + "\n")
        return path

    def test_parse_amount(self):
        # Casos válidos
        self.assertEqual(parse_amount("00004958677,69"), 4958677.69)
        self.assertEqual(parse_amount("0000006000000,00"), 6000000.0)
        self.assertEqual(parse_amount("000,00        "), 0.0)
        self.assertEqual(parse_amount("1,23"), 1.23)
        self.assertEqual(parse_amount("        633471,3"), 633471.3)
        self.assertEqual(parse_amount("     1085936,2"), 1085936.2)
        
        # Casos inválidos
        self.assertIsNone(parse_amount("123"))          # Sin coma
        self.assertIsNone(parse_amount("12a,45"))       # Carácter no numérico
        self.assertIsNone(parse_amount(" 123 , 45 "))   # Espacios internos incorrectos

    def test_cuit_validation(self):
        # CUITs válidos reales del archivo de ejemplo
        self.assertTrue(is_valid_cuit("30716967871"))
        self.assertTrue(is_valid_cuit("30554807301"))
        self.assertTrue(is_valid_cuit("20935764980"))
        self.assertTrue(is_valid_cuit("27056753686"))
        self.assertTrue(is_valid_cuit("23129655399"))
        self.assertTrue(is_valid_cuit("33712058159"))
        
        # CUITs con dígitos verificadores inválidos
        self.assertFalse(is_valid_cuit("30716967872")) # Último dígito cambiado
        self.assertFalse(is_valid_cuit("20935764981")) # Último dígito cambiado
        
        # Longitud incorrecta
        self.assertFalse(is_valid_cuit("12345"))
        self.assertFalse(is_valid_cuit("307169678710"))

    def test_validate_line_valid_layout(self):
        # Línea 1 real del archivo de ejemplo (198 caracteres)
        valid_line = (
            "0602/01/2026   00000000114730000006000000,00 217 94100004958677,69"
            "02/01/202601 00000097830,15000,00          8030716967871         "
            "00000000000000                              00000000000000000000000"
        )
        self.assertEqual(len(valid_line), 198)
        
        # Validar período correcto
        errors = validate_line(1, valid_line, "01/2026")
        self.assertEqual(errors, [])

        # Validar período incorrecto (debería lanzar error de período)
        errors_bad_period = validate_line(1, valid_line, "02/2026")
        self.assertEqual(len(errors_bad_period), 1)
        self.assertEqual(errors_bad_period[0]["rule"], "periodo_esperado")
        self.assertEqual(errors_bad_period[0]["field"], "fecha_retencion")

    def test_validate_line_structural_errors(self):
        # Línea muy corta
        short_line = "0602/01/2026   000000001147"
        errors = validate_line(2, short_line)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["rule"], "longitud_fija")

        # Campo obligatorio vacío (ej: fecha_comprobante en blanco)
        line_empty_field = (
            "06             00000000114730000006000000,00 217 94100004958677,69"
            "02/01/202601 00000097830,15000,00          8030716967871         "
            "00000000000000                              00000000000000000000000"
        )
        errors = validate_line(3, line_empty_field)
        # Debería saltar error obligatorio para fecha_comprobante
        self.assertTrue(any(e["field"] == "fecha_comprobante" and e["rule"] == "obligatorio" for e in errors))

    def test_validate_sample_file_success(self):
        # El archivo real de prueba debe validar 100% correcto para el período 01/2026
        original_cwd = os.getcwd()
        log_path = LOG_DIR / "SICORE-01-2026.txt"
        if log_path.exists():
            log_path.unlink()
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                os.chdir(temp_dir)
                sample_path = self.write_temp_sicore_file(temp_dir, lines_count=29)
                res = validate_sicore_file(sample_path, "01/2026")
            finally:
                os.chdir(original_cwd)
                if log_path.exists():
                    log_path.unlink()
        
        self.assertEqual(res["status"], "VALID")
        self.assertEqual(res["processed_lines"], 29)
        self.assertEqual(res["error_count"], 0)
        self.assertEqual(res["errors"], [])

    def test_validate_sample_file_wrong_period(self):
        # Si validamos contra febrero 2026, debería dar inválido indicando los errores de período en fecha_retencion
        original_cwd = os.getcwd()
        log_path = LOG_DIR / "SICORE-02-2026.txt"
        if log_path.exists():
            log_path.unlink()
        with tempfile.TemporaryDirectory() as temp_dir:
            try:
                os.chdir(temp_dir)
                sample_path = self.write_temp_sicore_file(temp_dir, lines_count=29)
                res = validate_sicore_file(sample_path, "02/2026")
            finally:
                os.chdir(original_cwd)
                if log_path.exists():
                    log_path.unlink()
        
        self.assertEqual(res["status"], "INVALID")
        self.assertEqual(res["processed_lines"], 29)
        # Cada una de las 29 líneas debería reportar el error de fecha_retencion fuera de período
        self.assertEqual(res["error_count"], 29)
        self.assertTrue(all(e["rule"] == "periodo_esperado" for e in res["errors"]))

    def test_validate_file_requires_expected_period(self):
        sample_path = "EMPRESA A-SICORE 2Q-01.2026-RET.txt"
        res = validate_sicore_file(sample_path)

        self.assertEqual(res["status"], "INVALID")
        self.assertEqual(res["error_count"], 1)
        self.assertEqual(res["errors"][0]["field"], "periodo")
        self.assertEqual(res["errors"][0]["rule"], "periodo_obligatorio")

    def test_execution_log_appends_by_period_file(self):
        log_path = LOG_DIR / "SICORE-01-2026.txt"
        if log_path.exists():
            log_path.unlink()

        try:
            write_execution_log("uno.txt", "01/2026", "VALID", 0, "FULL")
            write_execution_log("dos.txt", "01/2026", "INVALID", 3, "FULL")

            self.assertTrue(log_path.exists())

            with open(log_path, "r", encoding="utf-8") as f:
                lines = f.readlines()

            self.assertEqual(len(lines), 2)
            self.assertIn("Archivo: uno.txt", lines[0])
            self.assertIn("Archivo: dos.txt", lines[1])
        finally:
            if log_path.exists():
                log_path.unlink()

    def test_certificado_original_optional(self):
        """El campo certificado_original puede ser blanco en formato FULL sin generar error."""
        # Partir de la línea real de 198 chars y blanquear las posiciones 132-145
        base_line = (
            "0602/01/2026   00000000114730000006000000,00 217 94100004958677,69"
            "02/01/202601 00000097830,15000,00          8030716967871         "
            "00000000000000                              00000000000000000000000"
        )
        # Reemplazar certificado_original (pos 132-145, índice 131-144) con 14 espacios
        valid_line = base_line[:131] + "              " + base_line[145:]
        self.assertEqual(len(valid_line), 198)
        errors = validate_line(1, valid_line, "01/2026")
        # No debe haber ningún error relacionado con certificado_original
        cert_errors = [e for e in errors if e["field"] == "certificado_original"]
        self.assertEqual(cert_errors, [])


    def test_validate_line_lite_valid(self):
        """Una línea LITE de exactamente 145 caracteres debe validar sin errores."""
        # Tomamos los primeros 145 caracteres de la línea real (incluyendo certificado_original)
        full_line = (
            "0602/01/2026   00000000114730000006000000,00 217 94100004958677,69"
            "02/01/202601 00000097830,15000,00          8030716967871         "
            "00000000000000                              00000000000000000000000"
        )
        lite_line = full_line[:145]
        self.assertEqual(len(lite_line), 145)
        errors = validate_line(1, lite_line, "01/2026", file_type="LITE")
        self.assertEqual(errors, [], msg=f"Errores inesperados en LITE: {errors}")

    def test_validate_line_lite_wrong_length(self):
        """Una línea de 198 chars tratada como LITE debe fallar por longitud incorrecta."""
        full_line = (
            "0602/01/2026   00000000114730000006000000,00 217 94100004958677,69"
            "02/01/202601 00000097830,15000,00          8030716967871         "
            "00000000000000                              00000000000000000000000"
        )
        self.assertEqual(len(full_line), 198)
        errors = validate_line(1, full_line, "01/2026", file_type="LITE")
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0]["rule"], "longitud_fija")

    def test_non_zero_required_fields_reject_zero_values(self):
        zero_cases = [
            ("codigo_comprobante", 1, 2, "00"),
            ("numero_comprobante", 13, 28, "0000000000000000"),
            ("importe_comprobante", 29, 44, "0000000000000,00"),
            ("codigo_impuesto", 45, 48, "0000"),
            ("codigo_regimen", 49, 51, "000"),
            ("codigo_operacion", 52, 52, "0"),
            ("base_calculo", 53, 66, "00000000000,00"),
            ("condicion", 77, 78, "00"),
            ("importe_retencion", 80, 93, "00000000000,00"),
            ("tipo_documento", 110, 111, "00"),
            ("documento_cuit", 112, 131, "00000000000000000000"),
        ]

        for field, start, end, value in zero_cases:
            with self.subTest(field=field):
                line = self.replace_field(self.VALID_LINE, start, end, value)
                errors = validate_line(1, line, "01/2026")
                self.assertTrue(
                    any(e["field"] == field and e["rule"] == "valor_cero_no_permitido" for e in errors),
                    msg=f"No se detecto cero no permitido para {field}: {errors}"
                )

    def test_cuit_accepts_leading_zero_padding(self):
        line = self.replace_field(self.VALID_LINE, 112, 131, "00000000030716967871")
        errors = validate_line(1, line, "01/2026")
        self.assertEqual(errors, [])

    def test_base_calculo_cannot_be_less_than_importe_retencion(self):
        line = self.replace_field(self.VALID_LINE, 53, 66, "00000000100,00")
        errors = validate_line(1, line, "01/2026")
        self.assertTrue(any(e["rule"] == "base_menor_importe_retencion" for e in errors))

    def test_fecha_comprobante_cannot_be_after_fecha_retencion(self):
        line = self.replace_field(self.VALID_LINE, 3, 12, "03/01/2026")
        errors = validate_line(1, line, "01/2026")
        self.assertTrue(any(e["rule"] == "fecha_comprobante_posterior_retencion" for e in errors))

    def test_detect_file_type(self):
        """La detección de formato debe identificar LITE y FULL correctamente."""
        full_line = "0602/01/2026   00000000114730000006000000,00 217 94100004958677,6902/01/202601 00000097830,15000,00          8030716967871         00000000000000                              00000000000000000000000"
        self.assertEqual(len(full_line), 198)
        self.assertEqual(detect_file_type([full_line]), "FULL")

        lite_line = full_line[:145]
        self.assertEqual(len(lite_line), 145)
        self.assertEqual(detect_file_type([lite_line]), "LITE")

    def test_july_change_acrovia_is_valid_without_extended_fields_for_217(self):
        path = Path(__file__).resolve().parents[1] / "Pedido de Cambios Julio" / "V1" / "TXT PRUEBAS" / "ACROVIA-SICORE 1Q-05.2026-RET.txt"
        res = validate_sicore_file(str(path), "05/2026")

        self.assertEqual(res["status"], "VALID")
        self.assertEqual(res["error_count"], 0)

    def test_july_change_delta_accepts_siap_amount_tolerance(self):
        path = Path(__file__).resolve().parents[1] / "Pedido de Cambios Julio" / "V1" / "TXT PRUEBAS" / "DELTA-SICORE 2Q-05.2026-RET.txt"
        res = validate_sicore_file(str(path), "05/2026")

        self.assertEqual(res["status"], "VALID")
        self.assertEqual(res["error_count"], 0)

    def test_july_change_jm_sport_rejects_invalid_condition_code(self):
        path = Path(__file__).resolve().parents[1] / "Pedido de Cambios Julio" / "V1" / "TXT PRUEBAS" / "JM SPORT-SICORE-05.2026-RET.txt"
        res = validate_sicore_file(str(path), "05/2026")
        condition_errors = [
            e for e in res["errors"]
            if e["field"] == "condicion" and e["rule"] == "codigo_no_homologado"
        ]

        self.assertEqual(res["status"], "INVALID")
        self.assertEqual([e["line"] for e in condition_errors], [31, 32])


if __name__ == "__main__":
    unittest.main()
