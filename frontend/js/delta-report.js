document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const backBtn = document.getElementById('backToPhase2');
    const dashboardBtn = document.getElementById('goToDashboardBtn');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.body.classList.add('fade-out-page');
            setTimeout(() => window.location.href = 'delta2.html', 400);
        });
    }

    if (dashboardBtn) {
        dashboardBtn.addEventListener('click', () => {
            document.body.classList.add('fade-out-page');
            setTimeout(() => window.location.href = 'dashboard.html', 400);
        });
    }

    // Configuración global de Chart.js y registro del plugin DataLabels
    Chart.register(ChartDataLabels);
    Chart.defaults.color = 'rgba(255, 255, 255, 0.6)';
    Chart.defaults.font.family = "'JetBrains Mono', monospace";
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(3, 10, 22, 0.9)';
    Chart.defaults.plugins.tooltip.borderColor = '#00f0ff';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    cargarReporte();
});

function cargarReporte() {
    const raw = localStorage.getItem('deltaMortScore');
    if (!raw) {
        alert("No hay datos clínicos para generar el reporte.");
        window.location.href = 'delta1.html';
        return;
    }

    const data = JSON.parse(raw);

    const reportId = 'DLT-' + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const reportDate = new Date().toLocaleString('es-MX');
    document.getElementById('reportId').textContent = reportId;
    document.getElementById('reportDate').textContent = reportDate;

    // Llenar Tablas visuales del HUD
    llenarTablaFase1HUD(data);
    llenarTablaFase2HUD(data);

    const score = data.score || 0;
    const lactato = parseFloat(data.lactato) || 0;
    const pCO2Art = parseFloat(data.paCO2);
    const pCO2Ven = parseFloat(data.pvCO2);
    const deltaCO2 = (!isNaN(pCO2Art) && !isNaN(pCO2Ven)) ? (pCO2Ven - pCO2Art).toFixed(1) : null;
    
    const paO2 = parseFloat(data.paO2);
    let fio2Decimal = parseFloat(data.fio2);
    let pafi = null;
    if (!isNaN(paO2) && !isNaN(fio2Decimal)) {
        if(fio2Decimal > 1) fio2Decimal = fio2Decimal / 100;
        pafi = Math.round(paO2 / fio2Decimal);
    }

    // Llenar widgets superiores
    document.getElementById('repScore').textContent = score;
    const lacDOM = document.getElementById('repLactato');
    lacDOM.textContent = lactato;
    lacDOM.className = `fs-5 fw-bold ${lactato > 4 ? 'text-danger' : (lactato > 2 ? 'text-warning' : 'text-success')}`;
    document.getElementById('repDeltaCO2').textContent = deltaCO2 !== null ? deltaCO2 : 'N/A';
    document.getElementById('repPafi').textContent = pafi !== null ? pafi : 'N/A';

    const pctValue = data.procalcitonina !== undefined && data.procalcitonina !== null ? parseFloat(data.procalcitonina) : null;
    document.getElementById('repPCT').textContent = pctValue !== null ? `${pctValue.toFixed(2)} ng/mL` : 'N/A';
    document.getElementById('repPCTLabel').textContent = pctValue !== null ? (pctValue >= 2 ? 'Alto riesgo séptico' : (pctValue >= 0.5 ? 'Riesgo moderado' : (pctValue >= 0.25 ? 'Indeterminado' : 'Normal'))) : 'Valor clínico consolidado';

    redactarHUD(score, lactato, deltaCO2, pafi, data);
    renderizarGraficas(score, lactato, deltaCO2, pafi, data);

    // Exportar PDF
    const exportBtn = document.getElementById('exportPdfBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', async () => {
            exportBtn.innerHTML = '<i class="pulse-indicator me-2"></i> Procesando Documento...';
            exportBtn.disabled = true;
            await generarDocumentoBlancoFormal(data, score, lactato, deltaCO2, pafi, reportId, exportBtn);
        });
    }
}

/* =========================================================================
   DICCIONARIOS DE INTERPRETACIÓN CLÍNICA
   ========================================================================= */
function interpretarSignos(data) {
    const em = { normal: {t:'Consciente', p:0}, verbal: {t:'Somnoliento', p:1}, dolor: {t:'Estuporoso', p:2}, inconciente: {t:'Comatoso', p:3} }[data.estadoMental] || {t:'N/E', p:0};
    const ll = { normal: {t:'Inmediato', p:0}, alerta: {t:'Retardado', p:1}, Anormal: {t:'Muy retardado', p:2} }[data.llenado] || {t:'N/E', p:0};
    const fc = { normal: 'Normal (60-100 lpm)', alta: 'Taquicardia (>100 lpm)', baja: 'Bradicardia (<60 lpm)' }[data.frecuenciaCardiaca] || 'N/E';
    const fr = { normal: 'Normal', alta: 'Taquipnea', baja: 'Bradipnea' }[data.frecuenciaRespiratoria] || 'N/E';
    const temp = { normal: 'Afebril (Normal)', alta: 'Fiebre/Hipertermia', baja: 'Hipotermia' }[data.temperatura] || 'N/E';
    
    let pamTexto = 'N/D'; let pamPuntos = 0;
    if (data.sysBPDelta1 && data.diaBPDelta1) {
        let sys = parseFloat(data.sysBPDelta1);
        let dia = parseFloat(data.diaBPDelta1);
        let pam = (sys + (2 * dia)) / 3;
        pamTexto = `S:${sys} D:${dia} (PAM: ${pam.toFixed(1)})`;
        pamPuntos = (pam < 70) ? 1 : 0; 
    }

    return { em, ll, fc, fr, temp, pamTexto, pamPuntos };
}

