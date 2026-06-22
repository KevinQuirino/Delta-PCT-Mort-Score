document.addEventListener('DOMContentLoaded', () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const pctInput = document.getElementById('pctInput');
    const backBtn = document.getElementById('backToPhase2Btn');
    const nextBtn = document.getElementById('generateReportBtn');

    const rawData = localStorage.getItem('deltaMortScore');
    if (rawData) {
        const currentData = JSON.parse(rawData);
        if (currentData.procalcitonina !== undefined && currentData.procalcitonina !== "") {
            pctInput.value = currentData.procalcitonina;
            calcularInterpretacionPCT(parseFloat(currentData.procalcitonina));
        }
    }

    pctInput.addEventListener('input', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val >= 0) {
            calcularInterpretacionPCT(val);
        } else {
            ocultarInterpretacion();
        }
    });

    backBtn.addEventListener('click', () => {
        guardarDatosTemporales();
        document.body.classList.add('fade-out-page');
        setTimeout(() => window.location.href = 'delta-report.html', 400);
    });

    nextBtn.addEventListener('click', async () => {
        if (pctInput.value === "") {
            alert("Por favor, ingrese el parámetro de Procalcitonina (PCT) para poder procesar la simulación.");
            return;
        }
        guardarDatosTemporales();

        const pacienteId = localStorage.getItem('currentPacienteId');
        if (pacienteId) {
            try {
                await fetch(`/api/pacientes/${pacienteId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        edad: null,
                        genero: null,
                        sepsis: null,
                        lactato: null,
                        estado: null,
                        procalcitonina: parseFloat(pctInput.value)
                    })
                });
            } catch (error) {
                console.error('No se pudo actualizar el PCT en la base de datos:', error);
            }
        }

        document.body.classList.add('fade-out-page');
        setTimeout(() => window.location.href = 'delta-report.html', 400);
    });
});

function calcularInterpretacionPCT(val) {
    const box = document.getElementById('interpretationBox');
    const badge = document.getElementById('pctBadge');
    const title = document.getElementById('pctTitle');
    const desc = document.getElementById('pctDesc');

    box.style.display = 'block';
    document.querySelectorAll('.table-light tbody tr').forEach(tr => tr.style.backgroundColor = 'transparent');

    let riesgo = ""; let claseBadge = ""; let msgTitle = ""; let msgDesc = ""; let rowId = "";

    if (val < 0.10) {
        riesgo = "NORMAL"; claseBadge = "bg-success text-white";
        msgTitle = "Infección bacteriana muy improbable";
        msgDesc = "Los valores se encuentran en rangos fisiológicos estables. Sugiere ausencia de respuesta inflamatoria sistémica de origen bacteriano agudo.";
        rowId = "row-normal";
    }
    else if (val >= 0.10 && val < 0.25) {
        riesgo = "RIESGO BAJO"; claseBadge = "bg-info text-dark";
        msgTitle = "Infección bacteriana poco probable";
        msgDesc = "Valores discretamente elevados. Consistente con infecciones virales localizadas o inflamaciones menores no complicadas de manera sistémica.";
        rowId = "row-bajo";
    }
    else if (val >= 0.25 && val < 0.50) {
        riesgo = "INDETERMINADO"; claseBadge = "bg-warning text-dark";
        msgTitle = "Posible infección bacteriana temprana";
        msgDesc = "Zona gris diagnóstica. Puede representar una fase inicial de infección bacteriana (< 6 horas del evento). Se recomienda estrecha monitorización y repetir prueba entre las próximas 6 y 24 horas.";
        rowId = "row-posible";
    }
    else if (val >= 0.50 && val < 2.00) {
        riesgo = "RIESGO MODERADO"; claseBadge = "bg-warning text-dark";
        msgTitle = "Sospecha de infección sistémica (SIRS)";
        msgDesc = "Elevación significativa compatible con una respuesta sistémica. Alta probabilidad de una infección bacteriana infecciosa en progresión. Requiere atención clínica inmediata.";
        rowId = "row-probable";
    }
    else if (val >= 2.00 && val <= 10.00) {
        riesgo = "ALTO RIESGO"; claseBadge = "bg-danger text-white";
        msgTitle = "Sepsis altamente probable";
        msgDesc = "Valores de alta severidad diagnóstica. Indica un cuadro séptico establecido con un riesgo elevado de evolucionar hacia disfunción multiorgánica aguda.";
        rowId = "row-alto";
    }
    else {
        riesgo = "CRÍTICO SEVERO"; claseBadge = "bg-danger text-white text-blink";
        msgTitle = "Sepsis grave / Choque séptico inminente";
        msgDesc = "Nivel máximo de alerta inmunológica. Prácticamente exclusivo de infecciones bacterianas severas generalizadas o shock séptico. Alto riesgo de mortalidad inmediata.";
        rowId = "row-severo";
    }

    badge.textContent = riesgo;
    badge.className = `badge px-2 py-1 uppercase fw-bold ${claseBadge}`;
    title.textContent = msgTitle;
    title.className = (val >= 2.00) ? "text-danger fw-bold mb-2" : "text-white fw-bold mb-2";
    desc.textContent = msgDesc;

    const targetRow = document.getElementById(rowId);
    if (targetRow) targetRow.style.backgroundColor = 'rgba(0, 240, 255, 0.25)';
}

function ocultarInterpretacion() {
    document.getElementById('interpretationBox').style.display = 'none';
    document.querySelectorAll('.table-light tbody tr').forEach(tr => tr.style.backgroundColor = 'transparent');
}

function guardarDatosTemporales() {
    const rawData = localStorage.getItem('deltaMortScore');
    let currentObject = rawData ? JSON.parse(rawData) : {};
    currentObject.procalcitonina = document.getElementById('pctInput').value;
    localStorage.setItem('deltaMortScore', JSON.stringify(currentObject));
}