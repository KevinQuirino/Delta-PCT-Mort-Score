document.addEventListener('DOMContentLoaded', () => {
    // Inicializar iconos de Lucide
    lucide.createIcons();

    // Referencias DOM principales (Se eliminó calcBtn)
    const saveBtn = document.getElementById('saveBtn');
    const clearBtn = document.getElementById('clearBtn');
    const continueBtn = document.getElementById('continueBtn');
    
    // Modal de limpieza
    const cyberModal = document.getElementById('cyberConfirmModal');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmOkBtn = document.getElementById('confirmOkBtn');

    // Referencias a contenedores dinámicos
    const selectComorbilidades = document.getElementById('comorbilidades');
    const contComorbilidadesExtra = document.getElementById('comorbilidadesExtra');
    const inputComorbilidadesDetalle = document.getElementById('comorbilidadesDetalle');
    const edadInput = document.getElementById('edad');
    const sepsisSelect = document.getElementById('sepsis');
    const sepsisOrigenContainer = document.getElementById('sepsisOrigenContainer');
    const sepsisOrigenSelect = document.getElementById('sepsisOrigen');

    // Referencias cálculo PAM
    const sysBPDelta1Input = document.getElementById('sysBPDelta1');
    const diaBPDelta1Input = document.getElementById('diaBPDelta1');
    const pamDelta1Text = document.getElementById('pamDelta1Text');

    const camposIds = [
        'genero', 'edad', 'comorbilidades', 'estadoMental', 'llenadoCapilar',
        'frecuenciaCardiaca', 'temperatura',
        'frecuenciaRespiratoria', 'satO2', 'sepsis'
    ];

    // ===== EVENT LISTENERS BOTONERA =====
    if (saveBtn) saveBtn.addEventListener('click', guardarDatosFase1);
    
    if (clearBtn) {
        clearBtn.addEventListener('click', () => cyberModal.classList.add('active'));
    }

    if (confirmCancelBtn) {
        confirmCancelBtn.addEventListener('click', () => cyberModal.classList.remove('active'));
    }

    if (confirmOkBtn) {
        confirmOkBtn.addEventListener('click', () => {
            cyberModal.classList.remove('active');
            ejecutarLimpieza();
        });
    }

// Validación y Redirección a Delta 2 con Transición
    if (continueBtn) {
        continueBtn.addEventListener('click', (e) => {
            e.preventDefault(); 
            
            const errorMsg = validarFase1();
            
            if (errorMsg) {
                mostrarToast(`⚠️ ERROR: ${errorMsg}`);
            } else {
                guardarDatosFase1();
                
                // 1. Agregamos la clase de animación de salida al cuerpo de la página
                document.body.classList.add('fade-out-page');
                
                // 2. Esperamos 400 milisegundos (lo que dura la animación) para cambiar de página
                setTimeout(() => {
                    window.location.href = 'delta2.html'; 
                }, 400);
            }
        });
    }

    // Limpiar alertas rojas al escribir
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

    // ===== ESCUCHADORES AUTOMÁTICOS (RECALCULAR SCORE EN TIEMPO REAL) =====
    camposIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => mostrarDescripcion(calcularScore()));
        }
    });

    if (edadInput) {
        edadInput.addEventListener('input', () => mostrarDescripcion(calcularScore()));
    }

    // Gestión visual de Sepsis
    if (sepsisSelect && sepsisOrigenContainer && sepsisOrigenSelect) {
        sepsisSelect.addEventListener('change', () => {
            if (sepsisSelect.value === 'si') {
                sepsisOrigenContainer.classList.remove('d-none');
            } else {
                sepsisOrigenContainer.classList.add('d-none');
                sepsisOrigenSelect.value = '';
                sepsisOrigenSelect.classList.remove('is-invalid'); // Limpiar error si se oculta
            }
            mostrarDescripcion(calcularScore());
        });

        sepsisOrigenSelect.addEventListener('change', () => mostrarDescripcion(calcularScore()));
    }

    // Gestión visual de Comorbilidades
    if (selectComorbilidades && contComorbilidadesExtra) {
        selectComorbilidades.addEventListener('change', () => {
            if (selectComorbilidades.value === 'si') {
                contComorbilidadesExtra.classList.remove('d-none');
                if (inputComorbilidadesDetalle) inputComorbilidadesDetalle.focus();
            } else {
                contComorbilidadesExtra.classList.add('d-none');
                if (inputComorbilidadesDetalle) {
                    inputComorbilidadesDetalle.value = '';
                    inputComorbilidadesDetalle.classList.remove('is-invalid'); // Limpiar error si se oculta
                }
            }
            mostrarDescripcion(calcularScore());
        });
    }

    if (inputComorbilidadesDetalle) {
        inputComorbilidadesDetalle.addEventListener('input', () => mostrarDescripcion(calcularScore()));
    }

    // Cálculo dinámico de la PAM
    if (sysBPDelta1Input && diaBPDelta1Input && pamDelta1Text) {
        const calcLivePAMDelta1 = () => {
            const sys = parseFloat(sysBPDelta1Input.value) || 0;
            const dia = parseFloat(diaBPDelta1Input.value) || 0;

            if (sys > 0 && dia > 0) {
                const pam = (sys + (2 * dia)) / 3;
                pamDelta1Text.textContent = `PAM: ${pam.toFixed(1)} mmHg`;
            } else {
                pamDelta1Text.textContent = 'PAM: --';
            }
            mostrarDescripcion(calcularScore());
        };

        sysBPDelta1Input.addEventListener('input', calcLivePAMDelta1);
        diaBPDelta1Input.addEventListener('input', calcLivePAMDelta1);
    }

    // ===== CARGA INICIAL DE DATOS =====
    cargarDatosFase1();
});

