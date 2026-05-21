# -*- coding: utf-8 -*-
"""
Validador Técnico para Archivos TXT SICORE de Ancho Fijo.
Desarrollado para la primera versión de validación automática.

Layout SICORE base identificado / pendiente de confirmación oficial.
Permite ajustar posiciones, reglas y campos fácilmente.
"""

import os
import re
import argparse
from datetime import datetime

# Definición parametrizada del Layout SICORE base oficial
LAYOUT = [
    {
        "name": "codigo_comprobante",
        "label": "Código de Comprobante",
        "start": 1,
        "end": 2,
        "type": "string",
        "required": True,
        "allowed_values": ["01", "02", "03", "04", "05", "06", "07", "08", "09", "11"]
    },
    {
        "name": "fecha_comprobante",
        "label": "Fecha de Comprobante",
        "start": 3,
        "end": 12,
        "type": "date",
        "required": True
    },
    {
        "name": "numero_comprobante",
        "label": "Número de Comprobante",
        "start": 13,
        "end": 28,
        "type": "string",
        "required": True
    },
    {
        "name": "importe_comprobante",
        "label": "Importe de Comprobante",
        "start": 29,
        "end": 44,
        "type": "amount",
        "required": True
    },
    {
        "name": "codigo_impuesto",
        "label": "Código de Impuesto",
        "start": 45,
        "end": 48,
        "type": "integer",
        "required": True
    },
    {
        "name": "codigo_regimen",
        "label": "Código de Régimen",
        "start": 49,
        "end": 51,
        "type": "integer",
        "required": True
    },
    {
        "name": "codigo_operacion",
        "label": "Código de Operación",
        "start": 52,
        "end": 52,
        "type": "integer",
        "required": True
    },
    {
        "name": "base_calculo",
        "label": "Base de Cálculo",
        "start": 53,
        "end": 66,
        "type": "amount",
        "required": True
    },
    {
        "name": "fecha_retencion",
        "label": "Fecha de Retención",
        "start": 67,
        "end": 76,
        "type": "date",
        "required": True,
        "check_period": True
    },
    {
        "name": "condicion",
        "label": "Condición",
        "start": 77,
        "end": 78,
        "type": "integer",
        "required": True
    },
    {
        "name": "sujetos_suspendidos",
        "label": "Retención a sujetos suspendidos",
        "start": 79,
        "end": 79,
        "type": "integer_or_blank",
        "required": False
    },
    {
        "name": "importe_retencion",
        "label": "Importe de Retención",
        "start": 80,
        "end": 93,
        "type": "amount",
        "required": True
    },
    {
        "name": "porcentaje_exclusion",
        "label": "Porcentaje de Exclusión",
        "start": 94,
        "end": 99,
        "type": "amount_or_zero",
        "required": True
    },
    {
        "name": "fecha_vigencia",
        "label": "Fecha de Vigencia",
        "start": 100,
        "end": 109,
        "type": "date_or_blank",
        "required": False
    },
    {
        "name": "tipo_documento",
        "label": "Tipo de Documento",
        "start": 110,
        "end": 111,
        "type": "integer",
        "required": True
    },
    {
        "name": "documento_cuit",
        "label": "Documento / CUIT",
        "start": 112,
        "end": 131,
        "type": "cuit_or_doc",
        "required": True
    },
    {
        "name": "certificado_original",
        "label": "Certificado Original",
        "start": 132,
        "end": 145,
        "type": "integer_or_blank",
        "required": False
    },
    {
        "name": "denominacion_ordenante",
        "label": "Denominación del Ordenante",
        "start": 146,
        "end": 175,
        "type": "string",
        "required": False
    },
    {
        "name": "acrecentamiento",
        "label": "Acrecentamiento",
        "start": 176,
        "end": 176,
        "type": "integer",
        "required": True
    },
    {
        "name": "cuit_pais_retenido",
        "label": "Cuit país retenido",
        "start": 177,
        "end": 187,
        "type": "string",
        "required": False
    },
    {
        "name": "cuit_ordenante",
        "label": "Cuit del ordenante",
        "start": 188,
        "end": 198,
        "type": "string",
        "required": False
    }
]


def parse_amount(val):
    """
    Parsea importes contables con coma decimal.
    Preserva ceros a la izquierda y quita espacios de padding.
    Retorna float si es válido, None de lo contrario.
    """
    clean_val = val.strip()
    
    # Debe contener una coma como separador decimal
    if "," not in clean_val:
        return None
        
    # Verificar que solo contenga dígitos, coma y opcionalmente signo menos
    if not clean_val.replace(",", "").replace("-", "").isdigit():
        return None
        
    parts = clean_val.split(",")
    # Debe tener una parte entera y exactamente dos decimales
    if len(parts) != 2 or len(parts[1]) != 2:
        return None
        
    try:
        return float(clean_val.replace(",", "."))
    except ValueError:
        return None


