
"use strict";

// ============================================================
// 1. CONFIGURAÇÕES
// ============================================================

const TZ = "America/Sao_Paulo";

const GOOGLE_CALENDAR_ID =
    "c_289955d02434844321f4102eeeb9aaf9201188b025255fb3483f9330e7602136@group.calendar.google.com";

// Informe aqui a chave de API criada no Google Cloud.
const GOOGLE_API_KEY = "AIzaSyD5eo942YXElyvkwo9GNe5jxpBDBPf-ftc";

const GOOGLE_CALENDAR_API =
    "https://www.googleapis.com/calendar/v3/calendars";

const DEFAULT_EVENT_COLOR = "#2f6fbd";

// ============================================================
// 2. ESTADO DOS EVENTOS E DO CALENDÁRIO
// ============================================================

let events = [];

const pad = n => String(n).padStart(2, "0");

let view = new Date();
let selected = key(new Date());

// ============================================================
// 3. ELEMENTOS E UTILITÁRIOS
// ============================================================

const $ = id => document.getElementById(id);

function key(date) {
    return [
        date.getFullYear(),
        pad(date.getMonth() + 1),
        pad(date.getDate())
    ].join("-");
}

function parseLocal(value) {
    const [datePart, timePart = "00:00:00"] = value.split("T");
    const [year, month, day] = datePart.split("-").map(Number);
    const [hour, minute, second = 0] = timePart.split(":").map(Number);

    return new Date(year, month - 1, day, hour, minute, second);
}

function normalizeDateTime(value) {
    return value.replace(/([+-]\d{2}:\d{2}|Z)$/, "");
}

function fmtDate(value) {
    return new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(parseLocal(value));
}

function fmtTime(value) {
    return new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(parseLocal(value));
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric"
});

// ============================================================
// 4. GOOGLE CALENDAR API
// ============================================================

function normalizeGoogleEvent(event) {
    const allDay = Boolean(event.start?.date);

    const start = allDay
        ? `${event.start.date}T00:00:00`
        : normalizeDateTime(event.start.dateTime);

    let end;

    if (allDay) {
        const exclusiveEnd = parseLocal(`${event.end.date}T00:00:00`);
        exclusiveEnd.setDate(exclusiveEnd.getDate() - 1);

        end = `${key(exclusiveEnd)}T23:59:00`;
    } else {
        end = normalizeDateTime(event.end.dateTime);
    }

    return {
        id: event.id,
        title: event.summary || "(Sem título)",
        start,
        end,
        location: event.location || "Não informado",
        description: event.description || "Sem descrição.",
        category: event.eventType === "birthday" ? "Aniversário" : "Evento",
        color: DEFAULT_EVENT_COLOR,
        allDay,
        htmlLink: event.htmlLink || ""
    };
}

async function fetchGoogleCalendarEvents() {
    if (
        !GOOGLE_API_KEY ||
        GOOGLE_API_KEY === "COLE_SUA_CHAVE_DE_API_AQUI"
    ) {
        throw new Error(
            "Configure sua chave de API em GOOGLE_API_KEY no arquivo agenda.js."
        );
    }

    const currentYear = new Date().getFullYear();

    const timeMin = `${currentYear - 1}-01-01T00:00:00-03:00`;
    const timeMax = `${currentYear + 3}-01-01T00:00:00-03:00`;

    let pageToken = null;
    const loadedEvents = [];

    do {
        const params = new URLSearchParams({
            key: GOOGLE_API_KEY,
            timeMin,
            timeMax,
            timeZone: TZ,
            singleEvents: "true",
            orderBy: "startTime",
            showDeleted: "false",
            maxResults: "2500"
        });

        if (pageToken) {
            params.set("pageToken", pageToken);
        }

        const url =
            `${GOOGLE_CALENDAR_API}/${encodeURIComponent(GOOGLE_CALENDAR_ID)}/events?${params}`;

        const response = await fetch(url);

        if (!response.ok) {
            let message = `Erro HTTP ${response.status} ao consultar o Google Agenda.`;

            try {
                const errorData = await response.json();
                message = errorData.error?.message || message;
            } catch (_) {
                // Mantém a mensagem HTTP caso a resposta não seja JSON.
            }

            throw new Error(message);
        }

        const data = await response.json();

        (data.items || [])
            .filter(event => event.status !== "cancelled")
            .forEach(event => loadedEvents.push(normalizeGoogleEvent(event)));

        pageToken = data.nextPageToken || null;
    } while (pageToken);

    return loadedEvents;
}

