const rawData = typeof window.COBRANCAS_JSON !== "undefined"
    ? window.COBRANCAS_JSON
    : (window.DEMO_CHARGES || []);

const charges = normalizeData(rawData);

const PAGE_SIZE = 5;

let currentPage = 1;
let visibleCharges = [...charges];
let toastTimer;
let selectedStatus = "pending";

/**
 * Normaliza os dados recebidos do PHP.
 * Utiliza exclusivamente os campos existentes no retorno.
 */
function normalizeData(data) {
    if (typeof data === "string") {
        try {
            data = JSON.parse(data);
        } catch (error) {
            console.error("JSON de cobranças inválido", error);
            return [];
        }
    }

    if (!Array.isArray(data)) {
        return [];
    }

    return data.map(charge => {
        const status = String(charge.status || "").trim().toLowerCase();

        const paid = status === "quitada";

        const value = Number(
            String(charge.value ?? "0").replace(",", ".")
        );

        const code = charge.barCode == null
            ? ""
            : String(charge.barCode).trim();

        return {
            ...charge,
            _id: charge.id,
            _title: charge.title || "Cobrança",
            _student: charge.student || "—",
            _value: Number.isFinite(value) ? value : 0,
            _due: parseDate(charge.dueDate),
            _paid: paid,
            _code: code === "0" ? "" : code,
            _pix: Boolean(charge.pix_qr_code),
            _qr: charge.pix_qr_code || ""
        };
    });
}

/**
 * Converte datas do formato DD/MM/YYYY.
 * Valida também se a data realmente existe.
 */
function parseDate(value) {
    if (!value) {
        return null;
    }

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : value;
    }

    const dateString = String(value).trim();
    const match = dateString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

    if (!match) {
        return null;
    }

    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(year, month - 1, day);

    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
    ) {
        return null;
    }

    return date;
}

function dayStart(date = new Date()) {
    return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
    );
}

function dateDiff(date) {
    if (!date) {
        return null;
    }

    return Math.round(
        (dayStart(date) - dayStart()) / 86400000
    );
}

function money(value) {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(value);
}

