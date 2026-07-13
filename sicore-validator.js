/**
 * Validador Técnico para Archivos TXT SICORE de Ancho Fijo.
 * Engine Core en JavaScript (ES6).
 *
 * Mantiene consistencia lógica absoluta con el core en Python.
 */

const CATALOGS = {
    codigo_comprobante: {
        "01": "Factura",
        "02": "Recibo",
        "03": "Nota de Credito",
        "04": "Nota de Debito",
        "05": "Otro comprobante",
        "06": "Orden de Pago",
        "07": "Recibo de Sueldo",
        "08": "Recibo de Sueldo - Devolucion",
        "09": "Escritura Publica",
        "10": "C.1116",
        "11": "Factura (16 Digitos)",
        "12": "Recibo de Haberes",
        "13": "Recibo de Haberes - Devolucion"
    },
    codigo_impuesto: {
        "064": "Fondo Nacional de Incentivo Docente",
        "172": "Impuesto a la Transferencia de Inmuebles",
        "210": "Ganancias Regimen Especial de Ingreso R.G. 830",
        "217": "Impuesto a las Ganancias (Mercado Interno)",
        "218": "Impuesto a las Ganancias - Beneficiarios del Exterior",
        "219": "Impuesto sobre los Bienes Personales",
        "466": "Gravamen de Emergencia a los Premios de Juegos de Sorteo",
        "767": "Impuesto al Valor Agregado"
    },
    codigo_operacion: {
        "1": "Retencion",
        "2": "Percepcion",
        "4": "Imposibilidad de Retencion"
    },
    condicion: {
        "1": "Inscripto",
        "2": "No inscripto",
        "3": "No categorizado",
        "6": "Contratacion hora dia estadia",
        "7": "Contratacion mensual",
        "8": "Incluido en el registro fiscal de granos",
        "9": "No incluido en el registro fiscal de granos",
        "10": "Inscripto demas sujetos",
        "11": "Inscripto retenciones IVA estaciones de servicios",
        "12": "Servicios publicos",
        "13": "Venta de cosas muebles y locacion - Alicuota general",
        "14": "Venta de cosas muebles y locacion - Alicuota reducida",
        "15": "Retencion sustitutiva",
        "16": "Sujetos suspendidos segun articulo 40 inc. A)",
        "17": "Sujetos suspendidos segun articulo 40 inc. B)",
        "18": "Aplica Convenio de Doble Imposicion",
        "19": "No Aplica Convenio de Doble Imposicion"
    },
    tipo_documento: {
        "80": "C.U.I.T.",
        "86": "C.U.I.L.",
        "83": "Ident. Tributaria del Exterior",
        "87": "C.D.I.",
        "84": "Documento del Exterior"
    }
};

const CATALOG_RULES = {
    codigo_comprobante: "Debe existir en la tabla de comprobantes homologados para importacion SICORE.",
    codigo_impuesto: "Debe existir en la tabla de impuestos admitidos. El codigo 218 activa campos extendidos de beneficiarios del exterior.",
    codigo_operacion: "Debe indicar el tipo de operacion permitido por SIAP.",
    condicion: "Debe existir en la tabla cerrada de condiciones AFIP/SICORE.",
    tipo_documento: "Debe existir en la tabla de tipos de documento del sujeto retenido."
};

const EXTENDED_FIELDS = new Set([
    "denominacion_ordenante",
    "acrecentamiento",
    "cuit_pais_retenido",
    "cuit_ordenante"
]);

function normalizeCatalogCode(fieldName, rawVal) {
    const value = (rawVal || "").trim();
    if (value === "") return "";

    if (fieldName === "codigo_comprobante") return value.padStart(2, "0");
    if (fieldName === "codigo_impuesto") {
        const digits = value.replace(/\D/g, "");
        const normalized = digits.replace(/^0+/, "") || "0";
        return normalized.length < 3 ? normalized.padStart(3, "0") : normalized;
    }
    if (fieldName === "codigo_operacion" || fieldName === "condicion") {
        const digits = value.replace(/\D/g, "");
        return digits.replace(/^0+/, "") || "0";
    }
    if (fieldName === "tipo_documento") return value.padStart(2, "0");
    return value;
}