// ==========================================
// VALIDACIÓN DE FORMULARIO (FASE 1)
// ==========================================

function validarFase1() {
    let primerError = null;

    // 1. Limpiamos las alertas rojas previas
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    // 2. Función auxiliar para verificar un campo y pintarlo de rojo
    const validarCampo = (id, mensaje) => {
        const el = document.getElementById(id);
        if (!el || el.value.trim() === '') {
            if (el) el.classList.add('is-invalid');
            if (!primerError) primerError = mensaje;
        }
    };

    // 3. Revisamos los campos Demográficos y Antecedentes
    validarCampo('genero', 'Seleccione el género del paciente.');
    validarCampo('edad', 'Ingrese la edad del paciente.');
    validarCampo('comorbilidades', 'Indique si existen comorbilidades.');
    
    // Validar Comorbilidades detalladas si aplica
    const comorb = document.getElementById('comorbilidades')?.value;
    if (comorb === 'si') {
        validarCampo('comorbilidadesDetalle', 'Especifique las patologías del paciente.');
    }

    // 4. Revisamos Evaluaciones Clínicas y Signos Vitales
    validarCampo('estadoMental', 'Debe evaluar el Estado Mental del paciente.');
    validarCampo('llenadoCapilar', 'Debe evaluar el Llenado Capilar.');
    
    // Signos Vitales completos
    validarCampo('frecuenciaCardiaca', 'Seleccione el rango de Frecuencia Cardíaca.');
    validarCampo('frecuenciaRespiratoria', 'Seleccione el rango de Frecuencia Respiratoria.');
    validarCampo('temperatura', 'Seleccione el rango de Temperatura.');
    validarCampo('satO2', 'Seleccione el estado de la Saturación de Oxígeno (SatO2).');

    // NOTA: sysBPDelta1 y diaBPDelta1 (PAM) se omiten aquí para que sean opcionales.

    // 5. Revisamos Sepsis
    validarCampo('sepsis', 'Indique si existe sospecha de Sepsis.');
    
    // Validar Sepsis detallada si aplica
    const sepsis = document.getElementById('sepsis')?.value;
    if (sepsis === 'si') {
        validarCampo('sepsisOrigen', 'Seleccione el foco infeccioso de la sepsis.');
    }

    return primerError;
}
// ==========================================
// FUNCIONES LÓGICAS Y MATEMÁTICAS (FASE 1)
// ==========================================

