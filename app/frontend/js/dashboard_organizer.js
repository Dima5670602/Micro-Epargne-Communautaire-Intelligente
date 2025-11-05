const API_BASE = window.API_BASE_URL || "";
let dashboardInitialized = false;
let myTontines = [];
let myCorridors = [];
let pendingRequests = [];
let conversations = [];
let currentConversationUserId = null;
let currentConversationTontineId = null;
let currentConversationMessages = [];

// Fonction utilitaire pour les appels API
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem("mec_token");
  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token,
    ...options.headers
  };

  try {
    const response = await fetch(API_BASE + endpoint, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Erreur serveur" }));
      throw new Error(error.message || "Erreur API");
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur API fetch:', error);
    throw error;
  }
}

// Échappement HTML
function escapeHtml(s){ 
  if(!s) return ""; 
  return String(s).replace(/[&<>"']/g, m => ({ 
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' 
  })[m]); 
}

// Formatage monétaire
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', { 
    style: 'currency', 
    currency: 'XOF',
    minimumFractionDigits: 0 
  }).format(amount || 0);
}

// Gestionnaire d'erreurs amélioré
function handleError(context, error, userMessage = null) {
  console.error(`Erreur ${context}:`, error);
  
  // Gestion des erreurs d'authentification
  if (error.message.includes('token') || error.message.includes('authentification') || error.message.includes('401')) {
    localStorage.removeItem("mec_token");
    localStorage.removeItem("mec_role");
    window.location.href = "login.html";
    return;
  }
  
  const message = userMessage || error.message || `Erreur lors de ${context}`;
  showNotification(message, 'error');
}