function getCatalogDescription(fieldName, rawVal) {
    const catalog = CATALOGS[fieldName];
    if (!catalog) return null;
    const normalized = normalizeCatalogCode(fieldName, rawVal);
    return catalog[normalized] || null;
}

function isForeignBeneficiaryTax(rawVal) {
    return normalizeCatalogCode("codigo_impuesto", rawVal) === "218";
}

// Layout parametrizado de referencia de SICORE base oficial
const LAYOUT = [
    {
        name: "codigo_comprobante",
        label: "Código de Comprobante",
        start: 1,
        end: 2,
        type: "string",
        required: true
    },
    {
        name: "fecha_comprobante",
        label: "Fecha de Comprobante",
        start: 3,
        end: 12,
        type: "date",
        required: true
    },
    {
        name: "numero_comprobante",
        label: "Número de Comprobante",
        start: 13,
        end: 28,
        type: "string",
        required: true
    },
    {
        name: "importe_comprobante",
        label: "Importe de Comprobante",
        start: 29,
        end: 44,
        type: "amount",
        required: true
    },
    {
        name: "codigo_impuesto",
        label: "Código de Impuesto",
        start: 45,
        end: 48,
        type: "integer",
        required: true
    },
    {
        name: "codigo_regimen",
        label: "Código de Régimen",
        start: 49,
        end: 51,
        type: "integer",
        required: true
    },
    {
        name: "codigo_operacion",
        label: "Código de Operación",
        start: 52,
        end: 52,
        type: "integer",
        required: true
    },
    {
        name: "base_calculo",
        label: "Base de Cálculo",
        start: 53,
        end: 66,
        type: "amount",
        required: true
    },
    {
        name: "fecha_retencion",
        label: "Fecha de Retención",
        start: 67,
        end: 76,
        type: "date",
        required: true,
        checkPeriod: true
    },
    {
        name: "condicion",
        label: "Condición",
        start: 77,
        end: 78,
        type: "integer",
        required: true
    },
    {
        name: "sujetos_suspendidos",
        label: "Retención a sujetos suspendidos",
        start: 79,
        end: 79,
        type: "integer_or_blank",
        required: false
    },
    {
        name: "importe_retencion",
        label: "Importe de Retención",
        start: 80,
        end: 93,
        type: "amount",
        required: true
    },
    {
        name: "porcentaje_exclusion",
        label: "Porcentaje de Exclusión",
        start: 94,
        end: 99,
        type: "amount_or_zero",
        required: true
    },
    {
        name: "fecha_vigencia",
        label: "Fecha de Vigencia",
        start: 100,
        end: 109,
        type: "date_or_blank",
        required: false
    },
    {
        name: "tipo_documento",
        label: "Tipo de Documento",
        start: 110,
        end: 111,
        type: "integer",
        required: true
    },
    {
        name: "documento_cuit",
        label: "Documento / CUIT",
        start: 112,
        end: 131,
        type: "cuit_or_doc",
        required: true
    },
    {
        name: "certificado_original",
        label: "Certificado Original",
        start: 132,
        end: 145,
        type: "integer_or_blank",
        required: false
    },
    {
        name: "denominacion_ordenante",
        label: "Denominación del Ordenante",
        start: 146,
        end: 175,
        type: "string",
        required: false
    },
    {
        name: "acrecentamiento",
        label: "Acrecentamiento",
        start: 176,
        end: 176,
        type: "integer",
        required: true
    },
    {
        name: "cuit_pais_retenido",
        label: "Cuit país retenido",
        start: 177,
        end: 187,
        type: "string",
        required: false
    },
    {
        name: "cuit_ordenante",
        label: "Cuit del ordenante",
        start: 188,
        end: 198,
        type: "string",
        required: false
    }
];

