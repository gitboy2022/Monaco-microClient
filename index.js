let editor, diffEditor, tabs = [], activeTabId = null;

require.config({ paths: { 'vs': './vs' } });
require(['vs/editor/editor.main'], function () {
    initEditor();
    setupShortcuts();
    setupLanguageMenu();
    addNewTab("untitled.txt");
    setInterval(autoSaveProcess, 10000);
});

function initEditor() {
    const monacoRoot = document.getElementById('monaco-root');
    const diffRoot = document.createElement('div');
    diffRoot.id = 'diff-root';
    diffRoot.style.display = 'none';
    diffRoot.style.height = '100%';
    diffRoot.style.width = '100%';
    diffRoot.style.flex = '1';
    monacoRoot.insertAdjacentElement('afterend', diffRoot);

    editor = monaco.editor.create(monacoRoot, {
        theme: 'vs-dark',
        automaticLayout: true,
        fontSize: 14,
        tabSize: 4,
        wordWrap: 'off',
        minimap: { enabled: true, side: 'right' } // Forced unremovable minimap
    });

    diffEditor = monaco.editor.createDiffEditor(diffRoot, {
        theme: 'vs-dark',
        automaticLayout: true,
        readOnly: false,
        originalEditable: true,
        renderSideBySide: true,
        scrollbar: { useShadows: false, verticalHasArrows: false, horizontalHasArrows: false }
    });

    editor.onDidChangeCursorPosition(e => {
        document.getElementById('cursor-pos').innerText = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    });
}

function setupShortcuts() {
    const cmd = monaco.KeyMod.CtrlCmd;
    editor.addCommand(cmd | monaco.KeyCode.KeyS, () => adaptiveSave());
    editor.addCommand(cmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => saveFileAs());
    editor.addCommand(cmd | monaco.KeyCode.KeyO, () => openFile());
    editor.addCommand(cmd | monaco.KeyCode.KeyN, () => addNewTab());
    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
        editor.getAction('editor.action.formatDocument').run();
    });
}

function setupLanguageMenu() {
    const menu = document.getElementById('lang-menu');
    monaco.languages.getLanguages().sort((a, b) => a.id.localeCompare(b.id)).forEach(lang => {
        const div = document.createElement('div');
        div.className = 'dropdown-item';
        div.innerText = lang.id;
        div.onclick = (e) => { e.stopPropagation(); setLanguage(lang.id); };
        menu.appendChild(div);
    });
}

function updateWordWrap() {
    const isWrapped = document.getElementById('word-wrap').checked;
    const options = { wordWrap: isWrapped ? 'on' : 'off' };
    const current = tabs.find(t => t.id === activeTabId);
    if (current && current.isDiff) {
        diffEditor.updateOptions(options);
    } else {
        editor.updateOptions(options);
    }
}

function addNewTab(name = "untitled.txt", content = "", language = "plaintext", handle = null) {
    const id = 'tab-' + Date.now();
    const model = monaco.editor.createModel(content, language);
    model.onDidChangeContent(() => {
        const tab = tabs.find(t => t.id === id);
        if (tab) tab.dirty = true;
        if (activeTabId === id) document.getElementById('dirty-indicator').style.display = 'inline';
    });
    tabs.push({ id, name, model, viewState: null, handle, dirty: false });
    switchTab(id);
}

function switchTab(id) {
    const current = tabs.find(t => t.id === activeTabId);
    if (current) {
        if (current.isDiff) {
            current.viewState = diffEditor.saveViewState();
        } else {
            current.viewState = editor.saveViewState();
        }
    }

    activeTabId = id;
    const target = tabs.find(t => t.id === id);

    if (target.isDiff) {
        document.getElementById('monaco-root').style.display = 'none';
        document.getElementById('diff-root').style.display = 'block';
        diffEditor.setModel({ original: target.originalModel, modified: target.modifiedModel });
        if (target.viewState) diffEditor.restoreViewState(target.viewState);
    } else {
        document.getElementById('diff-root').style.display = 'none';
        document.getElementById('monaco-root').style.display = 'block';
        editor.setModel(target.model);
        if (target.viewState) editor.restoreViewState(target.viewState);
    }

    updateUIForTab(target);
}

function updateUIForTab(tab) {
    document.getElementById('sb-filename').innerText = tab.name;
    document.getElementById('lang-display').innerText = tab.isDiff ? tab.modifiedModel.getLanguageId() : tab.model.getLanguageId();
    document.getElementById('dirty-indicator').style.display = tab.dirty ? 'inline' : 'none';
    renderTabs();
}

