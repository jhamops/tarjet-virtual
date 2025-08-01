import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, onSnapshot, query } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

let db, auth;
let userId = null;
let currentCard = null;
let savedCards = [];
let selectedComponentId = null;

const COMPONENT_TYPES = {
    heading: { name: 'Nombre y Cargo', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path><line x1="4" y1="21" x2="20" y2="21"></line></svg>' },
    text: { name: 'Biografía/Texto', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>' },
    image: { name: 'Foto de Perfil', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>' },
    button: { name: 'Botón (Contacto)', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8z"></path><path d="M12 12v-1"></path></svg>' },
    socials: { name: 'Redes Sociales', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>' }
};

const views = {
    landing: document.getElementById('landing-page-view'),
    selector: document.getElementById('template-selector-view'),
    editor: document.getElementById('editor-view'),
};
const canvasContainer = document.getElementById('canvas-container');
const propertiesPanelContainer = document.getElementById('properties-panel-container');
const savedCardsContainer = document.getElementById('saved-cards-container');
const cardNameInput = document.getElementById('card-name-input');
const userIdDisplay = document.getElementById('user-id-display');


function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.add('hidden'));
    if (views[viewName]) {
        views[viewName].classList.remove('hidden');
    }
}

function renderApp() {
    if (currentCard) {
        renderEditor();
        switchView('editor');
    } else {
        renderTemplateSelector();
        switchView('selector');
    }
}

function renderTemplateSelector() {
    savedCardsContainer.innerHTML = '';
    if (savedCards.length > 0) {
        savedCards.forEach(card => {
            const button = document.createElement('button');
            button.className = 'w-full text-left p-3 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors';
            button.textContent = card.name || 'Perfil sin nombre';
            button.onclick = () => handleLoadCard(card.id);
            savedCardsContainer.appendChild(button);
        });
    } else {
        savedCardsContainer.innerHTML = '<p class="text-gray-500">No tienes perfiles guardados.</p>';
    }
}

function renderEditor() {
    cardNameInput.value = currentCard.name;
    renderCanvas();
    renderPropertiesPanel();
}

function renderCanvas() {
    canvasContainer.innerHTML = ''; // Limpiar contenedor principal

    const cardWrapper = document.createElement('div');
    cardWrapper.style.backgroundColor = currentCard.backgroundColor || '#ffffff';

    const profileImageComponent = currentCard.components.find(c => c.type === 'image');
    const headingComponent = currentCard.components.find(c => c.type === 'heading');
    const textComponent = currentCard.components.find(c => c.type === 'text');
    const socialsComponent = currentCard.components.find(c => c.type === 'socials');

    let headerHTML = `
                <div class="bg-blue-600 h-24 relative">
                    ${profileImageComponent ? `<img src="${profileImageComponent.properties.src || 'https://placehold.co/100x100/e2e8f0/cbd5e0?text=Foto'}" class="w-24 h-24 rounded-full border-4 border-white absolute -bottom-12 left-1/2 -translate-x-1/2 cursor-pointer" onclick="setSelectedComponentId(${profileImageComponent.id})">` : ''}
                </div>
            `;

    let bodyHTML = `<div class="pt-16 p-6 text-center">`;
    if (headingComponent) {
        bodyHTML += `<h2 class="text-2xl font-bold cursor-pointer text-gray-800" onclick="setSelectedComponentId(${headingComponent.id})">${headingComponent.properties.text || 'Tu Nombre'}</h2>`;
    }
    if (textComponent) {
        bodyHTML += `<p class="text-gray-600 cursor-pointer" onclick="setSelectedComponentId(${textComponent.id})">${textComponent.properties.text || 'Tu Cargo en Tu Empresa'}</p>`;
    }
    bodyHTML += `</div>`;

    let componentsHTML = `<div class="px-6 pb-6 space-y-4">`;
    currentCard.components.filter(c => !['image', 'heading', 'text', 'socials'].includes(c.type)).forEach(component => {
        componentsHTML += renderComponent(component);
    });
    if (socialsComponent) {
        componentsHTML += renderComponent(socialsComponent);
    }
    componentsHTML += `</div>`;

    let qrHTML = `
                <div class="bg-gray-100 p-4 flex flex-col items-center gap-2">
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=https://example.com/${userId}/${currentCard.id || ''}" alt="QR Code">
                    <p class="text-sm text-gray-600">Escanea para conectar</p>
                </div>
            `;

    cardWrapper.innerHTML = headerHTML + bodyHTML + componentsHTML + qrHTML;
    canvasContainer.appendChild(cardWrapper);
}

function renderComponent(component) {
    const isSelected = component.id === selectedComponentId;
    let elementHTML = '';
    const wrapperClass = `component-wrapper ${isSelected ? 'ring-2 ring-blue-500 rounded-lg' : 'hover:ring-2 hover:ring-blue-200 rounded-lg'}`;

    switch (component.type) {
        case 'button':
            elementHTML = `<div class="${wrapperClass}" onclick="setSelectedComponentId(${component.id})"><button class="w-full font-bold py-2 px-4 rounded-lg cursor-pointer" style="background-color: ${component.properties.bgColor || '#3b82f6'}; color: ${component.properties.textColor || '#ffffff'}">${component.properties.text || 'Contactar'}</button></div>`;
            break;
        case 'socials':
            const p = component.properties;
            elementHTML += `<div class="flex justify-center gap-4 p-2 ${wrapperClass}" onclick="setSelectedComponentId(${component.id})">`;
            if (p.linkedin) elementHTML += `<a href="${p.linkedin}" target="_blank"><svg class="w-6 h-6 text-gray-600 hover:text-blue-700" fill="currentColor" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg></a>`;
            if (p.twitter) elementHTML += `<a href="${p.twitter}" target="_blank"><svg class="w-6 h-6 text-gray-600 hover:text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-.424.727-.666 1.581-.666 2.477 0 1.69.86 3.178 2.158 4.049-.802-.026-1.55-.248-2.2-.608v.064c0 2.358 1.678 4.322 3.898 4.774-.407.111-.838.171-1.28.171-.314 0-.618-.031-.926-.087.618 1.932 2.413 3.338 4.545 3.375-1.667 1.305-3.772 2.085-6.053 2.085-.394 0-.782-.023-1.164-.067 2.153 1.386 4.703 2.193 7.423 2.193 8.907 0 13.788-7.373 13.788-13.788 0-.21 0-.419-.014-.627.947-.684 1.77-1.536 2.427-2.517z"/></svg></a>`;
            if (p.instagram) elementHTML += `<a href="${p.instagram}" target="_blank"><svg class="w-6 h-6 text-gray-600 hover:text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.85s-.012 3.584-.07 4.85c-.148 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07s-3.584-.012-4.85-.07c-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.85s.012-3.584.07-4.85c.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.85-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948s.014 3.667.072 4.947c.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072s3.667-.014 4.947-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.947s-.014-3.667-.072-4.947c-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.072-4.948-.072zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.162 6.162 6.162 6.162-2.759 6.162-6.162-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4 4 1.79 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44 1.441-.645 1.441-1.44-.645-1.44-1.441-1.44z"/></svg></a>`;
            if (p.github) elementHTML += `<a href="${p.github}" target="_blank"><svg class="w-6 h-6 text-gray-600 hover:text-gray-900" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg></a>`;
            elementHTML += `</div>`;
            break;
    }
    return elementHTML;
}

function renderPropertiesPanel() {
    const selectedComponent = currentCard?.components.find(c => c.id === selectedComponentId);
    propertiesPanelContainer.innerHTML = '';

    let content = '<h3 class="text-lg font-semibold mb-4 text-gray-800">Propiedades</h3>';

    if (selectedComponent) {
        content += '<div class="mb-6 pb-6 border-b"><h4 class="font-semibold text-md mb-2 text-gray-800">Propiedades del Componente</h4>';

        switch (selectedComponent.type) {
            case 'heading':
                content += createTextInput('text', 'Nombre Completo', selectedComponent.properties.text || '');
                break;
            case 'text':
                content += createTextareaInput('text', 'Cargo y Empresa', selectedComponent.properties.text || '');
                break;
            case 'image':
                content += createTextInput('src', 'URL de tu Foto', selectedComponent.properties.src || '');
                break;
            case 'button':
                content += createTextInput('text', 'Texto del Botón', selectedComponent.properties.text || '');
                content += createColorInput('bgColor', 'Color de Fondo', selectedComponent.properties.bgColor || '#3b82f6');
                content += createColorInput('textColor', 'Color de Texto', selectedComponent.properties.textColor || '#ffffff');
                break;
            case 'socials':
                content += createTextInput('linkedin', 'URL de LinkedIn', selectedComponent.properties.linkedin || '');
                content += createTextInput('twitter', 'URL de Twitter/X', selectedComponent.properties.twitter || '');
                content += createTextInput('instagram', 'URL de Instagram', selectedComponent.properties.instagram || '');
                content += createTextInput('github', 'URL de GitHub', selectedComponent.properties.github || '');
                break;
        }

        content += `<button id="delete-component-button" class="w-full mt-4 flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600">Eliminar Componente</button></div>`;
    } else {
        content += `<div class="text-center text-gray-500 mt-10"><p>Selecciona un componente para editar sus propiedades.</p></div>`;
    }

    content += '<div><h4 class="font-semibold text-md mb-2 text-gray-800">Diseño del Perfil</h4>';
    content += createColorInput('backgroundColor', 'Color de Fondo', currentCard?.backgroundColor || '#ffffff', true);
    content += '</div>';

    propertiesPanelContainer.innerHTML = content;
}

function createTextInput(prop, label, value, isCardProp = false) {
    const id = `prop-${prop}`;
    return `<div class="space-y-1 mb-2">
                        <label for="${id}" class="block text-sm font-medium text-gray-700">${label}</label>
                        <input type="text" id="${id}" value="${value}" oninput="handlePropertyChange('${prop}', this.value, ${isCardProp})" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-gray-800">
                    </div>`;
}
function createTextareaInput(prop, label, value) {
    const id = `prop-${prop}`;
    return `<div class="space-y-1 mb-2">
                        <label for="${id}" class="block text-sm font-medium text-gray-700">${label}</label>
                        <textarea id="${id}" oninput="handlePropertyChange('${prop}', this.value)" rows="2" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 text-gray-800">${value}</textarea>
                    </div>`;
}
function createColorInput(prop, label, value, isCardProp = false) {
    const id = `prop-${prop}`;
    return `<div class="space-y-1 mb-2">
                        <label for="${id}" class="block text-sm font-medium text-gray-700">${label}</label>
                        <input type="color" id="${id}" value="${value}" oninput="handlePropertyChange('${prop}', this.value, ${isCardProp})" class="mt-1 block w-full h-10 rounded-md border-gray-300 shadow-sm">
                    </div>`;
}

window.handleCreateNewCard = (template) => {
    currentCard = {
        id: null,
        name: 'Mi Perfil Digital',
        template: template,
        components: [
            { id: Date.now() + 1, type: 'image', properties: {} },
            { id: Date.now() + 2, type: 'heading', properties: {} },
            { id: Date.now() + 3, type: 'text', properties: {} },
            { id: Date.now() + 4, type: 'socials', properties: {} },
        ],
        backgroundColor: '#ffffff'
    };
    selectedComponentId = null;
    renderApp();
};

window.handleLoadCard = (cardId) => {
    const cardToLoad = savedCards.find(c => c.id === cardId);
    if (cardToLoad) {
        currentCard = JSON.parse(JSON.stringify(cardToLoad));
        selectedComponentId = null;
        renderApp();
    }
};

window.handleAddComponent = (type) => {
    if (!currentCard) return;
    if (['image', 'heading', 'text', 'socials'].includes(type) && currentCard.components.some(c => c.type === type)) {
        alert(`El componente '${COMPONENT_TYPES[type].name}' ya existe en el perfil.`);
        return;
    }
    const newComponent = { id: Date.now(), type, properties: {} };
    currentCard.components.push(newComponent);
    renderCanvas();
};

window.setSelectedComponentId = (id) => {
    selectedComponentId = id;
    renderPropertiesPanel();
    document.querySelectorAll('.component-wrapper, img, h2, p').forEach(el => {
        el.classList.remove('ring-2', 'ring-blue-500');
    });
    const targetElement = document.querySelector(`[onclick="setSelectedComponentId(${id})"]`);
    if (targetElement) {
        targetElement.classList.add('ring-2', 'ring-blue-500');
    }
}

window.handlePropertyChange = (property, value, isCardProperty = false) => {
    if (!currentCard) return;
    if (isCardProperty) {
        currentCard[property] = value;
    } else {
        const component = currentCard.components.find(c => c.id === selectedComponentId);
        if (component) {
            component.properties[property] = value;
        }
    }
    renderEditor();
};

async function handleSaveCard() {
    if (!db || !userId || !currentCard) {
        alert("No se puede guardar. La base de datos no está conectada.");
        return;
    }

    const cardData = { ...currentCard };
    const cardId = cardData.id;
    delete cardData.id;

    try {
        if (cardId) {
            await setDoc(doc(db, `artifacts/${appId}/users/${userId}/cards`, cardId), cardData);
        } else {
            const docRef = await addDoc(collection(db, `artifacts/${appId}/users/${userId}/cards`), cardData);
            currentCard.id = docRef.id;
        }
        alert("Perfil guardado con éxito!");
    } catch (error) {
        console.error("Error al guardar el perfil: ", error);
        alert("Hubo un error al guardar el perfil.");
    }
}

function handleDeleteComponent() {
    if (!currentCard || selectedComponentId === null) return;
    currentCard.components = currentCard.components.filter(c => c.id !== selectedComponentId);
    selectedComponentId = null;
    renderApp();
}

document.addEventListener('DOMContentLoaded', () => {
    if (firebaseConfig.apiKey) {
        const app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        onAuthStateChanged(auth, user => {
            if (user) {
                userId = user.uid;
                userIdDisplay.textContent = userId;
                const cardsCollectionPath = `artifacts/${appId}/users/${userId}/cards`;
                const q = query(collection(db, cardsCollectionPath));
                onSnapshot(q, (querySnapshot) => {
                    savedCards = [];
                    querySnapshot.forEach((doc) => {
                        savedCards.push({ id: doc.id, ...doc.data() });
                    });
                    if (!currentCard && document.getElementById('template-selector-view').classList.contains('hidden') === false) {
                        renderTemplateSelector();
                    }
                });
            } else {
                signInAnonymously(auth).catch(error => console.error("Error signing in anonymously:", error));
            }
        });
    } else {
        console.log("Configuración de Firebase no encontrada.");
        userIdDisplay.textContent = "Desconectado";
        savedCardsContainer.innerHTML = '<p class="text-gray-500">La persistencia está deshabilitada.</p>';
    }

    const addComponentsPanel = document.getElementById('add-components-panel');
    Object.keys(COMPONENT_TYPES).forEach(type => {
        const info = COMPONENT_TYPES[type];
        const button = document.createElement('button');
        button.className = 'w-full flex items-center gap-3 p-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800';
        button.innerHTML = `${info.icon} <span>${info.name}</span>`;
        button.onclick = () => handleAddComponent(type);
        addComponentsPanel.appendChild(button);
    });

    const startButtons = [document.getElementById('start-creating-btn-nav'), document.getElementById('start-creating-btn-hero'), document.getElementById('start-creating-btn-final')];
    startButtons.forEach(btn => btn.onclick = () => switchView('selector'));

    document.getElementById('home-button').onclick = () => {
        currentCard = null;
        switchView('landing');
    };

    document.getElementById('back-button').onclick = () => {
        currentCard = null;
        renderApp();
    };

    document.getElementById('save-button').onclick = handleSaveCard;
    cardNameInput.oninput = (e) => {
        if (currentCard) currentCard.name = e.target.value;
    };

    propertiesPanelContainer.addEventListener('click', (e) => {
        if (e.target.id === 'delete-component-button') {
            handleDeleteComponent();
        }
    });

    // FAQ Logic is removed as it's not in the new design based on haystack
    // ...

    switchView('landing');
});