/* =========================================================================
   FUNCIONES DEL HUD VISUAL (PANTALLA OSCURA)
   ========================================================================= */
function llenarTablaFase1HUD(data) {
    const tbody = document.getElementById('phase1TableBody');
    tbody.innerHTML = '';
    
    // Función mejorada para forzar el '+0' en lugar del guión
    const addRow = (variable, valor, puntos) => {
        let numPuntos = (puntos === '-' || isNaN(puntos)) ? 0 : parseInt(puntos);
        let ptsHtml = `<span class="${numPuntos > 0 ? 'text-warning fw-bold' : 'text-success'}">+${numPuntos}</span>`;
        tbody.innerHTML += `<tr><td>${variable}</td><td class="text-white">${valor}</td><td class="text-center">${ptsHtml}</td></tr>`;
    };

    const s = interpretarSignos(data);

    addRow('Edad', `${data.edad || 0} años`, (data.edad > 65) ? 1 : 0);
    addRow('Género', data.genero === 'M' ? 'Masculino' : (data.genero === 'F' ? 'Femenino' : 'N/E'), 0);
    addRow('Comorbilidades', data.comorbilidadesSelect === 'si' ? data.comorbilidadesDetalle : 'Ninguna', data.comorbilidadesSelect === 'si' ? 1 : 0);
    addRow('Sepsis', data.sepsis === 'si' ? data.sepsisOrigen : 'No', data.sepsis === 'si' ? 1 : 0);
    
    addRow('Estado Mental', s.em.t, s.em.p);
    addRow('Llenado Capilar', s.ll.t, s.ll.p);
    
    // Ahora pasamos explícitamente un '0' en los signos que no dan puntos
    addRow('Frecuencia Cardíaca', s.fc, 0);
    addRow('Frecuencia Respiratoria', s.fr, 0);
    addRow('Temperatura', s.temp, 0);
    addRow('Sat O₂', data.satO2 === 'baja' ? '< 90%' : 'Normal', data.satO2 === 'baja' ? 2 : 0);
    addRow('Presión Arterial (PAM)', s.pamTexto, s.pamPuntos); 
}

function llenarTablaFase2HUD(data) {
    const tbody = document.getElementById('phase2TableBody');
    tbody.innerHTML = '';
    const addRow = (biomarcador, valor, estadoColor) => {
        let colorClass = estadoColor === 'ok' ? 'text-success' : (estadoColor === 'warn' ? 'text-warning' : 'text-danger');
        let txtEstado = estadoColor === 'ok' ? 'Normal' : (estadoColor === 'warn' ? 'Alerta' : 'Crítico');
        tbody.innerHTML += `<tr><td>${biomarcador}</td><td class="text-white">${valor}</td><td class="text-center ${colorClass} fw-bold">${txtEstado}</td></tr>`;
    };

    let lacVal = parseFloat(data.lactato);
    addRow('Lactato Sérico', isNaN(lacVal) ? 'N/D' : `${lacVal} mmol/L`, isNaN(lacVal) ? 'ok' : (lacVal > 4 ? 'danger' : (lacVal > 2 ? 'warn' : 'ok')));
    const pctVal = data.procalcitonina !== undefined && data.procalcitonina !== null ? parseFloat(data.procalcitonina) : NaN;
    addRow('Procalcitonina (PCT)', isNaN(pctVal) ? 'N/D' : `${pctVal.toFixed(2)} ng/mL`, isNaN(pctVal) ? 'ok' : (pctVal >= 2 ? 'danger' : (pctVal >= 0.5 ? 'warn' : 'ok')));
    
    if (data.gaArterial === 'si') {
        let ph = parseFloat(data.phArterial);
        addRow('pH Arterial', ph || 'N/D', (ph < 7.35 || ph > 7.45) ? 'danger' : 'ok');
        addRow('Presión PaO₂', data.paO2 ? `${data.paO2} mmHg` : 'N/D', 'ok');
        addRow('Presión PaCO₂', data.paCO2 ? `${data.paCO2} mmHg` : 'N/D', 'ok');
        addRow('Bicarbonato HCO₃', data.hco3Arterial ? `${data.hco3Arterial} mmol/L` : 'N/D', 'ok');
    }
    if (data.gaVenosa === 'si') {
        addRow('Presión Venosa PvCO₂', data.pvCO2 ? `${data.pvCO2} mmHg` : 'N/D', 'ok');
    }
    addRow('Fracción FiO₂', data.fio2 ? `${data.fio2}%` : 'N/D', 'ok');
}