function renderTabs() {
    const container = document.getElementById('tabs-list');
    container.innerHTML = tabs.map(t => `
            <div class="tab ${t.id === activeTabId ? 'active' : ''}" onclick="switchTab('${t.id}')">
                <span>${t.name}</span>
                <span class="close-tab" onclick="closeTab('${t.id}', event)">×</span>
            </div>`).join('');
}

function closeTab(id, event) {
    event.stopPropagation();
    if (tabs.length === 1) return;
    const idx = tabs.findIndex(t => t.id === id);
    const [removed] = tabs.splice(idx, 1);
    if (removed.isDiff) {
        removed.originalModel.dispose();
        removed.modifiedModel.dispose();
    } else {
        removed.model.dispose();
    }
    switchTab(tabs[idx] ? tabs[idx].id : tabs[idx - 1].id);
}

async function adaptiveSave() {
    const current = tabs.find(t => t.id === activeTabId);
    if (!current || current.isDiff) return;
    if (!current.handle) return saveFileAs("untitled.txt");
    if (document.getElementById('format-on-save').checked) {
        await editor.getAction('editor.action.formatDocument').run();
    }
    try {
        const writable = await current.handle.createWritable();
        await writable.write(editor.getValue());
        await writable.close();
        current.dirty = false;
        document.getElementById('dirty-indicator').style.display = 'none';
    } catch (e) { console.error("Save Error", e); }
}

async function autoSaveProcess() {
    if (!document.getElementById('auto-save-toggle').checked) return;
    for (let tab of tabs) {
        if (tab.dirty && tab.handle && !tab.isDiff) {
            try {
                const writable = await tab.handle.createWritable();
                await writable.write(tab.model.getValue());
                await writable.close();
                tab.dirty = false;
                if (tab.id === activeTabId) document.getElementById('dirty-indicator').style.display = 'none';
            } catch (e) { }
        }
    }
}

async function saveFileAs(suggestedName) {
    const current = tabs.find(t => t.id === activeTabId);
    if (!current || current.isDiff) return;
    try {
        const handle = await window.showSaveFilePicker({ suggestedName: suggestedName || current.name });
        current.handle = handle;
        current.name = handle.name;
        await adaptiveSave();
        switchTab(current.id);
    } catch (e) { }
}

async function openFile() {
    try {
        const [handle] = await window.showOpenFilePicker();
        const file = await handle.getFile();
        addNewTab(file.name, await file.text(), undefined, handle);
    } catch (e) { }
}

function setLanguage(lang) {
    const current = tabs.find(t => t.id === activeTabId);
    if (!current) return;
    if (current.isDiff) {
        monaco.editor.setModelLanguage(current.originalModel, lang);
        monaco.editor.setModelLanguage(current.modifiedModel, lang);
    } else {
        monaco.editor.setModelLanguage(current.model, lang);
    }
    document.getElementById('lang-display').innerText = lang;
}

function toggleMenu(e, id) {
    e.stopPropagation();
    document.querySelectorAll('.status-item').forEach(i => i.classList.remove('active-menu'));
    document.getElementById(id).parentElement.classList.add('active-menu');
}

function setIndent(val) {
    const size = parseInt(val);
    if (size > 0) {
        editor.updateOptions({ tabSize: size });
        document.getElementById('indent-display').innerText = `Spaces: ${size}`;
    }
}

function openDifferenceViewer() {
    const current = tabs.find(t => t.id === activeTabId);
    if (!current || current.isDiff) return;

    const diffTabName = `Diff: ${current.name}`;
    const existing = tabs.find(t => t.isDiff && t.name === diffTabName);
    if (existing) {
        return switchTab(existing.id);
    }

    const id = 'tab-' + Date.now();
    const originalModel = monaco.editor.createModel(current.model.getValue(), current.model.getLanguageId());
    const modifiedModel = monaco.editor.createModel(current.model.getValue(), current.model.getLanguageId());
    tabs.push({
        id,
        name: diffTabName,
        isDiff: true,
        originalModel,
        modifiedModel,
        viewState: null,
        dirty: false
    });
    switchTab(id);
}

window.onclick = () => document.querySelectorAll('.status-item').forEach(i => i.classList.remove('active-menu'));