function calcularScore() {
    let score = 0;

    const edad = parseInt(document.getElementById('edad')?.value) || 0;
    const comorbilidadesSelect = document.getElementById('comorbilidades')?.value || '';
    const comorbilidadesDetalle = document.getElementById('comorbilidadesDetalle')?.value.trim() || '';
    const estadoMental = document.getElementById('estadoMental')?.value || 'normal';
    const llenado = document.getElementById('llenadoCapilar')?.value || 'normal';
    const fc = document.getElementById('frecuenciaCardiaca')?.value || 'normal';
    const temp = document.getElementById('temperatura')?.value || 'normal';
    const fr = document.getElementById('frecuenciaRespiratoria')?.value || 'normal';
    const satO2 = document.getElementById('satO2')?.value || 'normal';
    const sepsis = document.getElementById('sepsis')?.value || 'no';
    const sepsisOrigen = document.getElementById('sepsisOrigen')?.value || '';

    if (edad > 65) score += 1;
    if (comorbilidadesSelect === 'si' && comorbilidadesDetalle !== '') score += 1;

    switch (estadoMental) {
        case 'normal': break;
        case 'verbal': score += 1; break;
        case 'dolor': score += 2; break;
        case 'inconciente': score += 3; break;
    }

    switch (llenado) {
        case 'normal': break;
        case 'alerta': score += 1; break;
        case 'Anormal': score += 1; break;
    }

    if (fc === 'baja' || fc === 'alta') score += 1;
    const sysScore = parseFloat(document.getElementById('sysBPDelta1')?.value) || 0;
    const diaScore = parseFloat(document.getElementById('diaBPDelta1')?.value) || 0;
    const pamScore = (sysScore > 0 && diaScore > 0) ? ((sysScore + (2 * diaScore)) / 3) : null;
    if (pamScore !== null && (pamScore < 70 || pamScore > 110)) score += 1;
    if (temp === 'baja' || temp === 'alta') score += 1;
    if (fr === 'baja' || fr === 'alta') score += 1;
    if (satO2 === 'baja') score += 2;
    if (sepsis === 'si' && sepsisOrigen !== '') score += 1;

    actualizarPanel(score);
    return score;
}

function actualizarPanel(score) {
    const scoreValue = document.getElementById('scoreValue');
    const riskLabel = document.getElementById('riskLabel');
    const scoreBar = document.getElementById('scoreBar');

    if (scoreValue) scoreValue.textContent = score;

    let riesgo = 'Bajo';
    let riskClass = 'risk-low';
    let glowColor = 'rgba(57, 255, 20, 0.3)';
    let colorHex = 'var(--neon-green)';
    let percent = Math.min((score / 10) * 100, 100);

    if (score >= 6) {
        riesgo = 'Alto';
        riskClass = 'risk-high';
        glowColor = 'rgba(255, 59, 48, 0.3)';
        colorHex = 'var(--neon-red)';
    }
    else if (score >= 3) {
        riesgo = 'Moderado';
        riskClass = 'risk-medium';
        glowColor = 'rgba(255, 159, 0, 0.3)';
        colorHex = 'var(--neon-orange)';
    }

    if (riskLabel) {
        riskLabel.textContent = `Riesgo ${riesgo}`;
        riskLabel.className = `risk-status-pill ${riskClass} shadow-sm`;
    }

    if (scoreValue) {
        scoreValue.style.color = colorHex;
        scoreValue.style.textShadow = `0 0 20px ${glowColor}`;
    }

    if (scoreBar) {
        scoreBar.style.width = percent + '%';
        scoreBar.style.background = `linear-gradient(90deg, var(--neon-cyan), ${colorHex})`;
        scoreBar.style.boxShadow = `0 0 10px ${colorHex}`;
    }
}