/**
 * Parsea importes contables con coma decimal.
 * Retorna float o null.
 */
function parseAmount(val) {
    const cleanVal = val.trim();
    if ((cleanVal.match(/,/g) || []).length !== 1) {
        return null;
    }

    // Solo dígitos, coma y opcionalmente signo menos
    const withoutComma = cleanVal.replace(",", "").replace("-", "");
    if (!/^\d+$/.test(withoutComma)) {
        return null;
    }

    const parts = cleanVal.split(",");
    if (parts.length !== 2 || parts[0] === "" || parts[0] === "-" || parts[1].length < 1) {
        return null;
    }

    const parsed = parseFloat(cleanVal.replace(",", "."));
    return isNaN(parsed) ? null : parsed;
}

const NON_ZERO_FIELDS = new Set([
    "codigo_comprobante",
    "numero_comprobante",
    "importe_comprobante",
    "codigo_impuesto",
    "codigo_regimen",
    "codigo_operacion",
    "base_calculo",
    "condicion",
    "importe_retencion",
    "tipo_documento",
    "documento_cuit"
]);

function isZeroValue(rawVal, type) {
    const valClean = rawVal.trim();
    if (valClean === "") {
        return false;
    }

    if (type === "amount" || type === "amount_or_zero") {
        const parsed = parseAmount(rawVal);
        return parsed !== null ? parsed === 0 : /^0+(,0+)?$/.test(valClean);
    }

    const digits = valClean.replace(/\D/g, "");
    return digits !== "" && /^0+$/.test(digits);
}

function parseSicoreDate(val) {
    const valClean = val.trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(valClean)) {
        return null;
    }

    const parts = valClean.split("/");
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const dateObj = new Date(year, month, day);

    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
        return null;
    }

    return dateObj;
}

/**
 * Valida algoritmo del CUIT de Argentina.
 */
function isValidCuit(cuitStr) {
    const cuit = cuitStr.replace(/\D/g, "");
    if (cuit.length !== 11) {
        return false;
    }

    const prefix = cuit.slice(0, 2);
    const validPrefixes = ["20", "23", "24", "27", "30", "33", "34", "35", "36", "38"];
    if (!validPrefixes.includes(prefix)) {
        return false;
    }

    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < 10; i++) {
        total += parseInt(cuit[i], 10) * weights[i];
    }

    const remainder = total % 11;
    let checkDigit = 0;

    if (remainder === 0) {
        checkDigit = 0;
    } else if (remainder === 1) {
        if (prefix === "23") {
            checkDigit = 9;
        } else {
            checkDigit = 9;
        }
    } else {
        checkDigit = 11 - remainder;
    }

    return parseInt(cuit[10], 10) === checkDigit;
}

/**
 * Valida una sola línea.
 */
