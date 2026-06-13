document.addEventListener('DOMContentLoaded', () => {
    // Inicializar iconos de Lucide
    lucide.createIcons();

    // Referencias DOM FASE 2
    const backBtn = document.getElementById('backToPhase1');
    const savePhase2Btn = document.getElementById('savePhase2');

    // Controles de visibilidad
    const gaArterial = document.getElementById('gaArterial');
    const gaVenosa = document.getElementById('gaVenosa');
    const arterialFields = document.getElementById('arterialFields');
    const venousFields = document.getElementById('venousFields');

    // Inputs
    const paCO2Input = document.getElementById('paCO2');
    const pvCO2Input = document.getElementById('pvCO2');
    const paO2ArterialInput = document.getElementById('paO2'); // Gasometría Arterial
    const paO2PafiInput = document.getElementById('pao2'); // Calculadora PAFI
    const phArterialInput = document.getElementById('phArterial');
    const hco3ArterialInput = document.getElementById('hco3Arterial');
    const lactatoInput = document.getElementById('lactato');
    const fio2Input = document.getElementById('fio2');
    const deltaCO2Input = document.getElementById('deltaCO2');

    // Lista de inputs que dispararán el recálculo automático
    const inputsDinamicos = [
        paCO2Input, pvCO2Input, paO2ArterialInput, paO2PafiInput,
        phArterialInput, hco3ArterialInput, lactatoInput, fio2Input
    ];

    // ===== NAVEGACIÓN Y GUARDADO CON TRANSICIÓN =====
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            guardarDatosFase2();
            // 1. Animación de salida al volver
            document.body.classList.add('fade-out-page');
            // 2. Esperar y redirigir
            setTimeout(() => {
                window.location.href = 'delta1.html';
            }, 400);
        });
    }

    // ===== NAVEGACIÓN Y GUARDADO CON TRANSICIÓN Y API =====
    if (savePhase2Btn) {
        // Agregamos la palabra "async" para poder usar peticiones a la base de datos
        savePhase2Btn.addEventListener('click', async () => {
            const errorMsg = validarFase2(true);

            if (errorMsg) {
                mostrarToast(`⚠️ ERROR: ${errorMsg}`);
            } else {
                // 1. Procesa los cálculos y guarda en localStorage (para el PDF)
                procesarFase2();
                guardarDatosFase2();

                // 2. Extrae los datos recién guardados
                const data = JSON.parse(localStorage.getItem('deltaMortScore'));

                // 3. Prepara el paquete de datos exacto que espera tu tabla de MySQL
                const payload = {
                    folio: 'DLT-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0'),
                    edad: parseInt(data.edad) || 0,
                    genero: data.genero || 'N/E',
                    sepsis: data.sepsis === 'si' ? (data.sepsisOrigen || 'Sí') : 'No',
                    score: data.score || 0,
                    lactato: parseFloat(data.lactato) || 0,
                    procalcitonina: data.procalcitonina ? parseFloat(data.procalcitonina) : null,
                    estado: (data.score >= 6) ? 'Crítico' : (data.score >= 3 ? 'Medio' : 'Bajo'),
                    datosCompletos: data // Guarda todo el JSON completo en la última columna
                };

                try {
                    // 4. ENVÍA LOS DATOS A TU SERVIDOR NODE.JS
                    savePhase2Btn.innerHTML = '<i class="pulse-indicator me-2"></i> Guardando en Servidor...';

                    const response = await fetch('http://localhost:3000/api/pacientes', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    const result = await response.json();
                    if (result.pacienteId) {
                        localStorage.setItem('currentPacienteId', result.pacienteId);
                    }

                    // 5. Animación de salida al terminar de guardar
                    document.body.classList.add('fade-out-page');
                    setTimeout(() => {
                        window.location.href = 'delta3.html';
                    }, 400);

                } catch (error) {
                    console.error("Error al guardar en MySQL:", error);
                    mostrarToast("⚠️ Advertencia: No se pudo conectar al servidor de base de datos, pero puede continuar hacia Delta 3.");

                    // Aún si falla el servidor, continuamos hacia Delta 3
                    setTimeout(() => {
                        window.location.href = 'delta3.html';
                    }, 1500);
                }
            }
        });
    }

    // Limpiar alertas rojas al escribir (UX)
    document.addEventListener('input', (e) => {
        if (e.target.classList && e.target.classList.contains('is-invalid')) {
            e.target.classList.remove('is-invalid');
        }
    });

    document.addEventListener('change', (e) => {
        if (e.target.classList && e.target.classList.contains('is-invalid')) {
            e.target.classList.remove('is-invalid');
        }
    });

    // ===== GESTIÓN DE VISIBILIDAD DE GASOMETRÍAS =====
    if (gaArterial && arterialFields) {
        gaArterial.addEventListener('change', () => {
            if (gaArterial.value === 'si') {
                arterialFields.classList.remove('d-none');
            } else {
                arterialFields.classList.add('d-none');
                limpiarCamposGrupo(arterialFields);
            }
            calcularDeltaCO2();
            procesarFase2();
        });
    }

    if (gaVenosa && venousFields) {
        gaVenosa.addEventListener('change', () => {
            if (gaVenosa.value === 'si') {
                venousFields.classList.remove('d-none');
            } else {
                venousFields.classList.add('d-none');
                limpiarCamposGrupo(venousFields);
            }
            calcularDeltaCO2();
            procesarFase2();
        });
    }

    // ===== VINCULACIÓN AUTOMÁTICA: PaO2 Gasometría ↔ PaO2 PAFI =====
    if (paO2ArterialInput && paO2PafiInput) {
        paO2ArterialInput.addEventListener('input', () => {
            paO2PafiInput.value = paO2ArterialInput.value;
            if (paO2PafiInput.value !== '') paO2PafiInput.classList.remove('is-invalid');
        });

        paO2PafiInput.addEventListener('input', () => {
            paO2ArterialInput.value = paO2PafiInput.value;
            if (paO2ArterialInput.value !== '') paO2ArterialInput.classList.remove('is-invalid');
        });
    }

    // ===== ESCUCHADORES AUTOMÁTICOS (TIEMPO REAL) =====
    inputsDinamicos.forEach(input => {
        if (input) {
            input.addEventListener('input', () => {
                calcularDeltaCO2();
                procesarFase2();
            });
        }
    });

    // Carga inicial
    cargarDatosFase2();
});