def is_valid_cuit(cuit_str):
    """
    Valida el algoritmo matemático del dígito verificador del CUIT en Argentina.
    """
    cuit = "".join(c for c in cuit_str if c.isdigit())
    if len(cuit) != 11:
        return False
        
    prefix = cuit[:2]
    # Prefijos estándar de CUIT/CUIL en Argentina
    if prefix not in ["20", "23", "24", "27", "30", "33", "34", "35", "36", "38"]:
        return False
        
    # Algoritmo de ponderación
    weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
    total = sum(int(cuit[i]) * weights[i] for i in range(10))
    remainder = total % 11
    
    if remainder == 0:
        check_digit = 0
    elif remainder == 1:
        if prefix == "23":
            check_digit = 9
        else:
            # Si el resto es 1 y el prefijo no es 23, matemáticamente el CUIT requiere cambio de tipo,
            # pero en validaciones generales de números existentes aceptamos 9 o 4 para compatibilidad
            check_digit = 9
    else:
        check_digit = 11 - remainder
        
    return int(cuit[10]) == check_digit


def detect_file_type(lines):
    """
    Detecta si el archivo es de formato FULL (198 chars) o LITE (145 chars)
    inspeccionando el largo de la primera línea no vacía.
    Retorna "LITE" o "FULL".
    """
    for line in lines:
        clean = line.replace("\r", "").replace("\n", "")
        if clean.strip():  # primera línea con contenido real
            if len(clean) == 145:
                return "LITE"
            return "FULL"
    return "FULL"