function validateLine(lineNum, lineContent, expectedPeriod = null, fileType = "FULL") {
    const errors = [];

    // Limpiar saltos de línea sin tocar espacios de padding
    const cleanLine = lineContent.replace(/\r?\n$/, "");
    const expectedLength = fileType === "LITE" ? 145 : 198;

    if (cleanLine.length !== expectedLength) {
        errors.push({
            line: lineNum,
            field: "linea_completa",
            start: 1,
            end: expectedLength,
            value: `Longitud: ${cleanLine.length}`,
            rule: "longitud_fija",
            message: `La línea debe tener exactamente ${expectedLength} caracteres de ancho fijo para el formato ${fileType}, pero tiene ${cleanLine.length}.`
        });
        return errors;
    }

    let tipoDocVal = "";
    let cuitVal = "";
    const rawFields = {};

    const fieldsToValidate = fileType === "LITE"
        ? LAYOUT.filter(f => f.end <= 145)
        : LAYOUT;
    const codigoImpuestoRaw = cleanLine.length >= 48 ? cleanLine.slice(44, 48) : "";
    const validateExtendedFields = fileType !== "FULL" || isForeignBeneficiaryTax(codigoImpuestoRaw);

    for (const field of fieldsToValidate) {
        const { name, label, start, end, type, required, allowedValues } = field;
        const rawVal = cleanLine.slice(start - 1, end);
        rawFields[name] = rawVal;

        if (fileType === "FULL" && EXTENDED_FIELDS.has(name) && !validateExtendedFields) {
            continue;
        }

        if (name === "tipo_documento") {
            tipoDocVal = rawVal;
        } else if (name === "documento_cuit") {
            cuitVal = rawVal;
        }

        // Obligatorio
        if (required) {
            if (rawVal.trim() === "") {
                errors.push({
                    line: lineNum,
                    field: name,
                    start,
                    end,
                    value: rawVal,
                    rule: "obligatorio",
                    message: `El campo '${label}' es obligatorio y no puede estar vacío.`
                });
                continue;
            }
        }

        if (NON_ZERO_FIELDS.has(name) && isZeroValue(rawVal, type)) {
            errors.push({
                line: lineNum,
                field: name,
                start,
                end,
                value: rawVal,
                rule: "valor_cero_no_permitido",
                message: `El campo '${label}' no puede estar vacio ni contener un valor en cero.`
            });
            continue;
        }

        // Validaciones por tipo
        if (type === "string") {
            if (allowedValues) {
                const valClean = rawVal.trim();
                if (!allowedValues.includes(valClean)) {
                    errors.push({
                        line: lineNum,
                        field: name,
                        start,
                        end,
                        value: rawVal,
                        rule: "valores_permitidos",
                        message: `El campo '${label}' tiene un valor inválido (${valClean}). Valores permitidos: ${allowedValues.join(", ")}.`
                    });
                }
            }
        } else if (type === "date" || type === "date_or_blank") {
            const valClean = rawVal.trim();
            if (type === "date_or_blank" && valClean === "") {
                continue;
            }
            if (!/^\d{2}\/\d{2}\/\d{4}$/.test(valClean)) {
                errors.push({
                    line: lineNum,
                    field: name,
                    start,
                    end,
                    value: rawVal,
                    rule: "formato_fecha",
                    message: `El campo '${label}' debe tener el formato de fecha DD/MM/AAAA. Encontrado: '${valClean}'.`
                });
            } else {
                // Chequear fecha real impositiva
                const parts = valClean.split("/");
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1; // 0-indexed en JS
                const year = parseInt(parts[2], 10);
                const dateObj = new Date(year, month, day);

                if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month || dateObj.getDate() !== day) {
                    errors.push({
                        line: lineNum,
                        field: name,
                        start,
                        end,
                        value: valClean,
                        rule: "fecha_real",
                        message: `El campo '${label}' contiene una fecha inválida que no existe en el calendario: '${valClean}'.`
                    });
                } else {
                    // Chequear período esperado
                    if (expectedPeriod && field.checkPeriod) {
                        const expParts = expectedPeriod.split("/");
                        const expMonth = parseInt(expParts[0], 10);
                        const expYear = parseInt(expParts[1], 10);

                        if ((month + 1) !== expMonth || year !== expYear) {
                            errors.push({
                                line: lineNum,
                                field: name,
                                start,
                                end,
                                value: valClean,
                                rule: "periodo_esperado",
                                message: `La fecha de retención '${valClean}' no pertenece al período esperado ${expectedPeriod}.`
                            });
                        }
                    }
                }
            }
        } else if (type === "amount" || type === "amount_or_zero") {
            const valClean = rawVal.trim();
            if (type === "amount_or_zero" && (valClean === "" || /^0+(,0+)?$/.test(valClean))) {
                continue;
            }

            const parsed = parseAmount(rawVal);
            if (parsed === null) {
                errors.push({
                    line: lineNum,
                    field: name,
                    start,
                    end,
                    value: rawVal,
                    rule: "formato_importe",
                    message: `El campo '${label}' tiene un formato de importe inválido (${valClean}). Debe ser numérico con coma decimal y al menos un decimal (ej. 00004958677,69 o 633471,3).`
                });
            }
        } else if (type === "integer" || type === "integer_or_blank") {
            const valClean = rawVal.trim();
            if (type === "integer_or_blank" && valClean === "") {
                continue;
            }
            if (!/^\d+$/.test(valClean)) {
                errors.push({
                    line: lineNum,
                    field: name,
                    start,
                    end,
                    value: rawVal,
                    rule: "formato_entero",
                    message: `El campo '${label}' debe ser un número entero (solo dígitos). Encontrado: '${valClean}'.`
                });
            }
        } else if (type === "cuit_or_doc") {
            const valClean = rawVal.trim();
            const tipoDocClean = tipoDocVal.trim();

            if (tipoDocClean === "80" || tipoDocClean === "86") {
                const cuitDigits = valClean.replace(/\D/g, "").replace(/^0+/, "");
                if (cuitDigits.length !== 11) {
                    errors.push({
                        line: lineNum,
                        field: name,
                        start,
                        end,
                        value: rawVal.trim(),
                        rule: "longitud_cuit",
                        message: `El CUIT/CUIL debe tener exactamente 11 dígitos numéricos, pero se encontraron ${cuitDigits.length} dígitos.`
                    });
                } else if (!isValidCuit(cuitDigits)) {
                    errors.push({
                        line: lineNum,
                        field: name,
                        start,
                        end,
                        value: cuitDigits,
                        rule: "digito_verificador_cuit",
                        message: `El dígito verificador del CUIT/CUIL (${cuitDigits}) es inválido según el algoritmo matemático de AFIP.`
                    });
                }
            } else {
                if (valClean !== "" && !/^\d+$/.test(valClean)) {
                    errors.push({
                        line: lineNum,
                        field: name,
                        start,
                        end,
                        value: rawVal.trim(),
                        rule: "formato_documento",
                        message: `El documento debe contener únicamente dígitos numéricos. Encontrado: '${valClean}'.`
                    });
                }
            }
        }
    }

    Object.entries(CATALOGS).forEach(([fieldName, catalog]) => {
        const rawVal = rawFields[fieldName] || "";
        if (rawVal.trim() === "") return;
        const alreadyHasBlockingFieldError = errors.some(e =>
            e.field === fieldName &&
            ["obligatorio", "valor_cero_no_permitido", "formato_entero"].includes(e.rule)
        );
        if (alreadyHasBlockingFieldError) return;
        const normalized = normalizeCatalogCode(fieldName, rawVal);
        if (!Object.prototype.hasOwnProperty.call(catalog, normalized)) {
            const fieldDef = LAYOUT.find(f => f.name === fieldName);
            const allowed = Object.keys(catalog).join(", ");
            errors.push({
                line: lineNum,
                field: fieldName,
                start: fieldDef ? fieldDef.start : 0,
                end: fieldDef ? fieldDef.end : 0,
                value: rawVal,
                rule: "codigo_no_homologado",
                message: `El campo '${fieldDef ? fieldDef.label : fieldName}' tiene el codigo '${rawVal.trim()}', que no esta homologado por AFIP/SICORE. Valores permitidos: ${allowed}.`
            });
        }
    });

    const baseCalculo = parseAmount(rawFields["base_calculo"] || "");
    const importeRetencion = parseAmount(rawFields["importe_retencion"] || "");
    if (baseCalculo !== null && importeRetencion !== null && baseCalculo < importeRetencion) {
        errors.push({
            line: lineNum,
            field: "base_calculo",
            start: 53,
            end: 66,
            value: rawFields["base_calculo"],
            rule: "base_menor_importe_retencion",
            message: "La Base de Calculo no puede ser menor al Importe de Retencion."
        });
    }

    const fechaComprobante = parseSicoreDate(rawFields["fecha_comprobante"] || "");
    const fechaRetencion = parseSicoreDate(rawFields["fecha_retencion"] || "");
    if (fechaComprobante && fechaRetencion && fechaComprobante > fechaRetencion) {
        errors.push({
            line: lineNum,
            field: "fecha_comprobante",
            start: 3,
            end: 12,
            value: rawFields["fecha_comprobante"],
            rule: "fecha_comprobante_posterior_retencion",
            message: "La Fecha de Comprobante no puede ser posterior a la Fecha de Retencion."
        });
    }

    return errors;
}

