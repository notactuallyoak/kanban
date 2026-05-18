const COLS = [
    { id: "Todo", accent: "#8B8CF8", light: "rgba(139,140,248,0.1)" },
    { id: "Doing", accent: "#F5A623", light: "rgba(245,166,35,0.1)" },
    { id: "Done", accent: "#34C47C", light: "rgba(52,196,124,0.1)" },
    ];

    let projects = {}; // { id: { name, tasks: [{id,text,col}] } }
    let activeId = null;
    let dragId = null;
    let uid = Date.now();

    // ── Storage ──
    function save() {
    localStorage.setItem("kanban_projects", JSON.stringify(projects));
    }
    function load() {
    const raw = localStorage.getItem("kanban_projects");
    if (raw) projects = JSON.parse(raw);
    }

    // ── Sidebar ──
    function renderSidebar() {
    const list = document.getElementById("proj-list");
    list.innerHTML = "";
    Object.entries(projects).forEach(([id, p]) => {
        const btn = document.createElement("button");
        btn.className = "proj-btn" + (id === activeId ? " active" : "");
        btn.innerHTML = `<span class="proj-name">${esc(p.name)}</span><span class="del-proj" title="Delete">×</span>`;
        btn.querySelector(".proj-name").onclick = () => {
        activeId = id;
        render();
        };
        btn.querySelector(".del-proj").onclick = (e) => {
        e.stopPropagation();
        deleteProject(id);
        };
        list.appendChild(btn);
    });
    }

    function newProject() {
    const name = prompt("Project name:", "Untitled board");
    if (!name) return;
    const id = "p" + uid++;
    projects[id] = { name: name.trim(), tasks: [] };
    activeId = id;
    save();
    render();
    }

    function deleteProject(id) {
    if (!confirm(`Delete "${projects[id].name}"?`)) return;
    delete projects[id];
    if (activeId === id) activeId = Object.keys(projects)[0] || null;
    save();
    render();
    }

    // ── Board ──
    function getProject() {
    return activeId ? projects[activeId] : null;
    }

    function renderBoard() {
    const main = document.getElementById("main");
    const p = getProject();
    if (!p) {
        main.innerHTML = `<div id="empty-state">Select or create a project →</div>`;
        return;
    }

    main.innerHTML = `
<div id="board-header">
    <input id="board-title" value="${esc(p.name)}" placeholder="Board name" />
    <span id="task-count">${p.tasks.length} task${p.tasks.length !== 1 ? "s" : ""}</span>
</div>
<div id="input-row">
    <input id="task-input" placeholder="What needs to be done?" />
    <button id="add-btn">Add</button>
</div>
<div id="columns"></div>
`;

    document
        .getElementById("board-title")
        .addEventListener("input", (e) => {
        projects[activeId].name = e.target.value || "Untitled";
        save();
        renderSidebar();
        });

    document
        .getElementById("task-input")
        .addEventListener("keydown", (e) => e.key === "Enter" && addTask());
    document.getElementById("add-btn").addEventListener("click", addTask);

    renderColumns();
    }

    function renderColumns() {
    const p = getProject();
    const container = document.getElementById("columns");
    if (!container) return;
    container.innerHTML = "";

    COLS.forEach((col) => {
        const tasks = p.tasks.filter((t) => t.col === col.id);
        const div = document.createElement("div");
        div.className = "col";
        div.dataset.col = col.id;
        div.style.setProperty("--accent", col.accent);
        div.style.setProperty("--accent-light", col.light);

        div.innerHTML = `
    <div class="col-header">
    <div class="col-dot"></div>
    <span class="col-label">${col.id}</span>
    <span class="col-count">${tasks.length}</span>
    </div>
    <div class="col-divider"></div>
    <div class="col-tasks" id="tasks-${col.id}">
    ${
        tasks.length === 0
        ? `<p class="col-empty">${col.id === "Todo" ? "Add a task above" : "Drop here"}</p>`
        : tasks.map((t) => taskHTML(t, col)).join("")
    }
    </div>
    ${
    tasks.length > 0
        ? `<div class="move-btns">${COLS.filter((c) => c.id !== col.id)
            .map(
            (target) =>
                `<button class="move-btn" style="background:${target.accent}22;color:${target.accent}"
        onclick="moveFirst('${col.id}','${target.id}')">→ Move to ${target.id}</button>`,
            )
            .join("")}</div>`
        : ""
    }
`;

        // Drag events on column
        div.addEventListener("dragover", (e) => {
        e.preventDefault();
        div.classList.add("drag-over");
        });
        div.addEventListener("dragleave", () =>
        div.classList.remove("drag-over"),
        );
        div.addEventListener("drop", () => {
        div.classList.remove("drag-over");
        if (dragId) moveTask(dragId, col.id);
        });

        container.appendChild(div);
    });

    // Drag events on tasks
    document.querySelectorAll(".task").forEach((el) => {
        el.addEventListener("dragstart", () => {
        dragId = +el.dataset.id;
        el.classList.add("dragging");
        });
        el.addEventListener("dragend", () => {
        dragId = null;
        el.classList.remove("dragging");
        });
    });
    }

    function taskHTML(t, col) {
    return `<div class="task ${col.id === "Done" ? "done" : ""}" draggable="true" data-id="${t.id}">
<span class="task-text">${esc(t.text)}</span>
<button class="del" onclick="delTask(${t.id})" title="Delete">×</button>
</div>`;
    }

    function addTask() {
    const inp = document.getElementById("task-input");
    const txt = inp.value.trim();
    if (!txt || !activeId) return;
    projects[activeId].tasks.push({ id: uid++, text: txt, col: "Todo" });
    inp.value = "";
    save();
    renderBoard();
    }

    function delTask(id) {
    projects[activeId].tasks = projects[activeId].tasks.filter(
        (t) => t.id !== id,
    );
    save();
    renderBoard();
    }

    function moveTask(id, col) {
    const t = projects[activeId].tasks.find((t) => t.id === id);
    if (t) {
        t.col = col;
        save();
        renderBoard();
    }
    }

    function moveFirst(fromCol, toCol) {
    const t = projects[activeId].tasks.find((t) => t.col === fromCol);
    if (t) {
        t.col = toCol;
        save();
        renderBoard();
    }
    }

    // ── Export / Import ──
    function exportBoard() {
    const p = getProject();
    if (!p) return alert("No project selected.");
    const blob = new Blob([JSON.stringify(p, null, 2)], {
        type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (p.name.replace(/[^a-z0-9]/gi, "_") || "board") + ".json";
    a.click();
    }

    function importBoard(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
        const p = JSON.parse(ev.target.result);
        if (!p.name || !Array.isArray(p.tasks)) throw new Error();
        const id = "p" + uid++;
        projects[id] = p;
        activeId = id;
        save();
        render();
        } catch {
        alert("Invalid board file.");
        }
    };
    reader.readAsText(file);
    e.target.value = "";
    }

    // ── Utils ──
    function esc(s) {
    return String(s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function render() {
    renderSidebar();
    renderBoard();
    }

    // ── Init ──
    load();
    document.getElementById("new-proj-btn").onclick = newProject;
    if (Object.keys(projects).length > 0) activeId = Object.keys(projects)[0];
    render();