/* =========================================================================
   MOTOR GENERADOR DE PDF "HOJA BLANCA" 
   ========================================================================= */
async function generarDocumentoBlancoFormal(data, score, lactato, deltaCO2, pafi, reportId, exportBtn) {
    const barImg = document.getElementById('barChart').toDataURL('image/png', 1.0);
    const doughnutImg = document.getElementById('doughnutChart').toDataURL('image/png', 1.0);
    const radarImg = document.getElementById('radarChart').toDataURL('image/png', 1.0);

    const printDiv = document.createElement('div');
    printDiv.style.position = 'absolute'; printDiv.style.left = '-9999px'; printDiv.style.top = '0';
    
    const dateStr = new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    const s = interpretarSignos(data); 

    const edadStr = data.edad ? `${data.edad} años` : 'N/E';
    const genStr = data.genero === 'M' ? 'Masculino' : (data.genero === 'F' ? 'Femenino' : 'N/E');
    const comorbStr = data.comorbilidadesSelect === 'si' ? data.comorbilidadesDetalle : 'Ninguna declarada';
    const sepsisStr = data.sepsis === 'si' ? data.sepsisOrigen : 'No séptico';

    let txtFase1 = (score >= 6) ? `En este modelo pronóstico-predictivo, el paciente refleja un factor primario altamente crítico (Score: ${score}). Este puntaje estima una probabilidad sustancial de deterioro hemodinámico agudo y desenlace fatal a corto plazo.` : 
                   (score >= 3) ? `El modelo de estimación sitúa al paciente en un estrato de riesgo intermedio-moderado (Score: ${score}). La probabilidad de un desenlace adverso es latente pero potencialmente reversible.` : 
                   `La valoración de factores indica un riesgo predictivo bajo de mortalidad aguda (Score: ${score}). Los marcadores sugieren una historia natural orientada hacia la recuperación.`;

    let pctVal = data.procalcitonina !== undefined && data.procalcitonina !== null ? parseFloat(data.procalcitonina) : null;
    const pctInterp = interpretarPCTText(pctVal);
    let txtLactato = (lactato > 4.0) ? `Como factor dependiente, se documenta hiperlactatemia severa (${lactato.toFixed(1)} mmol/L), un marcador pronóstico confirmatorio de disoxia celular.` : 
                     (lactato > 2.0) ? `Se detecta un factor pronóstico de hipoperfusión oculta (Lactato: ${lactato.toFixed(1)} mmol/L) en fase de compensación.` : 
                     `Los marcadores de perfusión (Lactato: ${lactato.toFixed(1)} mmol/L) se encuentran dentro del rango fisiológico normal.`;
    let txtPct = pctVal !== null ? (pctVal >= 2.0 ? `Procalcitonina elevada (${pctVal.toFixed(2)} ng/mL) compatible con sepsis establecida o choque séptico.` : (pctVal >= 0.5 ? `Procalcitonina moderadamente elevada (${pctVal.toFixed(2)} ng/mL), sugiere sospecha de infección bacteriana sistémica.` : `Procalcitonina dentro de rangos habituales (${pctVal.toFixed(2)} ng/mL), con baja probabilidad de infección bacteriana sistémica.`)) : 'Procalcitonina no registrada.';

    printDiv.innerHTML = `
        <div class="pdf-page" style="width: 800px; height: 1035px; padding: 40px 50px; box-sizing: border-box; background: #ffffff; position: relative; font-family: Arial, sans-serif;">
            
            <table style="width: 100%; border-bottom: 2px solid #005b96; padding-bottom: 10px; margin-bottom: 20px;">
                <tr>
                    <td style="vertical-align: top; width: 60%; color: #000;">
                        <h2 style="margin: 0; color: #002855; font-size: 18px; font-weight: bold;">SISTEMA CLÍNICO DELTA-PCT / MORT-SCORE</h2>
                        <div style="color: #444; font-size: 11px; margin-top: 4px;">Estudio Pronóstico-Predictivo y Valoración de Perfusión Tisular</div>
                    </td>
                    <td style="text-align: right; vertical-align: top; width: 40%; color: #000;">
                        <div style="font-weight: bold; font-size: 12px; color: #333;">EXPEDIENTE PRONÓSTICO</div>
                        <div style="font-size: 11px; color: #555; margin-top: 3px;">Folio: ${reportId}</div>
                        <div style="font-size: 11px; color: #555;">Fecha: ${dateStr}</div>
                    </td>
                </tr>
            </table>

            <!-- Delta 3 (PCT) moved to final PDF page to avoid page breaks cutting charts/tables -->

            <h3 style="font-size: 14px; color: #005b96; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">1. ESTADO BASAL Y PERFIL DEMOGRÁFICO</h3>
            <p style="font-size: 11.5px; line-height: 1.5; color: #000; text-align: justify; margin-bottom: 15px;">
                De acuerdo con la metodología para la elaboración de estudios sobre pronóstico, se establece el tiempo cero (inicio) para estimar el riesgo o probabilidad de desenlaces futuros en el paciente con la enfermedad establecida. Paciente (${genStr}, ${edadStr}). Comorbilidades registradas: <b>${comorbStr}</b>. Foco infeccioso sospechado: <b>${sepsisStr}</b>. ${txtFase1}
            </p>
            
            <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 25px;">
                <tr style="background-color: #f4f7f6; border-bottom: 1px solid #005b96;">
                    <th style="padding: 6px; text-align: left; color:#002855;">Variable o Factor Clínico</th>
                    <th style="padding: 6px; text-align: left; color:#002855;">Interpretación / Valor</th>
                    <th style="padding: 6px; text-align: center; color:#002855;">Score PCT</th>
                </tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Edad</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${edadStr}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">${data.edad > 65 ? '1' : '0'}</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Comorbilidades</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${comorbStr}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">${data.comorbilidadesSelect === 'si' ? '1' : '0'}</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Sepsis (Foco)</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${sepsisStr}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">${data.sepsis === 'si' ? '1' : '0'}</td></tr>
                
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000; background-color:#fafafa;"><b>Estado Mental</b></td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000; background-color:#fafafa;">${s.em.t}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000; background-color:#fafafa;">${s.em.p}</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;"><b>Llenado Capilar</b></td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${s.ll.t}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">${s.ll.p}</td></tr>
                
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Frecuencia Cardíaca</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${s.fc}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">0</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Frecuencia Respirat.</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${s.fr}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">0</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Temperatura</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${s.temp}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">0</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Saturación O2</td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">${data.satO2 === 'baja' ? '< 90% (Hipoxemia)' : 'Normal'}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000;">${data.satO2 === 'baja' ? '2' : '0'}</td></tr>
                <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000; background-color:#fef8f8;"><b>Presión Art. (PAM)</b></td><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000; background-color:#fef8f8;">${s.pamTexto}</td><td style="padding: 6px; text-align: center; border-bottom: 1px solid #eee; color:#000; background-color:#fef8f8;"><b>${s.pamPuntos}</b></td></tr>
                
                <tr><td colspan="2" style="padding: 8px; text-align: right; color:#002855; font-weight:bold;">RIESGO PREDICTIVO TOTAL (FASE 1):</td><td style="padding: 8px; text-align: center; color:#d9534f; font-weight:bold; font-size:14px;">${score} pts</td></tr>
            </table>

            <h3 style="font-size: 14px; color: #005b96; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 10px;">2. ESTIMACIÓN DE DESENLACES Y DAÑO MULTIORGÁNICO</h3>
            <p style="font-size: 11.5px; line-height: 1.5; color: #000; text-align: justify; margin-bottom: 15px;">
                ${txtLactato} El Índice Kirby (PAFI) de <b>${pafi !== null ? pafi : 'N/D'}</b> y el gradiente veno-arterial Δ pCO2 de <b>${deltaCO2 !== null ? deltaCO2 : 'N/D'} mmHg</b> fungen como factores pronóstico esenciales para estimar complicaciones orgánicas (disease).
            </p>

            <table style="width: 100%; margin-bottom: 25px; border-collapse: collapse;">
                <tr>
                    <td style="width: 55%; vertical-align: top; padding-right: 15px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <tr style="background-color: #f4f7f6; border-bottom: 1px solid #005b96;">
                                <th style="padding: 6px; text-align: left; color:#002855;">Marcador Pronóstico</th>
                                <th style="padding: 6px; text-align: right; color:#002855;">Resultado</th>
                            </tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Lactato Sérico</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${isNaN(lactato) ? 'N/D' : lactato + ' mmol/L'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Procalcitonina (PCT)</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${pctVal !== null ? pctVal.toFixed(2) + ' ng/mL' : 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">pH Arterial</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.phArterial || 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Presión PaO₂</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.paO2 ? data.paO2 + ' mmHg' : 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Presión PaCO₂</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.paCO2 ? data.paCO2 + ' mmHg' : 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Presión PvCO₂</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.pvCO2 ? data.pvCO2 + ' mmHg' : 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Bicarbonato HCO₃</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.hco3Arterial ? data.hco3Arterial + ' mmol/L' : 'N/D'}</b></td></tr>
                            <tr><td style="padding: 6px; border-bottom: 1px solid #eee; color:#000;">Fracción FiO₂</td><td style="padding: 6px; text-align: right; border-bottom: 1px solid #eee; color:#000;"><b>${data.fio2 ? data.fio2 + ' %' : 'N/D'}</b></td></tr>
                        </table>
                    </td>
                    <td style="width: 45%; vertical-align: middle; text-align: center;">
                        <div style="font-size: 10px; font-weight:bold; color: #555; margin-bottom: 5px;">Tendencia Metabólica vs Límites</div>
                        <img src="${barImg}" style="max-width: 100%; height: 120px; border: 1px solid #ddd; padding: 5px; border-radius: 4px; background: #030a16;">
                    </td>
                </tr>
            </table>
        </div>

        <div class="pdf-page" style="width: 800px; height: 1035px; padding: 40px 50px; box-sizing: border-box; background: #ffffff; position: relative; font-family: Arial, sans-serif;">
            <h3 style="font-size: 14px; color: #005b96; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 20px;">3. MODELAJE GRÁFICO PREDICTIVO</h3>
            <table style="width: 100%; margin-bottom: 40px; text-align: center;">
                <tr>
                    <td style="width: 50%; padding: 10px;">
                        <div style="font-size: 11px; font-weight:bold; color: #555; margin-bottom: 10px;">Equilibrio Ácido-Base GSA</div>
                        <img src="${doughnutImg}" style="max-width: 100%; height: 160px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; background: #030a16;">
                    </td>
                    <td style="width: 50%; padding: 10px;">
                        <div style="font-size: 11px; font-weight:bold; color: #555; margin-bottom: 10px;">Huella de Severidad Multiorgánica</div>
                        <img src="${radarImg}" style="max-width: 100%; height: 160px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; background: #030a16;">
                    </td>
                </tr>
            </table>

            <!-- Firma y notas moved to final Delta 3 page -->
        </div>
        
        <div class="pdf-page" style="width: 800px; height: 1035px; padding: 40px 50px; box-sizing: border-box; background: #ffffff; position: relative; font-family: Arial, sans-serif;">
            <h3 style="font-size: 14px; color: #005b96; border-bottom: 1px solid #ccc; padding-bottom: 5px; margin-bottom: 12px;">4. DELTA 3 - PROCALCITONINA (PCT): CONCLUSIONES FINALES Y RECOMENDACIONES</h3>
            <p style="font-size: 11px; line-height: 1.5; color: #000; text-align: justify; margin-bottom: 12px;">
                La Procalcitonina (PCT) registrada para este expediente es <strong class="text-dark">${pctVal !== null ? pctVal.toFixed(2) + ' ng/mL' : 'N/D'}</strong>. <strong>${pctInterp.title}.</strong> ${pctInterp.desc}
            </p>
            <div style="font-size: 11px; color: #000; margin-bottom: 12px;">
                <b>Interpretación clínica resumida:</b>
                <ul style="margin-top:8px; margin-bottom:10px;">
                    ${pctVal !== null ? (pctVal >= 2.0 ? `
                        <li>Valor elevado: alta probabilidad de infección bacteriana severa. Se recomienda manejo en unidad de cuidados con medidas de soporte y antimicrobianos dirigidos.</li>
                    ` : (pctVal >= 0.5 ? `
                        <li>Valor moderado: sospecha de infección bacteriana sistémica. Valorar toma de cultivos y considerar inicio empírico de tratamiento según criterio clínico.</li>
                    ` : `
                        <li>Valor bajo: baja probabilidad de infección bacteriana invasiva. Manejo conservador y vigilancia.</li>
                    `)) : `
                        <li>PCT no disponible: orientar manejo por criterios clínicos y otros marcadores.</li>
                    `}
                </ul>
            </div>
            <div style="font-size: 11px; color: #000; margin-bottom: 18px;">
                <b>Recomendaciones prácticas para el equipo tratante:</b>
                <ol style="margin-top:8px;">
                    <li>Correlacionar PCT con signos clínicos, lactato y gasometría antes de decisiones terapéuticas definitivas.</li>
                    <li>Obtener cultivos antes del inicio de antimicrobianos cuando sea posible.</li>
                    <li>Monitorear PCT seriado (24-48 h) para guiar duración de terapia y respuesta.</li>
                </ol>
            </div>
            <p style="font-size: 11px; line-height: 1.5; color: #000; text-align: justify; margin-bottom: 8px;">
                Con este conjunto de datos —perfil basal, marcador de perfusión (lactato), gasometría y PCT— el informe entrega una visión integrada del estado del paciente. Si usted (paciente o familiar) desea una explicación en lenguaje sencillo: <em>este informe identifica señales de riesgo y propone pasos concretos para tratarlas; nuestro objetivo es asegurar que reciba la atención adecuada y comprensible.</em>
            </p>
            <!-- KPI cards inserted under predictive charts -->
            <div style="width:100%; text-align:center; margin-bottom:18px;">
                <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                    <div style="width:150px; background:#071922; color:#39FF14; padding:10px; border-radius:6px;">
                        <div style="font-size:11px; color:#9fb7c2;">SCORE DELTA 1</div>
                        <div style="font-size:24px; font-weight:bold; margin-top:6px;">${score !== null ? score : 'N/D'}</div>
                    </div>
                    <div style="width:150px; background:#071922; color:#FFC107; padding:10px; border-radius:6px;">
                        <div style="font-size:11px; color:#ffdca8;">LACTATO (mmol/L)</div>
                        <div style="font-size:24px; font-weight:bold; margin-top:6px;">${!isNaN(lactato) ? lactato.toFixed(1) : 'N/D'}</div>
                    </div>
                    <div style="width:150px; background:#071922; color:#FFFFFF; padding:10px; border-radius:6px;">
                        <div style="font-size:11px; color:#c7d6d9;">Δ pCO₂ (mmHg)</div>
                        <div style="font-size:24px; font-weight:bold; margin-top:6px;">${deltaCO2 !== null ? parseFloat(deltaCO2).toFixed(1) : 'N/D'}</div>
                    </div>
                    <div style="width:150px; background:#071922; color:#00E676; padding:10px; border-radius:6px;">
                        <div style="font-size:11px; color:#bff8db;">KIRBY (PAFI)</div>
                        <div style="font-size:24px; font-weight:bold; margin-top:6px;">${pafi !== null ? pafi : 'N/D'}</div>
                    </div>
                </div>
            </div>

            <div style="position: absolute; bottom: 40px; left: 0; width: 100%; text-align: center;">
                <div style="width:100%; max-width:720px; margin: 0 auto;">
                    <div style="width:60%; margin: 0 auto; border-top: 1px solid #444; height: 0;"></div>
                    <div style="margin-top:10px; font-weight: 700; font-size: 13px; color: #000;">Dr. Rajiv Joffre Palma</div>
                    <div style="font-size: 10.5px; color: #444; margin-top:4px;">Médico Tratante</div>
                    <div style="margin-top:14px; border-top:1px solid #eee; padding-top:10px; color:#777; font-size:10px;">Reporte procesado algorítmicamente mediante metodología de estudios pronósticos. Constituye una herramienta clínica para estimar probabilidades de desenlaces. Este reporte es sólo para referencia clínica. No válido como material probatorio.</div>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(printDiv);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'letter');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const pages = printDiv.querySelectorAll('.pdf-page');

    for (let i = 0; i < pages.length; i++) {
        const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: '#ffffff', logging: false });
        const imgData = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    }

    pdf.save(`Expediente_${reportId}.pdf`);
    document.body.removeChild(printDiv);
    
    exportBtn.innerHTML = '<i data-lucide="download-cloud" style="width:18px;height:18px;"></i> Exportar Expediente PDF';
    exportBtn.disabled = false;
    lucide.createIcons();
}

// REDACCIÓN IA DETALLADA METODOLÓGICA (HUD)
function redactarHUD(score, lactato, deltaCO2, pafi, data) {
    let html = "";
    const genStr = data.genero === 'M' ? 'Masculino' : (data.genero === 'F' ? 'Femenino' : 'No especificado');
    const edadStr = data.edad ? `${data.edad} años` : 'No especificada';
    const comorbStr = data.comorbilidadesSelect === 'si' ? data.comorbilidadesDetalle : 'Ninguna declarada';
    const sepsisStr = data.sepsis === 'si' ? data.sepsisOrigen : 'No séptico';

    html += `<h6 class="text-white mt-3 mb-2"><i data-lucide="book-open" style="width:16px;" class="me-2 text-info"></i>1. Cohorte de Estudio y Perfil Basal</h6>`;
    html += `<p class="mb-4">Siguiendo la metodología de estudios de pronóstico clínico, se establece el <strong>tiempo cero o de inicio</strong> para estimar el riesgo de desenlaces futuros en la evolución del paciente. Perfil demográfico: Paciente (${genStr}, ${edadStr}). Factores pronósticos independientes (comorbilidades): <strong class="text-white">${comorbStr}</strong>. Marcador clínico de exposición (Foco infeccioso): <strong class="text-white">${sepsisStr}</strong>. Esta síntesis integra datos vitales y de laboratorio para ofrecer una evaluación accionable, orientada a decisiones terapéuticas y seguimiento.</p>`;

    html += `<h6 class="text-white mb-2"><i data-lucide="activity" style="width:16px;" class="me-2 text-neon-cyan pulse-indicator border-0"></i>2. Modelo Predictivo y Probabilidad de Desenlace</h6>`;
    
    if (score >= 6) html += `<p class="mb-2">El análisis predictivo arroja un factor primario altamente crítico <strong class="text-danger">(Score F1: ${score})</strong>. Este modelo estima una probabilidad sustancial de deterioro hemodinámico, disoxia tisular y un desenlace adverso (mortalidad) a corto plazo durante el seguimiento. Recomendaciones: vigilancia en ambiente de alto recurso (UCI), monitorización continua, soporte vasoactivo según metas hemodinámicas y optimización de la perfusión tisular; discutir objetivos de cuidado con el equipo clínico y la familia.</p>`;
    else if (score >= 3) html += `<p class="mb-2">El paciente se estratifica en una zona de riesgo <strong class="text-warning">intermedio-moderado (Score F1: ${score})</strong>. La probabilidad de un desenlace adverso es latente pero con ventana terapéutica para modificar la historia natural del evento. Recomendaciones: observación intensiva, monitorización de lactato y PCT cada 12-24 horas, ajuste de volumen y oxigenación según necesidad, y reevaluación temprana para escalado de soporte.</p>`;
    else html += `<p class="mb-2">El modelo indica un riesgo predictivo <strong class="text-success">bajo (Score F1: ${score})</strong>. Los factores clínicos están compensados, orientando la probabilidad hacia la estabilización. Recomendaciones: manejo conservador con seguimiento ambulatorio o en sala, control de signos vitales y reevaluación si aparecen nuevas señales de deterioro; tranquilizar al paciente explicando los hallazgos y la conducta a seguir.</p>`;

    html += `<h6 class="text-white mt-4 mb-2"><i data-lucide="lungs" style="width:16px;" class="me-2 text-info"></i>3. Marcadores Pronóstico de Severidad Multiorgánica</h6>`;
    
    if (lactato > 4.0) html += `<p class="mb-2">Se documenta hiperlactatemia severa <strong class="text-danger">(${lactato.toFixed(1)} mmol/L)</strong>. Este biomarcador actúa como factor pronóstico confirmatorio de falla metabólica y shock establecido. Implicaciones: optimizar perfusión (fluido/vasoactivos), descartar causas reversibles y monitorizar respuesta terapéutica en horas.</p>`;
    else if (lactato > 2.0) html += `<p class="mb-2">Se detecta un factor pronóstico de hipoperfusión oculta <strong class="text-warning">(${lactato.toFixed(1)} mmol/L)</strong>, limitando el aclaramiento metabólico en fase de compensación. Implicaciones: monitorización seriada, valorar reposición volémica guiada por objetivos y descartar progresión a hipoperfusión sostenida.</p>`;
    else html += `<p class="mb-2">El marcador de perfusión tisular <strong class="text-success">(${lactato.toFixed(1)} mmol/L)</strong> se encuentra dentro del rango de normalidad. Implicación: perfusión tisular adecuada al momento; continuar vigilancia clínica y apoyo según comorbilidades.</p>`;

    const pctVal = data.procalcitonina !== undefined && data.procalcitonina !== null ? parseFloat(data.procalcitonina) : null;
    const pctInterp = interpretarPCTText(pctVal);
    if (pctVal !== null) {
        html += `<p class="mb-2">La Procalcitonina (PCT) se registra en <strong class="${pctVal >= 2.0 ? 'text-danger' : (pctVal >= 0.5 ? 'text-warning' : 'text-success')}">${pctVal.toFixed(2)} ng/mL</strong>.</p>`;
        html += `<p class="mb-2"><strong>${pctInterp.title}.</strong> ${pctInterp.desc}</p>`;
        html += `<p class="mb-2 text-white-50" style="font-size:0.85rem;">Sugerencia clínica: utilice PCT como apoyo para decidir el inicio y la duración de antimicrobianos; en valores elevados priorizar toma de cultivos y manejo empírico dirigido mientras se espera confirmación microbiológica.</p>`;
    } else {
        html += `<p class="mb-2 text-white-50">${pctInterp.desc}</p>`;
    }

    if (deltaCO2 !== null && parseFloat(deltaCO2) > 6.0) html += `<p class="mb-2">El gradiente veno-arterial (Δ pCO2) se encuentra ensanchado <strong class="text-warning">(${deltaCO2} mmHg)</strong>, evidenciando un factor de riesgo para insuficiencia en el gasto cardíaco continuo. Recomendación: evaluar estado hemodinámico y perfusión, y considerar soporte si hay evidencia clínica de compromiso.</p>`;
    else if (deltaCO2 !== null) html += `<p class="mb-2">El gradiente veno-arterial (Δ pCO2) estrecho <strong class="text-success">(${deltaCO2} mmHg)</strong> es predictivo de un gasto cardíaco conservado y eficiente perfusión macrovascular. Mantener vigilancia y correlacionar con signos clínicos.</p>`;
    
    if (pafi !== null && pafi <= 100) html += `<p class="mb-4">El índice de oxigenación (PAFI: <strong class="text-danger">${pafi}</strong>) es consistente con un Síndrome de Dificultad Respiratoria Aguda (SDRA) Severo, marcando un alto riesgo de disfunción orgánica múltiple.</p>`;
    else if (pafi !== null && pafi <= 200) html += `<p class="mb-4">Alteración del intercambio gaseoso (PAFI: <strong class="text-warning">${pafi}</strong>), estableciéndose como un marcador pronóstico de secuela pulmonar moderada.</p>`;
    else if (pafi !== null) html += `<p class="mb-4">La suficiencia ventilatoria (PAFI: <strong class="text-success">${pafi}</strong>) actúa como factor protector ante el daño orgánico pulmonar.</p>`;
    else html += `<p class="mb-4 text-white-50">No se documentan parámetros gasométricos completos para evaluar el Índice Kirby (PAFI).</p>`;

    document.getElementById('formalReportText').innerHTML = html;
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderizarGraficas(score, lactato, deltaCO2, pafi, data) {
    const chartOpts = { 
        responsive: true, 
        maintainAspectRatio: false, 
        animation: { duration: 500 },
        plugins: {
            datalabels: {
                color: '#ffffff',
                font: { weight: 'bold', family: "'JetBrains Mono', monospace", size: 11 },
                formatter: (value) => { return value > 0 ? value : ''; }
            }
        }
    };
    
    new Chart(document.getElementById('barChart').getContext('2d'), {
        type: 'bar',
        data: { labels: ['Lactato', 'Δ pCO2'], datasets: [{ label: 'Paciente', data: [lactato, deltaCO2 !== null ? parseFloat(deltaCO2) : 0], backgroundColor: ['#00f0ff', '#00f0ff'] }, { label: 'Límite', data: [2.0, 6.0], type: 'line', borderColor: 'rgba(255,255,255,0.5)', borderDash: [5,5], fill: false, datalabels: { display: false } }] },
        options: { ...chartOpts, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }, plugins: { ...chartOpts.plugins, datalabels: { ...chartOpts.plugins.datalabels, anchor: 'end', align: 'bottom' } } }
    });

    const pco2Art = parseFloat(data.paCO2) || 40; const hco3 = parseFloat(data.hco3Arterial) || 24;
    new Chart(document.getElementById('doughnutChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels: ['PaCO2', 'HCO3', 'Brecha'], datasets: [{ data: [pco2Art, hco3, Math.max(100 - (pco2Art + hco3), 0)], backgroundColor: ['rgba(0, 240, 255, 0.7)', 'rgba(57, 255, 20, 0.7)', 'rgba(255, 255, 255, 0.1)'], borderColor: '#030a16', borderWidth: 2 }] },
        options: { ...chartOpts, cutout: '70%', plugins: { ...chartOpts.plugins, legend: { display: true, position: 'right', labels: { color: '#fff', font: { size: 10 } } } } }
    });

    new Chart(document.getElementById('radarChart').getContext('2d'), {
        type: 'radar',
        data: { labels: ['Mort.', 'Estrés', 'G. Cardíaco', 'Pulmones', 'Edad'], datasets: [{ label: 'Huella', data: [Math.min(score, 10), Math.min((lactato / 10) * 10, 10), Math.min(((parseFloat(deltaCO2) || 0) / 15) * 10, 10), pafi !== null ? Math.min(((500 - pafi) / 500) * 10, 10) : 0, Math.min(((data.edad||0) / 100) * 10, 10)], backgroundColor: 'rgba(255, 59, 48, 0.2)', borderColor: '#ff3b30', pointBackgroundColor: '#00f0ff', borderWidth: 2 }] },
        options: { ...chartOpts, scales: { r: { ticks: { display: false, max: 10 }, grid: { color: 'rgba(0, 240, 255, 0.2)' }, angleLines: { color: 'rgba(0, 240, 255, 0.2)' } } }, plugins: { ...chartOpts.plugins, legend: { display: false }, datalabels: { display: false } } }
    });
}

// Devuelve título y descripción de interpretación PCT según la lógica de Delta 3
function interpretarPCTText(pctVal) {
    if (pctVal === null || isNaN(pctVal)) {
        return { title: 'PCT no disponible', desc: 'No se cuenta con medición de Procalcitonina para este expediente.' };
    }
    if (pctVal < 0.10) {
        return { title: 'Infección bacteriana muy improbable', desc: 'Los valores se encuentran en rangos fisiológicos estables. Sugiere ausencia de respuesta inflamatoria sistémica de origen bacteriano agudo.' };
    }
    if (pctVal >= 0.10 && pctVal < 0.25) {
        return { title: 'Infección bacteriana poco probable', desc: 'Valores discretamente elevados. Consistente con infecciones virales localizadas o inflamaciones menores no complicadas de manera sistémica.' };
    }
    if (pctVal >= 0.25 && pctVal < 0.50) {
        return { title: 'Posible infección bacteriana temprana', desc: 'Zona gris diagnóstica. Puede representar una fase inicial de infección bacteriana (< 6 horas del evento). Se recomienda estrecha monitorización y repetir prueba entre las próximas 6 y 24 horas.' };
    }
    if (pctVal >= 0.50 && pctVal < 2.00) {
        return { title: 'Sospecha de infección sistémica (SIRS)', desc: 'Elevación significativa compatible con una respuesta sistémica. Alta probabilidad de una infección bacteriana infecciosa en progresión. Requiere atención clínica inmediata.' };
    }
    if (pctVal >= 2.00 && pctVal <= 10.00) {
        return { title: 'Sepsis altamente probable', desc: 'Valores de alta severidad diagnóstica. Indica un cuadro séptico establecido con un riesgo elevado de evolucionar hacia disfunción multiorgánica aguda.' };
    }
    return { title: 'Sepsis grave / Choque séptico inminente', desc: 'Nivel máximo de alerta inmunológica. Prácticamente exclusivo de infecciones bacterianas severas generalizadas o shock séptico. Alto riesgo de mortalidad inmediata.' };
}