// Système de notification amélioré
function showNotification(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer') || createToastContainer();
  const toastId = 'toast-' + Date.now();
  
  const icon = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
  const bgClass = type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary';
  
  const toastHtml = `
    <div id="${toastId}" class="toast align-items-center text-bg-${bgClass} border-0" role="alert">
      <div class="d-flex">
        <div class="toast-body">
          ${icon} ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
      </div>
    </div>
  `;
  
  toastContainer.insertAdjacentHTML('beforeend', toastHtml);
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
  toast.show();
  
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

function createToastContainer() {
  const container = document.createElement('div');
  container.id = 'toastContainer';
  container.className = 'toast-container position-fixed top-0 end-0 p-3';
  container.style.zIndex = '9999';
  document.body.appendChild(container);
  return container;
}

// Fonction pour changer d'onglet
function showTab(tabId) {
  const tabElement = document.querySelector(`#dashboardTabs a[href="#${tabId}"]`);
  if (tabElement) {
    const tab = new bootstrap.Tab(tabElement);
    tab.show();
  }
}

// FONCTIONS PRINCIPALES

// Initialisation Dashboard Organisateur
async function loadOrganizerDashboard(){
  if (dashboardInitialized) return;
  
  try {
    // Vérifier le rôle
    const role = localStorage.getItem("mec_role");
    if (role !== "organisateur") {
      window.location.href = "login.html";
      return;
    }

    // Charger les données principales
    await Promise.allSettled([
      loadTontines().catch(err => handleError('tontines', err)),
      loadCorridors().catch(err => handleError('corridors', err)),
      loadPendingRequests().catch(err => handleError('pending requests', err)),
      loadConversations().catch(err => handleError('conversations', err)),
      loadTotalBalance().catch(err => handleError('total balance', err))
    ]);

    dashboardInitialized = true;
    console.log(" Dashboard organisateur initialisé");
    
  } catch(err) { 
    handleError('loadOrganizerDashboard', err, 'Impossible de charger le dashboard. Réessayez.');
  }
}

// Gestion des Tontines
async function loadTontines() {
  try {
    const res = await apiFetch("/api/tontines");
    myTontines = res.data || [];
    
    // Mettre à jour les compteurs
    document.getElementById('tontinesCount').textContent = myTontines.length;
    document.getElementById('totalTontines').textContent = myTontines.length;
    document.getElementById('overviewActiveTontines').textContent = myTontines.length;
    
    // Mettre à jour l'affichage
    renderTontines();
    renderActiveTontines();
    updateTontineSelects();
    
  } catch (err) {
    handleError('loadTontines', err);
  }
}

function renderTontines() {
  const container = document.getElementById("tontinesList");
  if (!container) return;
  
  if (myTontines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-piggy-bank"></i>
        <div>Aucune tontine créée</div>
        <small class="text-muted">Vos tontines apparaîtront ici</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = myTontines.map(t => `
    <div class="border rounded p-3 mb-3">
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>${escapeHtml(t.name)}</strong>
              ${t.description ? `<div class="small-muted mt-1">${escapeHtml(t.description)}</div>` : ''}
              <div class="small-muted mt-1">
                <i class="bi bi-calendar"></i> ${t.date ? t.date.split("T")[0] : "Non définie"}
                ${t.bareme ? ` • <i class="bi bi-currency-exchange"></i> ${t.bareme} XOF` : ''}
              </div>
            </div>
            <div class="text-end">
              <span class="badge bg-success">Active</span>
            </div>
          </div>
          
          ${t.token ? `
          <div class="mt-3 card-token p-2 rounded">
            <div class="d-flex justify-content-between align-items-center">
              <div>
                <small class="text-muted">Token d'accès:</small>
                <div><code class="fs-6">${t.token}</code></div>
              </div>
              <div class="d-flex gap-1">
                <button class="btn btn-sm btn-outline-primary" onclick="copyToken('${t.token}')">
                  <i class="bi bi-copy"></i>
                </button>
                <button class="btn btn-sm btn-outline-info" onclick="showTontineDetails(${t.id})">
                  <i class="bi bi-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTontine(${t.id})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
    </div>
  `).join("");
}

function renderActiveTontines() {
  const container = document.getElementById("activeTontinesGrid");
  if (!container) return;
  
  if (myTontines.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-piggy-bank"></i>
        <div>Aucune tontine active</div>
        <small class="text-muted">Créez votre première tontine pour commencer</small>
      </div>
    `;
    return;
  }
  
  const activeTontines = myTontines.slice(0, 6);
  
  container.innerHTML = activeTontines.map(tontine => `
    <div class="tontine-card" onclick="openTontineDetails(${tontine.id})">
      <div class="d-flex justify-content-between align-items-start">
        <div>
          <h6 class="mb-2">${escapeHtml(tontine.name)}</h6>
          <div class="small text-muted">
            <i class="bi bi-currency-exchange"></i> ${tontine.bareme || 0} XOF
          </div>
          <div class="small text-muted">
            <i class="bi bi-calendar"></i> ${tontine.date ? tontine.date.split("T")[0] : "Non définie"}
          </div>
        </div>
        <span class="badge bg-success">Active</span>
      </div>
      
      <div class="stats-mini">
        <div class="stat-mini">
          <div class="stat-mini-value">${tontine.participants_count || 0}</div>
          <div class="stat-mini-label">Participants</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-value">${tontine.completed_payments || 0}</div>
          <div class="stat-mini-label">Payés</div>
        </div>
        <div class="stat-mini">
          <div class="stat-mini-value">${tontine.current_balance || 0}</div>
          <div class="stat-mini-label">XOF</div>
        </div>
      </div>
      
      <div class="mt-2">
        <button class="btn btn-sm btn-outline-primary w-100" onclick="event.stopPropagation(); manageTontineParticipants(${tontine.id})">
          <i class="bi bi-people"></i> Gérer
        </button>
      </div>
    </div>
  `).join("");
  
  if (myTontines.length > 6) {
    container.innerHTML += `
      <div class="tontine-card text-center" onclick="showTab('tab-creations')">
        <div class="empty-state py-4">
          <i class="bi bi-plus-circle"></i>
          <div>Voir toutes les créations</div>
          <small class="text-muted">${myTontines.length - 6} autres tontines</small>
        </div>
      </div>
    `;
  }
}

// Gestion des Corridors
async function loadCorridors() {
  try {
    const res = await apiFetch("/api/corridors");
    myCorridors = res.data || [];
    
    document.getElementById('corridorsCount').textContent = myCorridors.length;
    renderCorridors();
    renderActiveCorridors();
    
  } catch (err) {
    handleError('loadCorridors', err);
  }
}

function renderCorridors() {
  const container = document.getElementById("corridorsList");
  if (!container) return;
  
  if (myCorridors.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-graph-up"></i>
        <div>Aucun corridor créé</div>
        <small class="text-muted">Vos corridors apparaîtront ici</small>
      </div>
    `;
    return;
  }
  
  container.innerHTML = myCorridors.map(c => `
    <div class="border rounded p-3 mb-3 d-flex justify-content-between align-items-center">
      <div class="flex-grow-1">
        <strong>${escapeHtml(c.name)}</strong>
        <div class="small-muted">
          ${c.bareme ? `<i class="bi bi-currency-exchange"></i> ${c.bareme} XOF` : ''}
          ${c.commission ? ` • Commission: ${c.commission} XOF` : ''}
        </div>
      </div>
      <div class="d-flex gap-1">
        <button class="btn btn-sm btn-outline-danger" onclick="deleteCorridor(${c.id})">
          <i class="bi bi-trash"></i> Supprimer
        </button>
      </div>
    </div>
  `).join("");
}

function renderActiveCorridors() {
  const container = document.getElementById("activeCorridorsGrid");
  const activeCorridorsCount = document.getElementById("activeCorridorsCount");
  const activeCorridorsCountBadge = document.getElementById("activeCorridorsCountBadge");
  
  if (!myCorridors.length) {
    if (container) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-graph-up-arrow"></i>
          <div>Aucun corridor actif</div>
          <small class="text-muted">Créez votre premier corridor pour commencer</small>
        </div>
      `;
    }
    if (activeCorridorsCount) activeCorridorsCount.textContent = "0";
    if (activeCorridorsCountBadge) activeCorridorsCountBadge.textContent = "0 corridors";
    return;
  }
  
  if (activeCorridorsCount) activeCorridorsCount.textContent = myCorridors.length;
  if (activeCorridorsCountBadge) activeCorridorsCountBadge.textContent = `${myCorridors.length} corridors`;
  
  if (container) {
    container.innerHTML = myCorridors.map(corridor => `
      <div class="corridor-card" onclick="openCorridorDetails(${corridor.id})">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="mb-2">${escapeHtml(corridor.name)}</h6>
            <div class="small text-muted">
              <i class="bi bi-currency-exchange"></i> ${corridor.bareme || 0} XOF
            </div>
            <div class="small text-muted">
              ${corridor.commission ? `<i class="bi bi-percent"></i> Commission: ${corridor.commission} XOF` : ''}
            </div>
          </div>
          <span class="badge bg-success">Actif</span>
        </div>
        
        <div class="stats-mini">
          <div class="stat-mini">
            <div class="stat-mini-value">${corridor.participants_count || 0}</div>
            <div class="stat-mini-label">Participants</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-value">${corridor.completed_payments || 0}</div>
            <div class="stat-mini-label">Terminés</div>
          </div>
          <div class="stat-mini">
            <div class="stat-mini-value">${corridor.current_balance || 0}</div>
            <div class="stat-mini-label">XOF</div>
          </div>
        </div>
        
        <div class="mt-2 d-flex gap-1">
          <button class="btn btn-sm btn-outline-primary flex-fill" onclick="event.stopPropagation(); manageCorridorParticipants(${corridor.id})">
            <i class="bi bi-people"></i>
          </button>
          <button class="btn btn-sm btn-outline-success flex-fill" onclick="event.stopPropagation(); viewCorridorPayments(${corridor.id})">
            <i class="bi bi-cash-coin"></i>
          </button>
          <button class="btn btn-sm btn-outline-info flex-fill" onclick="event.stopPropagation(); sendCorridorMessage(${corridor.id})">
            <i class="bi bi-chat"></i>
          </button>
        </div>
      </div>
    `).join("");
  }
}

// Gestion des Demandes
async function loadPendingRequests() {
  try {
    const res = await apiFetch("/api/organizer/requests/pending");
    pendingRequests = res.data || [];
    
    const requestsContainer = document.getElementById("pendingRequestsList");
    const requestsBadge = document.getElementById("requestsBadge");
    const notificationCount = document.getElementById("notificationCount");
    const quickRequestsCount = document.getElementById("quickRequestsCount");
    
    // Mettre à jour le badge
    if (pendingRequests.length > 0) {
      if (requestsBadge) {
        requestsBadge.textContent = pendingRequests.length;
        requestsBadge.style.display = 'inline';
      }
      if (notificationCount) {
        notificationCount.textContent = pendingRequests.length;
        notificationCount.style.display = 'flex';
      }
      if (quickRequestsCount) {
        quickRequestsCount.textContent = `${pendingRequests.length} nouvelles`;
      }
      document.getElementById('pendingRequests').textContent = pendingRequests.length;
    } else {
      if (requestsBadge) requestsBadge.style.display = 'none';
      if (notificationCount) notificationCount.style.display = 'none';
      if (quickRequestsCount) quickRequestsCount.textContent = '0 nouvelles';
    }
    
    if (!requestsContainer) return;
    
    if (pendingRequests.length === 0) {
      requestsContainer.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-inbox"></i>
          <div>Aucune demande en attente</div>
          <small class="text-muted">Les nouvelles demandes apparaîtront ici</small>
        </div>
      `;
      return;
    }
    
    requestsContainer.innerHTML = pendingRequests.map(request => `
      <div class="border rounded p-3 mb-3">
        <div class="d-flex justify-content-between align-items-start">
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start">
              <div>
                <strong>${request.prenom} ${request.nom}</strong>
                <div class="small text-muted">
                  <i class="bi bi-envelope"></i> ${request.email}
                  ${request.telephone ? ` • <i class="bi bi-phone"></i> ${request.telephone}` : ''}
                </div>
                <div class="small mt-1">
                  <i class="bi bi-clock"></i> Demandé le: ${new Date(request.created_at).toLocaleDateString('fr-FR')}
                </div>
                <div class="small">
                  <i class="bi bi-${request.tontine_nom ? 'piggy-bank' : 'graph-up'}"></i> 
                  ${request.tontine_nom ? `Tontine: ${request.tontine_nom}` : ''}
                  ${request.corridor_nom ? `Corridor: ${request.corridor_nom}` : ''}
                </div>
              </div>
              <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm" onclick="handleRequest(${request.id}, 'accept')">
                  <i class="bi bi-check-lg"></i> Accepter
                </button>
                <button class="btn btn-danger btn-sm" onclick="handleRequest(${request.id}, 'reject')">
                  <i class="bi bi-x-lg"></i> Refuser
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    handleError('loadPendingRequests', err);
  }
}

// Gestion des Conversations
async function loadConversations() {
  try {
    console.log(' Chargement des conversations...');
    const res = await apiFetch("/api/messages/conversations");
    
    conversations = res.data || [];
    console.log(` ${conversations.length} conversation(s) chargée(s)`);
    
    renderConversations();
    updateMessagesBadge();
    
  } catch (err) {
    handleError('loadConversations', err);
  }
}

function renderConversations() {
  const container = document.getElementById("receivedMessages");
  if (!container) return;
  
  if (conversations.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="bi bi-chat-left"></i>
        <div>Aucun message reçu</div>
        <small class="text-muted">Vos conversations apparaîtront ici</small>
      </div>
    `;
    return;
  }

  container.innerHTML = conversations.map(conv => `
    <div class="border rounded p-3 mb-2 message-item ${conv.unread_count > 0 ? 'message-unread' : ''}">
      <div class="d-flex justify-content-between align-items-start">
        <div class="flex-grow-1">
          <div class="d-flex justify-content-between align-items-start">
            <div>
              <strong>${conv.prenom} ${conv.nom}</strong>
              ${conv.unread_count > 0 ? `<span class="badge bg-warning ms-2">${conv.unread_count} non lu(s)</span>` : ''}
              <div class="small text-muted mt-1">
                <i class="bi bi-envelope"></i> ${conv.email}
              </div>
              <div class="small text-muted">
                ${conv.tontine_name ? `<i class="bi bi-piggy-bank"></i> ${conv.tontine_name}` : ''}
                ${conv.corridor_name ? `<i class="bi bi-graph-up"></i> ${conv.corridor_name}` : ''}
              </div>
            </div>
            <div class="text-end">
              <small class="text-muted">${new Date(conv.last_message_date).toLocaleDateString('fr-FR')}</small>
            </div>
          </div>
          
          <div class="mt-2 p-2 bg-white rounded border">
            <div class="small">${escapeHtml(conv.last_message || 'Aucun message')}</div>
          </div>
          
          <div class="mt-2 d-flex gap-1 conversation-actions">
            <button class="btn btn-outline-primary btn-sm" onclick="openConversation(${conv.other_user_id}, ${conv.tontine_id || 'null'})">
              <i class="bi bi-chat"></i> Répondre
            </button>
            <button class="btn btn-outline-info btn-sm" onclick="viewFullConversation(${conv.other_user_id}, ${conv.tontine_id || 'null'})">
              <i class="bi bi-eye"></i> Voir
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="deleteConversation(${conv.other_user_id}, ${conv.tontine_id || 'null'})">
              <i class="bi bi-trash"></i> Supprimer
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function updateMessagesBadge() {
  const totalUnread = conversations.reduce((total, conv) => total + (conv.unread_count || 0), 0);
  const messagesBadge = document.getElementById("messagesBadge");
  const quickMessagesCount = document.getElementById("quickMessagesCount");
  
  if (totalUnread > 0) {
    if (messagesBadge) {
      messagesBadge.textContent = totalUnread;
      messagesBadge.style.display = 'inline';
    }
    if (quickMessagesCount) {
      quickMessagesCount.textContent = `${totalUnread} non lus`;
    }
  } else {
    if (messagesBadge) messagesBadge.style.display = 'none';
    if (quickMessagesCount) quickMessagesCount.textContent = '0 non lus';
  }
}

// Gestion des Participants
async function loadTontineParticipants(tontineId) {
  try {
    const res = await apiFetch(`/api/organizer/tontines/${tontineId}/participants`);
    const participants = res.data || [];
    
    const container = document.getElementById("participantsList");
    if (!container) return;
    
    if (participants.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-people"></i>
          <div>Aucun participant dans cette tontine</div>
          <small class="text-muted">Les participants apparaîtront ici</small>
        </div>
      `;
      return;
    }
    
    container.innerHTML = participants.map(participant => `
      <div class="border rounded p-3 mb-2 participant-item ${participant.payment_status === 'completed' ? 'payment-completed' : 'payment-pending'}">
        <div class="d-flex justify-content-between align-items-center">
          <div class="flex-grow-1">
            <strong>${participant.prenom} ${participant.nom}</strong>
            <div class="small text-muted">
              <i class="bi bi-envelope"></i> ${participant.email}
              ${participant.telephone ? ` • <i class="bi bi-phone"></i> ${participant.telephone}` : ''}
            </div>
            <div class="small">
              <i class="bi bi-calendar"></i> Rejoint le: ${new Date(participant.joined_at).toLocaleDateString('fr-FR')}
              • <span class="badge ${participant.payment_status === 'completed' ? 'bg-success' : 'bg-warning'}">
                ${participant.payment_status === 'completed' ? 'Paiement terminé' : 'Paiement en attente'}
              </span>
            </div>
          </div>
          <div class="d-flex gap-1">
            <button class="btn btn-outline-primary btn-sm" onclick="contactParticipant(${participant.id}, '${participant.email}')">
              <i class="bi bi-envelope"></i>
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="removeParticipant(${tontineId}, ${participant.id})">
              <i class="bi bi-person-dash"></i>
            </button>
          </div>
        </div>
      </div>
    `).join("");
  } catch (err) {
    handleError('loadTontineParticipants', err);
  }
}

// Gestion du Solde Total
async function loadTotalBalance() {
  try {
    // Cette fonction devrait appeler une API pour obtenir le solde total
    // Pour l'instant, on calcule à partir des tontines
    const totalBalance = myTontines.reduce((sum, tontine) => sum + (parseFloat(tontine.current_balance) || 0), 0);
    const balanceElement = document.getElementById('totalBalance');
    if (balanceElement) {
      balanceElement.textContent = formatCurrency(totalBalance);
    }
  } catch (err) {
    console.error('Erreur chargement solde total:', err);
  }
}

// FONCTIONS GLOBALES POUR L'INTERFACE

// Mettre à jour les sélecteurs de tontines
function updateTontineSelects() {
  const selects = ['selectedTontine', 'addTontineSelect', 'messageTontineSelect', 'messageToTontine'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '<option value="">Sélectionnez une tontine</option>' +
        myTontines.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join("");
    }
  });
}

// Mettre à jour la liste des participants pour le formulaire d'envoi
async function updateMessageParticipants(tontineId) {
  try {
    const select = document.getElementById('messageToParticipant');
    if (!select) return;
    
    select.innerHTML = '<option value="">Sélectionnez un participant</option>';
    
    if (!tontineId) return;
    
    const res = await apiFetch(`/api/organizer/tontines/${tontineId}/participants`);
    const participants = res.data || [];
    
    participants.forEach(participant => {
      const option = document.createElement('option');
      option.value = participant.id;
      option.textContent = `${participant.prenom} ${participant.nom} - ${participant.email}`;
      select.appendChild(option);
    });
  } catch (err) {
    console.error("Erreur chargement participants:", err);
  }
}

// GESTION DES ÉVÉNEMENTS ET FORMULAIRES

// Initialisation des événements
function initializeEventListeners() {
  // Événements de base
  const btnLogout = document.getElementById("btnLogout");
  const btnProfile = document.getElementById("btnProfile");
  const btnNotifications = document.getElementById("btnNotifications");

  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.removeItem("mec_token");
      localStorage.removeItem("mec_role");
      window.location.href = "login.html";
    });
  }
  
  if (btnProfile) {
    btnProfile.addEventListener("click", () => window.location.href = "profile.html");
  }
  
  if (btnNotifications) {
    btnNotifications.addEventListener("click", () => {
      showTab('tab-requests');
    });
  }

  // Formulaires de création
  const formTontine = document.getElementById("formTontine");
  const formCorridor = document.getElementById("formCorridor");

  if (formTontine) {
    formTontine.addEventListener("submit", handleTontineSubmit);
  }

  if (formCorridor) {
    formCorridor.addEventListener("submit", handleCorridorSubmit);
  }

  // Formulaire d'ajout de participant
  const addParticipantForm = document.getElementById("addParticipantForm");
  if (addParticipantForm) {
    addParticipantForm.addEventListener("submit", handleAddParticipant);
  }

  // Formulaire de message groupé
  const groupMessageForm = document.getElementById("groupMessageForm");
  if (groupMessageForm) {
    groupMessageForm.addEventListener("submit", handleGroupMessage);
  }

  // Formulaire d'envoi de message
  const sendMessageForm = document.getElementById("sendMessageForm");
  if (sendMessageForm) {
    sendMessageForm.addEventListener("submit", handleSendMessage);
  }

  // Bouton répondre dans le modal
  const btnReplyInModal = document.getElementById("btnReplyInModal");
  if (btnReplyInModal) {
    btnReplyInModal.addEventListener('click', () => {
      if (currentConversationUserId) {
        const modal = bootstrap.Modal.getInstance(document.getElementById('conversationModal'));
        if (modal) modal.hide();
        openConversation(currentConversationUserId, currentConversationTontineId);
      }
    });
  }

  // Événements de sélection
  const selectedTontine = document.getElementById('selectedTontine');
  if (selectedTontine) {
    selectedTontine.addEventListener('change', function() {
      if (this.value) {
        loadTontineParticipants(this.value);
      } else {
        const participantsList = document.getElementById('participantsList');
        if (participantsList) {
          participantsList.innerHTML = `
            <div class="empty-state">
              <i class="bi bi-people"></i>
              <div>Sélectionnez une tontine</div>
              <small class="text-muted">Choisissez une tontine pour voir ses participants</small>
            </div>
          `;
        }
      }
    });
  }

  const btnRefreshParticipants = document.getElementById('btnRefreshParticipants');
  if (btnRefreshParticipants) {
    btnRefreshParticipants.addEventListener('click', function() {
      const tontineId = document.getElementById('selectedTontine')?.value;
      if (tontineId) {
        loadTontineParticipants(tontineId);
      }
    });
  }

  const messageToTontine = document.getElementById('messageToTontine');
  if (messageToTontine) {
    messageToTontine.addEventListener('change', function() {
      updateMessageParticipants(this.value);
    });
  }

  // Formulaires de paiement
  const distributeFundsForm = document.getElementById('distributeFundsForm');
  if (distributeFundsForm) {
    distributeFundsForm.addEventListener('submit', handleDistributeFunds);
  }

  const paymentReminderForm = document.getElementById('paymentReminderForm');
  if (paymentReminderForm) {
    paymentReminderForm.addEventListener('submit', handlePaymentReminder);
  }
}

// Handlers de formulaires
async function handleTontineSubmit(e) {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  const originalText = button.innerHTML;
  
  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Création...';

  try {
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name").trim(),
      date: fd.get("date") || new Date().toISOString().split('T')[0],
      description: fd.get("description") || "",
      bareme: parseFloat(fd.get("bareme")) || 0,
      commission: parseFloat(fd.get("commission")) || 0,
      phone: fd.get("phone") || ""
    };

    if (!payload.name) throw new Error("Le nom est requis");
    if (!payload.bareme || payload.bareme <= 0) throw new Error("Le barème doit être un nombre positif");

    const res = await apiFetch("/api/tontines/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    await loadTontines();
    e.target.reset();
    showNotification(" Tontine créée avec succès!", "success");
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

async function handleCorridorSubmit(e) {
  e.preventDefault();
  const button = e.target.querySelector('button[type="submit"]');
  const originalText = button.innerHTML;
  
  button.disabled = true;
  button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Création...';

  try {
    const fd = new FormData(e.target);
    const payload = {
      name: fd.get("name").trim(),
      bareme: parseFloat(fd.get("bareme")) || 0,
      commission: parseFloat(fd.get("commission")) || 0,
      phone: fd.get("phone") || ""
    };

    if (!payload.name) throw new Error("Le nom est requis");
    if (!payload.bareme || payload.bareme <= 0) throw new Error("Le barème doit être un nombre positif");

    const res = await apiFetch("/api/corridors/create", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    await loadCorridors();
    e.target.reset();
    showNotification(" Corridor créé avec succès!", "success");
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = originalText;
  }
}

async function handleAddParticipant(e) {
  e.preventDefault();
  
  const tontineId = document.getElementById("addTontineSelect")?.value;
  const email = e.target.querySelector('input[type="email"]')?.value;
  
  if (!tontineId || !email) {
    showNotification(" Veuillez remplir tous les champs", "error");
    return;
  }
  
  try {
    const button = e.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Ajout...';
    
    const res = await apiFetch("/api/organizer/tontines/participants/add", {
      method: "POST",
      body: JSON.stringify({ tontineId, email })
    });
    
    showNotification(` ${res.message}`, "success");
    e.target.reset();
    
    // Recharger la liste des participants si la tontine est sélectionnée
    const selectedTontine = document.getElementById("selectedTontine")?.value;
    if (selectedTontine === tontineId) {
      await loadTontineParticipants(tontineId);
    }
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  } finally {
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-person-add me-2"></i>Ajouter le Participant';
  }
}

async function handleGroupMessage(e) {
  e.preventDefault();
  
  const tontineId = document.getElementById("messageTontineSelect")?.value;
  const message = e.target.querySelector('textarea')?.value;
  
  if (!tontineId || !message) {
    showNotification(" Veuillez remplir tous les champs", "error");
    return;
  }
  
  try {
    const button = e.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
    
    const res = await apiFetch("/api/organizer/tontines/message", {
      method: "POST",
      body: JSON.stringify({ tontineId, message })
    });
    
    showNotification(` ${res.message}`, "success");
    e.target.reset();
  } catch (err) {
    showNotification(" Erreur lors de l'envoi du message", "error");
  } finally {
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-send me-2"></i>Envoyer le Message';
  }
}

async function handleSendMessage(e) {
  e.preventDefault();
  
  const participantId = document.getElementById("messageToParticipant")?.value;
  const tontineId = document.getElementById("messageToTontine")?.value;
  const messageTextarea = e.target.querySelector('textarea');
  const messageContent = messageTextarea?.value.trim();
  
  console.log('📤 Données envoyées:', { 
    participantId, 
    tontineId,
    messageContent,
    contentLength: messageContent?.length 
  });
  
  if (!participantId || !messageContent) {
    showNotification(" Veuillez sélectionner un participant et écrire un message", "error");
    return;
  }
  
  try {
    const button = e.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
    
    const payload = {
      receiver_id: parseInt(participantId),
      message: messageContent
    };
    
    // Ajouter tontine_id seulement si fourni et valide
    if (tontineId && tontineId !== 'null' && tontineId !== '') {
      payload.tontine_id = parseInt(tontineId);
    }
    
    console.log(' Payload envoyé:', payload);
    
    const res = await apiFetch("/api/messages/send", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    
    console.log(' Réponse du serveur:', res);
    
    showNotification(" Message envoyé avec succès", "success");
    messageTextarea.value = '';
    await loadConversations();
    
  } catch (err) {
    console.error("Erreur envoi message:", err);
    showNotification(` ${err.message}`, "error");
  } finally {
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-send me-2"></i>Envoyer le Message';
  }
}

async function handleDistributeFunds(e) {
  e.preventDefault();
  
  const participantId = document.getElementById('distributionParticipant')?.value;
  const amount = parseFloat(e.target.querySelector('input[type="number"]')?.value);
  const tontineId = document.getElementById('selectedTontine')?.value;
  
  if (!participantId || !amount || !tontineId) {
    showNotification(' Veuillez remplir tous les champs', 'error');
    return;
  }

  if (amount <= 0) {
    showNotification(' Le montant doit être positif', 'error');
    return;
  }
  
  try {
    const button = e.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    
    const res = await apiFetch('/api/payments/distribute', {
      method: 'POST',
      body: JSON.stringify({ tontineId, userId: participantId, amount })
    });
    
    showNotification(' Fonds distribués avec succès', 'success');
    e.target.reset();
    await loadTontineBalance(tontineId);
    await loadTontineParticipants(tontineId);
    
  } catch (err) {
    showNotification(` ${err.message}`, 'error');
  } finally {
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-send"></i>';
  }
}

async function handlePaymentReminder(e) {
  e.preventDefault();
  
  const tontineId = document.getElementById('selectedTontine')?.value;
  const message = e.target.querySelector('textarea')?.value;
  
  if (!tontineId) {
    showNotification(' Veuillez sélectionner une tontine', 'error');
    return;
  }
  
  try {
    const button = e.target.querySelector('button[type="submit"]');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Envoi...';
    
    const res = await apiFetch('/api/payments/reminder', {
      method: 'POST',
      body: JSON.stringify({ tontineId, message })
    });
    
    showNotification(` ${res.message}`, 'success');
    e.target.reset();
    
  } catch (err) {
    showNotification(` ${err.message}`, 'error');
  } finally {
    const button = e.target.querySelector('button[type="submit"]');
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-bell me-2"></i>Envoyer Rappel';
  }
}

// FONCTIONS GLOBALES POUR LES ACTIONS

// Gestion des demandes
window.handleRequest = async (requestId, action) => {
  const actionText = action === 'accept' ? 'accepter' : 'refuser';
  if (!confirm(`Êtes-vous sûr de vouloir ${actionText} cette demande ?`)) return;
  
  try {
    const button = event.target;
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    
    const res = await apiFetch("/api/organizer/requests/handle", {
      method: "POST",
      body: JSON.stringify({ requestId, action })
    });
    
    showNotification(` ${res.message}`, "success");
    await loadPendingRequests();
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  }
};

// Gestion des participants
window.removeParticipant = async (tontineId, userId) => {
  if (!confirm("Êtes-vous sûr de vouloir retirer ce participant ?")) return;
  
  try {
    const res = await apiFetch("/api/organizer/tontines/participants/remove", {
      method: "POST",
      body: JSON.stringify({ tontineId, userId })
    });
    
    showNotification(` ${res.message}`, "success");
    await loadTontineParticipants(tontineId);
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  }
};

window.contactParticipant = (participantId, email) => {
  const message = prompt(`Envoyer un message à ${email}:`);
  if (message) {
    showNotification(`Message envoyé à ${email}`, "success");
  }
};

// Fonctions de suppression
window.deleteTontine = async (id) => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer cette tontine ? Cette action est irréversible.")) return;
  
  try {
    const res = await apiFetch(`/api/tontines/${id}`, { method: "DELETE" });
    showNotification(" Tontine supprimée avec succès!", "success");
    await loadTontines();
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  }
};

window.deleteCorridor = async (id) => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce corridor ? Cette action est irréversible.")) return;
  
  try {
    const res = await apiFetch(`/api/corridors/${id}`, { method: "DELETE" });
    showNotification(" Corridor supprimé avec succès!", "success");
    await loadCorridors();
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  }
};

// Fonctions utilitaires
window.copyToken = (token) => {
  navigator.clipboard?.writeText(token).then(() => {
    showNotification(" Token copié dans le presse-papiers!", "success");
  }).catch(() => {
    showNotification(" Erreur lors de la copie du token", "error");
  });
};

// Fonctions pour les actions cliquables
window.showActiveTontines = function() {
  showTab('tab-creations');
};

window.showActiveCorridors = function() {
  showTab('tab-corridors-active');
};

window.openTontineDetails = async function(tontineId) {
  try {
    const res = await apiFetch(`/api/tontines/${tontineId}`);
    const tontine = res.data;
    
    const modalContent = document.getElementById("tontineDetailsContent");
    modalContent.innerHTML = `
      <div class="row">
        <div class="col-12">
          <h6>Informations Générales</h6>
          <table class="table table-sm">
            <tr><td><strong>Nom:</strong></td><td>${escapeHtml(tontine.name)}</td></tr>
            <tr><td><strong>Description:</strong></td><td>${escapeHtml(tontine.description || 'Non renseignée')}</td></tr>
            <tr><td><strong>Barème:</strong></td><td>${tontine.bareme || '0'} XOF</td></tr>
            <tr><td><strong>Commission:</strong></td><td>${tontine.commission || '0'} XOF</td></tr>
            <tr><td><strong>Date:</strong></td><td>${tontine.date ? tontine.date.split('T')[0] : 'Non définie'}</td></tr>
            <tr><td><strong>Token:</strong></td><td><code>${tontine.token || 'Non généré'}</code></td></tr>
          </table>
        </div>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="copyToken('${tontine.token}')">
          <i class="bi bi-copy"></i> Copier le Token
        </button>
        <button class="btn btn-success btn-sm" onclick="manageTontineParticipants(${tontine.id})">
          <i class="bi bi-people"></i> Gérer Participants
        </button>
      </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('tontineDetailsModal'));
    modal.show();
  } catch (err) {
    showNotification(" Erreur lors du chargement des détails", "error");
  }
};

window.openCorridorDetails = async function(corridorId) {
  try {
    const res = await apiFetch(`/api/corridors/${corridorId}`);
    const corridor = res.data;
    
    const modalContent = document.getElementById("corridorDetailsContent");
    modalContent.innerHTML = `
      <div class="row">
        <div class="col-12">
          <h6>Détails du Corridor</h6>
          <table class="table table-sm">
            <tr><td><strong>Nom:</strong></td><td>${escapeHtml(corridor.name)}</td></tr>
            <tr><td><strong>Barème:</strong></td><td>${corridor.bareme || '0'} XOF</td></tr>
            <tr><td><strong>Commission:</strong></td><td>${corridor.commission || '0'} XOF</td></tr>
            <tr><td><strong>Participants:</strong></td><td>${corridor.participants_count || '0'}</td></tr>
            <tr><td><strong>Solde actuel:</strong></td><td>${corridor.current_balance || '0'} XOF</td></tr>
            <tr><td><strong>Date création:</strong></td><td>${corridor.created_at ? corridor.created_at.split('T')[0] : 'Non définie'}</td></tr>
          </table>
        </div>
      </div>
      <div class="mt-3 d-flex gap-2">
        <button class="btn btn-primary btn-sm" onclick="manageCorridorParticipants(${corridor.id})">
          <i class="bi bi-people"></i> Gérer Participants
        </button>
        <button class="btn btn-success btn-sm" onclick="viewCorridorPayments(${corridor.id})">
          <i class="bi bi-cash-coin"></i> Voir Paiements
        </button>
      </div>
    `;
    
    const modal = new bootstrap.Modal(document.getElementById('corridorDetailsModal'));
    modal.show();
  } catch (err) {
    showNotification(" Erreur lors du chargement des détails du corridor", "error");
  }
};

window.manageTontineParticipants = function(tontineId) {
  document.getElementById('selectedTontine').value = tontineId;
  showTab('tab-participants');
  setTimeout(() => {
    if (document.getElementById('selectedTontine').value == tontineId) {
      loadTontineParticipants(tontineId);
    }
  }, 500);
};

window.manageCorridorParticipants = function(corridorId) {
  showTab('tab-participants');
  showNotification(" Fonctionnalité de gestion des participants pour les corridors à venir", "info");
};

window.viewCorridorPayments = function(corridorId) {
  showTab('tab-participants');
  showNotification(" Fonctionnalité de visualisation des paiements pour les corridors à venir", "info");
};

window.sendCorridorMessage = function(corridorId) {
  showTab('tab-messages');
  showNotification(" Fonctionnalité d'envoi de messages pour les corridors à venir", "info");
};

// Fonctions pour la messagerie
window.openConversation = (userId, tontineId) => {
  document.getElementById('messageToParticipant').value = userId;
  if (tontineId && tontineId !== 'null') {
    document.getElementById('messageToTontine').value = tontineId;
    updateMessageParticipants(tontineId);
  }
  
  const textarea = document.querySelector('#sendMessageForm textarea');
  if (textarea) textarea.focus();
};

window.viewFullConversation = async (userId, tontineId) => {
  try {
    let url = `/api/messages/conversation/${userId}`;
    if (tontineId && tontineId !== 'null') {
      url += `?tontineId=${tontineId}`;
    }
    
    const res = await apiFetch(url);
    currentConversationMessages = res.data || [];
    
    currentConversationUserId = userId;
    currentConversationTontineId = tontineId !== 'null' ? tontineId : null;
    
    const conversationContent = document.getElementById("conversationContent");
    
    if (currentConversationMessages.length === 0) {
      conversationContent.innerHTML = '<div class="text-center text-muted py-4">Aucun message dans cette conversation</div>';
    } else {
      conversationContent.innerHTML = currentConversationMessages.map(msg => `
        <div class="message-container border rounded p-3 mb-2 ${msg.sender_id === userId ? 'message-item' : 'message-sent'}">
          <div class="message-actions">
            <button class="btn btn-sm btn-outline-danger" onclick="deleteSingleMessage(${msg.id})" title="Supprimer ce message">
              <i class="bi bi-trash"></i>
            </button>
          </div>
          <div class="d-flex justify-content-between align-items-start">
            <div class="flex-grow-1">
              <strong>${msg.sender_prenom} ${msg.sender_nom}</strong>
              <div class="small text-muted">${new Date(msg.created_at).toLocaleString('fr-FR')}</div>
              <div class="mt-2">${escapeHtml(msg.message)}</div>
            </div>
            ${msg.is_read ? '<small class="text-success"><i class="bi bi-check2-all"></i> Lu</small>' : ''}
          </div>
        </div>
      `).join('');
    }
    
    document.querySelector('#conversationModal .modal-title').textContent = 
      `Conversation avec ${currentConversationMessages[0]?.sender_prenom || 'Utilisateur'}`;
    
    const modal = new bootstrap.Modal(document.getElementById('conversationModal'));
    modal.show();
    
  } catch (err) {
    showNotification("Erreur lors du chargement de la conversation", "error");
  }
};

window.deleteSingleMessage = async (messageId) => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer ce message ? Cette action est irréversible.")) {
    return;
  }

  try {
    await apiFetch(`/api/messages/${messageId}`, {
      method: "DELETE"
    });

    showNotification("Message supprimé avec succès", "success");
    
    if (currentConversationUserId) {
      await viewFullConversation(currentConversationUserId, currentConversationTontineId);
    }
    
    await loadConversations();
    
  } catch (err) {
    showNotification("Erreur lors de la suppression du message", "error");
  }
};

window.deleteConversation = async (userId, tontineId) => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer toute cette conversation ? Cette action est irréversible.")) {
    return;
  }

  try {
    let url = `/api/messages/conversation/${userId}`;
    if (tontineId && tontineId !== 'null') {
      url += `?tontineId=${tontineId}`;
    }

    await apiFetch(url, {
      method: "DELETE"
    });

    showNotification("Conversation supprimée avec succès", "success");
    
    await loadConversations();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('conversationModal'));
    if (modal) {
      modal.hide();
    }
    
  } catch (err) {
    showNotification("Erreur lors de la suppression de la conversation", "error");
  }
};