function getRecommendation(score) {
    if (score >= 6) {
        return {
            title: 'ALTO RIESGO — ACCIÓN INMEDIATA',
            text: 'Activar código de respuesta rápida. Evaluar traslado emergente a UCI. Monitoreo invasivo, fluidoterapia agresiva dirigida y considerar soporte vasoactivo precoz.',
            urgency: 'alta'
        };
    } else if (score >= 3) {
        return {
            title: 'RIESGO MODERADO — INTERVENCIÓN',
            text: 'Ingresar a área de observación o urgencias críticas. Oxigenoterapia, toma de cultivos urgentes y optimización de volumen circulatorio.',
            urgency: 'media'
        };
    } else {
        return {
            title: 'RIESGO BAJO — MONITOREO',
            text: 'Vigilancia estrecha de signos vitales. Reevaluar escala en intervalos estipulados de 4 a 6 horas.',
            urgency: 'baja'
        };
    }
}

function mostrarDescripcion(score) {
    const container = document.getElementById('recommendationContainer');
    const desc = document.getElementById('scoreDescription');
    if (!desc || !container) return;

    container.classList.remove('d-none');
    const rec = getRecommendation(score);
    desc.innerHTML = `<strong style="font-family: var(--font-hud); letter-spacing:0.5px;">${rec.title}</strong><div style="margin-top:6px; opacity: 0.95;">${rec.text}</div>`;

    if (rec.urgency === 'alta') desc.style.borderLeft = '4px solid var(--neon-red)';
    else if (rec.urgency === 'media') desc.style.borderLeft = '4px solid var(--neon-orange)';
    else desc.style.borderLeft = '4px solid var(--neon-green)';
}

// ==========================================
// FUNCIONES DE MEMORIA (LOCALSTORAGE)
// ==========================================

function guardarDatosFase1() {
    // Recuperar info anterior para no borrar lo de Fase 2 si el usuario retrocedió
    const prevData = JSON.parse(localStorage.getItem('deltaMortScore')) || {};

    const data = {
        ...prevData, 
        genero: document.getElementById('genero')?.value || '',
        edad: document.getElementById('edad')?.value || '',
        comorbilidadesSelect: document.getElementById('comorbilidades')?.value || '',
        comorbilidadesDetalle: document.getElementById('comorbilidadesDetalle')?.value || '',
        estadoMental: document.getElementById('estadoMental')?.value || 'normal',
        llenado: document.getElementById('llenado')?.value || 'normal',
        frecuenciaCardiaca: document.getElementById('frecuenciaCardiaca')?.value || 'normal',
        temperatura: document.getElementById('temperatura')?.value || 'normal',
        frecuenciaRespiratoria: document.getElementById('frecuenciaRespiratoria')?.value || 'normal',
        satO2: document.getElementById('satO2')?.value || 'normal',
        sepsis: document.getElementById('sepsis')?.value || 'no',
        sepsisOrigen: document.getElementById('sepsisOrigen')?.value || '',
        sysBPDelta1: document.getElementById('sysBPDelta1')?.value || '',
        diaBPDelta1: document.getElementById('diaBPDelta1')?.value || '',
        score: calcularScore(),
        savedAt: new Date().toISOString()
    };

    localStorage.setItem('deltaMortScore', JSON.stringify(data));

    const lastSaved = document.getElementById('lastSaved');
    if (lastSaved) lastSaved.textContent = new Date(data.savedAt).toLocaleString();
    mostrarToast('Fase 1 sincronizada localmente.');
}