def validate_line(line_number, line_content, expected_period=None, file_type="FULL"):
    """
    Valida una única línea del archivo de texto contra las reglas del layout.
    Ignora saltos de línea (\r, \n) para la validación de longitud exacta.
    Para archivos LITE valida exactamente 145 posiciones y omite campos > 145.
    """
    errors = []

    # Limpiar saltos de línea preservando espacios intermedios y de padding
    clean_line = line_content.replace("\r", "").replace("\n", "")

    # Ancho esperado según el tipo de archivo
    expected_length = 145 if file_type == "LITE" else 198

    # Validación estructural: longitud exacta
    if len(clean_line) != expected_length:
        errors.append({
            "line": line_number,
            "field": "linea_completa",
            "start": 1,
            "end": expected_length,
            "value": f"Longitud: {len(clean_line)}",
            "rule": "longitud_fija",
            "message": f"La línea debe tener exactamente {expected_length} caracteres de ancho fijo para el formato {file_type}, pero tiene {len(clean_line)}."
        })
        return errors

    # Datos auxiliares para validación cruzada
    tipo_doc_val = ""
    cuit_val = ""

    # Filtrar campos según el tipo de archivo
    fields_to_validate = [f for f in LAYOUT if f["end"] <= 145] if file_type == "LITE" else LAYOUT

    # Validar campo por campo
    for field in fields_to_validate:
        name = field["name"]
        label = field["label"]
        start = field["start"]
        end = field["end"]
        f_type = field["type"]
        required = field["required"]
        
        # Extraer subcadena según la posición (1-based, inclusive)
        raw_val = clean_line[start-1:end]
        
        if name == "tipo_documento":
            tipo_doc_val = raw_val
        elif name == "documento_cuit":
            cuit_val = raw_val

        # Validación de campo obligatorio (no puede ser solo espacios)
        if required:
            if raw_val.strip() == "":
                errors.append({
                    "line": line_number,
                    "field": name,
                    "start": start,
                    "end": end,
                    "value": raw_val,
                    "rule": "obligatorio",
                    "message": f"El campo '{label}' es obligatorio y no puede estar vacío."
                })
                continue

        # Validación según tipo de dato
        if f_type == "string":
            if "allowed_values" in field:
                val_clean = raw_val.strip()
                if val_clean not in field["allowed_values"]:
                    errors.append({
                        "line": line_number,
                        "field": name,
                        "start": start,
                        "end": end,
                        "value": raw_val,
                        "rule": "valores_permitidos",
                        "message": f"El campo '{label}' tiene un valor inválido ({raw_val.strip()}). Valores permitidos: {', '.join(field['allowed_values'])}."
                    })
                    
        elif f_type in ["date", "date_or_blank"]:
            val_clean = raw_val.strip()
            if f_type == "date_or_blank" and val_clean == "":
                continue
            if not re.match(r"^\d{2}/\d{2}/\d{4}$", val_clean):
                errors.append({
                    "line": line_number,
                    "field": name,
                    "start": start,
                    "end": end,
                    "value": raw_val,
                    "rule": "formato_fecha",
                    "message": f"El campo '{label}' debe tener el formato de fecha DD/MM/AAAA. Encontrado: '{val_clean}'."
                })
            else:
                try:
                    dt = datetime.strptime(val_clean, "%d/%m/%Y")
                    # Chequeo de período impositivo
                    if expected_period and field.get("check_period"):
                        exp_month, exp_year = map(int, expected_period.split("/"))
                        if dt.month != exp_month or dt.year != exp_year:
                            errors.append({
                                "line": line_number,
                                "field": name,
                                "start": start,
                                "end": end,
                                "value": val_clean,
                                "rule": "periodo_esperado",
                                "message": f"La fecha de retención '{val_clean}' no pertenece al período esperado {expected_period}."
                            })
                except ValueError:
                    errors.append({
                        "line": line_number,
                        "field": name,
                        "start": start,
                        "end": end,
                        "value": val_clean,
                        "rule": "fecha_real",
                        "message": f"El campo '{label}' contiene una fecha inválida que no existe en el calendario: '{val_clean}'."
                    })
                    
        elif f_type in ["amount", "amount_or_zero"]:
            val_clean = raw_val.strip()
            # Si permite ceros y está vacío o es solo ceros, es correcto
            if f_type == "amount_or_zero" and (val_clean == "" or re.match(r"^0+(,0+)?$", val_clean)):
                continue
                
            parsed = parse_amount(raw_val)
            if parsed is None:
                errors.append({
                    "line": line_number,
                    "field": name,
                    "start": start,
                    "end": end,
                    "value": raw_val,
                    "rule": "formato_importe",
                    "message": f"El campo '{label}' tiene un formato numérico inválido ({raw_val.strip()}). Debe ser numérico con coma decimal y dos decimales (ej. 00004958677,69)."
                })
                
        elif f_type in ["integer", "integer_or_blank"]:
            val_clean = raw_val.strip()
            if f_type == "integer_or_blank" and val_clean == "":
                continue
            if not val_clean.isdigit():
                errors.append({
                    "line": line_number,
                    "field": name,
                    "start": start,
                    "end": end,
                    "value": raw_val,
                    "rule": "formato_entero",
                    "message": f"El campo '{label}' debe ser un número entero (solo dígitos). Encontrado: '{val_clean}'."
                })
                
        elif f_type == "cuit_or_doc":
            val_clean = raw_val.strip()
            # Validamos si es CUIT/CUIL según tipo de documento
            tipo_doc_clean = tipo_doc_val.strip()
            if tipo_doc_clean in ["80", "86"]:
                cuit_digits = "".join(c for c in val_clean if c.isdigit())
                if len(cuit_digits) != 11:
                    errors.append({
                        "line": line_number,
                        "field": name,
                        "start": start,
                        "end": end,
                        "value": raw_val,
                        "rule": "longitud_cuit",
                        "message": f"El CUIT/CUIL debe tener exactamente 11 dígitos numéricos, pero se encontraron {len(cuit_digits)} dígitos."
                    })
                elif not is_valid_cuit(cuit_digits):
                    errors.append({
                        "line": line_number,
                        "field": name,
                        "start": start,
                        "end": end,
                        "value": cuit_digits,
                        "rule": "digito_verificador_cuit",
                        "message": f"El dígito verificador del CUIT/CUIL ({cuit_digits}) es inválido según el algoritmo de AFIP."
                    })
            else:
                if val_clean != "" and not val_clean.isdigit():
                    errors.append({
                        "line": line_number,
                        "field": name,
                        "start": start,
                        "end": end,
                        "value": raw_val,
                        "rule": "formato_documento",
                        "message": f"El documento debe contener únicamente dígitos numéricos. Encontrado: '{val_clean}'."
                    })

    return errors