/**
 * Detecta si el archivo es LITE o FULL basándose en el ancho de la primera línea.
 */
function detectFileType(fileText) {
    if (!fileText || fileText.trim() === "") return "FULL";
    const lines = fileText.split(/\r?\n/);
    if (lines.length === 0) return "FULL";
    const firstLineClean = lines[0].replace(/\r?\n$/, "");
    if (firstLineClean.length === 145) {
        return "LITE";
    }
    return "FULL";
}

/**
 * Valida un archivo completo de SICORE.
 * Retorna reporte estructurado.
 */
function validateSicoreFile(fileText, expectedPeriod = null) {
    const report = {
        status: "VALID",
        processedLines: 0,
        errorCount: 0,
        errors: [],
        fileType: "FULL"
    };

    if (!fileText || fileText.trim() === "") {
        report.status = "INVALID";
        report.errors.push({
            line: 0,
            field: "archivo",
            start: 0,
            end: 0,
            value: "",
            rule: "archivo_vacio",
            message: "El archivo de texto está vacío. Debe contener al menos una línea con datos."
        });
        report.errorCount = 1;
        return report;
    }

    // Dividir líneas aceptando diferentes finales de línea (\n o \r\n)
    let lines = fileText.split(/\r?\n/);

    // Filtrar líneas vacías del final como confirmó el usuario
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }

    if (lines.length === 0) {
        report.status = "INVALID";
        report.errors.push({
            line: 0,
            field: "archivo",
            start: 0,
            end: 0,
            value: "",
            rule: "archivo_vacio",
            message: "El archivo de texto contiene únicamente líneas en blanco."
        });
        report.errorCount = 1;
        return report;
    }

    const fileType = detectFileType(fileText);
    report.fileType = fileType;
    report.processedLines = lines.length;

    const expectedLength = fileType === "LITE" ? 145 : 198;

    // --- Validación de consistencia de longitud entre todas las filas ---
    // Garantiza que todas las líneas tengan el mismo ancho que la primera detectada
    const allLengths = new Set(lines.map(l => l.replace(/\r?\n$/, "").length));
    if (allLengths.size > 1) {
        const consistencyErrors = [];
        lines.forEach((line, i) => {
            const cleanLine = line.replace(/\r?\n$/, "");
            if (cleanLine.length !== expectedLength) {
                consistencyErrors.push({
                    line: i + 1,
                    field: "linea_completa",
                    start: 1,
                    end: expectedLength,
                    value: `Longitud: ${cleanLine.length}`,
                    rule: "inconsistencia_longitud",
                    message: `Inconsistencia de formato: el archivo fue detectado como ${fileType} (${expectedLength} caracteres) pero esta línea tiene ${cleanLine.length} caracteres.`
                });
            }
        });
        if (consistencyErrors.length > 0) {
            report.status = "INVALID";
            report.errorCount = consistencyErrors.length;
            report.errors = consistencyErrors;
            return report;
        }
    }

    const allErrors = [];

    for (let i = 0; i < lines.length; i++) {
        const lineNum = i + 1;
        const lineErrors = validateLine(lineNum, lines[i], expectedPeriod, fileType);
        if (lineErrors.length > 0) {
            allErrors.push(...lineErrors);
        }
    }

    if (allErrors.length > 0) {
        report.status = "INVALID";
        report.errorCount = allErrors.length;
        report.errors = allErrors;
    }

    return report;
}