function formatDate(date) {
    return date
        ? new Intl.DateTimeFormat("pt-BR").format(date)
        : "Data não informada";
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

/**
 * Considera pendente somente o status informado pelo PHP.
 */
function isPending(charge) {
    return (
        !charge._paid &&
        String(charge.status || "").trim().toLowerCase() === "pendente"
    );
}

/**
 * Define a classificação visual da cobrança.
 */
function stateOf(charge) {
    if (charge._paid) {
        return "paid";
    }

    const difference = charge._due
        ? dateDiff(charge._due)
        : null;

    if (difference !== null && difference < 0) {
        return "overdue";
    }

    if (difference !== null && difference <= 7) {
        return "soon";
    }

    return "normal";
}

function statusLabel(charge) {
    if (charge._paid) {
        return "Quitada";
    }

    const state = stateOf(charge);

    if (state === "overdue") {
        return "Vencida";
    }

    if (state === "soon") {
        return "Vence em até 7 dias";
    }

    return charge.status || "Status não informado";
}

/**
 * Atualiza o resumo financeiro.
 * O resumo considera todas as cobranças, independentemente dos filtros.
 */
function renderSummary() {
    const pending = charges.filter(isPending);

    const overdue = pending.filter(
        charge => stateOf(charge) === "overdue"
    );

    document.getElementById("overdueMain").textContent = overdue.length
        ? `${overdue.length} ${overdue.length === 1 ? "cobrança" : "cobranças"}`
        : "Tudo em dia";

    document.getElementById("overdueDetail").textContent = overdue.length
        ? `${money(
            overdue.reduce(
                (sum, charge) => sum + charge._value,
                0
            )
        )} em aberto`
        : "Você não tem cobranças vencidas.";

    const upcoming = pending
        .filter(charge => {
            return charge._due && dateDiff(charge._due) >= 0;
        })
        .sort((a, b) => a._due - b._due)[0];

    document.getElementById("nextMain").textContent = upcoming
        ? formatDate(upcoming._due)
        : "Nenhum vencimento próximo";

    document.getElementById("nextDetail").textContent = upcoming
        ? `${upcoming._title} · ${upcoming._student} · ${money(upcoming._value)}`
        : "Não há cobranças pendentes com vencimento futuro.";
}

/**
 * Preenche o filtro de filhos.
 */
function setupStudentFilter() {
    const select = document.getElementById("studentFilter");

    const students = [
        ...new Set(
            charges
                .map(charge => charge._student)
                .filter(student => student && student !== "—")
        )
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    students.forEach(student => {
        const option = document.createElement("option");

        option.value = student;
        option.textContent = student;

        select.appendChild(option);
    });
}

/**
 * Preenche o filtro de nome da cobrança.
 */
function setupBillNameFilter() {
    const select = document.getElementById("billNameFilter");

    const billNames = [
        ...new Set(
            charges
                .map(charge => charge._title)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, "pt-BR"));

    billNames.forEach(billName => {
        const option = document.createElement("option");

        option.value = billName;
        option.textContent = billName;

        select.appendChild(option);
    });
}

/**
 * Aplica os filtros disponíveis:
 * filho, nome da cobrança e período.
 *
 * O retorno do PHP não identifica explicitamente todas as formas
 * de pagamento. Por isso, não classifica automaticamente cobranças
 * sem QR Code como boleto.
 */
function applyFilters() {
    const student = document.getElementById("studentFilter").value;
    const billName = document.getElementById("billNameFilter").value;
    const month = document.getElementById("monthFilter").value;
    const year = document.getElementById("yearFilter").value;
    const type = document.getElementById("typeFilter").value;

    visibleCharges = charges.filter(charge => {
        if (selectedStatus === "pending" && !isPending(charge)) {
            return false;
        }

        if (selectedStatus === "paid" && !charge._paid) {
            return false;
        }

        if (student && charge._student !== student) {
            return false;
        }

        if (billName && charge._title !== billName) {
            return false;
        }

        const diff = charge._due
            ? dateDiff(charge._due)
            : null;

        // Filtro por mês de vencimento
        if (
            month &&
            (!charge._due ||
                charge._due.getMonth() + 1 !== Number(month))
        ) {
            return false;
        }

        // Filtro por ano de vencimento
        if (
            year &&
            (!charge._due ||
                charge._due.getFullYear() !== Number(year))
        ) {
            return false;
        }

        // Filtro por tipo de pagamento
        if (type === "pix" && !charge._pix) {
            return false;
        }

        if (type === "boleto" && charge._pix) {
            return false;
        }

        return true;
    });

    currentPage = 1;
    renderTable();
}

document.querySelectorAll("[data-status-filter]").forEach(button => {
    button.addEventListener("click", () => {
        selectedStatus = button.dataset.statusFilter;

        document.querySelectorAll("[data-status-filter]").forEach(option => {
            const isActive = option === button;

            option.classList.toggle("active", isActive);
            option.setAttribute("aria-pressed", String(isActive));
        });

        currentPage = 1;
        applyFilters();
    });
});

/**
 * Renderiza a tabela de cobranças e a paginação.
 */
function renderTable() {
    const body = document.getElementById("chargesBody");
    const empty = document.getElementById("emptyState");

    const total = visibleCharges.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    currentPage = Math.min(currentPage, pages);

    const start = (currentPage - 1) * PAGE_SIZE;

    const items = visibleCharges.slice(
        start,
        start + PAGE_SIZE
    );

    body.innerHTML = items.map(charge => {
        const state = stateOf(charge);

        const method = charge._pix
            ? "Pix"
            : "Boleto";

        let action;

        if (charge._paid) {
            action = '<span class="paid-label">Quitada</span>';
        } else if (charge._pix) {
            action = `
                <button
                    class="btn btn-primary btn-sm"
                    data-action="pix"
                    data-id="${escapeHtml(charge._id)}"
                    type="button">
                    Ver QR Code
                </button>
            `;
        } else if (charge._code) {
            action = `
                <button
                    class="btn btn-outline btn-sm"
                    data-action="copy"
                    data-id="${escapeHtml(charge._id)}"
                    type="button">
                    Copiar código
                </button>
            `;
        } else {
            action = '<span class="charge-sub">Código indisponível</span>';
        }

        return `
            <tr class="status-${state}">
                <td class="charge-cell">
                    <div class="charge-title">
                        ${escapeHtml(charge._title)}
                    </div>
                    <div class="charge-sub">
                        Parcela ${escapeHtml(charge.installment || "—")}
                        de ${escapeHtml(charge.total_installment || "—")}
                    </div>
                </td>

                <td>
                    <span class="student">
                        ${escapeHtml(charge._student)}
                    </span>
                </td>

                <td>
                    <span class="date">
                        ${formatDate(charge._due)}
                    </span>
                </td>

                <td>
                    <span class="value">
                        ${money(charge._value)}
                    </span>
                </td>

                <td>
                    <span class="status-text">
                        ${escapeHtml(statusLabel(charge))}
                    </span>
                </td>

                <td>
                    <span class="method ${charge._pix ? "pix" : ""}">
                        ${escapeHtml(method)}
                    </span>
                </td>

                <td>
                    <div class="actions">
                        ${action}
                    </div>
                </td>
            </tr>
        `;
    }).join("");

    empty.hidden = total !== 0;
    body.parentElement.style.display = total ? "table" : "none";

    document.getElementById("resultCount").textContent =
        `${total} ${total === 1 ? "cobrança" : "cobranças"}`;

    document.getElementById("pageInfo").textContent = total
        ? `Exibindo ${start + 1}–${Math.min(start + PAGE_SIZE, total)} de ${total}`
        : "Nenhuma cobrança para exibir";

    const buttons = document.getElementById("pageButtons");

    buttons.innerHTML = `
        <button
            type="button"
            aria-label="Página anterior"
            ${currentPage === 1 ? "disabled" : ""}
            data-page="${currentPage - 1}">
            ‹
        </button>
    `;

    buttons.innerHTML += Array.from(
        { length: pages },
        (_, index) => index + 1
    ).map(number => `
        <button
            type="button"
            class="${number === currentPage ? "active" : ""}"
            aria-label="Página ${number}"
            ${number === currentPage ? 'aria-current="page"' : ""}
            data-page="${number}">
            ${number}
        </button>
    `).join("");

    buttons.innerHTML += `
        <button
            type="button"
            aria-label="Próxima página"
            ${currentPage === pages ? "disabled" : ""}
            data-page="${currentPage + 1}">
            ›
        </button>
    `;
}

function showToast(message) {
    const toast = document.getElementById("toast");

    toast.textContent = message;
    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);
}

/**
 * Copia o código de pagamento para a área de transferência.
 */
async function copyText(text) {
    if (!text) {
        showToast("Código de pagamento indisponível.");
        return false;
    }

    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (error) {
        const area = document.createElement("textarea");

        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";

        document.body.appendChild(area);
        area.select();

        const success = document.execCommand("copy");

        area.remove();

        return success;
    }
}

function setupYearFilter() {
    const select = document.getElementById("yearFilter");

    const years = new Set([new Date().getFullYear()]);

    charges.forEach(charge => {
        if (charge._due) {
            years.add(charge._due.getFullYear());
        }
    });

    [...years]
        .sort((a, b) => b - a)
        .forEach(year => {
            const option = document.createElement("option");

            option.value = String(year);
            option.textContent = String(year);

            select.appendChild(option);
        });
}

/**
 * Abre o modal do Pix.
 * A validade não é exibida porque não existe no retorno do PHP.
 */
function openPix(charge) {
    document.getElementById("pixTitle").textContent =
        charge._title;

    document.getElementById("pixSubtitle").textContent =
        `${charge._student} · Parcela ${charge.installment || "—"}`;

    document.getElementById("pixValue").textContent =
        money(charge._value);

    document.getElementById("pixCopyCode").textContent =
        charge._code || "Código de pagamento não disponível.";

    const wrap = document.getElementById("qrWrap");

    wrap.innerHTML = "";

    if (charge._qr) {
        const image = document.createElement("img");

        image.src = charge._qr;
        image.alt = "QR Code Pix";

        image.onerror = () => {
            wrap.innerHTML =
                '<div class="qr-fallback">Não foi possível carregar o QR Code.</div>';
        };

        wrap.appendChild(image);
    } else {
        wrap.innerHTML =
            '<div class="qr-fallback">QR Code não disponível para esta cobrança.</div>';
    }

    document.getElementById("copyPixCode").dataset.code =
        charge._code || "";

    document.getElementById("pixModal").classList.add("open");
}

/**
 * Ações da tabela.
 */
document.getElementById("chargesBody").addEventListener(
    "click",
    async event => {
        const button = event.target.closest("button[data-action]");

        if (!button) {
            return;
        }

        const charge = charges.find(
            item => String(item._id) === button.dataset.id
        );

        if (!charge) {
            return;
        }

        if (button.dataset.action === "pix") {
            openPix(charge);
            return;
        }

        if (button.dataset.action === "copy") {
            const success = await copyText(charge._code);

            if (success) {
                button.textContent = "Copiado";
                button.disabled = true;

                setTimeout(() => {
                    button.textContent = "Copiar código";
                    button.disabled = false;
                }, 2000);
            } else {
                showToast("Não foi possível copiar. Tente novamente.");
            }
        }
    }
);

/**
 * Copia o código exibido no modal Pix.
 */
document.getElementById("copyPixCode").addEventListener(
    "click",
    async event => {
        const button = event.currentTarget;
        const success = await copyText(button.dataset.code);

        if (success) {
            button.textContent = "Copiado";

            setTimeout(() => {
                button.textContent = "Copiar código Pix";
            }, 2000);
        } else {
            showToast("Não foi possível copiar. Tente novamente.");
        }
    }
);

function closeModal() {
    document.getElementById("pixModal").classList.remove("open");
}

document.getElementById("closeModal").addEventListener(
    "click",
    closeModal
);

document.getElementById("pixModal").addEventListener(
    "click",
    event => {
        if (event.target.id === "pixModal") {
            closeModal();
        }
    }
);

document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});

document.getElementById("applyFilters").addEventListener(
    "click",
    applyFilters
);

document.getElementById("clearFilters").addEventListener("click", () => {
    document.getElementById("studentFilter").value = "";
    document.getElementById("billNameFilter").value = "";
    document.getElementById("monthFilter").value = "";
    document.getElementById("yearFilter").value = "";
    document.getElementById("typeFilter").value = "";

    selectedStatus = "pending";

    document.querySelectorAll("[data-status-filter]").forEach(button => {
        const isActive = button.dataset.statusFilter === "pending";

        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });

    applyFilters();
});

document.getElementById("pageButtons").addEventListener(
    "click",
    event => {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) {
            return;
        }

        currentPage = Number(button.dataset.page);

        renderTable();
    }
);

/**
 * Inicialização.
 */
renderSummary();
setupStudentFilter();
setupBillNameFilter();
setupYearFilter();
applyFilters();