function cargarDatosFase1() {
    const raw = localStorage.getItem('deltaMortScore');
    if (!raw) return;
    try {
        const data = JSON.parse(raw);

        // Llenar campos de Fase 1
        if(document.getElementById('genero')) document.getElementById('genero').value = data.genero || '';
        if(document.getElementById('edad')) document.getElementById('edad').value = data.edad || '';
        if(document.getElementById('comorbilidades')) document.getElementById('comorbilidades').value = data.comorbilidadesSelect || '';

        const contExtra = document.getElementById('comorbilidadesExtra');
        const detalle = document.getElementById('comorbilidadesDetalle');
        if (contExtra && detalle) {
            if (data.comorbilidadesSelect === 'si') {
                contExtra.classList.remove('d-none');
                detalle.value = data.comorbilidadesDetalle || '';
            } else {
                contExtra.classList.add('d-none');
                detalle.value = '';
            }
        }

        if(document.getElementById('estadoMental')) document.getElementById('estadoMental').value = data.estadoMental || 'normal';
        if(document.getElementById('llenado')) document.getElementById('llenado').value = data.llenado || 'normal';
        if(document.getElementById('frecuenciaCardiaca')) document.getElementById('frecuenciaCardiaca').value = data.frecuenciaCardiaca || 'normal';
        if(document.getElementById('temperatura')) document.getElementById('temperatura').value = data.temperatura || 'normal';
        if(document.getElementById('frecuenciaRespiratoria')) document.getElementById('frecuenciaRespiratoria').value = data.frecuenciaRespiratoria || 'normal';
        if(document.getElementById('satO2')) document.getElementById('satO2').value = data.satO2 || 'normal';
        if(document.getElementById('sepsis')) document.getElementById('sepsis').value = data.sepsis || 'no';
        
        if (document.getElementById('sepsisOrigen')) document.getElementById('sepsisOrigen').value = data.sepsisOrigen || '';
        
        if (document.getElementById('sepsisOrigenContainer') && document.getElementById('sepsis')) {
            if (document.getElementById('sepsis').value === 'si') document.getElementById('sepsisOrigenContainer').classList.remove('d-none');
            else document.getElementById('sepsisOrigenContainer').classList.add('d-none');
        }

        if(document.getElementById('sysBPDelta1')) document.getElementById('sysBPDelta1').value = data.sysBPDelta1 || '';
        if(document.getElementById('diaBPDelta1')) document.getElementById('diaBPDelta1').value = data.diaBPDelta1 || '';

        const lastSaved = document.getElementById('lastSaved');
        if (lastSaved && data.savedAt) lastSaved.textContent = new Date(data.savedAt).toLocaleString();

        // Recalcular
        mostrarDescripcion(calcularScore());

        const sysDelta1 = parseFloat(data.sysBPDelta1) || 0;
        const diaDelta1 = parseFloat(data.diaBPDelta1) || 0;
        if (sysDelta1 > 0 && diaDelta1 > 0) {
            const pamDelta1 = (sysDelta1 + (2 * diaDelta1)) / 3;
            document.getElementById('pamDelta1Text').textContent = `PAM: ${pamDelta1.toFixed(1)} mmHg`;
        } else {
            document.getElementById('pamDelta1Text').textContent = 'PAM: --';
        }

    } catch (e) {
        console.error('Error al recuperar historial local de Fase 1', e);
    }
}

function ejecutarLimpieza() {
    const form1 = document.getElementById('mortScoreForm');
    if (form1) form1.reset();

    // Limpiar alertas rojas
    document.querySelectorAll('.is-invalid').forEach(el => el.classList.remove('is-invalid'));

    const contExtra = document.getElementById('comorbilidadesExtra');
    const sepsisOrigenContainer = document.getElementById('sepsisOrigenContainer');
    const sepsisOrigenSelect = document.getElementById('sepsisOrigen');
    
    if (contExtra) contExtra.classList.add('d-none');
    if (sepsisOrigenContainer) sepsisOrigenContainer.classList.add('d-none');
    if (sepsisOrigenSelect) sepsisOrigenSelect.value = '';

    const pamText = document.getElementById('pamDelta1Text');
    if (pamText) pamText.textContent = 'PAM: --';

    actualizarPanel(0);

    const descContainer = document.getElementById('recommendationContainer');
    if (descContainer) descContainer.classList.add('d-none');

    // Borramos todo el LocalStorage ya que es una limpieza completa
    localStorage.removeItem('deltaMortScore');

    const lastSaved = document.getElementById('lastSaved');
    if (lastSaved) lastSaved.textContent = '—';

    mostrarToast("Formulario y memoria limpiados por completo.");
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
    toast.offsetHeight; // force reflow

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