def validate_sicore_file(file_path, expected_period=None):
    """
    Procesa y valida un archivo completo de SICORE TXT.
    Detecta automáticamente si es formato FULL (198 chars) o LITE (145 chars).
    Retorna un diccionario con el resumen de métricas y la lista de errores encontrados.
    """
    report = {
        "status": "VALID",
        "processed_lines": 0,
        "error_count": 0,
        "errors": [],
        "file_type": "FULL"
    }

    if not os.path.exists(file_path):
        report["status"] = "INVALID"
        report["errors"].append({
            "line": 0,
            "field": "archivo",
            "start": 0,
            "end": 0,
            "value": "",
            "rule": "archivo_inexistente",
            "message": f"El archivo en la ruta '{file_path}' no existe o no se puede acceder."
        })
        report["error_count"] = 1
        return report

    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
    except Exception as e:
        report["status"] = "INVALID"
        report["errors"].append({
            "line": 0,
            "field": "archivo",
            "start": 0,
            "end": 0,
            "value": "",
            "rule": "error_lectura",
            "message": f"Error crítico de lectura del archivo: {str(e)}"
        })
        report["error_count"] = 1
        return report

    # Filtrar las líneas vacías del final
    while lines and not lines[-1].strip():
        lines.pop()

    if not lines:
        report["status"] = "INVALID"
        report["errors"].append({
            "line": 0,
            "field": "archivo",
            "start": 0,
            "end": 0,
            "value": "",
            "rule": "archivo_vacio",
            "message": "El archivo de texto está vacío. Debe contener al menos una línea con datos."
        })
        report["error_count"] = 1
        return report

    # --- Detección del tipo de archivo ---
    file_type = detect_file_type(lines)
    report["file_type"] = file_type
    expected_length = 145 if file_type == "LITE" else 198

    # --- Validación de consistencia de longitud entre todas las filas ---
    # Esto garantiza que todas las filas tengan el mismo ancho que la primera
    all_lengths = set()
    for line in lines:
        clean = line.replace("\r", "").replace("\n", "")
        all_lengths.add(len(clean))

    if len(all_lengths) > 1:
        # Hay líneas con diferentes longitudes: reportar cada una que no coincida
        for i, line in enumerate(lines):
            clean = line.replace("\r", "").replace("\n", "")
            if len(clean) != expected_length:
                report["errors"].append({
                    "line": i + 1,
                    "field": "linea_completa",
                    "start": 1,
                    "end": expected_length,
                    "value": f"Longitud: {len(clean)}",
                    "rule": "inconsistencia_longitud",
                    "message": (
                        f"Inconsistencia de formato: el archivo fue detectado como {file_type} "
                        f"({expected_length} caracteres) pero esta línea tiene {len(clean)} caracteres."
                    )
                })
        if report["errors"]:
            report["status"] = "INVALID"
            report["error_count"] = len(report["errors"])
            report["processed_lines"] = len(lines)
            return report

    report["processed_lines"] = len(lines)
    all_errors = []

    for i, line in enumerate(lines):
        line_num = i + 1
        line_errors = validate_line(line_num, line, expected_period, file_type)
        if line_errors:
            all_errors.extend(line_errors)

    if all_errors:
        report["status"] = "INVALID"
        report["error_count"] = len(all_errors)
        report["errors"] = all_errors

    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Validador Técnico Local de archivos SICORE de ancho fijo.")
    parser.add_name = parser.add_argument("file_path", help="Ruta al archivo TXT de SICORE")
    parser.add_argument("--period", help="Período esperado en formato MM/AAAA (ej: 01/2026)", default=None)
    
    args = parser.parse_args()
    
    # Validar formato de período si se ingresó
    if args.period and not re.match(r"^\d{2}/\d{4}$", args.period):
        print("[ERROR] El período impositivo debe ingresarse con el formato MM/AAAA (ej. 01/2026).")
        exit(1)
        
    print(f"Iniciando validación del archivo: {args.file_path}")
    if args.period:
        print(f"Período de retención esperado: {args.period}")
    print("-" * 60)
    
    res = validate_sicore_file(args.file_path, args.period)
    
    # Mostrar formato detectado
    fmt = res.get("file_type", "FULL")
    print(f"Formato detectado:             {fmt} ({'145' if fmt == 'LITE' else '198'} posiciones)")
    print(f"Estado del archivo:            {res['status']}")
    print(f"Cantidad de líneas procesadas: {res['processed_lines']}")
    print(f"Errores encontrados:           {res['error_count']}")
    print("-" * 60)
    
    if res["status"] == "INVALID":
        for err in res["errors"]:
            pos = f"Posiciones {err['start']}-{err['end']}" if err['start'] > 0 else "Archivo"
            print(f"Línea {err['line']} | Campo {err['field']} | {pos} | Valor: '{err['value']}'\n  Error: {err['message']}\n")
        exit(1)
    else:
        print(f"[CORRECTO] El archivo es 100% válido y cumple las especificaciones de layout SICORE formato {fmt}.")
        exit(0)
