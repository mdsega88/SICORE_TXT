/**
 * Validador Técnico para Archivos TXT SICORE.
 * Controlador UI (app.js).
 *
 * Maneja eventos de usuario, drag & drop, FileReader y renderizado dinámico.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Referencias a elementos del DOM
    const dropzone = document.getElementById("dropzone");
    const fileInput = document.getElementById("fileInput");
    const periodInput = document.getElementById("periodInput");
    const dashboard = document.getElementById("dashboard");
    const setupSection = document.getElementById("setupSection");

    // Métricas
    const statusCard = document.getElementById("statusCard");
    const statusIndicator = document.getElementById("statusIndicator");
    const statusTitle = document.getElementById("statusTitle");
    const statusSubtitle = document.getElementById("statusSubtitle");
    const processedLinesEl = document.getElementById("processedLines");
    const errorCountEl = document.getElementById("errorCount");
    const successRateEl = document.getElementById("successRate");
    const errorBadge = document.getElementById("errorBadge");
    const totalComprobantesEl = document.getElementById("totalComprobantes");
    const totalRetencionesEl = document.getElementById("totalRetenciones");

    // Tabla de Errores
    const errorTableBody = document.getElementById("errorTableBody");
    const detailCard = document.getElementById("detailCard");

    // Visualizador de Línea
    const visualizerCard = document.getElementById("visualizerCard");
    const visualizerCloseBtn = document.getElementById("visualizerCloseBtn");
    const lineString = document.getElementById("lineString");
    const rulerIndices = document.getElementById("rulerIndices");
    const infoLineNum = document.getElementById("infoLineNum");
    const infoFieldName = document.getElementById("infoFieldName");
    const infoFieldPos = document.getElementById("infoFieldPos");
    const infoFieldVal = document.getElementById("infoFieldVal");

    // Lector & Explorador de Datos y Sistema de Solapas (Tabs)
    const tabValidation = document.getElementById("tabValidation");
    const tabReader = document.getElementById("tabReader");
    const panelValidation = document.getElementById("panelValidation");
    const panelReader = document.getElementById("panelReader");
    const tabLogs = document.getElementById("tabLogs");
    const panelLogs = document.getElementById("panelLogs");
    const downloadFullLogBtn = document.getElementById("downloadFullLogBtn");
    const clearLogsBtn = document.getElementById("clearLogsBtn");

    // Filtros y Tabla del Lector
    const readerSearchInput = document.getElementById("readerSearchInput");
    const comprobanteFilter = document.getElementById("comprobanteFilter");
    const readerTableBody = document.getElementById("readerTableBody");
    const filteredCountEl = document.getElementById("filteredCount");
    const totalCountEl = document.getElementById("totalCount");

    // Modal de Detalle Digital
    const recordModal = document.getElementById("recordModal");
    const modalCloseBtn = document.getElementById("modalCloseBtn");

    // Badge de formato de archivo
    const fileFormatBadge = document.getElementById("fileFormatBadge");

    // Estado local de la aplicación
    let currentFileName = "";
    let currentFileContent = "";
    let currentLines = [];
    let currentFileType = "FULL"; // Tipo detectado del archivo actual
    let parsedRecords = []; // Registros estructurados para el explorador

    // Formatear input de período de manera interactiva (MM/AAAA)
    periodInput.addEventListener("input", (e) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 2) {
            val = val.substring(0, 2) + "/" + val.substring(2, 6);
        }
        e.target.value = val;

        // Re-validar si ya hay un archivo cargado
        if (currentFileContent) {
            processFileContent(currentFileContent);
        }
    });

    // Eventos de Drag & Drop para el Dropzone
    dropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        dropzone.classList.add("dragover");
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, () => {
            dropzone.classList.remove("dragover");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    });

    dropzone.addEventListener("click", () => {
        fileInput.click();
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });

    // Lector de Archivos
    function handleFile(file) {
        if (!file.name.endsWith(".txt")) {
            alert("Por favor, sube únicamente archivos de texto plano (.txt)");
            return;
        }
        currentFileName = file.name;

        const reader = new FileReader();
        reader.onload = (e) => {
            currentFileContent = e.target.result;
            processFileContent(currentFileContent);
        };
        reader.readAsText(file);
    }

    // Orquestador de validación y renderizado
    function processFileContent(fileText) {
        // Generar lista de líneas crudas para el visualizador
        currentLines = fileText.split(/\r?\n/);
        while (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() === "") {
            currentLines.pop();
        }

        const expectedPeriod = periodInput.value;

        // Validar período antes de procesar si está completo
        if (expectedPeriod && expectedPeriod.length < 7) {
            // No procesar hasta que esté completo MM/AAAA
            return;
        }

        // Detectar tipo de archivo (FULL=198 / LITE=145)
        currentFileType = detectFileType(fileText);

        // Campos FULL que no existen en LITE (inicio >= 146)
        const liteExcludedFields = new Set(
            LAYOUT.filter(f => f.start > 145).map(f => f.name)
        );

        // Parsear cada registro basándose en la estructura oficial (LAYOUT)
        parsedRecords = currentLines.map((lineContent, index) => {
            const lineNum = index + 1;
            const lineErrors = validateLine(lineNum, lineContent, expectedPeriod, currentFileType);
            const fields = {};

            LAYOUT.forEach(field => {
                // Para archivos LITE, los campos a partir de la pos 146 se dejan vacíos
                if (currentFileType === "LITE" && liteExcludedFields.has(field.name)) {
                    fields[field.name] = "".padEnd(field.end - field.start + 1, " ");
                    return;
                }

                let val = "";
                if (lineContent.length >= field.end) {
                    val = lineContent.slice(field.start - 1, field.end);
                } else if (lineContent.length > field.start - 1) {
                    val = lineContent.slice(field.start - 1).padEnd(field.end - field.start + 1, " ");
                } else {
                    val = "".padEnd(field.end - field.start + 1, " ");
                }
                fields[field.name] = val;
            });

            return {
                lineNum,
                rawContent: lineContent,
                fields,
                errors: lineErrors
            };
        });

        // Ejecutar motor validador en JS
        const report = validateSicoreFile(fileText, expectedPeriod);

        // Guardar la ejecución en el historial de logs
        saveValidationLog(currentFileName || "archivo.txt", expectedPeriod, report);

        // Ocultar visualizador previo
        visualizerCard.style.display = "none";

        // Resetear pestañas e inputs del buscador para el nuevo archivo
        tabValidation.classList.add("active");
        tabReader.classList.remove("active");
        panelValidation.style.display = "block";
        panelReader.style.display = "none";
        readerSearchInput.value = "";
        comprobanteFilter.value = "";

        // Renderizar Métricas y Dashboard
        renderDashboard(report);

        // Renderizar explorador de datos inicial
        renderReaderTable();
    }

    // Renderizar Dashboard
    function renderDashboard(report) {
        // Mostrar sección del Dashboard
        dashboard.style.display = "flex";

        // Desplazar suavemente hasta el reporte
        dashboard.scrollIntoView({ behavior: "smooth" });

        // Actualizar métricas generales
        processedLinesEl.textContent = report.processedLines;
        errorCountEl.textContent = report.errorCount;
        errorBadge.textContent = report.errorCount;

        // Calcular tasa de integridad por líneas correctas
        const uniqueLineErrors = new Set(report.errors.filter(e => e.line > 0).map(e => e.line)).size;
        const correctLines = report.processedLines - uniqueLineErrors;
        const rate = report.processedLines > 0 ? Math.round((correctLines / report.processedLines) * 100) : 0;
        successRateEl.textContent = `${rate}%`;

        // Calcular suma total de importes de comprobante y retenciones
        let sumComprobantes = 0;
        let sumRetenciones = 0;

        parsedRecords.forEach(rec => {
            const rawComp = rec.fields["importe_comprobante"];
            const rawRet = rec.fields["importe_retencion"];

            if (rawComp) {
                const parsedComp = parseAmount(rawComp);
                if (parsedComp !== null) {
                    sumComprobantes += parsedComp;
                }
            }
            if (rawRet) {
                const parsedRet = parseAmount(rawRet);
                if (parsedRet !== null) {
                    sumRetenciones += parsedRet;
                }
            }
        });

        // Formatear moneda con estándar es-AR (puntos para miles y comas para decimales)
        const formatCurrency = (val) => {
            return "$ " + val.toLocaleString("es-AR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        };

        totalComprobantesEl.textContent = formatCurrency(sumComprobantes);
        totalRetencionesEl.textContent = formatCurrency(sumRetenciones);

        // --- Badge de Formato LITE / FULL ---
        const ft = report.fileType || "FULL";
        fileFormatBadge.className = "file-format-badge"; // reset clases
        if (ft === "LITE") {
            fileFormatBadge.classList.add("lite");
            fileFormatBadge.textContent = "🍃 Formato Lite · 145 posiciones";
        } else {
            fileFormatBadge.classList.add("full");
            fileFormatBadge.textContent = "⚡ Formato Full · 198 posiciones";
        }
        fileFormatBadge.style.display = "inline-flex";

        // Renderizar Estado
        statusCard.className = "card status-card";
        const expectedLen = ft === "LITE" ? 145 : 198;
        if (report.status === "VALID") {
            statusCard.classList.add("valid");
            statusIndicator.textContent = "✓";
            statusTitle.textContent = "ARCHIVO VÁLIDO";
            statusSubtitle.textContent = `El archivo cumple 100% con la estructura del layout de ${expectedLen} caracteres de ancho fijo y las reglas analizadas.`;

            // Ocultar detalle de errores
            detailCard.style.display = "none";
        } else {
            statusCard.classList.add("invalid");
            statusIndicator.textContent = "✕";
            statusTitle.textContent = "ARCHIVO CON ERRORES";
            statusSubtitle.textContent = `Se han detectado ${report.errorCount} observaciones técnicas en el formato de importes, fechas o CUITs.`;

            // Mostrar y renderizar detalle de errores
            detailCard.style.display = "block";
            renderErrorsTable(report.errors);
        }
    }

    // Renderizar Tabla de Errores
    function renderErrorsTable(errors) {
        errorTableBody.innerHTML = "";

        errors.forEach(err => {
            const tr = document.createElement("tr");

            // Atributos de evento para el visualizador
            tr.dataset.line = err.line;
            tr.dataset.start = err.start;
            tr.dataset.end = err.end;
            tr.dataset.field = err.field;
            tr.dataset.value = err.value;

            // Fila interactiva
            tr.innerHTML = `
                <td class="cell-line">${err.line > 0 ? `Línea ${err.line}` : "Global"}</td>
                <td><span class="cell-badge critico">Crítico</span></td>
                <td class="cell-field">${err.field}</td>
                <td class="cell-pos">${err.start > 0 ? `${err.start}-${err.end}` : "-"}</td>
                <td><span class="cell-val">${escapeHtml(err.value)}</span></td>
                <td class="cell-message">${escapeHtml(err.message)}</td>
            `;

            // Clic en la fila abre el Visualizador de Layout
            tr.addEventListener("click", () => {
                showLineVisualizer(err);
            });

            errorTableBody.appendChild(tr);
        });
    }

    // Mostrar Visualizador del segmento de línea
    function showLineVisualizer(err) {
        if (err.line <= 0 || !currentLines[err.line - 1]) {
            return;
        }

        const rawLine = currentLines[err.line - 1];

        // Llenar información textual
        infoLineNum.textContent = err.line;
        infoFieldName.textContent = err.field;
        infoFieldPos.textContent = `${err.start}-${err.end} (Largo: ${err.end - err.start + 1})`;
        infoFieldVal.textContent = `"${err.value}"`;

        // Generar regla e índices superiores interactivos (longitud dinámica según tipo de archivo)
        rulerIndices.textContent = generateRulerString(currentFileType);

        // Resaltar el segmento exacto del campo con error
        const before = rawLine.slice(0, err.start - 1);
        const match = rawLine.slice(err.start - 1, err.end);
        const after = rawLine.slice(err.end);

        lineString.innerHTML = "";

        const spanBefore = document.createElement("span");
        spanBefore.textContent = before;
        spanBefore.style.color = "hsl(215, 16%, 35%)";

        const spanMatch = document.createElement("span");
        spanMatch.textContent = match;
        spanMatch.style.color = "hsl(354, 80%, 65%)";
        spanMatch.style.fontWeight = "bold";
        spanMatch.style.backgroundColor = "hsla(354, 76%, 53%, 0.15)";
        spanMatch.style.borderBottom = "2px dashed hsl(354, 76%, 53%)";
        spanMatch.style.padding = "2px 0";

        const spanAfter = document.createElement("span");
        spanAfter.textContent = after;
        spanAfter.style.color = "hsl(215, 16%, 35%)";

        lineString.appendChild(spanBefore);
        lineString.appendChild(spanMatch);
        lineString.appendChild(spanAfter);

        // Mostrar tarjeta
        visualizerCard.style.display = "flex";

        // Desplazar suavemente hasta el visualizador
        visualizerCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    // Cerrar Visualizador
    visualizerCloseBtn.addEventListener("click", () => {
        visualizerCard.style.display = "none";
    });

    // Auxiliar: Genera regla numérica dinámica según el tipo de archivo
    function generateRulerString(fileType) {
        const maxPos = (fileType === "LITE") ? 145 : 198;
        let ruler = "";
        for (let i = 1; i <= maxPos; i++) {
            if (i === 1) ruler += "1";
            else if (i === maxPos) ruler += maxPos.toString();
            else if (i % 10 === 0) ruler += (i / 10).toString().slice(-1);
            else if (i % 5 === 0) ruler += "+";
            else ruler += ".";
        }
        return ruler;
    }

    // Auxiliar: Escape de caracteres HTML para evitar XSS
    function escapeHtml(str) {
        if (!str) return "";
        return str
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // --- SISTEMA DE SOLAPAS (TABS) ---
    tabValidation.addEventListener("click", () => {
        tabValidation.classList.add("active");
        tabReader.classList.remove("active");
        tabLogs.classList.remove("active");
        panelValidation.style.display = "block";
        panelReader.style.display = "none";
        panelLogs.style.display = "none";
    });

    tabReader.addEventListener("click", () => {
        tabReader.classList.add("active");
        tabValidation.classList.remove("active");
        tabLogs.classList.remove("active");
        panelValidation.style.display = "none";
        panelReader.style.display = "block";
        panelLogs.style.display = "none";
        renderReaderTable();
    });

    tabLogs.addEventListener("click", () => {
        tabLogs.classList.add("active");
        tabValidation.classList.remove("active");
        tabReader.classList.remove("active");
        panelValidation.style.display = "none";
        panelReader.style.display = "none";
        panelLogs.style.display = "block";
        renderLogsTable();
    });

    // Eventos del Historial de Logs
    downloadFullLogBtn.addEventListener("click", downloadFullLog);
    clearLogsBtn.addEventListener("click", clearLogs);

    // --- EXPLORADOR Y FILTRADO DEL LECTOR ---
    function renderReaderTable() {
        if (!parsedRecords || parsedRecords.length === 0) {
            readerTableBody.innerHTML = `
                <tr>
                    <td colspan="22" style="text-align: center; padding: 40px; color: var(--text-muted); font-family: var(--font-body);">
                        No hay datos procesados. Por favor, cargue un archivo TXT válido primero.
                    </td>
                </tr>
            `;
            filteredCountEl.textContent = "0";
            totalCountEl.textContent = "0";
            return;
        }

        const searchText = readerSearchInput.value.toLowerCase().trim();
        const compFilter = comprobanteFilter.value;

        // Filtrar registros en tiempo real
        const filtered = parsedRecords.filter(rec => {
            // Filtrar por código de comprobante
            if (compFilter) {
                const compVal = (rec.fields["codigo_comprobante"] || "").trim();
                if (compVal !== compFilter) {
                    return false;
                }
            }

            // Filtrar por buscador general
            if (searchText) {
                const cuit = (rec.fields["documento_cuit"] || "").toLowerCase();
                const num = (rec.fields["numero_comprobante"] || "").toLowerCase();
                const denom = (rec.fields["denominacion_ordenante"] || "").toLowerCase();
                const imp = (rec.fields["importe_comprobante"] || "").toLowerCase();
                const ret = (rec.fields["importe_retencion"] || "").toLowerCase();
                const raw = rec.rawContent.toLowerCase();

                const matches = cuit.includes(searchText) ||
                    num.includes(searchText) ||
                    denom.includes(searchText) ||
                    imp.includes(searchText) ||
                    ret.includes(searchText) ||
                    raw.includes(searchText);

                if (!matches) {
                    return false;
                }
            }

            return true;
        });

        // Actualizar contadores
        totalCountEl.textContent = parsedRecords.length;
        filteredCountEl.textContent = filtered.length;

        // Renderizar registros en la tabla
        readerTableBody.innerHTML = "";

        if (filtered.length === 0) {
            readerTableBody.innerHTML = `
                <tr>
                    <td colspan="22" style="text-align: center; padding: 30px; color: var(--text-muted); font-family: var(--font-body);">
                        Ningún registro coincide con los criterios de búsqueda aplicados.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(rec => {
            const tr = document.createElement("tr");

            if (rec.errors && rec.errors.length > 0) {
                tr.classList.add("row-has-errors");
            }

            // Función auxiliar para renderizar celdas con o sin error resaltado
            const renderCell = (fieldName, type = "string") => {
                const val = rec.fields[fieldName] || "";
                const valClean = val.trim();
                const error = rec.errors && rec.errors.find(e => e.field === fieldName);

                let cellClass = "";
                if (type === "amount") cellClass = "cell-amount";
                else if (type === "mono") cellClass = "cell-mono";

                if (error) {
                    return `
                        <td class="${cellClass} cell-error-highlight" title="${escapeHtml(error.message)}">
                            ${escapeHtml(valClean === "" ? "VACÍO" : valClean)}
                        </td>
                    `;
                } else {
                    return `<td class="${cellClass}">${escapeHtml(valClean)}</td>`;
                }
            };

            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--text-secondary); text-align: center;">${rec.lineNum}</td>
                ${renderCell("codigo_comprobante", "mono")}
                ${renderCell("fecha_comprobante")}
                ${renderCell("numero_comprobante", "mono")}
                ${renderCell("importe_comprobante", "amount")}
                ${renderCell("codigo_impuesto", "mono")}
                ${renderCell("codigo_regimen", "mono")}
                ${renderCell("codigo_operacion", "mono")}
                ${renderCell("base_calculo", "amount")}
                ${renderCell("fecha_retencion")}
                ${renderCell("condicion", "mono")}
                ${renderCell("sujetos_suspendidos", "mono")}
                ${renderCell("importe_retencion", "amount")}
                ${renderCell("porcentaje_exclusion", "amount")}
                ${renderCell("fecha_vigencia")}
                ${renderCell("tipo_documento", "mono")}
                ${renderCell("documento_cuit", "mono")}
                ${renderCell("certificado_original", "mono")}
                ${renderCell("denominacion_ordenante")}
                ${renderCell("acrecentamiento", "mono")}
                ${renderCell("cuit_pais_retenido", "mono")}
                ${renderCell("cuit_ordenante", "mono")}
            `;

            // Doble clic o clic en la fila abre la vista digital premium
            tr.addEventListener("click", () => {
                showRecordModal(rec);
            });

            readerTableBody.appendChild(tr);
        });
    }

    // Enlazar eventos de filtros
    readerSearchInput.addEventListener("input", renderReaderTable);
    comprobanteFilter.addEventListener("change", renderReaderTable);

    // --- MODAL DE VISTA DIGITAL ---
    function showRecordModal(rec) {
        document.getElementById("modalTitle").textContent = `Comprobante Digital SICORE - Registro Línea ${rec.lineNum}`;

        const fields = [
            "codigo_comprobante", "fecha_comprobante", "numero_comprobante", "importe_comprobante",
            "base_calculo", "fecha_retencion", "codigo_impuesto", "codigo_regimen", "codigo_operacion",
            "condicion", "sujetos_suspendidos", "importe_retencion", "porcentaje_exclusion", "fecha_vigencia",
            "tipo_documento", "documento_cuit", "certificado_original", "denominacion_ordenante",
            "acrecentamiento", "cuit_pais_retenido", "cuit_ordenante"
        ];

        fields.forEach(f => {
            const el = document.getElementById(`det_${f}`);
            if (el) {
                const val = (rec.fields[f] || "").trim();
                el.textContent = val === "" ? "-" : val;

                // Si este campo tiene errores en el registro, lo marcamos visualmente
                const error = rec.errors && rec.errors.find(e => e.field === f);
                if (error) {
                    el.style.color = "var(--error)";
                    el.style.fontWeight = "bold";
                    el.title = error.message;
                } else {
                    el.style.color = "";
                    el.style.fontWeight = "";
                    el.removeAttribute("title");
                }
            }
        });

        // Panel de Auditoría dentro del Modal
        const auditAlert = document.getElementById("modalAuditAlert");
        if (rec.errors && rec.errors.length > 0) {
            auditAlert.innerHTML = `
                <div class="modal-audit-alert-title" style="font-weight: 700; color: var(--error); margin-bottom: 8px;">
                    ⚠️ Observaciones del Registro (${rec.errors.length})
                </div>
                <ul style="margin: 0; padding-left: 20px; color: var(--text-primary); font-size: 0.85rem;">
                    ${rec.errors.map(e => `<li style="margin-bottom: 4px;"><strong>${escapeHtml(e.field)}:</strong> ${escapeHtml(e.message)}</li>`).join("")}
                </ul>
            `;
            auditAlert.style.display = "block";
        } else {
            auditAlert.style.display = "none";
        }

        // Mostrar Modal
        recordModal.style.display = "flex";
    }

    // Cerrar modal
    modalCloseBtn.addEventListener("click", () => {
        recordModal.style.display = "none";
    });

    recordModal.addEventListener("click", (e) => {
        if (e.target === recordModal) {
            recordModal.style.display = "none";
        }
    });

    // --- FUNCIONES DEL HISTORIAL DE LOGS ---
    function saveValidationLog(fileName, period, report) {
        const logs = JSON.parse(localStorage.getItem("sicore_web_logs") || "[]");
        
        const timestamp = new Date().toLocaleString("es-AR");
        const statusStr = report.status === "VALID" ? "OK" : `CON ERRORES (${report.errorCount})`;
        const periodStr = period ? period : "No especificado";
        
        const logLine = `[${new Date().toISOString().replace('T', ' ').substring(0, 19)}] Archivo: ${fileName} | Periodo: ${periodStr} | Formato: ${report.fileType} | Estado: ${statusStr}`;

        const newLog = {
            id: Date.now(),
            timestamp,
            fileName,
            period: periodStr,
            fileType: report.fileType,
            status: report.status,
            processedLines: report.processedLines,
            errorCount: report.errorCount,
            logLine: logLine
        };

        logs.unshift(newLog); // Agregar al inicio
        localStorage.setItem("sicore_web_logs", JSON.stringify(logs));
    }

    function renderLogsTable() {
        const logsTableBody = document.getElementById("logsTableBody");
        const logs = JSON.parse(localStorage.getItem("sicore_web_logs") || "[]");

        if (logs.length === 0) {
            logsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; padding: 45px; color: var(--text-muted); font-family: var(--font-body);">
                        No hay registros de validaciones en esta sesión. Cargue un archivo para iniciar.
                    </td>
                </tr>
            `;
            return;
        }

        logsTableBody.innerHTML = "";
        logs.forEach(log => {
            const tr = document.createElement("tr");
            
            const isOk = log.status === "VALID";
            const badgeClass = isOk ? "ok-badge" : "error-badge";
            const badgeText = isOk ? "✓ VÁLIDO" : `⚠ ERRORES (${log.errorCount})`;
            
            const formatBadgeClass = log.fileType === "LITE" ? "lite-badge" : "full-badge";
            
            tr.innerHTML = `
                <td>${log.timestamp}</td>
                <td style="font-weight: 500; color: var(--text-primary);">${escapeHtml(log.fileName)}</td>
                <td>${log.period}</td>
                <td><span class="file-type-badge-mini ${formatBadgeClass}">${log.fileType}</span></td>
                <td><span class="status-badge-mini ${badgeClass}">${badgeText}</span></td>
                <td>${log.processedLines}</td>
                <td>${log.errorCount}</td>
                <td>
                    <button class="download-single-log-btn" data-id="${log.id}" style="background: hsla(215, 20%, 65%, 0.15); border: 1px solid var(--border-color); color: var(--text-primary); padding: 5px 10px; border-radius: var(--radius-sm); font-size: 0.8rem; cursor: pointer; transition: background 0.2s;">
                        📥 TXT
                    </button>
                </td>
            `;
            
            // Listener para descargar este log individual
            const btn = tr.querySelector(".download-single-log-btn");
            btn.addEventListener("click", () => {
                downloadTxtFile(`log_${log.fileName}`, log.logLine);
            });

            logsTableBody.appendChild(tr);
        });
    }

    function downloadFullLog() {
        const logs = JSON.parse(localStorage.getItem("sicore_web_logs") || "[]");
        if (logs.length === 0) {
            alert("No hay registros en el historial para descargar.");
            return;
        }
        const text = logs.map(log => log.logLine).join("\n");
        downloadTxtFile("sicore_run_log.txt", text);
    }

    function clearLogs() {
        if (confirm("¿Estás seguro de que deseas limpiar todo el historial de logs del navegador?")) {
            localStorage.removeItem("sicore_web_logs");
            renderLogsTable();
        }
    }

    function downloadTxtFile(filename, text) {
        const element = document.createElement('a');
        element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
        element.setAttribute('download', filename);
        element.style.display = 'none';
        document.body.appendChild(element);
        element.click();
        document.body.removeChild(element);
    }
});