// ==========================================
// VALIDACIÓN DE FORMULARIO (FASE 2)
// ==========================================

function validarFase2(mostrarAlertas = true) {
    let primerError = null;

    // Limpiamos alertas si estamos en modo estricto
    if (mostrarAlertas) {
        document.querySelectorAll('#phase2Form .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    }

    const validarCampo = (id, mensaje) => {
        const el = document.getElementById(id);
        if (!el || el.value.trim() === '') {
            if (mostrarAlertas && el) el.classList.add('is-invalid');
            if (!primerError) primerError = mensaje;
        }
    };

    // Validar Gasometría Arterial si está activa
    const gaArt = document.getElementById('gaArterial')?.value;
    if (gaArt === 'si') {
        validarCampo('phArterial', 'Ingrese el pH Arterial.');
        validarCampo('paO2', 'Ingrese la PaO₂ Arterial.');
        validarCampo('hco3Arterial', 'Ingrese el HCO₃ Arterial.');
        validarCampo('paCO2', 'Ingrese la PaCO₂ Arterial.');
    }

    // Validar Gasometría Venosa si está activa
    const gaVen = document.getElementById('gaVenosa')?.value;
    if (gaVen === 'si') {
        validarCampo('pvCO2', 'Ingrese la PvCO₂ Venosa.');
    }

    // Campos siempre obligatorios
    validarCampo('lactato', 'El valor de Lactato es obligatorio.');
    validarCampo('pao2', 'La PaO₂ es requerida para el Índice de Kirby.');
    validarCampo('fio2', 'La FiO₂ es requerida para el Índice de Kirby.');

    return primerError;
}

// ==========================================
// FUNCIONES DE LÓGICA CLÍNICA (FASE 2)
// ==========================================

function limpiarCamposGrupo(contenedor) {
    const inputs = contenedor.querySelectorAll('input');
    inputs.forEach(i => {
        i.value = '';
        i.classList.remove('is-invalid');
    });
}

function calcularDeltaCO2() {
    const paCO2Input = document.getElementById('paCO2');
    const pvCO2Input = document.getElementById('pvCO2');
    const deltaCO2Input = document.getElementById('deltaCO2');

    if (!paCO2Input || !pvCO2Input || !deltaCO2Input) return;

    const paCO2 = parseFloat(paCO2Input.value);
    const pvCO2 = parseFloat(pvCO2Input.value);

    if (!isNaN(paCO2) && !isNaN(pvCO2)) {
        const diff = (pvCO2 - paCO2).toFixed(1);
        deltaCO2Input.value = `${diff} mmHg`;
        if (parseFloat(diff) >= 6.0) {
            deltaCO2Input.classList.remove('text-info');
            deltaCO2Input.classList.add('text-warning');
        } else {
            deltaCO2Input.classList.remove('text-warning');
            deltaCO2Input.classList.add('text-info');
        }
    } else {
        deltaCO2Input.value = '';
        deltaCO2Input.classList.remove('text-warning');
        deltaCO2Input.classList.add('text-info');
    }
}

function procesarFase2() {
    const summaryDiv = document.getElementById('phase2Summary');
    const pafiResultContainer = document.getElementById('pafiResultContainer');
    if (!summaryDiv) return;

    // 1. VALIDACIÓN SILENCIOSA
    // Revisamos si faltan datos SIN pintar de rojo para no molestar mientras se teclea
    const errorPendiente = validarFase2(false);

    if (errorPendiente) {
        summaryDiv.innerHTML = `
            <div class="p-3 rounded text-warning" style="background: rgba(255, 159, 0, 0.05); border: 1px solid rgba(255, 159, 0, 0.2);">
                <i data-lucide="alert-triangle" style="width:16px;height:16px;" class="me-2"></i>
                <strong>Esperando datos:</strong> <br>
                <span style="font-size: 0.8rem; opacity: 0.8;">${errorPendiente}</span>
            </div>
        `;
        if (pafiResultContainer) pafiResultContainer.classList.add('d-none');
        lucide.createIcons();
        return; // Detenemos el cálculo hasta que los datos estén completos
    }

    // 2. OBTENER SCORE DE FASE 1 DESDE LA MEMORIA
    const raw = localStorage.getItem('deltaMortScore');
    let scoreFase1 = 0;
    if (raw) {
        const data = JSON.parse(raw);
        scoreFase1 = data.score || 0;
    }

    // 3. LEER PARÁMETROS COMPLETOS DE LA INTERFAZ
    const lactato = parseFloat(document.getElementById('lactato')?.value);
    const gaArterialVal = document.getElementById('gaArterial')?.value || 'no';
    const phArterial = parseFloat(document.getElementById('phArterial')?.value);
    const hco3Arterial = parseFloat(document.getElementById('hco3Arterial')?.value);
    const paCO2 = parseFloat(document.getElementById('paCO2')?.value);
    const pvCO2 = parseFloat(document.getElementById('pvCO2')?.value);

    // Delta CO2
    const deltaCO2 = !isNaN(paCO2) && !isNaN(pvCO2) ? (pvCO2 - paCO2).toFixed(1) : null;

    // ===== CÁLCULO PAFI / ÍNDICE DE KIRBY =====
    const paO2 = parseFloat(document.getElementById('pao2')?.value);
    const fio2Input = parseFloat(document.getElementById('fio2')?.value);
    let pafiResult = null;
    let pafiClase = '';
    let pafiClasificacion = '';

    if (!isNaN(paO2) && !isNaN(fio2Input) && paO2 >= 10) {
        let fio2Decimal = fio2Input;

        if (fio2Input > 1) {
            if (fio2Input >= 21 && fio2Input <= 100) {
                fio2Decimal = fio2Input / 100;
            } else {
                fio2Decimal = null;
            }
        } else if (fio2Input >= 0.21 && fio2Input <= 1) {
            fio2Decimal = fio2Input;
        } else {
            fio2Decimal = null;
        }

        if (fio2Decimal !== null) {
            pafiResult = Math.round(paO2 / fio2Decimal);

            if (pafiResult <= 100) {
                pafiClasificacion = 'SDRA Grave (Mortalidad ~45%)';
                pafiClase = 'text-danger';
            } else if (pafiResult <= 200) {
                pafiClasificacion = 'SDRA Moderado (Mortalidad ~32%)';
                pafiClase = 'text-warning';
            } else if (pafiResult <= 300) {
                pafiClasificacion = 'SDRA Leve (Mortalidad ~27%)';
                pafiClase = 'text-info';
            } else {
                pafiClasificacion = 'Oxigenación Adecuada';
                pafiClase = 'text-success';
            }

            // Mostrar el resultado en el formulario visualmente
            if (pafiResultContainer) {
                pafiResultContainer.classList.remove('d-none');
                document.getElementById('resultado').innerHTML = `PAFI: <span class="${pafiClase}">${pafiResult}</span>`;
                document.getElementById('interpretacion').innerHTML = pafiClasificacion;
            }
        }
    } else if (pafiResultContainer) {
        pafiResultContainer.classList.add('d-none');
    }

    // ===== CONSTRUCCIÓN DEL RESUMEN HUD =====
    let html = `<div class="mb-3 border-bottom border-secondary border-opacity-25 pb-2">
                    <span class="d-block text-white" style="font-weight:700;">REPORTE CLÍNICO FINAL:</span>
                </div>`;

    // Resumen de Fase 1
    html += `<div class="mb-2 d-flex justify-content-between">
                <span>Puntaje Fase 1:</span>
                <strong class="${scoreFase1 >= 6 ? 'text-danger' : (scoreFase1 >= 3 ? 'text-warning' : 'text-success')}">${scoreFase1} pts</strong>
             </div>`;

    // Lactato
    let lactatoColor = 'var(--neon-green)';
    if (lactato > 4.0) lactatoColor = 'var(--neon-red)';
    else if (lactato > 2.0) lactatoColor = 'var(--neon-orange)';

    html += `<div class="mb-2 d-flex justify-content-between">
                <span>Lactato Sérico:</span>
                <strong style="color: ${lactatoColor}">${lactato.toFixed(1)} mmol/L</strong>
             </div>`;

    // Delta pCO2
    if (deltaCO2 !== null) {
        html += `<div class="mb-2 d-flex justify-content-between">
                    <span>Δ pCO₂:</span>
                    <strong class="${parseFloat(deltaCO2) >= 6.0 ? 'text-warning' : 'text-success'}">${deltaCO2} mmHg</strong>
                 </div>`;
    }

    // PAFI - Índice de Kirby
    if (pafiResult !== null) {
        html += `<div class="mb-2 d-flex justify-content-between align-items-center">
                    <span>Índice PAFI:</span>
                    <div class="text-end">
                        <strong class="${pafiClase}">${pafiResult}</strong>
                    </div>
                 </div>`;
    }

    // Interpretación GSA
    if (gaArterialVal === 'si') {
        const interpretacionGSA = interpretarGSAArterial(phArterial, paCO2, hco3Arterial);
        html += `<div class="mb-2 mt-3 pt-2 border-top border-secondary border-opacity-25">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span class="text-white-50">Equilibrio Ácido-Base:</span>
                        <strong class="${interpretacionGSA.clase} text-end">${interpretacionGSA.trastorno}</strong>
                    </div>
                    ${interpretacionGSA.detalle ? `<div class="text-end text-white-50" style="font-size: 0.75rem; line-height:1.2;">${interpretacionGSA.detalle}</div>` : ''}
                 </div>`;
    }

    // Sugerencia Diagnóstica Final
    let statusSugestion = "Estabilidad Hemodinámica";
    let alertClass = "text-success";

    if (lactato > 4.0 || (scoreFase1 >= 6)) {
        statusSugestion = "COMPROMISO CRÍTICO / SHOCK";
        alertClass = "text-danger";
    } else if (lactato > 2.0 || (deltaCO2 !== null && parseFloat(deltaCO2) >= 6.0) || scoreFase1 >= 3) {
        statusSugestion = "HIPOPERFUSIÓN / ALTO RIESGO";
        alertClass = "text-warning";
    }

    html += `<div class="mt-4 p-2 rounded text-center" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05);">
                <span class="d-block text-white-50 mb-1" style="font-size:0.7rem;">Impresión Diagnóstica Sugerida:</span>
                <strong class="${alertClass}" style="font-size:0.85rem; font-family: var(--font-hud);">${statusSugestion}</strong>
             </div>`;

    summaryDiv.innerHTML = html;
    lucide.createIcons();
}

function interpretarGSAArterial(ph, paCO2, hco3) {
    if (isNaN(ph) || isNaN(paCO2) || isNaN(hco3)) {
        return { trastorno: 'Datos insuficientes', detalle: '', clase: 'text-white-50' };
    }

    const acidemia = ph < 7.35;
    const alcalemia = ph > 7.45;

    let trastornoPrimario = "";
    let detalleCompensacion = "";
    let clase = "text-info";

    if (acidemia) {
        if (hco3 < 22 && paCO2 > 45) {
            trastornoPrimario = "Acidosis Mixta";
            detalleCompensacion = "Agresión metabólica y respiratoria severa simultánea.";
            clase = "text-danger";
        } else if (hco3 < 22) {
            trastornoPrimario = "Acidosis Metabólica";
            clase = "text-warning";
            const pCO2_esp = (1.5 * hco3) + 8;
            if (paCO2 >= (pCO2_esp - 2) && paCO2 <= (pCO2_esp + 2)) {
                detalleCompensacion = `Pura. Compensación adecuada (~${pCO2_esp.toFixed(1)} mmHg).`;
            } else if (paCO2 > (pCO2_esp + 2)) {
                detalleCompensacion = `Mixta. Acidosis respiratoria sobreagregada.`;
            } else {
                detalleCompensacion = `Mixta. Alcalosis respiratoria sobreagregada.`;
            }
        } else if (paCO2 > 45) {
            trastornoPrimario = "Acidosis Respiratoria";
            clase = "text-warning";
            const deltaPCO2 = paCO2 - 40;
            const hco3_agudo = 24 + (0.1 * deltaPCO2);
            const hco3_cronico = 24 + (0.4 * deltaPCO2);
            detalleCompensacion = `Compensación: Aguda ~${hco3_agudo.toFixed(1)} | Crónica ~${hco3_cronico.toFixed(1)}`;
        }
    } else if (alcalemia) {
        if (hco3 > 26 && paCO2 < 35) {
            trastornoPrimario = "Alcalosis Mixta";
            detalleCompensacion = "Alcalosis metabólica y respiratoria concomitante.";
            clase = "text-danger";
        } else if (hco3 > 26) {
            trastornoPrimario = "Alcalosis Metabólica";
            clase = "text-warning";
            const pCO2_esp = (0.7 * hco3) + 21;
            if (paCO2 >= (pCO2_esp - 2) && paCO2 <= (pCO2_esp + 2)) {
                detalleCompensacion = `Pura. Compensación adecuada (~${pCO2_esp.toFixed(1)} mmHg).`;
            } else if (paCO2 > (pCO2_esp + 2)) {
                detalleCompensacion = `Mixta. Acidosis respiratoria sobreagregada.`;
            } else {
                detalleCompensacion = `Mixta. Alcalosis respiratoria sobreagregada.`;
            }
        } else if (paCO2 < 35) {
            trastornoPrimario = "Alcalosis Respiratoria";
            clase = "text-warning";
            const deltaPCO2 = 40 - paCO2;
            const hco3_agudo = 24 - (0.2 * deltaPCO2);
            const hco3_cronico = 24 - (0.5 * deltaPCO2);
            detalleCompensacion = `Compensación: Aguda ~${hco3_agudo.toFixed(1)} | Crónica ~${hco3_cronico.toFixed(1)}`;
        }
    } else {
        if (paCO2 >= 35 && paCO2 <= 45 && hco3 >= 22 && hco3 <= 26) {
            trastornoPrimario = "Equilibrio Normal";
            detalleCompensacion = "Sin desequilibrios detectados.";
            clase = "text-success";
        } else {
            trastornoPrimario = "Trastorno Mixto";
            clase = "text-info";
            if (paCO2 > 45 && hco3 > 26) detalleCompensacion = "Acidosis respiratoria + Alcalosis metabólica latente.";
            if (paCO2 < 35 && hco3 < 22) detalleCompensacion = "Alcalosis respiratoria + Acidosis metabólica latente.";
        }
    }

    return { trastorno: trastornoPrimario, detalle: detalleCompensacion, clase: clase };
}

// ==========================================
// FUNCIONES DE MEMORIA (LOCALSTORAGE)
// ==========================================

function guardarDatosFase2() {
    const prevData = JSON.parse(localStorage.getItem('deltaMortScore')) || {};

    const data = {
        ...prevData,
        gaArterial: document.getElementById('gaArterial')?.value || 'no',
        gaVenosa: document.getElementById('gaVenosa')?.value || 'no',
        paCO2: document.getElementById('paCO2')?.value || '',
        pvCO2: document.getElementById('pvCO2')?.value || '',
        paO2: document.getElementById('paO2')?.value || document.getElementById('pao2')?.value || '',
        phArterial: document.getElementById('phArterial')?.value || '',
        hco3Arterial: document.getElementById('hco3Arterial')?.value || '',
        lactato: document.getElementById('lactato')?.value || '',
        fio2: document.getElementById('fio2')?.value || '',
        savedAt: new Date().toISOString()
    };

    localStorage.setItem('deltaMortScore', JSON.stringify(data));
}

function cargarDatosFase2() {
    const raw = localStorage.getItem('deltaMortScore');
    if (!raw) {
        procesarFase2(); // Para que muestre el recuadro naranja de "Faltan datos" al inicio
        return;
    }

    try {
        const data = JSON.parse(raw);

        if (document.getElementById('gaArterial')) document.getElementById('gaArterial').value = data.gaArterial || 'no';
        if (document.getElementById('gaVenosa')) document.getElementById('gaVenosa').value = data.gaVenosa || 'no';

        if (data.gaArterial === 'si') document.getElementById('arterialFields')?.classList.remove('d-none');
        if (data.gaVenosa === 'si') document.getElementById('venousFields')?.classList.remove('d-none');

        if (document.getElementById('paCO2')) document.getElementById('paCO2').value = data.paCO2 || '';
        if (document.getElementById('pvCO2')) document.getElementById('pvCO2').value = data.pvCO2 || '';
        if (document.getElementById('phArterial')) document.getElementById('phArterial').value = data.phArterial || '';
        if (document.getElementById('hco3Arterial')) document.getElementById('hco3Arterial').value = data.hco3Arterial || '';
        if (document.getElementById('lactato')) document.getElementById('lactato').value = data.lactato || '';

        if (document.getElementById('paO2')) document.getElementById('paO2').value = data.paO2 || '';
        if (document.getElementById('pao2')) document.getElementById('pao2').value = data.paO2 || '';
        if (document.getElementById('fio2')) document.getElementById('fio2').value = data.fio2 || '';

        calcularDeltaCO2();
        procesarFase2();

    } catch (e) {
        console.error('Error al recuperar historial local de Fase 2', e);
    }
}

function mostrarToast(msg) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.right = '20px';
    toast.style.bottom = '20px';
    toast.style.background = 'rgba(3, 14, 30, 0.95)';
    toast.style.color = 'var(--neon-cyan)';
    toast.style.border = '1px solid var(--neon-cyan)';
    toast.style.boxShadow = '0 0 15px rgba(0, 240, 255, 0.3)';
    toast.style.fontFamily = 'var(--font-hud)';
    toast.style.fontSize = '0.8rem';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '6px';
    toast.style.zIndex = '99999';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';

    toast.innerHTML = `<span class="pulse-indicator me-2"></span> ${msg}`;

    document.body.appendChild(toast);
    toast.offsetHeight;

    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
    }, 2500);

    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2900);
}