# -*- coding: utf-8 -*-
"""
Pruebas Unitarias Automatizadas para el Validador SICORE.
Ejecutar con: python -m unittest test_validator.py
"""

import unittest
import os
from validator import parse_amount, is_valid_cuit, validate_line, validate_sicore_file

class TestSicoreValidator(unittest.TestCase):

    def test_parse_amount(self):
        # Casos válidos
        self.assertEqual(parse_amount("00004958677,69"), 4958677.69)
        self.assertEqual(parse_amount("0000006000000,00"), 6000000.0)
        self.assertEqual(parse_amount("000,00        "), 0.0)
        self.assertEqual(parse_amount("1,23"), 1.23)
        
        # Casos inválidos
        self.assertIsNone(parse_amount("123"))          # Sin coma
        self.assertIsNone(parse_amount("123,4"))        # 1 decimal
        self.assertIsNone(parse_amount("123,456"))      # 3 decimales
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
        sample_path = "EMPRESA A-SICORE 2Q-01.2026-RET.txt"
        
        # Correr validador
        res = validate_sicore_file(sample_path, "01/2026")
        
        self.assertEqual(res["status"], "VALID")
        self.assertEqual(res["processed_lines"], 29)
        self.assertEqual(res["error_count"], 0)
        self.assertEqual(res["errors"], [])

    def test_validate_sample_file_wrong_period(self):
        # Si validamos contra febrero 2026, debería dar inválido indicando los errores de período en fecha_retencion
        sample_path = "EMPRESA A-SICORE 2Q-01.2026-RET.txt"
        
        res = validate_sicore_file(sample_path, "02/2026")
        
        self.assertEqual(res["status"], "INVALID")
        self.assertEqual(res["processed_lines"], 29)
        # Cada una de las 29 líneas debería reportar el error de fecha_retencion fuera de período
        self.assertEqual(res["error_count"], 29)
        self.assertTrue(all(e["rule"] == "periodo_esperado" for e in res["errors"]))

if __name__ == "__main__":
    unittest.main()