// ============================================================
// 5. INTEGRAÇÃO COM GOOGLE AGENDA: ADICIONAR EVENTO
// ============================================================

function googleDate(value) {
    return value.replaceAll("-", "").replaceAll(":", "");
}

function googleUrl(event) {
    let dates;

    if (event.allDay) {
        const startDate = event.start.slice(0, 10);
        const endDate = parseLocal(event.end);
        endDate.setDate(endDate.getDate() + 1);

        dates = `${startDate.replaceAll("-", "")}/${key(endDate).replaceAll("-", "")}`;
    } else {
        dates = `${googleDate(event.start)}/${googleDate(event.end)}`;
    }

    const params = new URLSearchParams({
        action: "TEMPLATE",
        text: event.title,
        dates,
        details: `${event.description}\n\nCódigo do evento: ${event.id}`,
        location: event.location,
        ctz: TZ
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// ============================================================
// 6. DETALHES DO EVENTO E MODAL
// ============================================================

function showDetail(event) {
    selected = key(parseLocal(event.start));

    const content = $("modal-content");
    content.replaceChildren();

    const title = document.createElement("div");
    title.className = "modal-event-title";
    title.textContent = event.title;

    const date = document.createElement("p");
    date.className = "modal-meta";
    date.textContent = `📅 ${fmtDate(event.start)}`;

    const time = document.createElement("p");
    time.className = "modal-meta";
    time.textContent = event.allDay
        ? "🕒 Dia inteiro"
        : `🕒 ${fmtTime(event.start)} – ${fmtTime(event.end)}`;

    const location = document.createElement("p");
    location.className = "modal-meta";
    location.textContent = `📍 ${event.location}`;

    const category = document.createElement("p");
    category.className = "modal-meta";
    category.textContent = `Categoria: ${event.category}`;

    const description = document.createElement("div");
    description.className = "modal-description";

    const parser = new DOMParser();
    const doc = parser.parseFromString(event.description, "text/html");

    description.appendChild(doc.body.cloneNode(true));

    content.append(title, date, time, location, category, description);

    const actions = $("modal-actions");
    actions.replaceChildren();

    const button = document.createElement("a");
    button.className = "add-button";
    button.href = googleUrl(event);
    button.target = "_blank";
    button.rel = "noopener noreferrer";
    button.innerHTML =
        '<span class="g-icon">G</span> Adicionar à minha Google Agenda';

    actions.appendChild(button);

    $("event-modal").classList.add("open");
    $("modal-close").focus();

    renderCalendar();
}

function closeModal() {
    $("event-modal").classList.remove("open");
}

// ============================================================
// 7. RENDERIZAÇÃO DO CALENDÁRIO
// ============================================================

function renderCalendar() {
    $("month-title").textContent = monthFmt
        .format(view)
        .replace(/^./, character => character.toUpperCase());

    const calendar = $("calendar");

    while (calendar.children.length > 7) {
        calendar.removeChild(calendar.lastChild);
    }

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const start = new Date(first);

    start.setDate(first.getDate() - first.getDay());

    const today = key(new Date());

    for (let i = 0; i < 42; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);

        const dateKey = key(date);
        const cell = document.createElement("div");

        cell.className = "day";

        if (date.getMonth() !== view.getMonth()) {
            cell.classList.add("outside");
        }

        if (dateKey === today) {
            cell.classList.add("today");
        }

        if (dateKey === selected) {
            cell.classList.add("selected");
        }

        const number = document.createElement("div");
        number.className = "day-number";
        number.textContent = date.getDate();

        cell.appendChild(number);

        const dayEvents = events
            .filter(event => key(parseLocal(event.start)) === dateKey)
            .sort((a, b) => a.start.localeCompare(b.start));

        // Exibe no máximo três eventos por dia.
        dayEvents.slice(0, 3).forEach(event => {
            const pill = document.createElement("button");

            pill.className = "event-pill";
            pill.style.background = event.color;
            pill.textContent = event.allDay
                ? event.title
                : `${fmtTime(event.start)} ${event.title}`;
            pill.title = event.title;

            pill.addEventListener("click", clickEvent => {
                clickEvent.stopPropagation();
                showDetail(event);
            });

            cell.appendChild(pill);
        });

        // Indicador de eventos adicionais.
        if (dayEvents.length > 3) {
            const more = document.createElement("div");

            more.className = "more-events";
            more.textContent = `+${dayEvents.length - 3} eventos`;

            cell.appendChild(more);
        }

        // Seleção do dia.
        cell.addEventListener("click", () => {
            selected = dateKey;
            renderCalendar();

            if (dayEvents.length) {
                showDetail(dayEvents[0]);
            } else {
                $("selected-date").textContent =
                    new Intl.DateTimeFormat("pt-BR", {
                        dateStyle: "full"
                    }).format(date);

                $("event-detail").className = "detail-empty";
                $("event-detail").textContent =
                    "Nenhum evento cadastrado para este dia.";
            }
        });

        calendar.appendChild(cell);
    }
}

// ============================================================
// 8. RENDERIZAÇÃO DA LISTA DE PRÓXIMOS EVENTOS
// ============================================================

function renderUpcoming() {
    const box = $("upcoming");
    box.replaceChildren();

    const today = new Date();
    const next30Days = new Date();

    next30Days.setDate(today.getDate() + 30);
    next30Days.setHours(23, 59, 59, 999);

    const upcomingEvents = events
        .filter(event => {
            const eventDate = parseLocal(event.start);

            return eventDate >= today && eventDate <= next30Days;
        })
        .slice()
        .sort((a, b) => a.start.localeCompare(b.start));

    if (!upcomingEvents.length) {
        const empty = document.createElement("p");
        empty.className = "detail-empty";
        empty.textContent = "Nenhum evento futuro encontrado.";

        box.appendChild(empty);
        return;
    }

    upcomingEvents.forEach(event => {
        const row = document.createElement("div");

        row.className = "list-event";
        row.tabIndex = 0;

        const dateTime = parseLocal(event.start);

        const date = document.createElement("div");
        date.className = "date-box";

        const day = document.createElement("strong");
        day.textContent = pad(dateTime.getDate());

        const month = document.createElement("span");
        month.textContent = new Intl.DateTimeFormat("pt-BR", {
            month: "short"
        }).format(dateTime).replace(".", "");

        date.append(day, month);

        const info = document.createElement("div");
        info.className = "list-info";

        const title = document.createElement("strong");
        title.textContent = event.title;

        const small = document.createElement("small");
        small.textContent = event.allDay
            ? `Dia inteiro · ${event.category}`
            : `${fmtTime(event.start)} · ${event.category}`;

        info.append(title, small);
        row.append(date, info);

        // Clique no evento.
        row.addEventListener("click", () => {
            view = new Date(
                dateTime.getFullYear(),
                dateTime.getMonth(),
                1
            );

            showDetail(event);
        });

        // Navegação por teclado.
        row.addEventListener("keydown", keyEvent => {
            if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();

                view = new Date(
                    dateTime.getFullYear(),
                    dateTime.getMonth(),
                    1
                );

                showDetail(event);
            }
        });

        box.appendChild(row);
    });
}

// ============================================================
// 9. NAVEGAÇÃO ENTRE MESES
// ============================================================

$("prev").addEventListener("click", () => {
    view.setMonth(view.getMonth() - 1);
    renderCalendar();
});

$("next").addEventListener("click", () => {
    view.setMonth(view.getMonth() + 1);
    renderCalendar();
});

$("today").addEventListener("click", () => {
    view = new Date();
    selected = key(new Date());

    renderCalendar();
});

// ============================================================
// 10. EVENTOS DO MODAL
// ============================================================

// Botão de fechar.
$("modal-close").addEventListener("click", closeModal);

// Fechar ao clicar fora do conteúdo.
$("event-modal").addEventListener("click", event => {
    if (event.target === $("event-modal")) {
        closeModal();
    }
});

// Fechar ao pressionar ESC.
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        closeModal();
    }
});

// ============================================================
// 11. INICIALIZAÇÃO E CARREGAMENTO DOS EVENTOS
// ============================================================

async function initializeCalendar() {
    const upcoming = $("upcoming");

    upcoming.replaceChildren();

    const loading = document.createElement("p");
    loading.className = "detail-empty";
    loading.textContent = "Carregando eventos da Google Agenda...";

    upcoming.appendChild(loading);

    try {
        events = await fetchGoogleCalendarEvents();

        renderUpcoming();
        renderCalendar();
    } catch (error) {
        console.error("Erro ao carregar eventos do Google Agenda:", error);

        upcoming.replaceChildren();

        const errorMessage = document.createElement("p");
        errorMessage.className = "detail-empty";
        errorMessage.textContent =
            `Não foi possível carregar os eventos: ${error.message}`;

        upcoming.appendChild(errorMessage);

        // Mantém o calendário visível, mesmo quando a API falha.
        renderCalendar();
    }
}

initializeCalendar();