window.clearAllMessages = async () => {
  if (!confirm("Êtes-vous sûr de vouloir supprimer TOUS les messages ? Cette action est irréversible et supprimera toutes vos conversations.")) {
    return;
  }

  try {
    console.log(" Tentative de suppression de tous les messages...");
    
    const res = await apiFetch(`/api/messages/clear-all`, {
      method: "DELETE"
    });

    showNotification(" Tous les messages ont été supprimés avec succès", "success");
    
    conversations = [];
    currentConversationMessages = [];
    currentConversationUserId = null;
    currentConversationTontineId = null;
    
    renderConversations();
    updateMessagesBadge();
    
    const modal = bootstrap.Modal.getInstance(document.getElementById('conversationModal'));
    if (modal) {
      modal.hide();
    }
    
    setTimeout(() => {
      loadConversations();
    }, 1000);
    
  } catch (err) {
    showNotification(` ${err.message}`, "error");
  }
};

// Fonction pour charger le solde d'une tontine
async function loadTontineBalance(tontineId) {
  try {
    const res = await apiFetch(`/api/payments/balance/${tontineId}`);
    const balance = res.data.balance;

    const currentBalanceElement = document.getElementById('currentBalance');
    if (currentBalanceElement) {
      currentBalanceElement.textContent = `${parseFloat(balance.current_balance).toLocaleString()} XOF`;
    }
  } catch (err) {
    console.error('Erreur chargement solde:', err);
  }
}

// INITIALISATION

// Démarrer l'application
document.addEventListener('DOMContentLoaded', function() {
  // Vérifier l'authentification
  const token = localStorage.getItem("mec_token");
  const role = localStorage.getItem("mec_role");

  if (!token || role !== "organisateur") {
    window.location.href = "login.html";
    return;
  }

  // Initialiser les écouteurs d'événements
  initializeEventListeners();
  
  // Charger le dashboard
  loadOrganizerDashboard();

  // Actualisation périodique
  setInterval(() => {
    Promise.allSettled([
      loadPendingRequests(),
      loadConversations()
    ]).catch(err => {
      console.error('Erreur lors de l\'actualisation périodique:', err);
    });
  }, 10000);
});