// ==========================================
// VARIABLES GLOBALES
// ==========================================
let pacientesDataGlobal = [];
let chartRiesgo = null;
let chartEdad = null;
let chartComorb = null;
let idAEliminar = null;
let idAEditar = null;

document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const addEventSafe = (id, eventType, callback) => {
        const element = document.getElementById(id);
        if (element) element.addEventListener(eventType, callback);
    };

    addEventSafe('backToAppBtn', 'click', () => {
        localStorage.removeItem('deltaMortScore');
        document.body.classList.add('fade-out-page');
        setTimeout(() => window.location.href = 'delta1.html', 400);
    });

    addEventSafe('syncDataBtn', 'click', () => {
        obtenerPacientesDeAPI();
    });

    // Buscador Inteligente
    addEventSafe('searchInput', 'input', (e) => {
        const text = e.target.value.toLowerCase();
        document.querySelectorAll('#patientsTableBody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(text) ? '' : 'none';
        });
        document.querySelectorAll('#gasometriasTableBody tr').forEach(row => {
            row.style.display = row.innerText.toLowerCase().includes(text) ? '' : 'none';
        });
    });

    // ==========================================
    // EXPORTACIÓN MAGISTRAL A EXCEL (TABLAS Y GRÁFICAS)
    // ==========================================
    addEventSafe('exportExcelBtn', 'click', async () => {
        const btn = document.getElementById('exportExcelBtn');
        try {
            btn.innerHTML = '<i class="pulse-indicator me-2"></i> Generando Excel...';
            btn.disabled = true;

            // 1. Crear el Libro de Excel
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Delta-PCT Sistema Clínico';
            workbook.created = new Date();

            // --- HOJA 1: PACIENTES (FASE 1) ---
            const sheet1 = workbook.addWorksheet('Pacientes (Fase 1)');
            sheet1.columns = [
                { header: 'Folio', key: 'folio', width: 15 },
                { header: 'Fecha Ingreso', key: 'fecha', width: 15 },
                { header: 'Edad (años)', key: 'edad', width: 12 },
                { header: 'Género', key: 'genero', width: 15 },
                { header: 'Patologías', key: 'comorb', width: 35 },
                { header: 'Foco Séptico', key: 'sepsis', width: 20 },
                { header: 'Score F1', key: 'score', width: 12 },
                { header: 'Nivel de Riesgo', key: 'estado', width: 15 }
            ];

            // Estilo Encabezado Tabla 1
            sheet1.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet1.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF005B96' } };

            pacientesDataGlobal.forEach(p => {
                sheet1.addRow({
                    folio: p.folio,
                    fecha: p.fecha,
                    edad: p.edad,
                    genero: p.genero === 'M' ? 'Masculino' : (p.genero === 'F' ? 'Femenino' : 'N/E'),
                    comorb: p.comorbilidades_detalle || 'Ninguna',
                    sepsis: p.sepsis || 'No',
                    score: p.score,
                    estado: p.estado
                });
            });

            // --- HOJA 2: GASOMETRÍAS (FASE 2) ---
            const sheet2 = workbook.addWorksheet('Gasometrías (Fase 2)');
            sheet2.columns = [
                { header: 'Folio Paciente', key: 'folio', width: 15 },
                { header: 'Lactato (mmol/L)', key: 'lactato', width: 18 },
                { header: 'Procalcitonina (ng/mL)', key: 'pct', width: 18 },
                { header: 'pH Arterial', key: 'ph', width: 12 },
                { header: 'PaCO2 (mmHg)', key: 'paco2', width: 15 },
                { header: 'HCO3 (mmol/L)', key: 'hco3', width: 15 },
                { header: 'PaO2 (mmHg)', key: 'pao2', width: 12 },
                { header: 'PvCO2 (mmHg)', key: 'pvco2', width: 15 },
                { header: 'FiO2 (%)', key: 'fio2', width: 12 },
                { header: 'Delta pCO2', key: 'delta', width: 15 },
                { header: 'Índice PAFI', key: 'pafi', width: 15 }
            ];

            // Estilo Encabezado Tabla 2
            sheet2.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet2.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF008080' } };

            pacientesDataGlobal.forEach(p => {
                sheet2.addRow({
                    folio: p.folio,
                    lactato: p.lactato !== null ? parseFloat(p.lactato) : 'N/D',
                    pct: p.procalcitonina !== null ? parseFloat(p.procalcitonina) : 'N/D',
                    ph: p.ph_arterial !== null ? parseFloat(p.ph_arterial) : 'N/D',
                    paco2: p.pa_co2 !== null ? parseFloat(p.pa_co2) : 'N/D',
                    hco3: p.hco3 !== null ? parseFloat(p.hco3) : 'N/D',
                    pao2: p.pa_o2 !== null ? parseFloat(p.pa_o2) : 'N/D',
                    pvco2: p.pv_co2 !== null ? parseFloat(p.pv_co2) : 'N/D',
                    fio2: p.fi_o2 !== null ? parseFloat(p.fi_o2) : 'N/D',
                    delta: p.delta_co2 !== null ? parseFloat(p.delta_co2) : 'N/D',
                    pafi: p.pafi !== null ? parseFloat(p.pafi) : 'N/D'
                });
            });

            // --- HOJA 3: DASHBOARD GRÁFICO (Fondo Oscuro) ---
            const sheet3 = workbook.addWorksheet('Dashboard Visual', { views: [{ showGridLines: false }] });

            // Pintar todo el fondo de Excel de color azul oscuro para que parezca el sistema web
            for (let r = 1; r <= 40; r++) {
                for (let c = 1; c <= 20; c++) {
                    sheet3.getCell(r, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF030A16' } };
                }
            }

            sheet3.getCell('B2').value = 'REPORTE VISUAL MULTIORGÁNICO - DELTA PCT';
            sheet3.getCell('B2').font = { size: 16, bold: true, color: { argb: 'FF39FF14' } };

            // Función interna para tomar foto a las gráficas y pegarlas en Excel
            const pegarGraficaEnExcel = (idCanvas, columna, fila, ancho, alto) => {
                const canvas = document.getElementById(idCanvas);
                if (canvas) {
                    const imageId = workbook.addImage({
                        base64: canvas.toDataURL('image/png', 1.0),
                        extension: 'png',
                    });
                    sheet3.addImage(imageId, {
                        tl: { col: columna, row: fila }, // Posición
                        ext: { width: ancho, height: alto } // Tamaño
                    });
                }
            };

            // Títulos y pegado de Gráficas
            sheet3.getCell('B4').value = 'Distribución de Riesgo Global';
            sheet3.getCell('B4').font = { color: { argb: 'FF00F0FF' }, bold: true };
            pegarGraficaEnExcel('globalRiskChart', 1, 4, 350, 250);

            sheet3.getCell('H4').value = 'Top Patologías y Comorbilidades';
            sheet3.getCell('H4').font = { color: { argb: 'FF00F0FF' }, bold: true };
            pegarGraficaEnExcel('comorbChart', 7, 4, 350, 250);

            sheet3.getCell('B20').value = 'Distribución de Pacientes por Rango de Edad';
            sheet3.getCell('B20').font = { color: { argb: 'FF00F0FF' }, bold: true };
            pegarGraficaEnExcel('globalAgeChart', 1, 20, 750, 250);

            // 2. Descargar el archivo a la computadora
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `BaseDeDatos_DeltaPCT_${new Date().toISOString().slice(0, 10)}.xlsx`);

        } catch (error) {
            console.error('Error al generar Excel:', error);
            alert("Ocurrió un error al intentar crear el documento de Excel.");
        } finally {
            // Restaurar el botón
            btn.innerHTML = '<i data-lucide="file-spreadsheet" style="width:18px;height:18px;"></i> Respaldar Excel';
            btn.disabled = false;
            lucide.createIcons();
        }
    });

    // Eventos Modales (Eliminar y Editar)
    addEventSafe('cancelDeleteBtn', 'click', () => {
        document.getElementById('deleteModal').classList.remove('active');
    });

    addEventSafe('confirmDeleteBtn', 'click', async () => {
        const btn = document.getElementById('confirmDeleteBtn');
        try {
            btn.innerHTML = 'Eliminando...';
            btn.disabled = true;
            await fetch(`/api/pacientes/${idAEliminar}`, { method: 'DELETE' });
        } catch (error) {
            console.error('Error al eliminar:', error);
        } finally {
            document.getElementById('deleteModal').classList.remove('active');
            btn.innerHTML = 'Confirmar Eliminación';
            btn.disabled = false;
            obtenerPacientesDeAPI();
        }
    });

    addEventSafe('cancelEditBtn', 'click', () => {
        document.getElementById('editModal').classList.remove('active');
    });

    addEventSafe('confirmEditBtn', 'click', async () => {
        const btn = document.getElementById('confirmEditBtn');
        try {
            const payload = {
                edad: document.getElementById('editEdad').value,
                genero: document.getElementById('editGenero').value,
                sepsis: document.getElementById('editSepsis').value,
                lactato: document.getElementById('editLactato').value,
                estado: document.getElementById('editEstado').value,
                procalcitonina: document.getElementById('editPCT').value
            };
            btn.innerHTML = 'Guardando...';
            btn.disabled = true;

            await fetch(`/api/pacientes/${idAEditar}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Error al editar:', error);
        } finally {
            document.getElementById('editModal').classList.remove('active');
            btn.innerHTML = 'Guardar Cambios';
            btn.disabled = false;
            obtenerPacientesDeAPI();
        }
    });

    obtenerPacientesDeAPI();
});

// ==========================================
// PETICIONES Y PROCESAMIENTO DE TABLAS
// ==========================================

async function obtenerPacientesDeAPI() {
    try {
        const response = await fetch('/api/pacientes');
        const data = await response.json();

        if (!response.ok || !Array.isArray(data)) {
            throw new Error(data.error || data.message || "Error del servidor al obtener datos");
        }

        pacientesDataGlobal = data;

        actualizarKPIs(data);
        renderizarTablaPacientes(data);
        renderizarTablaGasometrias(data);
        renderizarGraficasGlobales(data);
    } catch (error) {
        console.error('Error al descargar base de datos:', error);
        document.getElementById('patientsTableBody').innerHTML = `<tr><td colspan="10" class="text-danger text-center">Error de conexión con la Base de Datos: ${error.message}</td></tr>`;
        document.getElementById('gasometriasTableBody').innerHTML = `<tr><td colspan="11" class="text-danger text-center">Error de conexión con la Base de Datos: ${error.message}</td></tr>`;
    }
}

// RENDERIZADO TABLA 1: PACIENTES
function renderizarTablaPacientes(data) {
    const tbody = document.getElementById('patientsTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" class="text-center text-white-50 py-3">No hay pacientes en la tabla 'pacientes'.</td></tr>`;
        return;
    }

    data.forEach(p => {
        let badge = p.estado === 'Crítico' ? '<span class="badge bg-danger">Crítico</span>' :
            (p.estado === 'Medio' ? '<span class="badge bg-warning text-dark">Medio</span>' : '<span class="badge bg-success">Bajo</span>');

        tbody.innerHTML += `
            <tr>
                <td class="text-neon-cyan fw-bold">${p.folio}</td>
                <td>${p.fecha}</td>
                <td>${p.edad} años</td>
                <td>${p.genero === 'M' ? 'Masc' : (p.genero === 'F' ? 'Fem' : 'N/E')}</td>
                <td class="text-white-50 text-truncate" style="max-width: 180px;" title="${p.comorbilidades_detalle}">${p.comorbilidades_detalle || 'Ninguna'}</td>
                <td>${p.sepsis || 'No'}</td>
                <td class="text-center">${p.procalcitonina !== null ? parseFloat(p.procalcitonina).toFixed(2) : 'N/D'}</td>
                <td class="text-center fw-bold">${p.score}</td>
                <td class="text-center">${badge}</td>
                <td class="text-end">
                    <button class="btn-crud edit me-1" onclick="editarPaciente(${p.id})"><i data-lucide="edit-2" style="width:13px;height:13px;"></i></button>
                    <button class="btn-crud delete" onclick="confirmarEliminar(${p.id})"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
                </td>
            </tr>
        `;
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

// RENDERIZADO TABLA 2: GASOMETRÍAS
function renderizarTablaGasometrias(data) {
    const tbody = document.getElementById('gasometriasTableBody');
    tbody.innerHTML = '';

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="12" class="text-center text-white-50 py-3">No hay registros de laboratorio en la tabla 'gasometrias'.</td></tr>`;
        return;
    }

    data.forEach(p => {
        let lac = p.lactato !== null ? parseFloat(p.lactato).toFixed(1) : 'N/D';
        let pct = p.procalcitonina !== null ? parseFloat(p.procalcitonina).toFixed(2) : 'N/D';
        let ph = p.ph_arterial !== null ? parseFloat(p.ph_arterial).toFixed(2) : 'N/D';
        let co2 = p.pa_co2 !== null ? parseFloat(p.pa_co2).toFixed(1) : 'N/D';
        let hco3 = p.hco3 !== null ? parseFloat(p.hco3).toFixed(1) : 'N/D';
        let o2 = p.pa_o2 !== null ? parseFloat(p.pa_o2).toFixed(1) : 'N/D';
        let vco2 = p.pv_co2 !== null ? parseFloat(p.pv_co2).toFixed(1) : 'N/D';
        let fio2 = p.fi_o2 !== null ? `${p.fi_o2}%` : 'N/D';
        let delta = p.delta_co2 !== null ? `${parseFloat(p.delta_co2).toFixed(1)} mmHg` : 'N/D';
        let pafi = p.pafi !== null ? p.pafi : 'N/D';

        tbody.innerHTML += `
            <tr>
                <td class="text-info fw-bold">${p.folio}</td>
                <td class="text-center text-white fw-bold">${lac}</td>
                <td class="text-center">${pct}</td>
                <td class="text-center">${ph}</td>
                <td class="text-center">${co2}</td>
                <td class="text-center">${hco3}</td>
                <td class="text-center">${o2}</td>
                <td class="text-center">${vco2}</td>
                <td class="text-center">${fio2}</td>
                <td class="text-center text-warning">${delta}</td>
                <td class="text-center text-neon-green fw-bold">${pafi}</td>
                <td class="text-end">
                    <button class="btn-crud edit me-1" onclick="editarPaciente(${p.id})"><i data-lucide="edit-2" style="width:13px;height:13px;"></i></button>
                    <button class="btn-crud delete" onclick="confirmarEliminar(${p.id})"><i data-lucide="trash-2" style="width:13px;height:13px;"></i></button>
                </td>
            </tr>
        `;
    });
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editarPaciente(id) {
    const paciente = pacientesDataGlobal.find(p => p.id === id);
    if (!paciente) return;
    idAEditar = id;
    document.getElementById('editEdad').value = paciente.edad;
    document.getElementById('editGenero').value = paciente.genero;
    document.getElementById('editSepsis').value = paciente.sepsis;
    document.getElementById('editLactato').value = paciente.lactato;
    document.getElementById('editPCT').value = paciente.procalcitonina !== null ? paciente.procalcitonina : '';
    document.getElementById('editEstado').value = paciente.estado;
    document.getElementById('editModal').classList.add('active');
}

function confirmarEliminar(id) {
    idAEliminar = id;
    document.getElementById('deleteModal').classList.add('active');
}

function actualizarKPIs(data) {
    document.getElementById('kpiTotal').textContent = data.length;
    document.getElementById('kpiRiesgo').textContent = data.filter(p => p.score >= 6).length;
    document.getElementById('kpiSepsis').textContent = data.filter(p => p.sepsis !== 'No' && p.sepsis !== null).length;
    document.getElementById('kpiLactato').textContent = data.filter(p => p.lactato !== null && parseFloat(p.lactato) > 2.0).length;
}

function renderizarGraficasGlobales(data) {
    const bajos = data.filter(p => p.score < 3).length;
    const medios = data.filter(p => p.score >= 3 && p.score < 6).length;
    const altos = data.filter(p => p.score >= 6).length;

    if (chartRiesgo) chartRiesgo.destroy();
    chartRiesgo = new Chart(document.getElementById('globalRiskChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: ['Riesgo Bajo (<3)', 'Riesgo Medio (3-5)', 'Riesgo Alto (≥6)'],
            datasets: [{ data: [bajos, medios, altos], backgroundColor: ['rgba(57, 255, 20, 0.7)', 'rgba(255, 159, 0, 0.7)', 'rgba(255, 59, 48, 0.7)'], borderColor: '#030a16', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'right', labels: { color: '#fff', font: { size: 10 } } } } }
    });

    const rango1 = data.filter(p => p.edad < 40).length;
    const rango2 = data.filter(p => p.edad >= 40 && p.edad <= 65).length;
    const rango3 = data.filter(p => p.edad > 65).length;

    if (chartEdad) chartEdad.destroy();
    chartEdad = new Chart(document.getElementById('globalAgeChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Menores 40', '40 - 65 años', 'Mayores 65'],
            datasets: [{ label: 'Pacientes', data: [rango1, rango2, rango3], backgroundColor: 'rgba(0, 240, 255, 0.6)', borderColor: '#00f0ff', borderWidth: 1, borderRadius: 4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });

    let conteoPatologias = { 'Diabetes': 0, 'Hipertensión': 0, 'Obesidad': 0, 'Renal/Cardíaca': 0, 'Otras': 0 };
    data.forEach(p => {
        if (p.comorbilidades_detalle && p.comorbilidades_detalle !== 'Ninguna' && p.comorbilidades_detalle !== 'Sí') {
            let texto = p.comorbilidades_detalle.toLowerCase();
            if (texto.includes('diabet') || texto.includes('dm')) conteoPatologias['Diabetes']++;
            else if (texto.includes('hiperten') || texto.includes('hta')) conteoPatologias['Hipertensión']++;
            else if (texto.includes('obesidad')) conteoPatologias['Obesidad']++;
            else if (texto.includes('renal') || texto.includes('card') || texto.includes('corazon')) conteoPatologias['Renal/Cardíaca']++;
            else conteoPatologias['Otras']++;
        }
    });

    const labelsComorb = Object.keys(conteoPatologias).filter(k => conteoPatologias[k] > 0);
    const dataComorb = labelsComorb.map(k => conteoPatologias[k]);

    if (chartComorb) chartComorb.destroy();
    chartComorb = new Chart(document.getElementById('comorbChart').getContext('2d'), {
        type: 'polarArea',
        data: {
            labels: labelsComorb.length > 0 ? labelsComorb : ['Sin datos'],
            datasets: [{ data: dataComorb.length > 0 ? dataComorb : [1], backgroundColor: ['rgba(0, 240, 255, 0.6)', 'rgba(57, 255, 20, 0.6)', 'rgba(255, 159, 0, 0.6)', 'rgba(255, 59, 48, 0.6)', 'rgba(170, 0, 255, 0.6)'], borderColor: '#030a16', borderWidth: 2 }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { ticks: { display: false }, grid: { color: 'rgba(0, 240, 255, 0.1)' }, angleLines: { color: 'rgba(0, 240, 255, 0.1)' } } }, plugins: { legend: { position: 'right', labels: { color: '#fff', font: { size: 9 } } } } }
    });
}